import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  nextQuestion,
  passTurn,
  revealSlot,
  startPlay,
  undoReveal,
} from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import ScreenPage, {
  generateMetadata as screenMetadata,
} from "@/app/spill/[id]/skjerm/page";
import TvPage, {
  generateMetadata as tvMetadata,
} from "@/app/spill/[id]/tv/page";
import HostViewPage, {
  generateMetadata as hostViewMetadata,
} from "@/app/spill/[id]/vert/page";
import { DomainError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import type { GameState } from "@/lib/game-state";
import { RETENTION_PLAYED_MS } from "@/lib/limits";
import { QUESTION_SET_CREDIT } from "@/lib/question-sets";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import {
  answer,
  answerGroup,
  boardSlot,
  game,
  playState,
  question,
  reveal,
  team,
} from "@/server/db/schema";
import * as games from "@/server/games";
import * as play from "@/server/play";
import { cookieJar, nextCache, RedirectError } from "./next-mocks";
import { sqlRows } from "./driver";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

const COOKIE = "toppsvar_session";
const T0 = new Date("2026-11-01T12:00:00Z");
const QUESTIONS = ["Hvem kommer for sent?", "Hva sier verten?", "Nevn en by"];
let session: string;
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "spill@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  session = cookieJar.store.get(COOKIE)!;
  hostId = (await auth.requireHost()).hostId;
});
beforeEach(() => {
  cookieJar.store.clear();
  cookieJar.store.set(COOKIE, session);
  nextCache.revalidatePath.mockClear();
});

// Each Question's locked Board: label and Count per slot, in position order.
const BOARD = [
  [
    ["Kari", 5],
    ["Ola", 3],
    ["Per", 2],
  ],
  [
    ["Oslo", 4],
    ["Bergen", 1],
  ],
  [["Molde", 6]],
] as const;

// A Game in `state` with three Questions (inserted out of order, so start must sort),
// each with its Board from BOARD (also inserted last first).
async function gameIn(state: GameState = "ready") {
  const db = await getDb();
  const [{ id }] = await db
    .insert(game)
    .values({ hostId, title: "Hyttetur", state, updatedAt: T0 })
    .returning({ id: game.id });
  const ids = QUESTIONS.map(() => randomUUID());
  for (const i of [2, 0, 1])
    await db.insert(question).values({
      id: ids[i],
      gameId: id,
      position: i + 1,
      text: QUESTIONS[i],
    });
  const slots = await db
    .insert(boardSlot)
    .values(
      BOARD.flatMap((slots, q) =>
        slots.map(([label, count], i) => ({
          questionId: ids[q],
          position: i + 1,
          label,
          count,
        })),
      ).reverse(), // last first, so getBoard must sort
    )
    .returning({
      id: boardSlot.id,
      questionId: boardSlot.questionId,
      position: boardSlot.position,
    });
  // slotIds[q][i]: Question q + 1, position i + 1.
  const slotIds = ids.map((qid) =>
    slots
      .filter((s) => s.questionId === qid)
      .sort((a, b) => a.position - b.position)
      .map((s) => s.id),
  );
  return { id, questionIds: ids, slotIds };
}

// A playing Game with Teams Lag 1 and Lag 2, Lag 1 current on Question 1.
async function playing() {
  const g = await gameIn();
  await play.start(hostId, { gameId: g.id, teams: ["Lag 1", "Lag 2"] });
  const teams = (await rowsOf(g.id)).teams;
  return { ...g, teamIds: teams.map((t) => t.id) };
}

const revealsOf = async (gameId: string) =>
  (await getDb())
    .select({
      boardSlotId: reveal.boardSlotId,
      teamId: reveal.teamId,
      seq: reveal.seq,
    })
    .from(reveal)
    .where(eq(reveal.gameId, gameId))
    .orderBy(asc(reveal.seq));

const scoresOf = async (gameId: string) =>
  (await play.load(hostId, gameId)).teams.map((t) => t.score);

// AD-11 checked independently of play.load: the raw sum over each Team's scored Reveals.
async function rawSums(gameId: string) {
  const result = await (
    await getDb()
  ).execute(sql`
    select t.position, coalesce(sum(s.count), 0)::int as score
    from team t
    left join reveal r on r.team_id = t.id
    left join board_slot s on s.id = r.board_slot_id
    where t.game_id = ${gameId}
    group by t.id, t.position
    order by t.position`);
  return sqlRows<{ score: number }>(result).map((r) => r.score);
}

async function rowsOf(gameId: string) {
  const db = await getDb();
  return {
    state: (await db.select().from(game).where(eq(game.id, gameId)))[0]?.state,
    teams: await db
      .select({ id: team.id, name: team.name, position: team.position })
      .from(team)
      .where(eq(team.gameId, gameId))
      .orderBy(asc(team.position)),
    playState: await db
      .select()
      .from(playState)
      .where(eq(playState.gameId, gameId)),
  };
}

const codeOf = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => (e as DomainError).code,
  );

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

const props = (id: string) => ({
  params: Promise.resolve({ id }),
  searchParams: Promise.resolve({}),
});
// Renders the async play view behind its Suspense boundary to the end.
async function prerender(node: ReactNode) {
  const { prelude } = await prerenderToNodeStream(node);
  let html = "";
  for await (const chunk of prelude) html += chunk;
  return html;
}
const screen = async (id: string) => prerender(await ScreenPage(props(id)));
// The first flush: only the Suspense fallback of the play view.
const screenShell = async (id: string) =>
  renderToStaticMarkup(await ScreenPage(props(id)));
const tv = async (id: string) => prerender(await TvPage(props(id)));
const hostView = async (id: string) =>
  renderToStaticMarkup(await HostViewPage(props(id)));
// The TV page keeps F with its hint display:none, so the room never sees it.
const visible = (html: string) =>
  html.replace('<p class="hidden">Trykk F for fullskjerm.</p>', "");
const gamePage = async (id: string) =>
  renderToStaticMarkup(await GamePage(props(id)));

