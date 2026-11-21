import { test as base } from "@playwright/test";

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

export { expect } from "@playwright/test";
