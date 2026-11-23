import type { Browser, Page } from "@playwright/test";
import {
  expect,
  FOCUS_RING_INVERSE,
  localOnly,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const QUESTION = "Hvem kommer for sent til hytta?";
const NO_KEY =
  "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar.";
const NARROW =
  "Gjennomgangen er laget for større skjerm. Den virker her, men blir trang.";
const REASON = "Gjennomgå alle spørsmålene først (1 igjen).";
const BELOW =
  "Vises ikke i spillet. Slå dem sammen med en gruppe over for at de skal telle.";
// Nine distinct normalised Answers, Kari written in two cases: nine Groups after the no-key fallback.
const SETS = [
  ["Kari", "Ola", "Per"],
  ["Anne", "Bjørn", "Cato", "kari"],
  ["Dina", "Erik", "Frida", "Kari"],
];

// Answer sets for a second Question: three distinct Answers.
const SETS_Q2 = [["Rød"], ["Blå"], ["Grønn"]];

// Set i answers Question q with sets[q][i].
async function submitSets(
  browser: Browser,
  baseURL: string | undefined,
  links: string[],
  sets: string[][][] = [SETS],
) {
  const context = await browser.newContext({ baseURL });
  await localOnly(context);
  const page = await context.newPage();
  for (const [i, link] of links.entries()) {
    // Links share a path, so a bare hash change would not reload the form.
    await page.goto("/");
    await page.goto(link);
    for (const [q, questionSets] of sets.entries()) {
      const fieldset = page.locator("fieldset").nth(q);
      const [first, ...rest] = questionSets[i];
      await fieldset.getByLabel("Svar 1", { exact: true }).fill(first);
      for (const [j, text] of rest.entries()) {
        if (j > 0)
          await fieldset.getByRole("button", { name: "Legg til svar" }).click();
        await fieldset.getByLabel(`Svar ${j + 2} (valgfritt)`).fill(text);
      }
    }
    await page.getByRole("button", { name: "Send inn svar" }).click();
    await expect(
      page.getByRole("heading", { name: "Svarene dine er lagret." }),
    ).toBeVisible();
  }
  await context.close();
}

// A new Host's collecting Game with the given Questions and three links; returns the Game path.
async function collectingGame(page: Page, questions = [QUESTION]) {
  await registerHost(page);
  await page.getByLabel("Navn på spillet").fill("Hyttetur");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText("Hyttetur");
  for (const [i, text] of questions.entries()) {
    await page.getByRole("button", { name: "Legg til spørsmål" }).click();
    await page.getByLabel(`Spørsmål ${i + 1}`, { exact: true }).fill(text);
    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("region", { name: "Spørsmål" })
        .getByRole("listitem")
        .nth(i)
        .getByRole("status"),
    ).toHaveText("Lagret");
  }
  await page.getByLabel("Antall lenker").fill("3");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(page.locator("[data-link]")).toHaveCount(3);
  const links = await page.locator("[data-link]").allTextContents();
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  return { gamePath: new URL(page.url()).pathname, links };
}

