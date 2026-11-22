import type { Page } from "@playwright/test";
import {
  expect,
  FOCUS_RING,
  registerHost,
  seriousViolations,
  tabThrough,
  test,
} from "./fixtures";

const EMPTY =
  "Ingen spørsmål ennå. Skriv det første, gjerne om noen dere kjenner, for eksempel «Hva gjør Jonas når han har forsovet seg?»";
const LENGTH = "Spørsmålet må ha 1–200 tegn.";
const CAP = "Du har nådd maks 20 spørsmål.";
const SUCCESS = "rgb(29, 107, 69)";
const DANGER = "rgb(168, 35, 26)";

async function createGame(page: Page, title: string): Promise<string> {
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill(title);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText(title);
  return new URL(page.url()).pathname;
}

const editor = (page: Page) => page.getByRole("region", { name: "Spørsmål" });
const field = (page: Page, n: number) =>
  page.getByLabel(`Spørsmål ${n}`, { exact: true });
const row = (page: Page, n: number) =>
  editor(page)
    .getByRole("listitem")
    .nth(n - 1);
const addButton = (page: Page) =>
  page.getByRole("button", { name: "Legg til spørsmål" });

// Adds Question n through the UI and waits until the server has it.
async function addQuestion(page: Page, n: number, text: string) {
  await addButton(page).click();
  await expect(field(page, n)).toBeFocused();
  await field(page, n).fill(text);
  await page.keyboard.press("Tab");
  await expect(row(page, n).getByRole("status")).toHaveText("Lagret");
  await expect(
    editor(page).getByText(n < 20 ? `${n} av 20 spørsmål` : CAP),
  ).toBeVisible();
}

async function texts(page: Page) {
  return editor(page)
    .locator("textarea")
    .evaluateAll((els) => els.map((el) => (el as HTMLTextAreaElement).value));
}

test("FR-4: a new Game shows the empty state; the first Question autosaves on blur with Lagret and survives a reload", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Hyttetur 2026");
  await expect(editor(page).getByText(EMPTY, { exact: true })).toBeVisible();
  await expect(editor(page).getByText("0 av 20 spørsmål")).toBeVisible();

  await addButton(page).click();
  await expect(field(page, 1)).toBeFocused();
  await field(page, 1).fill("Hva gjør Jonas når han har forsovet seg?");
  await page.keyboard.press("Tab");
  const status = row(page, 1).getByRole("status");
  await expect(status).toHaveText("Lagret");
  await expect(status).toHaveCSS("color", SUCCESS);
  await expect(editor(page).getByText("1 av 20 spørsmål")).toBeVisible();

  await page.reload();
  await expect(field(page, 1)).toHaveValue(
    "Hva gjør Jonas når han har forsovet seg?",
  );
  await expect(editor(page).getByText(EMPTY)).toHaveCount(0);
});

test("FR-4, NFR-6: the counter starts at 160, and 201 characters show the field error with aria-invalid", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Lange spørsmål");
  await addButton(page).click();
  const counter = row(page, 1).getByText(/av 200 tegn$/);
  await field(page, 1).fill("a".repeat(159));
  await expect(counter).toHaveCount(0);
  await field(page, 1).fill("a".repeat(160));
  await expect(counter).toHaveText("160 av 200 tegn");

  await field(page, 1).fill("a".repeat(201));
  await page.keyboard.press("Tab");
  await expect(field(page, 1)).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, 1)).toHaveAccessibleDescription(`Feil: ${LENGTH}`);
  await expect(row(page, 1).getByText(LENGTH)).toHaveCSS("color", DANGER);
  await expect(
    row(page, 1).locator("span[aria-hidden]", { hasText: "201 av 200 tegn" }),
  ).toHaveCSS("color", DANGER);
  await expect(editor(page).getByText("0 av 20 spørsmål")).toBeVisible();
});

