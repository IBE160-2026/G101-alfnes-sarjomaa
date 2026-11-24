import type { Locator, Page } from "@playwright/test";
import { QUESTION_SETS } from "@/lib/question-sets";
import { expect, registerHost, seriousViolations, test } from "./fixtures";

const [home] = QUESTION_SETS;
// Spec 8.5: the TV page shows each Host view move within 1.5 s.
const SYNC = { timeout: 1_500 };

// A playing Game from the first Question set, started on the Host view with Lag 1 and Lag 2.
async function playingOnHostView(page: Page) {
  await registerHost(page);
  await page
    .getByLabel("Spørsmål", { exact: true })
    .selectOption({ label: home.name });
  await page.getByLabel("Navn på spillet").fill("Fredag");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText("Fredag");
  const gamePath = new URL(page.url()).pathname;
  await page.goto(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);
  return gamePath;
}

const fontSize = (locator: Locator) =>
  locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

test("FR-24 to FR-27 (AC4), AD-17, NFR-5: every move on the Host view shows on the TV page in the same browser within 1.5 s, Bom and Sluttstilling included", async ({
  page,
  context,
}) => {
  const gamePath = await playingOnHostView(page);
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto(`${gamePath}/tv`);
  await expect(tv.locator("h1")).toHaveText(home.questions[0].text);

  const key = page.getByRole("list", { name: "Fasit" }).getByRole("listitem");
  const tile = (n: number) =>
    tv
      .locator(".stage-canvas > ol")
      .getByRole("listitem")
      .nth(n - 1);
  const label = async (n: number) =>
    (await key
      .nth(n - 1)
      .locator("span")
      .nth(1)
      .textContent())!;
  const current = tv.locator('[aria-current="true"]');
  await expect(current).toContainText("Lag 1");

  // A Reveal by button, then one by key: the TV shows the label, animates it, and scores it.
  await page.getByRole("button", { name: "Avslør plass 1" }).click();
  await expect(tile(1)).toContainText(await label(1), SYNC);
  await expect(tile(1).locator("[data-revealing]")).toHaveCount(1);
  await expect(key.nth(0)).toContainText("Avslørt");
  const firstCount = await key.nth(0).locator("span").nth(2).textContent();
  await expect(current).toContainText(`${firstCount!.trim()}`, SYNC);
  await page.keyboard.press("2");
  await expect(tile(2)).toContainText(await label(2), SYNC);

  // Bom is not saved: the TV shows its panel from the channel message.
  await page.getByRole("button", { name: "Bom [M]" }).click();
  await expect(tv.locator(".bom-panel")).toBeVisible(SYNC);
  await expect(page.locator(`p[role="status"]`)).toHaveText("Bom.");

  // Angre hides slot 2 again on both pages.
  await page.getByRole("button", { name: "Angre [Z]" }).click();
  await expect(tile(2)).not.toContainText(await label(2), SYNC);
  await expect(
    page.getByRole("button", { name: "Avslør plass 2" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Neste lag [T]" }).click();
  await expect(current).toContainText("Lag 2", SYNC);
  await expect(page.locator(`p[role="status"]`)).toHaveText("Lag 2 svarer nå.");

  // Through every Question to Vis sluttstilling: both pages end on Sluttstilling.
  for (const [i, q] of home.questions.entries()) {
    if (i === 0) continue;
    await page.getByRole("button", { name: "Neste spørsmål [N]" }).click();
    await expect(page.locator("h1")).toHaveText(q.text);
    await expect(tv.locator("h1")).toHaveText(q.text, SYNC);
  }
  await page.getByRole("button", { name: "Vis sluttstilling [N]" }).click();
  await expect(page.locator("h1")).toHaveText("Sluttstilling");
  await expect(tv.locator("h1")).toHaveText("Sluttstilling", SYNC);
  await expect(tv.getByText("Tilbake til spillet")).toHaveCount(0);
  await expect(page.getByText("Tilbake til spillet")).toBeVisible();
});

test("FR-24 (AC5): on the TV page the play keys do nothing and there is no button; F toggles fullscreen", async ({
  page,
}) => {
  const gamePath = await playingOnHostView(page);
  await page.goto(`${gamePath}/tv`);
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);
  await expect(page.getByRole("button")).toHaveCount(0);
  const before = await page.locator(".stage-canvas").innerHTML();
  for (const key of ["1", "m", "z", "t", "u", "n", "ArrowRight", "?"])
    await page.keyboard.press(key);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".bom-panel")).toHaveCount(0);
  // Saved state is unchanged: a fresh read shows the same Board, Team and Question.
  await page.reload();
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);
  expect(await page.locator(".stage-canvas").innerHTML()).toBe(before);

  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement !== null))
    .toBe(true);
  await page.keyboard.press("f");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement))
    .toBeNull();
});

test("FR-24 (AC6), NFR-6: the TV page fills 1920×1080 with labels and Scores of 48 px or more, the Host view fits 1280×800, and axe finds nothing serious on either", async ({
  page,
  context,
}) => {
  const gamePath = await playingOnHostView(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Avslør plass 1" }).click();
  await expect(page.getByText("Avslørt", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);

  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto(`${gamePath}/tv`);
  await expect(tv.locator("h1")).toHaveText(home.questions[0].text);
  expect(await tv.locator(".stage-canvas").boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
  });
  const revealed = tv.locator("[data-slot]").first();
  expect(await fontSize(revealed.locator(".reveal-label"))).toBe(48);
  expect(await fontSize(revealed.locator(".reveal-count"))).toBe(48);
  for (const score of await tv.locator(".score-count").all())
    expect(await fontSize(score)).toBeGreaterThanOrEqual(48);
  expect(await seriousViolations(tv)).toEqual([]);
});
