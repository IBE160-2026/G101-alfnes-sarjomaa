import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import {
  GAME_STATES,
  PERMITTED,
  type GameState,
  type Operation,
} from "@/lib/game-state";
import { getDb, type Tx } from "@/server/db/client";
import * as collection from "@/server/collection";
import {
  game,
  groupingResult,
  host,
  inviteLink,
  playState,
  question,
} from "@/server/db/schema";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";
import * as play from "@/server/play";
import * as questions from "@/server/questions";
import * as review from "@/server/review";
import { sqlRows } from "./driver";

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
      return sqlRows<{ xmax: string }>(result)[0].xmax;
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

describe("questions in a non-draft Game", () => {
  it("FR-4, AD-4: save (new and existing id), move and remove are WRONG_STATE in every state but draft, and no Question changes", async () => {
    await setState("draft");
    const [a, b] = [randomUUID(), randomUUID()];
    await questions.save(hostId, { gameId, questionId: a, text: "Første" });
    await questions.save(hostId, { gameId, questionId: b, text: "Andre" });
    const snapshot = async () =>
      (await getDb())
        .select()
        .from(question)
        .where(eq(question.gameId, gameId))
        .orderBy(asc(question.position));
    const before = await snapshot();
    expect(before).toHaveLength(2);

    for (const state of GAME_STATES.filter((s) => s !== "draft")) {
      await setState(state);
      for (const [name, op] of [
        [
          "save new",
          () =>
            questions.save(hostId, {
              gameId,
              questionId: randomUUID(),
              text: "Ny",
            }),
        ],
        [
          "save existing",
          () =>
            questions.save(hostId, { gameId, questionId: a, text: "Endret" }),
        ],
        [
          "move",
          () =>
            questions.move(hostId, { gameId, questionId: b, direction: "up" }),
        ],
        ["remove", () => questions.remove(hostId, { gameId, questionId: a })],
      ] as const)
        expect(await codeOf(op()), `${name} in ${state}`).toBe("WRONG_STATE");
      expect(await snapshot(), state).toEqual(before);
    }
  });
});

describe("Invite links after collecting", () => {
  it("FR-5, AD-4: createInviteLinks is WRONG_STATE in every state after collecting, and nothing changes", async () => {
    await setState("draft");
    await questions.save(hostId, {
      gameId,
      questionId: randomUUID(),
      text: "Hvem?",
    });
    const db = await getDb();
    const links = () =>
      db.select().from(inviteLink).where(eq(inviteLink.gameId, gameId));
    const before = await links();
    for (const state of GAME_STATES.filter(
      (s) => s !== "draft" && s !== "collecting",
    )) {
      await setState(state);
      const issued = (await row()).inviteLinksIssued;
      expect(
        await codeOf(
          collection.createInviteLinks(hostId, { gameId, count: 1 }),
        ),
        state,
      ).toBe("WRONG_STATE");
      expect(await row(), state).toMatchObject({
        state,
        updatedAt: T0,
        inviteLinksIssued: issued,
      });
      expect(await links(), state).toEqual(before);
    }
  });
});

describe("close outside collecting", () => {
  it("FR-10, AD-4: closeCollection is WRONG_STATE in every state but collecting, and nothing changes, updated_at included", async () => {
    const db = await getDb();
    const links = () =>
      db.select().from(inviteLink).where(eq(inviteLink.gameId, gameId));
    const before = await links();
    for (const state of GAME_STATES.filter((s) => s !== "collecting")) {
      await setState(state);
      const snapshot = await row();
      expect(await codeOf(collection.close(hostId, { gameId })), state).toBe(
        "WRONG_STATE",
      );
      expect(await row(), state).toEqual(snapshot);
      expect(snapshot.updatedAt).toEqual(T0);
      expect(await links(), state).toEqual(before);
    }
  });
});

