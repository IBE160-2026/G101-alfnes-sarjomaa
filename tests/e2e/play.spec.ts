import type { Browser, Locator, Page } from "@playwright/test";
import {
  closeAndOpenReview,
  collectingGame,
  expect,
  QUESTION,
  seriousViolations,
  SETS,
  submitSets,
  test,
  WIDE_TEAMS,
} from "./fixtures";

// The play pages of a Game (spec 8.6): the Host view and the TV page, side by side in one
// browser, as two windows on one PC.
const SYNC = { timeout: 1_500 };
// Hydrated: React owns the element, so a key or channel listener in its tree is up.
const hydrated = (page: Page, selector: string) =>
  page.waitForFunction(
    (s) =>
      Object.keys(document.querySelector(s) ?? {}).some((k) =>
        k.startsWith("__react"),
      ),
    selector,
  );
async function openTv(page: Page, gamePath: string) {
  const tv = await page.context().newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto(`${gamePath}/tv`);
  // The TV's channel listener and the Host view's keys are up before the first move.
  await hydrated(tv, ".stage-canvas");
  await hydrated(page, `[aria-labelledby="fasit"]`);
  return tv;
}
// The Host view's answer key rows and Teams.
const keyRows = (page: Page) =>
  page.getByRole("list", { name: "Fasit" }).getByRole("listitem");
const hostTeams = (page: Page) =>
  page.getByRole("region", { name: "Lag" }).getByRole("listitem");
// The TV page's tile with rank n (a hidden tile has no data-slot).
const tvTile = (tv: Page, n: number) =>
  tv.locator(".stage-canvas > ol > li").nth(n - 1);

