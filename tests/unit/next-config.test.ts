import type { NextConfig } from "next";
import { describe, expect, it } from "vitest";

const loadConfig = async () =>
  (
    (await import(`${process.cwd()}/next.config.ts`)) as {
      default: NextConfig;
    }
  ).default;

describe("next.config.ts", () => {
  it("FR-11: next dev logs no Server Function arguments and no forwarded browser console", async () => {
    const config = await loadConfig();
    expect(config.logging).toMatchObject({
      serverFunctions: false,
      browserToTerminal: false,
    });
  });

  it("FR-15: the stored rulings are traced into every route's bundle (AD-14)", async () => {
    expect((await loadConfig()).outputFileTracingIncludes).toEqual({
      "/*": ["./data/rulings/**"],
    });
  });
});
