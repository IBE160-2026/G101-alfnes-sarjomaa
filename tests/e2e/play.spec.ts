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
  // The Board's hidden tiles are the only buttons (nine Groups, eight on the Board).
  await expect(page.getByRole("button")).toHaveCount(8);
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
  const status = stage.locator('[role="status"]');
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
