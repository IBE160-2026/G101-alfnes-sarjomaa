import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loginSchema, registrationSchema } from "@/lib/account";
import { DomainError, MESSAGES, validate } from "@/lib/errors";
import {
  LOCKOUT_AFTER_FAILURES,
  LOCKOUT_BASE_MS,
  LOCKOUT_MAX_MS,
  PASSWORD_MAX,
} from "@/lib/limits";
import {
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from "@/server/auth/password";
import {
  SESSION_COOKIE,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  readSession,
  sessionCookieOptions,
} from "@/server/auth/session";
import { sqlstateOf, withBoundary } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import { host } from "@/server/db/schema";
import { env } from "@/server/env";
import { log } from "@/server/log";

export { SESSION_COOKIE, sessionCookieOptions };

function codeMatches(given: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export function register(input: unknown): Promise<void> {
  return withBoundary("auth", "register", async () => {
    const { email, password, registrationCode } = validate(
      registrationSchema,
      input,
    );
    if (
      env.REGISTRATION_CODE !== undefined &&
      !codeMatches(registrationCode, env.REGISTRATION_CODE)
    )
      throw new DomainError("REGISTRATION_CODE_WRONG", {
        registrationCode: MESSAGES.REGISTRATION_CODE_WRONG,
      });

    const passwordHash = await hashPassword(password);
    const db = await getDb();
    let token: string;
    try {
      token = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(host)
          .values({ email, passwordHash })
          .returning({ id: host.id });
        return createSession(tx, row.id);
      });
    } catch (error) {
      // The unique index on lower(email) also catches two registrations racing.
      if (sqlstateOf(error) === "23505")
        throw new DomainError("EMAIL_TAKEN", { email: MESSAGES.EMAIL_TAKEN });
      throw error;
    }
    await setSessionCookie(token);
  });
}

// A Host without a session or cookie, for the demo seed outside a request (AD-19).
export function createHost(input: unknown): Promise<{ hostId: string }> {
  return withBoundary("auth", "createHost", async () => {
    const { email, password } = validate(registrationSchema, input);
    const passwordHash = await hashPassword(password);
    const db = await getDb();
    const [row] = await db
      .insert(host)
      .values({ email, passwordHash })
      .returning({ id: host.id });
    return { hostId: row.id };
  });
}

export function logIn(input: unknown): Promise<void> {
  return withBoundary("auth", "logIn", async () => {
    const { email, password } = validate(loginSchema, input);
    if (password.length > PASSWORD_MAX)
      throw new DomainError("INVALID_CREDENTIALS");

    const db = await getDb();
    const [row] = await db
      .select()
      .from(host)
      .where(eq(sql`lower(${host.email})`, sql`lower(${email})`));
    // One scrypt run whether the email is known, unknown or locked, so that cost is equal;
    // the DB writes after it for a known email are not.
    const correct = await verifyPassword(
      password,
      row?.passwordHash ?? DUMMY_HASH,
    );
    const now = new Date();
    if (!row || (row.lockedUntil && row.lockedUntil > now))
      throw new DomainError("INVALID_CREDENTIALS");
    // Re-checked in every write: the row above was read before a possibly queued scrypt run,
    // and another attempt may have locked the account meanwhile.
    const stillOpen = and(
      eq(host.id, row.id),
      or(isNull(host.lockedUntil), lte(host.lockedUntil, now)),
    );

    if (!correct) {
      const [counted] = await db
        .update(host)
        .set({ failedLogins: sql`${host.failedLogins} + 1` })
        .where(stillOpen)
        .returning({ failedLogins: host.failedLogins });
      if (counted && counted.failedLogins >= LOCKOUT_AFTER_FAILURES) {
        const lockMs = Math.min(
          LOCKOUT_BASE_MS *
            2 ** (counted.failedLogins - LOCKOUT_AFTER_FAILURES),
          LOCKOUT_MAX_MS,
        );
        const until = new Date(now.getTime() + lockMs).toISOString();
        // greatest() so a lock finishing late never shortens a longer one.
        await db
          .update(host)
          .set({
            lockedUntil: sql`greatest(${host.lockedUntil}, ${until}::timestamptz)`,
          })
          .where(eq(host.id, row.id));
      }
      throw new DomainError("INVALID_CREDENTIALS");
    }

    const token = await db.transaction(async (tx) => {
      const [reset] = await tx
        .update(host)
        .set({ failedLogins: 0, lockedUntil: null })
        .where(stillOpen)
        .returning({ id: host.id });
      if (!reset) throw new DomainError("INVALID_CREDENTIALS"); // locked meanwhile: roll back
      return createSession(tx, row.id);
    });
    await setSessionCookie(token);
  });
}

// A DB failure is logged and the cookie is still deleted, so the browser is logged out.
export async function logOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const db = await getDb();
      await deleteSession(db, token);
    } catch (error) {
      log({
        module: "auth",
        op: "logOut",
        code: "INTERNAL",
        sqlstate: sqlstateOf(error),
      });
    }
  }
  jar.delete(SESSION_COOKIE);
}

// cache(): one session read per request. The spill layout and the page both call this,
// and Next renders them in parallel; without it the second read finds the expired row
// already deleted and redirects without ?utlopt=1 (Story 1.3 AC3).
export const requireHost = cache(async (): Promise<{ hostId: string }> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/logg-inn");
  const result = await withBoundary("auth", "requireHost", async () =>
    readSession(await getDb(), token),
  );
  if (result === "missing") redirect("/logg-inn");
  if (result === "expired") redirect("/logg-inn?utlopt=1");
  return result;
});

// Called by the retention purge, so sessions never used again do not pile up.
export function purgeExpiredSessions(): Promise<void> {
  return withBoundary("auth", "purgeExpiredSessions", async () =>
    deleteExpiredSessions(await getDb()),
  );
}

// Cookie presence only, no DB read, so the 404 page renders with the DB down.
export async function hasSessionCookie(): Promise<boolean> {
  return (await cookies()).has(SESSION_COOKIE);
}
