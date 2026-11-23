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
  await expect(mark).not.toHaveAttribute("aria-disabled");
  const headerBox = (await header.boundingBox())!;
  const markBox = (await mark.boundingBox())!;
  expect(markBox.x).toBeGreaterThan(headerBox.x + headerBox.width - 1);

  // Sections: eight ranked compact rows, the divider, one dashed row below the line.
  const board = page.getByRole("region", { name: "På brettet (8 grupper)" });
  await expect(board.getByRole("heading", { level: 3 })).toBeVisible();
  await expect(board.getByRole("listitem")).toHaveCount(8);
  await expect(board.getByRole("heading", { level: 4 })).toHaveText([
    "Kari",
    "Anne",
    "Dina",
    "Bjørn",
    "Cato",
    "Erik",
    "Frida",
    "Ola",
  ]);
  // FR-16, FR-19: the default label is the written form, so the compact row adds only the Answer count.
  await expect(board.getByRole("listitem").first()).toHaveText(
    /^1\.\s*Kari\s*· 3 svar\s*3 personer\s*⋯$/,
    // innerText leaves out the closed Group menu's items.
    { useInnerText: true },
  );
  await expect(board.getByRole("listitem").nth(1)).toHaveText(
    /^2\.\s*Anne\s*1 person\s*⋯$/,
    { useInnerText: true },
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
  await expect(ninth.getByRole("heading", { level: 4 })).toHaveText("Per");
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
  await box("Per").check();
  await expect(bar).toContainText("1 gruppe valgt");
  await expect(
    bar.getByText("Velg minst to grupper for å slå sammen.", { exact: true }),
  ).toBeVisible();
  await expect(bar.getByRole("button", { name: /Slå sammen/ })).toHaveCount(0);
  const plain = await card("Frida").evaluate(
    (el) => el.getBoundingClientRect().height,
  );

  // Two Groups: the merge button; the selected card changes fill but not size.
  await box("Frida").check();
  await expect(bar).toContainText("2 grupper valgt");
  const merge = bar.getByRole("button", { name: "Slå sammen 2 grupper" });
  await expect(merge).toBeVisible();
  expect(
    await card("Frida").evaluate((el) => [
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
  await expect(box("Per")).toBeChecked();
  await expect(box("Frida")).toBeChecked();
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
  await expect(card("Frida")).toHaveAttribute("aria-busy", "true");
  await expect(card("Per")).toHaveAttribute("aria-busy", "true");
  await expect(card("Kari")).not.toHaveAttribute("aria-busy");
  await expect(merge).toContainText("Slår sammen");
  release();

  // Frida and Per came from two sets: Count 2, so the merged Group moves from 7 to 2.
  await expect(bar).toHaveCount(0);
  await expect(board.getByRole("heading", { level: 4 })).toHaveText([
    "Kari",
    "Frida",
    "Anne",
    "Dina",
    "Bjørn",
    "Cato",
    "Erik",
    "Ola",
  ]);
  await expect(page.getByText("Ikke på brettet")).toHaveCount(0);
  await expect(
    board.getByRole("heading", { level: 4, name: "Frida" }),
  ).toBeFocused();
  await expect(page.locator('p[aria-live="polite"]')).toHaveText(
    "Slått sammen til «Frida», nå 2 personer, plass 2.",
  );
  // The merged Group is a multi-chip card, chips in alphabetical order.
  await expect(card("Frida")).toHaveText(
    /^2\.\s*Frida\s*2 personer\s*⋯\s*Frida\s*Per$/,
    // innerText leaves out the closed Group menu's items.
    { useInnerText: true },
  );
  await expect(card("Frida").getByRole("listitem")).toHaveText([
    "Frida",
    "Per",
  ]);
  await page.unroute(isAction);

  // Esc clears the selection.
  await box("Anne").check();
  await box("Dina").check();
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);
  await expect(box("Anne")).not.toBeChecked();
  await expect(box("Dina")).not.toBeChecked();

  // Keyboard: Space ticks, Tab goes through the last card's menu to the bar, whose controls ring white.
  await box("Kari").check();
  await box("Ola").focus();
  await page.keyboard.press("Space");
  await expect(box("Ola")).toBeChecked();
  const outline = () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.activeElement!);
      return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
    });
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Mer for «Ola»" }),
  ).toBeFocused();
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
  expect((await box("Kari").locator("..").boundingBox())!.height).toBe(44);
  // The title streams in with the action's re-render; under load it can lag the list.
  await expect(page).toHaveTitle("Gjennomgang – Hyttetur – Toppsvar");
  expect(await seriousViolations(page)).toEqual([]);

  // Fjern valg clears, and focus goes back to the first ticked checkbox.
  await page.keyboard.press("Enter");
  await expect(bar).toHaveCount(0);
  await expect(box("Kari")).toBeFocused();
  await expect(box("Kari")).not.toBeChecked();

  // A stale view: another tab merges Dina and Erik; merging Erik here refreshes instead.
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("checkbox", { name: "Velg «Dina»" }).check();
  await other.getByRole("checkbox", { name: "Velg «Erik»" }).check();
  await other.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(other.locator("[data-selection-bar]")).toHaveCount(0);
  await other.close();
  await box("Erik").check();
  await box("Ola").check();
  await bar.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
  await expect(page.getByText("Endringen ble ikke lagret")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 4, name: "Erik", exact: true }),
  ).toHaveCount(0);
  await expect(card("Dina").getByRole("listitem")).toHaveText(["Dina", "Erik"]);
  await expect(card("Ola")).toBeVisible();
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
  // Anne (Anne, Bjørn: one set, Count 1) and Dina (Cato, Dina: Count 2).
  await expect(page.getByRole("checkbox", { name: /^[A-ZÆØÅ]/ })).toHaveCount(
    0,
  );
  await merge("Anne", "Bjørn");
  await merge("Cato", "Dina");

  // A chip clears the Group selection; the bar counts Answers.
  await box("Kari").check();
  await expect(bar).toContainText("1 gruppe valgt");
  await chip("Bjørn").check();
  await expect(box("Kari")).not.toBeChecked();
  await expect(bar).toContainText("1 svar valgt");
  await chip("Dina").check();
  await expect(bar).toContainText("2 svar valgt");
  // And a Group clears the chips.
  await box("Ola").check();
  await expect(chip("Bjørn")).not.toBeChecked();
  await expect(chip("Dina")).not.toBeChecked();
  await expect(bar).toContainText("1 gruppe valgt");
  await box("Ola").uncheck();
  await chip("Bjørn").check();

  // The select: every kept Group in ranked order, as label (N), except Anne,
  // which already holds every ticked Answer.
  const select = bar.getByLabel("Flytt til gruppe");
  const ranked = await page
    .locator(
      "section[aria-labelledby=pa-brettet] h4, section[aria-labelledby=ikke-pa-brettet] h4",
    )
    .allTextContents();
  const options = await select.locator("option").allTextContents();
  expect(options.map((o) => o.replace(/ \(\d+\)$/, ""))).toEqual(
    ranked.filter((label) => label !== "Anne"),
  );
  expect(options.slice(0, 2)).toEqual(["Kari (3)", "Dina (2)"]);
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
    page.getByRole("heading", { level: 4, name: "Rød" }),
  ).toBeVisible();
  await expect(bar).toHaveCount(0);
  await rail.getByRole("link", { name: /^1 / }).click();
  await expect(heading("Anne")).toBeVisible();
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

  // Flytt: Bjørn to Kari. Pessimistic: the card owning the chip is busy until the server answers.
  const card = (label: string) =>
    page.getByRole("listitem").filter({ has: heading(label) });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(isAction, async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.fallback();
  });
  await select.selectOption({ label: "Kari (3)" });
  const flytt = bar.getByRole("button", { name: "Flytt", exact: true });
  await flytt.click();
  await expect(card("Anne")).toHaveAttribute("aria-busy", "true");
  await expect(card("Kari")).not.toHaveAttribute("aria-busy");
  await expect(card("Dina")).not.toHaveAttribute("aria-busy");
  await expect(flytt).toContainText("Flytter …");
  release();
  // Focus on the target's heading and the announcement.
  await expect(bar).toHaveCount(0);
  await page.unroute(isAction);
  await expect(heading("Kari")).toBeFocused();
  await expect(live).toHaveText("1 svar flyttet til «Kari».");
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: heading("Kari") })
      .getByRole("checkbox", { name: "Bjørn" }),
  ).toBeVisible();

  // A chip of several Answers counts them all; unticking it closes the bar.
  await chip("Kari · 3 svar").check();
  await expect(bar).toContainText("3 svar valgt");
  await chip("Kari · 3 svar").uncheck();
  await expect(bar).toHaveCount(0);

  // Ny gruppe: the rename field has focus, prefilled. Empty is refused in the
  // field; Enter on the unchanged label closes it without a request.
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && isAction(new URL(request.url())))
      posts++;
  });
  await chip("Cato").check();
  await bar.getByRole("button", { name: "Ny gruppe" }).click();
  const field = page.getByLabel("Navn på gruppen");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Cato");
  await expect(page.getByText("4/40", { exact: true })).toBeVisible();
  await expect(live).toHaveText(
    "Ny gruppe «Cato» laget. Skriv et nytt navn eller trykk Enter.",
  );
  expect(await seriousViolations(page)).toEqual([]);
  await field.fill("");
  await page.keyboard.press("Enter");
  await expect(field).toHaveAccessibleDescription("Feil: Skriv et navn.");
  await expect(field).toBeFocused();
  await field.fill("Cato");
  const sent = posts;
  await page.keyboard.press("Enter");
  await expect(field).toHaveCount(0);
  await expect(heading("Cato")).toBeFocused();
  expect(posts).toBe(sent);

  // A second split, renamed by typing over the selected default label.
  await chip("Bjørn").check();
  await bar.getByRole("button", { name: "Ny gruppe" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Bjørn");
  await page.keyboard.type("Sover over seg");
  await expect(page.getByText("14/40", { exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(heading("Sover over seg")).toBeFocused();
  await expect(live).toHaveText("Navnet er endret.");
  await expect(field).toHaveCount(0);

  // Esc cancels the field and focuses the Group's heading.
  await merge("Erik", "Frida");
  await chip("Frida").check();
  await bar.getByRole("button", { name: "Ny gruppe" }).click();
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(heading("Frida")).toBeFocused();
});

test("FR-20, FR-21 (AC3), UX-DR10, UX-DR18, NFR-6: the Group menu opens and closes with Esc; Gi nytt navn and a label click open the rename field, Enter saves and Esc cancels; a failed rename or discard shows the card-top Notice; Forkast fra brettet moves the card to Forkastet and promotes the ninth, Angre forkasting puts it back; a rename from a stale tab refreshes; axe is clean with the menu open and with Forkastet shown", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page);
  await submitSets(browser, baseURL, links);
  await closeAndOpenReview(page, gamePath);

  const board = page.getByRole("region", { name: "På brettet (8 grupper)" });
  const live = page.locator('p[aria-live="polite"]');
  const field = page.getByLabel("Navn på gruppen");
  const RETRY = "Endringen ble ikke lagret. Prøv igjen.";
  const heading = (label: string) =>
    page.getByRole("heading", { level: 4, name: label, exact: true });
  const card = (label: string) =>
    page.getByRole("listitem").filter({ has: heading(label) });
  const trigger = (label: string) =>
    page.getByRole("button", { name: `Mer for «${label}»`, exact: true });
  const pickFrom = async (label: string, item: string) => {
    await trigger(label).click();
    await page.getByRole("button", { name: item, exact: true }).click();
  };
  const isAction = (url: URL) => url.pathname === `${gamePath}/gjennomgang`;
  const abortPosts = () =>
    page.route(isAction, (route) =>
      route.request().method() === "POST" ? route.abort() : route.fallback(),
    );

  // The menu: a disclosure with two items; Esc closes it and focus returns to the trigger.
  const menu = page.locator(
    `#${await trigger("Anne").getAttribute("aria-controls")}`,
  );
  await expect(trigger("Anne")).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeHidden();
  await trigger("Anne").click();
  await expect(trigger("Anne")).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("button")).toHaveText([
    "Gi nytt navn",
    "Forkast fra brettet",
  ]);
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger("Anne")).toBeFocused();
  await expect(trigger("Anne")).toHaveAttribute("aria-expanded", "false");

  // Esc in a menu leaves the selection alone; the next Esc clears it.
  const bar = page.locator("[data-selection-bar]");
  await page.getByRole("checkbox", { name: "Velg «Dina»" }).check();
  await expect(bar).toBeVisible();
  await trigger("Erik").click();
  await page.keyboard.press("Escape");
  await expect(trigger("Erik")).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("checkbox", { name: "Velg «Dina»" }),
  ).toBeChecked();
  await expect(bar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bar).toHaveCount(0);

  // A click outside closes it, and so does Tab past its last item.
  await trigger("Anne").click();
  await page
    .getByRole("heading", { level: 3, name: "På brettet (8 grupper)" })
    .click();
  await expect(trigger("Anne")).toHaveAttribute("aria-expanded", "false");
  await trigger("Anne").click();
  await page.keyboard.press("Tab");
  await expect(
    menu.getByRole("button", { name: "Gi nytt navn" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await expect(trigger("Anne")).toHaveAttribute("aria-expanded", "false");

  // Gi nytt navn: the focused field with N/40; Enter saves and announces.
  await pickFrom("Anne", "Gi nytt navn");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Anne");
  await expect(page.getByText("4/40", { exact: true })).toBeVisible();
  await page.keyboard.type("Anne kommer sist");
  await page.keyboard.press("Enter");
  await expect(heading("Anne kommer sist")).toBeFocused();
  await expect(live).toHaveText("Navnet er endret.");
  await expect(field).toHaveCount(0);

  // A label click opens the field; Esc cancels and focuses the heading.
  await heading("Dina").click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Dina");
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(heading("Dina")).toBeFocused();

  // An aborted rename: the message at the top of that card, the field still open.
  await heading("Bjørn").click();
  await page.keyboard.type("Bjørn B.");
  await abortPosts();
  await page.keyboard.press("Enter");
  const bjorn = page.getByRole("listitem").filter({ has: field });
  await expect(bjorn.getByRole("alert")).toHaveText(RETRY);
  expect((await bjorn.getByRole("alert").boundingBox())!.y).toBeLessThan(
    (await field.boundingBox())!.y,
  );
  await expect(field).toHaveValue("Bjørn B.");
  await page.unroute(isAction);
  await page.keyboard.press("Escape");
  await expect(heading("Bjørn")).toBeFocused();
  await expect(page.getByText(RETRY)).toHaveCount(0);

  // Forkast fra brettet: Kari leaves the Board for Forkastet, and Per (rank 9) moves up.
  await pickFrom("Kari", "Forkast fra brettet");
  const forkastet = page.getByRole("region", { name: "Forkastet (1 gruppe)" });
  await expect(forkastet.getByRole("heading", { level: 4 })).toHaveText([
    "Kari",
  ]);
  await expect(heading("Kari")).toBeFocused();
  await expect(live).toHaveText("«Kari» er forkastet og vises ikke i spillet.");
  await expect(heading("Kari")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(forkastet.getByRole("checkbox")).toHaveCount(0);
  await expect(trigger("Kari")).toHaveCount(0);
  await expect(
    forkastet.getByRole("button", { name: "Angre forkasting av «Kari»" }),
  ).toBeVisible();
  await expect(board.getByRole("heading", { level: 4 })).toHaveText([
    "Anne kommer sist",
    "Dina",
    "Bjørn",
    "Cato",
    "Erik",
    "Frida",
    "Ola",
    "Per",
  ]);
  await expect(page.getByText("Ikke på brettet")).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);

  // An aborted restore: the message at the top of that card, which stays under Forkastet.
  await abortPosts();
  await forkastet.getByRole("button", { name: /^Angre forkasting/ }).click();
  await expect(card("Kari").getByRole("alert")).toHaveText(RETRY);
  await expect(forkastet.getByRole("heading", { level: 4 })).toHaveText([
    "Kari",
  ]);
  await page.unroute(isAction);

  // Angre forkasting: back at rank 1, Per below the line again.
  await forkastet.getByRole("button", { name: /^Angre forkasting/ }).click();
  await expect(forkastet).toHaveCount(0);
  await expect(board.getByRole("heading", { level: 4 }).first()).toHaveText(
    "Kari",
  );
  await expect(heading("Kari")).toBeFocused();
  await expect(live).toHaveText("«Kari» er tilbake.");
  await expect(
    page.getByRole("region", { name: "Ikke på brettet (1 gruppe)" }),
  ).toContainText("Per");

  // An aborted discard: the message at the top of that card, which stays on the Board.
  await abortPosts();
  await pickFrom("Ola", "Forkast fra brettet");
  await expect(card("Ola").getByRole("alert")).toHaveText(RETRY);
  await expect(
    board.getByRole("heading", { level: 4, name: "Ola" }),
  ).toBeVisible();
  await page.unroute(isAction);

  // A stale tab: another tab discards Cato; renaming it here refreshes instead.
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByRole("button", { name: "Mer for «Cato»" }).click();
  await other.getByRole("button", { name: "Forkast fra brettet" }).click();
  await expect(
    other.getByRole("region", { name: "Forkastet (1 gruppe)" }),
  ).toBeVisible();
  await other.close();
  await heading("Cato").click();
  await page.keyboard.type("Cato C.");
  await page.keyboard.press("Enter");
  await expect(field).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 3, name: "På brettet (8 grupper)" }),
  ).toBeFocused();
  await expect(
    page
      .getByRole("region", { name: "Forkastet (1 gruppe)" })
      .getByRole("heading", { level: 4 }),
  ).toHaveText(["Cato"]);
  await expect(page.getByText(RETRY)).toHaveCount(0);
});

