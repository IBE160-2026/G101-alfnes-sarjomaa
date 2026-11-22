import "server-only";
import { randomUUID } from "node:crypto";
import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";
import { DomainError } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { JUDGE_CONCURRENCY, JUDGE_TIMEOUT_MS } from "@/lib/limits";
import { NORMALIZE_VERSION } from "@/lib/normalize";
import { withBoundary } from "@/server/boundary";
import { getDb, type Tx } from "@/server/db/client";
import {
  answer,
  answerGroup,
  groupingResult,
  question,
} from "@/server/db/schema";
import * as games from "@/server/games";
import {
  getJudge,
  JudgeError,
  type Judge,
  type PartitionResult,
} from "@/server/judge";
import * as questions from "@/server/questions";

export type AnswerRow = Omit<typeof answer.$inferInsert, "id">;

// The only writer of `answer` (AD-1, AD-9). Rows go in exactly as given, so the caller's
// shuffle is the physical order; ids come from gen_random_uuid().
export async function insertAnswers(tx: Tx, rows: AnswerRow[]): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(answer).values(rows);
}

// A Game deleted or already past grouping: the run stops without a trace (AD-12).
const isGone = (error: unknown) =>
  error instanceof DomainError &&
  (error.code === "NOT_FOUND" || error.code === "WRONG_STATE");

// The runner's own timer, so the 30 s bound holds even for a provider that ignores the signal.
// It rejects one setImmediate after the abort, so a provider that honours the signal settles
// first with its own call count.
async function timedPartition(
  judge: Judge,
  input: { question: string; items: string[] },
): Promise<PartitionResult | JudgeError> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  const timedOut = new Promise<never>((_, reject) =>
    controller.signal.addEventListener("abort", () =>
      setImmediate(() => reject(new JudgeError("TIMEOUT"))),
    ),
  );
  try {
    return await Promise.race([
      judge.partition(input, controller.signal),
      timedOut,
    ]);
  } catch (error) {
    return error instanceof JudgeError ? error : new JudgeError("ERROR");
  } finally {
    clearTimeout(timer);
  }
}

async function groupQuestion(
  judge: Judge,
  gameId: string,
  q: questions.Question,
): Promise<void> {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ text: answer.normalizedText })
    .from(answer)
    .where(eq(answer.questionId, q.id));
  // JS sort (code-unit order), never the database collation (AD-12).
  const items = rows.map((r) => r.text).sort();
  // Outside any transaction (AD-12).
  const outcome = await timedPartition(judge, { question: q.text, items });
  const fellBack = outcome instanceof JudgeError;
  const assignments = fellBack ? items.map((_, i) => i) : outcome.assignments;
  const members: string[][] = [];
  items.forEach((item, i) => (members[assignments[i]] ??= []).push(item));
  // replay numbers uncovered singletons last, so they are the last `uncovered` clusters.
  const firstFallback = fellBack ? 0 : members.length - outcome.uncovered;
  const judgeCalls = outcome.calls;

  await db.transaction(async (tx) => {
    await games.lockForMutation(tx, {
      gameId,
      states: PERMITTED.writeGrouping,
    });
    const [done] = await tx
      .select({ id: groupingResult.questionId })
      .from(groupingResult)
      .where(eq(groupingResult.questionId, q.id));
    if (done) return;
    const groups = members.map((_, c) => ({
      id: randomUUID(),
      questionId: q.id,
      origin: c < firstFallback ? ("judge" as const) : ("fallback" as const),
    }));
    if (groups.length) await tx.insert(answerGroup).values(groups);
    for (const [c, texts] of members.entries())
      await tx
        .update(answer)
        .set({ groupId: groups[c].id })
        .where(
          and(
            eq(answer.questionId, q.id),
            inArray(answer.normalizedText, texts),
          ),
        );
    await tx.insert(groupingResult).values({
      questionId: q.id,
      source: fellBack
        ? "fallback"
        : outcome.source === "live"
          ? "judge"
          : "replay",
      promptVersion: fellBack
        ? judge.info.promptVersion
        : outcome.promptVersion,
      normalizeVersion: NORMALIZE_VERSION,
      modelId: fellBack ? judge.info.model : outcome.model,
      judgeCalls,
      uncoveredItems: fellBack ? 0 : outcome.uncovered,
      fellBack,
      fallbackReason: fellBack ? outcome.reason : null,
    });
    // In the same transaction as the result, so a rerun never counts a Question twice (AD-18).
    await games.bumpCounters(tx, gameId, {
      judgeGroupsProposed: firstFallback,
      judgeCalls,
      questionsFellBack: fellBack ? 1 : 0,
    });
    await games.extendGroupingLease(tx, gameId);
  });
}

