import "server-only";
import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
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
  // Every Invite link ever created, revoked ones included (the cap counts these).
  inviteLinksIssued: integer("invite_links_issued").notNull().default(0),
});

export const question = pgTable(
  "question",
  {
    id: uuid("id").primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [uniqueIndex("question_game_position_key").on(t.gameId, t.position)],
);

// Only the hash: no ordinal, label or timestamp, so no link is told apart (FR-12).
export const inviteLink = pgTable("invite_link", {
  tokenHash: text("token_hash").primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "cascade" }),
});

// One Answer set per link, gone with it. No timestamp, ordinal or other column, so
// nothing tells when or in which order a set arrived (FR-12, AD-8).
export const submission = pgTable("submission", {
  tokenHash: text("token_hash")
    .primaryKey()
    .references(() => inviteLink.tokenHash, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, string[]>>().notNull(),
  editSecretHash: text("edit_secret_hash").notNull(),
});
