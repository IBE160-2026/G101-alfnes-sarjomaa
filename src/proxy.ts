import { NextResponse, type NextRequest } from "next/server";
import { DELETED_COOKIE } from "@/app/spill/deleted-notice";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth";

// Keeps the browser's session cookie alive 14 days from last use. It decides no
// access and reads no DB; the session row's expires_at stays the authority.
// Non-GET requests are skipped so this never races an action's own Set-Cookie.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.method !== "GET") return response;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  // The delete notice shows once: in the render that deleteGame's redirect streams back,
  // an internal GET on which Next forwards the action's x-action-redirect header. Any
  // later GET clears it, and the page then reads it as empty.
  if (
    request.cookies.has(DELETED_COOKIE) &&
    !request.headers.has("x-action-redirect")
  )
    response.cookies.delete({ name: DELETED_COOKIE, path: "/spill" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|svar(?:/|$)|.*\\..*).*)"],
};
