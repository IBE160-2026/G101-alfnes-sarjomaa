import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { eq, inArray, sql } from "drizzle-orm";
import { PgliteSession } from "drizzle-orm/pglite";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeCollection,
  createInviteLinks,
  deleteGame,
  moveQuestion,
  revokeInviteLink,
} from "@/app/spill/[id]/actions";
import { openInviteLink, submitAnswerSet } from "@/app/svar/[gameId]/actions";
import GamePage from "@/app/spill/[id]/page";
import GamesPage from "@/app/spill/page";
import InviteLinkPage from "@/app/svar/[gameId]/page";
import { ANSWER_MISSING, ANSWER_TOO_LONG } from "@/lib/answer-set";
import { MESSAGES } from "@/lib/errors";
import { GAME_STATES, type GameState } from "@/lib/game-state";
import { LINK_NOT_ACTIVE } from "@/lib/invite-link";
import { FEWER_THAN_3 } from "@/lib/limits";
import { shuffle } from "@/lib/shuffle";
import { newToken, sha256 } from "@/lib/token";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { getDb } from "@/server/db/client";
import {
  answer,
  game,
  groupingResult,
  inviteLink,
  question,
  submission,
} from "@/server/db/schema";
import { env } from "@/server/env";
import * as grouping from "@/server/grouping";
import {
  afterTasks,
  cookieJar,
  NotFoundError,
  RedirectError,
  run,
  runAfterTasks,
} from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

// Lets a test change the Game between submit's lookup and its transaction: ofGame runs
// in that window, so a hook set here runs once right after it.
const race = vi.hoisted(() => ({ hook: null as null | (() => Promise<void>) }));
vi.mock("@/server/questions", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/questions")>();
  return {
    ...real,
    ofGame: async (gameId: string) => {
      const result = await real.ofGame(gameId);
      const hook = race.hook;
      race.hook = null;
      await hook?.();
      return result;
    },
  };
});

// Runs once right after a lockForMutation without hostId (submit's lock), while submit
// still holds the Game lock inside its transaction.
const lockRace = vi.hoisted(() => ({
  hook: null as null | (() => void),
}));
vi.mock("@/server/games", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/games")>();
  return {
    ...real,
    lockForMutation: async (
      ...args: Parameters<typeof real.lockForMutation>
    ) => {
      const row = await real.lockForMutation(...args);
      const hook = lockRace.hook;
      if (hook && args[1].hostId === undefined) {
        lockRace.hook = null;
        hook();
      }
      return row;
    },
  };
});

// Counts the one insertAnswers call per close; the real writer still runs.
vi.mock("@/server/grouping", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/grouping")>();
  return { ...real, insertAnswers: vi.fn(real.insertAnswers) };
});
// The real shuffle, watched, so a test can see that close inserts exactly its output.
vi.mock("@/lib/shuffle", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/shuffle")>();
  return { shuffle: vi.fn(real.shuffle) };
});

const COOKIE = "toppsvar_session";
const TEXTS = [
  "Hva gjør Jonas?",
  "Hvem kommer for sent?",
  "Hvem synger høyest?",
];
const UNKNOWN = {
  ok: false,
  code: "LINK_UNKNOWN",
  message: "Vi finner ikke denne lenken.",
};
const CLOSED = {
  ok: false,
  code: "COLLECTION_CLOSED",
  message: "Innsamlingen er stengt.",
};
const NOT_COLLECTING = GAME_STATES.filter((s) => s !== "collecting");
let session: string;
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "deltaker-side@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  session = cookieJar.store.get(COOKIE)!;
  hostId = (await auth.requireHost()).hostId;
});
beforeEach(() => cookieJar.store.set(COOKIE, session));

// A collecting Game with real Tokens, made through the Host's own action.
async function collectingGame(title = "Hyttetur 2026", count = 3) {
  const db = await getDb();
  const [{ id: gameId }] = await db
    .insert(game)
    .values({ hostId, title })
    .returning({ id: game.id });
  const ids = TEXTS.map(() => randomUUID());
  await db
    .insert(question)
    .values(
      TEXTS.map((text, i) => ({ id: ids[i], gameId, position: i + 1, text })),
    );
  const result = await createInviteLinks({ gameId, count });
  if (!result.ok) throw new Error(result.code);
  const links = result.data.links;
  const tokens = links.map((l) => l.slice(l.indexOf("#") + 1));
  return { gameId, ids, tokens, links };
}

async function setState(gameId: string, state: GameState) {
  await (await getDb()).update(game).set({ state }).where(eq(game.id, gameId));
}

async function revoke(token: string) {
  await (
    await getDb()
  )
    .delete(inviteLink)
    .where(eq(inviteLink.tokenHash, sha256(token)));
}

const render = async (gameId: string) =>
  renderToStaticMarkup(
    await InviteLinkPage({
      params: Promise.resolve({ gameId }),
      searchParams: Promise.resolve({}),
    }),
  );

