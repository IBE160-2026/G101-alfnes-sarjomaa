import "server-only";
import path from "node:path";
import { openDb, type DbHandle } from "@/server/db/client";
import { env } from "@/server/env";

const migrationsFolder = path.join(process.cwd(), "drizzle");

export async function migrateDb(handle: DbHandle): Promise<void> {
  if (handle.driver === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(handle.db, { migrationsFolder });
  }
}

// Used by `npm run db:migrate`. Opening a PGlite URL already migrates it.
export async function migrateFromEnv(): Promise<void> {
  const handle = await openDb(env.DATABASE_URL);
  try {
    if (handle.driver === "postgres") await migrateDb(handle);
  } finally {
    await handle.close();
  }
}
