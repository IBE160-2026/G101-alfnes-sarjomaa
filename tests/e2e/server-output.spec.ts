import { readFileSync } from "node:fs";
import path from "node:path";
import { storageKey } from "@/lib/invite-link";
import { expect, localOnly, PASSWORD, test, uniqueEmail } from "./fixtures";

const DEV_URL = process.env.E2E_DEV_URL!;
const ANSWER = "Bestemor Ingrid danser tango";

// next dev compiles each route on its first hit, so every wait here is generous.
test.use({ baseURL: DEV_URL });
test.setTimeout(300_000);
const slow = expect.configure({ timeout: 120_000 });

const devLog = () =>
  readFileSync(path.join(process.env.E2E_OUT_DIR!, "dev.log"), "utf8");

test("FR-11: in next dev, neither a submit's Token, edit secret or Answer nor the Token logged in the guest's browser console reaches the server's output", async ({
  page,
  browser,
}) => {
  await page.goto("/registrer");
  await page.getByLabel("E-post").fill(uniqueEmail());
  await page.getByLabel("Passord").fill(PASSWORD);
  await page.getByRole("button", { name: "Opprett konto" }).click();
  await slow(page).toHaveURL("/spill");
  await page.getByLabel("Navn på spillet").fill("Utviklerlogg");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await slow(page.locator("h1")).toHaveText("Utviklerlogg");
  const gameId = new URL(page.url()).pathname.slice("/spill/".length);
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByLabel("Spørsmål 1", { exact: true }).fill("Hvem danser?");
  await page.keyboard.press("Tab");
  await slow(
    page.getByRole("region", { name: "Spørsmål" }).getByRole("status"),
  ).toHaveText("Lagret");
  await page.getByLabel("Antall lenker").fill("1");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await slow(page.locator("[data-link]")).toHaveCount(1);
  const link = (await page.locator("[data-link]").textContent())!;
  const token = link.split("#")[1];

  const context = await browser.newContext({ baseURL: DEV_URL });
  await localOnly(context);
  const guest = await context.newPage();
  await guest.goto(link);
  await slow(guest.locator("h1")).toHaveText("Utviklerlogg");
  await guest.evaluate((t) => {
    /* eslint-disable no-console -- the guest's own console output is under test */
    console.log(t);
    console.warn(t);
    console.error(t);
    /* eslint-enable no-console */
  }, token);
  await guest.getByLabel("Svar 1", { exact: true }).fill(ANSWER);
  await guest.getByRole("button", { name: "Send inn svar" }).click();
  await slow(
    guest.getByRole("heading", { name: "Svarene dine er lagret." }),
  ).toBeVisible();
  const stored = await guest.evaluate(
    (k) => localStorage.getItem(k),
    storageKey(gameId, token),
  );
  const editSecret: string = JSON.parse(stored!).editSecret;
  expect(editSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await context.close();

  // The submit's own request line proves the capture is live before the negative checks.
  await expect
    .poll(devLog, { timeout: 30_000 })
    .toContain(`POST /svar/${gameId}`);
  const log = devLog();
  for (const secret of [token, editSecret, ANSWER])
    expect(log).not.toContain(secret);
});