// AC2: every real entry point of every Operation, in every state. "Refused" differs by
// kind on purpose: Host actions throw WRONG_STATE, Participant link actions show the link
// as closed (COLLECTION_CLOSED), and Grouping stops without a trace (no grouping_result).
// Inside a permitted state any outcome except INTERNAL or a crash counts; the module tests
// cover that behaviour.
type Entry = {
  name: string;
  kind: "host" | "participant" | "grouping";
  call: (gameId: string, questionId: string) => Promise<unknown>;
};
const BAD_TOKEN = "A".repeat(43);
const ENTRY_POINTS: Record<Operation, Entry[]> = {
  editQuestions: [
    {
      name: "questions.save",
      kind: "host",
      call: (gameId, questionId) =>
        questions.save(hostId, { gameId, questionId, text: "Endret" }),
    },
    {
      name: "questions.move",
      kind: "host",
      call: (gameId, questionId) =>
        questions.move(hostId, { gameId, questionId, direction: "down" }),
    },
    {
      name: "questions.remove",
      kind: "host",
      call: (gameId, questionId) =>
        questions.remove(hostId, { gameId, questionId }),
    },
  ],
  createInviteLinks: [
    {
      name: "collection.createInviteLinks",
      kind: "host",
      call: (gameId) =>
        collection.createInviteLinks(hostId, { gameId, count: 1 }),
    },
  ],
  revokeInviteLink: [
    {
      name: "collection.revokeInviteLink",
      kind: "host",
      call: (gameId) =>
        collection.revokeInviteLink(hostId, {
          gameId,
          link: `http://localhost/svar/${gameId}#${BAD_TOKEN}`,
        }),
    },
  ],
  openInviteLink: [
    {
      name: "collection.openInviteLink",
      kind: "participant",
      call: (gameId) => collection.openInviteLink(gameId, BAD_TOKEN),
    },
  ],
  submitAnswers: [
    {
      name: "collection.submit",
      kind: "participant",
      call: (gameId, questionId) =>
        collection.submit(gameId, BAD_TOKEN, {
          editSecret: BAD_TOKEN,
          answers: { [questionId]: ["Svar"] },
        }),
    },
  ],
  closeCollection: [
    {
      name: "collection.close",
      kind: "host",
      call: (gameId) => collection.close(hostId, { gameId }),
    },
  ],
  writeGrouping: [
    { name: "grouping.run", kind: "grouping", call: grouping.run },
    {
      name: "grouping.resumeIfStale",
      kind: "grouping",
      call: grouping.resumeIfStale,
    },
  ],
  editReview: [
    {
      name: "review.merge",
      kind: "host",
      call: (gameId) =>
        review.merge(hostId, {
          gameId,
          groupIds: [randomUUID(), randomUUID()],
        }),
    },
    {
      name: "review.moveAnswers",
      kind: "host",
      call: (gameId) =>
        review.moveAnswers(hostId, { gameId, answerIds: [randomUUID()] }),
    },
    {
      name: "review.rename",
      kind: "host",
      call: (gameId) =>
        review.rename(hostId, { gameId, groupId: randomUUID(), label: "Ny" }),
    },
    {
      name: "review.discard",
      kind: "host",
      call: (gameId) =>
        review.discard(hostId, { gameId, groupId: randomUUID() }),
    },
    {
      name: "review.restore",
      kind: "host",
      call: (gameId) =>
        review.restore(hostId, { gameId, groupId: randomUUID() }),
    },
    {
      name: "review.setReviewed",
      kind: "host",
      call: (gameId, questionId) =>
        review.setReviewed(hostId, { gameId, questionId, reviewed: true }),
    },
  ],
  confirmBoard: [
    {
      name: "review.confirmBoard",
      kind: "host",
      call: (gameId) => review.confirmBoard(hostId, { gameId }),
    },
  ],
  startPlay: [
    {
      name: "play.start",
      kind: "host",
      call: (gameId) => play.start(hostId, { gameId, teams: ["Rød", "Blå"] }),
    },
  ],
  playMove: [
    {
      name: "play.reveal",
      kind: "host",
      call: (gameId) =>
        play.reveal(hostId, {
          gameId,
          boardSlotId: randomUUID(),
          scored: true,
        }),
    },
    {
      name: "play.undo",
      kind: "host",
      call: (gameId) =>
        play.undo(hostId, { gameId, boardSlotId: randomUUID() }),
    },
    {
      name: "play.nextTeam",
      kind: "host",
      call: (gameId) => play.nextTeam(hostId, { gameId }),
    },
    {
      name: "play.nextQuestion",
      kind: "host",
      call: (gameId) => play.nextQuestion(hostId, { gameId, position: 1 }),
    },
  ],
  // play.nextQuestion past the last Question finishes the Game under playMove's lock, so
  // play_state is moved to the last Question first (a no-op where there is none).
  finishPlay: [
    {
      name: "play.nextQuestion (finish)",
      kind: "host",
      call: async (gameId) => {
        const db = await getDb();
        const [last] = await db
          .select({ id: question.id })
          .from(question)
          .where(and(eq(question.gameId, gameId), eq(question.position, 2)));
        await db
          .update(playState)
          .set({ currentQuestionId: last.id })
          .where(eq(playState.gameId, gameId));
        return play.nextQuestion(hostId, { gameId, position: 2 });
      },
    },
  ],
  deleteGame: [
    {
      name: "games.deleteOwned",
      kind: "host",
      call: (gameId) => games.deleteOwned(hostId, gameId),
    },
  ],
};

