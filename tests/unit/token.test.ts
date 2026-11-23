import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLinkStore,
  newEditSecret,
  readLinkStore,
  storageKey,
  TOKEN_PATTERN,
  writeLinkStore,
} from "@/lib/invite-link";
import { newToken } from "@/lib/token";

describe("token", () => {
  it("FR-5, NFR-3: a Token is 32 random bytes, base64url without padding (43 characters)", () => {
    const token = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("FR-9: TOKEN_PATTERN accepts what newToken makes and rejects 42/44 characters and +, /, =", () => {
    const valid = newToken();
    expect(TOKEN_PATTERN.test(valid)).toBe(true);
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
});

describe("link store", () => {
  const gameId = "3f0c2d8e-1b4a-4c6e-9f7a-2d5b8c1e0a9f";
  const token = newToken();
  const key = storageKey(gameId, token);
  const cutShort = `${token.slice(0, 16)}x`;

  function stubStorage() {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    });
    return map;
  }

  afterEach(() => vi.unstubAllGlobals());

  it("AD-8, FR-7: write then read returns the value only for exactly the stored Token", () => {
    const map = stubStorage();
    const secret = newEditSecret();
    writeLinkStore(gameId, { token, editSecret: secret });
    expect(JSON.parse(map.get(key)!)).toEqual({ token, editSecret: secret });
    expect(readLinkStore(gameId, token)).toEqual({ token, editSecret: secret });
    expect(storageKey(gameId, cutShort)).toBe(key);
    expect(readLinkStore(gameId, cutShort)).toBeNull();
  });

  it("AD-8, UX-DR20: the value round-trips { token, editSecret, draft }", () => {
    const map = stubStorage();
    const value = {
      token,
      editSecret: newEditSecret(),
      draft: { q1: ["Sover videre", ""], q2: ["", "", "Kari"] },
    };
    writeLinkStore(gameId, value);
    expect(JSON.parse(map.get(key)!)).toEqual(value);
    expect(readLinkStore(gameId, token)).toEqual(value);
  });

  it("FR-9: clear removes the key for the stored Token and keeps it for one sharing only the first 16 characters", () => {
    const map = stubStorage();
    writeLinkStore(gameId, { token });
    clearLinkStore(gameId, cutShort);
    expect(map.has(key)).toBe(true);
    clearLinkStore(gameId, token);
    expect(map.has(key)).toBe(false);
  });

  it("FR-9: an unparseable value reads as null and is kept by clear", () => {
    const map = stubStorage();
    map.set(key, "utkast");
    expect(readLinkStore(gameId, token)).toBeNull();
    clearLinkStore(gameId, token);
    expect(map.get(key)).toBe("utkast");
  });

  it("FR-9: storage that throws never makes read, write or clear throw", () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", {
      getItem: boom,
      setItem: boom,
      removeItem: boom,
    });
    expect(readLinkStore(gameId, token)).toBeNull();
    expect(() => writeLinkStore(gameId, { token })).not.toThrow();
    expect(() => clearLinkStore(gameId, token)).not.toThrow();
  });

  it("AD-8: newEditSecret is 32 bytes in the Token's shape, and two differ", () => {
    const a = newEditSecret();
    expect(a).toMatch(TOKEN_PATTERN);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(newEditSecret()).not.toBe(a);
  });
});
