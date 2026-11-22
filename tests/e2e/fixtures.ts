import { expect, test as base, type Page } from "@playwright/test";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// NFR-3: the browser never reaches a host other than localhost.
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.route("**/*", (route) =>
      LOCAL_HOSTS.has(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
    await provide(context);
  },
});

export { expect };

export const FOCUS_RING = "3px solid rgb(30, 26, 34)";
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
  await expect(page).toHaveURL("/spill");
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
