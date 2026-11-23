import { eq, sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
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

type ForeignKey = {
  tbl: string;
  col: string;
  ref: string;
  confdeltype: string;
};

// Every foreign key under `root`: those pointing at it and, recursively, at the tables
// that do. Read from the catalog, so tables added by later stories are covered
// without touching this test. UNION drops repeats, so a cycle still ends.
async function foreignKeysUnder(root: string): Promise<ForeignKey[]> {
  const edge = sql`
    select c.conrelid as relid, c.conrelid::regclass::text as tbl, a.attname::text as col,
      c.confrelid::regclass::text as ref, c.confdeltype::text as confdeltype
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]`;
  const result = await (
    await getDb()
  ).execute(sql`
    with recursive fk as (
      ${edge} where c.contype = 'f' and c.confrelid = ${root}::regclass
      union
      ${edge} join fk on c.confrelid = fk.relid where c.contype = 'f'
    )
    select tbl, col, ref, confdeltype from fk`);
  return (result as unknown as { rows: ForeignKey[] }).rows;
}

const direct = async (root: string) =>
  (await foreignKeysUnder(root)).filter((fk) => fk.ref === root);

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
      for (const { tbl, col } of await direct("game")) {
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

  it("FR-1, AD-5: logged out it redirects to /logg-inn and deletes nothing", async () => {
    const id = await insertGame("draft", "Uten konto");
    expect(await run(deleteGame, { gameId: id })).toEqual({
      redirect: "/logg-inn",
    });
    expect(await gameRow(id)).toBeDefined();
  });
});

describe("VACUUM after delete", () => {
  const dialect = new PgDialect();

  // Deletes A's Game in `state` with db.execute spied, and returns the SQL it ran and the log.
  async function deleteWatched(state: GameState, fail = false) {
    const id = await insertGame(state);
    as("A");
    const db = await getDb();
    const execute = vi.spyOn(db, "execute");
    if (fail)
      execute.mockRejectedValueOnce(
        Object.assign(new Error("låst"), { code: "55P03" }),
      );
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let result, statements, out;
    try {
      result = await run(deleteGame, { gameId: id });
    } finally {
      statements = execute.mock.calls.map(
        ([query]) => dialect.sqlToQuery((query as SQL).getSQL()).sql,
      );
      out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
      execute.mockRestore();
      write.mockRestore();
    }
    return { id, result, statements, out };
  }

  it("FR-3, FR-13, AD-9: deleting a collecting Game runs VACUUM (FULL, SKIP_LOCKED) on submission and invite_link after commit", async () => {
    const { id, result, statements, out } = await deleteWatched("collecting");
    expect(result).toEqual({ redirect: "/spill" });
    expect(statements).toEqual([
      "VACUUM (FULL, SKIP_LOCKED) submission, invite_link",
    ]);
    expect(out).toBe("");
    expect(await gameRow(id)).toBeUndefined();
  });

  it("FR-3, AD-9: a failing VACUUM still deletes, and logs only module, op, code and sqlstate", async () => {
    const { id, result, out } = await deleteWatched("collecting", true);
    expect(result).toEqual({ redirect: "/spill" });
    expect(await gameRow(id)).toBeUndefined();
    const lines = out.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      module: "games",
      op: "vacuum",
      code: "INTERNAL",
      sqlstate: "55P03",
    });
  });

  it("FR-3, AD-9: deleting a draft Game skips the VACUUM", async () => {
    const { id, statements } = await deleteWatched("draft");
    expect(statements).toEqual([]);
    expect(await gameRow(id)).toBeUndefined();
  });
});

describe("cascade", () => {
  it("FR-3, AD-4: every foreign key under game, direct or through another table, is ON DELETE CASCADE", async () => {
    for (const fk of await foreignKeysUnder("game"))
      expect(fk.confdeltype, `${fk.tbl}.${fk.col}`).toBe("c");
  });

  it("FR-3: the same catalog query finds session and game referencing host, both cascading", async () => {
    const fks = await direct("host");
    expect(fks.map((fk) => fk.tbl).sort()).toEqual(["game", "session"]);
    for (const fk of fks) expect(fk.confdeltype, fk.tbl).toBe("c");
  });

  it("FR-3: the query reaches a table that references game only through another table", async () => {
    const db = await getDb();
    await db.execute(
      sql`create table fk_child (id uuid primary key, game_id uuid references game on delete cascade)`,
    );
    await db.execute(
      sql`create table fk_grandchild (child_id uuid references fk_child)`,
    );
    try {
      expect(await foreignKeysUnder("game")).toContainEqual({
        tbl: "fk_grandchild",
        col: "child_id",
        ref: "fk_child",
        confdeltype: "a",
      });
    } finally {
      await db.execute(sql`drop table fk_grandchild, fk_child`);
    }
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
