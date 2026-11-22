import "server-only";
import { and, asc, countDistinct, eq, isNotNull, sql } from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { boardCut, rankGroups } from "@/lib/ranking";
import { collapseChips } from "@/lib/review";
import { withBoundary } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import {
  answer,
  answerGroup,
  groupingResult,
  question,
} from "@/server/db/schema";
import * as games from "@/server/games";

export type ReviewGroup = {
  id: string;
  label: string;
  count: number;
  chips: { text: string; n: number }[];
};

// One Question's Groups for the Host (FR-19). Every query selects aggregates or text only,
// never contributor_key or rank (FR-12, AD-10).
async function groupsOf(questionId: string) {
  const db = await getDb();
  const ofQuestion = eq(answer.questionId, questionId);
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
    .where(and(ofQuestion, isNotNull(answer.groupId)))
    .groupBy(answer.groupId, answer.normalizedText);
  const answers = await db
    .select({
      groupId: answer.groupId,
      text: answer.text,
      normalizedText: answer.normalizedText,
    })
    .from(answer)
    .where(ofQuestion)
    .orderBy(asc(answer.normalizedText), asc(answer.text));

  const ranked = rankGroups(
    groups.map((g) => ({
      ...g,
      labelCandidates: candidates.filter((c) => c.groupId === g.groupId),
    })),
  );
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
