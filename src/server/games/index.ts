import "server-only";
import { and, desc, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { createGameSchema } from "@/lib/game";
import { canTransition, PERMITTED, type GameState } from "@/lib/game-state";
import {
  PURGE_INTERVAL_MS,
  RETENTION_IDLE_MS,
  RETENTION_PLAYED_MS,
} from "@/lib/limits";
import { withBoundary } from "@/server/boundary";
import { getDb, type Tx } from "@/server/db/client";
import { game } from "@/server/db/schema";

export type GameSummary = {
  id: string;
  title: string;
  state: GameState;
  updatedAt: Date;
};

const summary = {
  id: game.id,
  title: game.title,
  state: game.state,
  updatedAt: game.updatedAt,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres would reject a malformed uuid with 22P02 (INTERNAL); it is just a Game that does not exist.
function assertGameId(gameId: string): void {
  if (!UUID.test(gameId)) throw new DomainError("NOT_FOUND");
}

export function create(
  hostId: string,
  input: unknown,
): Promise<{ id: string }> {
  return withBoundary("games", "create", async () => {
    const { title } = validate(createGameSchema, input);
    const now = new Date();
    const db = await getDb();
    const [row] = await db
      .insert(game)
      .values({ hostId, title, createdAt: now, updatedAt: now })
      .returning({ id: game.id });
    return row;
  });
}

export function listOwned(hostId: string): Promise<GameSummary[]> {
  return withBoundary("games", "listOwned", async () => {
    const db = await getDb();
    return db
      .select(summary)
      .from(game)
      .where(eq(game.hostId, hostId))
      .orderBy(desc(game.createdAt));
  });
}

// Missing and foreign Games are the same NOT_FOUND (AD-5).
export function getOwned(hostId: string, gameId: string): Promise<GameSummary> {
  return withBoundary("games", "getOwned", async () => {
    assertGameId(gameId);
    const db = await getDb();
    const [row] = await db
      .select(summary)
      .from(game)
      .where(and(eq(game.id, gameId), eq(game.hostId, hostId)));
    if (!row) throw new DomainError("NOT_FOUND");
    return row;
  });
}

// The only way a Host or Player mutation locks a Game row. create, transition (called
// after this in the same transaction) and the bulk purgeExpired write without it.
// Host calls pass hostId: they are constrained to the owner and count as a Host change
// (updated_at, for the purge).
export async function lockForMutation(
  tx: Tx,
  {
    hostId,
    gameId,
    states,
  }: { hostId?: string; gameId: string; states: readonly GameState[] },
) {
  assertGameId(gameId);
  const [row] = await tx
    .select()
    .from(game)
    .where(
      hostId === undefined
        ? eq(game.id, gameId)
        : and(eq(game.id, gameId), eq(game.hostId, hostId)),
    )
    .for("update");
  if (!row) throw new DomainError("NOT_FOUND");
  if (!states.includes(row.state)) throw new DomainError("WRONG_STATE");
  if (hostId === undefined) return row;
  const updatedAt = new Date();
  await tx.update(game).set({ updatedAt }).where(eq(game.id, gameId));
  return { ...row, updatedAt };
}

// Compare-and-set along the forward chain; a stale `from` is WRONG_STATE too.
export async function transition(
  tx: Tx,
  gameId: string,
  from: GameState,
  to: GameState,
): Promise<void> {
  if (!canTransition(from, to)) throw new DomainError("WRONG_STATE");
  assertGameId(gameId);
  const [row] = await tx
    .update(game)
    .set(to === "played" ? { state: to, playedAt: new Date() } : { state: to })
    .where(and(eq(game.id, gameId), eq(game.state, from)))
    .returning({ id: game.id });
  if (!row) throw new DomainError("WRONG_STATE");
}

// Any state (AD-4). Children cascade from game, so one DELETE removes every row of it.
export function deleteOwned(
  hostId: string,
  gameId: string,
): Promise<{ title: string }> {
  return withBoundary("games", "deleteOwned", async () => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const { title } = await lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.deleteGame,
      });
      await tx.delete(game).where(eq(game.id, gameId));
      return { title };
    });
  });
}

// FR-3 retention: 30 days after played, 90 days after the last Host change otherwise.
// shortcut: one unbatched DELETE with no index on played_at/updated_at, fine at pilot scale; batch it and add an index if Games reach tens of thousands.
export function purgeExpired(): Promise<{ deleted: number }> {
  return withBoundary("games", "purgeExpired", async () => {
    const now = Date.now();
    const db = await getDb();
    const rows = await db
      .delete(game)
      .where(
        or(
          and(
            isNotNull(game.playedAt),
            lte(game.playedAt, new Date(now - RETENTION_PLAYED_MS)),
          ),
          and(
            isNull(game.playedAt),
            lte(game.updatedAt, new Date(now - RETENTION_IDLE_MS)),
          ),
        ),
      )
      .returning({ id: game.id });
    return { deleted: rows.length };
  });
}

const marker = globalThis as typeof globalThis & { __lastPurgeAt?: number };

// At most hourly per process, from Host requests (AD-23). Never rejects.
export async function purgeIfDue(): Promise<void> {
  const now = Date.now();
  if (
    marker.__lastPurgeAt !== undefined &&
    now - marker.__lastPurgeAt < PURGE_INTERVAL_MS
  )
    return;
  marker.__lastPurgeAt = now; // before the await, so concurrent requests do not both run
  try {
    await purgeExpired();
  } catch {
    // already logged by the boundary
  }
}
