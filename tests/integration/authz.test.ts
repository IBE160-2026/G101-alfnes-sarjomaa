import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteGame,
  moveQuestion,
  removeQuestion,
  saveQuestion,
} from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import { createGame } from "@/app/spill/actions";
import GamesPage from "@/app/spill/page";
import { DomainError } from "@/lib/errors";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { game, question } from "@/server/db/schema";
import * as games from "@/server/games";
import { cookieJar, NotFoundError, run } from "./next-mocks";

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
let gameOfA: string;

function as(who: "A" | "B") {
  cookieJar.store.set(COOKIE, tokens[who]);
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

async function gameCount() {
  return (await (await getDb()).select().from(game)).length;
}

const rejection = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  );

beforeAll(async () => {
  for (const who of ["A", "B"] as const) {
    cookieJar.store.clear();
    await auth.register({
      email: `vert-${who}@example.test`,
      password: "riktig-passord-123",
      registrationCode: "",
    });
    tokens[who] = cookieJar.store.get(COOKIE)!;
    hosts[who] = (await auth.requireHost()).hostId;
  }
  [{ id: gameOfA }] = await (
    await getDb()
  )
    .insert(game)
    .values({
      hostId: hosts.A,
      title: "As spill",
      createdAt: T0,
      updatedAt: T0,
    })
    .returning({ id: game.id });
});
beforeEach(() => cookieJar.store.clear());

describe("createGame", () => {
  it("FR-2: creates a trimmed draft with updated_at = created_at and redirects to its Game page", async () => {
    as("A");
    const result = (await run(createGame, { title: "  Hyttetur 2026 " })) as {
      redirect: string;
    };
    expect(result.redirect).toMatch(/^\/spill\/[0-9a-f-]{36}$/);
    const row = await gameRow(result.redirect.slice("/spill/".length));
    expect(row).toMatchObject({
      hostId: hosts.A,
      title: "Hyttetur 2026",
      state: "draft",
    });
    expect(row.updatedAt).toEqual(row.createdAt);
  });

  it.each([
    ["an empty", ""],
    ["an 81-character", "a".repeat(81)],
  ])(
    "FR-2: %s title returns the field error and creates no Game",
    async (_, title) => {
      as("A");
      const before = await gameCount();
      expect(await run(createGame, { title })).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Sjekk feltene som er merket, og prøv igjen.",
        fieldErrors: { title: "Navnet må ha 1–80 tegn." },
      });
      expect(await gameCount()).toBe(before);
    },
  );

  it("FR-1, AD-5: logged out it redirects to /logg-inn and creates no Game", async () => {
    const before = await gameCount();
    expect(await run(createGame, { title: "Uten konto" })).toEqual({
      redirect: "/logg-inn",
    });
    expect(await gameCount()).toBe(before);
  });
});

