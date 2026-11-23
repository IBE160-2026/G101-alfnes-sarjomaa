import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { prerenderToNodeStream } from "react-dom/static";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeCollection,
  confirmBoard,
  createInviteLinks,
  markReviewed,
  mergeGroups,
  revealSlot,
  saveQuestion,
  startPlay,
} from "@/app/spill/[id]/actions";
import ScreenPage from "@/app/spill/[id]/skjerm/page";
import { createGame } from "@/app/spill/actions";
import { DomainError } from "@/lib/errors";
import { QUESTION_SET_CREDIT, QUESTION_SETS } from "@/lib/question-sets";
import { boardCut, rankGroups } from "@/lib/ranking";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { boardSlot, game, question } from "@/server/db/schema";
import * as games from "@/server/games";
import * as play from "@/server/play";
import * as review from "@/server/review";
import { cookieJar, run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

const COOKIE = "toppsvar_session";
const tokens: Record<"A" | "B", string> = { A: "", B: "" };
const hosts: Record<"A" | "B", string> = { A: "", B: "" };
const home = QUESTION_SETS.find((s) => s.id === "hjemme")!;

const as = (who: "A" | "B") => cookieJar.store.set(COOKIE, tokens[who]);
const gameCount = async () =>
  (await (await getDb()).select().from(game)).length;

beforeAll(async () => {
  for (const who of ["A", "B"] as const) {
    cookieJar.store.clear();
    await auth.register({
      email: `sett-${who}@example.test`,
      password: "riktig-passord-123",
      registrationCode: "",
    });
    tokens[who] = cookieJar.store.get(COOKIE)!;
    hosts[who] = (await auth.requireHost()).hostId;
  }
});
beforeEach(() => cookieJar.store.clear());

async function createFromSet(): Promise<string> {
  as("A");
  const result = (await run(createGame, {
    title: "Fredag",
    questionSet: "hjemme",
  })) as { redirect: string };
  expect(result.redirect).toMatch(/^\/spill\/[0-9a-f-]{36}$/);
  return result.redirect.slice("/spill/".length);
}

describe("createGame with a Question set", () => {
  it("FR-33 (AC1): creates the Game in ready with the set id, its five Questions at positions 1..5, and redirects to it", async () => {
    const id = await createFromSet();
    const [row] = await (
      await getDb()
    )
      .select()
      .from(game)
      .where(eq(game.id, id));
    expect(row).toMatchObject({
      hostId: hosts.A,
      title: "Fredag",
      state: "ready",
      questionSet: "hjemme",
    });
    expect(row.updatedAt).toEqual(row.createdAt);
    const qs = await (
      await getDb()
    )
      .select({ position: question.position, text: question.text })
      .from(question)
      .where(eq(question.gameId, id))
      .orderBy(asc(question.position));
    expect(qs).toEqual(
      home.questions.map((q, i) => ({ position: i + 1, text: q.text })),
    );
  });

  it("FR-33 (AC2), AD-15: review.getBoard returns each Question's slots as the data's Groups in rankGroups order, with Counts unchanged and no group_id", async () => {
    const id = await createFromSet();
    const db = await getDb();
    const slots = await review.getBoard(db, id);
    const expected = home.questions.flatMap((q) =>
      boardCut(
        rankGroups(
          q.groups.map((g) => ({
            groupId: g.cluster,
            count: g.count,
            rank1Count: 0,
            labelCandidates: [],
            customLabel: g.label,
            discarded: false,
          })),
        ),
      ).board.map((g, i) => ({
        text: q.text,
        position: i + 1,
        label: g.label,
        count: g.count,
      })),
    );
    const texts = new Map(
      (
        await db
          .select({ id: question.id, text: question.text })
          .from(question)
          .where(eq(question.gameId, id))
      ).map((q) => [q.id, q.text]),
    );
    expect(
      slots.map((s) => ({
        text: texts.get(s.questionId),
        position: s.position,
        label: s.label,
        count: s.count,
      })),
    ).toEqual(expected);
    const rows = await db
      .select({ groupId: boardSlot.groupId })
      .from(boardSlot)
      .where(inArray(boardSlot.questionId, [...texts.keys()]));
    expect(rows).toHaveLength(slots.length);
    expect(rows.every((r) => r.groupId === null)).toBe(true);
  });

  it("FR-2: the default select value (empty) still makes a draft with no set", async () => {
    as("A");
    const result = (await run(createGame, {
      title: "Egne",
      questionSet: "",
    })) as { redirect: string };
    const [row] = await (
      await getDb()
    )
      .select()
      .from(game)
      .where(eq(game.id, result.redirect.slice("/spill/".length)));
    expect(row).toMatchObject({ state: "draft", questionSet: null });
  });

  it("FR-33: an unknown set id returns its field error and creates no Game", async () => {
    as("A");
    const before = await gameCount();
    expect(
      await run(createGame, { title: "Fredag", questionSet: "finnes-ikke" }),
    ).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Sjekk feltene som er merket, og prøv igjen.",
      fieldErrors: { questionSet: "Velg et sett fra lista." },
    });
    expect(await gameCount()).toBe(before);
  });

  it("FR-33, FR-2: an empty title with a set returns the title error and creates no Game", async () => {
    as("A");
    const before = await gameCount();
    expect(
      await run(createGame, { title: " ", questionSet: "hjemme" }),
    ).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Sjekk feltene som er merket, og prøv igjen.",
      fieldErrors: { title: "Navnet må ha 1–80 tegn." },
    });
    expect(await gameCount()).toBe(before);
  });

  it("FR-1, AD-5: logged out it redirects to /logg-inn and creates no Game", async () => {
    const before = await gameCount();
    expect(
      await run(createGame, { title: "Fredag", questionSet: "hjemme" }),
    ).toEqual({ redirect: "/logg-inn" });
    expect(await gameCount()).toBe(before);
  });
});

