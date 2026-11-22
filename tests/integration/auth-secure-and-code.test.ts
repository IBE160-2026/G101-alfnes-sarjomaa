import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return { ...real, scrypt: vi.fn(real.scrypt) };
});

// env.ts is parsed once at import, so stub first and load everything fresh.
vi.stubEnv("APP_BASE_URL", "https://toppsvar.example");
vi.stubEnv("REGISTRATION_CODE", "x");
vi.resetModules();
const { register } = await import("@/app/registrer/actions");
const { default: RegisterPage } = await import("@/app/registrer/page");
const { cookieJar, run } = await import("./next-mocks");
const { getDb } = await import("@/server/db/client");
const { host } = await import("@/server/db/schema");
const { scrypt } = await import("node:crypto");

afterAll(() => {
  vi.unstubAllEnvs();
});

vi.setConfig({ testTimeout: 30_000 });

const PASSWORD = "riktig-passord-123";
const WRONG_CODE = {
  ok: false,
  code: "REGISTRATION_CODE_WRONG",
  message: "Registreringskoden stemmer ikke.",
  fieldErrors: { registrationCode: "Registreringskoden stemmer ikke." },
};

describe("with REGISTRATION_CODE set", () => {
  it.each([
    ["missing", {}],
    ["wrong", { registrationCode: "y" }],
  ])(
    "FR-1: a %s code is refused before any scrypt run and creates no Host",
    async (_, extra) => {
      vi.mocked(scrypt).mockClear();
      expect(
        await run(register, {
          email: "kode@example.test",
          password: PASSWORD,
          ...extra,
        }),
      ).toEqual(WRONG_CODE);
      expect(scrypt).not.toHaveBeenCalled();
      expect(await (await getDb()).select().from(host)).toEqual([]);
    },
  );

  it("FR-1: the right code registers and the cookie is Secure on https", async () => {
    expect(
      await run(register, {
        email: "kode@example.test",
        password: PASSWORD,
        registrationCode: "x",
      }),
    ).toEqual({ redirect: "/spill" });
    expect(cookieJar.set).toHaveBeenCalledWith(
      "toppsvar_session",
      expect.any(String),
      expect.objectContaining({ secure: true, httpOnly: true }),
    );
  });

  it('FR-1: /registrer shows a field labelled "Registreringskode"', async () => {
    const html = renderToStaticMarkup(await RegisterPage());
    const id = /<label for="([^"]+)"[^>]*>Registreringskode<\/label>/.exec(
      html,
    )?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });
});