describe("openInviteLink", () => {
  it("FR-6: a valid link of a collecting Game returns the title and the Questions in position order, and is linkStatus open", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    expect(await collection.linkStatus(gameId)).toBe("open");
    for (const token of tokens)
      expect(await openInviteLink(gameId, token)).toEqual({
        ok: true,
        data: {
          title: "Hyttetur 2026",
          questions: TEXTS.map((text, i) => ({ id: ids[i], text })),
        },
      });
  });

  it("FR-6: the Questions come in position order after a reorder", async () => {
    const db = await getDb();
    const [{ id: gameId }] = await db
      .insert(game)
      .values({ hostId, title: "Omstokket" })
      .returning({ id: game.id });
    const ids = TEXTS.map(() => randomUUID());
    await db
      .insert(question)
      .values(
        TEXTS.map((text, i) => ({ id: ids[i], gameId, position: i + 1, text })),
      );
    await moveQuestion({ gameId, questionId: ids[2], direction: "up" });
    await moveQuestion({ gameId, questionId: ids[2], direction: "up" });
    const created = await createInviteLinks({ gameId, count: 1 });
    if (!created.ok) throw new Error(created.code);
    const token = created.data.links[0].split("#")[1];
    const result = await openInviteLink(gameId, token);
    expect(result.ok && result.data.questions.map((q) => q.text)).toEqual([
      TEXTS[2],
      TEXTS[0],
      TEXTS[1],
    ]);
  });

  it("FR-11: opening is a read: game.updated_at and every row stay unchanged", async () => {
    const { gameId, tokens } = await collectingGame();
    const db = await getDb();
    const before = await db.select().from(game).where(eq(game.id, gameId));
    const links = await db
      .select()
      .from(inviteLink)
      .where(eq(inviteLink.gameId, gameId));
    await openInviteLink(gameId, tokens[0]);
    await openInviteLink(gameId, newToken());
    expect(await db.select().from(game).where(eq(game.id, gameId))).toEqual(
      before,
    );
    expect(
      await db.select().from(inviteLink).where(eq(inviteLink.gameId, gameId)),
    ).toEqual(links);
  });

  it("FR-7, FR-12: only the matching edit secret returns the saved Answers; a wrong, missing or malformed one is identical to an unused link", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const editSecret = newToken();
    const answers = Object.fromEntries(ids.map((id, i) => [id, [`svar ${i}`]]));
    await submitAnswerSet(gameId, tokens[0], { answers, editSecret });
    const unused = await openInviteLink(gameId, tokens[1]);
    expect(unused.ok).toBe(true);
    expect(unused.ok && "answers" in unused.data).toBe(false);

    expect(await openInviteLink(gameId, tokens[0], editSecret)).toEqual({
      ok: true,
      data: { ...(unused.ok && unused.data), answers },
    });
    const misses: [string, unknown][] = [
      ["a wrong secret", newToken()],
      ["no secret", undefined],
      ['"abc"', "abc"],
      ["a number", 7],
      ["the Token itself", tokens[0]],
    ];
    for (const [name, secret] of misses)
      expect(await openInviteLink(gameId, tokens[0], secret), name).toEqual(
        unused,
      );
    expect(await openInviteLink(gameId, tokens[0])).toEqual(unused);
  });

  it("FR-7, FR-12: another link's secret returns no Answers, whether that link has no row or its own", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const answers = Object.fromEntries(ids.map((id) => [id, ["a"]]));
    const secretA = newToken();
    const secretC = newToken();
    await submitAnswerSet(gameId, tokens[0], { answers, editSecret: secretA });
    await submitAnswerSet(gameId, tokens[2], { answers, editSecret: secretC });
    const unused = await openInviteLink(gameId, tokens[1]);
    expect(await openInviteLink(gameId, tokens[1], secretA)).toEqual(unused);
    expect(await openInviteLink(gameId, tokens[2], secretA)).toEqual(unused);
    expect(await openInviteLink(gameId, tokens[0], secretC)).toEqual(unused);
  });

  it("FR-9: a Token of another Game is LINK_UNKNOWN, because lookup is by (token_hash, game_id)", async () => {
    const a = await collectingGame("A");
    const b = await collectingGame("B");
    expect(await openInviteLink(a.gameId, b.tokens[0])).toEqual(UNKNOWN);
  });

  it.each([
    ["a random 43-character Token", newToken()],
    ['"abc"', "abc"],
    ["an empty Token", ""],
    ["a 42-character Token", newToken().slice(1)],
    ["a number", 42],
    ["no Token", undefined],
  ])("FR-9: %s on a collecting Game is LINK_UNKNOWN", async (_, token) => {
    const { gameId } = await collectingGame();
    expect(await openInviteLink(gameId, token)).toEqual(UNKNOWN);
  });

  it("FR-9: a revoked link of a collecting Game is LINK_UNKNOWN, identical to an unknown one", async () => {
    const { gameId, tokens } = await collectingGame();
    await revoke(tokens[0]);
    expect(await openInviteLink(gameId, tokens[0])).toEqual(
      await openInviteLink(gameId, newToken()),
    );
    expect(await openInviteLink(gameId, tokens[0])).toEqual(UNKNOWN);
    expect(await openInviteLink(gameId, tokens[1])).toMatchObject({ ok: true });
  });

  it("FR-3, FR-9: a missing, malformed, non-string or deleted Game is LINK_UNKNOWN and linkStatus unknown", async () => {
    const deleted = await collectingGame("Slettes");
    expect(await run(deleteGame, { gameId: deleted.gameId })).toMatchObject({
      redirect: "/spill",
    });
    for (const gameId of [randomUUID(), "abc", deleted.gameId]) {
      expect(await collection.linkStatus(gameId), gameId).toBe("unknown");
      expect(await openInviteLink(gameId, deleted.tokens[0]), gameId).toEqual(
        UNKNOWN,
      );
    }
    expect(await openInviteLink(123, deleted.tokens[0])).toEqual(UNKNOWN);
    expect(await openInviteLink(undefined, undefined)).toEqual(UNKNOWN);
  });

  it.each(NOT_COLLECTING)(
    "FR-10: in %s every link (real, unknown, revoked, malformed) is COLLECTION_CLOSED and linkStatus closed",
    async (state) => {
      const { gameId, tokens } = await collectingGame();
      await revoke(tokens[1]);
      await setState(gameId, state);
      expect(await collection.linkStatus(gameId)).toBe("closed");
      for (const token of [tokens[0], newToken(), tokens[1], "abc", 7])
        expect(await openInviteLink(gameId, token)).toEqual(CLOSED);
    },
  );
});