test("FR-23 (AC1, AC2), UX-DR22, NFR-6: a collecting Game's Team setup redirects to the Game page; after the lock Start spillet opens Team setup at /lag with Lag 1 and Lag 2, adds up to four and removes back to three, checks each name; start lands on the Game page with focus on its heading and the Teams at 0; the Host view and the TV page show the round, the TV with no Host chrome or link; a stale tab is told play has started; the Host view resumes the same Teams after a reload; axe is clean on setup, the Game page and the TV page", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page);

  // AC2: Team setup and the Host view of a Game that is not ready land on the Game page.
  for (const view of ["lag", "vert"]) {
    await page.goto(`${gamePath}/${view}`);
    await expect(page).toHaveURL(gamePath);
  }

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
  await expect(page).toHaveURL(`${gamePath}/lag`);
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
  const isLag = (url: URL) => url.pathname === `${gamePath}/lag`;
  await page.route(isLag, (route) =>
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
  await page.unroute(isLag);

  // A second tab, opened before the start and never refreshed.
  const stale = await page.context().newPage();
  await stale.goto(page.url());
  await expect(stale.getByLabel("Navn på lag 1")).toHaveValue("Lag 1");

  // Start by keyboard: the Game page in playing, focus on its heading.
  await page.getByRole("button", { name: "Start spillet" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(gamePath);
  await expect(page.locator("h1")).toHaveText("Hyttetur");
  await expect(page.locator("h1")).toBeFocused();
  const playing = page.getByRole("region", { name: "Spillet er i gang" });
  await expect(playing).toContainText("Spørsmål 1 av 1.");
  await expect(playing.locator("dl")).toHaveText(
    /Hyttegjengen\s*0 poeng\s*Lag 2\s*0 poeng\s*Lag 3\s*0 poeng/,
  );
  expect(await seriousViolations(page)).toEqual([]);

  // The Host view: the Question, the answer key's eight Avslør and the Teams.
  await playing.getByRole("link", { name: "Vertsvisning med fasit" }).click();
  await expect(page).toHaveURL(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText(QUESTION);
  await expect(
    page.getByRole("button", { name: /^Avslør plass [1-8]$/ }),
  ).toHaveCount(8);
  await expect(hostTeams(page)).toHaveText([
    "Svarer nåHyttegjengen0 poeng",
    "Lag 20 poeng",
    "Lag 30 poeng",
  ]);

  // The TV page: the same round, no Host chrome, no link and no button.
  const tv = await openTv(page, gamePath);
  const stage = tv.locator("[data-stage]");
  await expect(tv.locator("h1")).toHaveText(QUESTION);
  await expect(tv.getByRole("banner")).toHaveCount(0);
  await expect(tv.getByRole("link")).toHaveCount(0);
  await expect(tv.getByRole("button")).toHaveCount(0);
  await expect(
    stage.getByRole("list", { name: "Lag" }).getByRole("listitem"),
  ).toHaveText([
    "Svarer nåHyttegjengen0 poeng",
    "Lag 20 poeng",
    "Lag 30 poeng",
  ]);
  await expect(
    stage.getByText("Spørsmål 1 av 1", { exact: true }),
  ).toBeVisible();
  expect(await seriousViolations(tv)).toEqual([]);
  await tv.close();

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

  // AC1: the Game page resumes the same Teams on the Host view, also after a reload.
  await expect(
    stale.getByRole("heading", { level: 2, name: "Spillet er i gang" }),
  ).toBeVisible();
  await expect(
    stale.getByRole("link", { name: "Fortsett spillet" }),
  ).toHaveCount(0);
  await stale.getByRole("link", { name: "Vertsvisning med fasit" }).click();
  await expect(stale).toHaveURL(`${gamePath}/vert`);
  await stale.reload();
  await expect(stale.locator("h1")).toHaveText(QUESTION);
  await expect(hostTeams(stale)).toHaveText([
    "Svarer nåHyttegjengen0 poeng",
    "Lag 20 poeng",
    "Lag 30 poeng",
  ]);
  await stale.close();
});

// 200 characters: the worst case the vertical budget is drawn for (FR-24).
const LONG_QUESTION =
  "Hvem i gjengen kommer alltid for sent til hytta, glemmer nøkkelen hjemme, spiser opp all sjokoladen før lørdag og klarer likevel å overbevise alle om at det var noen helt andre sin feil, hver gang da?";
// Thirteen Groups: Kari (3, "kari!" folds into it) and twelve singles. Anne is discarded
// in Review, so Kari and Bjørn–Hilde make the Board and Ivar–Mona fall below the limit.
const LONG_SETS = [
  [
    ["Kari", "Anne", "Bjørn", "Cato", "Dina"],
    ["kari!", "Erik", "Frida", "Geir", "Hilde"],
    ["Kari", "Ivar", "Jens", "Liv", "Mona"],
  ],
];
const BOARD = [
  "Kari",
  "Bjørn",
  "Cato",
  "Dina",
  "Erik",
  "Frida",
  "Geir",
  "Hilde",
];
const NEVER = ["kari!", "Anne", "Ivar", "Jens", "Liv", "Mona"];

test("FR-24, FR-25, FR-27 (AC1, AC2, AC4, AC5), UX-DR13, UX-DR14, UX-DR21, NFR-5, NFR-6: a 200-character Question with eight Groups fits the TV page's 1920×1080 canvas at 48 px and more, scaled at 1280×720 and letterboxed at 1280×1024; a click and a rank key on the Host view reveal on the TV with the staged animation, and on the Host view with the announcement and the Score; reduced motion is instant; a lost connection shows the banner; a stale Avslør refreshes; a reload restores the round; no discarded, below-limit or raw Answer text is ever on the TV page; axe is clean", async ({
  page,
  browser,
  baseURL,
}) => {
  expect(LONG_QUESTION).toHaveLength(200);
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page, [LONG_QUESTION]);
  await submitSets(browser, baseURL, links, LONG_SETS);
  await closeAndOpenReview(page, gamePath);
  await page
    .getByRole("button", { name: "Mer for «Anne»", exact: true })
    .click();
  await page.getByRole("button", { name: "Forkast fra brettet" }).click();
  await expect(
    page.getByRole("region", { name: "Forkastet (1 gruppe)" }),
  ).toContainText("Anne");
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
  await page.getByRole("link", { name: "Start spillet" }).click();
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page).toHaveURL(gamePath);
  await page.goto(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText(LONG_QUESTION);
  const tv = await openTv(page, gamePath);

  // AC1: the canvas fills the window and every room-facing text is at least 48 px.
  const stage = tv.locator("[data-stage]");
  const canvas = tv.locator(".stage-canvas");
  const question = tv.locator("h1");
  await expect(question).toHaveText(LONG_QUESTION);
  expect(await canvas.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
  });
  const fontSize = (locator: Locator) =>
    locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(await fontSize(question)).toBe(48);
  const teamList = stage.getByRole("list", { name: "Lag" });
  for (const name of ["Lag 1", "Lag 2", "Svarer nå"])
    expect(
      await fontSize(teamList.getByText(name, { exact: true })),
    ).toBeGreaterThanOrEqual(48);
  expect(
    await fontSize(stage.getByText("Spørsmål 1 av 1", { exact: true })),
  ).toBe(48);
  const scores = teamList.locator(".score-count");
  for (const score of await scores.all())
    expect(await fontSize(score)).toBe(80);
  const tile = (n: number) => tvTile(tv, n);
  await expect(tv.locator(".stage-canvas > ol > li")).toHaveCount(8);
  for (let n = 1; n <= 8; n++) await expect(tile(n)).toHaveText(String(n));
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const questionBox = await box(question);
  expect(questionBox.y + questionBox.height).toBeLessThanOrEqual(
    (await box(tile(1))).y,
  );
  const lastBox = await box(tile(8));
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(1080);
  // AC2: nothing but rank numbers is on the TV page before any Reveal.
  for (const text of [...BOARD, ...NEVER])
    expect(await tv.content(), text).not.toContain(text);

  // At 1280×720 the same canvas is scaled to fit.
  await tv.setViewportSize({ width: 1280, height: 720 });
  const scaled = await box(canvas);
  expect(scaled.width).toBeCloseTo(1280, 0);
  expect(scaled.height).toBeCloseTo(720, 0);
  // Not 16:9: letterboxed, full width and centred vertically.
  await tv.setViewportSize({ width: 1280, height: 1024 });
  const boxed = await box(canvas);
  expect(boxed.x).toBeCloseTo(0, 0);
  expect(boxed.width).toBeCloseTo(1280, 0);
  expect(boxed.height).toBeCloseTo(720, 0);
  expect(boxed.y).toBeCloseTo((1024 - 720) / 2, 0);
  await tv.setViewportSize({ width: 1920, height: 1080 });

  // AC4: a click on Avslør plass 1: the TV stages the Reveal, the Host view announces it.
  const key = keyRows(page);
  const reveal = (n: number) =>
    page.getByRole("button", { name: `Avslør plass ${n}` });
  await reveal(1).click();
  await expect(tile(1)).toHaveText("1Kari3 poeng", SYNC);
  const status = page.locator('p[role="status"]');
  await expect(status).toHaveText("«Kari», 3 poeng til Lag 1.");
  await expect(key.nth(0)).toBeFocused();
  await expect(key.nth(0)).toContainText("Avslørt");
  const shown = (n: number) => tile(n).locator("[data-slot]");
  await expect(shown(1)).toHaveAttribute("data-revealing", "");
  const animation = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el).animationName);
  expect(await animation(shown(1))).toBe("reveal-fill");
  expect(await animation(shown(1).locator(".reveal-label"))).toBe(
    "reveal-label",
  );
  expect(await animation(shown(1).locator(".reveal-count"))).toBe(
    "reveal-count",
  );
  const score1 = teamList.getByRole("listitem").first();
  await expect(score1.locator(".sr-only")).toHaveText("3 poeng");
  await expect
    .poll(() =>
      scores
        .first()
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--score")),
    )
    .toBe("3");
  // The digits the room sees are the counter drawn by ::after.
  expect((await box(scores.first())).width).toBeGreaterThan(0);

  // Key 2 reveals rank 2; a modifier or a revealed rank does nothing.
  await page.keyboard.press("Control+3");
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  await expect(tile(2)).toHaveText("2Bjørn1 poeng", SYNC);
  await expect(status).toHaveText("«Bjørn», 1 poeng til Lag 1.");
  await expect(score1.locator(".sr-only")).toHaveText("4 poeng");
  await expect(reveal(3)).toBeVisible();
  await expect(tile(3)).toHaveText("3");
  for (const n of [1, 2]) {
    expect(await fontSize(shown(n).locator(".reveal-label"))).toBe(48);
    expect(await fontSize(shown(n).locator(".reveal-count"))).toBe(48);
  }

  // Reduced motion on the TV: the Reveal is instant, the colour change is kept.
  await tv.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("3");
  await expect(tile(3)).toHaveText("3Cato1 poeng", SYNC);
  expect(await animation(shown(3))).toBe("none");
  expect(await animation(shown(3).locator(".reveal-label"))).toBe("none");
  expect(
    await scores.first().evaluate((el) => getComputedStyle(el).transition),
  ).not.toContain("--score");
  await tv.emulateMedia({ reducedMotion: "no-preference" });

  // A lost connection: the banner on the Host view, the slot still hidden on both pages.
  const isHostView = (url: URL) => url.pathname === `${gamePath}/vert`;
  await page.route(isHostView, (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await page.keyboard.press("4");
  const banner = page.getByRole("alert").filter({ hasText: "Mistet" });
  await expect(banner).toHaveText("Mistet forbindelsen.");
  await expect(reveal(4)).toBeVisible();
  await expect(tile(4)).toHaveText("4");
  await page.unroute(isHostView);

  // Another tab reveals slot 4; Avslør here refreshes to the saved state, no banner.
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("button", { name: "Avslør plass 4" }).click();
  await expect(keyRows(other).nth(3)).toContainText("Avslørt");
  await other.close();
  await reveal(4).click();
  await expect(key.nth(3)).toContainText("Avslørt");
  await expect(
    page.getByRole("alert").filter({ hasText: /Mistet|Fikk ikke/ }),
  ).toHaveCount(0);
  await expect(tile(4)).toHaveText("4Dina1 poeng", SYNC);

  // AC5: a reload of both pages restores the Question, current Team, revealed tiles and
  // Scores, all static.
  await page.reload();
  await expect(page.locator("h1")).toHaveText(LONG_QUESTION);
  await expect(page.getByRole("button", { name: /^Avslør plass/ })).toHaveCount(
    4,
  );
  await tv.reload();
  await expect(question).toHaveText(LONG_QUESTION);
  await expect(teamList.getByRole("listitem")).toHaveText([
    "Svarer nåLag 16 poeng",
    "Lag 20 poeng",
  ]);
  for (const [i, text] of ["1Kari3", "2Bjørn1", "3Cato1", "4Dina1"].entries())
    await expect(tile(i + 1)).toHaveText(`${text} poeng`);
  await expect(stage.locator("[data-revealing]")).toHaveCount(0);

  // The rest by key; then only the Board's own labels were ever on the TV page.
  for (const n of [5, 6, 7, 8]) {
    await page.keyboard.press(String(n));
    await expect(tile(n)).toContainText(BOARD[n - 1], SYNC);
  }
  await expect(page.getByRole("button", { name: /^Avslør plass/ })).toHaveCount(
    0,
  );
  const html = await tv.content();
  for (const label of BOARD) expect(html).toContain(label);
  for (const text of NEVER) expect(html, text).not.toContain(text);
  expect(await seriousViolations(tv)).toEqual([]);
});

