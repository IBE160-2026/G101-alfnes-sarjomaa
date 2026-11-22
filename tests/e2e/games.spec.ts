import type { Page } from "@playwright/test";
import { formatDate } from "@/lib/format";
import {
  expect,
  FOCUS_RING,
  localOnly,
  registerHost,
  seriousViolations,
  tabThrough,
  test,
} from "./fixtures";

const EMPTY =
  "Du har ingen spill ennå. Gi det første et navn over, for eksempel «Hyttetur 2026».";
const TITLE_ERROR = "Navnet må ha 1–80 tegn.";
const NOT_FOUND = "Vi finner ikke dette spillet.";
const GAME_URL = /\/spill\/[0-9a-f-]{36}$/;

async function createGame(page: Page, title: string): Promise<string> {
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill(title);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page).toHaveURL(GAME_URL);
  await expect(page.locator("h1")).toHaveText(title);
  return new URL(page.url()).pathname;
}

async function expectFocusRingsAnd44px(page: Page) {
  const stops = await tabThrough(page);
  const interactive = page.locator(
    "a[href], button, input:not([type=hidden]), select, textarea",
  );
  expect(stops).toHaveLength(await interactive.count());
  for (const stop of stops) expect(stop.outline, stop.text).toBe(FOCUS_RING);
  // The skip link is 1 px until focused, so it is measured only in the header and main.
  const controls = page.locator(
    "header a, header button, main a, main button, main input",
  );
  for (const control of await controls.all())
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
}

test("FR-2, UX-DR16, UX-DR15: a new Host sees the empty state, creates a Game and lands on its page with breadcrumb, focused <h1> and Utkast", async ({
  page,
}) => {
  await registerHost(page);
  await expect(page.getByText(EMPTY)).toBeVisible();

  await page.getByLabel("Navn på spillet").fill("Hyttetur 2026");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page).toHaveURL(GAME_URL);
  const crumbs = page.getByRole("navigation", { name: "Brødsmulesti" });
  await expect(crumbs).toHaveText(/^Mine spill\s*›\s*Hyttetur 2026$/);
  await expect(
    crumbs.getByRole("link", { name: "Mine spill" }),
  ).toHaveAttribute("href", "/spill");
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText(
    "Hyttetur 2026",
  );
  const h1 = page.locator("h1");
  await expect(h1).toHaveText("Hyttetur 2026");
  await expect(h1).toBeFocused();
  await expect(page.locator("main").getByText("Utkast")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Spørsmål" })
      .getByText(/^Ingen spørsmål ennå\./),
  ).toBeVisible();
});

test("FR-2, NFR-6: an empty or 81-character title is refused on the field, and the counter starts at 60", async ({
  page,
}) => {
  await registerHost(page);
  const field = page.getByLabel("Navn på spillet");
  for (const title of ["", "a".repeat(81)]) {
    await field.fill(title);
    await page.getByRole("button", { name: "Lag spill" }).click();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(`Feil: ${TITLE_ERROR}`);
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(title);
    await expect(page).toHaveURL("/spill");
  }
  expect(await seriousViolations(page)).toEqual([]);

  await field.fill("a".repeat(59));
  await expect(page.getByText(/av 80 tegn/)).toHaveCount(0);
  await field.fill("a".repeat(60));
  await expect(page.getByText("60 av 80 tegn")).toBeVisible();
  const live = page.locator('form [aria-live="polite"]');
  await expect(live).toHaveText("");
  await field.fill("a".repeat(80));
  await expect(live).toHaveText("80 av 80 tegn");
  await field.fill("a".repeat(81));
  await expect(page.getByText("81 av 80 tegn", { exact: true })).toHaveCount(2);
  await expect(live).toHaveText("81 av 80 tegn");
});

