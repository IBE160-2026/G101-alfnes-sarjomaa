import "server-only";
import {
  and,
  asc,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { boardCut, rankGroups } from "@/lib/ranking";
import { collapseChips, mergeGroupsSchema } from "@/lib/review";
import { withBoundary } from "@/server/boundary";
import { getDb, type Db, type Tx } from "@/server/db/client";
import {
  answer,
  answerGroup,
  groupingResult,
  question,
} from "@/server/db/schema";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";
import * as questions from "@/server/questions";

export type ReviewGroup = {
  id: string;
  label: string;
  count: number;
  chips: { text: string; n: number }[];
};

// One Question's Groups in Board order (AD-11), discarded ones included. Every query
// selects aggregates or text only, never contributor_key or rank (FR-12, AD-10).
async function rankedGroups(db: Db | Tx, questionId: string) {
  const groups = await db
    .select({
      groupId: answerGroup.id,
      customLabel: answerGroup.customLabel,
      discarded: answerGroup.discarded,
      count: countDistinct(answer.contributorKey),
      rank1Count:
        sql<number>`count(distinct ${answer.contributorKey}) filter (where ${answer.rank} = 1)`.mapWith(
          Number,
        ),
    })
    .from(answerGroup)
    .innerJoin(answer, eq(answer.groupId, answerGroup.id))
    .where(eq(answerGroup.questionId, questionId))
    .groupBy(answerGroup.id);
  const candidates = await db
    .select({
      groupId: answer.groupId,
      text: answer.normalizedText,
      count: countDistinct(answer.contributorKey),
    })
    .from(answer)
    .where(and(eq(answer.questionId, questionId), isNotNull(answer.groupId)))
    .groupBy(answer.groupId, answer.normalizedText);
  return rankGroups(
    groups.map((g) => ({
      ...g,
      labelCandidates: candidates.filter((c) => c.groupId === g.groupId),
    })),
  );
}

// One Question's Groups for the Host (FR-19).
async function groupsOf(questionId: string) {
  const db = await getDb();
  const ranked = await rankedGroups(db, questionId);
  const answers = await db
    .select({
      groupId: answer.groupId,
      text: answer.text,
      normalizedText: answer.normalizedText,
    })
    .from(answer)
    .where(eq(answer.questionId, questionId))
    .orderBy(asc(answer.normalizedText), asc(answer.text));
  const toDto = (g: (typeof ranked)[number]): ReviewGroup => ({
    id: g.groupId,
    label: g.label,
    count: g.count,
    chips: collapseChips(answers.filter((a) => a.groupId === g.groupId)),
  });
  const { board, below, discarded } = boardCut(ranked);
  return {
    board: board.map(toDto),
    below: below.map(toDto),
    discarded: discarded.map(toDto),
  };
}

// Review of an owned Game in review. The current Question is `position` if it exists,
// else the first unreviewed one, else the first.
export function load(hostId: string, gameId: string, position?: number) {
  return withBoundary("review", "load", async () => {
    const { title, state } = await games.getOwned(hostId, gameId);
    if (state !== "in_review") throw new DomainError("WRONG_STATE");
    const db = await getDb();
    const questions = await db
      .select({
        id: question.id,
        position: question.position,
        text: question.text,
        reviewed: question.reviewed,
        fallbackReason: groupingResult.fallbackReason,
      })
      .from(question)
      .leftJoin(groupingResult, eq(groupingResult.questionId, question.id))
      .where(eq(question.gameId, gameId))
      .orderBy(asc(question.position));
    const current =
      questions.find((q) => q.position === position) ??
      questions.find((q) => !q.reviewed) ??
      questions[0];
    return {
      title,
      questions,
      current: { position: current.position, ...(await groupsOf(current.id)) },
    };
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MergeResult = {
  groupId: string;
  label: string;
  count: number;
  position: number;
};

// FR-20: merges two or more Groups of one Question into the highest-ranked one, in one
// transaction (AD-15). Every ID must be a non-discarded Group of the owned Game, all of
// one Question, else NOT_FOUND before any write (AD-5).
export function merge(hostId: string, input: unknown): Promise<MergeResult> {
  return withBoundary("review", "merge", async () => {
    const { gameId, groupIds } = validate(mergeGroupsSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.editReview,
      });
      // Postgres would reject a malformed uuid with 22P02 (INTERNAL).
      if (!groupIds.every((id) => UUID.test(id)))
        throw new DomainError("NOT_FOUND");
      const found = await tx
        .select({ questionId: answerGroup.questionId })
        .from(answerGroup)
        .innerJoin(question, eq(question.id, answerGroup.questionId))
        .where(
          and(
            eq(question.gameId, gameId),
            inArray(answerGroup.id, groupIds),
            eq(answerGroup.discarded, false),
          ),
        );
      const questionId = found[0]?.questionId;
      if (
        found.length !== groupIds.length ||
        found.some((g) => g.questionId !== questionId)
      )
        throw new DomainError("NOT_FOUND");

      const [target, ...sources] = (await rankedGroups(tx, questionId)).filter(
        (g) => groupIds.includes(g.groupId),
      );
      await grouping.mergeGroups(tx, {
        targetId: target.groupId,
        sourceIds: sources.map((g) => g.groupId),
        label: target.label,
      });
      // Groups merged away, so merging three counts two.
      await games.bumpCounters(tx, gameId, { groupsMerged: sources.length });
      await questions.setReviewed(tx, questionId, false);

      const kept = (await rankedGroups(tx, questionId)).filter(
        (g) => !g.discarded,
      );
      const i = kept.findIndex((g) => g.groupId === target.groupId);
      return {
        groupId: target.groupId,
        label: target.label,
        count: kept[i].count,
        position: i + 1,
      };
    });
  });
}
