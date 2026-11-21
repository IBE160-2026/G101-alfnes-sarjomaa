import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { env } from "@/server/env";

describe("test guards", () => {
  it("NFR-3: fetch to a non-local host is rejected", async () => {
    const error = await fetch("https://example.com").then(
      () => null,
      (e: unknown) => e as Error & { cause?: Error },
    );
    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.cause?.message}`).toMatch(
      /network blocked/,
    );
  });

  it("NFR-3: requests to localhost still work", async () => {
    const server = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(await res.text()).toBe("ok");
    } finally {
      server.close();
    }
  });

  it("NFR-3: the Judge is the mock and no key is set", () => {
    expect(env.JUDGE_PROVIDER).toBe("mock");
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.DATABASE_URL).toBe("pglite://:memory:");
  });
});
