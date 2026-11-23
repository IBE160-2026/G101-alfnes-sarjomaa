import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { SESSION_EXTEND_AFTER_MS, SESSION_TTL_MS } from "@/lib/limits";
import type { Db, Tx } from "@/server/db/client";
import { session } from "@/server/db/schema";
import { env } from "@/server/env";

export const SESSION_COOKIE = "toppsvar_session";

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
  secure: env.APP_BASE_URL.startsWith("https:"),
} as const;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Returns the raw token for the cookie; the row stores only its hash.
export async function createSession(tx: Tx, hostId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tx.insert(session).values({
    tokenHash: sha256(token),
    hostId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function deleteSession(tx: Tx | Db, token: string): Promise<void> {
  await tx.delete(session).where(eq(session.tokenHash, sha256(token)));
}

// Rows past their expiry by more than another TTL. The browser's cookie outlives its
// row by at most an hour, so none of these can still bring the ?utlopt=1 notice.
export async function deleteExpiredSessions(db: Db): Promise<void> {
  await db
    .delete(session)
    .where(lt(session.expiresAt, new Date(Date.now() - SESSION_TTL_MS)));
}

// "missing" for no row; "expired" deletes the row. A live row is extended at most hourly.
export async function readSession(
  db: Db,
  token: string,
): Promise<{ hostId: string } | "missing" | "expired"> {
  const tokenHash = sha256(token);
  const [row] = await db
    .select()
    .from(session)
    .where(eq(session.tokenHash, tokenHash));
  if (!row) return "missing";
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(session).where(eq(session.tokenHash, tokenHash));
    return "expired";
  }
  if (row.expiresAt.getTime() < now + SESSION_TTL_MS - SESSION_EXTEND_AFTER_MS)
    await db
      .update(session)
      .set({ expiresAt: new Date(now + SESSION_TTL_MS) })
      .where(eq(session.tokenHash, tokenHash));
  return { hostId: row.hostId };
}
