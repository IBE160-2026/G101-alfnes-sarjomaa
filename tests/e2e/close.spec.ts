import type { Browser, Page } from "@playwright/test";
import { storageKey } from "@/lib/invite-link";
import {
  expect,
  localOnly,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const QUESTION = "Hvem sovner først på hytta?";
const REASON =
  "Du trenger minst 3 innsendte svar før du kan stenge. Det beskytter anonymiteten. Lag flere lenker, vent litt, eller slett spillet.";
const CONSEQUENCE =
  "Dette kan ikke angres. Lenkene slutter å virke, og svarene grupperes.";
const NO_KEY =
  "Ingen KI-nøkkel er satt opp, så du grupperer for hånd i gjennomgangen.";
const GROUPING =
  "Dommeren, en KI-modell, grupperer svarene … Det tar vanligvis under to minutter.";
const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";
const CLOSED_SUBMIT =
  "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret.";

test.use({ viewport: { width: 360, height: 740 } });

async function participant(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 360, height: 740 },
  });
  await localOnly(context);
  return { context, page: await context.newPage() };
}

async function submitAll(
  browser: Browser,
  baseURL: string | undefined,
  links: string[],
) {
  const { context, page } = await participant(browser, baseURL);
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

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

// A new Host's collecting Game with one Question and four links; returns the links.
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
  await page.getByLabel("Antall lenker").fill("4");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(page.locator("[data-link]")).toHaveCount(4);
  const links = await page.locator("[data-link]").allTextContents();
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  return links;
}

// The Game page with three sets, the close dialog open.
async function openCloseDialog(
  page: Page,
  browser: Browser,
  baseURL: string | undefined,
) {
  const links = await collectingGame(page);
  await submitAll(browser, baseURL, links.slice(0, 3));
  await page.reload();
  await page
    .getByRole("region", { name: "Innsamling" })
    .getByRole("button", { name: "Steng innsamlingen", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Stenge innsamlingen?" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("FR-10, FR-15 (AC6), UX-DR8: at 360 px Steng innsamlingen is aria-disabled with the reason below three sets, opens the confirm dialog from three, closes to Grupperer with 0 av 1 spørsmål ferdig, polls to the in review summary, and a form opened before close gets the late-submit sentence and loses its key", async ({
  page,
  browser,
  baseURL,
}) => {
  const links = await collectingGame(page);

  // Two sets: disabled, with the reason as its description, and no dialog on click.
  await submitAll(browser, baseURL, links.slice(0, 2));
  await page.reload();
  const region = page.getByRole("region", { name: "Innsamling" });
  const trigger = region.getByRole("button", {
    name: "Steng innsamlingen",
    exact: true,
  });
  await expect(trigger).toHaveAttribute("aria-disabled", "true");
  await expect(trigger).toHaveAccessibleDescription(REASON);
  await expect(region.getByText(REASON, { exact: true })).toBeVisible();
  // Playwright waits for an aria-disabled button to enable, so the click is forced.
  await trigger.click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);

  // The third set, and a form opened before close with an unsent draft on the device.
  await submitAll(browser, baseURL, links.slice(2, 3));
  const late = await participant(browser, baseURL);
  await late.page.goto(links[3]);
  await late.page.getByLabel("Svar 1", { exact: true }).fill("Ola");
  const token = links[3].split("#")[1];
  const gameId = new URL(links[3]).pathname.split("/")[2];
  const key = storageKey(gameId, token);
  const stored = () => late.page.evaluate((k) => localStorage.getItem(k), key);
  await expect.poll(stored).not.toBeNull();

  await page.reload();
  await expect(region.getByText("3 av 4 svar mottatt")).toBeVisible();
  await expect(trigger).not.toHaveAttribute("aria-disabled");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Stenge innsamlingen?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(CONSEQUENCE, { exact: true })).toBeVisible();
  await expect(dialog.getByText(NO_KEY, { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Avbryt" })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole("button", { name: "Steng innsamlingen" }).click();
  await expect(page.getByText("Grupperer", { exact: true })).toBeVisible();
  await expect(page.getByText(GROUPING, { exact: true })).toBeVisible();
  await expect(page.getByText("0 av 1 spørsmål ferdig")).toBeVisible();
  // The new state's heading, so a screen reader hears what changed.
  await expect(
    page.getByRole("heading", { name: "Gruppering", level: 2 }),
  ).toBeFocused();
  await expect(page.getByRole("region", { name: "Innsamling" })).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  // The action's re-render sets the head again; axe would flag the moment in between.
  await expect(page).toHaveTitle("Hyttetur – Toppsvar");
  expect(await seriousViolations(page)).toEqual([]);

  // Replay with no rulings and no key: the one Question falls back at once, and the next
  // 3 s poll shows the in review summary, with focus on its heading (FR-15, FR-17).
  await expect(page.getByText("Til gjennomgang", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  const summary = page.getByRole("region", { name: "Grupperingen er ferdig" });
  await expect(summary.getByRole("term")).toHaveText([
    "Spørsmål",
    "Grupper foreslått",
    "Spørsmål å gruppere for hånd",
  ]);
  await expect(summary.getByRole("definition")).toHaveText(["1", "0", "1"]);
  await expect(
    page.getByRole("heading", { name: "Grupperingen er ferdig", level: 2 }),
  ).toBeFocused();
  await expect(page.getByText("Ingen KI-nøkkel")).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);

  await late.page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(
    late.page.getByText(CLOSED_SUBMIT, { exact: true }),
  ).toBeVisible();
  expect(await stored()).toBeNull();
  await late.context.close();
});

test("FR-10, UX-DR23: while close runs neither Esc nor Avbryt dismisses the dialog, an aborted request then shows the focused network message in it, and the Game keeps collecting", async ({
  page,
  browser,
  baseURL,
}) => {
  const dialog = await openCloseDialog(page, browser, baseURL);
  const gamePath = new URL(page.url()).pathname;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${gamePath}`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await held;
    return route.abort();
  });
  const confirm = dialog.getByRole("button", { name: "Steng innsamlingen" });
  await confirm.click();
  await expect(confirm).toHaveAttribute("aria-busy", "true");
  // Twice: Chrome closes a dialog on a second Esc with no click in between.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "Avbryt" });
  await expect(cancel).toHaveAttribute("aria-disabled", "true");
  // Playwright waits for an aria-disabled button to enable, so the click is forced.
  await cancel.click({ force: true });
  await expect(dialog).toBeVisible();
  release();
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveText(NETWORK);
  await expect(alert).toBeFocused();
  await expect(dialog).toBeVisible();

  await page.unrouteAll();
  await page.reload();
  await expect(page.getByText("Samler inn", { exact: true })).toBeVisible();
});

test("FR-10, AD-4: confirming in a tab whose Game another tab already closed refreshes it to the Game's current state", async ({
  page,
  browser,
  baseURL,
}) => {
  const dialog = await openCloseDialog(page, browser, baseURL);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await other
    .getByRole("region", { name: "Innsamling" })
    .getByRole("button", { name: "Steng innsamlingen", exact: true })
    .click();
  await other
    .getByRole("dialog", { name: "Stenge innsamlingen?" })
    .getByRole("button", { name: "Steng innsamlingen" })
    .click();
  await expect(other.getByText("Grupperer", { exact: true })).toBeVisible();
  await other.close();

  await dialog.getByRole("button", { name: "Steng innsamlingen" }).click();
  // The other tab's close already ran Grouping, which falls back at once with no key.
  await expect(page.getByText("Til gjennomgang", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