describe("the /svar/[gameId] server shell", () => {
  it("FR-11, AD-7: for an open Game it renders no title, Question or Token, only the loader", async () => {
    const { gameId, tokens } = await collectingGame("Hemmelig tittel");
    const html = await render(gameId);
    expect(html).toContain("Henter spørsmålene …");
    expect(html).toContain(">Toppsvar</p>");
    for (const secret of ["Hemmelig tittel", ...TEXTS, ...tokens])
      expect(html).not.toContain(secret);
    expect(html).not.toContain("<a ");
  });

  it("FR-10: for a closed Game it renders the closed copy and no title", async () => {
    const { gameId } = await collectingGame("Stengt spill");
    await setState(gameId, "grouping");
    const html = await render(gameId);
    expect(html).toContain("<h1");
    expect(html).toContain("Innsamlingen er stengt.");
    expect(html).toContain(
      "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres.",
    );
    expect(html).not.toContain("Stengt spill");
  });

  it("FR-3, FR-9: for a missing or malformed Game it calls notFound()", async () => {
    for (const gameId of [randomUUID(), "abc"])
      await expect(render(gameId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("submitAnswerSet", () => {
  // Every Question answered; the first with a blank field between two Answers.
  const fullSet = (ids: string[]) =>
    Object.fromEntries(
      ids.map((id, i) => [id, i === 0 ? [" a ", "", "c"] : [`svar ${i}`]]),
    );

  async function rowsOf(tokens: string[]) {
    return (await getDb())
      .select()
      .from(submission)
      .where(inArray(submission.tokenHash, tokens.map(sha256)));
  }

  const invalid = (fieldErrors: Record<string, string>) => ({
    ok: false,
    code: "INVALID_INPUT",
    message: MESSAGES.INVALID_INPUT,
    fieldErrors,
  });

  it("FR-6, FR-11, AD-8: a first submit stores one row of trimmed Answers in field order and sha256 of the secret, and leaves the game row untouched", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const db = await getDb();
    const before = await db.select().from(game).where(eq(game.id, gameId));
    const editSecret = newToken();
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: fullSet(ids),
        editSecret,
      }),
    ).toEqual({ ok: true, data: null });
    expect(await rowsOf(tokens)).toEqual([
      {
        tokenHash: sha256(tokens[0]),
        answers: {
          [ids[0]]: ["a", "c"],
          [ids[1]]: ["svar 1"],
          [ids[2]]: ["svar 2"],
        },
        editSecretHash: sha256(editSecret),
      },
    ]);
    expect(await db.select().from(game).where(eq(game.id, gameId))).toEqual(
      before,
    );
  });

  it("FR-7, AD-8: a second submit on the same link replaces the set and the secret hash, still one row", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    await submitAnswerSet(gameId, tokens[0], {
      answers: fullSet(ids),
      editSecret: newToken(),
    });
    const editSecret = newToken();
    const answers = Object.fromEntries(ids.map((id) => [id, ["ny"]]));
    expect(
      await submitAnswerSet(gameId, tokens[0], { answers, editSecret }),
    ).toEqual({ ok: true, data: null });
    expect(await rowsOf(tokens)).toEqual([
      {
        tokenHash: sha256(tokens[0]),
        answers,
        editSecretHash: sha256(editSecret),
      },
    ]);
  });

  it("FR-7, AD-8: a same-device resubmit and then a submit from a device without the secret each replace the one row; the old secret then gets no Answers, the new one the new set", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const first = newToken();
    const second = newToken();
    await submitAnswerSet(gameId, tokens[0], {
      answers: fullSet(ids),
      editSecret: first,
    });
    const edited = Object.fromEntries(ids.map((id) => [id, ["endret"]]));
    await submitAnswerSet(gameId, tokens[0], {
      answers: edited,
      editSecret: first,
    });
    expect(await rowsOf(tokens)).toEqual([
      {
        tokenHash: sha256(tokens[0]),
        answers: edited,
        editSecretHash: sha256(first),
      },
    ]);
    const reopened = await openInviteLink(gameId, tokens[0], first);
    expect(reopened.ok && reopened.data.answers).toEqual(edited);

    const answers = Object.fromEntries(ids.map((id) => [id, ["annen enhet"]]));
    expect(
      await submitAnswerSet(gameId, tokens[0], { answers, editSecret: second }),
    ).toEqual({ ok: true, data: null });
    expect(await rowsOf(tokens)).toEqual([
      { tokenHash: sha256(tokens[0]), answers, editSecretHash: sha256(second) },
    ]);
    const unused = await openInviteLink(gameId, tokens[1]);
    expect(await openInviteLink(gameId, tokens[0], first)).toEqual(unused);
    const opened = await openInviteLink(gameId, tokens[0], second);
    expect(opened.ok && opened.data.answers).toEqual(answers);
  });

  it("FR-7, FR-6: an edit that leaves a Question with no Answer is refused, and the saved row is unchanged", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const editSecret = newToken();
    await submitAnswerSet(gameId, tokens[0], {
      answers: fullSet(ids),
      editSecret,
    });
    const before = await rowsOf(tokens);
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: { ...fullSet(ids), [ids[1]]: ["", " "] },
        editSecret,
      }),
    ).toEqual(invalid({ [ids[1]]: ANSWER_MISSING }));
    expect(await rowsOf(tokens)).toEqual(before);
    expect(before).toHaveLength(1);
  });

  it("FR-6: a missing key or a Question with only blank fields is Skriv minst ett svar., and nothing is stored", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const editSecret = newToken();
    const withoutSecond = fullSet(ids);
    delete withoutSecond[ids[1]];
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: withoutSecond,
        editSecret,
      }),
    ).toEqual(invalid({ [ids[1]]: ANSWER_MISSING }));
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: { ...fullSet(ids), [ids[2]]: ["", "   "] },
        editSecret,
      }),
    ).toEqual(invalid({ [ids[2]]: ANSWER_MISSING }));
    expect(await rowsOf(tokens)).toEqual([]);
  });

  it("FR-6: an Answer of 81 trimmed characters at field 1 is refused under that field; 80 is accepted", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const editSecret = newToken();
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: { ...fullSet(ids), [ids[0]]: ["a", "x".repeat(81)] },
        editSecret,
      }),
    ).toEqual(invalid({ [`${ids[0]}.1`]: ANSWER_TOO_LONG }));
    expect(await rowsOf(tokens)).toEqual([]);
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: { ...fullSet(ids), [ids[0]]: ["a", ` ${"x".repeat(80)} `] },
        editSecret,
      }),
    ).toEqual({ ok: true, data: null });
  });

  it("FR-6: six Answers, an unknown Question ID, a malformed set, and a missing or malformed edit secret are INVALID_INPUT with no row", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const editSecret = newToken();
    const cases: [string, unknown][] = [
      [
        "six Answers",
        {
          answers: { ...fullSet(ids), [ids[0]]: Array(6).fill("a") },
          editSecret,
        },
      ],
      [
        "an unknown Question ID",
        { answers: { ...fullSet(ids), [randomUUID()]: ["a"] }, editSecret },
      ],
      ["answers not an object", { answers: "a", editSecret }],
      [
        "a value not an array",
        { answers: { ...fullSet(ids), [ids[0]]: "a" }, editSecret },
      ],
      ["no edit secret", { answers: fullSet(ids) }],
      [
        "a 42-character secret",
        { answers: fullSet(ids), editSecret: editSecret.slice(1) },
      ],
      ["a number as secret", { answers: fullSet(ids), editSecret: 7 }],
      ["no input", undefined],
    ];
    for (const [name, input] of cases)
      expect(
        await submitAnswerSet(gameId, tokens[0], input),
        name,
      ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      await submitAnswerSet(gameId, tokens[0], { answers: fullSet(ids) }),
    ).toEqual(invalid({ editSecret: MESSAGES.INVALID_INPUT }));
    expect(await rowsOf(tokens)).toEqual([]);
  });

  it("FR-9: a non-string, malformed, unknown, foreign or revoked Token and a missing or malformed Game are LINK_UNKNOWN with no row", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const other = await collectingGame("Annet spill");
    await revoke(tokens[1]);
    const input = { answers: fullSet(ids), editSecret: newToken() };
    const cases: [string, unknown, unknown][] = [
      ["a number", gameId, 42],
      ['"abc"', gameId, "abc"],
      ["an unknown Token", gameId, newToken()],
      ["another Game's Token", gameId, other.tokens[0]],
      ["a revoked Token", gameId, tokens[1]],
      ["a random UUID Game", randomUUID(), tokens[0]],
      ['an "abc" Game', "abc", tokens[0]],
      ["a non-string Game", 7, tokens[0]],
    ];
    for (const [name, g, t] of cases)
      expect(await submitAnswerSet(g, t, input), name).toEqual(UNKNOWN);
    expect(await rowsOf([...tokens, ...other.tokens])).toEqual([]);
  });

  it.each(NOT_COLLECTING)(
    "FR-10: in %s a submit is COLLECTION_CLOSED with no row",
    async (state) => {
      const { gameId, ids, tokens } = await collectingGame();
      await setState(gameId, state);
      expect(
        await submitAnswerSet(gameId, tokens[0], {
          answers: fullSet(ids),
          editSecret: newToken(),
        }),
      ).toEqual(CLOSED);
      expect(await rowsOf(tokens)).toEqual([]);
    },
  );

  it.each([
    ["revoked", "LINK_UNKNOWN"],
    ["deleted", "LINK_UNKNOWN"],
    ["closed", "COLLECTION_CLOSED"],
  ] as const)(
    "FR-9, FR-10: a link %s between the lookup and the lock is %s with no row",
    async (change, code) => {
      const { gameId, ids, tokens } = await collectingGame();
      race.hook = async () => {
        if (change === "revoked") await revoke(tokens[0]);
        else if (change === "closed") await setState(gameId, "grouping");
        else await (await getDb()).delete(game).where(eq(game.id, gameId));
      };
      expect(
        await submitAnswerSet(gameId, tokens[0], {
          answers: fullSet(ids),
          editSecret: newToken(),
        }),
      ).toEqual(code === "LINK_UNKNOWN" ? UNKNOWN : CLOSED);
      expect(race.hook).toBeNull();
      expect(await rowsOf(tokens)).toEqual([]);
    },
  );

  it("FR-9, AD-8: deleting the invite_link row (revoke) removes its submission by cascade", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    for (const token of tokens.slice(0, 2))
      await submitAnswerSet(gameId, token, {
        answers: fullSet(ids),
        editSecret: newToken(),
      });
    await revoke(tokens[0]);
    expect((await rowsOf(tokens)).map((r) => r.tokenHash)).toEqual([
      sha256(tokens[1]),
    ]);
  });
});

