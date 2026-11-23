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
import {
  collapseChips,
  groupRefSchema,
  mergeGroupsSchema,
  moveAnswersSchema,
  renameGroupSchema,
} from "@/lib/review";
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
  // ids: the chip's Answer IDs (random v4, no order signal), for moving them (FR-20).
  chips: { text: string; n: number; ids: string[] }[];
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
      id: answer.id,
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

      return placeOf(tx, questionId, target.groupId);
    });
  });
}

// A Group after an edit: effective label, Count (SQL) and 1-based place among the
// non-discarded ranked Groups, the rank its card shows.
async function placeOf(
  tx: Tx,
  questionId: string,
  groupId: string,
): Promise<MergeResult> {
  const kept = (await rankedGroups(tx, questionId)).filter((g) => !g.discarded);
  const i = kept.findIndex((g) => g.groupId === groupId);
  return {
    groupId,
    label: kept[i].label,
    count: kept[i].count,
    position: i + 1,
  };
}

// A Group of the owned Game in the wanted discarded state (by default not discarded),
// else NOT_FOUND (AD-5). Discarded Groups are frozen for merge, move and rename.
async function ownedGroup(
  tx: Tx,
  gameId: string,
  groupId: string,
  discarded = false,
) {
  if (!UUID.test(groupId)) throw new DomainError("NOT_FOUND");
  const [found] = await tx
    .select({ questionId: answerGroup.questionId })
    .from(answerGroup)
    .innerJoin(question, eq(question.id, answerGroup.questionId))
    .where(
      and(
        eq(question.gameId, gameId),
        eq(answerGroup.id, groupId),
        eq(answerGroup.discarded, discarded),
      ),
    );
  if (!found) throw new DomainError("NOT_FOUND");
  return found.questionId;
}

export type MoveResult = MergeResult & { moved: number; created: boolean };

// FR-20: moves Answers of one Question into another non-discarded Group of it, or into a
// new Group (no groupId) with origin host and the FR-16 default label, in one transaction
// (AD-15). Every ID must resolve inside the owned Game, else NOT_FOUND before any write.
// A move never freezes the target's label; only merge does (AD-11).
export function moveAnswers(
  hostId: string,
  input: unknown,
): Promise<MoveResult> {
  return withBoundary("review", "moveAnswers", async () => {
    const { gameId, answerIds, groupId } = validate(moveAnswersSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.editReview,
      });
      if (!answerIds.every((id) => UUID.test(id)))
        throw new DomainError("NOT_FOUND");
      const found = await tx
        .select({ questionId: answerGroup.questionId })
        .from(answer)
        .innerJoin(answerGroup, eq(answerGroup.id, answer.groupId))
        .innerJoin(question, eq(question.id, answerGroup.questionId))
        .where(
          and(
            eq(question.gameId, gameId),
            inArray(answer.id, answerIds),
            eq(answerGroup.discarded, false),
          ),
        );
      const questionId = found[0]?.questionId;
      if (
        found.length !== answerIds.length ||
        found.some((a) => a.questionId !== questionId)
      )
        throw new DomainError("NOT_FOUND");
      if (
        groupId !== undefined &&
        (await ownedGroup(tx, gameId, groupId)) !== questionId
      )
        throw new DomainError("NOT_FOUND");

      const created = groupId === undefined;
      const { groupId: target, moved } = await grouping.moveAnswers(tx, {
        questionId,
        answerIds,
        targetId: groupId,
      });
      if (moved > 0) {
        await games.bumpCounters(tx, gameId, {
          ...(created && { groupsCreated: 1 }),
          answersMoved: moved,
        });
        await questions.setReviewed(tx, questionId, false);
      }
      return { ...(await placeOf(tx, questionId, target)), moved, created };
    });
  });
}

export type RenameResult = { groupId: string; label: string };

// FR-20: sets a non-discarded Group's label (1 to 40 characters, trimmed), in one
// transaction with its edit_count, groups_renamed and the cleared reviewed mark (AD-15).
export function rename(hostId: string, input: unknown): Promise<RenameResult> {
  return withBoundary("review", "rename", async () => {
    const { gameId, groupId, label } = validate(renameGroupSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.editReview,
      });
      const questionId = await ownedGroup(tx, gameId, groupId);
      await grouping.setCustomLabel(tx, { groupId, label });
      await games.bumpCounters(tx, gameId, { groupsRenamed: 1 });
      await questions.setReviewed(tx, questionId, false);
      return { groupId, label };
    });
  });
}

export type DiscardResult = { groupId: string; label: string };

// FR-20, FR-21: flips a Group's discarded flag in one transaction with its edit_count,
// the counter and the cleared reviewed mark (AD-15). Discard needs a kept Group and
// restore a discarded one, else NOT_FOUND, so a stale tab refreshes instead of counting
// a no-op. Nothing is deleted; boardCut keeps discarded Groups off the Board.
function flipDiscarded(
  op: "discard" | "restore",
  hostId: string,
  input: unknown,
): Promise<DiscardResult> {
  return withBoundary("review", op, async () => {
    const { gameId, groupId } = validate(groupRefSchema, input);
    const discarded = op === "discard";
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.editReview,
      });
      const questionId = await ownedGroup(tx, gameId, groupId, !discarded);
      await grouping.setDiscarded(tx, { groupId, discarded });
      await games.bumpCounters(
        tx,
        gameId,
        discarded ? { groupsDiscarded: 1 } : { groupsRestored: 1 },
      );
      await questions.setReviewed(tx, questionId, false);
      const { label } = (await rankedGroups(tx, questionId)).find(
        (g) => g.groupId === groupId,
      )!;
      return { groupId, label };
    });
  });
}

export const discard = (hostId: string, input: unknown) =>
  flipDiscarded("discard", hostId, input);

export const restore = (hostId: string, input: unknown) =>
  flipDiscarded("restore", hostId, input);
