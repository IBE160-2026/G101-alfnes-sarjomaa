import type { Browser, Locator, Page } from "@playwright/test";
import {
  closeAndOpenReview,
  collectingGame,
  expect,
  FOCUS_RING_INVERSE,
  QUESTION,
  seriousViolations,
  SETS,
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
  // The Board's hidden tiles (nine Groups, eight on the Board) and the controls: Bom, Neste
  // lag, the uten-poeng toggle, Vis sluttstilling (one Question) and "?" (no Angre before
  // a Reveal).
  await expect(page.getByRole("button")).toHaveCount(13);
  await expect(
    page.getByRole("button", { name: /^Avslør plass [1-8]$/ }),
  ).toHaveCount(8);
  const hint = page.getByText("Trykk F for fullskjerm.", { exact: true });
  await expect(hint).toBeVisible();
  const teams = stage.getByRole("list", { name: "Lag" }).getByRole("listitem");
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
  await expect(
    stale
      .locator("[data-stage]")
      .getByRole("list", { name: "Lag" })
      .getByRole("listitem"),
  ).toHaveText([
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

test("FR-24, FR-25, FR-27 (AC1, AC2, AC4, AC5), UX-DR13, UX-DR14, UX-DR21, NFR-5, NFR-6: a 200-character Question with eight Groups fits the 1920×1080 canvas at 48 px and more, scaled at 1280×720 and letterboxed at 1280×1024; click and rank key reveal with a pending border, the staged animation, the announcement and the Score; reduced motion is instant; a lost connection shows the banner; a stale tile refreshes; a reload restores the round; no discarded, below-limit or raw Answer text is ever on the page; axe is clean", async ({
  page,
  browser,
  baseURL,
}) => {
  expect(LONG_QUESTION).toHaveLength(200);
  await page.setViewportSize({ width: 1920, height: 1080 });
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

  // AC1: the canvas fills the window, every room-facing text is at least 48 px, the control bar is inside 1080 px.
  const stage = page.locator("[data-stage]");
  const canvas = page.locator(".stage-canvas");
  const question = page.locator("h1");
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
  const tile = (n: number) => stage.locator("[data-slot]").nth(n - 1);
  const tiles = page.getByRole("button", { name: /^Avslør plass/ });
  await expect(tiles).toHaveCount(8);
  for (let n = 1; n <= 8; n++)
    await expect(tile(n)).toHaveAccessibleName(`Avslør plass ${n}`);
  const hint = page.getByText("Trykk F for fullskjerm.", { exact: true });
  const bar = hint.locator("..");
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const barBox = await box(bar);
  expect(barBox.y + barBox.height).toBeLessThanOrEqual(1080);
  const questionBox = await box(question);
  expect(questionBox.y + questionBox.height).toBeLessThanOrEqual(
    (await box(tile(1))).y,
  );
  const lastBox = await box(tile(8));
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barBox.y);
  // AC2: nothing but rank numbers is on the page before any Reveal.
  for (const text of [...BOARD, ...NEVER])
    expect(await page.content(), text).not.toContain(text);

  // At 1280×720 the same canvas is scaled to fit.
  await page.setViewportSize({ width: 1280, height: 720 });
  const scaled = await box(canvas);
  expect(scaled.width).toBeCloseTo(1280, 0);
  expect(scaled.height).toBeCloseTo(720, 0);
  // Not 16:9: letterboxed, full width and centred vertically.
  await page.setViewportSize({ width: 1280, height: 1024 });
  const boxed = await box(canvas);
  expect(boxed.x).toBeCloseTo(0, 0);
  expect(boxed.width).toBeCloseTo(1280, 0);
  expect(boxed.height).toBeCloseTo(720, 0);
  expect(boxed.y).toBeCloseTo((1024 - 720) / 2, 0);
  await page.setViewportSize({ width: 1920, height: 1080 });

  // AC4: a click on tile 1 with the server held: stage-ink border until it answers.
  const isScreen = (url: URL) => url.pathname === `${gamePath}/skjerm`;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(isScreen, async (route) => {
    if (route.request().method() === "POST") await held;
    await route.fallback();
  });
  const border = () =>
    tile(1).evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(await border()).toBe("rgb(115, 150, 144)");
  await tile(1).click();
  await expect.poll(border).toBe("rgb(246, 241, 231)");
  await expect(tile(1)).toHaveRole("button");
  release();
  await expect(tile(1)).toHaveText("1Kari3 poeng");
  await page.unroute(isScreen);
  const status = stage.locator('[role="status"].sr-only');
  await expect(status).toHaveText("«Kari», 3 poeng til Lag 1.");
  await expect(tile(1)).not.toHaveRole("button");
  await expect(tile(1)).toBeFocused();
  await expect(tile(1)).toHaveAttribute("data-revealing", "");
  const animation = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el).animationName);
  expect(await animation(tile(1))).toBe("reveal-fill");
  expect(await animation(tile(1).locator(".reveal-label"))).toBe(
    "reveal-label",
  );
  expect(await animation(tile(1).locator(".reveal-count"))).toBe(
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
  await expect(tile(2)).toHaveText("2Bjørn1 poeng");
  await expect(status).toHaveText("«Bjørn», 1 poeng til Lag 1.");
  await expect(score1.locator(".sr-only")).toHaveText("4 poeng");
  await expect(tile(3)).toHaveRole("button");
  for (const n of [1, 2]) {
    expect(await fontSize(tile(n).locator(".reveal-label"))).toBe(48);
    expect(await fontSize(tile(n).locator(".reveal-count"))).toBe(48);
  }

  // Reduced motion: the Reveal is instant, the colour change is kept.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("3");
  await expect(tile(3)).toHaveText("3Cato1 poeng");
  expect(await animation(tile(3))).toBe("none");
  expect(await animation(tile(3).locator(".reveal-label"))).toBe("none");
  expect(
    await scores.first().evaluate((el) => getComputedStyle(el).transition),
  ).not.toContain("--score");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // A lost connection: the banner in the control-bar row, the tile still hidden.
  await page.route(isScreen, (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await page.keyboard.press("4");
  const banner = bar.getByRole("alert");
  await expect(banner).toHaveText("Mistet forbindelsen.");
  await expect(hint).toBeHidden();
  await expect(tile(4)).toHaveRole("button");
  await page.unroute(isScreen);

  // Another tab reveals tile 4; a click here refreshes to the saved state, no banner.
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("button", { name: "Avslør plass 4" }).click();
  await expect(other.locator("[data-slot]").nth(3)).toHaveText("4Dina1 poeng");
  await other.close();
  await tile(4).click();
  await expect(tile(4)).toHaveText("4Dina1 poeng");
  await expect(tile(4)).not.toHaveAttribute("data-revealing");
  await expect(tile(4)).toBeFocused();
  await expect(banner).toHaveCount(0);
  await expect(hint).toBeVisible();

  // AC5: a reload restores the Question, current Team, revealed tiles and Scores, all static.
  await page.reload();
  await expect(question).toHaveText(LONG_QUESTION);
  await expect(teamList.getByRole("listitem")).toHaveText([
    "Svarer nåLag 16 poeng",
    "Lag 20 poeng",
  ]);
  await expect(tiles).toHaveCount(4);
  for (const [i, text] of ["1Kari3", "2Bjørn1", "3Cato1", "4Dina1"].entries())
    await expect(tile(i + 1)).toHaveText(`${text} poeng`);
  await expect(stage.locator("[data-revealing]")).toHaveCount(0);

  // The rest by key; then only the Board's own labels were ever shown.
  for (const n of [5, 6, 7, 8]) {
    await page.keyboard.press(String(n));
    await expect(tile(n)).toContainText(BOARD[n - 1]);
  }
  await expect(tiles).toHaveCount(0);
  const html = await page.content();
  for (const label of BOARD) expect(html).toContain(label);
  for (const text of NEVER) expect(html, text).not.toContain(text);
  expect(await seriousViolations(page)).toEqual([]);
});

// Manual check A9 and the wide-name case of A8: the widest content the canvas must hold.
const WIDE_LABEL = "M".repeat(39) + "Ø";
const WIDE_TEAMS = ["W", "M", "W", "M"].map(
  (letter, i) => letter.repeat(13) + String(i + 1),
);

test("FR-24 (A8, A9), UX-DR21: a 40-character label of wide letters wraps inside its tile, scored and unscored, never truncated, with its Count inside the tile and every tile above the control bar; four 14-character Team names of wide letters fit the Team column with every Score in its card", async ({
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
  await expect(page.locator("h1")).toHaveText(QUESTION);

  const stage = page.locator("[data-stage]");
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
  const bar = page
    .getByText("Trykk F for fullskjerm.", { exact: true })
    .locator("..");
  const barTop = (await box(bar)).y;

  // A8: every Team card, name and Score inside the canvas and above the control bar.
  const cards = stage.getByRole("list", { name: "Lag" }).getByRole("listitem");
  await expect(cards).toHaveCount(4);
  for (const [i, card] of (await cards.all()).entries()) {
    await expect(card).toContainText(WIDE_TEAMS[i]);
    const c = await box(card);
    expect(c.y + c.height, WIDE_TEAMS[i]).toBeLessThanOrEqual(barTop);
    inside(c, { x: 0, y: 0, width: 1920, height: 1080 });
    inside(await box(card.locator(".score-count")), c);
  }

  // A9: the label wraps inside tile 1, in full, with the Count beside it.
  const list = stage.locator("ol:has([data-slot])");
  const tile = (n: number) => stage.locator("[data-slot]").nth(n - 1);
  const label = tile(1).locator(".reveal-label");
  const fits = async () => {
    await expect(label).toHaveText(WIDE_LABEL);
    expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    );
    const t = await box(tile(1));
    inside(t, await box(list));
    expect(t.height).toBeLessThanOrEqual(112);
    inside(await box(tile(1).locator(".reveal-count")), t);
    const last = await box(tile(8));
    expect(last.y + last.height).toBeLessThanOrEqual(barTop);
  };
  await page.keyboard.press("1");
  await expect(tile(1)).toContainText("3 poeng");
  await fits();
  // Unscored: the same label beside the Count and "uten poeng".
  await page.keyboard.press("z");
  await expect(tile(1)).toHaveRole("button");
  await page.keyboard.press("u");
  await page.keyboard.press("1");
  await expect(tile(1)).toContainText("uten poeng");
  await fits();
});

// The default flow (nine Groups, eight on the Board) to a playing Game with Lag 1 and Lag 2.
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
  await expect(page.locator("h1")).toHaveText(QUESTION);
  return gamePath;
}

test("FR-25, FR-26, FR-27 (AC1, AC4), UX-DR21, NFR-5, NFR-6: Bom shows the 80 px panel over the list and changes nothing; Angre undoes scored and unscored Reveals with the announcement and focus; Neste lag wraps; the uten-poeng toggle dashes the hidden tiles and makes unscored Reveals; shortcuts are ignored in a text field; ? opens the overlay; a refused save shows the banner; all revealed shows the hint; axe is clean", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const gamePath = await playingGame(page, browser, baseURL);
  const stage = page.locator("[data-stage]");
  const list = stage.locator("ol:has([data-slot])");
  const tile = (n: number) => stage.locator("[data-slot]").nth(n - 1);
  const tiles = page.getByRole("button", { name: /^Avslør plass/ });
  const status = stage.locator('[role="status"].sr-only');
  const teams = stage.getByRole("list", { name: "Lag" }).getByRole("listitem");
  const hint = page.getByText("Trykk F for fullskjerm.", { exact: true });
  const bar = hint.locator("..");
  const control = (name: string) =>
    bar.getByRole("button", { name, exact: true });
  const angre = control("Angre [Z]");
  const toggle = bar.getByRole("button", { name: /uten poeng \[U\]$/ });
  const style = (locator: Locator, property: string) =>
    locator.evaluate(
      (el, p) => getComputedStyle(el).getPropertyValue(p),
      property,
    );
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const lag1 = ["Svarer nåLag 10 poeng", "Lag 20 poeng"];

  // AC1: Bom is an 80 px stage-ink panel on stage-raised, centred over the list, no icon.
  const panel = stage.locator(".bom-panel");
  const t0 = Date.now();
  await page.keyboard.press("m");
  await expect(panel).toHaveText("Bom");
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
  await expect(tiles).toHaveCount(8);
  await page.reload();
  await expect(teams).toHaveText(lag1);
  await expect(tiles).toHaveCount(8);

  // Reduced motion: the panel shows without the animation.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("m");
  await expect(panel).toHaveText("Bom");
  expect(await style(panel, "animation-name")).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // AC4: Angre only with a Reveal on the Question; Z undoes it and takes the points back.
  await expect(angre).toHaveCount(0);
  await tile(1).click();
  await expect(tile(1)).toHaveText("1Kari3 poeng");
  await expect(tile(1)).toBeFocused();
  await expect(teams.first()).toContainText("3 poeng");
  await expect(angre).toBeVisible();
  await page.keyboard.press("z");
  await expect(status).toHaveText(
    "Angret. «Kari» er skjult igjen, 3 poeng trukket fra Lag 1.",
  );
  await expect(tile(1)).toHaveRole("button");
  // The revealed row had focus, so its tile takes it back.
  await expect(tile(1)).toBeFocused();
  await expect(teams).toHaveText(lag1);
  await expect(angre).toHaveCount(0);

  // Another tab undoes this tab's last Reveal: Z here refreshes to the saved state with
  // no banner, and never undoes the Reveal before it (Kari stays, with its 3 points).
  await tile(1).click();
  await expect(tile(1)).toHaveText("1Kari3 poeng");
  await tile(2).click();
  await expect(tile(2)).not.toHaveRole("button");
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("button", { name: "Angre [Z]", exact: true }).click();
  await expect(other.locator("[data-slot]").nth(1)).toHaveRole("button");
  await other.close();
  await page.keyboard.press("z");
  await expect(tile(2)).toHaveRole("button");
  await expect(tile(1)).toHaveText("1Kari3 poeng");
  await expect(bar.getByRole("alert")).toHaveCount(0);
  await expect(teams.first()).toContainText("3 poeng");
  // The refreshed tab undoes Kari as usual.
  await page.keyboard.press("z");
  await expect(tile(1)).toHaveRole("button");
  await expect(angre).toHaveCount(0);
  await expect(teams).toHaveText(lag1);

  // Neste lag by click and by T, wrapping back to Lag 1.
  await control("Neste lag [T]").click();
  await expect(teams).toHaveText(["Lag 10 poeng", "Svarer nåLag 20 poeng"]);
  await expect(status).toHaveText("Lag 2 svarer nå.");
  await page.keyboard.press("T");
  await expect(teams).toHaveText(lag1);
  await expect(status).toHaveText("Lag 1 svarer nå.");

  // U: the toggle is pressed, reads Avslører uten poeng in bold stage-ink, tiles dashed.
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Avslører uten poeng [U]");
  expect(await style(toggle, "font-weight")).toBe("700");
  expect(await style(toggle, "color")).toBe("rgb(246, 241, 231)");
  for (const t of await tiles.all())
    expect(await style(t, "border-top-style")).toBe("dashed");

  // An unscored Reveal: "uten poeng" on the tile, no Score changes.
  await tile(2).click();
  await expect(tile(2)).toContainText("uten poeng");
  await expect(tile(2)).not.toHaveRole("button");
  await expect(status).toHaveText(/^«.+» er avslørt uten poeng\.$/);
  expect(await style(tile(2), "border-top-style")).toBe("dashed");
  // Polled: the staged reveal starts the fill from stage-tile.
  await expect
    .poll(() => style(tile(2), "background-color"))
    .toBe("rgb(26, 48, 44)");
  await expect(teams).toHaveText(lag1);

  // Angre by click: the unscored announcement, and focus to the tile it hid again.
  await angre.click();
  await expect(status).toHaveText(/^Angret\. «.+» er skjult igjen\.$/);
  await expect(tile(2)).toHaveRole("button");
  await expect(tile(2)).toBeFocused();
  await expect(angre).toHaveCount(0);

  // U off: solid borders again.
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText("Vis resten uten poeng [U]");
  for (const t of await tiles.all())
    expect(await style(t, "border-top-style")).toBe("solid");

  // A text field swallows every shortcut.
  await stage.evaluate((el) => {
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
  await expect(tile(1)).toHaveRole("button");
  await page.keyboard.press("t");
  await expect(status).toHaveText("Lag 1 svarer nå.");

  // ?: the overlay lists the shortcuts; axe is clean with it open; Esc closes it.
  await page.keyboard.press("Shift+?");
  const overlay = page.getByRole("dialog", { name: "Hurtigtaster" });
  await expect(overlay).toBeVisible();
  for (const text of [
    "Avslør plassen med det nummeret",
    "Angre siste avsløring",
    "Vis resten uten poeng",
    "Fullskjerm av og på",
  ])
    await expect(overlay).toContainText(text);
  await expect(overlay.getByRole("button", { name: "Lukk" })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  // Inside the open overlay every shortcut is ignored.
  const said = await status.textContent();
  for (const key of ["1", "m", "t", "u", "n", "ArrowRight", "f"])
    await page.keyboard.press(key);
  await expect(tile(1)).toHaveRole("button");
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

  // A save the server refuses (the body rewritten to an invalid scored): the banner
  // replaces the controls, the tile stays hidden, and a reload shows nothing changed.
  const isScreen = (url: URL) => url.pathname === `${gamePath}/skjerm`;
  await page.route(isScreen, (route) => {
    const body = route.request().postData();
    return route.request().method() === "POST" && body
      ? route.continue({
          postData: body.replace('"scored":true', '"scored":"x"'),
        })
      : route.fallback();
  });
  await page.keyboard.press("3");
  const banner = bar.getByRole("alert");
  await expect(banner).toHaveText("Fikk ikke lagret trekket. Prøv igjen.");
  await expect(control("Bom [M]")).toHaveCount(0);
  await expect(hint).toBeHidden();
  await expect(tile(3)).toHaveRole("button");
  await page.unroute(isScreen);
  await page.reload();
  await expect(tiles).toHaveCount(8);
  await expect(teams).toHaveText(lag1);

  // Every tile revealed, the last one unscored: the hint, and axe with both looks.
  const allShown = bar.getByText("Alle svarene er avslørt.", { exact: true });
  await expect(allShown).toHaveCount(0);
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await page.keyboard.press(String(n));
    await expect(tile(n)).not.toHaveRole("button");
  }
  await page.keyboard.press("u");
  await page.keyboard.press("8");
  await expect(tile(8)).toContainText("uten poeng");
  await expect(allShown).toBeVisible();
  // One live region: the last Reveal's announcement carries the hint too, the bar has none.
  await expect(status).toHaveText(
    /^«.+» er avslørt uten poeng\. Alle svarene er avslørt\.$/,
  );
  await expect(bar.getByRole("status")).toHaveCount(0);
  expect(await style(allShown, "color")).toBe("rgb(246, 241, 231)");
  // The fullest bar (Angre shown, toggle on, both hints) does not overflow its row.
  expect(
    await bar.evaluate(
      (el) =>
        el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
    ),
  ).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);
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

test("FR-3, FR-27 (AC2, AC3), UX-DR21, NFR-5, NFR-6: Neste spørsmål by N and → shows the next Question with hidden tiles and the uten-poeng toggle off; a stale tab refreshes without moving on; a reload keeps the Question; Vis sluttstilling ends on Sluttstilling with the Teams by Score at 120 px, Vinner, the deletion date and Tilbake til spillet inside 1080 px; the Game page shows the final Scores, Vis sluttstilling and the deletion notice; axe is clean", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
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
  const heading = page.locator("h1");
  await expect(heading).toHaveText(QUESTION);

  const stage = page.locator("[data-stage]");
  const tile = (n: number) => stage.locator("[data-slot]").nth(n - 1);
  const tiles = page.getByRole("button", { name: /^Avslør plass/ });
  const status = stage.locator('[role="status"].sr-only');
  const teams = stage.getByRole("list", { name: "Lag" }).getByRole("listitem");
  const bar = page
    .getByText("Trykk F for fullskjerm.", { exact: true })
    .locator("..");
  const toggle = bar.getByRole("button", { name: /uten poeng \[U\]$/ });
  const next = bar.getByRole("button", {
    name: /^(Neste spørsmål|Vis sluttstilling) \[N\]$/,
  });
  const style = (locator: Locator, property: string) =>
    locator.evaluate(
      (el, p) => getComputedStyle(el).getPropertyValue(p),
      property,
    );
  const borders = async (style_: string) => {
    for (const t of await tiles.all())
      expect(await style(t, "border-top-style")).toBe(style_);
  };

  // Q1: Kari for Lag 1, then the toggle on.
  await tile(1).click();
  await expect(tile(1)).toHaveText("1Kari3 poeng");
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await borders("dashed");
  await expect(next).toHaveText("Neste spørsmål [N]");
  expect(await style(next, "font-weight")).toBe("600");

  // N: Q2 with every tile hidden, the toggle off (deferred from 6.3), Lag 1 still on.
  // Focus was on a tile of Q1, which unmounts, so it moves to Q2's heading.
  await tile(2).focus();
  await page.keyboard.press("n");
  await expect(heading).toHaveText(Q2);
  await expect(heading).toBeFocused();
  await expect(
    stage.getByText("Spørsmål 2 av 3", { exact: true }),
  ).toBeVisible();
  await expect(tiles).toHaveCount(2);
  await expect(status).toHaveText("Spørsmål 2 av 3.");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveText("Vis resten uten poeng [U]");
  await borders("solid");
  await expect(teams).toHaveText(["Svarer nåLag 13 poeng", "Lag 20 poeng"]);

  // T, then Rød for Lag 2.
  await page.keyboard.press("t");
  await expect(status).toHaveText("Lag 2 svarer nå.");
  await tile(1).click();
  await expect(tile(1)).toHaveText("1Rød2 poeng");
  await expect(teams).toHaveText(["Lag 13 poeng", "Svarer nåLag 22 poeng"]);

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
    stage.getByText("Spørsmål 3 av 3", { exact: true }),
  ).toBeVisible();

  // Q3: Vis sluttstilling, bold stage-ink once Oslo is revealed (unscored: no Score changes).
  await expect(next).toHaveText("Vis sluttstilling [N]");
  expect(await style(next, "font-weight")).toBe("600");
  await page.keyboard.press("u");
  await page.keyboard.press("1");
  await expect(tile(1)).toContainText("uten poeng");
  await expect(
    bar.getByText("Alle svarene er avslørt.", { exact: true }),
  ).toBeVisible();
  await expect(status).toHaveText(
    "«Oslo» er avslørt uten poeng. Alle svarene er avslørt.",
  );
  expect(await style(next, "font-weight")).toBe("700");
  expect(await style(next, "color")).toBe("rgb(246, 241, 231)");
  await expect(teams).toHaveText(["Lag 13 poeng", "Svarer nåLag 22 poeng"]);

  // AC2: Sluttstilling, focused, the Teams by Score, the winner on the accent card.
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
  // N there is WRONG_STATE: it refreshes to Sluttstilling with no banner.
  await stale.keyboard.press("n");
  await expect(stale.locator("h1")).toHaveText("Sluttstilling");
  await expect(
    stale.getByText(/^(Fikk ikke lagret trekket|Mistet forbindelsen)/),
  ).toHaveCount(0);
  await stale.close();
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
  const deletes = stage.getByText(/^Spillet slettes automatisk /);
  expect(dates).toContain(await deletes.textContent());
  expect(await style(deletes, "font-size")).toBe("24px");
  await expect(
    stage.getByText("Trykk F for fullskjerm.", { exact: true }),
  ).toBeVisible();
  const back = stage.getByRole("link", { name: "Tilbake til spillet" });
  await expect(back).toHaveAttribute("href", gamePath);
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Everything inside the 1080 px canvas (the viewport is 1920×1080, so scale 1).
  for (const el of await stage.locator(".stage-canvas *").all()) {
    const b = await el.boundingBox();
    if (b) expect(b.y + b.height).toBeLessThanOrEqual(1080);
  }
  expect(await seriousViolations(page)).toEqual([]);
  await page.reload();
  await expect(heading).toHaveText("Sluttstilling");

  // AC3: the Game page of the played Game.
  await back.click();
  await expect(page).toHaveURL(gamePath);
  await expect(page.getByText("Ferdig", { exact: true })).toBeVisible();
  const played = page.getByRole("region", { name: "Sluttstilling" });
  await expect(played).toContainText(/Lag 1\s*3 poeng\s*Lag 2\s*2 poeng/);
  const notice = played.getByRole("status");
  expect(
    dates.map((d) =>
      d.replace("Spillet slettes", "Spillet og alle svarene slettes"),
    ),
  ).toContain(await notice.textContent());
  expect(await seriousViolations(page)).toEqual([]);
  await played.getByRole("link", { name: "Vis sluttstilling" }).click();
  await expect(page).toHaveURL(`${gamePath}/skjerm`);
  await expect(heading).toHaveText("Sluttstilling");
});
