import { afterEach, describe, expect, it, vi } from "vitest";
import { log, type LogEntry } from "@/server/log";

function captureStderr(fn: () => void): string {
  const write = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  fn();
  return write.mock.calls.map(([chunk]) => String(chunk)).join("");
}

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("FR-11: writes one JSON line with module, op, code and sqlstate", () => {
    const out = captureStderr(() =>
      log({
        module: "health",
        op: "checkDatabase",
        code: "INTERNAL",
        sqlstate: "57P01",
      }),
    );
    expect(out.endsWith("\n")).toBe(true);
    expect(JSON.parse(out)).toEqual({
      module: "health",
      op: "checkDatabase",
      code: "INTERNAL",
      sqlstate: "57P01",
    });
  });

  it("FR-11: drops every field beyond the four allowed ones at runtime", () => {
    const entry = {
      module: "collection",
      op: "submit",
      code: "INTERNAL",
      message: "secret answer",
      sqlstate: new Error("secret error") as unknown as string,
    } as LogEntry;
    const out = captureStderr(() => log(entry));
    expect(out).not.toContain("secret");
    expect(JSON.parse(out)).toEqual({
      module: "collection",
      op: "submit",
      code: "INTERNAL",
    });
  });
});
