import type { Browser, Page } from "@playwright/test";
import {
  expect,
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

async function submitSets(
  browser: Browser,
  baseURL: string | undefined,
  links: string[],
) {
  const context = await browser.newContext({ baseURL });
  await localOnly(context);
  const page = await context.newPage();
  for (const [i, link] of links.entries()) {
    // Links share a path, so a bare hash change would not reload the form.
    await page.goto("/");
    await page.goto(link);
    const [first, ...rest] = SETS[i];
    await page.getByLabel("Svar 1", { exact: true }).fill(first);
    for (const [j, text] of rest.entries()) {
      if (j > 0)
        await page.getByRole("button", { name: "Legg til svar" }).click();
      await page.getByLabel(`Svar ${j + 2} (valgfritt)`).fill(text);
    }
    await page.getByRole("button", { name: "Send inn svar" }).click();
    await expect(
      page.getByRole("heading", { name: "Svarene dine er lagret." }),
    ).toBeVisible();
  }
  await context.close();
}

// A new Host's collecting Game with one Question and three links; returns the Game path.
async function collectingGame(page: Page) {
  await registerHost(page);
  await page.getByLabel("Navn på spillet").fill("Hyttetur");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText("Hyttetur");
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByLabel("Spørsmål 1", { exact: true }).fill(QUESTION);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("region", { name: "Spørsmål" }).getByRole("status"),
  ).toHaveText("Lagret");
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
