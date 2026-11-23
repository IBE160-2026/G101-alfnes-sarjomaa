import type { Locator, Page } from "@playwright/test";
import {
  expect,
  FOCUS_RING,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const DANGER = "rgb(168, 35, 26)";
const WHITE = "rgb(255, 255, 255)";
const CONSEQUENCE = "Spørsmål, lenker, svar, brett og poeng slettes for godt.";
const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

async function createGame(page: Page, title: string): Promise<string> {
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill(title);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText(title);
  return new URL(page.url()).pathname;
}

async function outlineOf(locator: Locator) {
  return locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`;
  });
}

test("FR-3, UX-DR8: Slett spillet is outlined, opens a dialog focused on Avbryt, and Esc or Avbryt returns focus to it", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Hyttetur 2026");
  const trigger = page.getByRole("button", { name: "Slett spillet" });
  await expect(trigger).toHaveCSS("border-top-width", "1px");
  await expect(trigger).toHaveCSS("border-top-color", DANGER);
  await expect(trigger).toHaveCSS("background-color", WHITE);
  await expect(trigger).toHaveCSS("color", DANGER);

  const dialog = page.getByRole("dialog", { name: "Slette «Hyttetur 2026»?" });
  const cancel = dialog.getByRole("button", { name: "Avbryt" });
  for (const close of [
    () => page.keyboard.press("Escape"),
    () => cancel.click(),
  ]) {
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(CONSEQUENCE);
    await expect(cancel).toBeFocused();
    await close();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  await expect(page.locator("h1")).toHaveText("Hyttetur 2026");
});

test("FR-3: Slett for godt deletes the Game and lands on /spill with the success notice", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Julebord & venner");
  await page.getByRole("button", { name: "Slett spillet" }).click();
  const confirm = page
    .getByRole("dialog")
    .getByRole("button", { name: "Slett for godt" });
  await expect(confirm).toHaveCSS("background-color", DANGER);
  await expect(confirm).toHaveCSS("color", WHITE);
  await confirm.click();

  await expect(page).toHaveURL("/spill");
  await expect(page.getByRole("status")).toHaveText(
    "«Julebord & venner» er slettet.",
  );
  await expect(
    page.getByRole("link", { name: "Julebord & venner" }),
  ).toHaveCount(0);
  // Shown once: a reload no longer has it.
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Mine spill");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.goto(gamePath);
  await expect(page.locator("h1")).toHaveText("Vi finner ikke dette spillet.");
});

test("FR-3: a crafted /spill?slettet= link shows no notice", async ({
  page,
}) => {
  await registerHost(page);
  await page.goto("/spill?slettet=Kontoen%20din%20er%20sperret");
  await expect(page.locator("h1")).toHaveText("Mine spill");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("sperret");
});

test("FR-3, UX-DR23: an aborted delete request keeps the dialog open with the focused network message, and the Game stays", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Uten nett");
  await page.route(`**${gamePath}`, (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.getByRole("button", { name: "Slett spillet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Slett for godt" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveText(NETWORK);
  await expect(alert).toBeFocused();
  await expect(dialog).toBeVisible();

  await page.unrouteAll();
  await page.goto("/spill");
  await expect(page.getByRole("link", { name: "Uten nett" })).toBeVisible();
});

test("FR-3, AD-5: confirming in a stale dialog after the Game was deleted elsewhere keeps the dialog open with the focused not-found alert", async ({
  page,
  context,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Slettet to ganger");
  await page.getByRole("button", { name: "Slett spillet" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const other = await context.newPage();
  await other.goto(gamePath);
  await other.getByRole("button", { name: "Slett spillet" }).click();
  await other
    .getByRole("dialog")
    .getByRole("button", { name: "Slett for godt" })
    .click();
  await expect(other).toHaveURL("/spill");
  await other.close();

  await dialog.getByRole("button", { name: "Slett for godt" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveText("Vi finner ikke dette spillet.");
  await expect(alert).toBeFocused();
  await expect(dialog).toBeVisible();
});

test("NFR-6: axe with the dialog open and on /spill with the notice; the trigger and dialog buttons show the focus ring and are 44 px high", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Tilgjengelig");
  const trigger = page.getByRole("button", { name: "Slett spillet" });
  // Keyboard only, so :focus-visible applies to every stop.
  for (
    let i = 0;
    i < 20 && !(await trigger.evaluate((el) => el === document.activeElement));
    i++
  )
    await page.keyboard.press("Tab");
  await expect(trigger).toBeFocused();
  expect(await outlineOf(trigger)).toBe(FOCUS_RING);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  const cancel = dialog.getByRole("button", { name: "Avbryt" });
  const confirm = dialog.getByRole("button", { name: "Slett for godt" });
  await expect(cancel).toBeFocused();
  expect(await outlineOf(cancel)).toBe(FOCUS_RING);
  await page.keyboard.press("Tab");
  await expect(confirm).toBeFocused();
  expect(await outlineOf(confirm)).toBe(FOCUS_RING);
  for (const control of [trigger, cancel, confirm])
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await seriousViolations(page)).toEqual([]);

  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toHaveText(
    "«Tilgjengelig» er slettet.",
  );
  expect(await seriousViolations(page)).toEqual([]);
});