describe("play.start", () => {
  it("FR-23: the startPlay action names two trimmed Teams, points play_state at Question 1 and Team 1, moves ready to playing, touches updated_at and revalidates the Game and screen pages; play.load gives both Scores 0 with Team 1 current", async () => {
    const { id, questionIds } = await gameIn();
    expect(
      await startPlay({ gameId: id, teams: [" Hyttegjengen ", "Lag 2"] }),
    ).toEqual({ ok: true, data: undefined });
    const rows = await rowsOf(id);
    expect(rows.state).toBe("playing");
    expect(rows.teams.map(({ name, position }) => [name, position])).toEqual([
      ["Hyttegjengen", 1],
      ["Lag 2", 2],
    ]);
    expect(rows.playState).toEqual([
      {
        gameId: id,
        currentQuestionId: questionIds[0],
        currentTeamId: rows.teams[0].id,
      },
    ]);
    const [{ updatedAt }] = await (
      await getDb()
    )
      .select({ updatedAt: game.updatedAt })
      .from(game)
      .where(eq(game.id, id));
    expect(updatedAt.getTime()).toBeGreaterThan(T0.getTime());
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(`/spill/${id}`);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(
      `/spill/${id}/skjerm`,
    );
    expect(await play.load(hostId, id)).toEqual({
      question: { position: 1, text: QUESTIONS[0] },
      total: 3,
      teams: [
        { id: rows.teams[0].id, name: "Hyttegjengen", score: 0, current: true },
        { id: rows.teams[1].id, name: "Lag 2", score: 0, current: false },
      ],
      board: [1, 2, 3].map((position) => ({
        id: expect.any(String),
        position,
        revealed: false,
      })),
      lastReveal: null,
    });
  });

  it("FR-23: four Teams, one name exactly 14 characters, go in in order", async () => {
    const { id } = await gameIn();
    const names = ["Lag 1", "Fjortentegn123", "Lag 3", "Lag 4"];
    await play.start(hostId, { gameId: id, teams: names });
    expect((await rowsOf(id)).teams.map((t) => t.name)).toEqual(names);
  });

  it("FR-23: one or five Teams, an empty, blank or 15-character name, and a missing teams are INVALID_INPUT with fieldErrors.teams, and nothing is written", async () => {
    const { id } = await gameIn();
    const before = await rowsOf(id);
    for (const [teams, message] of [
      [["Lag 1"], "Velg to til fire lag."],
      [["1", "2", "3", "4", "5"], "Velg to til fire lag."],
      [["", "Lag 2"], "Laget trenger et navn."],
      [["Lag 1", "   "], "Laget trenger et navn."],
      [["Lag 1", "x".repeat(15)], "Navnet kan ha maks 14 tegn."],
    ] as const) {
      const error = await play
        .start(hostId, { gameId: id, teams })
        .catch((e: DomainError) => e);
      expect(error).toMatchObject({
        code: "INVALID_INPUT",
        fieldErrors: { teams: message },
      });
      expect(await startPlay({ gameId: id, teams })).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Sjekk feltene som er merket, og prøv igjen.",
        fieldErrors: { teams: message },
      });
    }
    expect(await codeOf(play.start(hostId, { gameId: id }))).toBe(
      "INVALID_INPUT",
    );
    expect(await rowsOf(id)).toEqual(before);
    expect(before.teams).toEqual([]);
  });

  it.each(["draft", "collecting", "grouping", "in_review"] as const)(
    "FR-23: a Game in %s is WRONG_STATE and nothing is written",
    async (state) => {
      const { id } = await gameIn(state);
      const input = { gameId: id, teams: ["Lag 1", "Lag 2"] };
      expect(await codeOf(play.start(hostId, input))).toBe("WRONG_STATE");
      expect(await startPlay(input)).toMatchObject({
        ok: false,
        code: "WRONG_STATE",
      });
      expect(await rowsOf(id)).toEqual({ state, teams: [], playState: [] });
    },
  );

  it("FR-23: a second start on a playing Game is WRONG_STATE and keeps the first Teams", async () => {
    const { id } = await gameIn();
    await play.start(hostId, { gameId: id, teams: ["Lag 1", "Lag 2"] });
    const before = await rowsOf(id);
    expect(
      await codeOf(play.start(hostId, { gameId: id, teams: ["A", "B", "C"] })),
    ).toBe("WRONG_STATE");
    expect(await rowsOf(id)).toEqual(before);
  });
});

describe("play.load", () => {
  it("FR-23: a ready Game is WRONG_STATE", async () => {
    const { id } = await gameIn();
    expect(await codeOf(play.load(hostId, id))).toBe("WRONG_STATE");
  });

  it("FR-3, FR-23: deleting a playing Game removes its team and play_state rows", async () => {
    const { id } = await gameIn();
    await play.start(hostId, { gameId: id, teams: ["Lag 1", "Lag 2"] });
    await games.deleteOwned(hostId, id);
    expect(await rowsOf(id)).toEqual({
      state: undefined,
      teams: [],
      playState: [],
    });
  });
});

describe("play.answerKey", () => {
  it("FR-24 to FR-27, AD-15: every slot of the current Question with label, Count and revealed/scored state, plus the Teams, Scores and Spørsmål N av M of play.load", async () => {
    const { id, slotIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][1],
      scored: true,
    });
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][2],
      scored: false,
    });
    const key = await play.answerKey(hostId, id);
    expect(key.board).toEqual(
      [
        { id: slotIds[0][0], position: 1, label: "Kari", count: 5 },
        { id: slotIds[0][1], position: 2, label: "Ola", count: 3 },
        { id: slotIds[0][2], position: 3, label: "Per", count: 2 },
      ].map((s, i) => ({ ...s, revealed: i > 0, scored: i === 1 })),
    );
    const { board, ...rest } = await play.load(hostId, id);
    expect(key).toEqual({ ...rest, board: key.board });
    expect(board.map((s) => s.revealed)).toEqual([false, true, true]);
  });

  // Another Host's, a random and a malformed id are in authz.test.ts.
  it("FR-23: a ready or played Game is WRONG_STATE", async () => {
    const { id } = await gameIn();
    expect(await codeOf(play.answerKey(hostId, id))).toBe("WRONG_STATE");
    const done = await playing();
    await finishGame(done.id);
    expect(await codeOf(play.answerKey(hostId, done.id))).toBe("WRONG_STATE");
  });
});

