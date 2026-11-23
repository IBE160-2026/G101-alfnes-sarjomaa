import { createHash, timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { env } from "@/server/env";
import * as games from "@/server/games";

const digest = (value: string) => createHash("sha256").update(value).digest();

// The daily cron backstop (AD-23). Skips the hourly marker on purpose: Host traffic sets it too.
export async function GET(request: Request): Promise<Response> {
  await connection();
  if (!env.CRON_SECRET)
    return Response.json({ status: "disabled" }, { status: 404 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${env.CRON_SECRET}`)))
    return Response.json({ status: "refused" }, { status: 401 });
  try {
    const { deleted } = await games.purgeExpired();
    return Response.json({ status: "ok", deleted });
  } catch {
    return Response.json({ status: "error" }, { status: 500 }); // logged by the boundary
  }
}