describe("progress", () => {
  const FEWER = FEWER_THAN_3;
  const setOf = (ids: string[], answer = "svar") =>
    Object.fromEntries(ids.map((id) => [id, [answer]]));

  // Returns the edit secret, so the same device can change its set later.
  async function send(
    gameId: string,
    ids: string[],
    token: string,
    editSecret = newToken(),
    answer = "svar",
  ) {
    const result = await submitAnswerSet(gameId, token, {
      answers: setOf(ids, answer),
      editSecret,
    });
    if (!result.ok) throw new Error(result.code);
    return editSecret;
  }

  const progressOf = (gameId: string) => collection.progress(hostId, gameId);

  it("FR-8: 4 links and no sets give active 4, issued 4 and fewer-than-3", async () => {
    const { gameId } = await collectingGame("Ingen svar", 4);
    expect(await progressOf(gameId)).toEqual({
      active: 4,
      issued: 4,
      submissions: FEWER,
    });
  });

  it("FR-8: one and two sets are fewer-than-3, three and four are exact, and a changed set does not count twice", async () => {
    const { gameId, ids, tokens } = await collectingGame("Fire svar", 4);
    const counts = [];
    const secrets = [];
    for (const token of tokens) {
      secrets.push(await send(gameId, ids, token));
      counts.push((await progressOf(gameId)).submissions);
    }
    expect(counts).toEqual([FEWER, FEWER, 3, 4]);
    await send(gameId, ids, tokens[0], secrets[0], "nytt svar");
    expect(await progressOf(gameId)).toEqual({
      active: 4,
      issued: 4,
      submissions: 4,
    });
  });

  it("FR-8: a deleted link with a set lowers active and the count, back to fewer-than-3, but not issued", async () => {
    const { gameId, ids, tokens } = await collectingGame("Under tre", 4);
    for (const token of tokens.slice(0, 3)) await send(gameId, ids, token);
    await revoke(tokens[0]);
    expect(await progressOf(gameId)).toEqual({
      active: 3,
      issued: 4,
      submissions: FEWER,
    });
  });

  it("FR-8, FR-9: after a real revoke active stays, issued grows and the count drops with the revoked set", async () => {
    const { gameId, ids, tokens, links } = await collectingGame("Ekte", 4);
    for (const token of tokens) await send(gameId, ids, token);
    expect((await revokeInviteLink({ gameId, link: links[0] })).ok).toBe(true);
    expect(await progressOf(gameId)).toEqual({
      active: 4,
      issued: 5,
      submissions: 3,
    });
    expect((await revokeInviteLink({ gameId, link: links[1] })).ok).toBe(true);
    expect(await progressOf(gameId)).toEqual({
      active: 4,
      issued: 6,
      submissions: FEWER,
    });
  });

  it("FR-8, AD-17: a draft Game has active 0, issued 0 and fewer-than-3, and its page has no Innsamling section or refresh", async () => {
    const [{ id: gameId }] = await (
      await getDb()
    )
      .insert(game)
      .values({ hostId, title: "Utkast" })
      .returning({ id: game.id });
    expect(await progressOf(gameId)).toEqual({
      active: 0,
      issued: 0,
      submissions: FEWER,
    });
    const html = renderToStaticMarkup(
      await GamePage({
        params: Promise.resolve({ id: gameId }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain("Lag invitasjonslenker");
    expect(html).not.toContain("Innsamling");
    expect(html).not.toContain("svar mottatt");
  });

  it("FR-12, FR-8: submitting or changing a set changes no Host-visible value, updated_at and the Game list included, except the count from three", async () => {
    const { gameId, ids, tokens } = await collectingGame("Ingen spor", 4);
    const db = await getDb();
    const snapshot = async () => ({
      page: renderToStaticMarkup(
        await GamePage({
          params: Promise.resolve({ id: gameId }),
          searchParams: Promise.resolve({}),
        }),
      ),
      list: renderToStaticMarkup(await GamesPage()),
      row: await db.select().from(game).where(eq(game.id, gameId)),
    });
    const text = (html: string) => html.replace(/<[^>]*>/g, "");

    const before = await snapshot();
    expect(text(before.page)).toContain("færre enn 3 av 4 svar mottatt");
    expect(before.page).toContain(
      "Du ser bare antallet, aldri hvem som har svart.",
    );
    for (const banned of ["aria-live", 'role="status"', "progressbar"])
      expect(before.page).not.toContain(banned);

    const first = await send(gameId, ids, tokens[0]);
    expect(await snapshot()).toEqual(before);
    await send(gameId, ids, tokens[0], first, "endret");
    expect(await snapshot()).toEqual(before);
    await send(gameId, ids, tokens[1]);
    expect(await snapshot()).toEqual(before);

    const third = await send(gameId, ids, tokens[2]);
    const after = await snapshot();
    // From three the count and the close control change (FR-10), nothing else.
    const withoutClose = (html: string) =>
      html.replace(
        /(aldri hvem som har svart\.<\/p>)[\s\S]*?<\/section>/,
        "$1",
      );
    expect({ ...after, page: withoutClose(after.page) }).toEqual({
      ...before,
      page: withoutClose(before.page).replace("færre enn 3", "3"),
    });
    expect(text(after.page)).toContain("3 av 4 svar mottatt");
    expect(before.page).toContain('aria-disabled="true"');
    expect(after.page).not.toContain('aria-disabled="true"');
    expect(after.page).toContain("Stenge innsamlingen?");

    await send(gameId, ids, tokens[2], third, "endret igjen");
    expect(await snapshot()).toEqual(after);
  });
});

describe("revokeInviteLink", () => {
  const INACTIVE = {
    ok: false,
    code: "LINK_UNKNOWN",
    message: "Vi finner ikke denne lenken.",
    fieldErrors: { link: LINK_NOT_ACTIVE },
  };
  const tokenOf = (link: string) => link.slice(link.indexOf("#") + 1);

  // Every row and value a revoke may touch, so "nothing changes" is one toEqual.
  async function snapshot(gameId: string) {
    const db = await getDb();
    const [row] = await db.select().from(game).where(eq(game.id, gameId));
    const links = (
      await db
        .select({ tokenHash: inviteLink.tokenHash })
        .from(inviteLink)
        .where(eq(inviteLink.gameId, gameId))
    )
      .map((r) => r.tokenHash)
      .sort();
    const sets = (
      await db
        .select({ tokenHash: submission.tokenHash })
        .from(submission)
        .innerJoin(inviteLink, eq(inviteLink.tokenHash, submission.tokenHash))
        .where(eq(inviteLink.gameId, gameId))
    )
      .map((r) => r.tokenHash)
      .sort();
    return { row, links, sets };
  }

  async function sendSet(gameId: string, ids: string[], token: string) {
    const answers = Object.fromEntries(ids.map((id) => [id, ["svar"]]));
    const result = await submitAnswerSet(gameId, token, {
      answers,
      editSecret: newToken(),
    });
    if (!result.ok) throw new Error(result.code);
  }

  it("FR-9: a used and an unused link give the same response and the same row changes, and the new link opens", async () => {
    const { gameId, ids, tokens, links } = await collectingGame("Erstatt", 3);
    await sendSet(gameId, ids, tokens[0]);
    const results = [];
    for (const i of [0, 1]) {
      const before = await snapshot(gameId);
      expect(before.links).toContain(sha256(tokens[i]));
      const result = await revokeInviteLink({ gameId, link: links[i] });
      expect(result).toEqual({
        ok: true,
        data: {
          link: expect.stringMatching(
            new RegExp(`/svar/${gameId}#[A-Za-z0-9_-]{43}$`),
          ),
        },
      });
      if (!result.ok) throw new Error(result.code);
      const fresh = tokenOf(result.data.link);
      expect(fresh).not.toBe(tokens[i]);
      const after = await snapshot(gameId);
      expect(after.links).toEqual(
        [
          ...before.links.filter((h) => h !== sha256(tokens[i])),
          sha256(fresh),
        ].sort(),
      );
      expect(after.row.inviteLinksIssued).toBe(
        before.row.inviteLinksIssued + 1,
      );
      expect(after.sets).toEqual([]);
      expect(await openInviteLink(gameId, tokens[i])).toEqual(UNKNOWN);
      expect(await openInviteLink(gameId, fresh)).toEqual({
        ok: true,
        data: {
          title: "Erstatt",
          questions: TEXTS.map((text, j) => ({ id: ids[j], text })),
        },
      });
      results.push({ ...result, data: { link: "" } });
    }
    expect(results[0]).toEqual(results[1]);
    // A revoked link submits exactly like one that never existed.
    expect(
      await submitAnswerSet(gameId, tokens[0], {
        answers: Object.fromEntries(ids.map((id) => [id, ["svar"]])),
        editSecret: newToken(),
      }),
    ).toEqual(UNKNOWN);
    const db = await getDb();
    expect(
      await db
        .select()
        .from(submission)
        .where(eq(submission.tokenHash, sha256(tokens[0]))),
    ).toEqual([]);
  });

  it("FR-9: surrounding whitespace, another origin, a trailing slash and a query string still match the link", async () => {
    const { gameId, tokens } = await collectingGame("Annen vert", 2);
    for (const link of [
      `  http://192.168.1.20:3000/svar/${gameId}#${tokens[0]}\n`,
      `http://localhost:3000/svar/${gameId}/?fbclid=x#${tokens[1]}`,
    ])
      expect((await revokeInviteLink({ gameId, link })).ok, link).toBe(true);
    for (const token of tokens)
      expect(await openInviteLink(gameId, token)).toEqual(UNKNOWN);
  });

  it("FR-9, AD-5: a malformed paste, another Game's link, this Game's Token behind another Game's path, and an already revoked link are the same inline LINK_UNKNOWN and change nothing", async () => {
    const a = await collectingGame("Spill A", 2);
    const b = await collectingGame("Spill B", 2);
    expect(
      (await revokeInviteLink({ gameId: a.gameId, link: a.links[1] })).ok,
    ).toBe(true);
    const before = { a: await snapshot(a.gameId), b: await snapshot(b.gameId) };
    for (const link of [
      "abc",
      "",
      "   ",
      42,
      a.tokens[0],
      a.links[0].slice(0, -1),
      a.links[0].replace("#", "/"),
      `${a.links[0]}x`,
      b.links[0],
      a.links[0].replace(`/svar/${a.gameId}`, `/svar/${b.gameId}`),
      a.links[1],
    ])
      expect(
        await revokeInviteLink({ gameId: a.gameId, link }),
        String(link),
      ).toEqual(INACTIVE);
    expect({
      a: await snapshot(a.gameId),
      b: await snapshot(b.gameId),
    }).toEqual(before);
    expect((await openInviteLink(b.gameId, b.tokens[0])).ok).toBe(true);
    expect((await openInviteLink(a.gameId, a.tokens[0])).ok).toBe(true);
  });

  it('FR-9: at 50 issued a valid active link and "abc" are LINK_CAP_REACHED (cap before link), nothing changes and the old link still opens', async () => {
    const { gameId, tokens, links } = await collectingGame("Fullt", 2);
    await (
      await getDb()
    )
      .update(game)
      .set({ inviteLinksIssued: 50 })
      .where(eq(game.id, gameId));
    const before = await snapshot(gameId);
    for (const link of [links[0], "abc"])
      expect(await revokeInviteLink({ gameId, link }), link).toEqual({
        ok: false,
        code: "LINK_CAP_REACHED",
        message: "Spillet har nådd maks 50 lenker.",
      });
    expect(await snapshot(gameId)).toEqual(before);
    expect((await openInviteLink(gameId, tokens[0])).ok).toBe(true);
  });

  it.each(NOT_COLLECTING)(
    "FR-9: in %s it is WRONG_STATE and changes nothing",
    async (state) => {
      const { gameId, links } = await collectingGame(`Fase ${state}`, 2);
      await setState(gameId, state);
      const before = await snapshot(gameId);
      expect(await revokeInviteLink({ gameId, link: links[0] })).toEqual({
        ok: false,
        code: "WRONG_STATE",
        message: MESSAGES.WRONG_STATE,
      });
      expect(await snapshot(gameId)).toEqual(before);
    },
  );

  it("FR-1, FR-9: logged out it redirects to /logg-inn and writes nothing", async () => {
    const { gameId, links } = await collectingGame("Utlogget", 2);
    const before = await snapshot(gameId);
    cookieJar.store.clear();
    const error = await revokeInviteLink({ gameId, link: links[0] }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RedirectError);
    expect((error as RedirectError).url).toBe("/logg-inn");
    expect(await snapshot(gameId)).toEqual(before);
  });

  it("FR-9: the collecting Game page has the Erstatt en tapt lenke panel; a draft page does not", async () => {
    const page = async (id: string) =>
      renderToStaticMarkup(
        await GamePage({
          params: Promise.resolve({ id }),
          searchParams: Promise.resolve({}),
        }),
      );
    const { gameId } = await collectingGame("Med panel", 1);
    const collecting = await page(gameId);
    expect(collecting).toContain("Erstatt en tapt lenke");
    expect(collecting).toContain("Lim inn lenken");
    expect(collecting).toContain("Trekk tilbake og lag ny");
    const [{ id: draftId }] = await (
      await getDb()
    )
      .insert(game)
      .values({ hostId, title: "Uten panel" })
      .returning({ id: game.id });
    const draft = await page(draftId);
    expect(draft).not.toContain("Erstatt en tapt lenke");
    expect(draft).not.toContain("Lim inn lenken");
  });
});

describe("INTERNAL", () => {
  it.each([
    { op: "openInviteLink", table: "invite_link" },
    { op: "submit", table: "submission" },
    { op: "revokeInviteLink", table: "invite_link" },
  ] as const)(
    "AD-17, FR-11: $op with $table renamed is INTERNAL and logs one line with only module, op, code and sqlstate, no Token, secret, link, Answer or gameId",
    async ({ op, table }) => {
      const { gameId, ids, tokens, links } =
        await collectingGame("Feil i basen");
      const editSecret = newToken();
      const answers = Object.fromEntries(
        ids.map((id, i) => [id, [`svar ${i + 1}`]]),
      );
      const call = {
        openInviteLink: () => openInviteLink(gameId, tokens[0], editSecret),
        submit: () =>
          submitAnswerSet(gameId, tokens[0], { answers, editSecret }),
        revokeInviteLink: () => revokeInviteLink({ gameId, link: links[0] }),
      }[op];
      const db = await getDb();
      await db.execute(sql.raw(`alter table ${table} rename to ${table}_x`));
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      let result, out;
      try {
        result = await call();
      } finally {
        out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
        write.mockRestore();
        await db.execute(sql.raw(`alter table ${table}_x rename to ${table}`));
      }
      expect(result).toEqual({
        ok: false,
        code: "INTERNAL",
        message: "Noe gikk galt hos oss. Prøv igjen om litt.",
      });
      const lines = out.trimEnd().split("\n");
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toEqual({
        module: "collection",
        op,
        code: "INTERNAL",
        sqlstate: "42P01",
      });
      for (const secret of [
        tokens[0],
        sha256(tokens[0]),
        editSecret,
        sha256(editSecret),
        links[0],
        "svar 1",
        gameId,
      ])
        expect(out).not.toContain(secret);
    },
  );

  it.each(["openInviteLink", "submit"] as const)(
    "FR-11, AD-17: a driver error from %s carrying the Token, edit secret, their hashes and an Answer in message, detail, query, parameters and cause is INTERNAL with one bare log line, and no secret reaches the result, stdout, stderr or console",
    async (op) => {
      const { gameId, ids, tokens } = await collectingGame("Hemmelig feil");
      const token = tokens[0];
      const editSecret = newToken();
      const answer = "Tante Gerd i badekaret";
      const answers = Object.fromEntries(ids.map((id) => [id, [answer]]));
      const secrets = [
        token,
        sha256(token),
        editSecret,
        sha256(editSecret),
        answer,
      ];
      const carried = secrets.join(" ");
      const failure = Object.assign(new Error(`check failed: ${carried}`), {
        code: "23514",
        detail: carried,
        query: `insert into submission values (${carried})`,
        parameters: secrets,
        cause: new Error(carried),
      });
      const call =
        op === "openInviteLink"
          ? () => openInviteLink(gameId, token, editSecret)
          : () => submitAnswerSet(gameId, token, { answers, editSecret });

      // Both entry points' second getDb() select is linkExists in resolveLink, outside any
      // nested module boundary (the first is games.find, which logs as "games").
      const db = await getDb();
      const realSelect = db.select.bind(db);
      const select = vi
        .spyOn(db, "select")
        .mockImplementationOnce(realSelect)
        .mockImplementationOnce(() => {
          throw failure;
        });
      const captured: string[] = [];
      const streams = [process.stderr, process.stdout].map((stream) =>
        vi.spyOn(stream, "write").mockImplementation((chunk) => {
          captured.push(String(chunk));
          return true;
        }),
      );
      const consoles = (
        [
          "log",
          "info",
          "warn",
          "error",
          "debug",
          "trace",
          "dir",
          "table",
        ] as const
      ).map((method) =>
        vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
          captured.push(inspect(args, { depth: Infinity }));
        }),
      );
      let result, calls;
      try {
        result = await call();
      } finally {
        calls = select.mock.calls.length;
        for (const spy of [select, ...streams, ...consoles]) spy.mockRestore();
      }
      expect(calls).toBe(2);
      expect(result).toEqual({
        ok: false,
        code: "INTERNAL",
        message: "Noe gikk galt hos oss. Prøv igjen om litt.",
      });
      const out = captured.join("");
      const lines = out.trimEnd().split("\n");
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toEqual({
        module: "collection",
        op,
        code: "INTERNAL",
        sqlstate: "23514",
      });
      const resultJson = JSON.stringify(result);
      for (const secret of secrets) {
        expect(out).not.toContain(secret);
        expect(resultJson).not.toContain(secret);
      }
    },
  );
});

describe("close", () => {
  const V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const TOO_FEW = {
    ok: false,
    code: "TOO_FEW_ANSWER_SETS",
    message: MESSAGES.TOO_FEW_ANSWER_SETS,
  };

  // Set k answers Question j with n texts that name k, j and the field.
  const setOf = (ids: string[], k: number, n = 2) =>
    Object.fromEntries(
      ids.map((id, j) => [
        id,
        Array.from({ length: n }, (_, f) => `S${k} Q${j} F${f + 1}`),
      ]),
    );

  async function send(gameId: string, token: string, answers: object) {
    const result = await submitAnswerSet(gameId, token, {
      answers,
      editSecret: newToken(),
    });
    if (!result.ok) throw new Error(result.code);
  }

  async function answersOf(ids: string[]) {
    return (await getDb())
      .select()
      .from(answer)
      .where(inArray(answer.questionId, ids));
  }

  // Everything close may change, for one Game.
  async function snapshot(gameId: string, tokens: string[], ids: string[]) {
    const db = await getDb();
    return {
      game: (await db.select().from(game).where(eq(game.id, gameId)))[0],
      links: await db
        .select()
        .from(inviteLink)
        .where(eq(inviteLink.gameId, gameId)),
      sets: await db
        .select()
        .from(submission)
        .where(inArray(submission.tokenHash, tokens.map(sha256))),
      answers: await answersOf(ids),
    };
  }

  it.each([0, 1, 2])(
    "FR-10, FR-8: with %i Answer sets close is TOO_FEW_ANSWER_SETS and nothing changes, updated_at included",
    async (n) => {
      const { gameId, ids, tokens } = await collectingGame("For få", 3);
      for (let k = 0; k < n; k++) await send(gameId, tokens[k], setOf(ids, k));
      const before = await snapshot(gameId, tokens, ids);
      afterTasks.length = 0;
      expect(await closeCollection({ gameId })).toEqual(TOO_FEW);
      expect(afterTasks, "a refused close queues no Grouping run").toEqual([]);
      expect(await snapshot(gameId, tokens, ids)).toEqual(before);
      expect(before.game.state).toBe("collecting");
      expect(before.sets).toHaveLength(n);
    },
  );

  it("FR-10, FR-13, FR-17: close writes one row per Answer with rank, text and normalized_text, one fresh key per set and Question, v4 ids, deletes this Game's links and sets only, and moves it to grouping with the lease", async () => {
    const { gameId, ids, tokens } = await collectingGame("Stenges", 4);
    const other = await collectingGame("Står åpent", 3);
    for (let k = 0; k < 3; k++)
      await send(other.gameId, other.tokens[k], setOf(other.ids, k));
    const otherBefore = await snapshot(other.gameId, other.tokens, other.ids);
    for (let k = 0; k < 2; k++) await send(gameId, tokens[k], setOf(ids, k));
    await send(gameId, tokens[2], {
      ...setOf(ids, 2),
      [ids[0]]: ["  Kari  Nordmann!! ", "ÆRLIG TALT …"],
    });
    vi.mocked(grouping.insertAnswers).mockClear();
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const t0 = Date.now();
    let result, logged;
    try {
      result = await closeCollection({ gameId });
    } finally {
      logged = write.mock.calls.length;
      write.mockRestore();
    }
    const t1 = Date.now();
    expect(result).toEqual({ ok: true });
    // The VACUUM succeeded, so nothing was logged.
    expect(logged).toBe(0);
    expect(grouping.insertAnswers).toHaveBeenCalledTimes(1);

    const rows = await answersOf(ids);
    expect(rows).toHaveLength(3 * 3 * 2);
    for (const row of rows) expect(row.id).toMatch(V4);
    expect(rows.map((r) => r.text).sort()).toEqual(
      [
        ...[0, 1].flatMap((k) =>
          ids.flatMap((_, j) => [`S${k} Q${j} F1`, `S${k} Q${j} F2`]),
        ),
        "Kari  Nordmann!!",
        "ÆRLIG TALT …",
        ...[1, 2].flatMap((j) => [`S2 Q${j} F1`, `S2 Q${j} F2`]),
      ].sort(),
    );
    const byText = new Map(rows.map((r) => [r.text, r]));
    expect(byText.get("Kari  Nordmann!!")).toMatchObject({
      rank: 1,
      normalizedText: "kari nordmann",
      questionId: ids[0],
    });
    expect(byText.get("ÆRLIG TALT …")).toMatchObject({
      rank: 2,
      normalizedText: "ærlig talt",
    });
    expect(byText.get("S1 Q2 F2")).toMatchObject({
      rank: 2,
      normalizedText: "s1 q2 f2",
      questionId: ids[2],
    });
    // Each key covers exactly one set's Answers to one Question, and no key repeats.
    const keys = new Map<string, typeof rows>();
    for (const row of rows) {
      expect(row.contributorKey).toMatch(V4);
      keys.set(row.contributorKey!, [
        ...(keys.get(row.contributorKey!) ?? []),
        row,
      ]);
    }
    expect(keys.size).toBe(9);
    for (const group of keys.values()) {
      expect(group).toHaveLength(2);
      expect(new Set(group.map((r) => r.questionId)).size).toBe(1);
      expect(group.map((r) => r.rank).sort()).toEqual([1, 2]);
    }

    const after = await snapshot(gameId, tokens, ids);
    expect(after.links).toEqual([]);
    expect(after.sets).toEqual([]);
    expect(after.game.state).toBe("grouping");
    const lease = after.game.groupingLeaseUntil!.getTime();
    expect(lease).toBeGreaterThanOrEqual(t0 + 180_000);
    expect(lease).toBeLessThanOrEqual(t1 + 180_000);
    expect(await snapshot(other.gameId, other.tokens, other.ids)).toEqual(
      otherBefore,
    );
  });

  it("FR-13, AD-9: close shuffles all of the Game's rows once and inserts exactly the shuffled array", async () => {
    const { gameId, ids, tokens } = await collectingGame("Stokket", 3);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k, 5));
    vi.mocked(shuffle).mockClear();
    vi.mocked(grouping.insertAnswers).mockClear();
    // A known permutation, so an insert of the unshuffled rows (or a sorted copy) fails.
    vi.mocked(shuffle).mockImplementationOnce((items) => [...items].reverse());
    expect(await closeCollection({ gameId })).toEqual({ ok: true });
    expect(shuffle).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shuffle).mock.calls[0][0]).toHaveLength(45);
    const shuffled = vi.mocked(shuffle).mock.results[0].value;
    expect(grouping.insertAnswers).toHaveBeenCalledWith(
      expect.anything(),
      shuffled,
    );
    expect(vi.mocked(grouping.insertAnswers).mock.calls[0][1]).toBe(shuffled);
  });

  it("FR-10, FR-11: a failing VACUUM still closes, and logs one line with only module, op, code and sqlstate", async () => {
    const { gameId, ids, tokens } = await collectingGame("Vakuum feiler", 3);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    const db = await getDb();
    const execute = vi
      .spyOn(db, "execute")
      .mockRejectedValueOnce(
        Object.assign(new Error("S0 Q0 F1 hemmelig"), { code: "55P03" }),
      );
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let result, out, calls;
    try {
      result = await closeCollection({ gameId });
    } finally {
      out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
      calls = execute.mock.calls.length;
      write.mockRestore();
      execute.mockRestore();
    }
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(1);
    const lines = out.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      module: "collection",
      op: "vacuum",
      code: "INTERNAL",
      sqlstate: "55P03",
    });
    for (const secret of ["S0 Q0 F1", gameId, ...tokens, sha256(tokens[0])])
      expect(out).not.toContain(secret);
    expect((await snapshot(gameId, tokens, ids)).game.state).toBe("grouping");
  });

  it("FR-13, AD-9: a VACUUM that skips the tables (run by a role that does not own them) still closes, and logs one VACUUM_SKIPPED line", async () => {
    const { gameId, ids, tokens } = await collectingGame(
      "Vakuum hoppes over",
      3,
    );
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    const db = await getDb();
    await db.execute(sql`create role vacuum_skip`);
    // Not ALL, which includes MAINTAIN (the right to VACUUM) since Postgres 17.
    await db.execute(
      sql`grant select, insert, update, delete on all tables in schema public to vacuum_skip`,
    );
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let result, out;
    try {
      await db.execute(sql`set role vacuum_skip`);
      result = await closeCollection({ gameId });
    } finally {
      await db.execute(sql`reset role`);
      out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
      write.mockRestore();
    }
    expect(result).toEqual({ ok: true });
    expect(
      out
        .trimEnd()
        .split("\n")
        .map((l) => JSON.parse(l)),
    ).toEqual([{ module: "collection", op: "vacuum", code: "VACUUM_SKIPPED" }]);
    expect((await snapshot(gameId, tokens, ids)).game.state).toBe("grouping");
  });

  it("FR-10, FR-9: after close every former link, one revoked before close included, is closed in openInviteLink, linkStatus and the shell, and a late submit is COLLECTION_CLOSED with no row", async () => {
    const { gameId, ids, tokens } = await collectingGame("Etter stenging", 5);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    await revoke(tokens[4]);
    expect(await closeCollection({ gameId })).toEqual({ ok: true });
    const before = await answersOf(ids);
    for (const token of tokens)
      expect(await openInviteLink(gameId, token), token).toEqual(CLOSED);
    expect(await collection.linkStatus(gameId)).toBe("closed");
    const html = await render(gameId);
    expect(html).toContain("Innsamlingen er stengt.");
    expect(html).not.toContain("Etter stenging");
    for (const token of [tokens[0], tokens[3]])
      expect(
        await submitAnswerSet(gameId, token, {
          answers: setOf(ids, 9),
          editSecret: newToken(),
        }),
      ).toEqual(CLOSED);
    expect(await answersOf(ids)).toEqual(before);
    expect((await snapshot(gameId, tokens, ids)).sets).toEqual([]);
  });

  it("FR-10: a close committed between submit's lookup and its lock refuses the submit with COLLECTION_CLOSED, and its set is not among the Answers", async () => {
    const { gameId, ids, tokens } = await collectingGame("Kappløp 1", 4);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    let closing: Promise<void> | undefined;
    race.hook = async () => {
      closing = collection.close(hostId, { gameId });
      await closing;
    };
    expect(
      await submitAnswerSet(gameId, tokens[3], {
        answers: setOf(ids, 3),
        editSecret: newToken(),
      }),
    ).toEqual(CLOSED);
    expect(race.hook).toBeNull();
    await expect(closing).resolves.toBeUndefined();
    const rows = await answersOf(ids);
    expect(rows).toHaveLength(18);
    expect(rows.some((r) => r.text.startsWith("S3 "))).toBe(false);
    expect((await snapshot(gameId, tokens, ids)).game.state).toBe("grouping");
  });

  it("FR-10: a close started while submit holds the Game lock waits for it, and the submitted set is among the closed Answers", async () => {
    const { gameId, ids, tokens } = await collectingGame("Kappløp 4", 4);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    let closing: Promise<void> | undefined;
    lockRace.hook = () => {
      closing = collection.close(hostId, { gameId });
    };
    expect(
      await submitAnswerSet(gameId, tokens[3], {
        answers: setOf(ids, 3),
        editSecret: newToken(),
      }),
    ).toEqual({ ok: true, data: null });
    expect(lockRace.hook).toBeNull();
    expect(closing).toBeDefined();
    await expect(closing).resolves.toBeUndefined();
    const rows = await answersOf(ids);
    expect(rows).toHaveLength(24);
    expect(rows.filter((r) => r.text.startsWith("S3 "))).toHaveLength(6);
  });

  it("FR-15, AD-9, AD-12 (AC6): the grouping panel shows progress; past the lease it adds the slow-state sentence and queues one resume, which finishes Grouping", async () => {
    const { gameId, ids, tokens } = await collectingGame("Treg gruppering", 3);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    expect(await closeCollection({ gameId })).toEqual({ ok: true });
    // Leave close's own run queued but unrun, as if it had died.
    afterTasks.length = 0;
    const SLOW =
      "Grupperingen tar lengre tid enn vanlig. Siden oppdateres av seg selv. Stopper grupperingen, fortsetter den der den slapp.";
    const page = async () =>
      renderToStaticMarkup(
        await GamePage({
          params: Promise.resolve({ id: gameId }),
          searchParams: Promise.resolve({}),
        }),
      );
    const text = (html: string) => html.replace(/<[^>]*>/g, "");
    const fresh = await page();
    expect(fresh).toContain("Det tar vanligvis under to minutter.");
    expect(fresh.replace(/<[^>]*>/g, "")).toContain("0 av 3 spørsmål ferdig");
    expect(text(fresh)).not.toContain(SLOW);
    expect(fresh).not.toContain('role="status"');
    expect(afterTasks).toHaveLength(0);
    await (
      await getDb()
    )
      .update(game)
      .set({ groupingLeaseUntil: sql`now() - interval '1 second'` })
      .where(eq(game.id, gameId));
    const slow = await page();
    expect(text(slow)).toContain(SLOW);
    // A warning Notice: announced once as a status, never told to reload a page that polls.
    expect(slow).toMatch(
      /<div role="status" class="[^"]*bg-warning-soft[^"]*">/,
    );
    expect(text(slow)).not.toContain("Last inn siden");
    expect(afterTasks).toHaveLength(1);
    await runAfterTasks();
    const [row] = await (
      await getDb()
    )
      .select({ state: game.state })
      .from(game)
      .where(eq(game.id, gameId));
    expect(row.state).toBe("in_review");
  });

  // The six distinct texts per Question are six Judge Groups with the mock, and six
  // fallback Groups per Question with replay, which finds no data/rulings here.
  it.each([
    { provider: "mock", key: undefined, reason: null, proposed: 18, fell: 0 },
    {
      provider: "replay",
      key: undefined,
      reason: "NO_KEY",
      proposed: 0,
      fell: 3,
    },
    {
      provider: "replay",
      key: "test-key",
      reason: "NO_STORED_RULING",
      proposed: 0,
      fell: 3,
    },
  ] as const)(
    "FR-15, FR-17 (AC6): grouped by $provider with fallback reason $reason, the in review page shows the summary numbers and never claims a missing key, with or without Demo mode",
    async ({ provider, key, reason, proposed, fell }) => {
      const { gameId, ids, tokens } = await collectingGame(
        "Ferdig gruppert",
        3,
      );
      for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
      expect(await closeCollection({ gameId })).toEqual({ ok: true });
      const judgeEnv = {
        provider: env.JUDGE_PROVIDER,
        key: env.OPENROUTER_API_KEY,
      };
      try {
        env.JUDGE_PROVIDER = provider;
        env.OPENROUTER_API_KEY = key;
        await runAfterTasks();
      } finally {
        env.JUDGE_PROVIDER = judgeEnv.provider;
        env.OPENROUTER_API_KEY = judgeEnv.key;
      }
      const reasons = await (
        await getDb()
      )
        .select({ reason: groupingResult.fallbackReason })
        .from(groupingResult)
        .where(inArray(groupingResult.questionId, ids));
      expect(reasons).toEqual(ids.map(() => ({ reason })));
      const page = async () =>
        renderToStaticMarkup(
          await GamePage({
            params: Promise.resolve({ id: gameId }),
            searchParams: Promise.resolve({}),
          }),
        );
      const saved = env.DEMO_MODE;
      try {
        for (const demo of [false, true]) {
          env.DEMO_MODE = demo;
          const html = await page();
          expect(html.replace(/<[^>]*>/g, "")).toContain(
            "Grupperingen er ferdig" +
              "Spørsmål i alt3" +
              `Grupper foreslått${proposed}` +
              `Spørsmål å gruppere for hånd${fell}`,
          );
          expect(html).toContain("Til gjennomgang");
          expect(html).not.toContain("Ingen KI-nøkkel");
          expect(html).not.toContain("Grupperer");
        }
      } finally {
        env.DEMO_MODE = saved;
      }
    },
  );

  it("FR-10, FR-17: the dialog's no-key sentence shows only with neither a model key nor Demo mode", async () => {
    const { gameId, ids, tokens } = await collectingGame("Nøkkel", 3);
    for (let k = 0; k < 3; k++) await send(gameId, tokens[k], setOf(ids, k));
    const page = async () =>
      renderToStaticMarkup(
        await GamePage({
          params: Promise.resolve({ id: gameId }),
          searchParams: Promise.resolve({}),
        }),
      );
    const NO_KEY = "Ingen KI-nøkkel er satt opp";
    const saved = { key: env.OPENROUTER_API_KEY, demo: env.DEMO_MODE };
    try {
      expect(await page()).toContain(NO_KEY);
      env.OPENROUTER_API_KEY = "test-key";
      expect(await page()).not.toContain(NO_KEY);
      env.OPENROUTER_API_KEY = undefined;
      env.DEMO_MODE = true;
      expect(await page()).not.toContain(NO_KEY);
    } finally {
      env.OPENROUTER_API_KEY = saved.key;
      env.DEMO_MODE = saved.demo;
    }
  });

  // shortcut: PGlite runs one transaction at a time, so the race tests above pass even without the row lock; this pins the lock's SQL until Story 7.3's real-Postgres CI job runs the races for real.
  it("FR-10, FR-9, AD-9: close, submit and revoke each lock the Game row with a select that ends in for update", async () => {
    const { gameId, ids, tokens, links } = await collectingGame("Låsen", 4);
    const lockSelects = async (run: () => Promise<unknown>) => {
      const prepare = vi.spyOn(PgliteSession.prototype, "prepareQuery");
      try {
        await run();
        return prepare.mock.calls
          .map(([query]) => query.sql)
          .filter((q) => /^select .* from "game" where /s.test(q));
      } finally {
        prepare.mockRestore();
      }
    };
    const LOCK = expect.stringMatching(/ for update$/);
    for (const k of [0, 1, 2])
      expect(
        await lockSelects(() => send(gameId, tokens[k], setOf(ids, k))),
      ).toContainEqual(LOCK);
    expect(
      await lockSelects(() => revokeInviteLink({ gameId, link: links[3] })),
    ).toContainEqual(LOCK);
    expect(await lockSelects(() => closeCollection({ gameId }))).toContainEqual(
      LOCK,
    );
  });
});