describe("play.reveal", () => {
  it("FR-25, AD-16: the revealSlot action reveals slot 1 for the current Team with seq 1, returns label, Count and Team, revalidates the Game and screen pages, and leaves Team 1 current; load shows slot 1 revealed and Scores [5, 0]", async () => {
    const { id, slotIds, teamIds } = await playing();
    nextCache.revalidatePath.mockClear();
    expect(
      await revealSlot({
        gameId: id,
        boardSlotId: slotIds[0][0],
        scored: true,
      }),
    ).toEqual({ ok: true, data: { label: "Kari", count: 5, team: "Lag 1" } });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(`/spill/${id}`);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(
      `/spill/${id}/skjerm`,
    );
    expect(await revealsOf(id)).toEqual([
      { boardSlotId: slotIds[0][0], teamId: teamIds[0], seq: 1 },
    ]);
    const view = await play.load(hostId, id);
    expect(view.board).toEqual([
      {
        id: slotIds[0][0],
        position: 1,
        revealed: true,
        label: "Kari",
        count: 5,
        scored: true,
      },
      { id: slotIds[0][1], position: 2, revealed: false },
      { id: slotIds[0][2], position: 3, revealed: false },
    ]);
    expect(view.teams.map((t) => [t.score, t.current])).toEqual([
      [5, true],
      [0, false],
    ]);
  });

  it("FR-25, AD-11: with play_state moved to Team 2 by hand, slot 2 goes to Team 2 with seq 2, and each Score equals the raw SQL sum of its scored Counts", async () => {
    const { id, slotIds, teamIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][0],
      scored: true,
    });
    await (
      await getDb()
    )
      .update(playState)
      .set({ currentTeamId: teamIds[1] })
      .where(eq(playState.gameId, id));
    expect(
      await play.reveal(hostId, {
        gameId: id,
        boardSlotId: slotIds[0][1],
        scored: true,
      }),
    ).toEqual({ label: "Ola", count: 3, team: "Lag 2" });
    expect((await revealsOf(id)).map((r) => [r.teamId, r.seq])).toEqual([
      [teamIds[0], 1],
      [teamIds[1], 2],
    ]);
    expect(await scoresOf(id)).toEqual([5, 3]);
    expect(await rawSums(id)).toEqual([5, 3]);
  });

  it("FR-25, FR-27, AD-16 (AC3): an unscored Reveal stores a null team_id, returns team null, changes no Score, and load shows it with scored false", async () => {
    const { id, slotIds } = await playing();
    expect(
      await revealSlot({
        gameId: id,
        boardSlotId: slotIds[0][2],
        scored: false,
      }),
    ).toEqual({ ok: true, data: { label: "Per", count: 2, team: null } });
    expect(await revealsOf(id)).toEqual([
      { boardSlotId: slotIds[0][2], teamId: null, seq: 1 },
    ]);
    expect(await scoresOf(id)).toEqual([0, 0]);
    expect((await play.load(hostId, id)).board[2]).toEqual({
      id: slotIds[0][2],
      position: 3,
      revealed: true,
      label: "Per",
      count: 2,
      scored: false,
    });
  });

  it("FR-25: revealing an already revealed slot is ALREADY_REVEALED, a slot of Question 2 is WRONG_QUESTION, and nothing is written", async () => {
    const { id, slotIds } = await playing();
    const input = { gameId: id, boardSlotId: slotIds[0][0], scored: true };
    await play.reveal(hostId, input);
    const before = await revealsOf(id);
    expect(await codeOf(play.reveal(hostId, input))).toBe("ALREADY_REVEALED");
    expect(await revealSlot(input)).toEqual({
      ok: false,
      code: "ALREADY_REVEALED",
      message: "Den plassen er allerede avslørt.",
    });
    const other = { gameId: id, boardSlotId: slotIds[1][0], scored: true };
    expect(await codeOf(play.reveal(hostId, other))).toBe("WRONG_QUESTION");
    expect(await revealSlot(other)).toEqual({
      ok: false,
      code: "WRONG_QUESTION",
      message: "Spillet er på et annet spørsmål nå.",
    });
    expect(await revealsOf(id)).toEqual(before);
    expect(await scoresOf(id)).toEqual([5, 0]);
  });

  it("FR-25, AD-5: a random UUID, a malformed id or another Game's slot is NOT_FOUND, and nothing is written", async () => {
    const { id } = await playing();
    const other = await playing();
    for (const boardSlotId of [randomUUID(), "abc", other.slotIds[0][0]]) {
      const input = { gameId: id, boardSlotId, scored: true };
      expect(await codeOf(play.reveal(hostId, input)), boardSlotId).toBe(
        "NOT_FOUND",
      );
      expect(await revealSlot(input), boardSlotId).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
    }
    expect(await revealsOf(id)).toEqual([]);
    expect(await revealsOf(other.id)).toEqual([]);
  });

  it("FR-25: a missing or non-boolean scored and a non-string boardSlotId are INVALID_INPUT, and nothing is written", async () => {
    const { id, slotIds } = await playing();
    for (const input of [
      { gameId: id, boardSlotId: slotIds[0][0] },
      { gameId: id, boardSlotId: slotIds[0][0], scored: "true" },
      { gameId: id, boardSlotId: 1, scored: true },
    ]) {
      expect(await codeOf(play.reveal(hostId, input))).toBe("INVALID_INPUT");
      expect(await revealSlot(input)).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
      });
    }
    expect(await revealsOf(id)).toEqual([]);
  });

  it.each(["ready"] as const)(
    "FR-25: a Game in %s is WRONG_STATE and nothing is written",
    async (state) => {
      const { id, slotIds } = await gameIn(state);
      const input = { gameId: id, boardSlotId: slotIds[0][0], scored: true };
      expect(await codeOf(play.reveal(hostId, input))).toBe("WRONG_STATE");
      expect(await revealSlot(input)).toMatchObject({
        ok: false,
        code: "WRONG_STATE",
      });
      expect(await revealsOf(id)).toEqual([]);
    },
  );
});

// Moves play_state to any Question by hand: the property test wraps back to Question 1,
// which play.nextQuestion never does.
const moveTo = async (gameId: string, questionId: string) =>
  (await getDb())
    .update(playState)
    .set({ currentQuestionId: questionId })
    .where(eq(playState.gameId, gameId));

