import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { envSchema, parseEnv } from "@/server/env";

function exampleKeys(): string[] {
  return readFileSync(".env.example", "utf8")
    .split("\n")
    .map((line) => /^([A-Z0-9_]+)=/.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);
}

// Reads the file rather than asking git: the hand-in zip has no .git directory.
function gitignoreLines(): Set<string> {
  return new Set(
    readFileSync(".gitignore", "utf8")
      .split("\n")
      .map((line) => line.trim()),
  );
}

describe("env", () => {
  it("NFR-8: .env.example lists exactly the keys env.ts reads", () => {
    expect(exampleKeys().sort()).toEqual(Object.keys(envSchema.shape).sort());
    expect(exampleKeys()).toHaveLength(9);
  });

  it("NFR-8: .gitignore covers env files, .data, .next and node_modules but not .env.example", () => {
    const lines = gitignoreLines();
    for (const line of [
      ".env",
      ".env.*",
      "!.env.example",
      ".data/",
      ".next/",
      "node_modules/",
    ]) {
      expect(lines.has(line), line).toBe(true);
    }
  });

  it("NFR-1: an empty source gives the no-key defaults", () => {
    expect(parseEnv({})).toEqual({
      DATABASE_URL: "pglite://.data/local",
      PORT: 3000,
      APP_BASE_URL: "http://localhost:3000",
      JUDGE_PROVIDER: "replay",
      JUDGE_MODEL: "deepseek/deepseek-v4.1-flash",
      DEMO_MODE: false,
    });
  });

  it("NFR-1: empty strings count as unset", () => {
    const env = parseEnv({
      PORT: "",
      JUDGE_PROVIDER: "",
      OPENROUTER_API_KEY: "",
      DEMO_MODE: "",
    });
    expect(env.PORT).toBe(3000);
    expect(env.JUDGE_PROVIDER).toBe("replay");
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it("NFR-8: a key without a provider selects openrouter", () => {
    expect(parseEnv({ OPENROUTER_API_KEY: "k" }).JUDGE_PROVIDER).toBe(
      "openrouter",
    );
  });

  it("NFR-8: APP_BASE_URL follows PORT and DEMO_MODE=1 is on", () => {
    const env = parseEnv({ PORT: "4000", DEMO_MODE: "1" });
    expect(env.APP_BASE_URL).toBe("http://localhost:4000");
    expect(env.DEMO_MODE).toBe(true);
  });

  it("NFR-8: APP_BASE_URL must be http or https", () => {
    expect(() => parseEnv({ APP_BASE_URL: "ftp://example.com" })).toThrow(
      /APP_BASE_URL/,
    );
    expect(parseEnv({ APP_BASE_URL: "https://example.com" }).APP_BASE_URL).toBe(
      "https://example.com",
    );
  });

  it("NFR-8: invalid values throw an error naming the keys, never the values", () => {
    const source = {
      PORT: "abc",
      JUDGE_PROVIDER: "x-provider",
      DEMO_MODE: "yes",
      OPENROUTER_API_KEY: "sk-secret",
    };
    expect(() => parseEnv(source)).toThrow(/PORT, JUDGE_PROVIDER, DEMO_MODE/);
    try {
      parseEnv(source);
    } catch (error) {
      const message = (error as Error).message;
      for (const value of Object.values(source))
        expect(message).not.toContain(value);
    }
  });
});