test("FR-21 (AC2, AC3, AC5), FR-13, UX-DR8, UX-DR17, UX-DR18, NFR-6: a Question with every Group discarded cannot be marked until one is restored; an aborted mark shows the retry sentence; marking moves to the next unreviewed Question, announces it and focuses its heading; Lås brettet opens a dialog that Esc cancels; a confirm after another tab cleared a mark gives way to the disabled trigger; the lock lands on the Game page and another tab's open dialog then says the Board is locked; a stale tab's mark, merge and discard then say the Board is locked, and Review redirects; axe is clean with the dialog open and on the ready page", async ({
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

  // A second tab, opened before the lock and never refreshed.
  const stale = await page.context().newPage();
  await stale.goto(page.url());

  const rail = page.getByRole("navigation", { name: "Spørsmål" });
  const heading = page.locator("#sporsmal-overskrift");
  const header = heading.locator("..");
  const mark = header.getByRole("button", { name: "Marker som gjennomgått" });
  const announced = header.locator('[aria-live="polite"]');
  const pickFrom = async (label: string, item: string) => {
    await page
      .getByRole("button", { name: `Mer for «${label}»`, exact: true })
      .click();
    await page.getByRole("button", { name: item, exact: true }).click();
  };

  // Q2 with all three Groups discarded: the refusal shows under the button.
  await rail.getByRole("link", { name: /^2 / }).click();
  await expect(heading).toContainText("Spørsmål 2 av 2");
  for (const [i, label] of ["Blå", "Grønn", "Rød"].entries()) {
    await pickFrom(label, "Forkast fra brettet");
    await expect(
      page
        .getByRole("region", { name: /^Forkastet/ })
        .getByRole("heading", { level: 4 }),
    ).toHaveCount(i + 1);
  }
  await mark.click();
  const refusal = header.getByRole("alert");
  await expect(refusal).toHaveText(
    "Minst én gruppe må være på brettet før du kan markere spørsmålet.",
  );
  expect((await refusal.boundingBox())!.y).toBeGreaterThan(
    (await mark.boundingBox())!.y,
  );
  await page.getByRole("button", { name: "Angre forkasting av «Rød»" }).click();
  await expect(
    page.getByRole("region", { name: "På brettet (1 gruppe)" }),
  ).toBeVisible();
  // A Group is back on the Board, so the refusal no longer holds.
  await expect(refusal).toHaveCount(0);

  // Mark Q1: Review moves to Q2, the only unreviewed one, and says so.
  await rail.getByRole("link", { name: /^1 / }).click();
  await expect(heading).toContainText("Spørsmål 1 av 2");
  await expect(refusal).toHaveCount(0);
  // An aborted mark: the retry sentence under the button, Q1 still unreviewed.
  const isAction = (url: URL) => url.pathname === `${gamePath}/gjennomgang`;
  await page.route(isAction, (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await mark.click();
  await expect(refusal).toHaveText("Endringen ble ikke lagret. Prøv igjen.");
  expect((await refusal.boundingBox())!.y).toBeGreaterThan(
    (await mark.boundingBox())!.y,
  );
  await expect(rail.getByRole("heading", { level: 2 })).toHaveText(
    "0 av 2 gjennomgått",
  );
  await page.unroute(isAction);
  await mark.click();
  await expect(page).toHaveURL(`${gamePath}/gjennomgang?q=2`);
  await expect(heading).toContainText("Spørsmål 2 av 2");
  await expect(heading).toBeFocused();
  await expect(announced).toHaveText(
    "Spørsmål 1 er gjennomgått. Viser spørsmål 2.",
  );
  await expect(rail.getByRole("heading", { level: 2 })).toHaveText(
    "1 av 2 gjennomgått",
  );

  // Mark Q2, the last: it stays, now marked.
  await mark.click();
  await expect(
    header.getByText("✓ Gjennomgått", { exact: true }),
  ).toBeVisible();
  await expect(mark).toHaveCount(0);
  await expect(heading).toBeFocused();
  await expect(announced).toHaveText(
    "Spørsmål 2 er gjennomgått. Alle spørsmålene er gjennomgått.",
  );
  await expect(rail.getByRole("heading", { level: 2 })).toHaveText(
    "2 av 2 gjennomgått",
  );
  await rail.getByRole("link", { name: /^1 / }).click();
  await expect(heading).toContainText("Spørsmål 1 av 2");
  await expect(header).toContainText("✓ Gjennomgått");
  await expect(
    header.getByRole("link", { name: "Neste spørsmål" }),
  ).toHaveAttribute("href", `${gamePath}/gjennomgang?q=2`);

  // Lås brettet: a dialog with focus on Avbryt; Esc cancels back to the trigger.
  const lock = rail.locator("..").getByRole("button", { name: "Lås brettet" });
  await expect(lock).not.toHaveAttribute("aria-disabled");
  await lock.click();
  const dialog = page.getByRole("dialog", { name: "Låse brettet?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Dette kan ikke angres. Brettet låses slik det er nå, og gjennomgangen kan ikke endres mer.",
  );
  await expect(dialog.getByRole("button", { name: "Avbryt" })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(lock).toBeFocused();

  // A second tab merges two of Q1's Groups, which clears its mark; this tab still offers the lock.
  const LOCKED = "Brettet er allerede låst. Gå til spillet";
  const second = await page.context().newPage();
  await second.goto(`${gamePath}/gjennomgang?q=1`);
  await second.getByRole("checkbox", { name: "Velg «Erik»" }).check();
  await second.getByRole("checkbox", { name: "Velg «Frida»" }).check();
  await second.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(second.locator("[data-selection-bar]")).toHaveCount(0);

  // Confirming here is refused: the dialog gives way to the disabled trigger, which takes focus.
  await lock.click();
  await dialog.getByRole("button", { name: "Lås brettet" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(lock).toHaveAttribute("aria-disabled", "true");
  await expect(lock).toHaveAccessibleDescription(REASON);
  await expect(lock).toBeFocused();

  // Marked again, both tabs offer the lock; the second tab opens its dialog first.
  await mark.click();
  await expect(announced).toHaveText(
    "Spørsmål 1 er gjennomgått. Alle spørsmålene er gjennomgått.",
  );
  await expect(lock).not.toHaveAttribute("aria-disabled");
  await second.reload();
  await second
    .getByRole("navigation", { name: "Spørsmål" })
    .locator("..")
    .getByRole("button", { name: "Lås brettet" })
    .click();
  const secondDialog = second.getByRole("dialog", { name: "Låse brettet?" });
  await expect(secondDialog).toBeVisible();

  // Confirm: the Game page, ready, with the count.
  await lock.click();
  await dialog.getByRole("button", { name: "Lås brettet" }).click();
  await expect(page).toHaveURL(gamePath);
  await expect(
    page.getByRole("heading", { level: 2, name: "Brettet er låst" }),
  ).toBeVisible();
  await expect(
    page.getByText("2 spørsmål er klare.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Klar", { exact: true })).toBeVisible();
  await expect(page.locator("h1")).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);

  // The second tab's open dialog: already locked, with a working way to the Game page.
  await secondDialog.getByRole("button", { name: "Lås brettet" }).click();
  await expect(secondDialog.getByRole("alert")).toHaveText(LOCKED);
  await secondDialog.getByRole("link", { name: "Gå til spillet" }).click();
  await expect(second).toHaveURL(gamePath);
  await second.close();

  // The stale tab: mark, a merge in the SelectionBar and a discard each say it is locked.
  const staleHeader = stale.locator("#sporsmal-overskrift").locator("..");
  await staleHeader
    .getByRole("button", { name: "Marker som gjennomgått" })
    .click();
  await expect(staleHeader.getByRole("alert")).toHaveText(LOCKED);
  await stale.getByRole("checkbox", { name: "Velg «Ola»" }).check();
  await stale.getByRole("checkbox", { name: "Velg «Per»" }).check();
  const bar = stale.locator("[data-selection-bar]");
  await bar.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(bar.getByRole("alert")).toHaveText(LOCKED);
  await stale.keyboard.press("Escape");
  await stale.getByRole("button", { name: "Mer for «Anne»" }).click();
  await stale.getByRole("button", { name: "Forkast fra brettet" }).click();
  const Anne = stale.getByRole("listitem").filter({
    has: stale.getByRole("heading", { level: 4, name: "Anne", exact: true }),
  });
  await expect(Anne.getByRole("alert")).toHaveText(LOCKED);
  await Anne.getByRole("link", { name: "Gå til spillet" }).click();
  await expect(stale).toHaveURL(gamePath);
  await expect(
    stale.getByRole("heading", { level: 2, name: "Brettet er låst" }),
  ).toBeVisible();
  await stale.goto(`${gamePath}/gjennomgang`);
  await expect(stale).toHaveURL(gamePath);
  await stale.close();
});
