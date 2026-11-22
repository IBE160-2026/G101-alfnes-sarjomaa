import "server-only";
import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { DomainError, validate } from "@/lib/errors";
import { createGameSchema } from "@/lib/game";
import { canTransition, PERMITTED, type GameState } from "@/lib/game-state";
import {
  GROUPING_LEASE_MS,
  INVITE_LINKS_MAX,
  PURGE_INTERVAL_MS,
  RETENTION_IDLE_MS,
  RETENTION_PLAYED_MS,
} from "@/lib/limits";
import * as auth from "@/server/auth";
import { withBoundary } from "@/server/boundary";
import { getDb, type Tx } from "@/server/db/client";
import { game } from "@/server/db/schema";
import { vacuumCollectionTables } from "@/server/db/vacuum";

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
export function getOwned(
  hostId: string,
  gameId: string,
): Promise<GameSummary & { inviteLinksIssued: number; leaseExpired: boolean }> {
  return withBoundary("games", "getOwned", async () => {
    assertGameId(gameId);
    const db = await getDb();
    const [row] = await db
      .select({
        ...summary,
        inviteLinksIssued: game.inviteLinksIssued,
        // DB time, as the Grouping runner compares the lease (AD-9).
        leaseExpired: sql<boolean>`coalesce(${game.groupingLeaseUntil} < now(), false)`,
      })
      .from(game)
      .where(and(eq(game.id, gameId), eq(game.hostId, hostId)));
    if (!row) throw new DomainError("NOT_FOUND");
    return row;
  });
}

// Only for the Participant's link page: no owner check. Missing or malformed is null.
export function find(
  gameId: string,
): Promise<{ title: string; state: GameState } | null> {
  return withBoundary("games", "find", async () => {
    if (!UUID.test(gameId)) return null;
    const db = await getDb();
    const [row] = await db
      .select({ title: game.title, state: game.state })
      .from(game)
      .where(eq(game.id, gameId));
    return row ?? null;
  });
}

// The only way a Host or Player mutation locks a Game row. create, transition (called
// after this in the same transaction) and the bulk purgeExpired write without it.
// Host calls pass hostId: they are constrained to the owner and count as a Host change
// (updated_at, for the purge); touch: false skips that write when the row is about to go.
export async function lockForMutation(
  tx: Tx,
  {
    hostId,
    gameId,
    states,
    touch = true,
  }: {
    hostId?: string;
    gameId: string;
    states: readonly GameState[];
    touch?: boolean;
  },
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
  if (hostId === undefined || !touch) return row;
  const updatedAt = new Date();
  await tx.update(game).set({ updatedAt }).where(eq(game.id, gameId));
  return { ...row, updatedAt };
}

// DB time, since the Grouping runner compares it with now() (AD-9).
const leaseUntil = () =>
  sql`now() + ${GROUPING_LEASE_MS} * interval '1 millisecond'`;

// Compare-and-set on an expired lease of a grouping Game: true only for the one winner (AD-12).
export async function acquireGroupingLease(gameId: string): Promise<boolean> {
  assertGameId(gameId);
  const db = await getDb();
  const rows = await db
    .update(game)
    .set({ groupingLeaseUntil: leaseUntil() })
    .where(
      and(
        eq(game.id, gameId),
        eq(game.state, "grouping"),
        lt(game.groupingLeaseUntil, sql`now()`),
      ),
    )
    .returning({ id: game.id });
  return rows.length > 0;
}

// After each Question, under the caller's lock (AD-12).
export async function extendGroupingLease(tx: Tx, gameId: string) {
  await tx
    .update(game)
    .set({ groupingLeaseUntil: leaseUntil() })
    .where(eq(game.id, gameId));
}

// Compare-and-set along the forward chain; a stale `from` is WRONG_STATE too.
// Entering grouping also starts the Grouping lease (AD-9).
export async function transition(
  tx: Tx,
  gameId: string,
  from: GameState,
  to: GameState,
): Promise<void> {
  if (!canTransition(from, to)) throw new DomainError("WRONG_STATE");
  assertGameId(gameId);
  let extra: PgUpdateSetSource<typeof game> = {};
  if (to === "played") extra = { playedAt: new Date() };
  if (to === "grouping") extra = { groupingLeaseUntil: leaseUntil() };
  const [row] = await tx
    .update(game)
    .set({ state: to, ...extra })
    .where(and(eq(game.id, gameId), eq(game.state, from)))
    .returning({ id: game.id });
  if (!row) throw new DomainError("WRONG_STATE");
}

// The one cap check (AD-8): every link creation reserves here, under the caller's lock.
// Returns the new issued count; revoked links stay counted, since nothing decrements it.
export async function reserveInviteLinks(
  tx: Tx,
  gameId: string,
  count: number,
): Promise<number> {
  const [row] = await tx
    .update(game)
    .set({ inviteLinksIssued: sql`${game.inviteLinksIssued} + ${count}` })
    .where(
      and(
        eq(game.id, gameId),
        sql`${game.inviteLinksIssued} + ${count} <= ${INVITE_LINKS_MAX}`,
      ),
    )
    .returning({ issued: game.inviteLinksIssued });
  if (!row) throw new DomainError("LINK_CAP_REACHED");
  return row.issued;
}

// Any state (AD-4). Children cascade from game, so one DELETE removes every row of it.
// A collecting Game had links and Answer sets, so their dead rows are vacuumed (AD-9).
export function deleteOwned(
  hostId: string,
  gameId: string,
): Promise<{ title: string }> {
  return withBoundary("games", "deleteOwned", async () => {
    const db = await getDb();
    const { title, state } = await db.transaction(async (tx) => {
      const row = await lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.deleteGame,
        touch: false,
      });
      await tx.delete(game).where(eq(game.id, gameId));
      return row;
    });
    if (state === "collecting") await vacuumCollectionTables("games");
    return { title };
  });
}

// FR-3 retention: 30 days after played, 90 days after the last Host change otherwise.
// Long-expired sessions go in the same run.
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
    // Every run, not only after a collecting Game: it retries a close-time VACUUM that
    // SKIP_LOCKED skipped (AD-9).
    await vacuumCollectionTables("games");
    await auth.purgeExpiredSessions();
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
