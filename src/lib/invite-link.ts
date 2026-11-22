import { z } from "zod";
import { INVITE_LINKS_MAX } from "@/lib/limits";

const COUNT = "Skriv et tall fra 1 til 50.";

// Malformed gameIds are left to lockForMutation, which makes them NOT_FOUND (AD-5).
export const createInviteLinksSchema = z.object({
  gameId: z.string(),
  count: z
    .number({ error: COUNT })
    .int(COUNT)
    .min(1, COUNT)
    .max(INVITE_LINKS_MAX, COUNT),
});

// The shape newToken() makes: 32 bytes as base64url without padding.
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// The one localStorage key per link (AD-8): edit secret and unsent draft live under it.
export function storageKey(gameId: string, token: string): string {
  return `toppsvar:${gameId}:${token.slice(0, 16)}`;
}
