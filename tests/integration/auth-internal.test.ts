import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logIn } from "@/app/logg-inn/actions";
import { getDb } from "@/server/db/client";
import { run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);

afterEach(() => vi.restoreAllMocks());

const EMAIL = "lekk@example.test";
const PASSWORD = "hemmelig-passord-123";

describe("a DB error during login", () => {
  it("AD-17, FR-11: returns INTERNAL and logs one line with only module, op, code and sqlstate", async () => {
    const db = await getDb();
    await db.execute(sql`drop table session`);
    await db.execute(sql`drop table host`);

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
});
