import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import LoginPage from "@/app/logg-inn/page";
import { register } from "@/app/registrer/actions";
import SpillLayout from "@/app/spill/layout";
import GamesPage from "@/app/spill/page";
import { getDb } from "@/server/db/client";
import { session } from "@/server/db/schema";
import { RedirectError, run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));
// React's cache() memoises only inside a server render. This stand-in memoises for
// the whole file, which here is one request: the layout and the page rendering together.
vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
      const memo = new Map<string, R>();
      return (...args: A): R => {
        const key = JSON.stringify(args);
        if (!memo.has(key)) memo.set(key, fn(...args));
        return memo.get(key)!;
      };
    },
  };
});

vi.setConfig({ testTimeout: 30_000 });

it("FR-1: a hard load of /spill with a session past its 14 days sends both layout and page to /logg-inn?utlopt=1, which shows the notice", async () => {
  await run(register, {
    email: "utlopt@example.test",
    password: "riktig-passord-123",
  });
  await (
    await getDb()
  )
    .update(session)
    .set({ expiresAt: new Date(Date.now() - 1000) });

  // One after the other: the worst order Next's parallel segment rendering can produce,
  // where the first read has already deleted the expired row.
  for (const render of [() => SpillLayout({ children: null }), GamesPage]) {
    const reason = await render().then(
      () => null,
      (e: unknown) => e,
    );
    expect(reason).toBeInstanceOf(RedirectError);
    expect((reason as RedirectError).url).toBe("/logg-inn?utlopt=1");
  }

  const html = renderToStaticMarkup(
    await LoginPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ utlopt: "1" }),
    }),
  );
  expect(html).toContain(
    "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen.",
  );
});
