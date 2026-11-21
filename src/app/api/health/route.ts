import { connection } from "next/server";
import { checkDatabase } from "@/server/health";
import { log } from "@/server/log";

function sqlstateOf(error: unknown): string | undefined {
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

export async function GET(): Promise<Response> {
  await connection();
  try {
    await checkDatabase();
  } catch (error) {
    log({
      module: "health",
      op: "checkDatabase",
      code: "INTERNAL",
      sqlstate: sqlstateOf(error),
    });
    return Response.json({ status: "error" }, { status: 503 });
  }
  return Response.json({ status: "ok" });
}
