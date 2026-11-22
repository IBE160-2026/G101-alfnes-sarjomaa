import type { Locator, Page, Request } from "@playwright/test";
import { storageKey } from "@/lib/invite-link";
import {
  expect,
  localOnly,
  registerHost,
  seriousViolations,
  test,
} from "./fixtures";

const Q1 = "Hva gjør Jonas når han har forsovet seg?";
const Q2 = "Hvem synger høyest på hytta?";
const NOTICE =
  "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet.";
const INSTRUCTION =
  "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1.";
const HELPER =
  "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene.";
const NETWORK_SUBMIT =
  "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten.";
const CLOSED_SUBMIT =
  "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret.";
const UNKNOWN_HEADING = "Vi finner ikke denne lenken.";
const INTERNAL = "Noe gikk galt hos oss. Prøv igjen om litt.";
const INVALID = "Sjekk feltene som er merket, og prøv igjen.";
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const RETURNING =
  "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer».";
const DRAFT_NOTICE = "Du har endringer som ikke er sendt inn.";

async function createGame(page: Page, title: string): Promise<string> {
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill(title);
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.locator("h1")).toHaveText(title);
  return new URL(page.url()).pathname.slice("/spill/".length);
}

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

// A collecting Game with two Questions, opened through its one link from another page.
async function openForm(page: Page, title: string) {
  await registerHost(page);
  const gameId = await createGame(page, title);
  await addQuestion(page, 1, Q1);
  await addQuestion(page, 2, Q2);
  await page.getByLabel("Antall lenker").fill("1");
  await page.getByRole("button", { name: "Lag lenker" }).click();
  await page
    .getByRole("dialog", { name: "Åpne innsamlingen?" })
    .getByRole("button", { name: "Åpne innsamlingen" })
    .click();
  const link = (await page.locator("[data-link]").first().textContent())!;
  await page.getByRole("button", { name: "Jeg har kopiert lenkene" }).click();
  await page.goto("/");
  await page.goto(link);
  await expect(page.locator("h1")).toHaveText(title);
  return { gameId, token: link.split("#")[1] };
}

const group = (page: Page, n: number) =>
  page.getByRole("group", {
    name: `Spørsmål ${n} av 2: ${n === 1 ? Q1 : Q2}`,
  });
const field = (page: Page, n: number, i: number) =>
  group(page, n).getByLabel(i === 1 ? "Svar 1" : `Svar ${i} (valgfritt)`, {
    exact: true,
  });

const storedValue = async (page: Page, gameId: string, token: string) => {
  const raw = await page.evaluate(
    (k) => localStorage.getItem(k),
    storageKey(gameId, token),
  );
  return raw === null ? null : JSON.parse(raw);
};

// True when `a` comes before `b` in document order.
async function precedes(a: Locator, b: Locator) {
  const other = await b.elementHandle();
  return a.evaluate(
    (el, o) =>
      !!(el.compareDocumentPosition(o!) & Node.DOCUMENT_POSITION_FOLLOWING),
    other,
  );
}

async function noHorizontalScroll(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
}

