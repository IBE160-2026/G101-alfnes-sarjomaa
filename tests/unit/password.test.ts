import { describe, expect, it, vi } from "vitest";
import {
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";

const inFlight = vi.hoisted(() => ({ now: 0, max: 0 }));

// Counts concurrent scrypt runs without changing what they compute.
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  const scrypt = (...args: unknown[]) => {
    const done = args.pop() as (error: Error | null, key: Buffer) => void;
    inFlight.now++;
    inFlight.max = Math.max(inFlight.max, inFlight.now);
    try {
      (real.scrypt as (...a: unknown[]) => void)(
        ...args,
        (error: Error | null, key: Buffer) => {
          inFlight.now--;
          done(error, key);
        },
      );
    } catch (error) {
      inFlight.now--; // invalid parameters throw synchronously
      throw error;
    }
  };
  return { ...real, scrypt };
});

const FORMAT =
  /^scrypt\$131072\$8\$1\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;
const PASSWORD = "korrekt hest batteri";

describe("password hashing", { timeout: 30_000 }, () => {
  it("FR-1: stores N=2^17, r=8, p=1, a 16-byte salt and a 32-byte key, never the password", async () => {
    const stored = await hashPassword(PASSWORD);
    const [, salt, key] = FORMAT.exec(stored) ?? [];
    expect(Buffer.from(salt, "base64")).toHaveLength(16);
    expect(Buffer.from(key, "base64")).toHaveLength(32);
    expect(stored).not.toContain(PASSWORD);
    expect(await hashPassword(PASSWORD)).not.toBe(stored);
  });

  it("FR-1: verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
    expect(await verifyPassword(`${PASSWORD} `, stored)).toBe(false);
  });

  it.each([
    "",
    "bcrypt$x",
    "scrypt$131072$8$1$c2FsdA==",
    "scrypt$131072$8$1$c2FsdA==$A",
    "scrypt$3$8$1$pr8Gvias7EtgRgTFwuZYaA==$o3Ic1wRDfIml6CE/QhYNOVuzmTqySBU5keQfgD/LY+U=",
  ])("FR-1: a malformed stored string %j verifies as false", async (stored) => {
    expect(await verifyPassword(PASSWORD, stored)).toBe(false);
  });

  it("FR-1: DUMMY_HASH is a real scrypt string with the same parameters", async () => {
    expect(DUMMY_HASH).toMatch(FORMAT);
    expect(await verifyPassword(PASSWORD, DUMMY_HASH)).toBe(false);
  });

  it("FR-1: runs at most two scrypt derivations at a time", async () => {
    inFlight.max = 0;
    const hashes = await Promise.all(
      Array.from({ length: 5 }, (_, i) => hashPassword(`passord-${i}-xyz`)),
    );
    expect(hashes).toHaveLength(5);
    expect(inFlight.max).toBe(2);
    expect(inFlight.now).toBe(0);
  });
});
