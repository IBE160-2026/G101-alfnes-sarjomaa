import { z } from "zod";
import { INVITE_LINKS_MAX } from "@/lib/limits";

const COUNT = `Skriv et tall fra 1 til ${INVITE_LINKS_MAX}.`;

// Malformed gameIds are left to lockForMutation, which makes them NOT_FOUND (AD-5).
export const createInviteLinksSchema = z.object({
  gameId: z.string(),
  count: z
    .number({ error: COUNT })
    .int(COUNT)
    .min(1, COUNT)
    .max(INVITE_LINKS_MAX, COUNT),
});

// The Host copy for a pasted link that is not an active link of this Game (FR-9). It rides
// in fieldErrors.link, so the Participant's LINK_UNKNOWN message stays unchanged.
export const LINK_NOT_ACTIVE =
  "Denne lenken er ikke en aktiv lenke i dette spillet.";

// A non-string link becomes "" and so LINK_UNKNOWN, never INVALID_INPUT.
export const revokeInviteLinkSchema = z.object({
  gameId: z.string(),
  link: z.string().catch(""),
});

// The shape newToken() makes: 32 bytes as base64url without padding.
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// The one localStorage key per link (AD-8): edit secret and unsent draft live under it.
export function storageKey(gameId: string, token: string): string {
  return `toppsvar:${gameId}:${token.slice(0, 16)}`;
}

// The key's value. The full Token is kept so that a cut-short link, which shares the
// key, neither reads nor clears the real link's secret. `draft` is the unsent raw field
// values per Question ID; it never leaves the device before a submit.
export type LinkStore = {
  token: string;
  editSecret?: string;
  draft?: Record<string, string[]>;
};

// Storage can be missing, blocked or full, so none of these ever throws.
export function readLinkStore(gameId: string, token: string): LinkStore | null {
  try {
    const raw = localStorage.getItem(storageKey(gameId, token));
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" &&
      value !== null &&
      (value as LinkStore).token === token
      ? (value as LinkStore)
      : null;
  } catch {
    return null;
  }
}

export function writeLinkStore(gameId: string, store: LinkStore): void {
  try {
    localStorage.setItem(
      storageKey(gameId, store.token),
      JSON.stringify(store),
    );
  } catch {
    // Without storage the submit still works; the device just cannot edit later.
  }
}

export function clearLinkStore(gameId: string, token: string): void {
  if (!readLinkStore(gameId, token)) return;
  try {
    localStorage.removeItem(storageKey(gameId, token));
  } catch {
    // Nothing to remove when storage is blocked.
  }
}

// 32 random bytes as base64url, the Token's shape. getRandomValues and btoa, because
// crypto.subtle is missing on plain http://<LAN-IP> and Uint8Array.toBase64 on older phones.
export function newEditSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
