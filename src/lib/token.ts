import { createHash, randomBytes } from "node:crypto";

// Invite link Tokens (AD-7): 32 random bytes, base64url. Only sha256(token) is stored.
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
