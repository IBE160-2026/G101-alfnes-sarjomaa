import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { createGameSchema } from "@/lib/game";
import { canTransition, type GameState } from "@/lib/game-state";
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

// The only way a mutation reaches a Game row. Host calls pass hostId: they are
// constrained to the owner and count as a Host change (updated_at, for the purge).
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
    .set({ state: to })
    .where(and(eq(game.id, gameId), eq(game.state, from)))
    .returning({ id: game.id });
  if (!row) throw new DomainError("WRONG_STATE");
}
