import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteGame } from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import GamesPage from "@/app/spill/page";
import { GAME_STATES, type GameState } from "@/lib/game-state";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { game } from "@/server/db/schema";
import { cookieJar, run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

vi.setConfig({ testTimeout: 30_000 });

const COOKIE = "toppsvar_session";
const T0 = new Date("2026-11-01T12:00:00Z");
const tokens: Record<"A" | "B", string> = { A: "", B: "" };
const hosts: Record<"A" | "B", string> = { A: "", B: "" };

function as(who: "A" | "B") {
  cookieJar.store.set(COOKIE, tokens[who]);
}

async function insertGame(state: GameState, title = `Spill i ${state}`) {
  const [{ id }] = await (
    await getDb()
  )
    .insert(game)
    .values({ hostId: hosts.A, title, state, createdAt: T0, updatedAt: T0 })
    .returning({ id: game.id });
  return id;
}

async function gameRow(id: string) {
  const [row] = await (
    await getDb()
  )
    .select()
    .from(game)
    .where(eq(game.id, id));
  return row;
}

type ForeignKey = { tbl: string; col: string; confdeltype: string };

// Every foreign key pointing at `referenced`, read from the catalog, so tables
// added by later stories are covered without touching this test.
async function foreignKeysTo(referenced: string): Promise<ForeignKey[]> {
  const result = await (
    await getDb()
  ).execute(sql`
    select c.conrelid::regclass::text as tbl, a.attname as col, c.confdeltype::text as confdeltype
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = ${referenced}::regclass`);
  return (result as unknown as { rows: ForeignKey[] }).rows;
}

beforeAll(async () => {
  for (const who of ["A", "B"] as const) {
    cookieJar.store.clear();
    await auth.register({
      email: `slett-${who}@example.test`,
      password: "riktig-passord-123",
      registrationCode: "",
    });
    tokens[who] = cookieJar.store.get(COOKIE)!;
    hosts[who] = (await auth.requireHost()).hostId;
  }
});
beforeEach(() => cookieJar.store.clear());

describe("deleteGame", () => {
  it.each(GAME_STATES)(
    "FR-3: deletes A's Game in %s, redirects to /spill with the title in the notice cookie, and no row references it",
    async (state) => {
      const title = `Hytte & «${state}»`;
      const id = await insertGame(state, title);
      as("A");
      expect(await run(deleteGame, { gameId: id })).toEqual({
        redirect: "/spill",
      });
      expect(cookieJar.set).toHaveBeenLastCalledWith(
        "toppsvar_slettet",
        title,
        {
          httpOnly: true,
          sameSite: "lax",
          path: "/spill",
          maxAge: 60,
          secure: false,
        },
      );
      expect(await gameRow(id)).toBeUndefined();
      const db = await getDb();
      for (const { tbl, col } of await foreignKeysTo("game")) {
        const result = await db.execute(
          sql`select count(*)::int as n from ${sql.identifier(tbl)} where ${sql.identifier(col)} = ${id}`,
        );
        expect(
          (result as unknown as { rows: { n: number }[] }).rows[0].n,
          tbl,
        ).toBe(0);
      }
    },
  );

  it("FR-1, AD-5: B deleting A's Game, a random UUID and a malformed ID gets one identical NOT_FOUND, and A's Game is untouched", async () => {
    const gameOfA = await insertGame("draft", "As spill");
    as("B");
    for (const gameId of [gameOfA, randomUUID(), "abc"])
      expect(await run(deleteGame, { gameId }), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    expect((await gameRow(gameOfA)).updatedAt).toEqual(T0);
  });

  it("FR-1, AD-5: logged out it redirects to /logg-inn and deletes nothing", async () => {
    const id = await insertGame("draft", "Uten konto");
    expect(await run(deleteGame, { gameId: id })).toEqual({
      redirect: "/logg-inn",
    });
    expect(await gameRow(id)).toBeDefined();
  });
});

describe("cascade", () => {
  it("FR-3, AD-4: every foreign key to game is ON DELETE CASCADE", async () => {
    for (const fk of await foreignKeysTo("game"))
      expect(fk.confdeltype, `${fk.tbl}.${fk.col}`).toBe("c");
  });

  it("FR-3: the same catalog query finds session and game referencing host, both cascading", async () => {
    const fks = await foreignKeysTo("host");
    expect(fks.map((fk) => fk.tbl).sort()).toEqual(["game", "session"]);
    for (const fk of fks) expect(fk.confdeltype, fk.tbl).toBe("c");
  });
});

describe("Games page", () => {
  it("FR-3: shows the deleted notice from the cookie only", async () => {
    as("A");
    const render = async () => renderToStaticMarkup(await GamesPage());
    expect(await render()).not.toContain("er slettet.");
    cookieJar.store.set("toppsvar_slettet", "Hytte & venner");
    expect(await render()).toContain("«Hytte &amp; venner» er slettet.");
  });
});

describe("Game page", () => {
  it.each(GAME_STATES)(
    'FR-3, UX-DR8: in %s it renders the "Slett spillet" button',
    async (state) => {
      const id = await insertGame(state);
      as("A");
      const html = renderToStaticMarkup(
        await GamePage({
          params: Promise.resolve({ id }),
          searchParams: Promise.resolve({}),
        }),
      );
      expect(html).toMatch(/<button[^>]*>.*Slett spillet.*<\/button>/s);
    },
  );
});
