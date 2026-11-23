import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import SpillLayout from "@/app/spill/layout";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { game, host, session } from "@/server/db/schema";
import * as games from "@/server/games";
import { onPostgres } from "./driver";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));
// `after` runs its callback at once and keeps the promise, so the test can await it.
const afterPromises: Promise<unknown>[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => Promise<unknown>) => {
    afterPromises.push(callback());
  },
}));

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
// Far ahead of the real clock, so a marker another file left on globalThis is long stale.
let now = new Date("2030-03-01T12:00:00Z").getTime();
let hostId: string;

function setNow(ms: number) {
  now = ms;
  vi.setSystemTime(now);
}

async function insertGame(values: {
  updatedAt: number;
  playedAt?: number;
}): Promise<string> {
  const [{ id }] = await (
    await getDb()
  )
    .insert(game)
    .values({
      hostId,
      title: "Gammelt spill",
      createdAt: new Date(values.updatedAt),
      updatedAt: new Date(values.updatedAt),
      playedAt:
        values.playedAt === undefined ? null : new Date(values.playedAt),
    })
    .returning({ id: game.id });
  return id;
}

async function existing(ids: string[]): Promise<string[]> {
  const rows = await (
    await getDb()
  )
    .select({ id: game.id })
    .from(game)
    .where(inArray(game.id, ids));
  return rows.map((r) => r.id).sort();
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  [{ id: hostId }] = await (
    await getDb()
  )
    .insert(host)
    .values({ email: "rydd@example.test", passwordHash: "x" })
    .returning({ id: host.id });
});
afterAll(() => vi.useRealTimers());

describe("games.purgeExpired", () => {
  it("FR-3, AD-23: deletes only Games 30 days past played_at or 90 days past updated_at, and a second run deletes nothing", async () => {
    const playedLong = await insertGame({
      updatedAt: now - 100 * DAY,
      playedAt: now - 30 * DAY - SECOND,
    });
    const playedRecently = await insertGame({
      updatedAt: now - 100 * DAY,
      playedAt: now - 29 * DAY,
    });
    const idleLong = await insertGame({ updatedAt: now - 90 * DAY - SECOND });
    const idleRecently = await insertGame({ updatedAt: now - 89 * DAY });
    const all = [playedLong, playedRecently, idleLong, idleRecently];

    expect(await games.purgeExpired()).toEqual({ deleted: 2 });
    expect(await existing(all)).toEqual([playedRecently, idleRecently].sort());
    expect(await games.purgeExpired()).toEqual({ deleted: 0 });
    expect(await existing(all)).toEqual([playedRecently, idleRecently].sort());
  });
});

describe("VACUUM after purge", () => {
  const dialect = new PgDialect();

  // Purges one idle Game in `state` with db.execute spied; returns the SQL it ran.
  async function purgeWatched(state: "collecting" | "draft") {
    const id = await insertGame({ updatedAt: now - 91 * DAY });
    const db = await getDb();
    await db.update(game).set({ state }).where(eq(game.id, id));
    const execute = vi.spyOn(db, "execute");
    let statements;
    try {
      expect(await games.purgeExpired()).toEqual({ deleted: 1 });
    } finally {
      statements = execute.mock.calls.map(
        ([query]) => dialect.sqlToQuery((query as SQL).getSQL()).sql,
      );
      execute.mockRestore();
    }
    expect(await existing([id])).toEqual([]);
    return statements.filter((q) => q.startsWith("VACUUM"));
  }

  it("FR-3, AD-9: purging an idle collecting Game runs the VACUUM on submission and invite_link", async () => {
    expect(await purgeWatched("collecting")).toEqual([
      "VACUUM (FULL, SKIP_LOCKED) submission, invite_link",
    ]);
  });

  it("FR-13, AD-9: every purge runs the VACUUM, so one skipped at close is retried, even when only a draft Game goes", async () => {
    expect(await purgeWatched("draft")).toEqual([
      "VACUUM (FULL, SKIP_LOCKED) submission, invite_link",
    ]);
  });

  // PGlite only: SET ROLE holds for one connection, and postgres.js pools several.
  it.skipIf(onPostgres)(
    "FR-13, AD-9: a purge VACUUM that skips the tables (run by a role that does not own them) logs one VACUUM_SKIPPED line",
    async () => {
      const db = await getDb();
      await db.execute(sql`create role vacuum_skip`);
      // Not ALL, which includes MAINTAIN (the right to VACUUM) since Postgres 17.
      await db.execute(
        sql`grant select, insert, update, delete on all tables in schema public to vacuum_skip`,
      );
      const write = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      let out;
      try {
        await db.execute(sql`set role vacuum_skip`);
        await games.purgeExpired();
      } finally {
        await db.execute(sql`reset role`);
        out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
        write.mockRestore();
      }
      expect(
        out
          .trimEnd()
          .split("\n")
          .map((l) => JSON.parse(l)),
      ).toEqual([{ module: "games", op: "vacuum", code: "VACUUM_SKIPPED" }]);
    },
  );
});

