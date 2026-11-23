import type { Browser, Locator } from "@playwright/test";
import {
  expect,
  localOnly,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const QUESTION = "Hvem sovner først på hytta?";
const FIXED = "Du ser bare antallet, aldri hvem som har svart.";

test.use({ viewport: { width: 360, height: 740 } });

// True when `a` comes before `b` in document order.
async function precedes(a: Locator, b: Locator) {
  const other = await b.elementHandle();
  return a.evaluate(
    (el, o) =>
      !!(el.compareDocumentPosition(o!) & Node.DOCUMENT_POSITION_FOLLOWING),
    other,
  );
}

async function submitAll(
  browser: Browser,
  baseURL: string | undefined,
  links: string[],
) {
  const context = await browser.newContext({ baseURL });
  await localOnly(context);
  const page = await context.newPage();
  for (const link of links) {
    // Links share a path, so a bare hash change would not reload the form.
    await page.goto("/");
    await page.goto(link);
    await page.getByLabel("Svar 1", { exact: true }).fill("Kari");
    await page.getByRole("button", { name: "Send inn svar" }).click();
    await expect(
      page.getByRole("heading", { name: "Svarene dine er lagret." }),
    ).toBeVisible();
  }
  await context.close();
}

test("FR-8, UX-DR6, AD-17: at 360 px ProgressCount moves only on the 30 s refresh, from færre enn 3 to 3 and 4, never while once-only links are shown, with no bar, motion or live region", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.clock.install();
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
  await page.getByLabel("Antall lenker").fill("4");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(page.locator("[data-link]")).toHaveCount(4);
  const links = await page.locator("[data-link]").allTextContents();

  const region = page.getByRole("region", { name: "Innsamling" });
  const count = region.locator("p").first();
  const sentence = region.getByText(FIXED, { exact: true });

  await submitAll(browser, baseURL, links.slice(0, 3));

  // pauseAt fires the interval once and puts the next tick exactly 30 s later. That tick
  // is skipped while the once-only links are on screen, so the count is still stale.
  await page.clock.pauseAt(Date.now() + 60_000);
  await page.waitForTimeout(1000);
  await expect(count).toHaveText("færre enn 3 av 4 svar mottatt");
  await expect(page.locator("[data-link]")).toHaveText(links);
  await expect(sentence).toBeVisible();
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();

  // The real-time waits give a refresh fired too early the time to land.
  await page.clock.runFor(29_000);
  await page.waitForTimeout(1000);
  await expect(count).toHaveText("færre enn 3 av 4 svar mottatt");
  await page.clock.runFor(1_000);
  await expect(count).toHaveText("3 av 4 svar mottatt");

  await submitAll(browser, baseURL, links.slice(3));
  await expect(count).toHaveText("3 av 4 svar mottatt");
  await page.clock.runFor(29_000);
  await page.waitForTimeout(1000);
  await expect(count).toHaveText("3 av 4 svar mottatt");
  await page.clock.runFor(1_000);
  await expect(count).toHaveText("4 av 4 svar mottatt");
  await expect(sentence).toBeVisible();

  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.locator("meter")).toHaveCount(0);
  await expect(
    region.locator(
      '[aria-live], [role="status"], [role="alert"], [role="log"]',
    ),
  ).toHaveCount(0);
  const figure = region.locator("span.text-display");
  await expect(figure).toHaveText("4");
  expect(
    await figure.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.animationName, s.transitionDuration];
    }),
  ).toEqual(["none", "0s"]);

  const more = page.getByRole("heading", { name: "Flere lenker" });
  await expect(more).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Spørsmål (låst)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spørsmål (låst)" }).getByText(QUESTION),
  ).toBeVisible();
  expect(
    await precedes(page.getByRole("heading", { name: "Innsamling" }), more),
  ).toBe(true);
  await expect(page.getByText("4 av maks 50 lenker brukt.")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  // axe schedules its work on timers, which the paused clock would hold forever.
  await page.clock.resume();
  expect(await seriousViolations(page)).toEqual([]);
});
