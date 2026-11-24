import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createInviteLinks } from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import type { GameState } from "@/lib/game-state";
import { sha256 } from "@/lib/token";
import * as auth from "@/server/auth";
import { sqlstateOf } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import { game, inviteLink, question } from "@/server/db/schema";
import { cookieJar, RedirectError } from "./next-mocks";
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
const COUNT = "Skriv et tall fra 1 til 50.";
let token: string;
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "lenker@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  token = cookieJar.store.get(COOKIE)!;
  hostId = (await auth.requireHost()).hostId;
});
beforeEach(() => cookieJar.store.set(COOKIE, token));

async function newGame({
  state = "draft",
  texts = ["Hva gjør Jonas?", "Hvem kommer for sent?"],
  issued = 0,
}: { state?: GameState; texts?: string[]; issued?: number } = {}) {
  const db = await getDb();
  const [{ id }] = await db
    .insert(game)
    .values({
      hostId,
      title: "Lenkespill",
      state,
      inviteLinksIssued: issued,
      createdAt: T0,
      updatedAt: T0,
    })
    .returning({ id: game.id });
  if (texts.length)
    await db.insert(question).values(
      texts.map((text, i) => ({
        id: randomUUID(),
        gameId: id,
        position: i + 1,
        text,
      })),
    );
  return id;
}

async function snapshot(gameId: string) {
  const db = await getDb();
  const [g] = await db.select().from(game).where(eq(game.id, gameId));
  const links = await db
    .select()
    .from(inviteLink)
    .where(eq(inviteLink.gameId, gameId));
  return {
    state: g.state,
    issued: g.inviteLinksIssued,
    updatedAt: g.updatedAt,
    hashes: links.map((l) => l.tokenHash).sort(),
  };
}

const tokenOf = (link: string) => link.slice(link.indexOf("#") + 1);

async function ok(gameId: string, count: number) {
  const result = await createInviteLinks({ gameId, count });
  if (!result.ok) throw new Error(`expected ok, got ${result.code}`);
  return result.data.links;
}