// Manual check A9 and the wide-name case of A8: the widest content the canvas must hold.
const WIDE_LABEL = "M".repeat(39) + "Ø";

test("FR-24 (A8, A9), UX-DR21: on the TV page a 40-character label of wide letters wraps inside its tile, scored and unscored, never truncated, with its Count inside the tile and every tile inside the canvas; four 14-character Team names of wide letters fit the Team column with every Score in its card", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const { gamePath, links } = await collectingGame(page);
  await submitSets(browser, baseURL, links);
  await closeAndOpenReview(page, gamePath);
  // Kari (three Answers) is rank 1, so the wide label is tile 1.
  await page
    .getByRole("button", { name: "Mer for «Kari»", exact: true })
    .click();
  await page.getByRole("button", { name: "Gi nytt navn", exact: true }).click();
  await page.getByLabel("Navn på gruppen").fill(WIDE_LABEL);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { level: 4, name: WIDE_LABEL, exact: true }),
  ).toBeVisible();
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
  await page.getByRole("link", { name: "Start spillet" }).click();
  for (const [i, name] of WIDE_TEAMS.entries()) {
    if (i > 1) await page.getByRole("button", { name: "Legg til lag" }).click();
    await page.getByLabel(`Navn på lag ${i + 1}`).fill(name);
  }
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page).toHaveURL(gamePath);
  await page.goto(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText(QUESTION);
  const tv = await openTv(page, gamePath);
  await expect(tv.locator("h1")).toHaveText(QUESTION);

  const stage = tv.locator("[data-stage]");
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const inside = (
    inner: { x: number; y: number; width: number; height: number },
    outer: typeof inner,
  ) => {
    expect(inner.x).toBeGreaterThanOrEqual(outer.x - 0.5);
    expect(inner.y).toBeGreaterThanOrEqual(outer.y - 0.5);
    expect(inner.x + inner.width).toBeLessThanOrEqual(
      outer.x + outer.width + 0.5,
    );
    expect(inner.y + inner.height).toBeLessThanOrEqual(
      outer.y + outer.height + 0.5,
    );
  };
  const canvas = { x: 0, y: 0, width: 1920, height: 1080 };

  // A8: every Team card, name and Score inside the canvas.
  const cards = stage.getByRole("list", { name: "Lag" }).getByRole("listitem");
  await expect(cards).toHaveCount(4);
  for (const [i, card] of (await cards.all()).entries()) {
    await expect(card).toContainText(WIDE_TEAMS[i]);
    const c = await box(card);
    inside(c, canvas);
    inside(await box(card.locator(".score-count")), c);
  }

  // A9: the label wraps inside tile 1, in full, with the Count beside it.
  const list = stage.locator(".stage-canvas > ol");
  const tile = (n: number) => tvTile(tv, n);
  const shown = tile(1).locator("[data-slot]");
  const label = shown.locator(".reveal-label");
  const fits = async () => {
    await expect(label).toHaveText(WIDE_LABEL);
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const t = await box(shown);
    inside(t, await box(list));
    expect(t.height).toBeLessThanOrEqual(112);
    inside(await box(shown.locator(".reveal-count")), t);
    inside(await box(tile(8)), canvas);
  };
  await page.keyboard.press("1");
  await expect(tile(1)).toContainText("3 poeng", SYNC);
  await fits();
  // Unscored: the same label beside the Count and "uten poeng".
  await page.keyboard.press("z");
  await expect(tile(1)).toHaveText("1", SYNC);
  await page.keyboard.press("u");
  await page.keyboard.press("1");
  await expect(tile(1)).toContainText("uten poeng", SYNC);
  await fits();
});