// Closes the collecting Game on its page and follows "Gå til gjennomgangen".
async function closeAndOpenReview(page: Page, gamePath: string) {
  await page.reload();
  await page
    .getByRole("region", { name: "Innsamling" })
    .getByRole("button", { name: "Steng innsamlingen", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Stenge innsamlingen?" })
    .getByRole("button", { name: "Steng innsamlingen" })
    .click();
  await expect(page.getByText("Til gjennomgang", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("link", { name: "Gå til gjennomgangen" }).click();
  await expect(page).toHaveURL(`${gamePath}/gjennomgang`);
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("FR-17 (AC4), FR-19 (AC3), UX-DR10, UX-DR11, UX-DR17 (AC5), NFR-4, NFR-6: a collecting Game redirects away from Review; after close the Game page links to Review, which shows the NO_KEY Notice, the rail, eight Groups on the Board with raw Answers and one below the line, and adapts at 1280, 1100, 900 and 700 px with no serious axe finding", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page);

  // AC5: Review for a Game not in review lands on the Game page.
  await page.goto(`${gamePath}/gjennomgang`);
  await expect(page).toHaveURL(gamePath);
  await expect(page.getByText("Samler inn", { exact: true })).toBeVisible();

  await submitSets(browser, baseURL, links);
  await closeAndOpenReview(page, gamePath);
  await expect(page).toHaveTitle("Gjennomgang – Hyttetur – Toppsvar");

  const breadcrumb = page.getByRole("navigation", { name: "Brødsmulesti" });
  await expect(breadcrumb).toHaveText(
    /Mine spill\s*›\s*Hyttetur\s*›\s*Gjennomgang/,
  );
  await expect(page.locator("h1")).toHaveText("Gjennomgang");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText(NO_KEY, { exact: true })).toBeVisible();

  // The rail: count, one row with Manuell, no visible "Ikke gjennomgått", aria-current.
  const rail = page.getByRole("navigation", { name: "Spørsmål" });
  await expect(rail.getByRole("heading", { level: 2 })).toHaveText(
    "0 av 1 gjennomgått",
  );
  const row = rail.getByRole("link", {
    name: `1 ${QUESTION} Ikke gjennomgått Manuell`,
  });
  await expect(row).toHaveAttribute("aria-current", "page");
  await expect(row).toHaveAttribute("title", QUESTION);
  await expect(rail.getByText("Manuell", { exact: true })).toBeVisible();
  // In the accessible name only: Playwright counts a 1 px sr-only box as visible.
  await expect(rail.getByText("Ikke gjennomgått")).toHaveClass("sr-only");
  await expect(rail.getByText("Gjennomgått", { exact: true })).toHaveCount(0);
  // Lås brettet sits at the rail's foot, after the nav landmark rather than inside it.
  const railBox = rail.locator("..");
  await expect(rail.getByRole("button")).toHaveCount(0);
  const lock = railBox.getByRole("button", { name: "Lås brettet" });
  await expect(lock).toHaveAttribute("aria-disabled", "true");
  await expect(lock).toHaveAccessibleDescription(REASON);
  await expect(railBox.getByText(REASON, { exact: true })).toBeVisible();

  // Main pane header: the Question, with the mark button to its right.
  const header = page.getByRole("heading", {
    level: 2,
    name: /Spørsmål 1 av 1/,
  });
  await expect(header).toContainText(QUESTION);
  const mark = page.getByRole("button", { name: "Marker som gjennomgått" });
  await expect(mark).toHaveAttribute("aria-disabled", "true");
  const headerBox = (await header.boundingBox())!;
  const markBox = (await mark.boundingBox())!;
  expect(markBox.x).toBeGreaterThan(headerBox.x + headerBox.width - 1);

  // Sections: eight ranked compact rows, the divider, one dashed row below the line.
  const board = page.getByRole("region", { name: "På brettet (8 grupper)" });
  await expect(board.getByRole("heading", { level: 3 })).toBeVisible();
  await expect(board.getByRole("listitem")).toHaveCount(8);
  await expect(board.getByRole("heading", { level: 4 })).toHaveText([
    "kari",
    "anne",
    "dina",
    "bjørn",
    "cato",
    "erik",
    "frida",
    "ola",
  ]);
  // FR-19: the compact row shows the raw written form and its Answer count after the label.
  await expect(board.getByRole("listitem").first()).toHaveText(
    /^1\.\s*kari\s*Kari · 3 svar\s*3 personer$/,
  );
  await expect(board.getByRole("listitem").nth(1)).toHaveText(
    /^2\.\s*anne\s*Anne\s*1 person$/,
  );
  const divider = page.getByText("Alt under streken vises ikke i spillet", {
    exact: true,
  });
  await expect(divider).toBeVisible();
  expect(
    await divider.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`;
    }),
  ).toBe("2px solid rgb(133, 125, 140)");
  const below = page.getByRole("region", {
    name: "Ikke på brettet (1 gruppe)",
  });
  await expect(below.getByText(BELOW, { exact: true })).toBeVisible();
  const ninth = below.getByRole("listitem");
  await expect(ninth).toHaveCount(1);
  await expect(ninth).toContainText("9.");
  await expect(ninth.getByRole("heading", { level: 4 })).toHaveText("per");
  expect(
    await ninth.evaluate((el) => getComputedStyle(el).borderTopStyle),
  ).toBe("dashed");
  // A one-Answer Group is one 52 px row with no chip list.
  expect(
    (await board.getByRole("listitem").first().boundingBox())!.height,
  ).toBe(52);
  await expect(board.getByRole("list")).toHaveCount(1);
  await expect(page.getByText(/sikker|terskel|prosent|%/)).toHaveCount(0);
  await expect(page.getByText("Forkastet")).toHaveCount(0);

  const select = page.getByRole("combobox", { name: "Spørsmål" });
  const narrow = page.getByText(NARROW, { exact: true });
  const railWidth = () =>
    railBox.evaluate((el) => el.getBoundingClientRect().width);

  // AC5 at 1280: rail 288 px.
  expect(await railWidth()).toBe(288);
  await expect(select).toBeHidden();
  await expect(narrow).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);

  // 1100: rail 240 px.
  await page.setViewportSize({ width: 1100, height: 900 });
  expect(await railWidth()).toBe(240);
  await expect(select).toBeHidden();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);

  // 900: the rail becomes a select above the main pane, Lås brettet moves to the foot.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(rail).toBeHidden();
  await expect(select).toBeVisible();
  await expect(select.locator("option")).toHaveText([
    "Spørsmål 1 av 1 – Ikke gjennomgått",
  ]);
  expect((await select.boundingBox())!.y).toBeLessThan(
    (await header.boundingBox())!.y,
  );
  const footLock = page.getByRole("button", { name: "Lås brettet" });
  await expect(footLock).toHaveCount(1);
  await expect(footLock).toHaveAccessibleDescription(REASON);
  expect((await footLock.boundingBox())!.y).toBeGreaterThan(
    (await ninth.boundingBox())!.y,
  );
  await expect(narrow).toBeHidden();
  // Choosing does nothing until "Vis" (WCAG 3.2.2); "Vis" loads that Question.
  await select.selectOption("1");
  await expect(page).toHaveURL(`${gamePath}/gjennomgang`);
  await page.getByRole("button", { name: "Vis" }).click();
  await expect(page).toHaveURL(`${gamePath}/gjennomgang?q=1`);
  await expect(header).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);

  // 700: also the narrow-screen notice.
  await page.setViewportSize({ width: 700, height: 900 });
  await expect(narrow).toBeVisible();
  await expect(select).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);
});

test("FR-20 (AC3), UX-DR12, UX-DR18, NFR-6: ticking one Group shows the hint, two the merge button; a failed merge keeps Groups and selection with the message in the bar; the merge re-sorts the list, focuses the merged heading and announces it; Esc clears; bar controls have the white focus ring and axe is clean with the bar open; a merge from a stale tab refreshes the list and clears the selection", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page);
  await submitSets(browser, baseURL, links);
  await closeAndOpenReview(page, gamePath);

  const board = page.getByRole("region", { name: "På brettet (8 grupper)" });
  const bar = page.locator("[data-selection-bar]");
  const box = (label: string) =>
    page.getByRole("checkbox", { name: `Velg «${label}»` });
  const card = (label: string) =>
    page.getByRole("listitem").filter({
      has: page.getByRole("heading", { level: 4, name: label, exact: true }),
    });
  await expect(bar).toHaveCount(0);

  // One Group: the hint, no merge button. Per sits below the line, rank 9.
  await box("per").check();
  await expect(bar).toContainText("1 gruppe valgt");
  await expect(
    bar.getByText("Velg minst to grupper for å slå sammen.", { exact: true }),
  ).toBeVisible();
  await expect(bar.getByRole("button", { name: /Slå sammen/ })).toHaveCount(0);
  const plain = await card("frida").evaluate(
    (el) => el.getBoundingClientRect().height,
  );

  // Two Groups: the merge button; the selected card changes fill but not size.
  await box("frida").check();
  await expect(bar).toContainText("2 grupper valgt");
  const merge = bar.getByRole("button", { name: "Slå sammen 2 grupper" });
  await expect(merge).toBeVisible();
  expect(
    await card("frida").evaluate((el) => [
      getComputedStyle(el).backgroundColor,
      el.getBoundingClientRect().height,
    ]),
  ).toEqual(["rgb(245, 231, 240)", plain]);

  // A failed request: the message inside the bar above its actions, nothing else changes.
  const isAction = (url: URL) => url.pathname === `${gamePath}/gjennomgang`;
  await page.route(isAction, (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await merge.click();
  const failure = bar.getByRole("alert");
  await expect(failure).toHaveText("Endringen ble ikke lagret. Prøv igjen.");
  expect((await failure.boundingBox())!.y).toBeLessThan(
    (await merge.boundingBox())!.y,
  );
  await expect(box("per")).toBeChecked();
  await expect(box("frida")).toBeChecked();
  await expect(
    page.getByRole("region", { name: "Ikke på brettet (1 gruppe)" }),
  ).toBeVisible();
  await page.unroute(isAction);

  // Pessimistic: the selected cards are busy until the server answers.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(isAction, async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.fallback();
  });
  await merge.click();
  await expect(failure).toHaveCount(0);
  await expect(card("frida")).toHaveAttribute("aria-busy", "true");
  await expect(card("per")).toHaveAttribute("aria-busy", "true");
  await expect(card("kari")).not.toHaveAttribute("aria-busy");
  await expect(merge).toContainText("Slår sammen");
  release();

  // Frida and Per came from two sets: Count 2, so the merged Group moves from 7 to 2.
  await expect(bar).toHaveCount(0);
  await expect(board.getByRole("heading", { level: 4 })).toHaveText([
    "kari",
    "frida",
    "anne",
    "dina",
    "bjørn",
    "cato",
    "erik",
    "ola",
  ]);
  await expect(page.getByText("Ikke på brettet")).toHaveCount(0);
  await expect(
    board.getByRole("heading", { level: 4, name: "frida" }),
  ).toBeFocused();
  await expect(page.locator('p[aria-live="polite"]')).toHaveText(
    "Slått sammen til «frida», nå 2 personer, plass 2.",
  );
  // The merged Group is a multi-chip card, chips in alphabetical order.
  await expect(card("frida")).toHaveText(
    /^2\.\s*frida\s*2 personer\s*Frida\s*Per$/,
  );
  await expect(card("frida").getByRole("listitem")).toHaveText([
    "Frida",
    "Per",
  ]);
  await page.unroute(isAction);

  // Esc clears the selection.
  await box("anne").check();
  await box("dina").check();
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  await expect(box("anne")).not.toBeChecked();
  await expect(box("dina")).not.toBeChecked();

  // Keyboard: Space ticks, Tab goes from the last card to the bar, whose controls ring white.
  await box("kari").check();
  await box("ola").focus();
  await page.keyboard.press("Space");
  await expect(box("ola")).toBeChecked();
  const outline = () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
    });
  await page.keyboard.press("Tab");
  await expect(
    bar.getByRole("button", { name: "Slå sammen 2 grupper" }),
  ).toBeFocused();
  expect(await outline()).toBe(FOCUS_RING_INVERSE);
  await page.keyboard.press("Tab");
  await expect(bar.getByRole("button", { name: "Fjern valg" })).toBeFocused();
  expect(await outline()).toBe(FOCUS_RING_INVERSE);
  for (const button of await bar.getByRole("button").all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await box("kari").locator("..").boundingBox())!.height).toBe(44);
  // The title streams in with the action's re-render; under load it can lag the list.
  await expect(page).toHaveTitle("Gjennomgang – Hyttetur – Toppsvar");
  expect(await seriousViolations(page)).toEqual([]);

  // Fjern valg clears, and focus goes back to the first ticked checkbox.
  await page.keyboard.press("Enter");
  await expect(bar).toHaveCount(0);
  await expect(box("kari")).toBeFocused();
  await expect(box("kari")).not.toBeChecked();

  // A stale view: another tab merges Dina and Erik; merging Erik here refreshes instead.
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("checkbox", { name: "Velg «dina»" }).check();
  await other.getByRole("checkbox", { name: "Velg «erik»" }).check();
  await other.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(other.locator("[data-selection-bar]")).toHaveCount(0);
  await other.close();
  await box("erik").check();
  await box("ola").check();
  await bar.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(page.getByText("Endringen ble ikke lagret")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 4, name: "erik", exact: true }),
  ).toHaveCount(0);
  await expect(card("dina").getByRole("listitem")).toHaveText(["Dina", "Erik"]);
  await expect(card("ola")).toBeVisible();
});

test("FR-20 (AC4), FR-16, UX-DR11, UX-DR12, UX-DR18, NFR-6: ticking a chip clears the Group selection and shows N svar valgt; the select lists the ranked Groups as label (N) with the white focus ring; Esc and a Question change clear; a failed move keeps the selection with the message in the bar; Flytt focuses the target and announces; Ny gruppe opens the focused rename field, Enter keeps the label, typing renames it; axe is clean with the bar and with the field open", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page, [
    QUESTION,
    "Hva sier verten?",
  ]);
  await submitSets(browser, baseURL, links, [SETS, SETS_Q2]);
  await closeAndOpenReview(page, gamePath);

  const bar = page.locator("[data-selection-bar]");
  const live = page.locator('p[aria-live="polite"]');
  const box = (label: string) =>
    page.getByRole("checkbox", { name: `Velg «${label}»` });
  const chip = (text: string) =>
    page.getByRole("checkbox", { name: text, exact: true });
  const heading = (label: string) =>
    page.getByRole("heading", { level: 4, name: label, exact: true });
  const merge = async (a: string, b: string) => {
    await box(a).check();
    await box(b).check();
    await bar.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
    await expect(bar).toHaveCount(0);
  };
  const outline = () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
    });

  // Every Group starts as a compact row: merging gives two multi-chip cards,
  // anne (Anne, Bjørn: one set, Count 1) and dina (Cato, Dina: Count 2).
  await expect(page.getByRole("checkbox", { name: /^[A-ZÆØÅ]/ })).toHaveCount(
    0,
  );
  await merge("anne", "bjørn");
  await merge("cato", "dina");

  // A chip clears the Group selection; the bar counts Answers.
  await box("kari").check();
  await expect(bar).toContainText("1 gruppe valgt");
  await chip("Bjørn").check();
  await expect(box("kari")).not.toBeChecked();
  await expect(bar).toContainText("1 svar valgt");
  await chip("Dina").check();
  await expect(bar).toContainText("2 svar valgt");
  // And a Group clears the chips.
  await box("ola").check();
  await expect(chip("Bjørn")).not.toBeChecked();
  await expect(chip("Dina")).not.toBeChecked();
  await expect(bar).toContainText("1 gruppe valgt");
  await box("ola").uncheck();
  await chip("Bjørn").check();

  // The select: every kept Group in ranked order, as label (N).
  const select = bar.getByLabel("Flytt til gruppe");
  const ranked = await page
    .locator(
      "section[aria-labelledby=pa-brettet] h4, section[aria-labelledby=ikke-pa-brettet] h4",
    )
    .allTextContents();
  const options = await select.locator("option").allTextContents();
  expect(options.map((o) => o.replace(/ \(\d+\)$/, ""))).toEqual(ranked);
  expect(options.slice(0, 2)).toEqual(["kari (3)", "dina (2)"]);
  await expect(bar.getByRole("button", { name: "Ny gruppe" })).toBeVisible();

  // Keyboard: the select rings white on the dark bar; axe is clean with it open.
  await select.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(select).toBeFocused();
  expect(await outline()).toBe(FOCUS_RING_INVERSE);
  for (const button of await bar.getByRole("button").all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await chip("Bjørn").locator("..").boundingBox())!.height).toBe(44);
  await expect(page).toHaveTitle("Gjennomgang – Hyttetur – Toppsvar");
  expect(await seriousViolations(page)).toEqual([]);

  // Esc clears.
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  await expect(chip("Bjørn")).not.toBeChecked();

  // A Question change clears.
  await chip("Bjørn").check();
  const rail = page.getByRole("navigation", { name: "Spørsmål" });
  await rail.getByRole("link", { name: /^2 / }).click();
  await expect(
    page.getByRole("heading", { level: 4, name: "rød" }),
  ).toBeVisible();
  await expect(bar).toHaveCount(0);
  await rail.getByRole("link", { name: /^1 / }).click();
  await expect(heading("anne")).toBeVisible();
  await expect(bar).toHaveCount(0);
  await expect(chip("Bjørn")).not.toBeChecked();

  // A failed request: the message inside the bar, the selection stays.
  await chip("Bjørn").check();
  const isAction = (url: URL) =>
    url.pathname.startsWith(`${gamePath}/gjennomgang`);
  await page.route(isAction, (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await bar.getByRole("button", { name: "Flytt", exact: true }).click();
  await expect(bar.getByRole("alert")).toHaveText(
    "Endringen ble ikke lagret. Prøv igjen.",
  );
  await expect(chip("Bjørn")).toBeChecked();
  await page.unroute(isAction);

  // Flytt: Bjørn to kari; focus on its heading and the announcement.
  await select.selectOption({ label: "kari (3)" });
  await bar.getByRole("button", { name: "Flytt", exact: true }).click();
  await expect(bar).toHaveCount(0);
  await expect(heading("kari")).toBeFocused();
  await expect(live).toHaveText("1 svar flyttet til «kari».");
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: heading("kari") })
      .getByRole("checkbox", { name: "Bjørn" }),
  ).toBeVisible();

  // Ny gruppe: the rename field has focus, prefilled; Enter keeps the label.
  await chip("Cato").check();
  await bar.getByRole("button", { name: "Ny gruppe" }).click();
  const field = page.getByLabel("Navn på gruppen");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("cato");
  await expect(page.getByText("4/40", { exact: true })).toBeVisible();
  await expect(live).toHaveText(
    "Ny gruppe «cato» laget. Skriv et nytt navn eller trykk Enter.",
  );
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press("Enter");
  await expect(field).toHaveCount(0);
  await expect(heading("cato")).toBeFocused();

  // A second split, renamed by typing over the selected default label.
  await chip("Bjørn").check();
  await bar.getByRole("button", { name: "Ny gruppe" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("bjørn");
  await page.keyboard.type("Sover over seg");
  await expect(page.getByText("14/40", { exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(heading("Sover over seg")).toBeFocused();
  await expect(live).toHaveText("Navnet er endret.");
  await expect(field).toHaveCount(0);
});
