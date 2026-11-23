import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import {
  closeDb,
  getDb,
  openDb,
  parseDatabaseUrl,
  type DbHandle,
} from "@/server/db/client";
import { checkDatabase } from "@/server/health";

vi.mock("next/server", () => ({ connection: async () => undefined }));

const tmp = mkdtempSync(path.join(tmpdir(), "toppsvar-db-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const opened: DbHandle[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((h) => h.close()));
});

async function open(url: string): Promise<DbHandle> {
  const handle = await openDb(url);
  opened.push(handle);
  return handle;
}

async function migrationsTableExists(handle: DbHandle): Promise<boolean> {
  const db = handle.db as unknown as {
    execute: (q: ReturnType<typeof sql>) => Promise<unknown>;
  };
  await db.execute(sql`select count(*) from drizzle.__drizzle_migrations`);
  return true;
}

describe("parseDatabaseUrl", () => {
  const cwd = path.resolve("/srv/app");

  it.each([undefined, ""])(
    "NFR-1: %j gives PGlite at <cwd>/.data/local",
    (url) => {
      expect(parseDatabaseUrl(url, cwd)).toEqual({
        driver: "pglite",
        dataDir: path.join(cwd, ".data", "local"),
      });
    },
  );

  it("NFR-1: pglite://<relative dir> resolves against cwd", () => {
    expect(parseDatabaseUrl("pglite://tmp/a/b", cwd)).toEqual({
      driver: "pglite",
      dataDir: path.join(cwd, "tmp", "a", "b"),
    });
  });

  it("NFR-1: pglite:///<absolute dir> stays absolute", () => {
    expect(parseDatabaseUrl("pglite:///abs/a/b", cwd)).toEqual({
      driver: "pglite",
      dataDir: path.resolve("/abs/a/b"),
    });
  });

  it("NFR-1: pglite://:memory: gives in-memory PGlite", () => {
    expect(parseDatabaseUrl("pglite://:memory:", cwd)).toEqual({
      driver: "pglite",
      dataDir: null,
    });
  });

  it.each(["postgres://u:p@h/db", "postgresql://u:p@h/db"])(
    "NFR-2: %s gives postgres.js",
    (url) => {
      expect(parseDatabaseUrl(url, cwd)).toEqual({ driver: "postgres", url });
    },
  );

  it.each(["mysql://user:hunter2@db/x", "pglite://"])(
    "NFR-8: %s throws naming the allowed schemes, not the URL",
    (url) => {
      expect(() => parseDatabaseUrl(url, cwd)).toThrow(
        /pglite:\/\/<dir>.*postgresql:\/\//,
      );
      expect(() => parseDatabaseUrl(url, cwd)).not.toThrow(/hunter2/);
    },
  );
});

describe("openDb", () => {
  it("NFR-1: pglite://<dir> creates the directory recursively and migrates", async () => {
    const dir = path.join(tmp, "nested", "a", "b");
    expect(existsSync(dir)).toBe(false);
    const handle = await open(`pglite://${dir}`);
    expect(handle.driver).toBe("pglite");
    expect(existsSync(dir)).toBe(true);
    expect(await migrationsTableExists(handle)).toBe(true);
  });

  it("NFR-3: pglite://:memory: opens a migrated in-memory database", async () => {
    const handle = await open("pglite://:memory:");
    expect(handle.driver).toBe("pglite");
    expect(await migrationsTableExists(handle)).toBe(true);
  });

  it.each([
    "postgres://u:p@db.example.invalid:5432/x",
    "postgresql://u:p@db.example.invalid/x",
  ])("NFR-2: %s selects postgres.js with prepare: false", async (url) => {
    // Opening does not throw with the network guard on.
    const handle = await open(url);
    expect(handle.driver).toBe("postgres");
    const client = (
      handle.db as unknown as { $client: { options: { prepare: boolean } } }
    ).$client;
    expect(client.options.prepare).toBe(false);
  });
});

describe("getDb", () => {
  afterEach(closeDb);

  it("NFR-3: returns one cached handle from DATABASE_URL", async () => {
    const first = await getDb();
    const second = await getDb();
    expect(second).toBe(first);
    expect(
      (globalThis as { __toppsvarDb?: unknown }).__toppsvarDb,
    ).toBeDefined();
    await closeDb();
    expect(
      (globalThis as { __toppsvarDb?: unknown }).__toppsvarDb,
    ).toBeUndefined();
  });

  it("NFR-3: checkDatabase runs select 1", async () => {
    await expect(checkDatabase()).resolves.toBeUndefined();
  });
});

describe("GET /api/health", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await closeDb();
  });

  it("NFR-1: returns 200 with status ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  async function getWithFailedDb(failure: Error) {
    const rejected = Promise.reject(failure);
    rejected.catch(() => undefined);
    (globalThis as { __toppsvarDb?: Promise<unknown> }).__toppsvarDb = rejected;
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const res = await GET();
    const body = await res.text();
    const logged = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(res.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ status: "error" });
    expect(body + logged).not.toContain("hunter2");
    return JSON.parse(logged) as Record<string, string>;
  }

  const secret = "connect postgres://u:hunter2@db failed";
  const base = { module: "health", op: "checkDatabase", code: "INTERNAL" };

  it("NFR-8: a DB failure returns 503 and logs only the SQLSTATE", async () => {
    const failure = Object.assign(new Error(secret), { code: "57P01" });
    expect(await getWithFailedDb(failure)).toEqual({
      ...base,
      sqlstate: "57P01",
    });
  });

  it("NFR-8: the SQLSTATE is found on the cause, as drizzle wraps driver errors", async () => {
    const failure = new Error(secret, { cause: { code: "57P01" } });
    expect(await getWithFailedDb(failure)).toEqual({
      ...base,
      sqlstate: "57P01",
    });
  });

  it("NFR-8: a Node errno code is not logged as a SQLSTATE", async () => {
    const failure = Object.assign(new Error(secret), { code: "EPIPE" });
    expect(await getWithFailedDb(failure)).toEqual(base);
  });
});
