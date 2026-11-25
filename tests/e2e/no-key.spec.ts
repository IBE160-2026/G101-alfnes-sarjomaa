import { readFileSync } from "node:fs";
import path from "node:path";
import {
  closeAndOpenReview,
  collectingGame,
  expect,
  fillSet,
  localOnly,
  QUESTION,
  seriousViolations,
  SETS,
  test,
} from "./fixtures";

const NO_KEY =
  "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar.";
const Q2 = "Hvilken farge har hytta?";
const ANSWERS = [SETS, [["Rød"], ["Blå"], ["Rød"]]];
const TEAMS = ["Hyttegjengen", "Byfolket"];

test("FR-30, FR-11, NFR-3, NFR-6: with no model key and every browser request outside localhost blocked a full round runs end to end: register, two Questions, three Answer sets from three browsers, close, the fallback Grouping with the NO_KEY Notice, one merge, mark, lock, two Teams, scored and unscored Reveals, one undo, the next Question and Sluttstilling with each Score equal to that Team's scored Counts; axe is clean on the answer form, Review, the Host view, the TV page and Sluttstilling; the server-output scan covers the round's Tokens and Answers", async ({
  page,
  browser,
  baseURL,
}) => {
  // A full round is far longer than one 6.x test on a 4-core CI runner.
  test.slow();
  await page.setViewportSize({ width: 1280, height: 900 });
  const { gamePath, links } = await collectingGame(page, [QUESTION, Q2]);

  // Three Participants, each in their own browser; axe on the first, filled form.
  for (const [i, link] of links.entries()) {
    const context = await browser.newContext({ baseURL });
    await localOnly(context);
    const guest = await context.newPage();
    await guest.goto(link);
    await fillSet(guest, i, ANSWERS);
    if (i === 0) expect(await seriousViolations(guest)).toEqual([]);
    await guest.getByRole("button", { name: "Send inn svar" }).click();
    await expect(
      guest.getByRole("heading", { name: "Svarene dine er lagret." }),
    ).toBeVisible();
    await context.close();
  }

  // Close: replay misses and there is no key, so the fallback groups and says so (AD-13).
  await closeAndOpenReview(page, gamePath);
  await expect(page.getByText(NO_KEY, { exact: true })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // Merge Frida with Per, who sits below the Board line: two people, nothing below the line.
  await expect(
    page.getByRole("region", { name: "Ikke på brettet (1 gruppe)" }),
  ).toBeVisible();
  const bar = page.locator("[data-selection-bar]");
  const box = (label: string) =>
    page.getByRole("checkbox", { name: `Velg gruppen «${label}»` });
  await box("Frida").check();
  await box("Per").check();
  await bar.getByRole("button", { name: "Slå sammen 2 grupper" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.locator('p[aria-live="polite"]')).toHaveText(
    "Slått sammen til «Frida», nå 2 personer, plass 2.",
  );
  await expect(page.getByText("Ikke på brettet")).toHaveCount(0);

  // Mark both Questions and lock the Board.
  const mark = page.getByRole("button", { name: "Marker som gjennomgått" });
  await mark.click();
  await expect(page).toHaveURL(`${gamePath}/gjennomgang?q=2`);
  await mark.click();
  await expect(mark).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Spørsmål" })
    .locator("..")
    .getByRole("button", { name: "Lås brettet" })
    .click();
  await page
    .getByRole("dialog", { name: "Låse brettet?" })
    .getByRole("button", { name: "Lås brettet" })
    .click();
  await expect(page).toHaveURL(gamePath);

  // Two named Teams over the prefilled fields.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("link", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  for (const [n, name] of TEAMS.entries())
    await page.getByLabel(`Navn på lag ${n + 1}`).fill(name);
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page).toHaveURL(gamePath);
  // Played as at a party: the Host view here, the TV page in a second window.
  await page.getByRole("link", { name: "Vertsvisning med fasit" }).click();
  const heading = page.locator("h1");
  await expect(heading).toHaveText(QUESTION);
  const tv = await page.context().newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto(`${gamePath}/tv`);
  await expect(tv.locator("h1")).toHaveText(QUESTION);

  const stage = tv.locator("[data-stage]");
  const tile = (n: number) =>
    stage.locator(".stage-canvas > ol > li").nth(n - 1);
  const teams = page.getByRole("region", { name: "Lag" }).getByRole("listitem");
  const tvTeams = stage
    .getByRole("list", { name: "Lag" })
    .getByRole("listitem");
  const status = page.locator('p[role="status"]');
  const toggle = page.getByRole("button", { name: /uten poeng \[U\]$/ });
  const reveal = (n: number) =>
    page.getByRole("button", { name: `Avslør plass ${n}` });
  // The Counts each Team was credited with, read off the tiles as the room saw them.
  const counts: number[][] = TEAMS.map(() => []);
  const sum = (team: number) => counts[team].reduce((a, b) => a + b, 0);
  const expectScores = async (current: number) => {
    const shown = TEAMS.map(
      (name, t) => `${t === current ? "Svarer nå" : ""}${name}${sum(t)} poeng`,
    );
    await expect(teams).toHaveText(shown);
    await expect(tvTeams).toHaveText(shown);
  };
  // The expected text pins the locked Board (the merge's recount included); the Count comes from it.
  const scored = async (n: number, team: number, text: string) => {
    await reveal(n).click();
    await expect(tile(n)).toHaveText(text);
    counts[team].push(Number(/(\d+) poeng$/.exec(text)![1]));
    await expectScores(team);
  };

  // Question 1: Hyttegjengen, then Byfolket twice; the second Reveal is undone.
  await expectScores(0);
  await scored(1, 0, "1Kari3 poeng");
  await page.keyboard.press("t");
  await expect(status).toHaveText("Byfolket svarer nå.");
  await scored(2, 1, "2Frida2 poeng");
  await scored(3, 1, "3Anne1 poeng");
  await page.keyboard.press("z");
  await expect(reveal(3)).toBeVisible();
  await expect(tile(3)).toHaveText("3");
  counts[1].pop();
  await expectScores(1);

  // The rest of slot 3 unscored: no Score changes. Axe with scored and unscored tiles.
  await page.keyboard.press("u");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await reveal(3).click();
  await expect(tile(3)).toContainText("uten poeng");
  await expectScores(1);
  expect(await seriousViolations(page)).toEqual([]);
  expect(await seriousViolations(tv)).toEqual([]);

  // Question 2: back to Hyttegjengen for a scored Reveal, then the end.
  await page.keyboard.press("n");
  await expect(heading).toHaveText(Q2);
  await expect(tv.locator("h1")).toHaveText(Q2);
  await expect(
    stage.getByText("Spørsmål 2 av 2", { exact: true }),
  ).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("t");
  await expect(status).toHaveText("Hyttegjengen svarer nå.");
  await scored(1, 0, "1Rød2 poeng");
  await page
    .getByRole("button", { name: "Vis sluttstilling [N]", exact: true })
    .click();

  // Sluttstilling: each Team with the sum of its scored Counts, highest first.
  await expect(heading).toHaveText("Sluttstilling");
  await expect(tv.locator("h1")).toHaveText("Sluttstilling");
  const ranked = TEAMS.map((name, t) => ({ name, score: sum(t) })).sort(
    (a, b) => b.score - a.score,
  );
  expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  await expect(
    stage.getByRole("list", { name: "Sluttstilling" }).getByRole("listitem"),
  ).toHaveText(
    ranked.map(
      ({ name, score }, r) => `${r === 0 ? "Vinner" : ""}${name}${score} poeng`,
    ),
  );
  expect(await seriousViolations(tv)).toEqual([]);

  // FR-11: the recorder saw this round's Tokens and Answers, so the teardown scans for them.
  const recorded = readFileSync(
    path.join(process.env.E2E_OUT_DIR!, "secrets.jsonl"),
    "utf8",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string);
  expect(recorded).toEqual(
    expect.arrayContaining([
      ...links.map((link) => link.split("#")[1]),
      ...ANSWERS.flat(2),
    ]),
  );
});
