import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// AD-1 layers. Every import inside src and tests goes through the `@/` alias,
// so each zone is a list of banned alias prefixes.
const MODULES = [
  "auth",
  "games",
  "questions",
  "grouping",
  "collection",
  "review",
  "play",
];

const NO_PARENT = {
  regex: "(^|/)\\.\\.(/|$)",
  message: "Use the @/ alias, not ../ imports.",
};
const ban = (prefix, message) => ({ regex: `^${prefix}(/|$)`, message });
const PROVIDERS = ban(
  "@/server/judge/providers",
  "Judge providers are private to src/server/judge.",
);
const NO_DB = ban(
  "@/server/(db|judge)",
  "Routes and UI call module entry points, never the DB or the Judge.",
);
const anyOf = (names) => `@/server/(${names.join("|")})`;
const NO_UI = ban(
  "@/(app|components)",
  "Server code never imports routes or UI.",
);

const zone = (files, ...patterns) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: [NO_PARENT, ...patterns] }],
  },
});

export default defineConfig([
  globalIgnores([
    "_bmad/",
    ".claude/",
    "wiki/",
    ".docs/",
    "prompting/",
    "scripts/",
    "drizzle/",
    ".idea/",
    ".next/",
    ".data/",
    ".logs/",
    "test-results/",
    "playwright-report/",
    "next-env.d.ts",
  ]),
  ...nextVitals,
  ...nextTs,
  prettier,
  { rules: { "no-console": "error" } },
  { files: ["src/server/log.ts"], rules: { "no-console": "off" } },
  { files: ["src/cli/**"], rules: { "no-console": "off" } },
  zone(["**/*.{js,mjs,cjs,ts,tsx}"]),
  zone(["src/*.{ts,tsx}", "src/app/**", "src/components/**"], NO_DB),
  // A later zone replaces the earlier patterns, so the routes' ban is repeated.
  zone(
    [
      "src/app/svar/**",
      "src/components/AnswerForm.tsx",
      "src/components/InviteLinkView.tsx",
      "src/components/LinkStatus.tsx",
      "src/components/ParticipantChrome.tsx",
    ],
    NO_DB,
    ban("@/server/auth", "No auth code runs under /svar (AD-6)."),
  ),
  zone(
    ["src/lib/**"],
    ban("@/(server|app|components|cli)", "src/lib is pure."),
  ),
  zone(["src/server/**"], NO_UI, PROVIDERS),
  ...MODULES.map((name, i) => {
    const later = MODULES.slice(i + 1);
    return later.length
      ? zone(
          [`src/server/${name}/**`],
          NO_UI,
          PROVIDERS,
          ban(anyOf(later), `${name} may call only earlier modules.`),
        )
      : zone([`src/server/${name}/**`], NO_UI, PROVIDERS);
  }),
  zone(
    ["src/server/db/**"],
    NO_UI,
    PROVIDERS,
    ban(anyOf(MODULES), "The DB layer never imports a module."),
  ),
  zone(
    ["src/server/judge/**"],
    NO_UI,
    ban(anyOf(MODULES), "The Judge never imports a module."),
  ),
  // AD-13: there is no SDK, so the ban is on the endpoint itself.
  {
    files: ["src/**"],
    ignores: ["src/server/judge/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          "Literal[value=/openrouter\\.ai/i]",
          "TemplateElement[value.raw=/openrouter\\.ai/i]",
        ].map((selector) => ({
          selector,
          message: "Only src/server/judge calls the model endpoint.",
        })),
      ],
    },
  },
  zone(["src/cli/**"], PROVIDERS, {
    regex: "^@/server/db(/(?!migrate$)|$)",
    message:
      "The CLI uses module entry points; from db only @/server/db/migrate.",
  }),
]);