test("FR-14, FR-6, FR-11, NFR-4, NFR-6: at 360 px the form shows the notice, the fields and their rules, no identity, and no horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openForm(page, "Hyttetur 2026");
  const main = page.locator("main");

  await expect(main.getByRole("status")).toHaveText(NOTICE);
  await expect(main.getByText(INSTRUCTION, { exact: true })).toBeVisible();
  await expect(main.getByText(HELPER, { exact: true })).toBeVisible();
  for (const n of [1, 2]) {
    await expect(group(page, n)).toBeVisible();
    await expect(field(page, n, 1)).toBeVisible();
    await expect(field(page, n, 2)).toBeVisible();
    await expect(group(page, n).getByRole("textbox")).toHaveCount(2);
  }
  const first = field(page, 1, 1);
  await expect(first).toHaveAttribute("maxlength", "80");
  await expect(first).toHaveAttribute("autocomplete", "off");
  await expect(first).toHaveAttribute("autocapitalize", "sentences");
  await expect(first).toHaveAttribute("enterkeyhint", "next");

  const add = group(page, 1).getByRole("button", { name: "Legg til svar" });
  for (const i of [3, 4, 5]) {
    await add.click();
    await expect(field(page, 1, i)).toBeFocused();
  }
  await expect(add).toHaveCount(0);
  await expect(group(page, 1).getByRole("textbox")).toHaveCount(5);
  await expect(
    group(page, 1).getByRole("button", { name: /^Fjern svar/ }),
  ).toHaveCount(3);
  await group(page, 1).getByRole("button", { name: "Fjern svar 4" }).click();
  await expect(field(page, 1, 3)).toBeFocused();
  await expect(group(page, 1).getByRole("textbox")).toHaveCount(4);
  await expect(add).toBeVisible();

  await expect(main.getByText("0 av 2 spørsmål har svar")).toBeVisible();
  await first.fill("x".repeat(59));
  await expect(group(page, 1).getByText("59/80")).toHaveCount(0);
  await expect(main.getByText("1 av 2 spørsmål har svar")).toBeVisible();
  await first.fill("x".repeat(60));
  await expect(group(page, 1).getByText("60/80")).toBeVisible();

  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await seriousViolations(page)).toEqual([]);
  for (const text of ["Logg ut", "Mine spill"])
    await expect(page.getByText(text)).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain("@");

  await page.setViewportSize({ width: 320, height: 640 });
  expect(await noHorizontalScroll(page)).toBe(true);

  await first.fill("x".repeat(80));
  await expect(main.locator('form [aria-live="polite"]')).toHaveText(
    "80 av 80 tegn",
  );

  const notice = main.getByRole("status");
  const instruction = main.getByText(INSTRUCTION, { exact: true });
  const firstFieldset = group(page, 1);
  const progress = main.getByText("1 av 2 spørsmål har svar");
  const submit = page.getByRole("button", { name: "Send inn svar" });
  const helper = main.getByText(HELPER, { exact: true });
  expect(await precedes(notice, firstFieldset)).toBe(true);
  expect(await precedes(notice, instruction)).toBe(true);
  expect(await precedes(instruction, firstFieldset)).toBe(true);
  expect(await precedes(progress, submit)).toBe(true);
  expect(await precedes(submit, helper)).toBe(true);
});

test("FR-6, NFR-6: a submit with Question 2 empty sends nothing, focuses the summary, and its link focuses Question 2 without changing the fragment", async ({
  page,
}) => {
  const { token } = await openForm(page, "Mangler svar");
  const actions: Request[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) actions.push(r);
  });

  await field(page, 1, 1).fill("Sover videre");
  await page.getByRole("button", { name: "Send inn svar" }).click();
  const summary = page.locator("main").getByRole("alert");
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("1 spørsmål mangler svar");
  const link = summary.getByRole("link", { name: `Spørsmål 2: ${Q2}` });
  await expect(link).toBeVisible();
  await expect(summary.getByRole("link")).toHaveCount(1);
  await expect(group(page, 2)).toContainText("Skriv minst ett svar.");
  await expect(field(page, 2, 1)).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, 2, 1)).toHaveAccessibleDescription(
    "Feil: Skriv minst ett svar.",
  );
  await expect(field(page, 1, 1)).not.toHaveAttribute("aria-invalid");
  expect(actions).toHaveLength(0);
  expect(await seriousViolations(page)).toEqual([]);

  await link.click();
  await expect(field(page, 2, 1)).toBeFocused();
  expect(await page.evaluate(() => location.hash)).toBe(`#${token}`);
  expect(actions).toHaveLength(0);
});

test("FR-6: an 81-character Answer typed past a removed maxlength shows Svaret kan ha maks 80 tegn. under that field", async ({
  page,
}) => {
  await openForm(page, "For langt");
  await field(page, 1, 1).evaluate((el) => el.removeAttribute("maxlength"));
  await field(page, 1, 1).fill("x".repeat(81));
  await field(page, 2, 1).fill("Kari");
  await page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(field(page, 1, 1)).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, 1, 1)).toHaveAccessibleDescription(
    "Feil: Svaret kan ha maks 80 tegn.",
  );
  const summary = page.locator("main").getByRole("alert");
  await expect(summary).toBeFocused();
  await expect(summary).toContainText(INVALID);
  await expect(
    summary.getByRole("link", { name: `Spørsmål 1: ${Q1}` }),
  ).toBeVisible();
});

