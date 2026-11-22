import { describe, expect, it } from "vitest";
import { storageKey, TOKEN_PATTERN } from "@/lib/invite-link";
import { newToken, sha256 } from "@/lib/token";

describe("token", () => {
  it("FR-5, NFR-3: a Token is 32 random bytes, base64url without padding (43 characters)", () => {
    const token = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("FR-5: 10 000 Tokens have no duplicate", () => {
    const tokens = Array.from({ length: 10_000 }, newToken);
    expect(new Set(tokens).size).toBe(10_000);
  });

  it('FR-5: sha256 is the hex digest (known vector for "abc")', () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("FR-9: TOKEN_PATTERN accepts what newToken makes and rejects 42/44 characters and +, /, =", () => {
    for (let i = 0; i < 100; i++)
      expect(TOKEN_PATTERN.test(newToken())).toBe(true);
    const valid = newToken();
    for (const bad of [
      valid.slice(1),
      `${valid}A`,
      `+${valid.slice(1)}`,
      `/${valid.slice(1)}`,
      `${valid.slice(1)}=`,
      "",
    ])
      expect(TOKEN_PATTERN.test(bad), bad).toBe(false);
  });

  it("FR-7: storageKey is toppsvar:<gameId>:<first 16 Token characters>", () => {
    const gameId = "3f0c2d8e-1b4a-4c6e-9f7a-2d5b8c1e0a9f";
    const token = "abcdefghijklmnopQRSTUVWXYZ0123456789-_abcde";
    expect(storageKey(gameId, token)).toBe(
      `toppsvar:${gameId}:abcdefghijklmnop`,
    );
  });
});
