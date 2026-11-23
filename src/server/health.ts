import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export async function checkDatabase(): Promise<void> {
  const db = await getDb();
  await db.execute(sql`select 1`);
}
