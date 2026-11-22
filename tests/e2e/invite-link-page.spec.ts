import { randomBytes, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { storageKey } from "@/lib/invite-link";
import {
  expect,
  localOnly,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const UNKNOWN_HEADING = "Vi finner ikke denne lenken.";
const UNKNOWN_BODY =
  "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny.";
const CLOSED_HEADING = "Innsamlingen er stengt.";
const CLOSED_TITLE = "Innsamlingen er stengt – Toppsvar";
const CLOSED_BODY =
  "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres.";
const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";
const QUESTION = "Hva gjør Jonas når han har forsovet seg?";

async function createGame(page: Page, title: string): Promise<string> {
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill(title);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText(title);
  return new URL(page.url()).pathname.slice("/spill/".length);
}

async function addQuestion(page: Page, n: number, text: string) {
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByLabel(`Spørsmål ${n}`, { exact: true }).fill(text);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("region", { name: "Spørsmål" }).getByRole("status"),
  ).toHaveText("Lagret");
}

// A collecting Game with one Question; returns its gameId and one full link.
async function collectingGame(page: Page, title: string) {
  const gameId = await createGame(page, title);
  await addQuestion(page, 1, QUESTION);
  await page.getByLabel("Antall lenker").fill("1");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  const link = (await page.locator("[data-link]").first().textContent())!;
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  return { gameId, link, token: link.split("#")[1] };
}

const pathOf = (link: string) => new URL(link).pathname;

// From another page first, so a link differing only in its fragment still loads anew.
// The seeded value is a link store for this exact Token, so closed and unknown clear it.
async function openWithSeededKey(
  page: Page,
  gameId: string,
  token: string,
  extra: object = {},
) {
  const key = storageKey(gameId, token);
  await page.goto("/");
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k, v),
    [key, JSON.stringify({ token, ...extra })],
  );
  await page.goto(`/svar/${gameId}#${token}`);
  return key;
}

const legend = (page: Page) =>
  page.getByRole("group", { name: `Spørsmål 1 av 1: ${QUESTION}` });

const storedValue = (page: Page, key: string) =>
  page.evaluate((k) => localStorage.getItem(k), key);