// Every Question without a result, at most JUDGE_CONCURRENCY at once.
async function groupPending(gameId: string): Promise<void> {
  const db = await getDb();
  const done = new Set(
    (
      await db
        .select({ id: groupingResult.questionId })
        .from(groupingResult)
        .innerJoin(question, eq(question.id, groupingResult.questionId))
        .where(eq(question.gameId, gameId))
    ).map((r) => r.id),
  );
  const pending = (await questions.ofGame(gameId)).filter(
    (q) => !done.has(q.id),
  );
  if (pending.length === 0) return;
  const judge = getJudge();
  let stopped = false;
  const worker = async () => {
    for (let q = pending.shift(); q && !stopped; q = pending.shift()) {
      try {
        await groupQuestion(judge, gameId, q);
      } catch (error) {
        stopped = true;
        if (!isGone(error)) throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: JUDGE_CONCURRENCY }, worker));
}

// Moves the Game to in review once every Question has a result.
export async function finishIfComplete(gameId: string): Promise<void> {
  const db = await getDb();
  try {
    await db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        gameId,
        states: PERMITTED.writeGrouping,
      });
      const [{ n }] = await tx
        .select({ n: count() })
        .from(groupingResult)
        .innerJoin(question, eq(question.id, groupingResult.questionId))
        .where(eq(question.gameId, gameId));
      if (n === (await questions.count(tx, gameId)))
        await games.transition(tx, gameId, "grouping", "in_review");
    });
  } catch (error) {
    if (!isGone(error)) throw error;
  }
}

// From the close action's after(); runs once, never re-partitioning a grouped Question.
export function run(gameId: string): Promise<void> {
  return withBoundary("grouping", "run", async () => {
    await groupPending(gameId);
    await finishIfComplete(gameId);
  });
}

// From a Host page load past the lease: only the lease winner runs (AD-12).
export function resumeIfStale(gameId: string): Promise<void> {
  return withBoundary("grouping", "resumeIfStale", async () => {
    if (!(await games.acquireGroupingLease(gameId))) return;
    await groupPending(gameId);
    await finishIfComplete(gameId);
  });
}

// No owner check: the caller has already resolved the owned Game.
export function progress(
  gameId: string,
): Promise<{ done: number; total: number }> {
  return withBoundary("grouping", "progress", async () => {
    const db = await getDb();
    const [row] = await db
      .select({ done: count(groupingResult.questionId), total: count() })
      .from(question)
      .leftJoin(groupingResult, eq(groupingResult.questionId, question.id))
      .where(eq(question.gameId, gameId));
    return row;
  });
}

// The in review summary; "groups proposed" counts only the Judge's (origin = judge).
export function summary(
  gameId: string,
): Promise<{ questions: number; groupsProposed: number; fellBack: number }> {
  return withBoundary("grouping", "summary", async () => {
    const db = await getDb();
    const [row] = await db
      .select({
        questions: count(),
        fellBack:
          sql<number>`count(*) filter (where ${groupingResult.fellBack})`.mapWith(
            Number,
          ),
      })
      .from(question)
      .leftJoin(groupingResult, eq(groupingResult.questionId, question.id))
      .where(eq(question.gameId, gameId));
    const [groups] = await db
      .select({ n: count() })
      .from(answerGroup)
      .innerJoin(question, eq(question.id, answerGroup.questionId))
      .where(and(eq(question.gameId, gameId), eq(answerGroup.origin, "judge")));
    return { ...row, groupsProposed: groups.n };
  });
}

// The usage report's per-Question part (AD-18): no text, label, id, key or rank.
// No owner check: the caller has already resolved the owned Game.
export function usage(gameId: string) {
  return withBoundary("grouping", "usage", async () => {
    const db = await getDb();
    const results = await db
      .select({
        id: question.id,
        position: question.position,
        source: groupingResult.source,
        fellBack: groupingResult.fellBack,
      })
      .from(question)
      .innerJoin(groupingResult, eq(groupingResult.questionId, question.id))
      .where(eq(question.gameId, gameId))
      .orderBy(question.position);
    const groups = await db
      .select({
        questionId: answerGroup.questionId,
        origin: answerGroup.origin,
        editCount: answerGroup.editCount,
      })
      .from(answerGroup)
      .innerJoin(question, eq(question.id, answerGroup.questionId))
      .where(eq(question.gameId, gameId))
      .orderBy(answerGroup.id);
    return results.map(({ id, ...q }) => ({
      ...q,
      groups: groups
        .filter((g) => g.questionId === id)
        .map(({ origin, editCount }) => ({ origin, editCount })),
    }));
  });
}

// A Group's Count: distinct Contributor keys, in SQL only (AD-11).
export async function countsOf(
  questionId: string,
): Promise<{ groupId: string; count: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({
      groupId: answer.groupId,
      count: countDistinct(answer.contributorKey),
    })
    .from(answer)
    .where(and(eq(answer.questionId, questionId), isNotNull(answer.groupId)))
    .groupBy(answer.groupId);
  return rows as { groupId: string; count: number }[];
}
