import type { Page } from "@playwright/test";
import { LINK_NOT_ACTIVE } from "@/lib/invite-link";
import {
  expect,
  localOnly,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const TITLE = "Hyttetur";
const QUESTION = "Hvem sovner først på hytta?";
const BODY =
  "Alt som er sendt inn via den, slettes. Du får én ny lenke, som vises bare én gang.";
const ACTION = "Trekk tilbake og lag ny";
const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

test.use({ viewport: { width: 360, height: 740 } });

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );

test("FR-9, UX-DR8: at 360 px the Host pastes a used and an unused link, gets the same fixed dialog each time and one new link, and a bad paste stays inline", async ({
  page,
  browser,
  baseURL,
}) => {
  await registerHost(page);
  await page.getByLabel("Navn på spillet").fill(TITLE);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText(TITLE);
  const gameUrl = page.url();
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByLabel("Spørsmål 1", { exact: true }).fill(QUESTION);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("region", { name: "Spørsmål" }).getByRole("status"),
  ).toHaveText("Lagret");
  await page.getByLabel("Antall lenker").fill("2");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(page.locator("[data-link]")).toHaveCount(2);
  const old = await page.locator("[data-link]").allTextContents();
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();

  const participant = await browser.newContext({ baseURL });
  await localOnly(participant);
  const phone = await participant.newPage();
  await phone.goto(old[0]);
  await phone.getByLabel("Svar 1", { exact: true }).fill("Kari");
  await phone.getByRole("button", { name: "Send inn svar" }).click();
  await expect(
    phone.getByRole("heading", { name: "Svarene dine er lagret." }),
  ).toBeVisible();

  const region = page.getByRole("region", { name: "Erstatt en tapt lenke" });
  const field = page.getByLabel("Lim inn lenken");
  const trigger = region.getByRole("button", { name: ACTION }).first();
  const dialog = page.getByRole("dialog", { name: "Trekke tilbake lenken?" });

  const fresh: string[] = [];
  const dialogTexts: string[] = [];
  for (const [i, link] of old.entries()) {
    await field.fill(link);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("p")).toHaveText(BODY);
    await expect(dialog.getByRole("button", { name: "Avbryt" })).toBeFocused();
    dialogTexts.push(await dialog.innerText());
    if (i === 0) {
      expect(await noHorizontalScroll(page)).toBe(true);
      expect(await seriousViolations(page)).toEqual([]);
    }
    await dialog.getByRole("button", { name: ACTION }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("[data-link]")).toHaveCount(1);
    // One link needs no "Kopier alle" beside its own "Kopier".
    await expect(page.getByRole("button", { name: "Kopier alle" })).toHaveCount(
      0,
    );
    const [link1] = await page.locator("[data-link]").allTextContents();
    expect(old).not.toContain(link1);
    expect(fresh).not.toContain(link1);
    fresh.push(link1);
    await expect(
      page.getByText(`${3 + i} av maks 50 lenker brukt.`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("");
  }
  expect(dialogTexts[1]).toBe(dialogTexts[0]);

  // A blank field is the one client-side check: the dialog stays closed.
  await field.fill("   ");
  await trigger.click();
  await expect(dialog).toBeHidden();
  await expect(field).toBeFocused();
  await expect(field).toHaveAccessibleDescription(`Feil: ${LINK_NOT_ACTIVE}`);

  await field.fill("abc");
  await trigger.click();
  await dialog.getByRole("button", { name: ACTION }).click();
  await expect(dialog.getByRole("alert")).toHaveText(LINK_NOT_ACTIVE);
  await expect(dialog.getByRole("alert")).toBeFocused();
  await dialog.getByRole("button", { name: "Avbryt" }).click();
  await expect(dialog).toBeHidden();
  await expect(field).toHaveAccessibleDescription(`Feil: ${LINK_NOT_ACTIVE}`);
  await expect(field).toHaveAttribute("aria-invalid", "true");
  expect(page.url()).toBe(gameUrl);
  await expect(page.locator("h1")).toHaveText(TITLE);

  // An aborted request shows the network message in the dialog and no new link.
  const gamePath = new URL(gameUrl).pathname;
  await page.route(`**${gamePath}`, (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await field.fill(fresh[1]);
  await trigger.click();
  await dialog.getByRole("button", { name: ACTION }).click();
  await expect(dialog.getByRole("alert")).toHaveText(NETWORK);
  await expect(dialog.getByRole("alert")).toBeFocused();
  await expect(page.locator("[data-link]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Avbryt" }).click();
  await page.unroute(`**${gamePath}`);

  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);

  await phone.goto("/");
  await phone.goto(old[0]);
  await expect(phone.locator("h1")).toHaveText("Vi finner ikke denne lenken.");
  await phone.goto("/");
  await phone.goto(fresh[0]);
  await expect(phone.locator("h1")).toHaveText(TITLE);
  await participant.close();
});