// The default flow (nine Groups, eight on the Board) to a playing Game with Lag 1 and Lag 2,
// on the Host view.
async function playingGame(
  page: Page,
  browser: Browser,
  baseURL: string | undefined,
) {
  const { gamePath, links } = await collectingGame(page);
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
  await page.getByRole("link", { name: "Start spillet" }).click();
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page).toHaveURL(gamePath);
  await page.goto(`${gamePath}/vert`);
  await expect(page.locator("h1")).toHaveText(QUESTION);
  return gamePath;
}

test("FR-25, FR-26, FR-27 (AC1, AC4), UX-DR21, NFR-5, NFR-6: Bom on the Host view shows the 80 px panel over the TV list and changes nothing; Angre undoes scored and unscored Reveals with the announcement and focus; a stale Z refreshes; Neste lag wraps; the uten-poeng toggle makes dashed unscored Reveals on the TV; shortcuts are ignored in a text field; ? opens the overlay; a refused save shows the banner; all revealed is announced; axe is clean", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const gamePath = await playingGame(page, browser, baseURL);
  const tv = await openTv(page, gamePath);
  await expect(tv.locator("h1")).toHaveText(QUESTION);
  const stage = tv.locator("[data-stage]");
  const list = stage.locator(".stage-canvas > ol");
  const tile = (n: number) => tvTile(tv, n);
  const reveal = (n: number) =>
    page.getByRole("button", { name: `Avslør plass ${n}` });
  const reveals = page.getByRole("button", { name: /^Avslør plass/ });
  const status = page.locator('p[role="status"]');
  const tvTeams = stage
    .getByRole("list", { name: "Lag" })
    .getByRole("listitem");
  const teams = hostTeams(page);
  const control = (name: string) =>
    page.getByRole("button", { name, exact: true });
  const angre = control("Angre [Z]");
  const toggle = page.getByRole("button", { name: /uten poeng \[U\]$/ });
  const style = (locator: Locator, property: string) =>
    locator.evaluate(
      (el, p) => getComputedStyle(el).getPropertyValue(p),
      property,
    );
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const lag1 = ["Svarer nåLag 10 poeng", "Lag 20 poeng"];

  // AC1: Bom is an 80 px stage-ink panel on stage-raised, centred over the TV list, no icon.
  const panel = stage.locator(".bom-panel");
  const t0 = Date.now();
  await page.keyboard.press("m");
  await expect(panel).toHaveText("Bom", SYNC);
  await expect(status).toHaveText("Bom.");
  expect(await style(panel, "font-size")).toBe("80px");
  expect(await style(panel, "color")).toBe("rgb(246, 241, 231)");
  expect(await style(panel, "background-color")).toBe("rgb(26, 48, 44)");
  expect(await style(panel, "animation-name")).toBe("bom");
  expect(await style(panel, "pointer-events")).toBe("none");
  await expect(panel).toHaveAttribute("aria-hidden", "true");
  await expect(panel.locator("svg, img")).toHaveCount(0);
  const [p, l] = [await box(panel), await box(list)];
  expect(p.x + p.width / 2).toBeCloseTo(l.x + l.width / 2, 0);
  expect(p.y + p.height / 2).toBeCloseTo(l.y + l.height / 2, 0);
  await expect(panel).toHaveCount(0, { timeout: 3000 });
  expect(Date.now() - t0).toBeGreaterThan(1200);
  // The turn did not pass and nothing was saved, also after a reload.
  await expect(teams).toHaveText(lag1);
  await expect(tvTeams).toHaveText(lag1);
  await expect(reveals).toHaveCount(8);
  await page.reload();
  await expect(teams).toHaveText(lag1);
  await expect(reveals).toHaveCount(8);

  // Reduced motion on the TV: the panel shows without the animation.
  await tv.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("m");
  await expect(panel).toHaveText("Bom", SYNC);
  expect(await style(panel, "animation-name")).toBe("none");
  await tv.emulateMedia({ reducedMotion: "no-preference" });

  // AC4: Angre only with a Reveal on the Question; Z undoes it and takes the points back.
  await expect(angre).toHaveCount(0);
  await reveal(1).click();
  await expect(tile(1)).toHaveText("1Kari3 poeng", SYNC);
  await expect(keyRows(page).nth(0)).toBeFocused();
  await expect(teams.first()).toContainText("3 poeng");
  await expect(angre).toBeVisible();
  await page.keyboard.press("z");
  await expect(status).toHaveText(
    "Angret. «Kari» er skjult igjen, 3 poeng trukket fra Lag 1.",
  );
  await expect(tile(1)).toHaveText("1", SYNC);
  // The revealed row had focus, so its Avslør takes it back.
  await expect(reveal(1)).toBeFocused();
  await expect(teams).toHaveText(lag1);
  await expect(tvTeams).toHaveText(lag1);
  await expect(angre).toHaveCount(0);

  // Another tab undoes this tab's last Reveal: Z here refreshes to the saved state with
  // no banner, and never undoes the Reveal before it (Kari stays, with its 3 points).
  await reveal(1).click();
  await expect(keyRows(page).nth(0)).toContainText("Avslørt");
  await reveal(2).click();
  await expect(reveal(2)).toHaveCount(0);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("button", { name: "Angre [Z]", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "Avslør plass 2" }),
  ).toBeVisible();
  await other.close();
  await page.keyboard.press("z");
  await expect(reveal(2)).toBeVisible();
  await expect(keyRows(page).nth(0)).toContainText("Avslørt");
  await expect(
    page.getByRole("alert").filter({ hasText: /Mistet|Fikk ikke/ }),
  ).toHaveCount(0);
  await expect(teams.first()).toContainText("3 poeng");
  await expect(tile(1)).toHaveText("1Kari3 poeng", SYNC);
  // The refreshed tab undoes Kari as usual.
  await page.keyboard.press("z");
  await expect(reveal(1)).toBeVisible();
  await expect(angre).toHaveCount(0);
  await expect(teams).toHaveText(lag1);

  // Neste lag by click and by T, wrapping back to Lag 1.
  await control("Neste lag [T]").click();
  await expect(teams).toHaveText(["Lag 10 poeng", "Svarer nåLag 20 poeng"]);
  await expect(tvTeams).toHaveText(
    ["Lag 10 poeng", "Svarer nåLag 20 poeng"],
    SYNC,
  );
  await expect(status).toHaveText("Lag 2 svarer nå.");
  await page.keyboard.press("T");
  await expect(teams).toHaveText(lag1);
  await expect(status).toHaveText("Lag 1 svarer nå.");

  // U: the toggle is pressed and reads Avslører uten poeng.
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Avslører uten poeng [U]");

  // An unscored Reveal: "uten poeng" on a dashed TV tile, no Score changes.
  await reveal(2).click();
  await expect(tile(2)).toContainText("uten poeng", SYNC);
  await expect(keyRows(page).nth(1)).toContainText("Uten poeng");
  await expect(status).toHaveText(/^«.+» er avslørt uten poeng\.$/);
  const shown2 = tile(2).locator("[data-slot]");
  expect(await style(shown2, "border-top-style")).toBe("dashed");
  // Polled: the staged reveal starts the fill from stage-tile.
  await expect
    .poll(() => style(shown2, "background-color"))
    .toBe("rgb(26, 48, 44)");
  await expect(teams).toHaveText(lag1);
  await expect(tvTeams).toHaveText(lag1);

  // Angre by click: the unscored announcement, and focus to the Avslør it hid again.
  await angre.click();
  await expect(status).toHaveText(/^Angret\. «.+» er skjult igjen\.$/);
  await expect(reveal(2)).toBeFocused();
  await expect(tile(2)).toHaveText("2", SYNC);
  await expect(angre).toHaveCount(0);

  // U off.
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText("Vis resten uten poeng [U]");

  // A text field swallows every shortcut.
  await page.locator("main").evaluate((el) => {
    const input = document.createElement("input");
    input.id = "probe";
    input.setAttribute("aria-label", "Prøve");
    el.append(input);
  });
  await page.locator("#probe").focus();
  for (const key of ["m", "t", "u", "n", "ArrowRight", "1", "?"])
    await page.keyboard.press(key);
  await expect(panel).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator("#probe").evaluate((el) => el.remove());
  // A swallowed T would have passed the turn: this click must land on Lag 2.
  await control("Neste lag [T]").click();
  await expect(status).toHaveText("Lag 2 svarer nå.");
  await expect(reveal(1)).toBeVisible();
  await page.keyboard.press("t");
  await expect(status).toHaveText("Lag 1 svarer nå.");

  // ?: the overlay lists the shortcuts (F belongs to the TV); axe is clean with it open;
  // Esc closes it.
  await page.keyboard.press("Shift+?");
  const overlay = page.getByRole("dialog", { name: "Hurtigtaster" });
  await expect(overlay).toBeVisible();
  for (const text of [
    "Avslør plassen med det nummeret",
    "Angre siste avsløring",
    "Vis resten uten poeng",
  ])
    await expect(overlay).toContainText(text);
  await expect(overlay).not.toContainText("Fullskjerm");
  await expect(overlay.getByRole("button", { name: "Lukk" })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  // Inside the open overlay every shortcut is ignored.
  const said = await status.textContent();
  for (const key of ["1", "m", "t", "u", "n", "ArrowRight", "f"])
    await page.keyboard.press(key);
  await expect(reveal(1)).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(status).toHaveText(said!);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await page.keyboard.press("Escape");
  await expect(overlay).toBeHidden();
  await control("Hurtigtaster").click();
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "Lukk" }).click();
  await expect(overlay).toBeHidden();

  // A save the server refuses (the body rewritten to an invalid scored): the banner, the
  // slot still hidden, and a reload shows nothing changed.
  const isHostView = (url: URL) => url.pathname === `${gamePath}/vert`;
  await page.route(isHostView, (route) => {
    const body = route.request().postData();
    return route.request().method() === "POST" && body
      ? route.continue({
          postData: body.replace('"scored":true', '"scored":"x"'),
        })
      : route.fallback();
  });
  await page.keyboard.press("3");
  await expect(
    page.getByRole("alert").filter({ hasText: "Fikk ikke" }),
  ).toHaveText("Fikk ikke lagret trekket. Prøv igjen.");
  await expect(reveal(3)).toBeVisible();
  await page.unroute(isHostView);
  await page.reload();
  await expect(reveals).toHaveCount(8);
  await expect(teams).toHaveText(lag1);

  // Every slot revealed, the last one unscored: one live region says both sentences, and
  // the next move becomes the primary button.
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await page.keyboard.press(String(n));
    await expect(reveal(n)).toHaveCount(0);
  }
  await page.keyboard.press("u");
  await page.keyboard.press("8");
  await expect(tile(8)).toContainText("uten poeng", SYNC);
  await expect(status).toHaveText(
    /^«.+» er avslørt uten poeng\. Alle svarene er avslørt\.$/,
  );
  await expect(control("Vis sluttstilling [N]")).toHaveClass(/bg-primary/);
  expect(await seriousViolations(page)).toEqual([]);
  expect(await seriousViolations(tv)).toEqual([]);
});