describe("play.undo", () => {
  it("FR-26, AD-11 (AC2): the undoReveal action deletes the unscored Reveal first (team null), then the scored one (team Lag 1), the Score falls 5 → 0, and both pages are revalidated", async () => {
    const { id, slotIds, teamIds } = await playing();
    const reveal = (i: number, scored: boolean) =>
      play.reveal(hostId, { gameId: id, boardSlotId: slotIds[0][i], scored });
    await reveal(0, true);
    await reveal(1, false);
    expect(await scoresOf(id)).toEqual([5, 0]);
    nextCache.revalidatePath.mockClear();
    expect((await play.load(hostId, id)).lastReveal).toBe(slotIds[0][1]);
    expect(
      await undoReveal({ gameId: id, boardSlotId: slotIds[0][1] }),
    ).toEqual({
      ok: true,
      data: { boardSlotId: slotIds[0][1], label: "Ola", count: 3, team: null },
    });
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(`/spill/${id}`);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(
      `/spill/${id}/skjerm`,
    );
    expect(await revealsOf(id)).toEqual([
      { boardSlotId: slotIds[0][0], teamId: teamIds[0], seq: 1 },
    ]);
    expect(await scoresOf(id)).toEqual([5, 0]);
    expect(
      await undoReveal({ gameId: id, boardSlotId: slotIds[0][0] }),
    ).toEqual({
      ok: true,
      data: {
        boardSlotId: slotIds[0][0],
        label: "Kari",
        count: 5,
        team: "Lag 1",
      },
    });
    expect(await revealsOf(id)).toEqual([]);
    expect(await scoresOf(id)).toEqual([0, 0]);
    expect(await rawSums(id)).toEqual([0, 0]);
    const view = await play.load(hostId, id);
    expect(view.board.map((s) => s.revealed)).toEqual([false, false, false]);
    expect(view.lastReveal).toBeNull();
    // The turn never moves with an undo.
    expect((await rowsOf(id)).playState[0].currentTeamId).toBe(teamIds[0]);
  });

  it("FR-26 (AC2): with Reveals on Question 1 and play_state moved to Question 2, undo deletes Question 2's Reveals in seq order, then is NOTHING_TO_UNDO, and Question 1's Reveals stay", async () => {
    const { id, questionIds, slotIds, teamIds } = await playing();
    const reveal = (q: number, i: number, scored: boolean) =>
      play.reveal(hostId, { gameId: id, boardSlotId: slotIds[q][i], scored });
    await reveal(0, 0, true); // Kari 5 → Lag 1
    await reveal(0, 2, false); // Per, unscored
    await moveTo(id, questionIds[1]);
    await reveal(1, 0, true); // Oslo 4 → Lag 1
    await reveal(1, 1, false); // Bergen, unscored
    expect(await scoresOf(id)).toEqual([9, 0]);
    expect((await play.load(hostId, id)).lastReveal).toBe(slotIds[1][1]);
    expect(
      await undoReveal({ gameId: id, boardSlotId: slotIds[1][1] }),
    ).toMatchObject({
      ok: true,
      data: { boardSlotId: slotIds[1][1], team: null },
    });
    expect(await scoresOf(id)).toEqual([9, 0]);
    expect(await rawSums(id)).toEqual([9, 0]);
    expect(
      await play.undo(hostId, { gameId: id, boardSlotId: slotIds[1][0] }),
    ).toEqual({
      boardSlotId: slotIds[1][0],
      label: "Oslo",
      count: 4,
      team: "Lag 1",
    });
    expect(await scoresOf(id)).toEqual([5, 0]);
    expect(await rawSums(id)).toEqual([5, 0]);
    // Question 1's last Reveal is not on the current Question, so it is not undone.
    const input = { gameId: id, boardSlotId: slotIds[0][2] };
    const before = await revealsOf(id);
    expect((await play.load(hostId, id)).lastReveal).toBeNull();
    expect(await codeOf(play.undo(hostId, input))).toBe("NOTHING_TO_UNDO");
    expect(await undoReveal(input)).toEqual({
      ok: false,
      code: "NOTHING_TO_UNDO",
      message: "Det er ingenting å angre.",
    });
    expect(await revealsOf(id)).toEqual(before);
    expect(before).toEqual([
      { boardSlotId: slotIds[0][0], teamId: teamIds[0], seq: 1 },
      { boardSlotId: slotIds[0][2], teamId: null, seq: 2 },
    ]);
  });

  it("FR-26: undo with no Reveal on the current Question is NOTHING_TO_UNDO and writes nothing", async () => {
    const { id, slotIds } = await playing();
    const before = await rowsOf(id);
    expect(
      await codeOf(
        play.undo(hostId, { gameId: id, boardSlotId: slotIds[0][0] }),
      ),
    ).toBe("NOTHING_TO_UNDO");
    expect(await rowsOf(id)).toEqual(before);
    expect(await revealsOf(id)).toEqual([]);
  });

  it("FR-26, AD-16: a stale tab that still shows Kari as the last Reveal after another tab undid Ola gets NOTHING_TO_UNDO, and Kari and the Score stay", async () => {
    const { id, slotIds, teamIds } = await playing();
    for (const i of [0, 1])
      await play.reveal(hostId, {
        gameId: id,
        boardSlotId: slotIds[0][i],
        scored: true,
      });
    // The stale tab loaded both Reveals; the other tab then undoes Ola.
    const stale = (await play.load(hostId, id)).lastReveal!;
    expect(stale).toBe(slotIds[0][1]);
    await play.undo(hostId, { gameId: id, boardSlotId: stale });
    const input = { gameId: id, boardSlotId: stale };
    expect(await codeOf(play.undo(hostId, input))).toBe("NOTHING_TO_UNDO");
    expect(await undoReveal(input)).toMatchObject({ code: "NOTHING_TO_UNDO" });
    // Naming the older Reveal while a newer one stands is refused the same way.
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][2],
      scored: true,
    });
    expect(
      await codeOf(
        play.undo(hostId, { gameId: id, boardSlotId: slotIds[0][0] }),
      ),
    ).toBe("NOTHING_TO_UNDO");
    expect(await revealsOf(id)).toEqual([
      { boardSlotId: slotIds[0][0], teamId: teamIds[0], seq: 1 },
      { boardSlotId: slotIds[0][2], teamId: teamIds[0], seq: 2 },
    ]);
    expect(await scoresOf(id)).toEqual([7, 0]);
  });

  it("FR-26, AD-16: a stale tab still on Question 1 cannot undo the Reveal another tab made on Question 2, and both Reveals stay", async () => {
    const { id, slotIds, teamIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][0],
      scored: true,
    });
    const stale = (await play.load(hostId, id)).lastReveal!;
    await play.nextQuestion(hostId, { gameId: id, position: 1 });
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[1][0],
      scored: true,
    });
    expect((await play.load(hostId, id)).lastReveal).toBe(slotIds[1][0]);
    const input = { gameId: id, boardSlotId: stale };
    expect(await codeOf(play.undo(hostId, input))).toBe("NOTHING_TO_UNDO");
    expect(await undoReveal(input)).toMatchObject({ code: "NOTHING_TO_UNDO" });
    expect(await revealsOf(id)).toEqual([
      { boardSlotId: slotIds[0][0], teamId: teamIds[0], seq: 1 },
      { boardSlotId: slotIds[1][0], teamId: teamIds[0], seq: 2 },
    ]);
    expect(await scoresOf(id)).toEqual([9, 0]);
  });
});

describe("play.nextTeam", () => {
  it("FR-27 (AC3): the passTurn action moves the turn Lag 1 → Lag 2 → Lag 3 → Lag 1, returns the new Team and revalidates both pages; load shows it current", async () => {
    const { id } = await gameIn();
    await play.start(hostId, {
      gameId: id,
      teams: ["Lag 1", "Lag 2", "Lag 3"],
    });
    for (const name of ["Lag 2", "Lag 3", "Lag 1"]) {
      nextCache.revalidatePath.mockClear();
      expect(await passTurn({ gameId: id })).toEqual({
        ok: true,
        data: { team: name },
      });
      expect(nextCache.revalidatePath).toHaveBeenCalledWith(`/spill/${id}`);
      expect(nextCache.revalidatePath).toHaveBeenCalledWith(
        `/spill/${id}/skjerm`,
      );
      const { teams } = await play.load(hostId, id);
      expect(teams.filter((t) => t.current).map((t) => t.name)).toEqual([name]);
    }
  });
});

describe("play.undo and play.nextTeam", () => {
  it.each([
    ["missing", {}],
    ["non-string", { gameId: 1 }],
  ])(
    "FR-26, FR-27: a %s gameId is INVALID_INPUT for both, and nothing is written",
    async (_, input) => {
      const { id, slotIds } = await playing();
      await play.reveal(hostId, {
        gameId: id,
        boardSlotId: slotIds[0][0],
        scored: true,
      });
      const before = [await rowsOf(id), await revealsOf(id)];
      for (const op of [play.undo, play.nextTeam])
        expect(await codeOf(op(hostId, input))).toBe("INVALID_INPUT");
      expect(await undoReveal(input)).toMatchObject({ code: "INVALID_INPUT" });
      expect(await passTurn(input)).toMatchObject({ code: "INVALID_INPUT" });
      expect([await rowsOf(id), await revealsOf(id)]).toEqual(before);
    },
  );

  it.each(["ready"] as const)(
    "FR-26, FR-27: a Game in %s is WRONG_STATE for both, and nothing is written",
    async (state) => {
      const { id, slotIds } = await gameIn(state);
      const input = { gameId: id, boardSlotId: slotIds[0][0] };
      for (const op of [play.undo, play.nextTeam])
        expect(await codeOf(op(hostId, input))).toBe("WRONG_STATE");
      expect(await undoReveal(input)).toMatchObject({
        code: "WRONG_STATE",
      });
      expect(await passTurn({ gameId: id })).toMatchObject({
        code: "WRONG_STATE",
      });
      expect(await rowsOf(id)).toEqual({ state, teams: [], playState: [] });
    },
  );
});

