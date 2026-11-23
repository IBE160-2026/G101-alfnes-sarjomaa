import { appendFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TOKEN = /\/svar\/[0-9a-f-]{36}#([A-Za-z0-9_-]{43})/g;
const recorded = new Set<string>();

// One JSON line per Token or Answer a browser sent or received, for the teardown's
// scan of the server logs (FR-11).
function record(value: string) {
  if (recorded.has(value)) return;
  recorded.add(value);
  appendFileSync(
    path.join(process.env.E2E_OUT_DIR!, "secrets.jsonl"),
    `${JSON.stringify(value)}\n`,
  );
}

// Every string leaf of a /svar action's arguments: Token, edit secret and Answers. React
// escapes a leading $ as $$; a single $ is a reference, and UUIDs are Game and Question IDs.
// shortcut: Answers under 3 characters and UUID-shaped Answers are not scanned (too many false hits), add them if a test ever relies on such an Answer.
function recordLeaves(value: unknown) {
  if (typeof value === "string") {
    if (value.startsWith("$") && !value.startsWith("$$")) return;
    const text = value.startsWith("$$") ? value.slice(1) : value;
    if (text.length >= 3 && !UUID.test(text)) record(text);
  } else if (value !== null && typeof value === "object")
    for (const child of Object.values(value)) recordLeaves(child);
}

// NFR-3: the browser never reaches a host other than localhost. Every context passes
// through here, so it also records what the server logs must never hold.
export async function localOnly(context: BrowserContext) {
  await context.route("**/*", (route) =>
    LOCAL_HOSTS.has(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  // An event, not the route above: a page's own route wins over the context's, and its
  // route.fetch() sends the real request without passing through here.
  context.on("request", (request) => {
    if (
      request.headers()["next-action"] &&
      new URL(request.url()).pathname.startsWith("/svar/")
    )
      recordLeaves(request.postDataJSON());
  });
  context.on("response", async (response) => {
    if (!response.request().headers()["next-action"]) return;
    const body = await response.text().catch(() => "");
    for (const [, token] of body.matchAll(LINK_TOKEN)) record(token);
  });
}

export const test = base.extend({
  context: async ({ context }, provide) => {
    await localOnly(context);
    await provide(context);
  },
});

export { expect };

export const FOCUS_RING = "3px solid rgb(30, 26, 34)";
export const FOCUS_RING_INVERSE = "3px solid rgb(255, 255, 255)";
export const PASSWORD = "riktig-passord-123";

// Each spec registers its own Host on a reserved domain.
export function uniqueEmail(): string {
  return `vert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export async function registerHost(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto("/registrer");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Passord").fill(PASSWORD);
  await page.getByRole("button", { name: "Opprett konto" }).click();
  // scrypt at N=2^17 can take several seconds under CPU load (a full e2e run with two servers).
  await expect(page).toHaveURL("/spill", { timeout: 15_000 });
  return email;
}

// Tabs from the top until focus leaves the page; returns what each stop looked like.
export async function tabThrough(page: Page) {
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

// Next 16 streams a dynamic page's metadata after its body, and a router.refresh() streams it
// again, so <title> is missing for a few hundred ms. Axe must not run in that gap; a page that
// never gets a title still fails here.
export async function seriousViolations(page: Page) {
  await expect
    .poll(() => page.title(), { message: "the page never got a <title>" })
    .not.toBe("");
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => v.id);
}

// The Review flow, shared by the Review and play specs.
export const QUESTION = "Hvem kommer for sent til hytta?";
// Nine distinct normalised Answers, Kari written in two cases: nine Groups after the no-key fallback.
export const SETS = [
  ["Kari", "Ola", "Per"],
  ["Anne", "Bjørn", "Cato", "kari"],
  ["Dina", "Erik", "Frida", "Kari"],
];

// Set i answers Question q with sets[q][i].
export async function submitSets(
  browser: Browser,
  baseURL: string | undefined,
  links: string[],
  sets: string[][][] = [SETS],
) {
  const context = await browser.newContext({ baseURL });
  await localOnly(context);
  const page = await context.newPage();
  for (const [i, link] of links.entries()) {
    // Links share a path, so a bare hash change would not reload the form.
    await page.goto("/");
    await page.goto(link);
    for (const [q, questionSets] of sets.entries()) {
      const fieldset = page.locator("fieldset").nth(q);
      const [first, ...rest] = questionSets[i];
      await fieldset.getByLabel("Svar 1", { exact: true }).fill(first);
      for (const [j, text] of rest.entries()) {
        if (j > 0)
          await fieldset.getByRole("button", { name: "Legg til svar" }).click();
        await fieldset.getByLabel(`Svar ${j + 2} (valgfritt)`).fill(text);
      }
    }
    await page.getByRole("button", { name: "Send inn svar" }).click();
    await expect(
      page.getByRole("heading", { name: "Svarene dine er lagret." }),
    ).toBeVisible();
  }
  await context.close();
}

// A new Host's collecting Game with the given Questions and three links; returns the Game path.
export async function collectingGame(page: Page, questions = [QUESTION]) {
  await registerHost(page);
  await page.getByLabel("Navn på spillet").fill("Hyttetur");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText("Hyttetur");
  for (const [i, text] of questions.entries()) {
    await page.getByRole("button", { name: "Legg til spørsmål" }).click();
    await page.getByLabel(`Spørsmål ${i + 1}`, { exact: true }).fill(text);
    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("region", { name: "Spørsmål" })
        .getByRole("listitem")
        .nth(i)
        .getByRole("status"),
    ).toHaveText("Lagret");
  }
  await page.getByLabel("Antall lenker").fill("3");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(page.locator("[data-link]")).toHaveCount(3);
  const links = await page.locator("[data-link]").allTextContents();
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  return { gamePath: new URL(page.url()).pathname, links };
}

// Closes the collecting Game on its page and follows "Gå til gjennomgangen".
export async function closeAndOpenReview(page: Page, gamePath: string) {
  await page.reload();
  await page
    .getByRole("region", { name: "Innsamling" })
    .getByRole("button", { name: "Steng innsamlingen", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Stenge innsamlingen?" })
    .getByRole("button", { name: "Steng innsamlingen" })
    .click();
  await expect(page.getByText("Til gjennomgang", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("link", { name: "Gå til gjennomgangen" }).click();
  await expect(page).toHaveURL(`${gamePath}/gjennomgang`);
}
