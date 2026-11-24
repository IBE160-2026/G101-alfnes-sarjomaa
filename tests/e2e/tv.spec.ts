import type { Locator, Page } from "@playwright/test";
import { QUESTION_SETS } from "@/lib/question-sets";
import { expect, registerHost, seriousViolations, test } from "./fixtures";

const [home] = QUESTION_SETS;
// Spec 8.5: the TV page shows each Host view move within 1.5 s.
const SYNC = { timeout: 1_500 };

// A ready Game from the first Question set; returns its Game page path.
async function readyGame(page: Page) {
  await registerHost(page);
  await page
    .getByLabel("Spørsmål", { exact: true })
    .selectOption({ label: home.name });
  await page.getByLabel("Navn på spillet").fill("Fredag");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText("Fredag");
  return new URL(page.url()).pathname;
}

// The same Game, started on the Host view with Lag 1 and Lag 2.
async function playingOnHostView(page: Page) {
  const gamePath = await readyGame(page);
  await page.goto(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);
  return gamePath;
}

// The answer key's rows on the Host view, and a row's label.
const keyRows = (page: Page) =>
  page.getByRole("list", { name: "Fasit" }).getByRole("listitem");
const labelOf = async (page: Page, n: number) =>
  (await keyRows(page)
    .nth(n - 1)
    .locator("span")
    .nth(1)
    .textContent())!;
// The TV page's tile with rank n.
const tileOf = (tv: Page, n: number) =>
  tv
    .locator(".stage-canvas > ol")
    .getByRole("listitem")
    .nth(n - 1);

const fontSize = (locator: Locator) =>
  locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

