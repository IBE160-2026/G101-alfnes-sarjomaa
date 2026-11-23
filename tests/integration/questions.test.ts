import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  moveQuestion,
  removeQuestion,
  saveQuestion,
} from "@/app/spill/[id]/actions";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { game, question } from "@/server/db/schema";
import * as questions from "@/server/questions";
import { cookieJar, RedirectError } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

vi.setConfig({ testTimeout: 30_000 });

const COOKIE = "toppsvar_session";
const OK = { ok: true, data: undefined };
const LENGTH = "Spørsmålet må ha 1–200 tegn.";
const T0 = new Date("2026-11-01T12:00:00Z");
let token: string;
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "sporsmal@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  token = cookieJar.store.get(COOKIE)!;
  hostId = (await auth.requireHost()).hostId;
});
beforeEach(() => cookieJar.store.set(COOKIE, token));

async function newGame() {
  const [{ id }] = await (
    await getDb()
  )
    .insert(game)
    .values({
      hostId,
      title: "Spørsmålsspill",
      createdAt: T0,
      updatedAt: T0,
    })
    .returning({ id: game.id });
  return id;
}

// Position and text in position order, straight from the table.
async function rows(gameId: string) {
  return (await getDb())
    .select({ position: question.position, text: question.text })
    .from(question)
    .where(eq(question.gameId, gameId))
    .orderBy(asc(question.position));
}

async function updatedAt(gameId: string) {
  const [row] = await (
    await getDb()
  )
    .select({ updatedAt: game.updatedAt })
    .from(game)
    .where(eq(game.id, gameId));
  return row.updatedAt;
}

async function expectOrder(gameId: string, texts: string[]) {
  expect(await rows(gameId)).toEqual(
    texts.map((text, i) => ({ position: i + 1, text })),
  );
}

