import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const UNKNOWN = "/finnes-ikke";
const FOCUS_RING = "3px solid rgb(30, 26, 34)";

// Tabs from the top until focus leaves the page; returns what each stop looked like.
async function tabThrough(page: Page) {
  const stops: { tag: string; text: string; outline: string }[] = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        text: el.innerText.trim(),
        outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  return stops;
}

// Visible elements with their own text whose computed size is below 14 px.
function textBelow14px(page: Page) {
  return page.evaluate(() =>
    [...document.body.querySelectorAll<HTMLElement>("*")]
      .filter(
        (el) =>
          el.checkVisibility() &&
          [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          ) &&
          parseFloat(getComputedStyle(el).fontSize) < 14,
      )
      .map((el) => el.outerHTML),
  );
}

test("UX-DR1: the landing page uses the self-hosted font, the system UI stack and nothing below 14 px", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  for (const url of requests) expect(new URL(url).hostname).toBe("localhost");
  expect(requests.some((url) => /\/_next\/static\/.+\.woff2$/.test(url))).toBe(
    true,
  );

  const fonts = await page.evaluate(() => ({
    check: document.fonts.check('700 32px "Bricolage Grotesque Variable"'),
    loaded: [...document.fonts].some(
      (f) => f.family.includes("Bricolage") && f.status === "loaded",
    ),
    h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
    body: getComputedStyle(document.body).fontFamily,
  }));
  expect(fonts.check).toBe(true);
  expect(fonts.loaded).toBe(true);
  expect(fonts.h1).toMatch(/^"Bricolage Grotesque Variable"/);
  expect(fonts.body).toMatch(/^system-ui/);

  expect(await textBelow14px(page)).toEqual([]);
});

test("UX-DR1: nothing in the Host chrome renders below 14 px", async ({
  page,
}) => {
  await page.goto(UNKNOWN);
  expect(await textBelow14px(page)).toEqual([]);
});

test("UX-DR28, NFR-7: the landing page has one <h1>, one sentence and links to log in and register", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Toppsvar");
  await expect(page.locator("main p")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Logg inn" })).toHaveAttribute(
    "href",
    "/logg-inn",
  );
  await expect(
    page.getByRole("link", { name: "Opprett konto" }),
  ).toHaveAttribute("href", "/registrer");
  await expect(page.locator("header, nav")).toHaveCount(0);
  await expect(page.getByText("Hopp til innhold")).toHaveCount(0);
});

test("UX-DR15, UX-DR23: an unknown URL returns 404 inside the Host chrome", async ({
  page,
}) => {
  const res = await page.goto(UNKNOWN);
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Siden finnes ikke.");

  await expect(page.locator("header")).toHaveCount(1);
  const nav = page.getByRole("navigation", { name: "Hovedmeny" });
  await expect(nav).toBeVisible();
  await expect(page.locator("main#innhold")).toHaveCount(1);
  await expect(
    page.locator("header").getByRole("link", { name: "Toppsvar" }),
  ).toHaveAttribute("href", "/spill");
  await expect(nav.getByRole("link", { name: "Mine spill" })).toHaveAttribute(
    "href",
    "/spill",
  );
  await expect(nav.getByRole("button", { name: "Logg ut" })).toBeVisible();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Hopp til innhold" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#innhold")).toBeFocused();
});

for (const [path, controls] of [
  ["/", "main a"],
  [UNKNOWN, "header a, header button"],
]) {
  test(`UX-DR15: every control on ${path} is at least 44 px high`, async ({
    page,
  }) => {
    await page.goto(path);
    const all = await page.locator(controls).all();
    expect(all.length).toBeGreaterThan(0);
    for (const control of all)
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
}

test('UX-DR15: "Logg ut" submits its form and lands on /', async ({ page }) => {
  await page.goto(UNKNOWN);
  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("h1")).toHaveText("Toppsvar");
});

// A link to a 404 is a full page load in Next (non-200 RSC response), so this
// navigates from the 404 page to / with Next's public router: a real client route change.
test("UX-DR15: after a client route change, focus moves to the page <h1>", async ({
  page,
}) => {
  await page.goto(UNKNOWN);
  await expect(page.locator("main#innhold")).toBeVisible();
  await expect(page.locator("h1")).not.toBeFocused();
  await page.evaluate(() => {
    (window as unknown as { marker: boolean }).marker = true;
  });

  await page.evaluate(() =>
    (
      window as unknown as { next: { router: { push(href: string): void } } }
    ).next.router.push("/"),
  );
  await expect(page.locator("h1")).toHaveText("Toppsvar");
  await expect(page.locator("h1")).toBeFocused();
  expect(
    await page.evaluate(
      () => (window as unknown as { marker?: boolean }).marker,
    ),
  ).toBe(true);
});

for (const path of ["/", UNKNOWN]) {
  test(`NFR-6: axe finds no serious or critical violations on ${path}`, async ({
    page,
  }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id),
    ).toEqual([]);
  });

  test(`NFR-6: every interactive element on ${path} shows the focus ring`, async ({
    page,
  }) => {
    await page.goto(path);
    const stops = await tabThrough(page);
    const interactive = await page
      .locator("a[href], button, input:not([type=hidden]), select, textarea")
      .count();
    expect(stops).toHaveLength(interactive);
    for (const stop of stops) expect(stop.outline, stop.text).toBe(FOCUS_RING);
  });
}
