import { vi } from "vitest";

// Stand-ins for next/headers, next/navigation and next/cache outside a request. Use with
//   vi.mock("next/headers", () => import("./next-mocks").then((m) => m.nextHeaders));
//   vi.mock("next/navigation", () => import("./next-mocks").then((m) => m.nextNavigation()));
//   vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

const store = new Map<string, string>();

export const cookieJar = {
  store,
  get: (name: string) =>
    store.has(name) ? { name, value: store.get(name)! } : undefined,
  has: (name: string) => store.has(name),
  // Options are only recorded, for assertions on the call.
  set: vi.fn((name: string, value: string, options?: object) => {
    void options;
    store.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    store.delete(name);
  }),
};

export const nextHeaders = { cookies: async () => cookieJar };

export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

export class NotFoundError extends Error {
  constructor() {
    super("notFound");
  }
}

export async function nextNavigation() {
  const real =
    await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...real,
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
    notFound: () => {
      throw new NotFoundError();
    },
    // Client components rendered with renderToStaticMarkup have no app router mounted.
    useRouter: () => ({ refresh: () => {} }),
    // The stand-ins count as Next control flow too, as the real ones do.
    unstable_rethrow: (error: unknown) => {
      if (error instanceof RedirectError || error instanceof NotFoundError)
        throw error;
      real.unstable_rethrow(error);
    },
  };
}

// revalidatePath needs a request store; outside one it only records the call.
export const nextCache = { revalidatePath: vi.fn() };

export function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// Runs a Server Action and returns its failure, or the URL it redirected to.
export async function run(
  action: (prev: unknown, data: FormData) => Promise<unknown>,
  fields: Record<string, string>,
): Promise<unknown> {
  try {
    return await action(null, formData(fields));
  } catch (error) {
    if (error instanceof RedirectError) return { redirect: error.url };
    throw error;
  }
}
