import { migrateFromEnv } from "@/server/db/migrate";

await migrateFromEnv();
