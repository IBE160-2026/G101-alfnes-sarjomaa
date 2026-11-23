import {
  QUESTION_SET_CREDIT as CREDIT,
  QUESTION_SETS,
} from "@/lib/question-sets";
import { expect, registerHost, seriousViolations, test } from "./fixtures";

const [home] = QUESTION_SETS;

test("FR-33 (AC1, AC2, AC3), NFR-6: a Game from a Question set lands in Klar, plays its Board from the data and credits ProtoQA in the control bar, which fits 1920×1080 in the worst case", async ({
  page,
}) => {
  await registerHost(page);
  await page.getByLabel("Navn på spillet").fill("Fredag");
  const set = page.getByLabel("Spørsmål", { exact: true });
  await expect(set).toHaveValue("");
  await set.selectOption({ label: home.name });
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Lag spill" }).click();

  // AC1: straight to ready, no usage report (there was no Grouping).
  await expect(page.locator("h1")).toHaveText("Fredag");
  await expect(page.getByText("Klar", { exact: true })).toBeVisible();
  await expect(page.getByText("5 spørsmål er klare.")).toBeVisible();
  await expect(page.getByText("Last ned bruksrapport")).toHaveCount(0);
  const gamePath = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText("Hvem spiller?");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("button", { name: "Start spillet" }).click();
  await expect(page.locator("h1")).toHaveText(home.questions[0].text);

  // AC2, AC3: slot 1 is the data's top Group, in Norwegian, and the bar credits the source.
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
  // The credit's own line sits under the hints, in the bar.
  const bar = stage.getByText(CREDIT, { exact: true }).locator("../..");
  const fits = async () => {
    const b = (await bar.boundingBox())!;
    expect(b.height).toBe(64);
    for (const child of await bar.locator("> *").all()) {
      const c = (await child.boundingBox())!;
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
  };
  await fits();
  await page.keyboard.press("u");
  await expect(
    stage.getByRole("button", { name: "Avslører uten poeng [U]" }),
  ).toBeVisible();
  await fits();
  await page.screenshot({
    path: test.info().outputPath("question-set-control-bar.png"),
    animations: "disabled",
  });

  // A Host-written Game gets no credit: the default select value still makes a draft.
  await page.goto("/spill");
  await page.getByLabel("Navn på spillet").fill("Egne spørsmål");
  await page.getByRole("button", { name: "Lag spill" }).click();
  await expect(page.getByText("Utkast", { exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).not.toBe(gamePath);
});
