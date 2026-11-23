import type { Locator } from "@playwright/test";
import {
  closeAndOpenReview,
  collectingGame,
  expect,
  FOCUS_RING_INVERSE,
  QUESTION,
  seriousViolations,
  submitSets,
  test,
} from "./fixtures";

const outline = (locator: Locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
  });

test("FR-23 (AC1, AC2), UX-DR22, NFR-6: a collecting Game's screen redirects to the Game page; after the lock Start spillet opens Team setup with Lag 1 and Lag 2, adds up to four and removes back to three, checks each name; start shows the play view with focus on the Question, no Host chrome and the inverse ring; F toggles fullscreen; a stale tab is told play has started; Fortsett spillet resumes the same Teams after a reload; axe is clean on setup and the play view", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page);

  // AC2: the screen of a Game that is not ready or playing lands on the Game page.
  await page.goto(`${gamePath}/skjerm`);
  await expect(page).toHaveURL(gamePath);

  // Through Review to ready.
  await submitSets(browser, baseURL, links);
  await closeAndOpenReview(page, gamePath);
  await page.getByRole("button", { name: "Marker som gjennomgått" }).click();
  await page
    .getByRole("navigation", { name: "Spørsmål" })
    .locator("..")
    .getByRole("button", { name: "Lås brettet" })
    .click();
  await page
    .getByRole("dialog", { name: "Låse brettet?" })
    .getByRole("button", { name: "Lås brettet" })
    .click();
  await expect(page).toHaveURL(gamePath);

  // Team setup: two prefilled fields and no Fjern.
  await page.getByRole("link", { name: "Start spillet" }).click();
  await expect(page).toHaveURL(`${gamePath}/skjerm`);
  await expect(page).toHaveTitle("Hyttetur – Toppsvar");
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  await expect(page.locator("h1")).toBeFocused();
  const field = (n: number) => page.getByLabel(`Navn på lag ${n}`);
  await expect(field(1)).toHaveValue("Lag 1");
  await expect(field(2)).toHaveValue("Lag 2");
  await expect(page.getByRole("button", { name: /^Fjern/ })).toHaveCount(0);

  // Up to four, each new field prefilled and focused; Legg til lag then goes.
  const add = page.getByRole("button", { name: "Legg til lag" });
  for (const n of [3, 4]) {
    await add.click();
    await expect(field(n)).toHaveValue(`Lag ${n}`);
    await expect(field(n)).toBeFocused();
  }
  await expect(add).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Fjern/ })).toHaveCount(4);

  // Fjern back to three: focus goes to Legg til lag, which is back.
  await page.getByRole("button", { name: "Fjern lag 4" }).click();
  await expect(field(4)).toHaveCount(0);
  await expect(add).toBeFocused();

  // Every field is checked: errors under the fields, focus on the first invalid one.
  await field(1).fill("");
  await field(2).fill("x".repeat(15));
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(field(1)).toBeFocused();
  await expect(field(1)).toHaveAccessibleDescription(
    "Feil: Laget trenger et navn.",
  );
  await expect(field(2)).toHaveAccessibleDescription(
    "Feil: Navnet kan ha maks 14 tegn.",
  );
  await field(1).fill("Hyttegjengen");
  await expect(field(1)).not.toHaveAttribute("aria-invalid");
  await expect(field(2)).toHaveAttribute("aria-invalid", "true");
  await field(2).fill("Lag 2");
  expect(await seriousViolations(page)).toEqual([]);

  // An aborted start: the focused network message, Team setup still shown.
  const isScreen = (url: URL) => url.pathname === `${gamePath}/skjerm`;
  await page.route(isScreen, (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await page.getByRole("button", { name: "Start spillet" }).click();
  const network = page
    .getByRole("alert")
    .filter({ hasText: "Fikk ikke kontakt." });
  await expect(network).toHaveText(
    "Fikk ikke kontakt. Sjekk nettet og prøv igjen.",
  );
  await expect(network).toBeFocused();
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  await page.unroute(isScreen);

  // A second tab, opened before the start and never refreshed.
  const stale = await page.context().newPage();
  await stale.goto(page.url());
  await expect(stale.getByLabel("Navn på lag 1")).toHaveValue("Lag 1");

  // Start by keyboard: the play view, focus on the Question, no Host chrome.
  await page.getByRole("button", { name: "Start spillet" }).focus();
  await page.keyboard.press("Enter");
  const stage = page.locator("[data-stage]");
  await expect(stage).toBeVisible();
  const question = page.locator("h1");
  await expect(question).toHaveText(QUESTION);
  await expect(question).toBeFocused();
  expect(await outline(question)).toBe(FOCUS_RING_INVERSE);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Hopp til innhold" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(0);
  const hint = page.getByText("Trykk F for fullskjerm.", { exact: true });
  await expect(hint).toBeVisible();
  const teams = stage.getByRole("listitem");
  await expect(teams).toHaveText([
    "Svarer nåHyttegjengen0 poeng",
    "Lag 20 poeng",
    "Lag 30 poeng",
  ]);
  await expect(
    stage.getByText("Spørsmål 1 av 1", { exact: true }),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // F with a modifier does nothing; F alone hides the hint in fullscreen, F again leaves it.
  await page.keyboard.press("Control+f");
  await expect(hint).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await page.keyboard.press("f");
  await expect(hint).toHaveCount(0);
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(
    true,
  );
  await page.keyboard.press("f");
  await expect(hint).toBeVisible();

  // The stale tab's start is refused, with a way to the Game page.
  await stale.getByRole("button", { name: "Start spillet" }).click();
  // Next's route announcer is an alert too, so the Notice is picked by its text.
  const started = stale
    .getByRole("alert")
    .filter({ hasText: "Spillet har allerede startet." });
  await expect(started).toHaveText(
    "Spillet har allerede startet. Gå til spillet",
  );
  await expect(started).toBeFocused();
  await stale.getByRole("link", { name: "Gå til spillet" }).click();
  await expect(stale).toHaveURL(gamePath);

  // AC1: the Game page resumes the same Teams, also after a reload.
  await expect(
    stale.getByRole("heading", { level: 2, name: "Spillet er i gang" }),
  ).toBeVisible();
  await stale.getByRole("link", { name: "Fortsett spillet" }).click();
  await expect(stale).toHaveURL(`${gamePath}/skjerm`);
  await stale.reload();
  await expect(stale.locator("h1")).toHaveText(QUESTION);
  await expect(stale.locator("[data-stage]").getByRole("listitem")).toHaveText([
    "Svarer nåHyttegjengen0 poeng",
    "Lag 20 poeng",
    "Lag 30 poeng",
  ]);
  await stale.close();
});
