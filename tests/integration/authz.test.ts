import { randomUUID } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { GET as reportRoute } from "@/app/api/spill/[gameId]/rapport/route";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeCollection,
  confirmBoard,
  createInviteLinks,
  deleteGame,
  discardGroup,
  markReviewed,
  mergeGroups,
  moveAnswers,
  moveQuestion,
  nextQuestion,
  removeQuestion,
  renameGroup,
  restoreGroup,
  revokeInviteLink,
  passTurn,
  revealSlot,
  saveQuestion,
  startPlay,
  undoReveal,
} from "@/app/spill/[id]/actions";
import ReviewPage, {
  generateMetadata as reviewMetadata,
} from "@/app/spill/[id]/gjennomgang/page";
import GamePage from "@/app/spill/[id]/page";
import LagPage from "@/app/spill/[id]/lag/page";
import TvPage from "@/app/spill/[id]/tv/page";
import HostViewPage from "@/app/spill/[id]/vert/page";
import { createGame } from "@/app/spill/actions";
import { submitAnswerSet } from "@/app/svar/[gameId]/actions";
import GamesPage from "@/app/spill/page";
import { DomainError } from "@/lib/errors";
import { newToken } from "@/lib/token";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { getDb } from "@/server/db/client";
import {
  answer,
  answerGroup,
  boardSlot,
  game,
  inviteLink,
  playState,
  question,
  reveal,
  submission,
  team,
} from "@/server/db/schema";
import * as games from "@/server/games";
import * as play from "@/server/play";
import * as review from "@/server/review";
import { afterTasks, cookieJar, NotFoundError, run } from "./next-mocks";

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

