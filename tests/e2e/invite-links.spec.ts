import type { Page } from "@playwright/test";
import {
  expect,
  FOCUS_RING,
  registerHost,
  seriousViolations,
  tabThrough,
  test,
} from "./fixtures";

const BODY =
  "Spørsmålene låses når du lager de første lenkene, og kan ikke endres etterpå.";
const NOTICE =
  "Av hensyn til anonymiteten lagrer vi ikke lenkene, så de kan ikke vises igjen. Send én lenke til hver deltaker.";
const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

async function createGame(page: Page, title: string): Promise<string> {
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill(title);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText(title);
  return new URL(page.url()).pathname;
}

async function addQuestion(page: Page, n: number, text: string) {
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  const field = page.getByLabel(`Spørsmål ${n}`, { exact: true });
  await field.fill(text);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("region", { name: "Spørsmål" }).getByRole("status"),
  ).toHaveText("Lagret");
}

const countField = (page: Page) => page.getByLabel("Antall lenker");
const createButton = (page: Page) =>
  page.getByRole("button", { name: "Lag lenker" });
const openDialog = (page: Page) =>
  page.getByRole("dialog", { name: "Åpne innsamlingen?" });
const linkTexts = (page: Page) =>
  page
    .locator("[data-link]")
    .evaluateAll((els) => els.map((el) => el.textContent ?? ""));
const onceList = (page: Page) =>
  page.getByRole("heading", { name: "Kopier lenkene nå" });

// Opens Collection through the dialog; returns the links shown.
async function openCollection(page: Page, count: number) {
  await countField(page).fill(String(count));
  await createButton(page).click();
  await openDialog(page)
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(onceList(page)).toBeFocused();
  return linkTexts(page);
}

