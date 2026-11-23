import type { Locator } from "@playwright/test";
import {
  QUESTION_SET_CREDIT as CREDIT,
  QUESTION_SETS,
} from "@/lib/question-sets";
import {
  expect,
  registerHost,
  seriousViolations,
  test,
  WIDE_TEAMS,
} from "./fixtures";

const [home] = QUESTION_SETS;

test("FR-33 (AC1, AC2, AC3), NFR-6: a Game from a Question set lands in Klar, plays its Board from the data and credits ProtoQA under the Question count, clear of the Question and the Teams at 1920×1080 and 1280×720, with the control bar as for any Game", async ({
  page,
}) => {
  await registerHost(page);
  const set = page.getByLabel("Spørsmål", { exact: true });
  await expect(set).toHaveValue("");
  await set.selectOption({ label: home.name });
  expect(await seriousViolations(page)).toEqual([]);

  // The chosen set survives a failed submit (React 19 resets the form after the
  // action), so the retry below takes the set path, not the draft one.
  const title = page.getByLabel("Navn på spillet");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(set).toHaveValue(home.id);
  await title.fill("Fredag");
  await page.getByRole("button", { name: "Lag spill" }).click();

  // AC1: straight to ready, no usage report (there was no Grouping).
  await expect(page.locator("h1")).toHaveText("Fredag");
  await expect(page.getByText("Klar", { exact: true })).toBeVisible();
  await expect(page.getByText("5 spørsmål er klare.")).toBeVisible();
  await expect(page.getByText("Last ned bruksrapport")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Brettet er klart" }),
  ).toBeVisible();
  const gamePath = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  // The Team column's worst case (A8), so the credit above the cards is tested at its tightest.
  for (const [i, name] of WIDE_TEAMS.entries()) {
    if (i > 1) await page.getByRole("button", { name: "Legg til lag" }).click();
    await page.getByLabel(`Navn på lag ${i + 1}`).fill(name);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);

  // AC2, AC3: slot 1 is the data's top Group, in Norwegian, and the stage credits the source.
  const stage = page.locator("[data-stage]");
  const tile = (n: number) => stage.locator("[data-slot]").nth(n - 1);
  const [top] = home.questions[0].groups;
  await page.keyboard.press("1");
  await expect(tile(1).locator(".reveal-label")).toHaveText(top.label);
  await expect(tile(1)).toContainText(`${top.count} poeng`);
  await expect(stage.getByText(CREDIT, { exact: true })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // Worst case for the bar: the last Question, Angre shown, every slot revealed, the
  // unscored toggle on, "Vis sluttstilling", "Alle svarene er avslørt." and the F hint.
  for (const q of home.questions.slice(1)) {
    await page.keyboard.press("n");
    await expect(page.locator("h1")).toHaveText(q.text);
  }
  const last = home.questions.at(-1)!;
  for (let n = 1; n <= last.groups.length; n++) {
    await page.keyboard.press(String(n));
    await expect(tile(n)).not.toHaveRole("button");
  }
  await expect(
    stage.getByText("Alle svarene er avslørt.", { exact: true }),
  ).toBeVisible();
  await expect(
    stage.getByRole("button", { name: "Vis sluttstilling [N]" }),
  ).toBeVisible();
  // The bar is the same as on any Game: 64 px, every item inside it.
  const bar = stage
    .getByText("Trykk F for fullskjerm.", { exact: true })
    .locator("..");
  const credit = stage.getByText(CREDIT, { exact: true });
  const cards = stage.getByRole("list", { name: "Lag" });
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const fits = async () => {
    const b = await box(bar);
    for (const child of await bar.locator("> *").all()) {
      const c = await box(child);
      expect(c.x).toBeGreaterThanOrEqual(b.x);
      expect(c.x + c.width).toBeLessThanOrEqual(b.x + b.width + 0.5);
      expect(c.y).toBeGreaterThanOrEqual(b.y - 0.5);
      expect(c.y + c.height).toBeLessThanOrEqual(b.y + b.height + 0.5);
    }
    expect(
      await bar.evaluate(
        (el) =>
          el.scrollWidth <= el.clientWidth &&
          el.scrollHeight <= el.clientHeight,
      ),
    ).toBe(true);
    // The credit sits in the Team column, right of the Question and above the Teams,
    // and the last Team card still ends above the bar.
    await expect(credit).toBeVisible();
    const cr = await box(credit);
    const q = await box(page.locator("h1"));
    const t = await box(cards);
    expect(cr.x).toBeGreaterThanOrEqual(q.x + q.width);
    expect(cr.x + cr.width).toBeLessThanOrEqual(t.x + t.width + 0.5);
    expect(cr.y + cr.height).toBeLessThanOrEqual(t.y);
    expect(t.y + t.height).toBeLessThanOrEqual(b.y);
  };
  expect((await box(bar)).height).toBe(64);
  await fits();
  await page.keyboard.press("u");
  await expect(
    stage.getByRole("button", { name: "Avslører uten poeng [U]" }),
  ).toBeVisible();
  await fits();
  await page.screenshot({
    path: test.info().outputPath("question-set-stage-1920.png"),
    animations: "disabled",
  });
  // Scaled to a smaller window, the canvas keeps the same layout.
  await page.setViewportSize({ width: 1280, height: 720 });
  await fits();
  await page.screenshot({
    path: test.info().outputPath("question-set-stage-1280.png"),
    animations: "disabled",
  });

  // The played page names no Answers, since a set Game never had any.
  await page.keyboard.press("n");
  await expect(page.locator("h1")).toHaveText("Sluttstilling");
  await page.goto(gamePath);
  await expect(
    page.getByRole("region", { name: "Sluttstilling" }).getByRole("status"),
  ).toHaveText(/^Spillet slettes automatisk /);
});