const getReport = (gameId: string) =>
  reportRoute(new Request(`http://localhost/api/spill/${gameId}/rapport`), {
    params: Promise.resolve({ gameId }),
  });

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

  it("FR-18, AD-5 (AC2): B's GET of the usage report on A's in review Game, a random UUID and a malformed ID gives one identical 404 NOT_FOUND", async () => {
    const [{ id: reviewOfA }] = await (
      await getDb()
    )
      .insert(game)
      .values({ hostId: hosts.A, title: "As gjennomgang", state: "in_review" })
      .returning({ id: game.id });
    as("A");
    expect((await getReport(reviewOfA)).status).toBe(200);
    as("B");
    for (const gameId of [reviewOfA, randomUUID(), "abc"]) {
      const response = await getReport(gameId);
      expect(response.status, gameId).toBe(404);
      expect(await response.json(), gameId).toEqual({
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    }
  });

  it("FR-19, AD-5 (AC2): B's review.load, Review page and its title on A's in review Game, a random UUID and a malformed ID give one identical NOT_FOUND, notFound() and the not-found title", async () => {
    const db = await getDb();
    const [{ id: reviewOfA }] = await db
      .insert(game)
      .values({ hostId: hosts.A, title: "As brett", state: "in_review" })
      .returning({ id: game.id });
    await db
      .insert(question)
      .values({ id: randomUUID(), gameId: reviewOfA, position: 1, text: "?" });
    as("A");
    expect((await review.load(hosts.A, reviewOfA)).title).toBe("As brett");
    as("B");
    for (const id of [reviewOfA, randomUUID(), "abc"]) {
      const error = await rejection(review.load(hosts.B, id));
      expect((error as DomainError).code, id).toBe("NOT_FOUND");
      expect(
        await rejection(
          ReviewPage({
            params: Promise.resolve({ id }),
            searchParams: Promise.resolve({}),
          }),
        ),
        id,
      ).toBeInstanceOf(NotFoundError);
      expect(
        await reviewMetadata({
          params: Promise.resolve({ id }),
          searchParams: Promise.resolve({}),
        }),
        id,
      ).toEqual({ title: "Vi finner ikke dette spillet" });
    }
  });

  it("FR-20, AD-5 (AC2): B's review.merge and mergeGroups action on A's Groups, with A's Game, B's own in review Game, a random UUID or a malformed Game ID, give NOT_FOUND, and A's Groups stay as they were", async () => {
    const db = await getDb();
    const [{ id: reviewOfA }, { id: reviewOfB }] = await db
      .insert(game)
      .values([
        { hostId: hosts.A, title: "As grupper", state: "in_review" },
        { hostId: hosts.B, title: "Bs grupper", state: "in_review" },
      ])
      .returning({ id: game.id });
    const questionId = randomUUID();
    await db
      .insert(question)
      .values({ id: questionId, gameId: reviewOfA, position: 1, text: "?" });
    const groupIds = [randomUUID(), randomUUID()];
    await db
      .insert(answerGroup)
      .values(
        groupIds.map((id) => ({ id, questionId, origin: "fallback" as const })),
      );
    await db.insert(answer).values(
      groupIds.map((groupId, i) => ({
        questionId,
        contributorKey: randomUUID(),
        rank: 1,
        text: `svar ${i}`,
        normalizedText: `svar ${i}`,
        groupId,
      })),
    );
    const groupsOfA = () =>
      db
        .select()
        .from(answerGroup)
        .where(inArray(answerGroup.id, groupIds))
        .orderBy(asc(answerGroup.id));
    const before = await groupsOfA();
    as("B");
    for (const gameId of [reviewOfA, reviewOfB, randomUUID(), "abc"]) {
      const error = await rejection(
        review.merge(hosts.B, { gameId, groupIds }),
      );
      expect((error as DomainError).code, gameId).toBe("NOT_FOUND");
      expect(await mergeGroups({ gameId, groupIds }), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    }
    expect(await groupsOfA()).toEqual(before);
    expect((await games.counters(reviewOfA)).groupsMerged).toBe(0);
  });

  it("FR-20, AD-5 (AC3): B's review.moveAnswers, review.rename, review.discard, review.restore and their actions on A's Answers and Groups, with A's Game, B's own in review Game, a random UUID or a malformed Game ID, give NOT_FOUND, and A stays as it was", async () => {
    const db = await getDb();
    const [{ id: reviewOfA }, { id: reviewOfB }] = await db
      .insert(game)
      .values([
        { hostId: hosts.A, title: "As svar", state: "in_review" },
        { hostId: hosts.B, title: "Bs svar", state: "in_review" },
      ])
      .returning({ id: game.id });
    const questionId = randomUUID();
    await db
      .insert(question)
      .values({ id: questionId, gameId: reviewOfA, position: 1, text: "?" });
    const groupIds = [randomUUID(), randomUUID()];
    // A's discarded Group, the target of B's restore.
    const gone = randomUUID();
    await db.insert(answerGroup).values([
      ...groupIds.map((id) => ({
        id,
        questionId,
        origin: "fallback" as const,
      })),
      { id: gone, questionId, origin: "fallback" as const, discarded: true },
    ]);
    const answerIds = (
      await db
        .insert(answer)
        .values(
          groupIds.map((groupId, i) => ({
            questionId,
            contributorKey: randomUUID(),
            rank: 1,
            text: `svar ${i}`,
            normalizedText: `svar ${i}`,
            groupId,
          })),
        )
        .returning({ id: answer.id })
    ).map((a) => a.id);
    const stateOfA = async () => ({
      groups: await db
        .select()
        .from(answerGroup)
        .where(eq(answerGroup.questionId, questionId))
        .orderBy(asc(answerGroup.id)),
      answers: await db
        .select({ id: answer.id, groupId: answer.groupId })
        .from(answer)
        .where(eq(answer.questionId, questionId))
        .orderBy(asc(answer.id)),
      counters: await games.counters(reviewOfA),
    });
    const before = await stateOfA();
    as("B");
    const notFound = {
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    };
    for (const gameId of [reviewOfA, reviewOfB, randomUUID(), "abc"]) {
      const move = { gameId, answerIds: [answerIds[0]], groupId: groupIds[1] };
      const split = { gameId, answerIds: [answerIds[0]] };
      const name = { gameId, groupId: groupIds[0], label: "Ny" };
      const kept = { gameId, groupId: groupIds[0] };
      const discarded = { gameId, groupId: gone };
      for (const call of [
        () => review.moveAnswers(hosts.B, move),
        () => review.moveAnswers(hosts.B, split),
        () => review.rename(hosts.B, name),
        () => review.discard(hosts.B, kept),
        () => review.restore(hosts.B, discarded),
      ])
        expect(((await rejection(call())) as DomainError).code, gameId).toBe(
          "NOT_FOUND",
        );
      expect(await moveAnswers(move), gameId).toEqual(notFound);
      expect(await moveAnswers(split), gameId).toEqual(notFound);
      expect(await renameGroup(name), gameId).toEqual(notFound);
      expect(await discardGroup(kept), gameId).toEqual(notFound);
      expect(await restoreGroup(discarded), gameId).toEqual(notFound);
    }
    expect(await stateOfA()).toEqual(before);
  });

  it("FR-21, AD-5: B's review.setReviewed and markReviewed on A's Question (with A's Game, B's own in review Game, a random UUID or a malformed Game ID) and B's review.confirmBoard and confirmBoard on A's, a random or a malformed Game give NOT_FOUND, and A stays in review with its mark and no Board", async () => {
    const db = await getDb();
    const [{ id: reviewOfA }, { id: reviewOfB }] = await db
      .insert(game)
      .values([
        { hostId: hosts.A, title: "As brett", state: "in_review" },
        { hostId: hosts.B, title: "Bs brett", state: "in_review" },
      ])
      .returning({ id: game.id });
    const questionId = randomUUID();
    await db
      .insert(question)
      .values({ id: questionId, gameId: reviewOfA, position: 1, text: "?" });
    const groupId = randomUUID();
    await db
      .insert(answerGroup)
      .values({ id: groupId, questionId, origin: "fallback" });
    await db.insert(answer).values({
      questionId,
      contributorKey: randomUUID(),
      rank: 1,
      text: "svar",
      normalizedText: "svar",
      groupId,
    });
    // A's Question is reviewed, so only the owner check can refuse B's confirm.
    await db
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.id, questionId));
    const stateOfA = async () => ({
      game: (await gameRow(reviewOfA)).state,
      question: await db
        .select()
        .from(question)
        .where(eq(question.id, questionId)),
      answers: await db
        .select()
        .from(answer)
        .where(eq(answer.questionId, questionId)),
      slots: await db
        .select()
        .from(boardSlot)
        .where(eq(boardSlot.questionId, questionId)),
    });
    const before = await stateOfA();
    as("B");
    const notFound = {
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    };
    for (const gameId of [reviewOfA, reviewOfB, randomUUID(), "abc"]) {
      for (const reviewed of [true, false]) {
        const mark = { gameId, questionId, reviewed };
        expect(
          ((await rejection(review.setReviewed(hosts.B, mark))) as DomainError)
            .code,
          gameId,
        ).toBe("NOT_FOUND");
        expect(await markReviewed(mark), gameId).toEqual(notFound);
      }
      // B's own Game is B's to lock; the matrix's foreign confirm is A's, random and malformed.
      if (gameId === reviewOfB) continue;
      expect(
        (
          (await rejection(
            review.confirmBoard(hosts.B, { gameId }),
          )) as DomainError
        ).code,
        gameId,
      ).toBe("NOT_FOUND");
      expect(await confirmBoard({ gameId }), gameId).toEqual(notFound);
    }
    expect(await stateOfA()).toEqual(before);
    expect(before.slots).toEqual([]);
  });

  it("FR-23, AD-5: B's play.start, startPlay and play.load on A's ready or playing Game, a random UUID or a malformed ID give NOT_FOUND, and A's Games keep their state and Teams", async () => {
    const db = await getDb();
    const [{ id: readyOfA }, { id: playingOfA }] = await db
      .insert(game)
      .values([
        { hostId: hosts.A, title: "As klare", state: "ready" },
        { hostId: hosts.A, title: "As spill i gang", state: "ready" },
      ])
      .returning({ id: game.id });
    for (const gameId of [readyOfA, playingOfA])
      await db
        .insert(question)
        .values({ id: randomUUID(), gameId, position: 1, text: "?" });
    await play.start(hosts.A, {
      gameId: playingOfA,
      teams: ["Lag 1", "Lag 2"],
    });
    const stateOfA = async () =>
      Promise.all(
        [readyOfA, playingOfA].map(async (id) => ({
          game: (await gameRow(id)).state,
          teams: await db.select().from(team).where(eq(team.gameId, id)),
          play: await db
            .select()
            .from(playState)
            .where(eq(playState.gameId, id)),
        })),
      );
    const before = await stateOfA();
    as("B");
    const notFound = {
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    };
    for (const gameId of [readyOfA, playingOfA, randomUUID(), "abc"]) {
      const input = { gameId, teams: ["B1", "B2"] };
      expect(
        ((await rejection(play.start(hosts.B, input))) as DomainError).code,
        gameId,
      ).toBe("NOT_FOUND");
      expect(await startPlay(input), gameId).toEqual(notFound);
      expect(
        ((await rejection(play.load(hosts.B, gameId))) as DomainError).code,
        gameId,
      ).toBe("NOT_FOUND");
    }
    expect(await stateOfA()).toEqual(before);
    expect(before.map((g) => [g.game, g.teams.length])).toEqual([
      ["ready", 0],
      ["playing", 2],
    ]);
  });

  it("FR-25, AD-5: B's play.reveal and revealSlot on A's playing Game, on B's own playing Game with A's slot, a random UUID or a malformed ID give NOT_FOUND, and nothing is revealed", async () => {
    const db = await getDb();
    // A playing Game with one Question and one Board slot for `host`.
    const playingOf = async (host: string) => {
      const [{ id }] = await db
        .insert(game)
        .values({ hostId: host, title: "Spill i gang", state: "ready" })
        .returning({ id: game.id });
      const questionId = randomUUID();
      await db
        .insert(question)
        .values({ id: questionId, gameId: id, position: 1, text: "?" });
      const [{ id: slotId }] = await db
        .insert(boardSlot)
        .values({ questionId, position: 1, label: "Kari", count: 3 })
        .returning({ id: boardSlot.id });
      await play.start(host, { gameId: id, teams: ["Lag 1", "Lag 2"] });
      return { id, slotId };
    };
    const ofA = await playingOf(hosts.A);
    const ofB = await playingOf(hosts.B);
    as("B");
    const notFound = {
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    };
    for (const gameId of [ofA.id, ofB.id, randomUUID(), "abc"]) {
      const input = { gameId, boardSlotId: ofA.slotId, scored: true };
      expect(
        ((await rejection(play.reveal(hosts.B, input))) as DomainError).code,
        gameId,
      ).toBe("NOT_FOUND");
      expect(await revealSlot(input), gameId).toEqual(notFound);
    }
    expect(await db.select().from(reveal)).toEqual([]);
    expect((await gameRow(ofA.id)).state).toBe("playing");
  });

  it("FR-26, FR-27, AD-5: B's play.undo, undoReveal, play.nextTeam and passTurn on A's playing Game with a Reveal, a random UUID or a malformed ID give NOT_FOUND, and A's Reveal and current Team are unchanged", async () => {
    const db = await getDb();
    const [{ id }] = await db
      .insert(game)
      .values({ hostId: hosts.A, title: "Spill med avsløring", state: "ready" })
      .returning({ id: game.id });
    const questionId = randomUUID();
    await db
      .insert(question)
      .values({ id: questionId, gameId: id, position: 1, text: "?" });
    const [{ id: slotId }] = await db
      .insert(boardSlot)
      .values({ questionId, position: 1, label: "Kari", count: 3 })
      .returning({ id: boardSlot.id });
    await play.start(hosts.A, { gameId: id, teams: ["Lag 1", "Lag 2"] });
    await play.reveal(hosts.A, {
      gameId: id,
      boardSlotId: slotId,
      scored: true,
    });
    const stateOfA = async () => ({
      reveals: await db.select().from(reveal).where(eq(reveal.gameId, id)),
      play: await db.select().from(playState).where(eq(playState.gameId, id)),
    });
    const before = await stateOfA();
    expect(before.reveals).toHaveLength(1);
    as("B");
    const notFound = {
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    };
    for (const gameId of [id, randomUUID(), "abc"]) {
      const input = { gameId, boardSlotId: slotId };
      for (const op of [play.undo, play.nextTeam])
        expect(
          ((await rejection(op(hosts.B, input))) as DomainError).code,
          gameId,
        ).toBe("NOT_FOUND");
      expect(await undoReveal(input), gameId).toEqual(notFound);
      expect(await passTurn({ gameId }), gameId).toEqual(notFound);
    }
    expect(await stateOfA()).toEqual(before);
  });

  it("FR-27, AD-5: B's play.nextQuestion and nextQuestion on A's playing Game, a random UUID or a malformed ID give NOT_FOUND and leave A's play_state and state; once A's Game is played, B's play.finalScores is NOT_FOUND and its screen page calls notFound()", async () => {
    const db = await getDb();
    const [{ id }] = await db
      .insert(game)
      .values({ hostId: hosts.A, title: "Siste spørsmål", state: "ready" })
      .returning({ id: game.id });
    const questionId = randomUUID();
    await db
      .insert(question)
      .values({ id: questionId, gameId: id, position: 1, text: "?" });
    await db
      .insert(boardSlot)
      .values({ questionId, position: 1, label: "Kari", count: 3 });
    await play.start(hosts.A, { gameId: id, teams: ["Lag 1", "Lag 2"] });
    const stateOfA = async () => ({
      game: (await gameRow(id)).state,
      play: await db.select().from(playState).where(eq(playState.gameId, id)),
    });
    const before = await stateOfA();
    as("B");
    for (const gameId of [id, randomUUID(), "abc"]) {
      const input = { gameId, position: 1 };
      expect(
        ((await rejection(play.nextQuestion(hosts.B, input))) as DomainError)
          .code,
        gameId,
      ).toBe("NOT_FOUND");
      expect(await nextQuestion(input), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    }
    expect(await stateOfA()).toEqual(before);
    expect(before.game).toBe("playing");
    await play.nextQuestion(hosts.A, { gameId: id, position: 1 });
    expect((await gameRow(id)).state).toBe("played");
    expect(
      ((await rejection(play.finalScores(hosts.B, id))) as DomainError).code,
    ).toBe("NOT_FOUND");
    expect(
      await rejection(
        LagPage({
          params: Promise.resolve({ id }),
          searchParams: Promise.resolve({}),
        }),
      ),
    ).toBeInstanceOf(NotFoundError);
  });

  it("FR-23 to FR-27, AD-5: B's play.answerKey and B's Team setup page, TV page and Host view of A's playing or played Game, a random UUID or a malformed ID give NOT_FOUND", async () => {
    const db = await getDb();
    const [{ id: playingOfA }, { id: playedOfA }] = await db
      .insert(game)
      .values([
        { hostId: hosts.A, title: "As TV", state: "ready" },
        { hostId: hosts.A, title: "As ferdige", state: "ready" },
      ])
      .returning({ id: game.id });
    for (const gameId of [playingOfA, playedOfA]) {
      await db
        .insert(question)
        .values({ id: randomUUID(), gameId, position: 1, text: "?" });
      await play.start(hosts.A, { gameId, teams: ["Lag 1", "Lag 2"] });
    }
    await play.nextQuestion(hosts.A, { gameId: playedOfA, position: 1 });
    as("B");
    for (const id of [playingOfA, playedOfA, randomUUID(), "abc"]) {
      expect(
        ((await rejection(play.answerKey(hosts.B, id))) as DomainError).code,
        id,
      ).toBe("NOT_FOUND");
      const props = {
        params: Promise.resolve({ id }),
        searchParams: Promise.resolve({}),
      };
      for (const Page of [LagPage, TvPage, HostViewPage])
        expect(await rejection(Page(props)), id).toBeInstanceOf(NotFoundError);
    }
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

describe("Invite links across Hosts", () => {
  it("FR-5, AD-5: B's createInviteLinks on A's Game, a random UUID and a malformed ID give one identical NOT_FOUND and leave A's state, issued count, rows and updated_at", async () => {
    as("B");
    const db = await getDb();
    const linksOfA = () =>
      db.select().from(inviteLink).where(eq(inviteLink.gameId, gameOfA));
    const before = { game: await gameRow(gameOfA), links: await linksOfA() };
    for (const gameId of [gameOfA, randomUUID(), "abc"])
      expect(await createInviteLinks({ gameId, count: 1 }), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    expect(await gameRow(gameOfA)).toEqual(before.game);
    expect(await linksOfA()).toEqual(before.links);
    expect(before.game).toMatchObject({
      state: "draft",
      inviteLinksIssued: 0,
      updatedAt: T0,
    });
  });

  it("FR-9, AD-5: B's revokeInviteLink with A's valid link on A's Game, a random UUID and a malformed ID gives one identical NOT_FOUND and leaves A's rows, issued count and updated_at", async () => {
    const db = await getDb();
    const [{ id: collectingOfA }] = await db
      .insert(game)
      .values({ hostId: hosts.A, title: "As innsamling" })
      .returning({ id: game.id });
    await db.insert(question).values({
      id: randomUUID(),
      gameId: collectingOfA,
      position: 1,
      text: "Hvem?",
    });
    as("A");
    const created = await createInviteLinks({
      gameId: collectingOfA,
      count: 2,
    });
    if (!created.ok) throw new Error(created.code);
    const [link] = created.data.links;
    const snapshot = async () => ({
      game: await gameRow(collectingOfA),
      links: await db
        .select()
        .from(inviteLink)
        .where(eq(inviteLink.gameId, collectingOfA)),
    });
    const before = await snapshot();
    as("B");
    for (const gameId of [collectingOfA, randomUUID(), "abc"])
      expect(await revokeInviteLink({ gameId, link }), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    expect(
      await revokeInviteLink({ gameId: collectingOfA, link: "abc" }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Vi finner ikke dette spillet.",
    });
    expect(await snapshot()).toEqual(before);
    expect(before.game).toMatchObject({
      state: "collecting",
      inviteLinksIssued: 2,
    });
  });

  it("FR-10, AD-5: B's closeCollection on A's closable Game, a random UUID and a malformed ID gives one identical NOT_FOUND and leaves A's state, links, sets, updated_at and answer table", async () => {
    const db = await getDb();
    const [{ id: closableOfA }] = await db
      .insert(game)
      .values({ hostId: hosts.A, title: "As stengbare" })
      .returning({ id: game.id });
    const questionId = randomUUID();
    await db.insert(question).values({
      id: questionId,
      gameId: closableOfA,
      position: 1,
      text: "Hvem?",
    });
    as("A");
    const created = await createInviteLinks({ gameId: closableOfA, count: 3 });
    if (!created.ok) throw new Error(created.code);
    for (const link of created.data.links) {
      const sent = await submitAnswerSet(closableOfA, link.split("#")[1], {
        answers: { [questionId]: ["Kari"] },
        editSecret: newToken(),
      });
      if (!sent.ok) throw new Error(sent.code);
    }
    const snapshot = async () => ({
      game: await gameRow(closableOfA),
      links: await db
        .select()
        .from(inviteLink)
        .where(eq(inviteLink.gameId, closableOfA)),
      sets: await db.select().from(submission),
      answers: await db.select().from(answer),
    });
    const before = await snapshot();
    as("B");
    afterTasks.length = 0;
    for (const gameId of [closableOfA, randomUUID(), "abc"])
      expect(await closeCollection({ gameId }), gameId).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Vi finner ikke dette spillet.",
      });
    expect(afterTasks, "a refused close queues no Grouping run").toEqual([]);
    expect(await snapshot()).toEqual(before);
    expect(before.game.state).toBe("collecting");
    expect(before.links).toHaveLength(3);
  });

  it("FR-8, AD-5: B's collection.progress on A's Game, a random UUID and a malformed ID rejects with the same NOT_FOUND", async () => {
    for (const id of [gameOfA, randomUUID(), "abc"]) {
      const error = await rejection(collection.progress(hosts.B, id));
      expect(error, id).toBeInstanceOf(DomainError);
      expect((error as DomainError).code, id).toBe("NOT_FOUND");
      expect((error as DomainError).fieldErrors, id).toBeUndefined();
    }
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
