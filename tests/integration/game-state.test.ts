import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import {
  GAME_STATES,
  PERMITTED,
  type GameState,
  type Operation,
} from "@/lib/game-state";
import { getDb, type Tx } from "@/server/db/client";
import { game, host } from "@/server/db/schema";
import * as games from "@/server/games";

const T0 = new Date("2026-11-01T12:00:00Z");
const LATER = new Date("2026-11-22T09:00:00Z");
let hostId: string;
let gameId: string;

beforeAll(async () => {
  const db = await getDb();
  [{ id: hostId }] = await db
    .insert(host)
    .values({ email: "tilstand@example.test", passwordHash: "x" })
    .returning({ id: host.id });
  [{ id: gameId }] = await db
    .insert(game)
    .values({ hostId, title: "Tilstander", createdAt: T0, updatedAt: T0 })
    .returning({ id: game.id });
});
afterEach(() => vi.useRealTimers());

async function setState(state: GameState) {
  const db = await getDb();
  await db
    .update(game)
    .set({ state, updatedAt: T0 })
    .where(eq(game.id, gameId));
}

async function row() {
  const db = await getDb();
  const [r] = await db.select().from(game).where(eq(game.id, gameId));
  return r;
}

async function inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: unknown) => (e instanceof DomainError ? e.code : e),
  );

describe("games.transition", () => {
  // canTransition's 49 pairs are covered in the unit test; transition checks it first.
  it("AD-4: a chain edge succeeds; a skipped or backward edge is WRONG_STATE and leaves the state", async () => {
    await setState("draft");
    expect(
      await codeOf(
        inTx((tx) => games.transition(tx, gameId, "draft", "collecting")),
      ),
    ).toBe("ok");
    expect((await row()).state).toBe("collecting");
    for (const to of ["in_review", "draft"] as const) {
      expect(
        await codeOf(
          inTx((tx) => games.transition(tx, gameId, "collecting", to)),
        ),
        to,
      ).toBe("WRONG_STATE");
      expect((await row()).state).toBe("collecting");
    }
  });

  it("AD-4: a stale from is WRONG_STATE (compare-and-set)", async () => {
    await setState("collecting");
    expect(
      await codeOf(
        inTx((tx) => games.transition(tx, gameId, "draft", "collecting")),
      ),
    ).toBe("WRONG_STATE");
    expect((await row()).state).toBe("collecting");
  });

  it("AD-4: never touches updated_at", async () => {
    await setState("draft");
    await inTx((tx) => games.transition(tx, gameId, "draft", "collecting"));
    expect((await row()).updatedAt).toEqual(T0);
  });
});

describe("games.lockForMutation", () => {
  it("AD-4: a missing or malformed Game is NOT_FOUND", async () => {
    for (const id of [randomUUID(), "abc"])
      expect(
        await codeOf(
          inTx((tx) =>
            games.lockForMutation(tx, { gameId: id, states: GAME_STATES }),
          ),
        ),
      ).toBe("NOT_FOUND");
  });

  it("AD-4: a state outside `states` is WRONG_STATE and leaves updated_at", async () => {
    await setState("draft");
    expect(
      await codeOf(
        inTx((tx) =>
          games.lockForMutation(tx, {
            hostId,
            gameId,
            states: ["collecting"],
          }),
        ),
      ),
    ).toBe("WRONG_STATE");
    expect((await row()).updatedAt).toEqual(T0);
  });

  it("AD-4, AD-23: sets updated_at to now on a Host call and leaves it without hostId or with touch: false", async () => {
    await setState("draft");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(LATER);
    await inTx((tx) =>
      games.lockForMutation(tx, { gameId, states: ["draft"] }),
    );
    await inTx((tx) =>
      games.lockForMutation(tx, {
        hostId,
        gameId,
        states: ["draft"],
        touch: false,
      }),
    );
    expect((await row()).updatedAt).toEqual(T0);
    const locked = await inTx((tx) =>
      games.lockForMutation(tx, { hostId, gameId, states: ["draft"] }),
    );
    expect(locked.updatedAt).toEqual(LATER);
    expect((await row()).updatedAt).toEqual(LATER);
  });

  it("AD-4: takes SELECT … FOR UPDATE (the row's xmax becomes the locking transaction)", async () => {
    await setState("draft");
    const xmax = async (tx: Tx) => {
      const result = await tx.execute(
        sql`select xmax::text as xmax from game where id = ${gameId}`,
      );
      return (result as unknown as { rows: { xmax: string }[] }).rows[0].xmax;
    };
    await inTx(async (tx) => {
      expect(await xmax(tx)).toBe("0");
      await games.lockForMutation(tx, { gameId, states: ["draft"] });
      expect(await xmax(tx)).not.toBe("0");
    });
  });

  it("AD-4: walks the permitted-operations table: each operation locks exactly in its permitted states", async () => {
    for (const [op, permitted] of Object.entries(PERMITTED) as [
      Operation,
      readonly GameState[],
    ][])
      for (const state of GAME_STATES) {
        await setState(state);
        expect(
          await codeOf(
            inTx((tx) =>
              games.lockForMutation(tx, { hostId, gameId, states: permitted }),
            ),
          ),
          `${op} in ${state}`,
        ).toBe(permitted.includes(state) ? "ok" : "WRONG_STATE");
      }
  });
});