// Seeded PRNG (mulberry32), so a failing sequence can be replayed.
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Score property", () => {
  const SEED = 20261123;
  it(`FR-25, FR-26, FR-27, AD-11 (AC3): over 240 seeded random reveal, undo, next-Team and next-Question steps (seed ${SEED}) on three Teams, every Score equals the model's sum of its scored Counts and the raw SQL sum, and undo with nothing on the current Question is NOTHING_TO_UNDO`, async () => {
    const random = prng(SEED);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];
    const { id, questionIds, slotIds } = await gameIn();
    await play.start(hostId, {
      gameId: id,
      teams: ["Lag 1", "Lag 2", "Lag 3"],
    });
    // The model: Reveals in seq order, the current Question and Team.
    const model: { q: number; i: number; team: number | null }[] = [];
    let q = 0;
    let turn = 0;
    const counts = BOARD.map((slots) => slots.map(([, count]) => count));
    const ops = new Set<string>();
    for (let step = 0; step < 240; step++) {
      const at = `step ${step}`;
      const hidden = counts[q]
        .map((_, i) => i)
        .filter((i) => !model.some((r) => r.q === q && r.i === i));
      let op = pick(["reveal", "reveal", "undo", "next", "question"]);
      // Nothing left to reveal: undo instead, so every step ends in the Score checks.
      if (op === "reveal" && hidden.length === 0) op = "undo";
      if (op === "reveal") {
        const i = pick(hidden);
        const scored = random() < 0.6;
        await play.reveal(hostId, {
          gameId: id,
          boardSlotId: slotIds[q][i],
          scored,
        });
        model.push({ q, i, team: scored ? turn : null });
      } else if (op === "undo") {
        const last = model.findLastIndex((r) => r.q === q);
        const shown = (await play.load(hostId, id)).lastReveal;
        if (last === -1) {
          expect(shown, at).toBeNull();
          const input = { gameId: id, boardSlotId: slotIds[q][0] };
          expect(await codeOf(play.undo(hostId, input)), at).toBe(
            "NOTHING_TO_UNDO",
          );
          ops.add("nothing");
        } else {
          const [r] = model.splice(last, 1);
          expect(shown, at).toBe(slotIds[r.q][r.i]);
          const input = { gameId: id, boardSlotId: shown! };
          expect(await play.undo(hostId, input), at).toMatchObject({
            boardSlotId: slotIds[r.q][r.i],
            count: counts[r.q][r.i],
            team: r.team === null ? null : `Lag ${r.team + 1}`,
          });
        }
      } else if (op === "next") {
        turn = (turn + 1) % 3;
        expect(await play.nextTeam(hostId, { gameId: id }), at).toEqual({
          team: `Lag ${turn + 1}`,
        });
      } else {
        q = (q + 1) % questionIds.length;
        await moveTo(id, questionIds[q]);
      }
      ops.add(op);
      const expected = [0, 1, 2].map((t) =>
        model
          .filter((r) => r.team === t)
          .reduce((sum, r) => sum + counts[r.q][r.i], 0),
      );
      expect(await scoresOf(id), at).toEqual(expected);
      expect(await rawSums(id), at).toEqual(expected);
      expect((await revealsOf(id)).length, at).toBe(model.length);
    }
    // The seed exercises every kind of step.
    expect([...ops].sort()).toEqual(
      ["next", "nothing", "question", "reveal", "undo"].sort(),
    );
  });
});

describe("/spill/[id]/skjerm", () => {
  it("FR-23, UX-DR22: a ready Game shows Team setup with Hvem spiller?, Lag 1 and Lag 2, no Fjern, Legg til lag and Start spillet, titled by the Game", async () => {
    const { id } = await gameIn();
    const html = await screen(id);
    expect(html).toMatch(/<h1[^>]*>Hvem spiller\?<\/h1>/);
    expect(html).toContain('value="Lag 1"');
    expect(html).toContain('value="Lag 2"');
    const shown = text(html);
    expect(shown).toContain("Navn på lag 1");
    expect(shown).toContain("Navn på lag 2");
    expect(shown).toContain("Legg til lag");
    expect(shown).toContain("Start spillet");
    expect(shown).not.toContain("Fjern");
    expect(await screenMetadata(props(id))).toEqual({ title: "Hyttetur" });
    expect(await screenMetadata(props(randomUUID()))).toEqual({
      title: "Vi finner ikke dette spillet",
    });
  });

  it("FR-23: a playing Game shows the stage with the Question, Spørsmål 1 av 3, Svarer nå on Team 1, every Score 0, the controls without Angre and Trykk F for fullskjerm.", async () => {
    const { id } = await gameIn();
    await play.start(hostId, { gameId: id, teams: ["Hyttegjengen", "Lag 2"] });
    const html = await screen(id);
    expect(html).toContain("data-stage");
    expect(html).toContain(`text-tv-question">${QUESTIONS[0]}</h1>`);
    expect(text(html)).toContain(
      "Spørsmål 1 av 3 Svarer nå Hyttegjengen 0 poeng Lag 2 0 poeng 1 2 3 Bom [M] Neste lag [T] Vis resten uten poeng [U] Neste spørsmål [N] ? Trykk F for fullskjerm.",
    );
    // FR-33: a Host-written Game never shows the Question-set credit.
    expect(html).not.toContain(QUESTION_SET_CREDIT);
  });

  it("FR-24, FR-27: the first flush of a playing Game's screen is the stage with Henter spillet …", async () => {
    const { id } = await playing();
    expect(await screenShell(id)).toMatch(
      /<div data-stage=""[^>]*><p role="status" class="animate-appear[^"]*">Henter spillet\u00a0…<\/p><\/div>/,
    );
  });

  it("FR-24, FR-25: the playing screen shows one rank-only tile Avslør plass N per slot, a revealed slot with label and Count, and the real Scores", async () => {
    const { id, slotIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][1],
      scored: true,
    });
    const html = await screen(id);
    expect(html).toContain('aria-label="Avslør plass 1"');
    expect(html).toContain('aria-label="Avslør plass 3"');
    expect(html).not.toContain("Avslør plass 2");
    expect(text(html)).toContain(
      "Svarer nå Lag 1 3 poeng Lag 2 0 poeng 1 2 Ola 3 poeng 3",
    );
  });

  it("FR-24 (AC2): before and after revealing every slot of Question 1, the screen holds only revealed Board labels, never a hidden label, a discarded or below-limit Group or any Answer text", async () => {
    const { id, questionIds, slotIds } = await playing();
    const db = await getDb();
    const [discarded, below] = [randomUUID(), randomUUID()];
    await db.insert(answerGroup).values([
      {
        id: discarded,
        questionId: questionIds[0],
        origin: "host",
        customLabel: "Forkastet gruppe",
        discarded: true,
      },
      {
        id: below,
        questionId: questionIds[0],
        origin: "fallback",
        customLabel: "Under grensa",
      },
    ]);
    const answers = ["kari!!", "OLA ola", "Per-Erik", "Svar uten gruppe"];
    await db.insert(answer).values(
      answers.map((t, i) => ({
        questionId: questionIds[0],
        text: t,
        normalizedText: t.toLowerCase(),
        groupId: i === 0 ? discarded : i === 1 ? below : null,
      })),
    );
    const never = ["Forkastet gruppe", "Under grensa", ...answers];
    const labels = BOARD[0].map(([label]) => label);
    for (let n = 0; n <= labels.length; n++) {
      if (n > 0)
        await play.reveal(hostId, {
          gameId: id,
          boardSlotId: slotIds[0][n - 1],
          scored: true,
        });
      const html = await screen(id);
      for (const label of labels.slice(0, n)) expect(html).toContain(label);
      for (const label of [
        ...labels.slice(n),
        ...BOARD.slice(1)
          .flat()
          .map(([l]) => l),
        ...never,
      ])
        expect(html, `${label} after ${n}`).not.toContain(label);
    }
  });

  it("FR-23: the Question is 56 px (text-tv-question) up to 80 characters and 48 px (text-tv-question-long) above", async () => {
    const { id, questionIds } = await gameIn();
    await play.start(hostId, { gameId: id, teams: ["Lag 1", "Lag 2"] });
    for (const [length, size] of [
      [80, "text-tv-question"],
      [81, "text-tv-question-long"],
    ] as const) {
      const long = "x".repeat(length);
      await (
        await getDb()
      )
        .update(question)
        .set({ text: long })
        .where(eq(question.id, questionIds[0]));
      expect(await screen(id)).toContain(`${size}">${long}</h1>`);
    }
  });

  it.each(["draft", "collecting", "grouping", "in_review"] as const)(
    "FR-23: a Game in %s redirects to the Game page",
    async (state) => {
      const { id } = await gameIn(state);
      await expect(screen(id)).rejects.toEqual(
        new RedirectError(`/spill/${id}`),
      );
    },
  );
});