// A fresh Game per call, so no call's side effects reach the next one. Play states go
// through the real play.start, so play_state exists as it would.
async function gameIn(state: GameState) {
  const { id } = await games.create(hostId, { title: "Matrise" });
  const questionId = randomUUID();
  await questions.save(hostId, { gameId: id, questionId, text: "Hvem?" });
  await questions.save(hostId, {
    gameId: id,
    questionId: randomUUID(),
    text: "Hva?",
  });
  const playing = state === "playing" || state === "played";
  const set = (to: GameState) =>
    getDb().then((db) =>
      db
        .update(game)
        .set({ state: to, groupingLeaseUntil: T0 })
        .where(eq(game.id, id)),
    );
  await set(playing ? "ready" : state);
  if (playing) {
    await play.start(hostId, { gameId: id, teams: ["Rød", "Blå"] });
    if (state === "played") await set("played");
  }
  return { id, questionId };
}

async function attempt(entry: Entry, state: GameState) {
  const { id, questionId } = await gameIn(state);
  const outcome = await codeOf(entry.call(id, questionId));
  if (entry.kind !== "grouping")
    return {
      outcome,
      refused:
        outcome ===
        (entry.kind === "host" ? "WRONG_STATE" : "COLLECTION_CLOSED"),
    };
  const results = await (
    await getDb()
  )
    .select()
    .from(groupingResult)
    .where(eq(groupingResult.questionId, questionId));
  // The silent stop: it returns, and a crash or INTERNAL is never a refusal.
  return { outcome, refused: outcome === "ok" && results.length === 0 };
}

describe("the permitted-operations table against the real operations", () => {
  it("AD-4: every Operation has at least one entry point", () => {
    for (const op of Object.keys(PERMITTED) as Operation[])
      expect(ENTRY_POINTS[op].length, op).toBeGreaterThan(0);
  });

  it.each(Object.keys(PERMITTED) as Operation[])(
    "AD-4: every entry point of %s is refused exactly outside its permitted states, and inside them ends in ok or another DomainError",
    async (op) => {
      for (const entry of ENTRY_POINTS[op])
        for (const state of GAME_STATES) {
          const { outcome, refused } = await attempt(entry, state);
          const label = `${entry.name} in ${state}: ${String(outcome)}`;
          if (!PERMITTED[op].includes(state)) {
            expect(refused, label).toBe(true);
            continue;
          }
          // Allowed means "ok" or a DomainError other than the refusal, never INTERNAL
          // or a crash.
          expect(refused, label).toBe(false);
          expect(
            typeof outcome === "string" && outcome !== "INTERNAL",
            label,
          ).toBe(true);
        }
    },
  );
});
