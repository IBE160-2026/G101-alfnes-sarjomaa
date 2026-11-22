import "server-only";
import { and, asc, count as countRows, eq, sql } from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { QUESTIONS_MAX } from "@/lib/limits";
import {
  moveQuestionSchema,
  removeQuestionSchema,
  saveQuestionSchema,
} from "@/lib/question";
import { withBoundary } from "@/server/boundary";
import { getDb, type Tx } from "@/server/db/client";
import { question } from "@/server/db/schema";
import * as games from "@/server/games";

export type Question = { id: string; text: string };

function lock(tx: Tx, hostId: string, gameId: string) {
  return games.lockForMutation(tx, {
    hostId,
    gameId,
    states: PERMITTED.editQuestions,
  });
}

// Ids in position order. Callers find a questionId in this list, so a malformed or
// foreign id is NOT_FOUND and no query ever resolves one without the owned gameId.
async function orderedIds(tx: Tx, gameId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: question.id })
    .from(question)
    .where(eq(question.gameId, gameId))
    .orderBy(asc(question.position));
  return rows.map((r) => r.id);
}

// The unique (game_id, position) index is checked row by row, so negate first, then 1..n.
async function writeOrder(tx: Tx, gameId: string, ids: string[]) {
  await tx
    .update(question)
    .set({ position: sql`-${question.position}` })
    .where(eq(question.gameId, gameId));
  for (const [i, id] of ids.entries())
    await tx
      .update(question)
      .set({ position: i + 1 })
      .where(and(eq(question.id, id), eq(question.gameId, gameId)));
}

// For collection: the caller already holds the Game's lock.
export async function count(tx: Tx, gameId: string): Promise<number> {
  const [row] = await tx
    .select({ n: countRows() })
    .from(question)
    .where(eq(question.gameId, gameId));
  return row.n;
}

export function list(hostId: string, gameId: string): Promise<Question[]> {
  return withBoundary("questions", "list", async () => {
    await games.getOwned(hostId, gameId);
    const db = await getDb();
    return db
      .select({ id: question.id, text: question.text })
      .from(question)
      .where(eq(question.gameId, gameId))
      .orderBy(asc(question.position));
  });
}

// Upsert keyed by the client-generated id, so a retried save edits instead of duplicating.
export function save(hostId: string, input: unknown): Promise<void> {
  return withBoundary("questions", "save", async () => {
    const { gameId, questionId, text } = validate(saveQuestionSchema, input);
    const db = await getDb();
    await db.transaction(async (tx) => {
      await lock(tx, hostId, gameId);
      const ids = await orderedIds(tx, gameId);
      if (ids.includes(questionId)) {
        await tx
          .update(question)
          .set({ text })
          .where(and(eq(question.id, questionId), eq(question.gameId, gameId)));
        return;
      }
      if (ids.length >= QUESTIONS_MAX)
        throw new DomainError("QUESTION_CAP_REACHED");
      const inserted = await tx
        .insert(question)
        .values({ id: questionId, gameId, position: ids.length + 1, text })
        .onConflictDoNothing({ target: question.id })
        .returning({ id: question.id });
      // The id is already a Question of another Game (AD-5).
      if (inserted.length === 0) throw new DomainError("NOT_FOUND");
    });
  });
}

export function move(hostId: string, input: unknown): Promise<void> {
  return withBoundary("questions", "move", async () => {
    const { gameId, questionId, direction } = validate(
      moveQuestionSchema,
      input,
    );
    const db = await getDb();
    await db.transaction(async (tx) => {
      await lock(tx, hostId, gameId);
      const ids = await orderedIds(tx, gameId);
      const i = ids.indexOf(questionId);
      if (i === -1) throw new DomainError("NOT_FOUND");
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await writeOrder(tx, gameId, ids);
    });
  });
}

export function remove(hostId: string, input: unknown): Promise<void> {
  return withBoundary("questions", "remove", async () => {
    const { gameId, questionId } = validate(removeQuestionSchema, input);
    const db = await getDb();
    await db.transaction(async (tx) => {
      await lock(tx, hostId, gameId);
      const ids = await orderedIds(tx, gameId);
      if (!ids.includes(questionId)) throw new DomainError("NOT_FOUND");
      await tx
        .delete(question)
        .where(and(eq(question.id, questionId), eq(question.gameId, gameId)));
      await writeOrder(
        tx,
        gameId,
        ids.filter((id) => id !== questionId),
      );
    });
  });
}