describe("/spill/[id]/tv", () => {
  it("FR-24, FR-25 (AC1): a playing Game with one revealed slot shows the Question, the revealed label and Count, the Teams and Scores and rank-only hidden tiles, with no control and no hidden label or Count in the markup", async () => {
    const { id, slotIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][1],
      scored: true,
    });
    // Counts long enough to search for, on the two hidden slots (Kari, Per).
    const db = await getDb();
    for (const [slot, count] of [
      [slotIds[0][0], 37],
      [slotIds[0][2], 29],
    ] as const)
      await db.update(boardSlot).set({ count }).where(eq(boardSlot.id, slot));
    const html = await tv(id);
    expect(html).toContain("data-stage");
    // A Reveal made before the TV opened does not replay its animation.
    expect(html).not.toContain("data-revealing");
    for (const count of ["37", "29"])
      expect(html, count).not.toMatch(new RegExp(`>${count}<|${count} poeng`));
    expect(html).toContain(`text-tv-question">${QUESTIONS[0]}</h1>`);
    expect(text(html)).toContain(
      "Spørsmål 1 av 3 Svarer nå Lag 1 3 poeng Lag 2 0 poeng 1 2 Ola 3 poeng 3",
    );
    expect(html).not.toContain("<button");
    for (const control of [
      "Avslør plass",
      "Bom",
      "Angre",
      "Neste lag",
      "uten poeng [U]",
      "Neste spørsmål",
      "Hurtigtaster",
      "Trykk F",
    ])
      expect(visible(html), control).not.toContain(control);
    // Hidden slots of this Question (Kari 5, Per 2) and every later Question's Board.
    for (const hidden of ["Kari", "Per", "Oslo", "Bergen", "Molde"])
      expect(html, hidden).not.toContain(hidden);
  });

  it("FR-23, FR-27, AD-5 (AC3): ready shows Team setup, draft redirects, played shows Sluttstilling with no deletion line or link; titled TV – the Game, or the not-found title for a missing Game", async () => {
    const { id } = await gameIn();
    expect(await tv(id)).toMatch(/<h1[^>]*>Hvem spiller\?<\/h1>/);
    expect(await tvMetadata(props(id))).toEqual({ title: "TV – Hyttetur" });
    expect(await tvMetadata(props(randomUUID()))).toEqual({
      title: "Vi finner ikke dette spillet",
    });
    const draft = await gameIn("draft");
    await expect(tv(draft.id)).rejects.toEqual(
      new RedirectError(`/spill/${draft.id}`),
    );
    const played = await playing();
    await finishGame(played.id);
    const html = await tv(played.id);
    expect(html).toMatch(/<h1 id="sluttstilling"[^>]*>Sluttstilling<\/h1>/);
    expect(text(html)).toContain("Sluttstilling Uavgjort Lag 1 0 poeng");
    for (const host of ["slettes", "Tilbake til spillet", "Trykk F", "<a "])
      expect(visible(html), host).not.toContain(host);
  });

  it("FR-27, AD-17: a last move or a delete that commits between the page's state read and play.load (a poll at the wrong moment) renders /tv again instead of the error page, so the TV shows Sluttstilling", async () => {
    // The error inside the Suspense boundary, as React reports it to Next.
    const lateError = async (page: ReactNode) => {
      const errors: unknown[] = [];
      await prerenderToNodeStream(page, {
        onError: (e) => void errors.push(e),
      });
      return errors;
    };
    const finished = await playing();
    const page = await TvPage(props(finished.id)); // read: playing
    await finishGame(finished.id);
    expect(await lateError(page)).toEqual([
      new RedirectError(`/spill/${finished.id}/tv`),
    ]);
    expect(await tv(finished.id)).toContain(">Sluttstilling</h1>");
    const deleted = await playing();
    const gone = await TvPage(props(deleted.id));
    await games.deleteOwned(hostId, deleted.id);
    expect(await lateError(gone)).toEqual([
      new RedirectError(`/spill/${deleted.id}/tv`),
    ]);
  });
});

