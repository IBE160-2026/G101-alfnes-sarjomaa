import "server-only";
import { sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const utc = { withTimezone: true, mode: "date" } as const;

export const host = pgTable(
  "host",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", utc),
    createdAt: timestamp("created_at", utc).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("host_email_lower_key").on(sql`lower(${t.email})`)],
);

export const session = pgTable("session", {
  tokenHash: text("token_hash").primaryKey(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => host.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", utc).notNull(),
});
