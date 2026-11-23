import { DEMO_HOST } from "@/lib/demo";
import { expect, registerHost, seriousViolations, test } from "./fixtures";

const DEV_URL = process.env.E2E_DEV_URL!;
const BAND =
  "Demomodus: alt innhold er oppdiktet, og dommeren bruker lagrede avgjørelser.";
const LOGIN = `Demomodus: logg inn som ${DEMO_HOST.email} med passordet ${DEMO_HOST.password}.`;

test.describe("on the demo server (npm run demo)", () => {
  // next dev compiles each route on its first hit, so every wait here is generous.
  test.use({ baseURL: DEV_URL });
  test.setTimeout(300_000);
  const slow = expect.configure({ timeout: 120_000 });

  test("FR-31: the demo login shows on / and /logg-inn, fills in and logs in; every Host page shows the band; closing the demo Game gives Judge Groups from stored rulings with no fallback; the band hides under the play stage", async ({
    page,
  }) => {
    await page.goto("/");
    await slow(page.getByText(LOGIN)).toBeVisible();
    // Static content, not a status message (NFR-6).
    await expect(
      page.getByRole("status").filter({ hasText: "Demomodus" }),
    ).toHaveCount(0);
    // At 414 px the hyphenated password once broke over two lines; each value is one line box.
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 414, height: 800 });
    // Retried: next dev may reload / while it compiles, destroying the page under evaluate.
    await expect(async () => {
      for (const value of [DEMO_HOST.email, DEMO_HOST.password])
        expect(
          await page
            .locator("code", { hasText: value })
            .evaluate((code) => code.getClientRects().length),
          value,
        ).toBe(1);
    }).toPass({ timeout: 120_000 });
    await page.setViewportSize(viewport);

    // A click, not goto, and retried: next dev may reload / when it compiles /logg-inn,
    // aborting the navigation.
    await expect(async () => {
      if ((await page.locator("h1").textContent()) !== "Logg inn")
        await page.getByRole("link", { name: "Logg inn" }).click();
      await expect(page.locator("h1")).toHaveText("Logg inn", {
        timeout: 30_000,
      });
    }).toPass({ timeout: 180_000 });
    await expect(page.getByText(LOGIN)).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    // After an empty submit, filling in clears the stale errors and moves focus to "Logg inn".
    const submit = page.getByRole("button", { name: "Logg inn" });
    await expect(async () => {
      await submit.click();
      await expect(page.getByText("Skriv passordet ditt.")).toBeVisible({
        timeout: 30_000,
      });
    }).toPass({ timeout: 180_000 });
    await page.getByRole("button", { name: "Fyll inn demobrukeren" }).click();
    await expect(page.getByLabel("E-post")).toHaveValue(DEMO_HOST.email);
    await expect(page.getByLabel("Passord")).toHaveValue(DEMO_HOST.password);
    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
    await expect(page.getByText("Skriv passordet ditt.")).toHaveCount(0);
    await expect(submit).toBeFocused();
    await page.keyboard.press("Enter");
    await slow(page).toHaveURL("/spill");
    await expect(page.getByText(BAND)).toBeVisible();

    // The root not-found page is a Host page too when signed in.
    await expect(async () => {
      await page.goto("/finnes-ikke");
      await expect(page.getByText("Siden finnes ikke.")).toBeVisible({
        timeout: 30_000,
      });
    }).toPass({ timeout: 180_000 });
    await expect(page.getByText(BAND)).toBeVisible();
    await page.getByRole("link", { name: "Mine spill" }).first().click();
    await slow(page).toHaveURL("/spill");

    await page.getByRole("link", { name: "Hyttetur med gjengen" }).click();
    await slow(page.locator("h1")).toHaveText("Hyttetur med gjengen");
    await expect(page.getByText(BAND)).toBeVisible();
    await expect(page.getByText("6 av 8 svar mottatt")).toBeVisible();
    const gamePath = new URL(page.url()).pathname;

    await page
      .getByRole("region", { name: "Innsamling" })
      .getByRole("button", { name: "Steng innsamlingen", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Stenge innsamlingen?" })
      .getByRole("button", { name: "Steng innsamlingen" })
      .click();
    await slow(
      page.getByText("Til gjennomgang", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Gå til gjennomgangen" }).click();
    await slow(page).toHaveURL(`${gamePath}/gjennomgang`);
    await slow(page.getByText(BAND)).toBeVisible();

    // The recorded ruling joins near-synonyms, which one Group per Answer never would.
    const kortstokk = page
      .locator("li", { has: page.locator("h4", { hasText: "Kortstokk" }) })
      .first();
    await slow(kortstokk).toContainText("Kortspill");
    await expect(page.getByText("Manuell")).toHaveCount(0);
    await expect(page.getByText("én gruppe per ulikt svar")).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);

    // At 360 px a short label keeps its width; the count and menu wrap instead of the letters.
    await page.setViewportSize({ width: 360, height: 800 });
    for (const label of await page.locator(`h4[id^="gruppe-"]:visible`).all())
      expect(
        (await label.boundingBox())!.width,
        await label.innerText(),
      ).toBeGreaterThanOrEqual(100);
    await page.setViewportSize(viewport);

    // Through to play: the band is Host chrome, so it hides under the play stage.
    const rail = page.getByRole("navigation", { name: "Spørsmål" });
    for (const n of [1, 2, 3]) {
      await page
        .getByRole("button", { name: "Marker som gjennomgått" })
        .click();
      await slow(rail.getByRole("heading")).toHaveText(`${n} av 3 gjennomgått`);
    }
    await rail
      .locator("..")
      .getByRole("button", { name: "Lås brettet" })
      .click();
    await page
      .getByRole("dialog", { name: "Låse brettet?" })
      .getByRole("button", { name: "Lås brettet" })
      .click();
    await slow(page).toHaveURL(gamePath);
    await page.getByRole("link", { name: "Start spillet" }).click();
    await slow(page.locator("h1")).toHaveText("Hvem spiller?");
    await page.getByRole("button", { name: "Start spillet" }).click();
    await slow(page.locator("[data-stage]")).toBeVisible();
    await expect(page.getByText(BAND)).toBeHidden();
  });
});

test("FR-31: without DEMO_MODE, / and /logg-inn show no demo login and Host pages no band", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Toppsvar");
  await expect(page.getByText(DEMO_HOST.email)).toHaveCount(0);
  await page.goto("/logg-inn");
  await expect(page.locator("h1")).toHaveText("Logg inn");
  await expect(page.getByText(DEMO_HOST.email)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Fyll inn demobrukeren" }),
  ).toHaveCount(0);
  await registerHost(page);
  await expect(page.getByText("Demomodus")).toHaveCount(0);
});
