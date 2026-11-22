import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  expect,
  FOCUS_RING,
  PASSWORD,
  registerHost,
  tabThrough,
  test,
  uniqueEmail,
} from "./fixtures";

const BAD_LOGIN = "Feil e-post eller passord.";

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(password);
}

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => v.id);
}

test("FR-1, UX-DR28: register, log out and log in again each land on /spill", async ({
  page,
}) => {
  const email = await registerHost(page);
  await expect(page.locator("h1")).toHaveText("Mine spill");

  await page.getByRole("button", { name: "Logg ut" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/spill");
  await expect(page).toHaveURL("/logg-inn");
  await expect(page.getByRole("main").getByRole("status")).toHaveCount(0);

  await fillLogin(page, email, PASSWORD);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page).toHaveURL("/spill");
  await expect(page.locator("h1")).toHaveText("Mine spill");
});

test("FR-1: a second registration with the same email shows the taken message on the email field", async ({
  page,
}) => {
  const email = await registerHost(page);
  await page.context().clearCookies();
  await page.goto("/registrer");
  await fillLogin(page, email.toUpperCase(), PASSWORD);
  await page.getByRole("button", { name: "Opprett konto" }).click();
  const field = page.getByLabel("E-post");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(
    "Feil: Det finnes allerede en konto med denne e-posten.",
  );
  await expect(field).toBeFocused();
});

test("FR-1: a wrong password and an unknown email show the same message; the email stays and the password is cleared", async ({
  page,
}) => {
  const email = await registerHost(page);
  await page.context().clearCookies();
  for (const [user, password] of [
    [email, "feil-passord-123"],
    [uniqueEmail(), PASSWORD],
  ]) {
    await page.goto("/logg-inn");
    await fillLogin(page, user, password);
    await page.getByRole("button", { name: "Logg inn" }).click();
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toHaveText(BAD_LOGIN);
    await expect(alert).toBeFocused();
    await expect(page.getByLabel("E-post")).toHaveValue(user);
    await expect(page.getByLabel("Passord")).toHaveValue("");
  }
});

test("UX-DR28: both forms have visible labels and the right autocomplete values, and no registration code field", async ({
  page,
}) => {
  for (const [path, password] of [
    ["/registrer", "new-password"],
    ["/logg-inn", "current-password"],
  ]) {
    await page.goto(path);
    const email = page.getByLabel("E-post");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    const pw = page.getByLabel("Passord");
    await expect(pw).toHaveAttribute("type", "password");
    await expect(pw).toHaveAttribute("autocomplete", password);
    await expect(page.locator("label")).toHaveCount(2);
    for (const label of await page.locator("label").all())
      await expect(label).toBeVisible();
    await expect(page.getByLabel("Registreringskode")).toHaveCount(0);
  }
  await page.goto("/registrer");
  await expect(page.getByText("Minst 10 tegn.")).toBeVisible();
  await page.getByRole("link", { name: "Logg inn" }).click();
  await expect(page).toHaveURL("/logg-inn");
  await page.getByRole("link", { name: "Opprett konto" }).click();
  await expect(page).toHaveURL("/registrer");
});

test("NFR-6, UX-DR3: a too-short password marks the field invalid, links the error and moves focus there", async ({
  page,
}) => {
  await page.goto("/registrer");
  await fillLogin(page, uniqueEmail(), "kort");
  await page.getByRole("button", { name: "Opprett konto" }).click();
  const field = page.getByLabel("Passord");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toBeFocused();
  const ids = (await field.getAttribute("aria-describedby"))!.split(" ");
  const texts = await Promise.all(
    ids.map((id) => page.locator(`[id="${id}"]`).textContent()),
  );
  expect(texts).toEqual([
    "Minst 10 tegn.",
    "Feil: Passordet må ha minst 10 tegn.",
  ]);
  expect(await seriousViolations(page)).toEqual([]);
});

test("UX-DR2: a pending login shows the in-progress label and aria-busy, and ignores a second click", async ({
  page,
}) => {
  let posts = 0;
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/logg-inn", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    posts++;
    await held;
    await route.continue();
  });
  await page.goto("/logg-inn");
  await fillLogin(page, uniqueEmail(), PASSWORD);
  const button = page.locator("form button[type=submit]");
  await button.click();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByRole("button", { name: "Logger inn …" }),
  ).toBeVisible();
  await button.click();
  await page.keyboard.press("Enter");
  release();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(BAD_LOGIN);
  await expect(button).not.toHaveAttribute("aria-busy");
  await expect(page.getByRole("button", { name: "Logg inn" })).toBeVisible();
  expect(posts).toBe(1);
});

test("UX: a failed request shows the network message and keeps the form", async ({
  page,
}) => {
  await page.route("**/logg-inn", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await page.goto("/logg-inn");
  const email = uniqueEmail();
  await fillLogin(page, email, PASSWORD);
  await page.getByRole("button", { name: "Logg inn" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Fikk ikke kontakt. Sjekk nettet og prøv igjen.",
  );
  await expect(page.getByLabel("E-post")).toHaveValue(email);
  await expect(page).toHaveURL("/logg-inn");
});

test("FR-1: /logg-inn?utlopt=1 shows the expiry notice above the form", async ({
  page,
}) => {
  await page.goto("/logg-inn?utlopt=1");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen.",
  );
});

test("FR-1: a GET with the session cookie re-sets it for 14 days, httpOnly and SameSite=Lax", async ({
  page,
}) => {
  await registerHost(page);
  const res = await page.request.get("/spill");
  expect(res.status()).toBe(200);
  const cookie = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === "set-cookie")
    .map((h) => h.value)
    .find((v) => v.startsWith("toppsvar_session="));
  expect(cookie).toBeDefined();
  expect(cookie).toContain("Max-Age=1209600");
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(cookie).not.toMatch(/Secure/i);
});

for (const path of ["/registrer", "/logg-inn"]) {
  test(`NFR-6: axe finds no serious or critical violations on ${path}, also with an error shown`, async ({
    page,
  }) => {
    await page.goto(path);
    expect(await seriousViolations(page)).toEqual([]);
    await page.locator("form button[type=submit]").click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test(`NFR-6, UX-DR15: every interactive element on ${path} shows the focus ring and is at least 44 px high`, async ({
    page,
  }) => {
    await page.goto(path);
    const controls = page.locator(
      "a[href], button, input:not([type=hidden]), select, textarea",
    );
    const stops = await tabThrough(page);
    expect(stops).toHaveLength(await controls.count());
    for (const stop of stops) expect(stop.outline, stop.text).toBe(FOCUS_RING);
    for (const control of await controls.all())
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
}

test("NFR-6: axe finds no serious or critical violations on /spill", async ({
  page,
}) => {
  await registerHost(page);
  await expect(page.locator("h1")).toHaveText("Mine spill");
  expect(await seriousViolations(page)).toEqual([]);
});
