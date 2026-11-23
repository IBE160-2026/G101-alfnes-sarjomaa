// The CI Postgres job (AC5): with TEST_POSTGRES_URL set, each test file gets its own
// migrated database on that server. Listed before setup.ts, so DATABASE_URL is set
// before env.ts parses it on its first import.
import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";

const admin = process.env.TEST_POSTGRES_URL!;
const name = `t_${randomUUID().replaceAll("-", "")}`;
const url = new URL(admin);
url.pathname = `/${name}`;

const { default: postgres } = await import("postgres");
const sql = postgres(admin, { prepare: false, onnotice: () => {} });
await sql.unsafe(`create database ${name}`);
process.env.DATABASE_URL = url.toString();

const { openDb } = await import("@/server/db/client");
const { migrateDb } = await import("@/server/db/migrate");
const handle = await openDb(process.env.DATABASE_URL);
await migrateDb(handle);
await handle.close();

// Registered before setup.ts's closeDb, so it runs after it (hooks run as a stack).
afterAll(async () => {
  await sql.unsafe(`drop database if exists ${name} with (force)`);
  await sql.end();
});
