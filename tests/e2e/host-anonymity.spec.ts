import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser, Page, Request } from "@playwright/test";
import { storageKey } from "@/lib/invite-link";
import { expect, localOnly, registerHost, test } from "./fixtures";

const Q1 = "Hva gjør Jonas når han har forsovet seg?";
const Q2 = "Hvem synger høyest på hytta?";

type Recorded = { url: string; body: string };

async function addQuestion(page: Page, n: number, text: string) {
  await page.getByRole("button", { name: "Legg til spørsmål" }).click();
  await page.getByLabel(`Spørsmål ${n}`, { exact: true }).fill(text);
  await page.keyboard.press("Tab");
  await expect(
    page
      .getByRole("region", { name: "Spørsmål" })
      .getByRole("listitem")
      .nth(n - 1)
      .getByRole("status"),
  ).toHaveText("Lagret");
}

const answerFields = (page: Page) =>
  page.getByRole("textbox", { name: /^Svar \d/ });

// One Participant in a fresh context; returns the edit secret the device kept.
async function submit(
  browser: Browser,
  baseURL: string | undefined,
  link: string,
  answers: [string, string],
) {
  const context = await browser.newContext({ baseURL });
  await localOnly(context);
  const page = await context.newPage();
  await page.goto(link);
  for (const [i, text] of answers.entries())
    await page
      .getByRole("group", { name: new RegExp(`^Spørsmål ${i + 1} av 2`) })
      .getByLabel("Svar 1", { exact: true })
      .fill(text);
  await page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(
    page.getByRole("heading", { name: "Svarene dine er lagret." }),
  ).toBeVisible();
  const gameId = new URL(link).pathname.split("/")[2];
  const token = link.split("#")[1];
  const stored = await page.evaluate(
    (k) => localStorage.getItem(k),
    storageKey(gameId, token),
  );
  await context.close();
  const editSecret: string = JSON.parse(stored!).editSecret;
  expect(editSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  return editSecret;
}

// The answer form's field values, as a fresh device sees them.
async function freshForm(
  browser: Browser,
  baseURL: string | undefined,
  link: string,
) {
  const context = await browser.newContext({ baseURL });
  await localOnly(context);
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.locator("h1")).toHaveText("Anonym hyttetur");
  const values = await answerFields(page).evaluateAll((els) =>
    els.map((el) => (el as HTMLInputElement).value),
  );
  await context.close();
  return values;
}

// That the Host's output is identical before and after a submit is proven server-side in
// host-view.test.ts; this spec covers what only a browser shows.
test("FR-12, FR-11: during Collection no Host page or response body holds a Token, edit secret or Answer before or after submits, nothing is pushed to the Host page, and a used link reopens as an empty form", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.clock.install();
  await registerHost(page);
  await page.getByLabel("Navn på spillet").fill("Anonym hyttetur");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText("Anonym hyttetur");
  const gamePath = new URL(page.url()).pathname;
  await addQuestion(page, 1, Q1);
  await addQuestion(page, 2, Q2);
  await page.getByLabel("Antall lenker").fill("4");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  await expect(page.locator("[data-link]")).toHaveCount(4);
  const links = await page.locator("[data-link]").allTextContents();
  const tokens = links.map((l) => l.split("#")[1]);
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();

  // Every response to a request the Host page starts during a phase, awaited in full.
  let recording: Promise<Recorded | null>[] | null = null;
  page.on("request", (request: Request) => {
    const list = recording;
    list?.push(
      request.response().then((response) =>
        response
          ? response.text().then(
              (body) => (body ? { url: response.url(), body } : null),
              () => null, // redirects have no body
            )
          : null,
      ),
    );
  });

  // Every Host page, then the Game page's own 30 s refresh. The Game page prefetches its
  // visible /spill links in the background (the route tree, then the metadata) on load
  // and again after the refresh; waiting for each keeps a prefetch out of the no-push
  // window below. Pausing 30 s ahead fast-forwards past the 30 s interval, which fires the
  // refresh once and puts the next tick exactly 30 s after the pause, as in progress.spec.ts.
  // The clock stays paused between phases, so that tick fires only when a test advances it.
  // Pausing at "now + 1" raced: a running clock can pass "now + 1" before pauseAt lands.
  async function visitAll() {
    recording = [];
    await page.clock.resume();
    const prefetched = (segment?: string) =>
      page.waitForResponse(
        (r) =>
          r.request().headers()["next-router-prefetch"] === "1" &&
          r.request().headers()["next-router-segment-prefetch"] === segment &&
          new URL(r.url()).pathname === "/spill",
      );
    for (const url of ["/", "/spill"]) await page.goto(url);
    const loaded = [prefetched("/_tree"), prefetched()];
    await page.goto(gamePath);
    await Promise.all(loaded);
    const refreshed = page.waitForResponse(
      (r) =>
        r.request().headers()["rsc"] === "1" &&
        !r.request().headers()["next-router-prefetch"] &&
        new URL(r.url()).pathname === gamePath,
    );
    const metadata = prefetched();
    // Page time, not Node's: earlier phases moved the fake clock ahead of real time.
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 30_000);
    await refreshed;
    await metadata;
    // A response may start another request (a prefetch) while the first ones are awaited.
    let settled;
    do {
      settled = recording.length;
      await Promise.all(recording);
    } while (recording.length !== settled);
    const done = (await Promise.all(recording)).filter(
      (r): r is Recorded => r !== null,
    );
    recording = null;
    return done;
  }

  const answers: string[] = [];
  const secrets: string[] = [];
  const send = async (k: number) => {
    const set: [string, string] = [
      `Hemmelig-vaffel-${k}-a`,
      `Hemmelig-vaffel-${k}-b`,
    ];
    answers.push(...set);
    secrets.push(await submit(browser, baseURL, links[k], set));
  };

  const phaseA = await visitAll();
  expect(phaseA.map((r) => new URL(r.url).pathname)).toEqual(
    expect.arrayContaining(["/", "/spill", gamePath]),
  );

  await send(0);
  let requests = 0;
  const count = () => requests++;
  page.on("request", count);
  // Fake time up to just before the next 30 s refresh, so a timer-driven push would fire,
  // then the one real-time window: nothing may arrive.
  await page.clock.runFor(29_000);
  await page.waitForTimeout(1000);
  page.off("request", count);
  expect(requests).toBe(0);

  const phaseB = await visitAll();

  await send(1);
  await send(2);
  const phaseC = await visitAll();
  await expect(
    page.getByRole("region", { name: "Innsamling" }).locator("p").first(),
  ).toHaveText("3 av 4 svar mottatt");

  for (const { url, body } of [...phaseA, ...phaseB, ...phaseC])
    for (const secret of [...tokens, ...secrets, ...answers])
      expect(body, url).not.toContain(secret);

  const used = await freshForm(browser, baseURL, links[0]);
  expect(used.length).toBeGreaterThan(0);
  expect(used.every((v) => v === "")).toBe(true);
  expect(used).toEqual(await freshForm(browser, baseURL, links[3]));

  // The localOnly recorder saw every value, so the teardown's log scan covers them.
  const recorded = readFileSync(
    path.join(process.env.E2E_OUT_DIR!, "secrets.jsonl"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string);
  expect(recorded).toEqual(
    expect.arrayContaining([...tokens, ...secrets, ...answers]),
  );
});
