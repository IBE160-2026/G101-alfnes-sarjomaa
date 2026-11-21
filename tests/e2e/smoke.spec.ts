import { existsSync } from "node:fs";
import { expect, test } from "./fixtures";

const dbDir = process.env.E2E_DB_DIR as string;

test("NFR-1: build and start never open the DB; GET /api/health opens it and returns 200", async ({
  request,
}) => {
  expect(dbDir).toBeTruthy();
  expect(existsSync(dbDir)).toBe(false);

  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
  expect(existsSync(dbDir)).toBe(true);
});

test('NFR-1: / renders with <html lang="nb">', async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "nb");
  await expect(page).toHaveTitle("Toppsvar");
});

test("NFR-3: the browser aborts requests to non-local hosts", async ({
  page,
}) => {
  await page.goto("/");
  const failed = page.waitForEvent("requestfailed", (r) =>
    r.url().startsWith("https://example.com"),
  );
  const outcome = await page.evaluate(() =>
    fetch("https://example.com/").then(
      () => "loaded",
      () => "blocked",
    ),
  );
  expect(outcome).toBe("blocked");
  expect((await failed).failure()?.errorText).toMatch(
    /^net::ERR_BLOCKED_BY_CLIENT/,
  );
});
