import { createHash, scrypt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logOut } from "@/app/actions";
import { logIn } from "@/app/logg-inn/actions";
import { register } from "@/app/registrer/actions";
import * as auth from "@/server/auth";
import { hashPassword } from "@/server/auth/password";
import { getDb } from "@/server/db/client";
import { host, session } from "@/server/db/schema";
import { cookieJar, RedirectError, run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return { ...real, scrypt: vi.fn(real.scrypt) };
});

const PASSWORD = "riktig-passord-123";
const COOKIE = "toppsvar_session";
const DAY = 24 * 60 * 60 * 1000;
let n = 0;
const newEmail = () => `vert-${++n}@example.test`;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => cookieJar.store.get(COOKIE)!;

async function hostRow(email: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(host)
    .where(eq(sql`lower(${host.email})`, email.toLowerCase()));
  return row;
}

async function sessionRows() {
  return (await getDb()).select().from(session);
}

async function redirectOf(fn: () => Promise<unknown>): Promise<string> {
  const error = await fn().then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(RedirectError);
  return (error as RedirectError).url;
}

beforeEach(() => {
  cookieJar.store.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("register", () => {
  it("FR-1: stores the password only as a scrypt string and lands on /spill", async () => {
    const email = newEmail();
    expect(await run(register, { email, password: PASSWORD })).toEqual({
      redirect: "/spill",
    });
    const row = await hostRow(email);
    expect(row.passwordHash).toMatch(/^scrypt\$131072\$8\$1\$[^$]+\$[^$]+$/);
    expect(JSON.stringify(row)).not.toContain(PASSWORD);
  });

  it.each([
    [9, "Passordet må ha minst 10 tegn."],
    [257, "Passordet kan ha maks 256 tegn."],
  ])(
    "FR-1: a %i-character password is refused and creates no Host",
    async (length, message) => {
      const email = newEmail();
      expect(
        await run(register, { email, password: "p".repeat(length) }),
      ).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Sjekk feltene som er merket, og prøv igjen.",
        fieldErrors: { password: message },
      });
      expect(await hostRow(email)).toBeUndefined();
      expect(scrypt).not.toHaveBeenCalled();
    },
  );

  it("FR-1: the same email in another case and with spaces gives EMAIL_TAKEN", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    expect(
      await run(register, {
        email: `  ${email.toUpperCase()} `,
        password: PASSWORD,
      }),
    ).toEqual({
      ok: false,
      code: "EMAIL_TAKEN",
      message: "Det finnes allerede en konto med denne e-posten.",
      fieldErrors: {
        email: "Det finnes allerede en konto med denne e-posten.",
      },
    });
  });

  it("FR-1: without REGISTRATION_CODE a submitted code is ignored", async () => {
    expect(
      await run(register, {
        email: newEmail(),
        password: PASSWORD,
        registrationCode: "hva som helst",
      }),
    ).toEqual({ redirect: "/spill" });
  });
});

describe("logIn", () => {
  it("FR-1: unknown email and wrong password give the same result; the unknown email runs one scrypt", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    vi.clearAllMocks();

    const unknown = await run(logIn, {
      email: newEmail(),
      password: PASSWORD,
    });
    expect(scrypt).toHaveBeenCalledTimes(1);
    const wrong = await run(logIn, { email, password: "feil-passord-123" });
    expect(unknown).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Feil e-post eller passord.",
    });
    expect(wrong).toEqual(unknown);
  });

  it("FR-1: a password over 256 characters is refused without hashing", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    vi.clearAllMocks();
    expect(
      await run(logIn, { email, password: "p".repeat(257) }),
    ).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(scrypt).not.toHaveBeenCalled();
  });

  it("FR-1: the right password with the email in another case logs in", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    cookieJar.store.clear();
    expect(
      await run(logIn, {
        email: ` ${email.toUpperCase()}`,
        password: PASSWORD,
      }),
    ).toEqual({ redirect: "/spill" });
    expect(token()).toBeTruthy();
  });

  it("FR-1: locks after five failures, doubles the lock, refuses the right password while locked, and resets on success", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = new Date("2026-12-01T12:00:00Z").getTime();
    vi.setSystemTime(t0);
    const wrong = () => run(logIn, { email, password: "feil-passord-123" });
    const right = () => run(logIn, { email, password: PASSWORD });

    for (let i = 0; i < 4; i++) await wrong();
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 4,
      lockedUntil: null,
    });

    await wrong();
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 5,
      lockedUntil: new Date(t0 + 60_000),
    });

    vi.setSystemTime(t0 + 30_000);
    expect(await right()).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((await hostRow(email)).failedLogins).toBe(5);

    const t1 = t0 + 61_000;
    vi.setSystemTime(t1);
    await wrong();
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 6,
      lockedUntil: new Date(t1 + 120_000),
    });

    vi.setSystemTime(t1 + 121_000);
    expect(await right()).toEqual({ redirect: "/spill" });
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 0,
      lockedUntil: null,
    });
  });

  it("FR-1: the doubling lock stops at 24 hours", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = new Date("2026-12-01T12:00:00Z").getTime();
    vi.setSystemTime(t0);
    // Uncapped, the 16th failure would lock for 2^11 minutes, about 34 hours.
    await (
      await getDb()
    )
      .update(host)
      .set({ failedLogins: 15 })
      .where(eq(sql`lower(${host.email})`, email));
    await run(logIn, { email, password: "feil-passord-123" });
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 16,
      lockedUntil: new Date(t0 + DAY),
    });
  });

  it("FR-1: a wrong password while locked changes neither the count nor the lock", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    const lockedUntil = new Date(Date.now() + 60 * 60_000);
    const db = await getDb();
    await db
      .update(host)
      .set({ failedLogins: 5, lockedUntil })
      .where(eq(sql`lower(${host.email})`, email));
    expect(
      await run(logIn, { email, password: "feil-passord-123" }),
    ).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 5,
      lockedUntil,
    });
  });

  it("FR-1: a lock set while a right-password login waits for scrypt refuses it and creates no session", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    const { id } = await hostRow(email);
    await (await getDb()).delete(session).where(eq(session.hostId, id));

    // Both scrypt slots busy, so the login reads its row and then queues.
    const busy = [hashPassword("opptatt-1-xyz"), hashPassword("opptatt-2-xyz")];
    const login = run(logIn, { email, password: PASSWORD });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await (
      await getDb()
    )
      .update(host)
      .set({ lockedUntil: new Date(Date.now() + 60 * 60_000) })
      .where(eq(host.id, id));
    await Promise.all(busy);

    expect(await login).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((await sessionRows()).filter((r) => r.hostId === id)).toEqual([]);
  });

  it("FR-1: a lock set while a wrong-password login waits for scrypt is neither counted on nor changed", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    const { id } = await hostRow(email);

    const busy = [hashPassword("opptatt-1-xyz"), hashPassword("opptatt-2-xyz")];
    const login = run(logIn, { email, password: "feil-passord-123" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const lockedUntil = new Date(Date.now() + 60 * 60_000);
    await (
      await getDb()
    )
      .update(host)
      .set({ failedLogins: 5, lockedUntil })
      .where(eq(host.id, id));
    await Promise.all(busy);

    expect(await login).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(await hostRow(email)).toMatchObject({
      failedLogins: 5,
      lockedUntil,
    });
  });
});