test("FR-6, FR-7, AD-8: a complete submit shows the confirmation, keeps { token, editSecret } under the link's key, and Se eller endre svarene shows the values again", async ({
  page,
}) => {
  const { gameId, token } = await openForm(page, "Fullført");
  await field(page, 1, 1).fill("Sover videre");
  await group(page, 1).getByRole("button", { name: "Legg til svar" }).click();
  await field(page, 1, 3).fill("Snorker");
  await field(page, 2, 1).fill("Kari");
  await page.getByRole("button", { name: "Send inn svar" }).click();

  const heading = page.getByRole("heading", {
    level: 2,
    name: "Svarene dine er lagret.",
  });
  await expect(heading).toBeFocused();
  await expect(
    page.getByText(
      "Du kan endre dem på denne enheten og i denne nettleseren helt til verten stenger innsamlingen.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("group")).toHaveCount(0);
  expect(await seriousViolations(page)).toEqual([]);

  const stored = await storedValue(page, gameId, token);
  expect(stored).toEqual({ token, editSecret: expect.stringMatching(SECRET) });

  await page.getByRole("button", { name: "Se eller endre svarene" }).click();
  await expect(page.locator("h1")).toBeFocused();
  await expect(field(page, 1, 1)).toHaveValue("Sover videre");
  await expect(field(page, 1, 2)).toHaveValue("");
  await expect(field(page, 1, 3)).toHaveValue("Snorker");
  await expect(field(page, 2, 1)).toHaveValue("Kari");
  await expect(
    page.getByRole("button", { name: "Lagre endringer" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send inn svar" })).toHaveCount(
    0,
  );

  // The device reuses its secret on the next submit.
  await page.getByRole("button", { name: "Lagre endringer" }).click();
  await expect(heading).toBeFocused();
  expect(await storedValue(page, gameId, token)).toEqual(stored);
});

test("FR-6, NFR-6: an aborted submit POST shows the network sentence and keeps every typed value", async ({
  page,
}) => {
  await page.clock.install();
  const { gameId, token } = await openForm(page, "Uten nett");
  // Paused, so the 500 ms debounce cannot fire: the draft can only come from the submit's flush.
  await page.clock.pauseAt(Date.now() + 60_000);
  const qid = (n: number) =>
    field(page, n, 1)
      .getAttribute("name")
      .then((name) => name!.split(".")[0]);
  await page.route("**/svar/**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await field(page, 1, 1).fill("Sover videre");
  await field(page, 2, 1).fill("Kari");
  await page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    NETWORK_SUBMIT,
  );
  await expect(field(page, 1, 1)).toHaveValue("Sover videre");
  await expect(field(page, 2, 1)).toHaveValue("Kari");
  await expect(
    page.getByRole("button", { name: "Send inn svar" }),
  ).toBeVisible();
  // The secret is kept before the call, so a response lost after commit still matches,
  // and the draft is saved at once, as the network sentence promises.
  expect(await storedValue(page, gameId, token)).toEqual({
    token,
    editSecret: expect.stringMatching(SECRET),
    draft: {
      [await qid(1)]: ["Sover videre", ""],
      [await qid(2)]: ["Kari", ""],
    },
  });
});

test("FR-10, FR-9, FR-6, NFR-6: a real submit response rewritten to closed, unknown, INTERNAL and a field error shows each outcome", async ({
  page,
}) => {
  const { gameId, token } = await openForm(page, "Omskrevet innsending");
  const qid = (await field(page, 1, 1).getAttribute("name"))!.split(".")[0];
  const OK = '{"ok":true,"data":null}';
  const failure = (code: string, message: string, extra = "") =>
    `{"ok":false,"code":"${code}","message":"${message}"${extra}}`;
  const cases: [string, string][] = [
    [
      "COLLECTION_CLOSED",
      failure("COLLECTION_CLOSED", "Innsamlingen er stengt."),
    ],
    ["LINK_UNKNOWN", failure("LINK_UNKNOWN", UNKNOWN_HEADING)],
    ["INTERNAL", failure("INTERNAL", INTERNAL)],
    [
      "INVALID_INPUT",
      failure(
        "INVALID_INPUT",
        INVALID,
        `,"fieldErrors":{"${qid}.0":"Svaret kan ha maks 80 tegn."}`,
      ),
    ],
  ];
  for (const [code, rewritten] of cases) {
    await page.unrouteAll();
    await page.goto("/");
    // Each case starts as a fresh device: the real submits of earlier cases did commit.
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/svar/${gameId}#${token}`);
    await field(page, 1, 1).fill("Sover videre");
    await field(page, 2, 1).fill("Kari");
    await page.route("**/svar/**", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      const body = await response.text();
      expect(body, code).toContain(OK);
      const headers = response.headers();
      delete headers["content-length"];
      await route.fulfill({
        response,
        headers,
        body: body.replace(OK, rewritten),
      });
    });
    await page.getByRole("button", { name: "Send inn svar" }).click();

    if (code === "COLLECTION_CLOSED") {
      await expect(page.getByText(CLOSED_SUBMIT)).toBeFocused();
      await expect(page.getByRole("group")).toHaveCount(0);
      expect(await storedValue(page, gameId, token)).toBeNull();
    } else if (code === "LINK_UNKNOWN") {
      await expect(page.locator("h1")).toHaveText(UNKNOWN_HEADING);
      await expect(page.locator("h1")).toBeFocused();
    } else if (code === "INTERNAL") {
      await expect(page.locator("main").getByRole("alert")).toHaveText(
        INTERNAL,
      );
      await expect(field(page, 1, 1)).toHaveValue("Sover videre");
      await expect(field(page, 2, 1)).toHaveValue("Kari");
    } else {
      await expect(field(page, 1, 1)).toHaveAccessibleDescription(
        "Feil: Svaret kan ha maks 80 tegn.",
      );
      await expect(field(page, 1, 1)).toHaveValue("Sover videre");
    }
  }
});

const saved = (page: Page) =>
  page.getByRole("heading", { level: 2, name: "Svarene dine er lagret." });

// Resolves once the link's stored draft holds `text`.
const draftHolds = (page: Page, gameId: string, token: string, text: string) =>
  expect
    .poll(async () =>
      JSON.stringify((await storedValue(page, gameId, token))?.draft ?? null),
    )
    .toContain(text);

test("FR-7: the same browser reopens the link pre-filled with the returning notice and saves an added third Answer; a fresh browser context gets an empty form", async ({
  page,
  browser,
  baseURL,
}) => {
  const { gameId, token } = await openForm(page, "Tilbake igjen");
  const main = page.locator("main");
  await field(page, 1, 1).fill("Sover videre");
  await field(page, 1, 2).fill("Snorker");
  await field(page, 2, 1).fill("Kari");
  await page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(saved(page)).toBeFocused();

  await page.reload();
  await expect(field(page, 1, 1)).toHaveValue("Sover videre");
  await expect(field(page, 1, 2)).toHaveValue("Snorker");
  await expect(field(page, 2, 1)).toHaveValue("Kari");
  await expect(main.getByText(RETURNING, { exact: true })).toBeVisible();
  await expect(main.getByText(DRAFT_NOTICE)).toHaveCount(0);
  await expect(main.getByText(HELPER, { exact: true })).toBeVisible();
  expect(
    await precedes(
      page.getByRole("button", { name: "Lagre endringer" }),
      main.getByText(HELPER, { exact: true }),
    ),
  ).toBe(true);
  await group(page, 1).getByRole("button", { name: "Legg til svar" }).click();
  await field(page, 1, 3).fill("Vekker alle");
  await page.getByRole("button", { name: "Lagre endringer" }).click();
  await expect(saved(page)).toBeFocused();

  await page.reload();
  await expect(field(page, 1, 3)).toHaveValue("Vekker alle");
  await expect(main.getByText(RETURNING, { exact: true })).toBeVisible();

  const fresh = await browser.newContext({ baseURL });
  await localOnly(fresh);
  const other = await fresh.newPage();
  await other.goto(`/svar/${gameId}#${token}`);
  await expect(field(other, 1, 1)).toHaveValue("");
  await expect(field(other, 1, 2)).toHaveValue("");
  await expect(field(other, 2, 1)).toHaveValue("");
  await expect(group(other, 1).getByRole("textbox")).toHaveCount(2);
  await expect(other.getByText(RETURNING)).toHaveCount(0);
  await expect(
    other.getByRole("button", { name: "Send inn svar" }),
  ).toBeVisible();
  await expect(
    other.locator("main").getByText(HELPER, { exact: true }),
  ).toBeVisible();
  expect(
    await precedes(
      other.getByRole("button", { name: "Send inn svar" }),
      other.locator("main").getByText(HELPER, { exact: true }),
    ),
  ).toBe(true);
  await fresh.close();
});

test("UX-DR20, FR-6: a typed draft is kept on the device, restored on reload with the draft notice, never sent before submit, and dropped after a successful submit", async ({
  page,
}) => {
  const { gameId, token } = await openForm(page, "Utkast på bussen");
  const main = page.locator("main");
  const sent: string[] = [];
  page.on("request", (r) => sent.push(`${r.url()}\n${r.postData() ?? ""}`));
  const draft = `Tunnel ${Date.now()}`;

  await page.clock.install();
  await page.reload();
  await expect(field(page, 1, 1)).toBeVisible();
  await page.clock.pauseAt(Date.now() + 60_000);
  await field(page, 1, 1).fill(draft);
  await expect(main.getByText("1 av 2 spørsmål har svar")).toBeVisible();
  await page.clock.runFor(400);
  expect(await storedValue(page, gameId, token)).toBeNull();
  await page.clock.runFor(200);
  await draftHolds(page, gameId, token, draft);
  await page.reload();
  await expect(field(page, 1, 1)).toHaveValue(draft);
  await expect(main.getByText(DRAFT_NOTICE, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Forkast endringene" }),
  ).toBeVisible();
  await expect(main.getByText(HELPER, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send inn svar" }),
  ).toBeVisible();
  expect(sent.length).toBeGreaterThan(0);
  expect(sent.filter((r) => r.includes(draft))).toEqual([]);

  await field(page, 2, 1).fill("Kari");
  await page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(saved(page)).toBeFocused();
  expect(await storedValue(page, gameId, token)).toEqual({
    token,
    editSecret: expect.stringMatching(SECRET),
  });
});

test("UX-DR20, FR-7, NFR-6: a local draft wins over the saved set, and Forkast endringene restores the saved values, the returning notice and focus", async ({
  page,
}) => {
  const { gameId, token } = await openForm(page, "Utkast vinner");
  const main = page.locator("main");
  await field(page, 1, 1).fill("Sover videre");
  await field(page, 2, 1).fill("Kari");
  await page.getByRole("button", { name: "Send inn svar" }).click();
  await expect(saved(page)).toBeFocused();
  const { editSecret } = await storedValue(page, gameId, token);

  await page.getByRole("button", { name: "Se eller endre svarene" }).click();
  await expect(main.getByText(RETURNING, { exact: true })).toBeVisible();
  await field(page, 1, 1).fill("Står opp likevel");
  await draftHolds(page, gameId, token, "Står opp likevel");

  await page.reload();
  await expect(field(page, 1, 1)).toHaveValue("Står opp likevel");
  await expect(field(page, 2, 1)).toHaveValue("Kari");
  await expect(main.getByText(DRAFT_NOTICE, { exact: true })).toBeVisible();
  await expect(main.getByText(RETURNING)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Lagre endringer" }),
  ).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Forkast endringene" }).click();
  await expect(field(page, 1, 1)).toHaveValue("Sover videre");
  await expect(field(page, 1, 1)).toBeFocused();
  await expect(main.getByText(RETURNING, { exact: true })).toBeVisible();
  await expect(main.getByText(DRAFT_NOTICE)).toHaveCount(0);
  expect(await storedValue(page, gameId, token)).toEqual({ token, editSecret });

  // Typed, then erased back to the saved set plus a blank field: nothing new, no draft.
  await field(page, 1, 1).fill("Står opp likevel");
  await draftHolds(page, gameId, token, "Står opp likevel");
  await field(page, 1, 1).fill("Sover videre");
  await group(page, 1).getByRole("button", { name: "Legg til svar" }).click();
  await expect
    .poll(() => storedValue(page, gameId, token))
    .toEqual({ token, editSecret });
  await page.reload();
  await expect(main.getByText(RETURNING, { exact: true })).toBeVisible();
  await expect(main.getByText(DRAFT_NOTICE)).toHaveCount(0);
});
