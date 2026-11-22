import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInviteLinks,
  deleteGame,
  moveQuestion,
} from "@/app/spill/[id]/actions";
import { openInviteLink, submitAnswerSet } from "@/app/svar/[gameId]/actions";
import InviteLinkPage from "@/app/svar/[gameId]/page";
import { ANSWER_MISSING, ANSWER_TOO_LONG } from "@/lib/answer-set";
import { MESSAGES } from "@/lib/errors";
import { GAME_STATES, type GameState } from "@/lib/game-state";
import { newToken, sha256 } from "@/lib/token";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { getDb } from "@/server/db/client";
import { game, inviteLink, question, submission } from "@/server/db/schema";
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
  const tokens = result.data.links.map((l) => l.slice(l.indexOf("#") + 1));
  return { gameId, ids, tokens };
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

  it("AD-17, FR-11: with invite_link renamed it is INTERNAL and logs one line with only module, op, code and sqlstate", async () => {
    const { gameId, tokens } = await collectingGame();
    const db = await getDb();
    await db.execute(sql`alter table invite_link rename to invite_link_x`);
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let result, out;
    try {
      result = await openInviteLink(gameId, tokens[0]);
    } finally {
      out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
      write.mockRestore();
      await db.execute(sql`alter table invite_link_x rename to invite_link`);
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
      op: "openInviteLink",
      code: "INTERNAL",
      sqlstate: "42P01",
    });
    for (const secret of [tokens[0], sha256(tokens[0]), gameId])
      expect(out).not.toContain(secret);
  });
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

  it("AD-17, FR-11: with submission renamed it is INTERNAL and logs one line with no Token, hash, secret or Answer", async () => {
    const { gameId, ids, tokens } = await collectingGame();
    const editSecret = newToken();
    const db = await getDb();
    await db.execute(sql`alter table submission rename to submission_x`);
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let result, out;
    try {
      result = await submitAnswerSet(gameId, tokens[0], {
        answers: fullSet(ids),
        editSecret,
      });
    } finally {
      out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
      write.mockRestore();
      await db.execute(sql`alter table submission_x rename to submission`);
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
      op: "submit",
      code: "INTERNAL",
      sqlstate: "42P01",
    });
    for (const secret of [
      tokens[0],
      sha256(tokens[0]),
      editSecret,
      sha256(editSecret),
      "svar 1",
      gameId,
    ])
      expect(out).not.toContain(secret);
  });
});
