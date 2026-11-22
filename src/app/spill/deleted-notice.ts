import { env } from "@/server/env";

// The "«{title}» er slettet." notice on /spill (FR-3). A short-lived httpOnly cookie
// set by deleteGame, so a crafted link cannot put text in the success box.
// src/proxy.ts clears it on the request after the one that shows it.
export const DELETED_COOKIE = "toppsvar_slettet";

export const deletedCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/spill",
  maxAge: 60,
  secure: env.APP_BASE_URL.startsWith("https:"),
} as const;
