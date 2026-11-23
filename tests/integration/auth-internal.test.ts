import { sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { logOut } from "@/app/actions";
import { logIn } from "@/app/logg-inn/actions";
import { register } from "@/app/registrer/actions";
import { DomainError } from "@/lib/errors";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { cookieJar, run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);

afterEach(() => vi.restoreAllMocks());

const EMAIL = "lekk@example.test";
const PASSWORD = "hemmelig-passord-123";

async function stderrOf(fn: () => Promise<unknown>) {
  const write = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  const result = await fn().catch((error: unknown) => error);
  const out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
  write.mockRestore();
  return { result, lines: out.trimEnd().split("\n"), out };
}

describe("with the auth tables (and game, which references host) dropped", () => {
  beforeAll(async () => {
    const db = await getDb();
    await db.execute(sql`drop table game cascade`);
    await db.execute(sql`drop table session`);
    await db.execute(sql`drop table host`);
  });

  it("AD-17, FR-11: returns INTERNAL and logs one line with only module, op, code and sqlstate", async () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const result = await run(logIn, { email: EMAIL, password: PASSWORD });
    const out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    write.mockRestore();

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Noe gikk galt hos oss. Prøv igjen om litt.",
    });
    const lines = out.trimEnd().split("\n");
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toEqual({
      module: "auth",
      op: "logIn",
      code: "INTERNAL",
      sqlstate: "42P01",
    });
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(PASSWORD);
  });

  it("FR-1: logout with the DB down still deletes the cookie and lands on /", async () => {
    cookieJar.store.set("toppsvar_session", "stale-token");
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    expect(await run(logOut, {})).toEqual({ redirect: "/" });
    const out = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    write.mockRestore();

    expect(cookieJar.store.has("toppsvar_session")).toBe(false);
    expect(JSON.parse(out)).toEqual({
      module: "auth",
      op: "logOut",
      code: "INTERNAL",
      sqlstate: "42P01",
    });
    expect(out).not.toContain("stale-token");
  });

  it("AD-17: register returns INTERNAL, not EMAIL_TAKEN, and logs one line", async () => {
    const { result, lines, out } = await stderrOf(() =>
      run(register, { email: EMAIL, password: PASSWORD }),
    );
    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Noe gikk galt hos oss. Prøv igjen om litt.",
    });
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      { module: "auth", op: "register", code: "INTERNAL", sqlstate: "42P01" },
    ]);
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain(PASSWORD);
  });

  it("AD-17: requireHost with a session cookie rejects with INTERNAL and logs one line", async () => {
    cookieJar.store.set("toppsvar_session", "some-token");
    const { result, lines, out } = await stderrOf(() => auth.requireHost());
    expect(result).toBeInstanceOf(DomainError);
    expect((result as DomainError).code).toBe("INTERNAL");
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      {
        module: "auth",
        op: "requireHost",
        code: "INTERNAL",
        sqlstate: "42P01",
      },
    ]);
    expect(out).not.toContain("some-token");
  });
});