describe("/spill/[id]/vert", () => {
  it("FR-24 to FR-27, AD-15 (AC2): a playing Game shows the Question, Spørsmål 1 av 3, every slot's label and Count with Avslør or Avslørt / Uten poeng, the Teams and Scores, and the TV link", async () => {
    const { id, slotIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][1],
      scored: true,
    });
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][2],
      scored: false,
    });
    const html = await hostView(id);
    expect(html).toMatch(
      new RegExp(`<h1[^>]*>${QUESTIONS[0].replace("?", "\\?")}</h1>`),
    );
    expect(html).not.toContain("data-stage");
    expect(html).toContain('aria-label="Avslør plass 1"');
    expect(html).not.toContain("Avslør plass 2");
    const shown = text(html);
    expect(shown).toContain(
      "Spørsmål 1 av 3 Fasit 1 Kari 5 poeng Avslør 2 Ola 3 poeng Avslørt 3 Per 2 poeng Uten poeng",
    );
    expect(shown).toContain(
      "Bom [M] Angre [Z] Neste lag [T] Vis resten uten poeng [U] Neste spørsmål [N]",
    );
    expect(shown).toContain(
      "Lag Svarer nå Lag 1 3 poeng Lag 2 0 poeng Åpne TV-visning i et nytt vindu Trykk F i TV-vinduet for fullskjerm. Bruk TV-en som utvidet skjerm, ikke speilet, ellers ser alle i rommet fasiten.",
    );
    expect(html).toContain(`href="/spill/${id}/tv"`);
    for (const later of ["Oslo", "Bergen", "Molde"])
      expect(html, later).not.toContain(later);
    expect(await hostViewMetadata(props(id))).toEqual({
      title: "Vertsvisning – Hyttetur",
    });
  });

  it("FR-23, FR-27 (AC3): ready shows Team setup, draft redirects, played shows the final standing with the deletion date and Tilbake til spillet", async () => {
    const { id } = await gameIn();
    expect(await hostView(id)).toMatch(/<h1[^>]*>Hvem spiller\?<\/h1>/);
    const draft = await gameIn("draft");
    await expect(hostView(draft.id)).rejects.toEqual(
      new RedirectError(`/spill/${draft.id}`),
    );
    const played = await tiedGame();
    const html = await hostView(played);
    expect(html).not.toContain("data-stage");
    expect(html).toMatch(
      new RegExp(
        `<a [^>]*href="/spill/${played}"[^>]*>Tilbake til spillet</a>`,
      ),
    );
    expect(text(html)).toContain(
      `Sluttstilling Lag 2 7 poeng Lag 3 7 poeng Lag 1 3 poeng Spillet slettes automatisk ${await deleteDate(played)}. Tilbake til spillet`,
    );
  });
});

describe("Game page", () => {
  it("FR-23, FR-24: in ready it links Start spillet to the screen; in playing it shows Spillet er i gang, the Question, each Team with its Score, Fortsett spillet, Åpne TV-visning and Vertsvisning med fasit, and the mirroring warning", async () => {
    const { id } = await gameIn();
    const link = (label: string) =>
      new RegExp(
        `<a class="[^"]*bg-primary[^"]*" href="/spill/${id}/skjerm">${label}</a>`,
      );
    expect(await gamePage(id)).toMatch(link("Start spillet"));
    await play.start(hostId, { gameId: id, teams: ["Hyttegjengen", "Lag 2"] });
    const html = await gamePage(id);
    expect(html).toMatch(link("Fortsett spillet"));
    expect(html).not.toContain("Start spillet");
    expect(text(html)).toContain(
      "Spillet er i gang Spørsmål 1 av 3. Hyttegjengen 0 poeng Lag 2 0 poeng Fortsett spillet Åpne TV-visning i et nytt vindu Vertsvisning med fasit Bruk TV-en som utvidet skjerm, ikke speilet, ellers ser alle i rommet fasiten.",
    );
    // Story 8.5 (AC7): the TV page and the Host view beside the shared screen.
    expect(html).toMatch(
      new RegExp(
        `<a href="/spill/${id}/tv" target="toppsvar-tv"[^>]*>Åpne TV-visning`,
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `<a class="[^"]*" href="/spill/${id}/vert">Vertsvisning med fasit</a>`,
      ),
    );
  });
});

const playedAtOf = async (gameId: string) =>
  (
    await (
      await getDb()
    )
      .select({ playedAt: game.playedAt })
      .from(game)
      .where(eq(game.id, gameId))
  )[0].playedAt;

const deleteDate = async (gameId: string) =>
  formatDate(
    new Date((await playedAtOf(gameId))!.getTime() + RETENTION_PLAYED_MS),
  );

// Plays a Game from playing() through all three Questions to played.
async function finishGame(id: string) {
  for (const position of [1, 2, 3])
    await play.nextQuestion(hostId, { gameId: id, position });
}

// Three Teams with Scores 3, 7, 7 by position: Lag 1 Ola (3), Lag 2 Kari and Per
// (5 + 2), Lag 3 Bergen and Molde (1 + 6). Played to the end unless `finish` is false.
async function tiedGame(finish = true) {
  const { id, slotIds } = await gameIn();
  await play.start(hostId, {
    gameId: id,
    teams: ["Lag 1", "Lag 2", "Lag 3"],
  });
  const reveal = (q: number, i: number) =>
    play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[q][i],
      scored: true,
    });
  await reveal(0, 1);
  await play.nextTeam(hostId, { gameId: id });
  await reveal(0, 0);
  await reveal(0, 2);
  await play.nextQuestion(hostId, { gameId: id, position: 1 });
  await play.nextTeam(hostId, { gameId: id });
  await reveal(1, 1);
  await play.nextQuestion(hostId, { gameId: id, position: 2 });
  await reveal(2, 0);
  if (finish) await play.nextQuestion(hostId, { gameId: id, position: 3 });
  return id;
}