describe("session purge", () => {
  it("FR-1: purgeExpired also deletes sessions expired over 14 days ago, keeping newer expired and live ones", async () => {
    const db = await getDb();
    await db.insert(session).values(
      (
        [
          ["old", now - 14 * DAY - SECOND],
          ["recent", now - 13 * DAY],
          ["live", now + DAY],
        ] as const
      ).map(([name, expiresAt]) => ({
        tokenHash: `rydd-${name}`,
        hostId,
        expiresAt: new Date(expiresAt),
      })),
    );
    await games.purgeExpired();
    const left = (await db.select().from(session))
      .map((row) => row.tokenHash)
      .filter((hash) => hash.startsWith("rydd-"))
      .sort();
    expect(left).toEqual(["rydd-live", "rydd-recent"]);
  });
});

describe("games.purgeIfDue", () => {
  it("FR-3, AD-23: runs at t and t + 60 min, but not at t + 59 min", async () => {
    const t = now;
    const expired = () => insertGame({ updatedAt: now - 91 * DAY });

    const first = await expired();
    await games.purgeIfDue();
    expect(await existing([first])).toEqual([]);

    setNow(t + 59 * MINUTE);
    const second = await expired();
    await games.purgeIfDue();
    expect(await existing([second])).toEqual([second]);

    setNow(t + 60 * MINUTE);
    await games.purgeIfDue();
    expect(await existing([second])).toEqual([]);
  });
});

describe("played_at", () => {
  it("FR-3: transition(playing → played) sets played_at to now; draft → collecting leaves it null", async () => {
    const db = await getDb();
    const id = await insertGame({ updatedAt: now });
    await db.transaction((tx) =>
      games.transition(tx, id, "draft", "collecting"),
    );
    const [collecting] = await db.select().from(game).where(eq(game.id, id));
    expect(collecting.playedAt).toBeNull();

    await db.update(game).set({ state: "playing" }).where(eq(game.id, id));
    await db.transaction((tx) => games.transition(tx, id, "playing", "played"));
    const [played] = await db.select().from(game).where(eq(game.id, id));
    expect(played.playedAt).toEqual(new Date(now));
  });
});

// Last in the file: it renames the game table away.
describe("with the game table renamed", () => {
  beforeAll(async () => {
    await auth.register({
      email: "rydd-vert@example.test",
      password: "riktig-passord-123",
      registrationCode: "",
    });
    await (await getDb()).execute(sql`alter table game rename to game_gone`);
  });

  function captureStderr() {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    return () => {
      const out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
      write.mockRestore();
      return out
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    };
  }

  const PURGE_FAILED = {
    module: "games",
    op: "purgeExpired",
    code: "INTERNAL",
    sqlstate: "42P01",
  };

  it("FR-3, AD-17: purgeIfDue resolves and the boundary logs exactly one purgeExpired line", async () => {
    setNow(now + 2 * HOUR);
    const lines = captureStderr();
    await expect(games.purgeIfDue()).resolves.toBeUndefined();
    expect(lines()).toEqual([PURGE_FAILED]);
  });

  it("FR-3, AD-23: the spill layout still renders its children when the purge it triggers fails", async () => {
    setNow(now + 2 * HOUR);
    const lines = captureStderr();
    const html = renderToStaticMarkup(
      await SpillLayout({ children: createElement("p", null, "Innholdet") }),
    );
    expect(afterPromises).toHaveLength(1);
    await expect(afterPromises[0]).resolves.toBeUndefined();
    expect(lines()).toEqual([PURGE_FAILED]);
    expect(html).toContain("<p>Innholdet</p>");
  });
});