const Q2 = "Hvilken farge har hytta?";
const Q3 = "Hvor bor du?";
const DAY_MS = 24 * 60 * 60 * 1000;
// "22. november 2026" in Norwegian time, `days` from now (as formatDate on the server).
const dateIn = (days: number) =>
  new Intl.DateTimeFormat("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  }).format(new Date(Date.now() + days * DAY_MS));

test("FR-3, FR-27 (AC2, AC3), UX-DR21, NFR-5, NFR-6: Neste spørsmål by N and → on the Host view shows the next Question with hidden tiles on both pages and the uten-poeng toggle off; a stale tab refreshes without moving on; a reload keeps the Question; Vis sluttstilling ends on the TV page's Sluttstilling with the Teams by Score at 120 px and Vinner inside 1080 px, and on the Host view's final standing with the deletion date and Tilbake til spillet; the Game page shows the final Scores, Åpne TV-visning and the deletion notice; axe is clean", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page, [QUESTION, Q2, Q3]);
  // Q2: Rød (2) and Blå (1); Q3: Oslo (3).
  await submitSets(browser, baseURL, links, [
    SETS,
    [["Rød"], ["Blå"], ["Rød"]],
    [["Oslo"], ["Oslo"], ["Oslo"]],
  ]);
  await closeAndOpenReview(page, gamePath);
  const mark = page.getByRole("button", { name: "Marker som gjennomgått" });
  for (const q of [2, 3]) {
    await mark.click();
    await expect(page).toHaveURL(`${gamePath}/gjennomgang?q=${q}`);
  }
  await mark.click();
  await expect(mark).toHaveCount(0);
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
  await page.getByRole("link", { name: "Start spillet" }).click();
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page).toHaveURL(gamePath);
  await page.goto(`${gamePath}/vert`);
  const heading = page.locator("h1");
  await expect(heading).toHaveText(QUESTION);
  const tv = await openTv(page, gamePath);
  await expect(tv.locator("h1")).toHaveText(QUESTION);

  const stage = tv.locator("[data-stage]");
  const tile = (n: number) => tvTile(tv, n);
  const tiles = tv.locator(".stage-canvas > ol > li");
  const reveal = (n: number) =>
    page.getByRole("button", { name: `Avslør plass ${n}` });
  const reveals = page.getByRole("button", { name: /^Avslør plass/ });
  const status = page.locator('p[role="status"]');
  const teams = hostTeams(page);
  const tvTeams = stage
    .getByRole("list", { name: "Lag" })
    .getByRole("listitem");
  const toggle = page.getByRole("button", { name: /uten poeng \[U\]$/ });
  const next = page.getByRole("button", {
    name: /^(Neste spørsmål|Vis sluttstilling) \[N\]$/,
  });
  const style = (locator: Locator, property: string) =>
    locator.evaluate(
      (el, p) => getComputedStyle(el).getPropertyValue(p),
      property,
    );

  // Q1: Kari for Lag 1, then the toggle on.
  await reveal(1).click();
  await expect(tile(1)).toHaveText("1Kari3 poeng", SYNC);
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(next).toHaveText("Neste spørsmål [N]");
  await expect(next).not.toHaveClass(/bg-primary/);

  // N: Q2 with every slot hidden, the toggle off (deferred from 6.3), Lag 1 still on.
  // Focus was on an Avslør of Q1, which unmounts, so it moves to Q2's heading.
  await reveal(2).focus();
  await page.keyboard.press("n");
  await expect(heading).toHaveText(Q2);
  await expect(heading).toBeFocused();
  await expect(
    page.getByText("Spørsmål 2 av 3", { exact: true }),
  ).toBeVisible();
  await expect(reveals).toHaveCount(2);
  await expect(status).toHaveText("Spørsmål 2 av 3.");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText("Vis resten uten poeng [U]");
  await expect(teams).toHaveText(["Svarer nåLag 13 poeng", "Lag 20 poeng"]);
  await expect(tv.locator("h1")).toHaveText(Q2, SYNC);
  await expect(
    stage.getByText("Spørsmål 2 av 3", { exact: true }),
  ).toBeVisible();
  await expect(tiles).toHaveText(["1", "2"]);

  // T, then Rød for Lag 2.
  await page.keyboard.press("t");
  await expect(status).toHaveText("Lag 2 svarer nå.");
  await reveal(1).click();
  await expect(tile(1)).toHaveText("1Rød2 poeng", SYNC);
  await expect(teams).toHaveText(["Lag 13 poeng", "Svarer nåLag 22 poeng"]);
  await expect(tvTeams).toHaveText(["Lag 13 poeng", "Svarer nåLag 22 poeng"]);

  // A tab opened on Q2; → moves this one to Q3; N in the stale tab refreshes it to Q3
  // without moving on (it sends position 2, which the server refuses).
  const other = await page.context().newPage();
  await other.goto(page.url());
  await expect(other.locator("h1")).toHaveText(Q2);
  await page.keyboard.press("ArrowRight");
  await expect(heading).toHaveText(Q3);
  await expect(status).toHaveText("Spørsmål 3 av 3.");
  await other.keyboard.press("n");
  await expect(other.locator("h1")).toHaveText(Q3);
  await expect(
    other.getByText("Spørsmål 3 av 3", { exact: true }),
  ).toBeVisible();
  await expect(
    other.getByText("Fikk ikke lagret trekket. Prøv igjen."),
  ).toHaveCount(0);
  await other.close();
  await page.reload();
  await expect(heading).toHaveText(Q3);
  await expect(
    page.getByText("Spørsmål 3 av 3", { exact: true }),
  ).toBeVisible();
  await expect(tv.locator("h1")).toHaveText(Q3, SYNC);

  // Q3: Vis sluttstilling, primary once Oslo is revealed (unscored: no Score changes).
  await expect(next).toHaveText("Vis sluttstilling [N]");
  await expect(next).not.toHaveClass(/bg-primary/);
  await page.keyboard.press("u");
  await page.keyboard.press("1");
  await expect(tile(1)).toContainText("uten poeng", SYNC);
  await expect(status).toHaveText(
    "«Oslo» er avslørt uten poeng. Alle svarene er avslørt.",
  );
  await expect(next).toHaveClass(/bg-primary/);
  await expect(teams).toHaveText(["Lag 13 poeng", "Svarer nåLag 22 poeng"]);

  // AC2: Sluttstilling on both pages; the Host view focuses its heading.
  const dates = [30, 31].map(
    (days) => `Spillet slettes automatisk ${dateIn(days)}.`,
  );
  // A tab left on Q3 while this one finishes the Game.
  const stale = await page.context().newPage();
  await stale.goto(page.url());
  await expect(stale.locator("h1")).toHaveText(Q3);
  await next.click();
  await expect(heading).toHaveText("Sluttstilling");
  await expect(heading).toBeFocused();
  await expect(tv.locator("h1")).toHaveText("Sluttstilling", SYNC);
  // N there is WRONG_STATE: it refreshes to Sluttstilling with no banner.
  await stale.keyboard.press("n");
  await expect(stale.locator("h1")).toHaveText("Sluttstilling");
  await expect(
    stale.getByText(/^(Fikk ikke lagret trekket|Mistet forbindelsen)/),
  ).toHaveCount(0);
  await stale.close();

  // The TV page: the Teams by Score, the winner on the accent card, nothing for the Host.
  const final = stage
    .getByRole("list", { name: "Sluttstilling" })
    .getByRole("listitem");
  await expect(final).toHaveText(["VinnerLag 13 poeng", "Lag 22 poeng"]);
  for (const card of await final.all())
    expect(await style(card.locator("p").last(), "font-size")).toBe("120px");
  expect(await style(final.first(), "background-color")).toBe(
    "rgb(127, 224, 194)",
  );
  expect(await style(final.nth(1), "background-color")).toBe("rgb(26, 48, 44)");
  for (const host of ["slettes", "Tilbake til spillet", "Trykk F"])
    await expect(tv.getByText(host)).toHaveCount(0);
  await expect(tv.getByRole("link")).toHaveCount(0);
  // Everything inside the 1080 px canvas (the viewport is 1920×1080, so scale 1).
  for (const el of await stage.locator(".stage-canvas *").all()) {
    const b = await el.boundingBox();
    if (b) expect(b.y + b.height).toBeLessThanOrEqual(1080);
  }
  expect(await seriousViolations(tv)).toEqual([]);
  await tv.reload();
  await expect(tv.locator("h1")).toHaveText("Sluttstilling");

  // The Host view's final standing: the deletion date and the way back.
  await expect(teams).toHaveCount(0);
  const deletes = page.getByText(/^Spillet slettes automatisk /);
  expect(dates).toContain(await deletes.textContent());
  expect(await seriousViolations(page)).toEqual([]);
  const back = page.getByRole("link", { name: "Tilbake til spillet" });
  await expect(back).toHaveAttribute("href", gamePath);
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.reload();
  await expect(heading).toHaveText("Sluttstilling");

  // AC3: the Game page of the played Game.
  await back.click();
  await expect(page).toHaveURL(gamePath);
  await expect(page.getByText("Ferdig", { exact: true })).toBeVisible();
  const played = page.getByRole("region", { name: "Sluttstilling" });
  await expect(played).toContainText(/Lag 1\s*3 poeng\s*Lag 2\s*2 poeng/);
  const notice = played.getByText(/^Spillet og alle svarene slettes /);
  expect(
    dates.map((d) =>
      d.replace("Spillet slettes", "Spillet og alle svarene slettes"),
    ),
  ).toContain(await notice.textContent());
  expect(await seriousViolations(page)).toEqual([]);
  await expect(
    played.getByRole("link", { name: "Åpne TV-visning" }),
  ).toHaveAttribute("href", `${gamePath}/tv`);
});