describe("play.nextQuestion", () => {
  it("FR-27, AD-16 (AC1): the nextQuestion action moves Question 1 → 2 → 3 with the current Team unchanged and every new slot hidden, keeps earlier Reveals and Scores, and revalidates both pages", async () => {
    const { id, questionIds, slotIds, teamIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][0],
      scored: true,
    });
    await play.nextTeam(hostId, { gameId: id });
    const reveals = await revealsOf(id);
    for (const q of [1, 2]) {
      nextCache.revalidatePath.mockClear();
      expect(await nextQuestion({ gameId: id, position: q })).toEqual({
        ok: true,
        data: { finished: false, position: q + 1 },
      });
      expect(nextCache.revalidatePath).toHaveBeenCalledWith(`/spill/${id}`);
      expect(nextCache.revalidatePath).toHaveBeenCalledWith(
        `/spill/${id}/skjerm`,
      );
      expect((await rowsOf(id)).playState).toEqual([
        {
          gameId: id,
          currentQuestionId: questionIds[q],
          currentTeamId: teamIds[1],
        },
      ]);
      const view = await play.load(hostId, id);
      expect(view.question).toEqual({ position: q + 1, text: QUESTIONS[q] });
      expect(view.board).toEqual(
        slotIds[q].map((slotId, i) => ({
          id: slotId,
          position: i + 1,
          revealed: false,
        })),
      );
      expect(view.teams.map((t) => [t.score, t.current])).toEqual([
        [5, false],
        [0, true],
      ]);
      expect(await revealsOf(id)).toEqual(reveals);
    }
  });

  it("FR-27, AD-16, AD-23 (AC1): past the last Question the Game is played, played_at is set within the call and deleteAfter is exactly played_at + 30 days; Reveals and Scores are kept", async () => {
    const { id, slotIds } = await playing();
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][0],
      scored: true,
    });
    for (const position of [1, 2])
      await play.nextQuestion(hostId, { gameId: id, position });
    nextCache.revalidatePath.mockClear();
    const before = Date.now();
    const result = await nextQuestion({ gameId: id, position: 3 });
    const after = Date.now();
    const playedAt = (await playedAtOf(id))!;
    expect(playedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(playedAt.getTime()).toBeLessThanOrEqual(after);
    expect(result).toEqual({
      ok: true,
      data: {
        finished: true,
        deleteAfter: new Date(playedAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    expect((await rowsOf(id)).state).toBe("played");
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(`/spill/${id}`);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith(
      `/spill/${id}/skjerm`,
    );
    expect(await rawSums(id)).toEqual([5, 0]);
    expect(await revealsOf(id)).toHaveLength(1);
  });

  it("FR-27, AD-4 (AC1): on the played Game every play operation and action and play.load is WRONG_STATE, and nothing changes", async () => {
    const { id, slotIds } = await playing();
    await finishGame(id);
    const snapshot = async () => [
      await rowsOf(id),
      await revealsOf(id),
      await playedAtOf(id),
    ];
    const before = await snapshot();
    const slot = { gameId: id, boardSlotId: slotIds[2][0], scored: true };
    const next = { gameId: id, position: 3 };
    const start = { gameId: id, teams: ["Lag 1", "Lag 2"] };
    for (const call of [
      () => play.reveal(hostId, slot),
      () => play.undo(hostId, { gameId: id, boardSlotId: slotIds[0][0] }),
      () => play.nextTeam(hostId, { gameId: id }),
      () => play.nextQuestion(hostId, next),
      () => play.start(hostId, start),
      () => play.load(hostId, id),
    ])
      expect(await codeOf(call())).toBe("WRONG_STATE");
    for (const result of [
      await revealSlot(slot),
      await undoReveal({ gameId: id, boardSlotId: slotIds[0][0] }),
      await passTurn({ gameId: id }),
      await nextQuestion(next),
      await startPlay(start),
    ])
      expect(result).toMatchObject({ ok: false, code: "WRONG_STATE" });
    expect(await snapshot()).toEqual(before);
  });

  it.each([1, 3])(
    "FR-27, AD-16: on Question 2 a stale position %i is WRONG_QUESTION, and nothing is written",
    async (position) => {
      const { id } = await playing();
      await play.nextQuestion(hostId, { gameId: id, position: 1 });
      const before = await rowsOf(id);
      const input = { gameId: id, position };
      expect(await codeOf(play.nextQuestion(hostId, input))).toBe(
        "WRONG_QUESTION",
      );
      expect(await nextQuestion(input)).toEqual({
        ok: false,
        code: "WRONG_QUESTION",
        message: "Spillet er på et annet spørsmål nå.",
      });
      expect(await rowsOf(id)).toEqual(before);
      expect(await playedAtOf(id)).toBeNull();
    },
  );

  it("FR-27: a missing gameId or position, a string or a fractional position is INVALID_INPUT, and nothing is written", async () => {
    const { id } = await playing();
    const before = await rowsOf(id);
    for (const input of [
      { position: 1 },
      { gameId: id },
      { gameId: id, position: "1" },
      { gameId: id, position: 1.5 },
    ]) {
      expect(await codeOf(play.nextQuestion(hostId, input))).toBe(
        "INVALID_INPUT",
      );
      expect(await nextQuestion(input)).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
      });
    }
    expect(await rowsOf(id)).toEqual(before);
  });

  it("FR-27: a ready Game is WRONG_STATE, and nothing is written", async () => {
    const { id } = await gameIn();
    const input = { gameId: id, position: 1 };
    expect(await codeOf(play.nextQuestion(hostId, input))).toBe("WRONG_STATE");
    expect(await nextQuestion(input)).toMatchObject({ code: "WRONG_STATE" });
    expect(await rowsOf(id)).toEqual({
      state: "ready",
      teams: [],
      playState: [],
    });
  });
});

describe("play.finalScores", () => {
  it("FR-27, AD-11: Scores 3, 7, 7 by position come back as Lag 2, Lag 3, Lag 1 (ties in position order) with deleteAfter = played_at + 30 days", async () => {
    const id = await tiedGame();
    const { teams, deleteAfter } = await play.finalScores(hostId, id);
    expect(teams.map((t) => [t.name, t.score])).toEqual([
      ["Lag 2", 7],
      ["Lag 3", 7],
      ["Lag 1", 3],
    ]);
    expect(deleteAfter).toEqual(
      new Date((await playedAtOf(id))!.getTime() + RETENTION_PLAYED_MS),
    );
  });

  it("FR-27, AD-4: a playing Game is WRONG_STATE", async () => {
    const id = await tiedGame(false);
    expect(await codeOf(play.finalScores(hostId, id))).toBe("WRONG_STATE");
  });
});

describe("Sluttstilling (AC3)", () => {
  it("FR-27, UX-DR21: the screen of a finished Game shows Sluttstilling, the Teams by Score with Vinner on the top Team, the deletion date and Tilbake til spillet to the Game page", async () => {
    const { id, slotIds } = await playing();
    await play.nextTeam(hostId, { gameId: id });
    await play.reveal(hostId, {
      gameId: id,
      boardSlotId: slotIds[0][0],
      scored: true,
    });
    await finishGame(id);
    const html = await screen(id);
    expect(html).toContain("data-stage");
    expect(html).toMatch(/<h1 id="sluttstilling"[^>]*>Sluttstilling<\/h1>/);
    expect(html).toContain('<ol aria-label="Sluttstilling"');
    expect(html).toMatch(
      new RegExp(`<a [^>]*href="/spill/${id}"[^>]*>Tilbake til spillet</a>`),
    );
    expect(text(html)).toContain(
      `Sluttstilling Vinner Lag 2 5 poeng Lag 1 0 poeng Spillet slettes automatisk ${await deleteDate(id)}. Trykk F for fullskjerm. Tilbake til spillet`,
    );
    expect(text(html)).not.toContain("Uavgjort");
  });

  it("FR-27: a tied top Score shows Uavgjort on each tied Team and no Vinner", async () => {
    const id = await tiedGame();
    const shown = text(await screen(id));
    expect(shown).toContain(
      "Sluttstilling Uavgjort Lag 2 7 poeng Uavgjort Lag 3 7 poeng Lag 1 3 poeng",
    );
    expect(shown).not.toContain("Vinner");
  });

  it("FR-3, FR-27: the Game page of a played Game shows Sluttstilling with each Team and Score, Vis sluttstilling to the screen and the deletion notice 30 days after played_at", async () => {
    const id = await tiedGame();
    const html = await gamePage(id);
    expect(html).toMatch(
      new RegExp(
        `<a class="[^"]*bg-primary[^"]*" href="/spill/${id}/skjerm">Vis sluttstilling</a>`,
      ),
    );
    expect(text(html)).toContain(
      `Sluttstilling Lag 2 7 poeng Lag 3 7 poeng Lag 1 3 poeng Vis sluttstilling Spillet og alle svarene slettes automatisk ${await deleteDate(id)}.`,
    );
    // Static page text, not a status message (EXPERIENCE.md: one polite region per page).
    expect(html).not.toMatch(/role="status"[^>]*>Spillet og alle svarene/);
  });
});