async function noHorizontalScroll(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

test("FR-11, AD-7: the server HTML is generic, sent with no-referrer, and no request URL carries the Token", async ({
  page,
  browser,
}) => {
  await registerHost(page);
  const { link, token } = await collectingGame(page, "Hyttetur 2026");

  const response = await page.request.get(pathOf(link));
  expect(response.status()).toBe(200);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  const html = await response.text();
  expect(html).toContain("<title>Toppsvar</title>");
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  expect(html).not.toMatch(/property="og:/);
  expect(html).not.toContain("Hyttetur 2026");
  expect(html).not.toContain(QUESTION);

  // A Participant's own browser, without the Host's cookie.
  const context = await browser.newContext();
  await localOnly(context);
  const participant = await context.newPage();
  const sent: string[] = [];
  participant.on("request", (r) => {
    const url = new URL(r.url());
    url.hash = ""; // the fragment never leaves the browser
    sent.push(url.href);
  });
  await participant.goto(link);
  await expect(participant.locator("h1")).toHaveText("Hyttetur 2026");
  await expect(participant).toHaveTitle("Hyttetur 2026 – Toppsvar");
  await expect(legend(participant)).toBeVisible();
  expect(sent.length).toBeGreaterThan(1);
  for (const url of sent) expect(url).not.toContain(token);
  await context.close();
});

test("FR-1, UX-DR27: with a Host session cookie the link page shows no Host chrome or Host link and sets no cookie", async ({
  page,
}) => {
  await registerHost(page);
  const { link } = await collectingGame(page, "Med økt");
  const response = await page.goto(link);
  await expect(page.locator("h1")).toHaveText("Med økt");
  expect(await response!.headerValue("set-cookie")).toBeNull();
  await expect(page.getByText("Toppsvar", { exact: true })).toBeVisible();
  for (const text of ["Logg ut", "Mine spill", "Hopp til innhold"])
    await expect(page.getByText(text)).toHaveCount(0);
  await expect(page.locator('a[href^="/spill"], a[href="/"]')).toHaveCount(0);
  await expect(page.locator("nav")).toHaveCount(0);
});

test("FR-9, FR-3: a missing or malformed Game, a malformed or unknown Token and a deleted Game's link show one unknown page and clear the key", async ({
  page,
}) => {
  await registerHost(page);
  const open = await collectingGame(page, "Åpent spill");
  const deleted = await collectingGame(page, "Slettes");
  await page.goto(`/spill/${deleted.gameId}`);
  await page.getByRole("button", { name: "Slett spillet" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Slett for godt" })
    .click();
  await expect(page).toHaveURL("/spill");

  const unknownToken = randomBytes(32).toString("base64url");
  const cases: [string, string, string][] = [
    ["random UUID", randomUUID(), open.token],
    ['"abc" gameId', "abc", open.token],
    ["malformed Token", open.gameId, "abc"],
    ["unknown Token", open.gameId, unknownToken],
    ["deleted Game", deleted.gameId, deleted.token],
  ];
  for (const [name, gameId, token] of cases) {
    const key = await openWithSeededKey(page, gameId, token);
    await expect(page.locator("h1"), name).toHaveText(UNKNOWN_HEADING);
    await expect(page.getByText(UNKNOWN_BODY), name).toBeVisible();
    await expect(page, name).toHaveTitle("Vi finner ikke lenken – Toppsvar");
    await expect.poll(() => storedValue(page, key), name).toBeNull();
  }
});

test("FR-10, UX-DR20: a link of a Game that is not collecting (a draft) shows the closed page and clears the whole key, unsent draft included", async ({
  page,
}) => {
  await registerHost(page);
  const gameId = await createGame(page, "Fortsatt utkast");
  const key = await openWithSeededKey(
    page,
    gameId,
    randomBytes(32).toString("base64url"),
    { draft: { q: ["Utkast som ikke er sendt", ""] } },
  );
  await expect(page.locator("h1")).toHaveText(CLOSED_HEADING);
  await expect(page.getByText(CLOSED_BODY)).toBeVisible();
  await expect(page).toHaveTitle(CLOSED_TITLE);
  await expect.poll(() => storedValue(page, key)).toBeNull();
  await expect(page.getByText("Fortsatt utkast")).toHaveCount(0);
});

test("NFR-4, NFR-6: at 360 px the open, closed and unknown pages have no horizontal scroll and no serious axe violations", async ({
  page,
}) => {
  await registerHost(page);
  const { gameId, link } = await collectingGame(page, "Smal skjerm");
  const draftId = await createGame(page, "Smalt utkast");
  await page.setViewportSize({ width: 360, height: 740 });

  const pages: [string, string][] = [
    [link, "Smal skjerm"],
    [
      `/svar/${draftId}#${randomBytes(32).toString("base64url")}`,
      CLOSED_HEADING,
    ],
    [`/svar/${gameId}#abc`, UNKNOWN_HEADING],
    [`/svar/${randomUUID()}#abc`, UNKNOWN_HEADING],
  ];
  for (const [url, heading] of pages) {
    await page.goto("/");
    await page.goto(url);
    await expect(page.locator("h1"), url).toHaveText(heading);
    expect(await noHorizontalScroll(page), url).toBe(true);
    expect(await seriousViolations(page), url).toEqual([]);
  }
});

test("NFR-6, UX-DR23: an aborted openInviteLink request shows the network message, and Prøv igjen loads the Questions", async ({
  page,
}) => {
  await registerHost(page);
  const { link } = await collectingGame(page, "Uten nett");
  await page.route("**/svar/**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.goto(link);
  await expect(page.locator("main").getByRole("alert")).toHaveText(NETWORK);
  await expect(page).toHaveTitle("Noe gikk galt – Toppsvar");
  const retry = page.getByRole("button", { name: "Prøv igjen" });
  await expect(retry).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(0);

  await page.unrouteAll();
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText("Uten nett");
  await expect(page.locator("h1")).toBeFocused();
  await expect(legend(page)).toBeVisible();
});

test("FR-1, UX-DR27: unmatched /svar URLs show the unknown page without Host chrome, even with a Host session", async ({
  page,
}) => {
  await registerHost(page);
  for (const url of ["/svar", `/svar/${randomUUID()}/x`]) {
    await page.goto(url);
    await expect(page.locator("h1"), url).toHaveText(UNKNOWN_HEADING);
    for (const text of ["Mine spill", "Logg ut"])
      await expect(page.getByText(text), url).toHaveCount(0);
    await expect(page.locator("nav"), url).toHaveCount(0);
  }
});

test("FR-9: pasting a replacement link in the same tab (only the fragment changes) loads it", async ({
  page,
}) => {
  await registerHost(page);
  const { gameId, token } = await collectingGame(page, "Ny lenke");
  await openWithSeededKey(page, gameId, randomBytes(32).toString("base64url"));
  await expect(page.locator("h1")).toHaveText(UNKNOWN_HEADING);
  await page.evaluate((t) => (location.hash = t), token);
  await expect(page.locator("h1")).toHaveText("Ny lenke");
});

test("FR-10, FR-11, NFR-6: a client-side COLLECTION_CLOSED shows the closed page and clears the key; INTERNAL shows the alert and keeps it", async ({
  page,
}) => {
  await registerHost(page);
  const { gameId } = await collectingGame(page, "Omskrevet svar");
  const INTERNAL = "Noe gikk galt hos oss. Prøv igjen om litt.";
  const rewrites: [string, string][][] = [
    [
      ['"code":"LINK_UNKNOWN"', '"code":"INTERNAL"'],
      ['"message":"Vi finner ikke denne lenken."', `"message":"${INTERNAL}"`],
    ],
    [['"code":"LINK_UNKNOWN"', '"code":"COLLECTION_CLOSED"']],
  ];
  for (const [i, rewrite] of rewrites.entries()) {
    await page.unrouteAll();
    // A real LINK_UNKNOWN response for an unknown Token, with its body rewritten.
    await page.route("**/svar/**", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      let body = await response.text();
      for (const [from, to] of rewrite) {
        expect(body).toContain(from);
        body = body.replace(from, to);
      }
      const headers = response.headers();
      delete headers["content-length"];
      await route.fulfill({ response, headers, body });
    });
    const token = randomBytes(32).toString("base64url");
    const key = await openWithSeededKey(page, gameId, token);
    if (i === 0) {
      await expect(page.locator("main").getByRole("alert")).toHaveText(
        INTERNAL,
      );
      await expect(
        page.getByRole("button", { name: "Prøv igjen" }),
      ).toBeVisible();
      await expect(page.locator("h1")).toHaveCount(0);
      await expect(page.getByText(UNKNOWN_HEADING)).toHaveCount(0);
      await expect(page.getByText(CLOSED_HEADING)).toHaveCount(0);
      expect(await storedValue(page, key)).toBe(JSON.stringify({ token }));
    } else {
      await expect(page.locator("h1")).toHaveText(CLOSED_HEADING);
      await expect(page.getByText(CLOSED_BODY)).toBeVisible();
      await expect(page).toHaveTitle(CLOSED_TITLE);
      await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
      await expect.poll(() => storedValue(page, key)).toBeNull();
    }
  }
});

test("FR-9: a cut-short link that shares the real link's key shows the unknown page and leaves the real link's value alone", async ({
  page,
}) => {
  await registerHost(page);
  const { gameId, token } = await collectingGame(page, "Avkuttet lenke");
  const key = storageKey(gameId, token);
  const value = JSON.stringify({ token });
  await page.goto("/");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
  const cutShort = `${token.slice(0, 16)}x`;
  expect(storageKey(gameId, cutShort)).toBe(key);
  await page.goto(`/svar/${gameId}#${cutShort}`);
  await expect(page.locator("h1")).toHaveText(UNKNOWN_HEADING);
  await expect(page.getByText(UNKNOWN_BODY)).toBeVisible();
  // LinkStatus clears in an effect after the heading renders; let it run first.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      ),
  );
  expect(await storedValue(page, key)).toBe(value);
});