describe("sessions", () => {
  it("FR-1: the cookie is httpOnly, SameSite=Lax, 14 days, not Secure on http, and the DB holds only sha256(token)", async () => {
    const email = newEmail();
    await run(register, { email, password: PASSWORD });
    expect(cookieJar.set).toHaveBeenCalledWith(COOKIE, token(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 1_209_600,
      secure: false,
    });
    expect(Buffer.from(token(), "base64url")).toHaveLength(32);

    const { id } = await hostRow(email);
    const rows = (await sessionRows()).filter((r) => r.hostId === id);
    expect(rows.map((r) => r.tokenHash)).toEqual([sha256(token())]);
    expect(JSON.stringify(await sessionRows())).not.toContain(token());
  });

  it("FR-1: requireHost returns the Host and extends expires_at at most hourly", async () => {
    const email = newEmail();
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = new Date("2026-12-01T12:00:00Z").getTime();
    vi.setSystemTime(t0);
    await run(register, { email, password: PASSWORD });
    const { id } = await hostRow(email);
    const expiresAt = async () =>
      (await sessionRows()).find((r) => r.tokenHash === sha256(token()))!
        .expiresAt;

    vi.setSystemTime(t0 + 30 * 60_000);
    expect(await auth.requireHost()).toEqual({ hostId: id });
    expect(await expiresAt()).toEqual(new Date(t0 + 14 * DAY));

    const t1 = t0 + 2 * 60 * 60_000;
    vi.setSystemTime(t1);
    expect(await auth.requireHost()).toEqual({ hostId: id });
    expect(await expiresAt()).toEqual(new Date(t1 + 14 * DAY));

    vi.setSystemTime(t1 + 14 * DAY);
    expect(await redirectOf(auth.requireHost)).toBe("/logg-inn?utlopt=1");
    expect(
      (await sessionRows()).some((r) => r.tokenHash === sha256(token())),
    ).toBe(false);
    // The row is gone, so a reload is a plain redirect without the notice.
    expect(await redirectOf(auth.requireHost)).toBe("/logg-inn");
  });

  it("FR-1: no cookie or an unknown cookie redirects to /logg-inn", async () => {
    expect(await redirectOf(auth.requireHost)).toBe("/logg-inn");
    cookieJar.store.set(COOKIE, "ukjent");
    expect(await redirectOf(auth.requireHost)).toBe("/logg-inn");
  });

  it("FR-1: logout deletes the session row and the cookie, then lands on /", async () => {
    await run(register, { email: newEmail(), password: PASSWORD });
    const hash = sha256(token());
    expect(await run(logOut, {})).toEqual({ redirect: "/" });
    expect(cookieJar.delete).toHaveBeenCalledWith(COOKIE);
    expect(cookieJar.store.has(COOKIE)).toBe(false);
    expect((await sessionRows()).some((r) => r.tokenHash === hash)).toBe(false);
    expect(await redirectOf(auth.requireHost)).toBe("/logg-inn");
  });
});
