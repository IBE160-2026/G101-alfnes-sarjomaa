import { randomUUID } from "node:crypto";
import { eq, sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeCollection,
  createInviteLinks,
  deleteGame,
} from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import GamesPage from "@/app/spill/page";
import { submitAnswerSet } from "@/app/svar/[gameId]/actions";
import { GAME_STATES, type GameState } from "@/lib/game-state";
import { newToken } from "@/lib/token";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import {
  answerGroup,
  boardSlot,
  game,
  question,
  reveal,
} from "@/server/db/schema";
import * as play from "@/server/play";
import * as review from "@/server/review";
import { cookieJar, run, runAfterTasks } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

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

  it("FR-3, FR-25: deleting a playing Game with a Reveal removes its reveal rows", async () => {
    const db = await getDb();
    const id = await insertGame("ready");
    const questionId = randomUUID();
    await db
      .insert(question)
      .values({ id: questionId, gameId: id, position: 1, text: "?" });
    const [{ id: boardSlotId }] = await db
      .insert(boardSlot)
      .values({ questionId, position: 1, label: "Kari", count: 3 })
      .returning({ id: boardSlot.id });
    await play.start(hosts.A, { gameId: id, teams: ["Lag 1", "Lag 2"] });
    await play.reveal(hosts.A, { gameId: id, boardSlotId, scored: true });
    const reveals = () => db.select().from(reveal).where(eq(reveal.gameId, id));
    expect(await reveals()).toHaveLength(1);
    as("A");
    expect(await run(deleteGame, { gameId: id })).toEqual({
      redirect: "/spill",
    });
    expect(await reveals()).toEqual([]);
  });

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
  it("FR-3, AD-4: every foreign key under game, direct or through another table, is ON DELETE CASCADE, except board_slot.group_id (SET NULL), whose row cascades through question_id", async () => {
    const fks = await foreignKeysUnder("game");
    for (const fk of fks)
      expect(fk.confdeltype, `${fk.tbl}.${fk.col}`).toBe(
        fk.tbl === "board_slot" && fk.col === "group_id" ? "n" : "c",
      );
    // The exception still goes with the Game: its row hangs off question too.
    expect(fks).toContainEqual(
      expect.objectContaining({
        tbl: "board_slot",
        col: "question_id",
        confdeltype: "c",
      }),
    );
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

// Every column in a user schema whose value, cast to text, holds `marker`, as schema.table.column.
async function columnsHolding(marker: string): Promise<string[]> {
  const db = await getDb();
  const columns = (
    (await db.execute(sql`
      select table_schema as s, table_name as t, column_name as c
      from information_schema.columns
      where table_schema not in ('pg_catalog', 'information_schema')`)) as unknown as {
      rows: { s: string; t: string; c: string }[];
    }
  ).rows;
  const hits: string[] = [];
  for (const { s, t, c } of columns) {
    const result = await db.execute(
      sql`select count(*)::int as n from ${sql.identifier(s)}.${sql.identifier(t)} where position(${marker} in ${sql.identifier(c)}::text) > 0`,
    );
    if ((result as unknown as { rows: { n: number }[] }).rows[0].n > 0)
      hits.push(`${s}.${t}.${c}`);
  }
  return hits;
}

describe("text scan", () => {
  it("FR-3 (4.4): after a Question, submit, close, Grouping, rename and delete, no column holds the Game's text", async () => {
    const marker = `zq-${randomUUID()}`;
    const id = await insertGame("draft");
    const db = await getDb();
    const questionId = randomUUID();
    await db.insert(question).values({
      id: questionId,
      gameId: id,
      position: 1,
      text: `Spørsmål ${marker}`,
    });
    as("A");
    const created = await createInviteLinks({ gameId: id, count: 3 });
    if (!created.ok) throw new Error(created.code);
    for (const [k, link] of created.data.links.entries()) {
      const result = await submitAnswerSet(id, link.split("#")[1], {
        answers: { [questionId]: [`svar ${k} ${marker}`] },
        editSecret: newToken(),
      });
      if (!result.ok) throw new Error(result.code);
    }
    expect(await closeCollection({ gameId: id })).toEqual({ ok: true });
    await runAfterTasks();
    expect((await gameRow(id)).state).toBe("in_review");
    const [{ groupId }] = await db
      .select({ groupId: answerGroup.id })
      .from(answerGroup)
      .where(eq(answerGroup.questionId, questionId))
      .limit(1);
    await review.rename(hosts.A, { gameId: id, groupId, label: marker });
    // The scan must see the marker before the delete, or an empty result proves nothing.
    expect(await columnsHolding(marker)).toEqual(
      expect.arrayContaining([
        "public.question.text",
        "public.answer.text",
        "public.answer_group.custom_label",
      ]),
    );
    expect(await run(deleteGame, { gameId: id })).toEqual({
      redirect: "/spill",
    });
    expect(await columnsHolding(marker)).toEqual([]);
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
      // A playing Game's page reads play_state, so that one is started for real.
      const id = await insertGame(state === "playing" ? "ready" : state);
      if (state === "playing") {
        await (
          await getDb()
        )
          .insert(question)
          .values({ id: randomUUID(), gameId: id, position: 1, text: "?" });
        await play.start(hosts.A, { gameId: id, teams: ["Lag 1", "Lag 2"] });
      }
      // A played Game's page shows the deletion date from played_at, so set it as finish would.
      if (state === "played")
        await (
          await getDb()
        )
          .update(game)
          .set({ playedAt: new Date() })
          .where(eq(game.id, id));
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