test("FR-2, UX-DR5: Games are listed newest first with title link, Utkast and the date", async ({
  page,
}) => {
  await registerHost(page);
  // Before and after creating, so a run across midnight in Oslo still passes.
  const before = formatDate(new Date());
  const first = await createGame(page, "Julebord");
  const second = await createGame(page, "Hyttetur 2026");
  await page.goto("/spill");
  const rows = page.locator("main ul > li");
  await expect(rows).toHaveCount(2);
  const dates = [before, formatDate(new Date())];
  for (const [i, [title, href]] of [
    ["Hyttetur 2026", second],
    ["Julebord", first],
  ].entries()) {
    const row = rows.nth(i);
    await expect(row.getByRole("link", { name: title })).toHaveAttribute(
      "href",
      href,
    );
    await expect(row.getByText("Utkast")).toBeVisible();
    await expect(
      row.getByText(new RegExp(`^Sist endret (${dates.join("|")})$`)),
    ).toBeVisible();
  }
  expect(await seriousViolations(page)).toEqual([]);
  await expectFocusRingsAnd44px(page);
});

test("FR-1, FR-2, AD-5: Host B gets the same not-found page for A's Game, a random UUID and a malformed ID, and never sees A's Game", async ({
  page,
  browser,
  baseURL,
}) => {
  await registerHost(page);
  const gameOfA = await createGame(page, "As hemmelige spill");

  const contextB = await browser.newContext({ baseURL });
  await localOnly(contextB);
  const pageB = await contextB.newPage();
  await registerHost(pageB);
  await expect(pageB.locator("main")).not.toContainText("As hemmelige spill");

  const statuses = new Set<number>();
  for (const path of [gameOfA, `/spill/${crypto.randomUUID()}`, "/spill/abc"]) {
    const response = await pageB.goto(path);
    statuses.add(response!.status());
    await expect(pageB.locator("h1"), path).toHaveText(NOT_FOUND);
    await expect(
      pageB.getByRole("main").getByRole("link", { name: "Mine spill" }),
    ).toHaveAttribute("href", "/spill");
    await expect(pageB.locator("main")).not.toContainText("As hemmelige spill");
  }
  expect(statuses.size).toBe(1);
  expect(await seriousViolations(pageB)).toEqual([]);
  await contextB.close();
});

test("FR-1, AD-5: logged out, /spill and a Game page redirect to /logg-inn", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Låst ute");
  await page.context().clearCookies();
  for (const path of ["/spill", gamePath]) {
    // A real redirect from the spill layout, before any streaming starts.
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBeGreaterThanOrEqual(300);
    expect(response.status(), path).toBeLessThan(400);
    expect(response.headers()["location"], path).toMatch(/\/logg-inn$/);
    await page.goto(path);
    await expect(page).toHaveURL("/logg-inn");
  }
});

test("UX: a failed create request shows the network message, focuses it and keeps the title", async ({
  page,
}) => {
  await registerHost(page);
  await page.route("**/spill", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  const field = page.getByLabel("Navn på spillet");
  await field.fill("Uten nett");
  await page.getByRole("button", { name: "Lag spill" }).click();
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toHaveText(
    "Fikk ikke kontakt. Sjekk nettet og prøv igjen.",
  );
  await expect(alert).toBeFocused();
  await expect(field).toHaveValue("Uten nett");
  await expect(page).toHaveURL("/spill");
});

test("UX-DR15, UX-DR23: a slow Game page shows the skeleton after 300 ms, then focuses the streamed <h1>", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Treg forbindelse");
  await page.goto("/spill");
  await page.route(`**${gamePath}*`, async (route) => {
    const headers = route.request().headers();
    if (headers["rsc"] === "1" && !headers["next-router-prefetch"])
      await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.getByRole("link", { name: "Treg forbindelse" }).click();
  // A direct child of the content column, so the button spinner's aria-hidden svg cannot match.
  const skeleton = page.locator('main > div > [aria-hidden="true"]');
  await expect(skeleton).toHaveCSS("opacity", "1");
  await expect(skeleton.locator("h1")).toHaveCount(0);
  const h1 = page.locator("h1");
  await expect(h1).toHaveText("Treg forbindelse");
  await expect(h1).toBeFocused();
});

test("NFR-6: axe and keyboard checks on the empty /spill and on the Game page", async ({
  page,
}) => {
  await registerHost(page);
  await expect(page.getByText(EMPTY)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await createGame(page, "Tilgjengelig");
  expect(await seriousViolations(page)).toEqual([]);
  await page.reload();
  await expectFocusRingsAnd44px(page);
});