test("FR-23 to FR-27 (AC4), AD-17: with the TV page reported hidden, so its poll never refreshes and only the channel can move it, Start spillet and every move on the Host view (buttons and keys) show on the TV page in the same browser within 1.5 s, Bom, unscored Reveals and Sluttstilling included", async ({
  page,
  context,
}) => {
  const gamePath = await readyGame(page);
  await page.goto(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  const tv = await context.newPage();
  // The poll refreshes only a visible page, so with the page reported hidden only the
  // channel can move it. (A fake clock also stops React's Suspense reveal timer.)
  await tv.addInitScript(() =>
    Object.defineProperty(document, "visibilityState", { get: () => "hidden" }),
  );
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto(`${gamePath}/tv`);
  await expect(tv.locator("h1")).toHaveText("Hvem spiller?");
  // Hydrated (React owns the form), so the channel listener is up before the Host starts.
  await tv.waitForFunction(() =>
    Object.keys(document.querySelector("form")!).some((k) =>
      k.startsWith("__reactFiber"),
    ),
  );

  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);
  await expect(tv.locator("h1")).toHaveText(home.questions[0].text, SYNC);

  const key = keyRows(page);
  const label = (n: number) => labelOf(page, n);
  const tile = (n: number) => tileOf(tv, n);
  const status = page.locator(`p[role="status"]`);
  const current = tv.locator('[aria-current="true"]');
  await expect(current).toContainText("Lag 1");

  // A Reveal by button: the revealed row takes focus, the TV shows, animates and scores it.
  await page.getByRole("button", { name: "Avslør plass 1" }).click();
  await expect(key.nth(0)).toBeFocused();
  await expect(key.nth(0)).toContainText("Avslørt");
  await expect(tile(1)).toContainText(await label(1), SYNC);
  await expect(tile(1).locator("[data-revealing]")).toHaveCount(1);
  const firstCount = await key.nth(0).locator("span").nth(2).textContent();
  await expect(current.locator(".sr-only")).toHaveText(firstCount!.trim());
  await page.keyboard.press("2");
  await expect(tile(2)).toContainText(await label(2), SYNC);

  // Angre by key with focus on the row it hides: Avslør plass 3 takes focus back.
  await page.getByRole("button", { name: "Avslør plass 3" }).click();
  await expect(key.nth(2)).toBeFocused();
  await expect(tile(3)).toContainText(await label(3), SYNC);
  await page.keyboard.press("z");
  await expect(
    page.getByRole("button", { name: "Avslør plass 3" }),
  ).toBeFocused();
  await expect(tile(3)).not.toContainText(await label(3), SYNC);

  // Bom is not saved: the TV shows its panel from the channel message.
  await page.keyboard.press("m");
  await expect(tv.locator(".bom-panel")).toBeVisible(SYNC);
  await expect(status).toHaveText("Bom.");

  await page.keyboard.press("t");
  await expect(current).toContainText("Lag 2", SYNC);
  await expect(status).toHaveText("Lag 2 svarer nå.");

  // An unscored Reveal: "Uten poeng" on the Host view, "uten poeng" on the TV, no Score.
  await page.getByRole("button", { name: "Vis resten uten poeng [U]" }).click();
  await expect(
    page.getByRole("button", { name: "Avslører uten poeng [U]" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Avslør plass 3" }).click();
  await expect(key.nth(2)).toContainText("Uten poeng");
  await expect(status).toHaveText(`«${await label(3)}» er avslørt uten poeng.`);
  await expect(tile(3)).toContainText("uten poeng", SYNC);
  await expect(current.locator(".sr-only")).toHaveText("0 poeng");
  await expect(
    page.locator('li[aria-current="true"] p.tabular-nums'),
  ).toHaveText("0 poeng");

  // Through every Question by n, → and the button, to Sluttstilling on both pages.
  for (const [i, q] of home.questions.entries()) {
    if (i === 0) continue;
    if (i === 1) await page.keyboard.press("n");
    else if (i === 2) await page.keyboard.press("ArrowRight");
    else await page.getByRole("button", { name: "Neste spørsmål [N]" }).click();
    await expect(page.locator("h1")).toHaveText(q.text);
    await expect(tv.locator("h1")).toHaveText(q.text, SYNC);
  }
  await page.getByRole("button", { name: "Vis sluttstilling [N]" }).click();
  await expect(page.locator("h1")).toHaveText("Sluttstilling");
  await expect(tv.locator("h1")).toHaveText("Sluttstilling", SYNC);
  // The Host view moves focus to its heading; the TV shows the room no focus ring.
  await expect(page.locator("h1")).toBeFocused();
  await expect(tv.locator("h1")).not.toBeFocused();
  await expect(tv.getByText("Tilbake til spillet")).toHaveCount(0);
  await expect(page.getByText("Tilbake til spillet")).toBeVisible();
});

test("FR-24, AD-17: a TV page in another browser (the same Host's login) follows a Reveal by polling within about 2 s, and its HTML never holds a hidden label", async ({
  page,
  context,
  browser,
}) => {
  const gamePath = await playingOnHostView(page);
  const labels = home.questions[0].groups.slice(0, 8).map((g) => g.label);
  // A separate context shares no BroadcastChannel with the Host view, only the session.
  const other = await browser.newContext({
    storageState: await context.storageState(),
  });
  const tv = await other.newPage();
  await tv.goto(`${gamePath}/tv`);
  await expect(tv.locator("h1")).toHaveText(home.questions[0].text);
  const html = await (await tv.request.get(`${gamePath}/tv`)).text();
  for (const label of labels) expect(html).not.toContain(label);

  await page.getByRole("button", { name: "Avslør plass 1" }).click();
  await expect(
    page.getByRole("list", { name: "Fasit" }).getByRole("listitem").first(),
  ).toContainText("Avslørt");
  await expect(tv.locator(".stage-canvas > ol")).toContainText(labels[0], {
    timeout: 3_000,
  });
  const after = await (await tv.request.get(`${gamePath}/tv`)).text();
  expect(after).toContain(labels[0]);
  for (const label of labels.slice(1)) expect(after).not.toContain(label);
  await other.close();
});

test("AD-17: a TV page polls while it shows something new, rests after 10 minutes with no change, and focus wakes it", async ({
  page,
  context,
}) => {
  const gamePath = await playingOnHostView(page);
  const tv = await context.newPage();
  await tv.clock.install();
  await tv.goto(`${gamePath}/tv`);
  await expect(tv.locator("h1")).toHaveText(home.questions[0].text);
  await tv.waitForFunction(() =>
    Object.keys(document.querySelector(".stage-canvas > ol")!).some((k) =>
      k.startsWith("__reactFiber"),
    ),
  );
  // router.refresh() fetches the page's RSC payload.
  let refreshes = 0;
  tv.on("request", (r) => {
    if (r.headers()["rsc"] === "1") refreshes++;
  });
  const polled = async () => {
    const before = refreshes;
    await tv.clock.runFor(2_000);
    await tv.waitForTimeout(1_000); // real time for a request to go out
    return refreshes > before;
  };

  await tv.clock.pauseAt(Date.now() + 1_000);
  expect(await polled()).toBe(true);
  // fastForward fires the poll once at the end: nothing changed for 10 minutes, so no refresh.
  await tv.clock.fastForward(10 * 60_000);
  expect(await polled()).toBe(false);
  expect(await polled()).toBe(false);
  await tv.evaluate(() => window.dispatchEvent(new Event("focus")));
  expect(await polled()).toBe(true);
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

test("FR-24 (AC6), NFR-6: Åpne TV-visning opens the TV page in its own window and a second click keeps it; the TV page fills 1920×1080 with labels and Scores of 48 px or more, the Host view fits 1280×800, axe finds nothing serious on either (the Host view also with the shortcut dialog open and uten poeng on); a move on /skjerm shows on the TV page within 1.5 s", async ({
  page,
}) => {
  const gamePath = await playingOnHostView(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page).toHaveTitle(/^Vertsvisning – Fredag/);
  const open = page.getByRole("link", { name: "Åpne TV-visning" });
  const [tv] = await Promise.all([page.waitForEvent("popup"), open.click()]);
  await tv.waitForURL(`**${gamePath}/tv`);
  await expect(tv).toHaveTitle(/^TV – Fredag/);
  await tv.evaluate(() => {
    (window as unknown as { kept: boolean }).kept = true;
  });
  await open.click();
  expect(
    await tv.evaluate(() => (window as unknown as { kept?: boolean }).kept),
  ).toBe(true);
  expect(new URL(tv.url()).pathname).toBe(`${gamePath}/tv`);

  await page.getByRole("button", { name: "Avslør plass 1" }).click();
  await expect(page.getByText("Avslørt", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press("?");
  await expect(
    page.getByRole("dialog", { name: "Hurtigtaster" }),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Vis resten uten poeng [U]" }).click();
  await expect(
    page.getByRole("button", { name: "Avslører uten poeng [U]" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await seriousViolations(page)).toEqual([]);
  const second = await labelOf(page, 2);

  await tv.setViewportSize({ width: 1920, height: 1080 });
  await expect(tv.locator("h1")).toHaveText(home.questions[0].text);
  await expect(tileOf(tv, 1).locator(".reveal-label")).toBeVisible();
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

  // The shared screen posts on the same channel, so the TV page follows it too.
  await page.goto(`${gamePath}/skjerm`);
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);
  await page.keyboard.press("2");
  await expect(tileOf(tv, 2)).toContainText(second, SYNC);
});
