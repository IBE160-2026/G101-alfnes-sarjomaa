import "server-only";
import { and, eq } from "drizzle-orm";
import { validate, DomainError } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { createInviteLinksSchema, TOKEN_PATTERN } from "@/lib/invite-link";
import { newToken, sha256 } from "@/lib/token";
import { withBoundary } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import { inviteLink } from "@/server/db/schema";
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

// A read: no lock, no write, never updated_at. The state is checked before the Token,
// because close deletes every link and a closed Game must still say closed.
// Unknown, foreign, revoked and malformed Tokens are one LINK_UNKNOWN.
export function openInviteLink(
  gameId: unknown,
  token: unknown,
): Promise<{ title: string; questions: questions.Question[] }> {
  return withBoundary("collection", "openInviteLink", async () => {
    if (typeof gameId !== "string") throw new DomainError("LINK_UNKNOWN");
    const found = await games.find(gameId);
    if (!found) throw new DomainError("LINK_UNKNOWN");
    if (!PERMITTED.openInviteLink.includes(found.state))
      throw new DomainError("COLLECTION_CLOSED");
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token))
      throw new DomainError("LINK_UNKNOWN");
    const db = await getDb();
    const [link] = await db
      .select({ gameId: inviteLink.gameId })
      .from(inviteLink)
      .where(
        and(
          eq(inviteLink.tokenHash, sha256(token)),
          eq(inviteLink.gameId, gameId),
        ),
      );
    if (!link) throw new DomainError("LINK_UNKNOWN");
    return { title: found.title, questions: await questions.ofGame(gameId) };
  });
}