describe("createInviteLinks", () => {
  it("FR-5: the first batch in draft returns N full links, stores only sha256(token) per link, opens Collection and counts N", async () => {
    const gameId = await newGame();
    const links = await ok(gameId, 3);
    expect(links).toHaveLength(3);
    for (const link of links)
      expect(link).toMatch(
        new RegExp(`^http://localhost:3000/svar/${gameId}#[A-Za-z0-9_-]{43}$`),
      );
    const after = await snapshot(gameId);
    expect(after.state).toBe("collecting");
    expect(after.issued).toBe(3);
    expect(after.hashes).toEqual(links.map((l) => sha256(tokenOf(l))).sort());
    expect(after.updatedAt.getTime()).toBeGreaterThan(T0.getTime());

    // The table has exactly the two columns.
    const result = await (
      await getDb()
    ).execute(
      sql`select column_name::text as name from information_schema.columns where table_name = 'invite_link' order by name`,
    );
    expect(sqlRows<{ name: string }>(result).map((r) => r.name)).toEqual([
      "game_id",
      "token_hash",
    ]);
  });

  it("FR-5: in collecting more links are added without a transition", async () => {
    const gameId = await newGame();
    await ok(gameId, 3);
    const links = await ok(gameId, 2);
    expect(links).toHaveLength(2);
    const after = await snapshot(gameId);
    expect(after.state).toBe("collecting");
    expect(after.issued).toBe(5);
    expect(after.hashes).toHaveLength(5);
  });

  it("FR-5: with zero Questions in draft it is QUESTIONS_REQUIRED and nothing changes", async () => {
    const gameId = await newGame({ texts: [] });
    const before = await snapshot(gameId);
    expect(await createInviteLinks({ gameId, count: 3 })).toEqual({
      ok: false,
      code: "QUESTIONS_REQUIRED",
      message: "Skriv minst ett spørsmål først.",
    });
    expect(await snapshot(gameId)).toEqual(before);
  });

  it("FR-5: at 48 issued, 3 more is LINK_CAP_REACHED with nothing created, 2 reach 50, then 1 more is LINK_CAP_REACHED", async () => {
    const gameId = await newGame({ state: "collecting", issued: 48 });
    const CAP = {
      ok: false,
      code: "LINK_CAP_REACHED",
      message: "Spillet har nådd maks 50 lenker.",
    };
    expect(await createInviteLinks({ gameId, count: 3 })).toEqual(CAP);
    expect(await snapshot(gameId)).toMatchObject({ issued: 48, hashes: [] });
    expect(await ok(gameId, 2)).toHaveLength(2);
    expect((await snapshot(gameId)).issued).toBe(50);
    expect(await createInviteLinks({ gameId, count: 1 })).toEqual(CAP);
    expect(await snapshot(gameId)).toMatchObject({ issued: 50 });
    expect((await snapshot(gameId)).hashes).toHaveLength(2);
  });

  it("FR-5: revoked links stay counted: with 50 issued and every row deleted it is still LINK_CAP_REACHED", async () => {
    const gameId = await newGame();
    await ok(gameId, 50);
    await (
      await getDb()
    )
      .delete(inviteLink)
      .where(eq(inviteLink.gameId, gameId));
    const result = await createInviteLinks({ gameId, count: 1 });
    expect(result).toMatchObject({ ok: false, code: "LINK_CAP_REACHED" });
    expect(await snapshot(gameId)).toMatchObject({ issued: 50, hashes: [] });
  });

  it.each([
    ["0", 0],
    ["51", 51],
    ["1.5", 1.5],
    ['"3"', "3"],
    ["a missing count", undefined],
  ])(
    "FR-5: %s is INVALID_INPUT with the count field error and writes nothing",
    async (_, count) => {
      const gameId = await newGame();
      const before = await snapshot(gameId);
      expect(await createInviteLinks({ gameId, count })).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Sjekk feltene som er merket, og prøv igjen.",
        fieldErrors: { count: COUNT },
      });
      expect(await snapshot(gameId)).toEqual(before);
    },
  );

  it("FR-5: a failing state update rolls back the whole transaction: no rows, issued, state and updated_at unchanged, INTERNAL", async () => {
    const gameId = await newGame();
    const before = await snapshot(gameId);
    const db = await getDb();
    await db.execute(sql`
      create function fail_state_update() returns trigger language plpgsql as $$
      begin raise exception 'state update refused'; end $$`);
    await db.execute(sql`
      create trigger fail_state_update before update of state on game
      for each row execute function fail_state_update()`);
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    try {
      expect(await createInviteLinks({ gameId, count: 3 })).toEqual({
        ok: false,
        code: "INTERNAL",
        message: "Noe gikk galt hos oss. Prøv igjen om litt.",
      });
    } finally {
      write.mockRestore();
      await db.execute(sql`drop trigger fail_state_update on game`);
      await db.execute(sql`drop function fail_state_update`);
    }
    expect(await snapshot(gameId)).toEqual(before);
  });

  it("FR-5: Tokens are unique across all Games: a second invite_link row with the same token_hash, even for another Game, is refused (23505)", async () => {
    const [first, second] = [await newGame(), await newGame()];
    const [link] = await ok(first, 1);
    const tokenHash = sha256(tokenOf(link));
    const error = await (
      await getDb()
    )
      .insert(inviteLink)
      .values({ tokenHash, gameId: second })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(sqlstateOf(error)).toBe("23505");
    expect((await snapshot(second)).hashes).toEqual([]);
  });

  it("FR-1, FR-5: logged out it redirects to /logg-inn and writes nothing", async () => {
    const gameId = await newGame();
    const before = await snapshot(gameId);
    cookieJar.store.clear();
    const error = await createInviteLinks({ gameId, count: 3 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(RedirectError);
    expect((error as RedirectError).url).toBe("/logg-inn");
    expect(await snapshot(gameId)).toEqual(before);
  });
});

describe("after creation", () => {
  it("FR-12: no column of any public table holds a returned Token", async () => {
    const gameId = await newGame();
    const tokens = (await ok(gameId, 5)).map(tokenOf);
    const db = await getDb();
    const tables = sqlRows<{ name: string }>(
      await db.execute(
        sql`select table_name::text as name from information_schema.tables where table_schema = 'public'`,
      ),
    ).map((r) => r.name);
    expect(tables).toContain("invite_link");
    for (const table of tables) {
      const rows = sqlRows<{ json: string }>(
        await db.execute(
          sql`select row_to_json(t)::text as json from ${sql.identifier(table)} t`,
        ),
      );
      for (const { json } of rows)
        for (const t of tokens) expect(json, table).not.toContain(t);
    }
  });

  it("FR-4, FR-12: the collecting Game page lists the Questions read-only and holds no Token or /svar/ link", async () => {
    const texts = ["Hva gjør Jonas?", "Hvem kommer for sent?"];
    const gameId = await newGame({ texts });
    const tokens = (await ok(gameId, 3)).map(tokenOf);
    const html = renderToStaticMarkup(
      await GamePage({
        params: Promise.resolve({ id: gameId }),
        searchParams: Promise.resolve({}),
      }),
    );
    for (const t of tokens) expect(html).not.toContain(t);
    expect(html).not.toContain("/svar/");
    expect(html).toContain("Spørsmål (låst)");
    expect(html).toContain("Flere lenker");
    expect(html).toContain("3 av maks 50 lenker brukt.");
    for (const text of texts) expect(html).toContain(text);
    for (const control of [
      "<textarea",
      "Flytt opp",
      "Flytt ned",
      "Legg til spørsmål",
    ])
      expect(html).not.toContain(control);
  });
});
