import "server-only";
import { validate, DomainError } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { createInviteLinksSchema } from "@/lib/invite-link";
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