describe("Question editing in draft", () => {
  it("FR-4: add, edit, move and remove keep positions dense 1..n in the expected order", async () => {
    const gameId = await newGame();
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
    for (const [questionId, text] of [
      [a, "Første"],
      [b, "Andre"],
      [c, "  Hva?  "],
    ])
      expect(await saveQuestion({ gameId, questionId, text })).toEqual(OK);
    await expectOrder(gameId, ["Første", "Andre", "Hva?"]);

    expect(await saveQuestion({ gameId, questionId: b, text: "Ny" })).toEqual(
      OK,
    );
    await expectOrder(gameId, ["Første", "Ny", "Hva?"]);

    expect(
      await moveQuestion({ gameId, questionId: c, direction: "up" }),
    ).toEqual(OK);
    await expectOrder(gameId, ["Første", "Hva?", "Ny"]);

    expect(
      await moveQuestion({ gameId, questionId: a, direction: "down" }),
    ).toEqual(OK);
    await expectOrder(gameId, ["Hva?", "Første", "Ny"]);

    // First up and last down are no-ops.
    expect(
      await moveQuestion({ gameId, questionId: c, direction: "up" }),
    ).toEqual(OK);
    expect(
      await moveQuestion({ gameId, questionId: b, direction: "down" }),
    ).toEqual(OK);
    await expectOrder(gameId, ["Hva?", "Første", "Ny"]);

    expect(await removeQuestion({ gameId, questionId: a })).toEqual(OK);
    await expectOrder(gameId, ["Hva?", "Ny"]);

    expect(await questions.list(hostId, gameId)).toEqual([
      { id: c, text: "Hva?" },
      { id: b, text: "Ny" },
    ]);
  });

  it("FR-4: removing position 2 of 4 leaves 1, 2, 3 in order", async () => {
    const gameId = await newGame();
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    for (const [i, questionId] of ids.entries())
      await saveQuestion({ gameId, questionId, text: `S${i + 1}` });
    expect(await removeQuestion({ gameId, questionId: ids[1] })).toEqual(OK);
    await expectOrder(gameId, ["S1", "S3", "S4"]);
  });

  it("FR-4: a retried save with the same id edits instead of adding a duplicate", async () => {
    const gameId = await newGame();
    const questionId = randomUUID();
    await saveQuestion({ gameId, questionId, text: "Hva?" });
    expect(await saveQuestion({ gameId, questionId, text: "Hva?" })).toEqual(
      OK,
    );
    await expectOrder(gameId, ["Hva?"]);
  });

  it("FR-4: the 21st Question is refused with QUESTION_CAP_REACHED and the count stays 20", async () => {
    const gameId = await newGame();
    for (let i = 1; i <= 20; i++)
      expect(
        await saveQuestion({ gameId, questionId: randomUUID(), text: `S${i}` }),
      ).toEqual(OK);
    expect(
      await saveQuestion({ gameId, questionId: randomUUID(), text: "S21" }),
    ).toEqual({
      ok: false,
      code: "QUESTION_CAP_REACHED",
      message: "Du har nådd maks 20 spørsmål.",
    });
    expect(await rows(gameId)).toHaveLength(20);
  });

  it.each([
    ["an empty", ""],
    ["a whitespace-only", "   "],
    ["a 201-character", "a".repeat(201)],
  ])(
    "FR-4: %s text is INVALID_INPUT with the field error and writes nothing",
    async (_, text) => {
      const gameId = await newGame();
      expect(
        await saveQuestion({ gameId, questionId: randomUUID(), text }),
      ).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Sjekk feltene som er merket, og prøv igjen.",
        fieldErrors: { text: LENGTH },
      });
      expect(await rows(gameId)).toEqual([]);
    },
  );

  it("FR-4: a 200-character text is saved", async () => {
    const gameId = await newGame();
    const text = "a".repeat(200);
    expect(
      await saveQuestion({ gameId, questionId: randomUUID(), text }),
    ).toEqual(OK);
    await expectOrder(gameId, [text]);
  });

  it("FR-3, FR-4, AD-23: a successful save (new and existing), move and remove each move game.updated_at forward", async () => {
    const gameId = await newGame();
    const [a, b] = [randomUUID(), randomUUID()];
    for (const action of [
      () => saveQuestion({ gameId, questionId: a, text: "Første" }),
      () => saveQuestion({ gameId, questionId: b, text: "Andre" }),
      () => saveQuestion({ gameId, questionId: a, text: "Endret" }),
      () => moveQuestion({ gameId, questionId: b, direction: "up" }),
      () => removeQuestion({ gameId, questionId: a }),
    ]) {
      await (
        await getDb()
      )
        .update(game)
        .set({ updatedAt: T0 })
        .where(eq(game.id, gameId));
      expect(await action()).toEqual(OK);
      expect((await updatedAt(gameId)).getTime()).toBeGreaterThan(T0.getTime());
    }
  });

  it("FR-4, AD-5: move and remove with a malformed questionId in the Host's own Game are NOT_FOUND and change nothing", async () => {
    const gameId = await newGame();
    await saveQuestion({ gameId, questionId: randomUUID(), text: "A" });
    await saveQuestion({ gameId, questionId: randomUUID(), text: "B" });
    await (
      await getDb()
    )
      .update(game)
      .set({ updatedAt: T0 })
      .where(eq(game.id, gameId));
    const NOT_FOUND = {
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    };
    expect(
      await moveQuestion({ gameId, questionId: "abc", direction: "down" }),
    ).toEqual(NOT_FOUND);
    expect(await removeQuestion({ gameId, questionId: "abc" })).toEqual(
      NOT_FOUND,
    );
    await expectOrder(gameId, ["A", "B"]);
    expect(await updatedAt(gameId)).toEqual(T0);
  });

  it("FR-1, FR-4: logged out every action redirects to /logg-inn and writes nothing", async () => {
    const gameId = await newGame();
    const questionId = randomUUID();
    await saveQuestion({ gameId, questionId, text: "Står" });
    cookieJar.store.clear();
    for (const action of [
      () => saveQuestion({ gameId, questionId: randomUUID(), text: "Ny" }),
      () => moveQuestion({ gameId, questionId, direction: "down" }),
      () => removeQuestion({ gameId, questionId }),
    ]) {
      const error = await action().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RedirectError);
      expect((error as RedirectError).url).toBe("/logg-inn");
    }
    await expectOrder(gameId, ["Står"]);
  });
});
