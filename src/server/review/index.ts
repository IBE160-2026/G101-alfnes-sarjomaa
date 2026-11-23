import "server-only";
import {
  and,
  asc,
  count,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { createFromSetSchema, QUESTION_SETS } from "@/lib/question-sets";
import { boardCut, rankGroups } from "@/lib/ranking";
import {
  collapseChips,
  confirmBoardSchema,
  groupRefSchema,
  markReviewedSchema,
  mergeGroupsSchema,
  mostCommon,
  moveAnswersSchema,
  renameGroupSchema,
} from "@/lib/review";
import { withBoundary } from "@/server/boundary";
import { getDb, type Db, type Tx } from "@/server/db/client";
import {
  answer,
  answerGroup,
  boardSlot,
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
  // Ordered by text, as the chips are, so a tie picks the same written form.
  const forms = await db
    .select({
      groupId: answer.groupId,
      normalizedText: answer.normalizedText,
      text: answer.text,
      n: count(),
    })
    .from(answer)
    .where(and(eq(answer.questionId, questionId), isNotNull(answer.groupId)))
    .groupBy(answer.groupId, answer.normalizedText, answer.text)
    .orderBy(asc(answer.text));
  return rankGroups(
    groups.map((g) => ({
      ...g,
      labelCandidates: candidates
        .filter((c) => c.groupId === g.groupId)
        .map((c) => ({
          ...c,
          display: mostCommon(
            forms
              .filter(
                (f) => f.groupId === c.groupId && f.normalizedText === c.text,
              )
              .map((f): [string, number] => [f.text, f.n]),
          ),
        })),
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

// Lowercase only: Postgres matches an uppercase uuid, but the ID comparisons in
// JavaScript below would not, so it would surface as INTERNAL instead of NOT_FOUND.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

// Rename, discard and restore: the Group and its effective label.
export type LabelResult = { groupId: string; label: string };

// FR-20: sets a non-discarded Group's label (1 to 40 characters, trimmed), in one
// transaction with its edit_count, groups_renamed and the cleared reviewed mark (AD-15).
export function rename(hostId: string, input: unknown): Promise<LabelResult> {
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

// FR-20, FR-21: flips a Group's discarded flag in one transaction with its edit_count,
// the counter and the cleared reviewed mark (AD-15). Discard needs a kept Group and
// restore a discarded one, else NOT_FOUND, so a stale tab refreshes instead of counting
// a no-op. Nothing is deleted; boardCut keeps discarded Groups off the Board.
function flipDiscarded(
  op: "discard" | "restore",
  hostId: string,
  input: unknown,
): Promise<LabelResult> {
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

export type MarkResult = { position: number; next: number | null };

// FR-21: marks or unmarks one Question in one transaction (AD-4, AD-15). Marking needs a
// non-discarded Group. No counter or edit_count changes. `next` is the first unreviewed
// Question after this one, wrapping to the start, else null.
export function setReviewed(
  hostId: string,
  input: unknown,
): Promise<MarkResult> {
  return withBoundary("review", "setReviewed", async () => {
    const { gameId, questionId, reviewed } = validate(
      markReviewedSchema,
      input,
    );
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.editReview,
      });
      // Found in the owned Game's list, so no query ever takes a foreign or malformed id (AD-5).
      const all = await tx
        .select({
          id: question.id,
          position: question.position,
          reviewed: question.reviewed,
        })
        .from(question)
        .where(eq(question.gameId, gameId))
        .orderBy(asc(question.position));
      const i = all.findIndex((q) => q.id === questionId);
      if (i < 0) throw new DomainError("NOT_FOUND");
      if (reviewed) {
        const [kept] = await tx
          .select({ id: answerGroup.id })
          .from(answerGroup)
          .where(
            and(
              eq(answerGroup.questionId, questionId),
              eq(answerGroup.discarded, false),
            ),
          )
          .limit(1);
        if (!kept) throw new DomainError("NO_GROUPS_ON_BOARD");
      }
      await questions.setReviewed(tx, questionId, reviewed);
      const next = [...all.slice(i + 1), ...all.slice(0, i)].find(
        (q) => !q.reviewed,
      );
      return { position: all[i].position, next: next?.position ?? null };
    });
  });
}

// FR-21, FR-13: locks the Board in one transaction (AD-15). Every Question must be
// reviewed. Each gets board_slot rows from boardCut, with the Counts read before
// clearContributorData empties the keys they come from; then the Game is ready.
export function confirmBoard(
  hostId: string,
  input: unknown,
): Promise<{ questions: number }> {
  return withBoundary("review", "confirmBoard", async () => {
    const { gameId } = validate(confirmBoardSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.confirmBoard,
      });
      const all = await tx
        .select({ id: question.id, reviewed: question.reviewed })
        .from(question)
        .where(eq(question.gameId, gameId));
      if (all.some((q) => !q.reviewed))
        throw new DomainError("QUESTIONS_UNREVIEWED");
      for (const q of all) {
        const { board } = boardCut(await rankedGroups(tx, q.id));
        if (board.length === 0) throw new DomainError("NO_GROUPS_ON_BOARD");
        await tx.insert(boardSlot).values(
          board.map((g, i) => ({
            questionId: q.id,
            position: i + 1,
            label: g.label,
            count: g.count,
            groupId: g.groupId,
          })),
        );
      }
      await grouping.clearContributorData(tx, gameId);
      await games.transition(tx, gameId, "in_review", "ready");
      return { questions: all.length };
    });
  });
}

// FR-33: a Game from a ready-made Question set, born in ready with its Board locked, in one
// transaction. Here, not in games, because review is the latest of the three owners it
// composes (AD-1): games.insertReady, questions.insertAll and this module's board_slot.
// The Board goes through rankGroups and boardCut like confirmBoard's (AD-11), so play
// reads it through getBoard with no separate path (AD-15).
export function createFromQuestionSet(
  hostId: string,
  input: unknown,
): Promise<{ id: string }> {
  return withBoundary("review", "createFromQuestionSet", async () => {
    const { title, questionSet } = validate(createFromSetSchema, input);
    const set = QUESTION_SETS.find((s) => s.id === questionSet)!;
    const db = await getDb();
    return db.transaction(async (tx) => {
      const { id } = await games.insertReady(tx, {
        hostId,
        title,
        questionSet,
      });
      const ids = await questions.insertAll(
        tx,
        id,
        set.questions.map((q) => q.text),
      );
      await tx.insert(boardSlot).values(
        set.questions.flatMap((q, i) => {
          const { board } = boardCut(
            rankGroups(
              q.groups.map((g) => ({
                groupId: g.cluster,
                count: g.count,
                rank1Count: 0,
                labelCandidates: [],
                customLabel: g.label,
                discarded: false,
              })),
            ),
          );
          return board.map((g, j) => ({
            questionId: ids[i],
            position: j + 1,
            label: g.label,
            count: g.count,
          }));
        }),
      );
      return { id };
    });
  });
}

// AD-15: the locked Board of one Game, the only way play reads board_slot. Returned
// un-awaited, so play can await the rows or use it as a subquery (`.as("board")`) for
// the Score sum (AD-11). Takes an owner-checked gameId: it checks nothing itself.
export function getBoard(db: Db, gameId: string) {
  return db
    .select({
      id: boardSlot.id,
      questionId: boardSlot.questionId,
      position: boardSlot.position,
      label: boardSlot.label,
      count: boardSlot.count,
    })
    .from(boardSlot)
    .innerJoin(question, eq(question.id, boardSlot.questionId))
    .where(eq(question.gameId, gameId))
    .orderBy(asc(question.position), asc(boardSlot.position));
}
