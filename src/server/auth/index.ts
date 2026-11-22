import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

export function logIn(input: unknown): Promise<void> {
  return withBoundary("auth", "logIn", async () => {
    const { email, password } = validate(loginSchema, input);
    if (password.length > PASSWORD_MAX)
      throw new DomainError("INVALID_CREDENTIALS");

    const db = await getDb();
    const [row] = await db
      .select()
      .from(host)
      .where(eq(sql`lower(${host.email})`, email.toLowerCase()));
    // Always one scrypt run, locked or unknown alike, so timing reveals nothing.
    const correct = await verifyPassword(
      password,
      row?.passwordHash ?? DUMMY_HASH,
    );
    const now = new Date();
    if (!row || (row.lockedUntil && row.lockedUntil > now))
      throw new DomainError("INVALID_CREDENTIALS");

    if (!correct) {
      const [{ failedLogins }] = await db
        .update(host)
        .set({ failedLogins: sql`${host.failedLogins} + 1` })
        .where(eq(host.id, row.id))
        .returning({ failedLogins: host.failedLogins });
      if (failedLogins >= LOCKOUT_AFTER_FAILURES) {
        const lockMs = Math.min(
          LOCKOUT_BASE_MS * 2 ** (failedLogins - LOCKOUT_AFTER_FAILURES),
          LOCKOUT_MAX_MS,
        );
        await db
          .update(host)
          .set({ lockedUntil: new Date(now.getTime() + lockMs) })
          .where(eq(host.id, row.id));
      }
      throw new DomainError("INVALID_CREDENTIALS");
    }

    const token = await db.transaction(async (tx) => {
      await tx
        .update(host)
        .set({ failedLogins: 0, lockedUntil: null })
        .where(eq(host.id, row.id));
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

export async function requireHost(): Promise<{ hostId: string }> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/logg-inn");
  const result = await withBoundary("auth", "requireHost", async () =>
    readSession(await getDb(), token),
  );
  if (result === "missing") redirect("/logg-inn");
  if (result === "expired") redirect("/logg-inn?utlopt=1");
  return result;
}

// Cookie presence only, no DB read, so the 404 page renders with the DB down.
export async function hasSessionCookie(): Promise<boolean> {
  return (await cookies()).has(SESSION_COOKIE);
}