describe("Host B against Host A's Game", () => {
  const ids = () => [gameOfA, randomUUID(), "abc"];

  it("FR-1, AD-5: getOwned rejects A's Game, a random UUID and a malformed ID with the same NOT_FOUND", async () => {
    for (const id of ids()) {
      const error = await rejection(games.getOwned(hosts.B, id));
      expect(error, id).toBeInstanceOf(DomainError);
      expect((error as DomainError).code, id).toBe("NOT_FOUND");
      expect((error as DomainError).fieldErrors, id).toBeUndefined();
    }
  });

  it("FR-1, AD-5: lockForMutation({ hostId: B }) rejects all three with NOT_FOUND and leaves A's updated_at", async () => {
    const db = await getDb();
    for (const id of ids()) {
      const error = await rejection(
        db.transaction((tx) =>
          games.lockForMutation(tx, {
            hostId: hosts.B,
            gameId: id,
            states: ["draft"],
          }),
        ),
      );
      expect((error as DomainError).code, id).toBe("NOT_FOUND");
    }
    expect((await gameRow(gameOfA)).updatedAt).toEqual(T0);
  });

  it("FR-1, AD-5: the Game page calls notFound() for A's Game exactly as for a random UUID and a malformed ID", async () => {
    as("B");
    for (const id of ids())
      expect(
        await rejection(
          GamePage({
            params: Promise.resolve({ id }),
            searchParams: Promise.resolve({}),
          }),
        ),
        id,
      ).toBeInstanceOf(NotFoundError);
  });

  it("FR-1, AD-5: deleteGame from B gives one identical NOT_FOUND for all three and leaves A's Game", async () => {
    as("B");
    for (const gameId of ids())
      expect(await run(deleteGame, { gameId }), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    expect((await gameRow(gameOfA)).updatedAt).toEqual(T0);
  });

  it("FR-2: listOwned(B) excludes A's Game, and listOwned(A) is newest first by created_at, not updated_at", async () => {
    expect((await games.listOwned(hosts.B)).map((g) => g.id)).not.toContain(
      gameOfA,
    );
    const db = await getDb();
    await db.insert(game).values({
      hostId: hosts.A,
      title: "Nyest",
      createdAt: new Date("2030-01-01T00:00:00Z"),
      updatedAt: new Date("2030-01-01T00:00:00Z"),
    });
    // Oldest created but most recently changed: must still sort last.
    await db.insert(game).values({
      hostId: hosts.A,
      title: "Eldst, sist endret",
      createdAt: new Date("2020-01-01T00:00:00Z"),
      updatedAt: new Date("2031-01-01T00:00:00Z"),
    });
    const listA = await games.listOwned(hosts.A);
    expect(listA[0].title).toBe("Nyest");
    expect(listA.at(-1)!.title).toBe("Eldst, sist endret");
    expect(listA.at(-2)!.id).toBe(gameOfA);
    expect(Object.keys(listA[0]).sort()).toEqual([
      "id",
      "state",
      "title",
      "updatedAt",
    ]);
  });
});

describe("Questions across Hosts", () => {
  const NOT_FOUND = {
    ok: false,
    code: "NOT_FOUND",
    message: "Vi finner ikke dette spillet.",
  };
  const questionOfA = randomUUID();
  const questionOfB = randomUUID();
  let gameOfB: string;

  const questionsOf = async (gameId: string) =>
    (await getDb())
      .select()
      .from(question)
      .where(eq(question.gameId, gameId))
      .orderBy(asc(question.position));

  beforeAll(async () => {
    const db = await getDb();
    [{ id: gameOfB }] = await db
      .insert(game)
      .values({ hostId: hosts.B, title: "Bs spill" })
      .returning({ id: game.id });
    // Inserted directly, so A's updated_at stays T0.
    await db.insert(question).values([
      { id: questionOfA, gameId: gameOfA, position: 1, text: "As spørsmål" },
      { id: randomUUID(), gameId: gameOfA, position: 2, text: "As andre" },
      { id: questionOfB, gameId: gameOfB, position: 1, text: "Bs spørsmål" },
    ]);
  });

  it("FR-4, AD-5: B's save, move and remove on A's Game, a random UUID and a malformed ID give one identical NOT_FOUND and leave A's Questions and updated_at", async () => {
    as("B");
    const before = await questionsOf(gameOfA);
    for (const gameId of [gameOfA, randomUUID(), "abc"]) {
      for (const result of [
        await saveQuestion({ gameId, questionId: randomUUID(), text: "B" }),
        await saveQuestion({ gameId, questionId: questionOfA, text: "B" }),
        await moveQuestion({
          gameId,
          questionId: questionOfA,
          direction: "down",
        }),
        await removeQuestion({ gameId, questionId: questionOfA }),
      ])
        expect(result, gameId).toEqual(NOT_FOUND);
    }
    expect(await questionsOf(gameOfA)).toEqual(before);
    expect((await gameRow(gameOfA)).updatedAt).toEqual(T0);
  });

  it("FR-4, AD-5: A saving, moving or removing B's questionId inside A's own Game is NOT_FOUND and changes neither Game", async () => {
    as("A");
    const beforeA = await questionsOf(gameOfA);
    const beforeB = await questionsOf(gameOfB);
    for (const result of [
      await saveQuestion({
        gameId: gameOfA,
        questionId: questionOfB,
        text: "A",
      }),
      await moveQuestion({
        gameId: gameOfA,
        questionId: questionOfB,
        direction: "up",
      }),
      await removeQuestion({ gameId: gameOfA, questionId: questionOfB }),
    ])
      expect(result).toEqual(NOT_FOUND);
    expect(await questionsOf(gameOfA)).toEqual(beforeA);
    expect(await questionsOf(gameOfB)).toEqual(beforeB);
    expect((await gameRow(gameOfA)).updatedAt).toEqual(T0);
  });
});

// Last in the file: it drops the game table.
describe("with the game table dropped", () => {
  beforeAll(async () => {
    await (await getDb()).execute(sql`drop table game cascade`);
  });

  it("FR-2, UX-DR23: /spill keeps the create form and shows the danger notice; the boundary logs one listOwned line", async () => {
    as("A");
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const html = renderToStaticMarkup(await GamesPage());
    const out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    write.mockRestore();
    expect(html).toContain(
      "Fikk ikke hentet spillene dine. Last inn siden på nytt.",
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Navn på spillet");
    expect(html).toContain("Lag spill");
    expect(JSON.parse(out.trim())).toEqual({
      module: "games",
      op: "listOwned",
      code: "INTERNAL",
      sqlstate: "42P01",
    });
  });

  it("FR-1, UX-DR23: the Game page turns a DB failure into INTERNAL (the 500 page), not the not-found page", async () => {
    as("A");
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const error = await rejection(
      GamePage({
        params: Promise.resolve({ id: gameOfA }),
        searchParams: Promise.resolve({}),
      }),
    );
    write.mockRestore();
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("INTERNAL");
  });
});
