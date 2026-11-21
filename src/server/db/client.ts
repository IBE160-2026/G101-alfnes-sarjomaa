import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTransaction,
} from "drizzle-orm/pg-core";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/server/db/schema";
import { env } from "@/server/env";

type Schema = typeof schema;

export type Db = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema>;

export type DatabaseTarget =
  | { driver: "pglite"; dataDir: string | null }
  | { driver: "postgres"; url: string };

export type DbHandle =
  | { driver: "pglite"; db: PgliteDatabase<Schema>; close(): Promise<void> }
  | {
      driver: "postgres";
      db: PostgresJsDatabase<Schema>;
      close(): Promise<void>;
    };

const PGLITE = "pglite://";

// Error messages never include the URL: a postgres URL may carry a password.
export function parseDatabaseUrl(
  url: string | undefined,
  cwd = process.cwd(),
): DatabaseTarget {
  if (url === undefined || url === "") {
    return { driver: "pglite", dataDir: path.join(cwd, ".data", "local") };
  }
  if (url.startsWith(PGLITE)) {
    const location = url.slice(PGLITE.length);
    if (location === ":memory:") return { driver: "pglite", dataDir: null };
    if (location !== "")
      return { driver: "pglite", dataDir: path.resolve(cwd, location) };
  } else if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return { driver: "postgres", url };
  }
  throw new Error(
    "Unsupported DATABASE_URL: use pglite://<dir>, pglite://:memory:, postgres:// or postgresql://",
  );
}

// Drivers are imported on demand so the deployed bundle never loads PGlite's WASM.
// PGlite databases are migrated on open; postgres.js ones only by `npm run db:migrate`.
export async function openDb(url: string | undefined): Promise<DbHandle> {
  const target = parseDatabaseUrl(url);
  if (target.driver === "postgres") {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    const client = postgres(target.url, { prepare: false });
    return {
      driver: "postgres",
      db: drizzle({ client, schema }),
      close: () => client.end(),
    };
  }
  const [{ PGlite }, { drizzle }, { migrateDb }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("@/server/db/migrate"),
  ]);
  if (target.dataDir) await mkdir(target.dataDir, { recursive: true });
  const client = target.dataDir ? new PGlite(target.dataDir) : new PGlite();
  const handle: DbHandle = {
    driver: "pglite",
    db: drizzle({ client, schema }),
    close: () => client.close(),
  };
  try {
    await migrateDb(handle);
  } catch (error) {
    await client.close();
    throw error;
  }
  return handle;
}

const cache = globalThis as typeof globalThis & {
  __toppsvarDb?: Promise<DbHandle>;
};

// One handle per process, kept on globalThis so dev hot reloads reuse it.
// A failed open is not cached, so the next call retries.
export async function getDb(): Promise<Db> {
  if (!cache.__toppsvarDb) {
    const opening = openDb(env.DATABASE_URL).catch((error: unknown) => {
      if (cache.__toppsvarDb === opening) cache.__toppsvarDb = undefined;
      throw error;
    });
    cache.__toppsvarDb = opening;
  }
  const handle = await cache.__toppsvarDb;
  return handle.db as Db;
}

export async function closeDb(): Promise<void> {
  const opening = cache.__toppsvarDb;
  cache.__toppsvarDb = undefined;
  const handle = await opening?.catch(() => undefined);
  await handle?.close();
}
