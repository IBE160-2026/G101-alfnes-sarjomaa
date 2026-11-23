import "server-only";
import { sql } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { GAME_STATES } from "@/lib/game-state";

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

export const gameState = pgEnum("game_state", GAME_STATES);

export const game = pgTable("game", {
  id: uuid("id").primaryKey().defaultRandom(),
  hostId: uuid("host_id")
    .notNull()
    .references(() => host.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  state: gameState("state").notNull().default("draft"),
  createdAt: timestamp("created_at", utc).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", utc).notNull().defaultNow(),
  playedAt: timestamp("played_at", utc),
});