test("FR-5: with zero Questions Lag lenker is aria-disabled, described by the reason, and opens nothing", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Uten spørsmål");
  const button = createButton(page);
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAccessibleDescription(
    "Skriv minst ett spørsmål først.",
  );
  await button.click({ force: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Utkast", { exact: true })).toBeVisible();
});

test("FR-5, FR-4, FR-12: the first batch asks first, shows the links once with copy, warns on leaving, locks the Questions; more links need no dialog", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await registerHost(page);
  const gamePath = await createGame(page, "Hyttetur 2026");
  await addQuestion(page, 1, "Hva gjør Jonas når han har forsovet seg?");
  await expect(page.getByText("0 av maks 50 lenker brukt.")).toBeVisible();

  // Esc cancels and the Game stays a draft.
  await countField(page).fill("3");
  await createButton(page).click();
  const dialog = openDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(BODY);
  await expect(dialog.getByRole("button", { name: "Avbryt" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Utkast", { exact: true })).toBeVisible();

  const links = await openCollection(page, 3);
  const id = gamePath.slice("/spill/".length);
  expect(links).toHaveLength(3);
  for (const link of links)
    expect(link).toMatch(
      new RegExp(`^http://localhost:3100/svar/${id}#[A-Za-z0-9_-]{43}$`),
    );
  await expect(page.getByText(NOTICE)).toBeVisible();
  // The links survive the refresh to collecting.
  await expect(page.getByText("Samler inn", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Flere lenker" }),
  ).toBeVisible();
  const locked = page.getByRole("region", { name: "Spørsmål (låst)" });
  await expect(locked.getByRole("listitem")).toHaveText([
    "Hva gjør Jonas når han har forsovet seg?",
  ]);
  await expect(locked.locator("textarea")).toHaveCount(0);
  await expect(locked.getByRole("button")).toHaveCount(0);

  // Copy one, then all.
  const second = page.getByRole("listitem").filter({ hasText: links[1] });
  await second.getByRole("button").click();
  await expect(second.getByRole("button")).toHaveText("Kopiert lenke 2");
  await expect(page.getByText("Lenke kopiert.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    links[1],
  );
  await expect(second.getByRole("button")).toHaveText("Kopier lenke 2", {
    timeout: 3000,
  });
  await page.getByRole("button", { name: "Kopier alle" }).click();
  await expect(page.getByText("Lenkene kopiert.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    links.join("\n"),
  );

  // Leaving before "Jeg har kopiert lenkene" raises the browser's warning.
  const warned = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const leave = await warned;
  expect(leave.type()).toBe("beforeunload");
  await leave.dismiss();
  await expect(onceList(page)).toBeVisible();

  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  await expect(countField(page)).toBeFocused();
  await page.reload();
  await expect(page.getByText("3 av maks 50 lenker brukt.")).toBeVisible();
  await expect(page.locator("[data-link]")).toHaveCount(0);
  expect(await page.content()).not.toContain("/svar/");
  for (const link of links)
    expect(await page.content()).not.toContain(link.split("#")[1]);

  // In collecting there is no dialog.
  await countField(page).fill("2");
  await createButton(page).click();
  await expect(onceList(page)).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await linkTexts(page)).toHaveLength(2);
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  await expect(page.getByText("5 av maks 50 lenker brukt.")).toBeVisible();
});

test("FR-5, NFR-6: count 0 is a field error with no request; 50 in one batch reach the cap; a failing clipboard selects the link", async ({
  page,
}) => {
  // As on plain http://<LAN-IP>, where navigator.clipboard is undefined.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", { value: undefined }),
  );
  await registerHost(page);
  await createGame(page, "Femti lenker");
  await addQuestion(page, 1, "Hvem?");

  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  await countField(page).fill("0");
  await createButton(page).click();
  await expect(countField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(countField(page)).toHaveAccessibleDescription(
    "Feil: Skriv et tall fra 1 til 50.",
  );
  await expect(countField(page)).toBeFocused();
  await expect(openDialog(page)).toHaveCount(0);
  expect(posts).toBe(0);

  const links = await openCollection(page, 50);
  expect(links).toHaveLength(50);
  await page
    .getByRole("listitem")
    .filter({ hasText: links[0] })
    .getByRole("button")
    .click();
  await expect(page.getByText("Marker og kopier lenken selv.")).toBeVisible();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe(
    links[0],
  );
  // "Kopier alle" selects the whole list; the select-none buttons stay out.
  await page.getByRole("button", { name: "Kopier alle" }).click();
  await expect(page.getByText("Marker og kopier lenken selv.")).toBeVisible();
  const selected = await page.evaluate(
    () => window.getSelection()?.toString() ?? "",
  );
  for (const link of links) expect(selected).toContain(link);
  expect(selected).not.toContain("Kopier");

  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  // The revoke panel shows the cap sentence too (Story 2.7).
  await expect(
    page
      .getByRole("region", { name: "Flere lenker" })
      .getByText("Spillet har nådd maks 50 lenker."),
  ).toBeFocused();
  await expect(
    page
      .getByRole("region", { name: "Erstatt en tapt lenke" })
      .getByText("Spillet har nådd maks 50 lenker."),
  ).toBeVisible();
  await expect(page.getByLabel("Lim inn lenken")).toHaveCount(0);
  await expect(page.getByText("50 av maks 50 lenker brukt.")).toBeVisible();
  await expect(countField(page)).toHaveCount(0);
  await expect(createButton(page)).toHaveCount(0);
});

test("FR-5: a count above the remainder is a field error with no request; a stale tab asking past the cap gets the alert and refreshes", async ({
  page,
  context,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Gammel fane");
  await addQuestion(page, 1, "Hvem?");
  await openCollection(page, 3);
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();

  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") posts++;
  });
  await countField(page).fill("48");
  await createButton(page).click();
  await expect(countField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(countField(page)).toHaveAccessibleDescription(
    "Feil: Skriv et tall fra 1 til 47.",
  );
  await expect(countField(page)).toBeFocused();
  expect(posts).toBe(0);

  const other = await context.newPage();
  await other.goto(gamePath);
  await countField(other).fill("45");
  await createButton(other).click();
  await expect(onceList(other)).toBeFocused();
  await other.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  await other.close();

  await countField(page).fill("5");
  await createButton(page).click();
  const alert = page
    .getByRole("region", { name: "Flere lenker" })
    .getByRole("alert");
  await expect(alert).toHaveText("Spillet har nådd maks 50 lenker.");
  await expect(alert).toBeFocused();
  await expect(page.getByText("48 av maks 50 lenker brukt.")).toBeVisible();
});

test("FR-4, AD-4: a Question edited in tab A after tab B opened Collection refreshes tab A to the locked list with the old text", async ({
  page,
  context,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "To faner");
  await addQuestion(page, 1, "Gammel tekst");

  const other = await context.newPage();
  await other.goto(gamePath);
  await openCollection(other, 1);
  await other.close();

  await page.getByLabel("Spørsmål 1", { exact: true }).fill("Ny tekst");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Samler inn", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Spørsmål (låst)" }).getByRole("listitem"),
  ).toHaveText(["Gammel tekst"]);
});

test("FR-5, UX-DR23: an aborted create request shows the network message in the dialog and no links", async ({
  page,
}) => {
  await registerHost(page);
  const gamePath = await createGame(page, "Uten nett");
  await addQuestion(page, 1, "Hvem?");
  await page.route(`**${gamePath}`, (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await createButton(page).click();
  const dialog = openDialog(page);
  await dialog.getByRole("button", { name: "Åpne innsamlingen" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveText(NETWORK);
  await expect(alert).toBeFocused();
  await expect(page.locator("[data-link]")).toHaveCount(0);
  await expect(page.getByText("Utkast", { exact: true })).toBeVisible();
});

test("NFR-6: axe on the draft panel, the open dialog, the link list and the collecting page; Tab reaches every copy control with the focus ring", async ({
  page,
}) => {
  await registerHost(page);
  await createGame(page, "Tilgjengelig");
  await addQuestion(page, 1, "Hvem?");
  expect(await seriousViolations(page)).toEqual([]);

  await countField(page).fill("3");
  await createButton(page).click();
  await expect(openDialog(page)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await openDialog(page)
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(onceList(page)).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);

  // From the focused heading, Tab walks the list's controls in order.
  const stops = await tabThrough(page);
  const names = stops.map((s) => s.text.replace(/\s+/g, " "));
  expect(names.slice(0, 5)).toEqual([
    "Kopier alle",
    "Kopier lenke 1",
    "Kopier lenke 2",
    "Kopier lenke 3",
    "Jeg har kopiert lenkene",
  ]);
  for (const stop of stops.slice(0, 5))
    expect(stop.outline, stop.text).toBe(FOCUS_RING);
  for (const control of await page
    .getByRole("button", { name: /^Kopier|^Jeg har/ })
    .all())
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  expect(await seriousViolations(page)).toEqual([]);
});
