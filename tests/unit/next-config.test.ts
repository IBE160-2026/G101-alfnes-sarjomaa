import type { NextConfig } from "next";
import { describe, expect, it } from "vitest";

describe("next.config.ts", () => {
  it("FR-11: next dev logs no Server Function arguments and no forwarded browser console", async () => {
    const { default: config } = (await import(
      `${process.cwd()}/next.config.ts`
    )) as { default: NextConfig };
    expect(config.logging).toMatchObject({
      serverFunctions: false,
      browserToTerminal: false,
    });
  });
});
