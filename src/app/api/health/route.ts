import { connection } from "next/server";
import { sqlstateOf } from "@/server/boundary";
import { checkDatabase } from "@/server/health";
import { log } from "@/server/log";

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
