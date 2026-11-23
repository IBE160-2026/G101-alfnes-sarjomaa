import { afterAll, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/server/db/client";

const failNext = vi.hoisted(() => ({ value: true }));

vi.mock("@electric-sql/pglite", async (importOriginal) => {
  const real = await importOriginal<typeof import("@electric-sql/pglite")>();
  class PGlite extends real.PGlite {
    constructor(...args: ConstructorParameters<typeof real.PGlite>) {
      if (failNext.value) {
        failNext.value = false;
        throw new Error("open failed");
      }
      super(...args);
    }
  }
  return { ...real, PGlite };
});

afterAll(closeDb);

describe("getDb after a failed open", () => {
  it("NFR-1: does not cache the failure, so the next call retries", async () => {
    await expect(getDb()).rejects.toThrow("open failed");
    expect(
      (globalThis as { __toppsvarDb?: unknown }).__toppsvarDb,
    ).toBeUndefined();
    await expect(getDb()).resolves.toBeDefined();
  });
});
