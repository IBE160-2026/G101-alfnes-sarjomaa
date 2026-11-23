import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startPlay } from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import ScreenPage, {
  generateMetadata as screenMetadata,
} from "@/app/spill/[id]/skjerm/page";
import { DomainError } from "@/lib/errors";
import type { GameState } from "@/lib/game-state";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { game, playState, question, team } from "@/server/db/schema";
import * as games from "@/server/games";
import * as play from "@/server/play";
import { cookieJar, nextCache, RedirectError } from "./next-mocks";

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

// A Game in `state` with three Questions (inserted out of order, so start must sort).
// Play reads no Board in this story, so none is written.
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
  return { id, questionIds: ids };
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
const screen = async (id: string) =>
  renderToStaticMarkup(await ScreenPage(props(id)));
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

  it.each(["draft", "collecting", "grouping", "in_review", "played"] as const)(
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

  it("FR-23: a playing Game shows the stage with the Question, Spørsmål 1 av 3, Svarer nå on Team 1, every Score 0 and Trykk F for fullskjerm.", async () => {
    const { id } = await gameIn();
    await play.start(hostId, { gameId: id, teams: ["Hyttegjengen", "Lag 2"] });
    const html = await screen(id);
    expect(html).toContain("data-stage");
    expect(html).toContain(`text-tv-question">${QUESTIONS[0]}</h1>`);
    expect(text(html)).toContain(
      "Spørsmål 1 av 3 Svarer nå Hyttegjengen 0 poeng Lag 2 0 poeng Trykk F for fullskjerm.",
    );
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

  it.each(["draft", "collecting", "grouping", "in_review", "played"] as const)(
    "FR-23: a Game in %s redirects to the Game page",
    async (state) => {
      const { id } = await gameIn(state);
      await expect(screen(id)).rejects.toEqual(
        new RedirectError(`/spill/${id}`),
      );
    },
  );
});

describe("Game page", () => {
  it("FR-23: in ready it links Start spillet to the screen; in playing it shows Spillet er i gang, the Question, each Team with its Score and Fortsett spillet", async () => {
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
      "Spillet er i gang Spørsmål 1 av 3. Hyttegjengen 0 poeng Lag 2 0 poeng Fortsett spillet",
    );
  });
});
