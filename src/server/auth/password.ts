import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { DomainError } from "@/lib/errors";
import { SCRYPT_CONCURRENCY, SCRYPT_QUEUE_MAX } from "@/lib/limits";

const N = 131072; // 2^17
const R = 8;
const P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
// scrypt needs 128 * N * r bytes (128 MiB here); Node's default cap is 32 MiB.
const MAXMEM = 256 * 1024 * 1024;

// A real hash of a random, discarded password, so an unknown email costs one scrypt run like a known one.
export const DUMMY_HASH =
  "scrypt$131072$8$1$pr8Gvias7EtgRgTFwuZYaA==$o3Ic1wRDfIml6CE/QhYNOVuzmTqySBU5keQfgD/LY+U=";

// shortcut: the queue cap is per process and there is no per-IP rate limit, so a flood on one serverless instance refuses real Hosts there instead of delaying them; add a per-IP limit if Hosts in the pilot report "Prøv igjen om litt" at login.
let active = 0;
const waiting: (() => void)[] = [];

// At most SCRYPT_CONCURRENCY runs per process; a finished run hands its slot to the next waiter.
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active < SCRYPT_CONCURRENCY) active++;
  else if (waiting.length >= SCRYPT_QUEUE_MAX)
    throw new DomainError("INTERNAL");
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keylen: number,
): Promise<Buffer> {
  return limited(
    () =>
      new Promise((resolve, reject) =>
        scrypt(
          password,
          salt,
          keylen,
          { N: n, r, p, maxmem: MAXMEM },
          (error, key) => (error ? reject(error) : resolve(key)),
        ),
      ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, N, R, P, KEY_BYTES);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

const FORMAT =
  /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/;

// Reads the parameters from the stored string; anything malformed verifies as false.
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const match = FORMAT.exec(stored);
  if (!match) return false;
  const [, n, r, p, salt, key] = match;
  const expected = Buffer.from(key, "base64");
  if (expected.length < KEY_BYTES) return false; // an empty key would match an empty derivation
  try {
    const actual = await derive(
      password,
      Buffer.from(salt, "base64"),
      Number(n),
      Number(r),
      Number(p),
      expected.length,
    );
    return timingSafeEqual(actual, expected);
  } catch (error) {
    if (error instanceof DomainError) throw error; // a full queue is not a wrong password
    return false; // invalid parameters in the stored string
  }
}
