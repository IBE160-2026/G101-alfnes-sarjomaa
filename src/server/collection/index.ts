import "server-only";
import { and, count, eq } from "drizzle-orm";
import { parseAnswerSet } from "@/lib/answer-set";
import { DomainError, MESSAGES, validate } from "@/lib/errors";
import { PERMITTED, type GameState } from "@/lib/game-state";
import { createInviteLinksSchema, TOKEN_PATTERN } from "@/lib/invite-link";
import { SUBMISSIONS_MIN } from "@/lib/limits";
import { newToken, sha256 } from "@/lib/token";
import { withBoundary } from "@/server/boundary";
import { getDb, type Db } from "@/server/db/client";
import { inviteLink, submission } from "@/server/db/schema";
import { env } from "@/server/env";
import * as games from "@/server/games";
import * as questions from "@/server/questions";

const BASE_URL = env.APP_BASE_URL.replace(/\/+$/, "");

// The full links exist only in this response (FR-5, FR-12): rows hold sha256(token),
// and nothing here logs a Token, hash or link. The first batch opens Collection.
export function createInviteLinks(
  hostId: string,
  input: unknown,
): Promise<{ links: string[] }> {
  return withBoundary("collection", "createInviteLinks", async () => {
    const { gameId, count } = validate(createInviteLinksSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const { state } = await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.createInviteLinks,
      });
      if (state === "draft" && (await questions.count(tx, gameId)) === 0)
        throw new DomainError("QUESTIONS_REQUIRED");
      await games.reserveInviteLinks(tx, gameId, count);
      const tokens = Array.from({ length: count }, newToken);
      await tx
        .insert(inviteLink)
        .values(tokens.map((token) => ({ tokenHash: sha256(token), gameId })));
      if (state === "draft")
        await games.transition(tx, gameId, "draft", "collecting");
      return {
        links: tokens.map((token) => `${BASE_URL}/svar/${gameId}#${token}`),
      };
    });
  });
}

export const FEWER_THAN_3 = "fewer-than-3";

// A read: no lock, no write, never updated_at. The exact count below three never leaves
// this function, so a single arrival cannot be timed against a message (FR-8, FR-12).
export function progress(
  hostId: string,
  gameId: string,
): Promise<{
  active: number;
  issued: number;
  submissions: number | typeof FEWER_THAN_3;
}> {
  return withBoundary("collection", "progress", async () => {
    const { inviteLinksIssued: issued } = await games.getOwned(hostId, gameId);
    const [row] = await (
      await getDb()
    )
      .select({ active: count(), submitted: count(submission.tokenHash) })
      .from(inviteLink)
      .leftJoin(submission, eq(submission.tokenHash, inviteLink.tokenHash))
      .where(eq(inviteLink.gameId, gameId));
    return {
      active: row.active,
      issued,
      submissions:
        row.submitted < SUBMISSIONS_MIN ? FEWER_THAN_3 : row.submitted,
    };
  });
}

// The link page's server shell decides only this, from the Game in the URL (AD-7).
export function linkStatus(
  gameId: string,
): Promise<"unknown" | "closed" | "open"> {
  return withBoundary("collection", "linkStatus", async () => {
    const found = await games.find(gameId);
    if (!found) return "unknown";
    return PERMITTED.openInviteLink.includes(found.state) ? "open" : "closed";
  });
}

// The lookup both link entry points share (AD-7). The state is checked before the Token,
// because close deletes every link and a closed Game must still say closed.
// Unknown, foreign, revoked and malformed Tokens are one LINK_UNKNOWN.
async function resolveLink(
  gameId: unknown,
  token: unknown,
  states: readonly GameState[],
) {
  if (typeof gameId !== "string") throw new DomainError("LINK_UNKNOWN");
  const found = await games.find(gameId);
  if (!found) throw new DomainError("LINK_UNKNOWN");
  if (!states.includes(found.state)) throw new DomainError("COLLECTION_CLOSED");
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token))
    throw new DomainError("LINK_UNKNOWN");
  const tokenHash = sha256(token);
  if (!(await linkExists(await getDb(), tokenHash, gameId)))
    throw new DomainError("LINK_UNKNOWN");
  return { gameId, title: found.title, tokenHash };
}

async function linkExists(db: Db, tokenHash: string, gameId: string) {
  const rows = await db
    .select({ gameId: inviteLink.gameId })
    .from(inviteLink)
    .where(
      and(eq(inviteLink.tokenHash, tokenHash), eq(inviteLink.gameId, gameId)),
    );
  return rows.length > 0;
}

// A read: no lock, no write, never updated_at. The saved set comes back only for the
// matching edit secret (AD-8); a wrong, missing or malformed one gets exactly what an
// unused link gets, with no answers key (FR-7, FR-12).
export function openInviteLink(
  gameId: unknown,
  token: unknown,
  editSecret?: unknown,
): Promise<{
  title: string;
  questions: questions.Question[];
  answers?: Record<string, string[]>;
}> {
  return withBoundary("collection", "openInviteLink", async () => {
    const link = await resolveLink(gameId, token, PERMITTED.openInviteLink);
    const view = {
      title: link.title,
      questions: await questions.ofGame(link.gameId),
    };
    if (typeof editSecret !== "string" || !TOKEN_PATTERN.test(editSecret))
      return view;
    const [saved] = await (
      await getDb()
    )
      .select({ answers: submission.answers })
      .from(submission)
      .where(
        and(
          eq(submission.tokenHash, link.tokenHash),
          eq(submission.editSecretHash, sha256(editSecret)),
        ),
      );
    return saved ? { ...view, answers: saved.answers } : view;
  });
}

// Stores or replaces the link's one Answer set (AD-8). The lock has no hostId, so no
// Host-visible value changes, game.updated_at included. Nothing is written on any failure.
export function submit(
  gameId: unknown,
  token: unknown,
  input: unknown,
): Promise<void> {
  return withBoundary("collection", "submit", async () => {
    const link = await resolveLink(gameId, token, PERMITTED.submitAnswers);
    const { editSecret, answers: rawAnswers } =
      typeof input === "object" && input !== null
        ? (input as { editSecret?: unknown; answers?: unknown })
        : {};
    if (typeof editSecret !== "string" || !TOKEN_PATTERN.test(editSecret))
      throw new DomainError("INVALID_INPUT", {
        editSecret: MESSAGES.INVALID_INPUT,
      });
    // Outside the transaction: Questions are frozen after draft, and a getDb() query
    // inside a PGlite transaction deadlocks.
    const ids = (await questions.ofGame(link.gameId)).map((q) => q.id);
    const answers = parseAnswerSet(rawAnswers, ids);
    const db = await getDb();
    await db.transaction(async (tx) => {
      try {
        await games.lockForMutation(tx, {
          gameId: link.gameId,
          states: PERMITTED.submitAnswers,
        });
      } catch (error) {
        if (error instanceof DomainError && error.code === "NOT_FOUND")
          throw new DomainError("LINK_UNKNOWN");
        if (error instanceof DomainError && error.code === "WRONG_STATE")
          throw new DomainError("COLLECTION_CLOSED");
        throw error;
      }
      if (!(await linkExists(tx, link.tokenHash, link.gameId)))
        throw new DomainError("LINK_UNKNOWN");
      const editSecretHash = sha256(editSecret);
      await tx
        .insert(submission)
        .values({ tokenHash: link.tokenHash, answers, editSecretHash })
        .onConflictDoUpdate({
          target: submission.tokenHash,
          set: { answers, editSecretHash },
        });
    });
  });
}
