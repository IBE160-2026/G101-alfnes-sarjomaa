import { describe, expect, it } from "vitest";
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
});
