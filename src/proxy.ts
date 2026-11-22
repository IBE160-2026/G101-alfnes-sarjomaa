import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";

// Keeps the browser's session cookie alive 14 days from last use. It decides no
// access and reads no DB; the session row's expires_at stays the authority.
// Non-GET requests are skipped so this never races login or logout Set-Cookie.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (request.method === "GET" && token)
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|svar|.*\\..*).*)"],
};
