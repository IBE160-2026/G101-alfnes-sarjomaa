import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/server/db/client";
import { game, host } from "@/server/db/schema";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));

const DAY = 24 * 60 * 60 * 1000;
const marker = globalThis as typeof globalThis & { __lastPurgeAt?: number };
let expired: string;
let young: string;

// env.ts is parsed once at import, so each CRON_SECRET needs a fresh module graph.
async function loadRoute(secret: string) {
  vi.stubEnv("CRON_SECRET", secret);
  vi.resetModules();
  return (await import("@/app/api/purge/route")).GET;
}

function call(GET: (r: Request) => Promise<Response>, authorization?: string) {
  return GET(
    new Request("http://localhost/api/purge", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

async function survivors(): Promise<string[]> {
  const rows = await (
    await getDb()
  )
    .select({ id: game.id })
    .from(game)
    .where(inArray(game.id, [expired, young]));
  return rows.map((r) => r.id).sort();
}

beforeAll(async () => {
  const db = await getDb();
  const [{ id: hostId }] = await db
    .insert(host)
    .values({ email: "cron@example.test", passwordHash: "x" })
    .returning({ id: host.id });
  const old = new Date(Date.now() - 91 * DAY);
  [{ id: expired }] = await db
    .insert(game)
    .values({ hostId, title: "Utløpt", createdAt: old, updatedAt: old })
    .returning({ id: game.id });
  [{ id: young }] = await db
    .insert(game)
    .values({ hostId, title: "Ungt" })
    .returning({ id: game.id });
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/purge", () => {
  it("FR-3, AD-17: without CRON_SECRET it is 404 disabled and deletes nothing", async () => {
    const before = marker.__lastPurgeAt;
    const GET = await loadRoute("");
    for (const authorization of [undefined, "Bearer "]) {
      const response = await call(GET, authorization);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ status: "disabled" });
    }
    expect(await survivors()).toEqual([expired, young].sort());
    expect(marker.__lastPurgeAt).toBe(before);
  });

  it("FR-3, AD-17: a missing or wrong secret is 401 refused and deletes nothing", async () => {
    const before = marker.__lastPurgeAt;
    const GET = await loadRoute("hemmelig");
    for (const authorization of [undefined, "Bearer wrong", "hemmelig"]) {
      const response = await call(GET, authorization);
      expect(response.status, authorization).toBe(401);
      expect(await response.json()).toEqual({ status: "refused" });
    }
    expect(await survivors()).toEqual([expired, young].sort());
    expect(marker.__lastPurgeAt).toBe(before);
  });

  it("FR-3, AD-17: the right secret purges, answers with the count only, and leaves the hourly marker", async () => {
    const before = marker.__lastPurgeAt;
    const GET = await loadRoute("hemmelig");
    const response = await call(GET, "Bearer hemmelig");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", deleted: 1 });
    expect(await survivors()).toEqual([young]);
    expect(marker.__lastPurgeAt).toBe(before);
  });

  // Last in the file: it renames the game table away.
  it("FR-3, AD-17: a failing purge is 500 error, and the boundary logs exactly one purgeExpired line", async () => {
    await (await getDb()).execute(sql`alter table game rename to game_gone`);
    const GET = await loadRoute("hemmelig");
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const response = await call(GET, "Bearer hemmelig");
    const out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    write.mockRestore();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "error" });
    expect(
      out
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toEqual([
      {
        module: "games",
        op: "purgeExpired",
        code: "INTERNAL",
        sqlstate: "42P01",
      },
    ]);
  });
});
