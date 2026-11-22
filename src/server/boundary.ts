import "server-only";
import { unstable_rethrow } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { log } from "@/server/log";

export function sqlstateOf(error: unknown): string | undefined {
  for (
    let e: unknown = error;
    e instanceof Object;
    e = (e as { cause?: unknown }).cause
  ) {
    const code = (e as { code?: unknown }).code;
    // Node errno codes (EPIPE, EROFS) also have five letters; no SQLSTATE class starts with E.
    if (
      typeof code === "string" &&
      /^[0-9A-Z]{5}$/.test(code) &&
      !/^E[A-Z]{4}$/.test(code)
    )
      return code;
  }
  return undefined;
}

// Entry points run inside this: DomainErrors pass through, Next's control flow is
// rethrown, anything else is logged without its message and becomes INTERNAL.
export async function withBoundary<T>(
  module: string,
  op: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError) throw error;
    log({ module, op, code: "INTERNAL", sqlstate: sqlstateOf(error) });
    throw new DomainError("INTERNAL");
  }
}