test("FR-4: Flytt ned, Flytt opp and Slett reorder and remove with focus following the Question; an empty draft is not saved", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Rekkefølge");
  for (const [i, text] of ["A", "B", "C"].entries())
    await addQuestion(page, i + 1, text);

  await expect(
    page.getByRole("button", { name: "Flytt opp spørsmål 1" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Flytt ned spørsmål 3" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Flytt ned spørsmål 1" }).click();
  await expect(
    page.getByRole("button", { name: "Flytt ned spørsmål 2" }),
  ).toBeFocused();
  await expect.poll(() => texts(page)).toEqual(["B", "A", "C"]);

  await page.getByRole("button", { name: "Flytt opp spørsmål 3" }).click();
  await expect(
    page.getByRole("button", { name: "Flytt opp spørsmål 2" }),
  ).toBeFocused();
  await expect.poll(() => texts(page)).toEqual(["B", "C", "A"]);

  // Moving to the top removes "Flytt opp", so focus goes to the other move button.
  await page.getByRole("button", { name: "Flytt opp spørsmål 2" }).click();
  await expect(
    page.getByRole("button", { name: "Flytt ned spørsmål 1" }),
  ).toBeFocused();
  await page.reload();
  expect(await texts(page)).toEqual(["C", "B", "A"]);

  // A destructive action reads as one: secondary-danger, not a ghost word.
  await expect(
    page.getByRole("button", { name: "Slett spørsmål 2" }),
  ).toHaveCSS("border-top-color", DANGER);
  await page.getByRole("button", { name: "Slett spørsmål 2" }).click();
  await expect.poll(() => texts(page)).toEqual(["C", "A"]);
  await expect(field(page, 2)).toBeFocused();
  await page.reload();
  expect(await texts(page)).toEqual(["C", "A"]);

  await addButton(page).click();
  await expect(field(page, 3)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(row(page, 3).getByRole("status")).toHaveText("");
  await page.reload();
  expect(await texts(page)).toEqual(["C", "A"]);
});

test("FR-4: an aborted save shows Fikk ikke lagret. Prøv igjen. and keeps the text, and the Prøv igjen control saves it", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Uten nett");
  await page.route(`**${gamePath}`, (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await addButton(page).click();
  await field(page, 1).fill("Hva skjer?");
  await page.keyboard.press("Tab");
  const status = row(page, 1).getByRole("status");
  await expect(status).toHaveText("Fikk ikke lagret. Prøv igjen.");
  await expect(status).toHaveCSS("color", DANGER);
  await expect(field(page, 1)).toHaveValue("Hva skjer?");

  // "Prøv igjen" resends the same text once the network is back.
  await page.unrouteAll();
  await row(page, 1)
    .getByRole("button", { name: "Prøv igjen spørsmål 1" })
    .click();
  await expect(status).toHaveText("Lagret");
  await expect(field(page, 1)).toBeFocused();
  await page.reload();
  await expect(field(page, 1)).toHaveValue("Hva skjer?");
});

test("FR-4: a blur while a save is in flight is not sent, and the newer text is saved once it settles", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Treg linje");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let posts = 0;
  await page.route(`**${gamePath}`, async (route) => {
    if (route.request().method() === "POST" && ++posts === 1) await held;
    await route.continue();
  });
  await addButton(page).click();
  await field(page, 1).fill("Først");
  await page.keyboard.press("Tab");
  await field(page, 1).fill("Andre");
  await page.keyboard.press("Tab");
  expect(posts).toBe(1);
  release();
  await expect.poll(() => posts).toBe(2);
  await expect(row(page, 1).getByRole("status")).toHaveText("Lagret");
  await page.reload();
  await expect(field(page, 1)).toHaveValue("Andre");
});

test("FR-4, AD-5: saving after the Game was deleted in another tab refreshes to the not-found page", async ({
  page,
  context,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Slettet imens");
  const other = await context.newPage();
  await other.goto(gamePath);
  await other.getByRole("button", { name: "Slett spillet" }).click();
  await other
    .getByRole("dialog")
    .getByRole("button", { name: "Slett for godt" })
    .click();
  await expect(other).toHaveURL("/spill");
  await other.close();

  await addButton(page).click();
  await field(page, 1).fill("For sent");
  await page.keyboard.press("Tab");
  await expect(page.locator("h1")).toHaveText("Vi finner ikke dette spillet.");
});

test("FR-4: at 20 Questions Legg til spørsmål is gone and the cap sentence shows", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Fullt");
  for (let n = 1; n <= 20; n++) await addQuestion(page, n, `Spørsmål nr. ${n}`);
  await expect(addButton(page)).toHaveCount(0);
  await expect(editor(page).getByText(/av 20 spørsmål$/)).toHaveCount(0);
  await page.reload();
  await expect(editor(page).getByText(CAP)).toBeVisible();
  await expect(addButton(page)).toHaveCount(0);
});

test("NFR-6: the editor works by keyboard in reading order with the focus ring and visible labels, and axe finds no serious violations", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Tastatur");
  // Keyboard only: Enter on "Legg til spørsmål", type, Tab.
  for (const [i, text] of ["A", "B", "C"].entries()) {
    await addButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(field(page, i + 1)).toBeFocused();
    await page.keyboard.type(text);
    await page.keyboard.press("Tab");
    await expect(row(page, i + 1).getByRole("status")).toHaveText("Lagret");
  }
  const moveDown = page.getByRole("button", { name: "Flytt ned spørsmål 1" });
  await moveDown.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Flytt ned spørsmål 2" }),
  ).toBeFocused();
  await expect.poll(() => texts(page)).toEqual(["B", "A", "C"]);
  await page.reload();

  for (const n of [1, 2, 3])
    await expect(
      editor(page).locator("label", { hasText: new RegExp(`^Spørsmål ${n}$`) }),
    ).toBeVisible();

  const stops = await tabThrough(page);
  const interactive = await page
    .locator("a[href], button, input:not([type=hidden]), select, textarea")
    .filter({ visible: true })
    .evaluateAll((els) =>
      els.map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el as HTMLElement).innerText.trim(),
      })),
    );
  expect(stops.map(({ tag, text }) => ({ tag, text }))).toEqual(interactive);
  for (const stop of stops) expect(stop.outline, stop.text).toBe(FOCUS_RING);
  for (const control of await editor(page).getByRole("button").all())
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await seriousViolations(page)).toEqual([]);

  await field(page, 1).fill("a".repeat(201));
  await page.keyboard.press("Tab");
  await expect(field(page, 1)).toHaveAttribute("aria-invalid", "true");
  expect(await seriousViolations(page)).toEqual([]);
});
