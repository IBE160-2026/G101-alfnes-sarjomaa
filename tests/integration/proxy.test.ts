import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const request = (method: string, cookie?: string) =>
  new NextRequest("http://localhost:3000/spill", {
    method,
    headers: cookie ? { cookie } : {},
  });

describe("proxy", () => {
  it("FR-1: a GET with the session cookie re-sets it for 14 days, httpOnly and SameSite=Lax", () => {
    const cookie = proxy(request("GET", "toppsvar_session=abc")).headers.get(
      "set-cookie",
    );
    expect(cookie).toContain("toppsvar_session=abc");
    expect(cookie).toContain("Max-Age=1209600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toMatch(/SameSite=lax/i);
  });

  it.each([
    ["a POST with the cookie", request("POST", "toppsvar_session=abc")],
    ["a GET without the cookie", request("GET")],
  ])("FR-1: %s gets no Set-Cookie", (_, req) => {
    expect(proxy(req).headers.get("set-cookie")).toBeNull();
  });
});