describe("a Game from a Question set", () => {
  it("FR-33 (AC1), AD-4: Questions, links, close, Review and confirm are refused with WRONG_STATE", async () => {
    const gameId = await createFromSet();
    const refused = { ok: false, code: "WRONG_STATE" };
    expect(
      await saveQuestion({ gameId, questionId: randomUUID(), text: "Ny?" }),
    ).toMatchObject(refused);
    expect(await createInviteLinks({ gameId, count: 3 })).toMatchObject(
      refused,
    );
    expect(await closeCollection({ gameId })).toMatchObject(refused);
    expect(
      await mergeGroups({ gameId, groupIds: [randomUUID(), randomUUID()] }),
    ).toMatchObject(refused);
    expect(
      await markReviewed({
        gameId,
        questionId: randomUUID(),
        reviewed: true,
      }),
    ).toMatchObject(refused);
    expect(await confirmBoard({ gameId })).toMatchObject(refused);
    const error = await review.load(hosts.A, gameId).catch((e: unknown) => e);
    expect((error as DomainError).code).toBe("WRONG_STATE");
  });

  it("FR-33 (AC1), AD-5: only its Host sees it; Host B gets NOT_FOUND", async () => {
    const gameId = await createFromSet();
    const error = await games
      .getOwned(hosts.B, gameId)
      .catch((e: unknown) => e);
    expect((error as DomainError).code).toBe("NOT_FOUND");
    as("B");
    expect(
      await startPlay({ gameId, teams: ["Lag 1", "Lag 2"] }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("FR-33 (AC1, AC2): Team setup starts play, and revealing slot 1 scores the data's top Group", async () => {
    const gameId = await createFromSet();
    expect(await startPlay({ gameId, teams: ["Lag 1", "Lag 2"] })).toEqual({
      ok: true,
      data: undefined,
    });
    const view = await play.load(hosts.A, gameId);
    expect(view.question.text).toBe(home.questions[0].text);
    expect(
      await revealSlot({ gameId, boardSlotId: view.board[0].id, scored: true }),
    ).toMatchObject({
      ok: true,
      data: {
        label: home.questions[0].groups[0].label,
        count: home.questions[0].groups[0].count,
      },
    });
    const after = await play.load(hosts.A, gameId);
    expect(after.teams[0].score).toBe(home.questions[0].groups[0].count);

    // AC3: the stage of a set Game carries the source credit in its control bar.
    as("A");
    const { prelude } = await prerenderToNodeStream(
      await ScreenPage({
        params: Promise.resolve({ id: gameId }),
        searchParams: Promise.resolve({}),
      }),
    );
    let html = "";
    for await (const chunk of prelude) html += chunk;
    expect(html).toContain("data-stage");
    expect(html).toContain(QUESTION_SET_CREDIT);
  });
});
