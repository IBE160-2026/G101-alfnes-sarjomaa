import "server-only";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import { ANSWERS_PER_QUESTION_MAX } from "@/lib/limits";

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
  // Set to now + 180 s when Collection closes; the Grouping runner extends it (AD-12).
  groupingLeaseUntil: timestamp("grouping_lease_until", utc),
});

// Content-free usage counters, one row per Game, created by the first bump (AD-18).
// Written only by games.bumpCounters.
export const gameCounter = pgTable("game_counter", {
  gameId: uuid("game_id")
    .primaryKey()
    .references(() => game.id, { onDelete: "cascade" }),
  judgeGroupsProposed: integer("judge_groups_proposed").notNull().default(0),
  groupsMerged: integer("groups_merged").notNull().default(0),
  answersMoved: integer("answers_moved").notNull().default(0),
  groupsCreated: integer("groups_created").notNull().default(0),
  groupsRenamed: integer("groups_renamed").notNull().default(0),
  groupsDiscarded: integer("groups_discarded").notNull().default(0),
  groupsRestored: integer("groups_restored").notNull().default(0),
  judgeCalls: integer("judge_calls").notNull().default(0),
  questionsFellBack: integer("questions_fell_back").notNull().default(0),
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
    // Set by "Marker som gjennomgått", cleared by any edit of the Question's Groups (FR-20, FR-21).
    reviewed: boolean("reviewed").notNull().default(false),
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

export const groupOrigin = pgEnum("group_origin", ["judge", "fallback"]);
export const groupingSource = pgEnum("grouping_source", [
  "judge",
  "replay",
  "fallback",
]);
// The six FallbackReason codes of src/server/judge/core.ts (AD-12).
export const fallbackReason = pgEnum("fallback_reason", [
  "NO_KEY",
  "NO_STORED_RULING",
  "TIMEOUT",
  "ERROR",
  "REFUSAL",
  "INVALID_OUTPUT",
]);

// Written only by the grouping module. Client UUIDv4 ids and no timestamp, serial or
// identity, so nothing shows when a Group was made (AD-10).
export const answerGroup = pgTable("answer_group", {
  id: uuid("id").primaryKey(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => question.id, { onDelete: "cascade" }),
  origin: groupOrigin("origin").notNull(),
  // Review edits of this Group (Epic 5); the usage report reads it (AD-18).
  editCount: integer("edit_count").notNull().default(0),
  // The Host's rename; null means the default label (AD-11).
  customLabel: text("custom_label"),
  discarded: boolean("discarded").notNull().default(false),
});

// One per Question once the Judge or the fallback has grouped it (AD-12, AD-14).
export const groupingResult = pgTable("grouping_result", {
  questionId: uuid("question_id")
    .primaryKey()
    .references(() => question.id, { onDelete: "cascade" }),
  source: groupingSource("source").notNull(),
  promptVersion: text("prompt_version").notNull(),
  normalizeVersion: integer("normalize_version").notNull(),
  modelId: text("model_id").notNull(),
  judgeCalls: integer("judge_calls").notNull(),
  uncoveredItems: integer("uncovered_items").notNull(),
  fellBack: boolean("fell_back").notNull(),
  fallbackReason: fallbackReason("fallback_reason"),
});

// Written only by the grouping module; rows go in shuffled at close (AD-9, AD-10). No
// serial, identity, time-ordered id, timestamp or ordinal, so nothing shows arrival (FR-13).
export const answer = pgTable(
  "answer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => question.id, { onDelete: "cascade" }),
    // Both nullable: review.confirmBoard clears them for the Game (AD-10).
    contributorKey: uuid("contributor_key"),
    rank: integer("rank"),
    text: text("text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    // Set by Grouping (AD-12); null until then.
    groupId: uuid("group_id").references(() => answerGroup.id, {
      onDelete: "cascade",
    }),
  },
  (t) => [
    check(
      "answer_rank_range",
      sql`${t.rank} between 1 and ${sql.raw(String(ANSWERS_PER_QUESTION_MAX))}`,
    ),
  ],
);
