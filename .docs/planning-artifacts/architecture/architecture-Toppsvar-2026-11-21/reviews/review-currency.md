# Reviewer Gate: currency lens (Toppsvar architecture spine)

Date of review: 2026-11-21. Spine: `ARCHITECTURE-SPINE.md` (status draft). Memlog: `.memlog.md`.

**Lens:** was each committed decision reality-checked (current versions, tech still exists and fits, live starter defaults) rather than asserted from training data?

**Verdict:** The version pins are accurate to the minute (all 20 match npm latest on 2026-11-21) and the core bets work on a real build, but the spine is silent on four starter and engine realities that will bite in story 1: the starter's `@types/node ^20` breaks `npm install` with vitest 5, Node 22.12 is below eslint 10's real floor (22.13), PGlite will not create `.data/`, and eslint 10 departs from the starter's `eslint ^9` while three bundled plugins declare no eslint 10 support.

**Counts:** critical 0, high 1, medium 3, low 10. Of the 26 checks in the table, 4 carry a contradicted or missing element (F-01, F-02, F-04, F-05) and 3 are unverifiable here.

## How this was checked

- npm registry: `npm view` for every pin, peers and engines; a full `npm install --package-lock-only` and `npm ci` of the exact stack (scratch project, kept in the session scratchpad: `.../scratchpad/resolve2`).
- A real minimal app on the pinned stack (Next 16.4.6, React 19.3.1, TS 6.0.3, Tailwind 4.3.5 via `@tailwindcss/postcss`, PGlite 0.5.17, drizzle-orm 0.45.4, drizzle-kit 0.31.11, vitest 5.1.1, eslint 10.15.0 + eslint-config-next 16.4.6): `next dev` with HMR edits, `next build`, `next start`, a Server Action calling `after()`, vitest with in-memory PGlite and real migrations, eslint, tsc.
- The same toolchain inside Docker `node:22.12.0-slim` (the stated minimum Node), and `--network none` for the offline-build claim.
- `create-next-app@16.4.6` tarball unpacked to read the **live starter defaults** (templates and dependency selection logic).
- Web: nextjs.org (after, serverExternalPackages, output file tracing), vercel.com docs (duration, limits, postgres), neon.com (pricing, pooling), platform.claude.com (models overview, Haiku 5.5 page, structured outputs), OWASP Password Storage cheat sheet, nodejs.org (cli, crypto, release schedule), tailwindcss.com, pglite.dev, GitHub `iesl/protoqa-data`.

Not tested: Windows, a live Vercel deploy, a live Neon database, a live Anthropic call (no key; API shape checked against docs and the 1.12.0 SDK `.d.ts`).

## Findings

### F-01 [HIGH] Stack table omits `@types/*`; the starter's `@types/node ^20` fails `npm install` with vitest 5.1.1

- **Status:** contradicted (by the live starter) and incomplete.
- **Evidence:** `create-next-app@16.4.6` writes `"@types/node": "^20"`, `"@types/react": "^19"`, `"@types/react-dom": "^19"`, `typescript ^5`, `eslint ^9`, `tailwindcss 4.3.3`. vitest 5.1.1 declares `peerOptional @types/node "^22.0.0 || >=24.0.0"`. Reproduced:

  ```
  npm install --package-lock-only vitest@5.1.1 @types/node@^20
  npm error code ERESOLVE ... Conflicting peer dependency: @types/node@26.6.6
  ```

  The spine's Stack table lists no `@types/node`, `@types/react`, `@types/react-dom`, `@axe-core/playwright` (named in AD-22 only) or `@electric-sql/pglite-socket` (named in AD-2 fallback only). With `@types/node@22` the full set resolves and `tsc` passes (checked).
- **Fix:** add to Stack: `@types/node` 22.20.5 (matches the Node floor), `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@axe-core/playwright` 4.14.0. Add one sentence under Stack: "Do not keep the starter's `@types/node ^20`; vitest 5 rejects it." Pin `@electric-sql/pglite-socket` 0.2.20 only if the fallback is exercised (see F-08).

### F-02 [MEDIUM] "Node >= 22.12" is below the real floor of the pinned toolchain (22.13)

- **Status:** contradicted (partially).
- **Evidence:** `npm view eslint@10.15.0 engines` gives `^20.19.0 || ^22.13.0 || >=24`; the same range sits on `@eslint/config-array`, `@eslint/core`, `@eslint/plugin-kit`, `eslint-scope`, `espree` and others. A semver sweep of the resolved lockfile finds 9 packages that exclude 22.12.0 and none that exclude 22.13.0 (apart from an irrelevant win32-ia32 sharp binary). In Docker `node:22.12.0-slim` + npm 10.9.0, `npm ci` prints one `EBADENGINE Unsupported engine` block per package (40 matching lines). Functionally everything still passed on 22.12.0 (eslint, tsc, vitest, `next build`, tsx flags, `next start` with PGlite), so this is a warning wall, not a failure.
- Also: vitest 5.1.1 engines are `^22.12.0 || ^24.0.0 || >=26.0.0`, so odd releases 23 and 25 are outside range; @axe-core/playwright 4.14.0 needs `>=22.12.0`.
- **Fix:** state the prerequisite as "Node 22.13 or newer (use an even-numbered LTS: 22, 24 or 26)" in Stack, the README contract and `engines`/`.nvmrc`. Keep the CI matrix 22 and 26. The README's first-run section should not make the examiner see 40 lines of EBADENGINE.

### F-03 [MEDIUM] eslint 10.15.0 departs from the starter default (`eslint ^9`); three eslint-config-next plugins declare no eslint 10 support

- **Status:** verified to work in a smoke test; verified to be an unsupported-by-peer-range combination. The memlog says only "eslint-config-next 16.4.6 (flat config)" without a compatibility check.
- **Evidence:** `eslint-config-next@16.4.6` depends on `eslint-plugin-react 7.37.5` (peer eslint `^3 ... ^9.7`), `eslint-plugin-import 2.32.0` (peer `... ^9`) and `eslint-plugin-jsx-a11y 6.10.2` (peer `... ^9`). `npm install` prints three `ERESOLVE overriding peer dependency` warnings; `npm ls eslint` marks them `invalid`. `eslint-plugin-react-hooks 7.1.1` does list `^10.0.0`; `typescript-eslint 8.73.0` lists `^10.0.0`. Runtime smoke test with the flat config (`eslint/config` `defineConfig`, `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, `eslint-config-prettier/flat`) on eslint 10.15.0 caught rule hits from all four plugin families: `react/jsx-key`, `react/no-unescaped-entities`, `react/display-name`, `react-hooks/exhaustive-deps`, `import/no-anonymous-default-export`, `jsx-a11y/alt-text`, `@next/next/no-img-element`, `@typescript-eslint/no-unused-vars`. No crash. Same result on Node 22.12.0.
- Risk: any later patch to one of the three plugins, or a rule added to the Next config that uses an API removed in eslint 10, can fail lint with no upstream support to appeal to. The starter's own `eslint.config.mjs` shape is what the spine follows, so only the major differs.
- **Fix:** either (a) pin `eslint` `^9` as the starter does (zero peer warnings; typescript-eslint 8.73.0 supports it) and add "eslint 10 revisit when eslint-config-next's plugins support it", or (b) keep 10 and record in the spine that it was smoke-tested and that peer warnings are expected. Recommendation: (a), because the examiner sees `npm install` output and this adds nothing the course needs.

### F-04 [MEDIUM] `pglite://.data/local` fails on a fresh clone: PGlite does not create parent directories

- **Status:** contradicted (an unstated assumption in AD-2).
- **Evidence:** PGlite 0.5.17:

  ```
  new PGlite('pgtest/nested/dir')  -> ENOENT: no such file or directory, mkdir '.../pgtest/nested/dir'
  new PGlite('pgtest-flat')        -> OK  (PostgreSQL 18.7 (PGlite 0.5.17))
  ```

  In the Next test app, `next start` against an absent `.data/` returned HTTP 500 with the same ENOENT (`CREATE SCHEMA IF NOT EXISTS "drizzle"` cause chain); after `mkdir .data` it worked in `dev`, `build` and `start`. `.data/` is gitignored (AD-21), so it never exists on a fresh clone.
- Impact: `npm run dev` and any test using a directory DB fail on first run unless `client.ts` handles it. `npm run demo` is probably safe because AD-19 step 1 "delete and recreate `.data/demo`", if the recreate is recursive.
- **Fix:** add to AD-2: "`client.ts` runs `mkdirSync(path.dirname(dir), { recursive: true })` before opening a directory DB." One line, but it is exactly the examiner path (NFR-1).

### F-05 [LOW] ProtoQA dev file has 52 questions, not 51

- **Status:** contradicted.
- **Evidence:** `iesl/protoqa-data` exists, license `CC-BY-4.0` (GitHub API `license.spdx_id`, `LICENSE` file is the CC BY 4.0 legal code), last push 2021-12-02, default branch `master`. `data/dev/dev.crowdsourced.jsonl` exists (109,116 bytes). The repo README says "51 questions", but the file contains 52 JSON rows (52 unique ids `r1q1` ... `r2q49`, 52 unique normalised questions; `wc -l` 52). Each row has `answers.raw` (9 to 88 distinct strings, 99 to 101 respondents) and `answers.clusters` (4 to 19 clusters). The data format matches AD-14/AD-20's assumptions (answer string to count, hand clusters).
- **Fix:** write "about 50" or "52 (the dataset README says 51)" in AD-20 and `data/protoqa/ATTRIBUTION.md`; make `judge-eval.test.ts` assert against the file, not a literal. Note that max items per question here (88) is well below the PRD sizing item counts (150/250), so the eval says nothing about the large-batch case.

### F-06 [LOW] `next dev` generates `AGENTS.md` at the repo root when it detects an AI agent (Next 16.4.6 default)

- **Status:** unmentioned live default.
- **Evidence:** running `next dev` from this session printed "Generated AGENTS.md for AI agents. Set `agentRules: false` in next.config to disable." and wrote `AGENTS.md` (a `<!-- BEGIN:nextjs-agent-rules -->` block). Source: `node_modules/next/dist/server/lib/generate-agent-files.js`, config key `agentRules?: boolean` (default `true`) in `config-shared.d.ts`. The project is explicitly AI-driven and `bmad-project-context` also manages an AGENTS.md block, and the demo command runs `next dev`.
- **Fix:** add `agentRules: false` to `next.config.ts`, or accept and commit `AGENTS.md` deliberately. Name the choice in the Conventions "Process" row so the tree stays clean (sensor criterion "ryddighet").

### F-07 [LOW] Starter's `next/font/google` makes `next build` fail offline; the spine's "self-hosted fonts" rule is right but does not name the fix

- **Status:** verified (spine is correct; the default it must override is real).
- **Evidence:** the starter `app/layout.tsx` imports `Geist` from `next/font/google`. In Docker with `--network none`, `next build` fails: "Failed to fetch Geist from Google Fonts. If you are offline ... self-host the font with next/font/local". The spine's Assets row says "no remote fonts or CDNs, so builds and tests work offline".
- **Fix:** name `next/font/local` (font files committed under `src/app/fonts/`) in the Assets convention, and note the starter layout must be replaced (it also sets `lang="en"` and the title "Create Next App").

### F-08 [LOW] pglite-socket fallback is real but needs `max: 1` and an exact pglite pin

- **Status:** verified, with two conditions the spine does not state.
- **Evidence:** `@electric-sql/pglite-socket@0.2.20` exists with bin `pglite-server` and a `-r, --run=COMMAND` option; its peer dependency on `@electric-sql/pglite` is the exact string `0.5.17`; `--max-connections` defaults to 1. Test with postgres.js 4.1.1 + drizzle-orm/postgres-js (migrate, transactions): with `postgres(url, { max: 1 })` six concurrent transactions all succeed; with the default pool (10) five of six fail with `read ECONNRESET`.
- **Fix:** in AD-2's fallback bullet add "postgres.js is created with `max: 1` against pglite-server" and "pglite and pglite-socket versions are pinned together". "Only `client.ts` changes" remains true. Given that in-process PGlite worked in dev, build and start (V-12), the fallback is a contingency, not a likely path.

### F-09 [LOW] Judge sizing numbers and structured-output behaviour were not measured

- **Status:** unverifiable (the model, price and parameter shapes are verified; the token counts are not).
- **Evidence:** model id, price and parameters are confirmed (see the table). Not confirmed: (a) the 2.8K/1.2K and 4.2K/1.5K token estimates; the Haiku 5.5 page says it uses the Opus 4.7 tokenizer, "approximately 30 percent more tokens than on Claude Haiku 4.5"; (b) Haiku 5.5 has adaptive thinking on by default, default effort `medium`; the spine sets effort `low` but never sets `thinking`, and thinking tokens are billed as output; (c) structured outputs add a system prompt (extra input tokens), reject `minItems` above 1, `maxItems`, numeric and string-length constraints, require `additionalProperties: false` on objects, and the first request with a new schema pays a grammar-compile latency; changing `output_config.format` invalidates the prompt cache.
- Impact: cost stays in cents even at 2x, so this is not a decision risk. The array length and partition validity must be validated in code (the memlog already says "validated as a total partition"; the spine should state it), because the schema cannot enforce `items.length`.
- **Fix:** in the Judge story, record a real `count_tokens` figure and one live latency for the sizing Game; state in AD-13 that `assignments.length === items.length` and cluster-number validity are checked in code; decide whether to send `thinking` explicitly.

### F-10 [LOW] drizzle-kit 0.31.11 drags in deprecated, vulnerable esbuild: `npm install` shows deprecation warnings and `npm audit` shows 4 moderate

- **Status:** verified; dev-only.
- **Evidence:** `npm warn deprecated @esbuild-kit/core-utils@3.3.2: Merged into tsx` and `@esbuild-kit/esm-loader@2.6.5`; `npm audit`: 4 moderate, all via `drizzle-kit` to `@esbuild-kit/*` to `esbuild <=0.24.2` (GHSA-67mh-4wv8-2f99, an esbuild dev-server issue; drizzle-kit does not run one). Everything else in the stack audits clean. `drizzle-orm 0.45.4` is latest (published 2026-10-08) and `1.0.0-rc.6` published 2026-11-20 on the `rc` tag, so the 0.45 line is about to be superseded.
- **Fix:** keep `drizzle-kit` in `devDependencies` (so `npm audit --omit=dev` is clean); add one README line that the examiner will see these warnings and why; optionally add an npm `overrides` for `esbuild`. Revisit when Drizzle 1.0 goes stable (its migrator exports may move).

### F-11 [LOW] TypeScript 6.0.3 is a dead-end line and needs an exact pin

- **Status:** verified; memlog reasoning is correct and current.
- **Evidence:** `npm view typescript versions`: 6.x ends at 6.0.3 (no 6.1); `latest` is 7.0.2 (published 2026-07-08). typescript-eslint 8.73.0 (published 2026-11-16) peers `typescript >=4.8.4 <6.1.0`; its dist-tags have no TS 7 build (only `canary` 8.73.1-alpha.11). Next 16.4.6 `next build` runs its TypeScript check cleanly on 6.0.3 (no warning). The starter itself pins `typescript ^5`.
- **Fix:** use exact `"typescript": "6.0.3"` in `package.json` (a caret would be harmless today but the intent is "do not move"), and keep the "revisit when typescript-eslint supports 7" note in the spine rather than only in the memlog.

### F-12 [LOW] Vercel/Neon fit notes and `outputFileTracingIncludes` key

- **Status:** verified existence; fit notes missing.
- **Evidence:** Neon Free plan exists ("permanent, no credit card", 1 GB per project, 100 CU-hours, scale-to-zero after 5 minutes, "cannot be turned off", 6-hour history, instant restore not available). Neon's pooled endpoint (`-pooler`) is PgBouncer in transaction mode: `SET`, `LISTEN`, session advisory locks and SQL-level `PREPARE` do not work; protocol-level prepared statements do (PgBouncer 1.22+). The spine's AD-4 (`SELECT ... FOR UPDATE` inside one transaction) and AD-9 (`VACUUM FULL` after commit, outside a transaction; PGlite rejects it inside one with "cannot run inside a transaction block") are compatible. `outputFileTracingIncludes` is a top-level key whose keys are route globs; `{'/*': ['data/rulings/**']}` was confirmed to put `data/rulings/demo.json` in the trace of both a route handler and a page, but it also traces PGlite (about 20 MB of 22 MB) into every function, harmless against the 250 MB limit. Vercel Postgres no longer exists (migrated to Neon, Dec 2024), so "free-tier Postgres via Marketplace" is the right phrasing.
- **Fix:** in AD-24 name the key (`'/*'` or the Game routes), say "use Neon's direct connection for migrations and the pooled one for the app", and mention the 5-minute cold start for the first request.

### F-13 [LOW] `@tailwindcss/postcss` is not the starter's current default

- **Status:** verified to work; differs from the live starter.
- **Evidence:** `create-next-app@16.4.6` with Turbopack (the default) installs `@tailwindcss/turbopack` and adds `turbopack.rules['*.css'].loaders` to `next.config.ts`; it deletes `postcss.config.mjs`. The official Tailwind Next.js guide still says `@tailwindcss/postcss` + `postcss.config.mjs`. The spine's tree lists `postcss.config.mjs`. A Turbopack `next build` with `@tailwindcss/postcss` emitted `.p-4{padding:calc(var(--spacing) * 4)}`, so the spine's choice works and matches Tailwind's docs. `postcss` is a direct dependency of `@tailwindcss/postcss`, so it needs no separate pin.
- **Fix:** none required; add a sentence "the starter uses `@tailwindcss/turbopack`; we use the documented PostCSS plugin" so a story author does not "fix" it.

### F-14 [LOW] Postgres CI service container version is unspecified; PGlite is PostgreSQL 18.7

- **Status:** unverifiable in the spine (no version named); the PGlite side is verified.
- **Evidence:** `show server_version` in PGlite 0.5.17 returns 18.7. AD-22's CI job says "a Postgres service container" without a tag. Parity between the embedded and deployed engine is the point of AD-2.
- **Fix:** name `postgres:18` in AD-22.

## Verification table

| # | Claim in spine | Result | Evidence |
| --- | --- | --- | --- |
| V-01 | All Stack versions are current | verified | `npm view` on 2026-11-21: next 16.4.6, react/react-dom 19.3.1, tailwindcss and @tailwindcss/postcss 4.3.5, pglite 0.5.17, postgres 4.1.1, drizzle-orm 0.45.4 (latest), drizzle-kit 0.31.11, zod 4.6.7, @anthropic-ai/sdk 1.12.0, vitest 5.1.1, @playwright/test 1.65.1, eslint 10.15.0, eslint-config-next 16.4.6, typescript-eslint 8.73.0, prettier 3.10.1, eslint-config-prettier 10.1.8, tsx 4.23.15, server-only 0.0.1, typescript latest 7.0.2 (pinned 6.0.3 on purpose). |
| V-02 | TS 6.0.3 with typescript-eslint 8.73.0 | verified | peer `typescript >=4.8.4 <6.1.0`; TS 6 has no 6.1; lint runs (F-11) |
| V-03 | TS 6.0.3 with Next 16.4.6 | verified | `next build` "Running TypeScript ... Finished" with 6.0.3; tsc clean |
| V-04 | eslint 10 with eslint-config-next 16.4.6 (flat) | verified with caveat | works at runtime; 3 plugins outside peer range (F-03); `eslint-config-next` peer is `eslint >=9` |
| V-05 | vitest 5.1.1 with Node >= 22.12 | verified | engines `^22.12.0 || ^24.0.0 || >=26.0.0`; ran green on 22.12.0 and 26.12.1; but see F-01, F-02 |
| V-06 | Tailwind 4 with Next 16 via `@tailwindcss/postcss` | verified | utilities in built CSS; F-13 |
| V-07 | `after()` is stable and works from a Server Action | verified | nextjs.org: stable since 15.1.0, allowed in "Server Functions", duration follows route `maxDuration`; test: `AFTER-RAN` logged under `next start` after a form POST |
| V-08 | `serverExternalPackages` | verified | top-level key since 15.0; PGlite works with and without it under Turbopack (pglite.dev suggests `transpilePackages` for Next; not needed server-side) |
| V-09 | `outputFileTracingIncludes` | verified | top-level, route-glob keys; trace contains `data/rulings/demo.json` (F-12) |
| V-10 | Server Actions as the mutation transport | verified | works in dev/start; "Missing `origin` header from a forwarded Server Actions request" warning appeared only because the test posted with curl |
| V-11 | Lint via eslint CLI because `next lint` is gone | verified | `npx next lint` is parsed as a project directory ("Invalid project directory ... lint"); `dist/cli` has no lint command |
| V-12 | PGlite 0.5.x in-process inside Next (dev, build, start) | verified, with F-04 | `next dev` + 2 HMR edits (client.ts, route.ts): 3 requests OK, singleton on `globalThis` held; `next build` OK (routes dynamic, no DB at build); `next start` OK; also on Node 22.12.0 |
| V-13 | `drizzle-orm/pglite`, `/pglite/migrator`, `/postgres-js`, `/postgres-js/migrator` | verified | package.json `exports` has all four; migrator ran on PGlite; postgres-js imports resolve; drizzle-kit generated `lower(email)` unique index, `jsonb`, `ON DELETE cascade`, `gen_random_uuid()` and the migration applied |
| V-14 | `FOR UPDATE` and `VACUUM FULL` on PGlite | verified | `select ... for update` in a transaction OK; `VACUUM FULL a, b` OK outside a transaction |
| V-15 | `--env-file-if-exists` in Node 22.12 | verified | added v22.9.0 (nodejs.org cli.html); ran on 22.12.0 via tsx |
| V-16 | scrypt N=2^17, r=8, p=1 needs raised `maxmem` | verified | default maxmem: `ERR_CRYPTO_INVALID_SCRYPT_PARAMS ... memory limit exceeded`; maxmem 134,217,728 and 134,217,729 also fail; 135,266,304 (129 MiB) works at about 180 ms. Say "128 MiB + 1 MiB or more", not "128 MiB" |
| V-17 | OWASP still recommends N=2^17, r=8, p=1 | verified | cheatsheetseries.owasp.org: "N=2^17 (128 MiB), r=8, p=1" listed first; scrypt is second after Argon2id. `node:crypto.argon2` exists only from Node 24.7.0 (`undefined` on 22.12), so scrypt is the right built-in for the Node 22 floor |
| V-18 | `tsx --conditions=react-server` and `server-only` | verified | plain tsx: `server-only` throws "cannot be imported from a Client Component module"; with the flag it loads; `--env-file-if-exists` also passes through tsx 4.23.15 (a missing file prints ".env.nope not found. Continuing without it." three times); the condition does not leak to spawned children (`next --version` child has empty execArgv). Note `react` under the condition has no `useState` or `createContext`, so `src/cli` must not import React |
| V-19 | Vercel Hobby 300 s with fluid compute | verified | docs "Duration limits" (last_updated 2026-08-24): Hobby default and max 300 s; fluid compute "enabled by default"; Hobby memory 2 GB |
| V-20 | Neon free tier exists | verified | neon.com/pricing, last updated 2026-11-04 (memlog marked this "assumed"); F-12 |
| V-21 | Model id `claude-haiku-5-5`; USD 0.10 / 0.50 per MTok | verified | platform.claude.com Haiku 5.5 page: "$0.10 / MTok for prompts up to 100,000 tokens; $0.50 / MTok over", output $0.50 / $2.50; released 2026-10-07; retirement not sooner than 2027-10-07; SDK 1.12.0 `Model` type includes it |
| V-22 | `output_config.format`, `effort`, no `temperature`, `stop_reason: "refusal"` | verified | structured-outputs doc: `output_config.format {type: json_schema}`, no beta header, `claude-haiku-5-5` listed; Haiku 5.5 page: "Omit `temperature`, `top_p`, and `top_k`", default effort `medium`; SDK `OutputConfig { effort, format }` and `StopReason` includes `'refusal'`; request option `signal?: AbortSignal` exists. Schema limits in F-09 |
| V-23 | `iesl/protoqa-data` file, CC-BY-4.0 | verified, count contradicted | F-05 |
| V-24 | `@axe-core/playwright` exists | verified | 4.14.0, peer `playwright-core >= 1.0.0`, engines `>=22.12.0` |
| V-25 | Node 26 is an LTS | verified | nodejs.org dist index: v26.13.1 "Lithium"; release schedule: LTS from 2026-10-28; v22 "Jod" and v24 "Krypton" also LTS |
| V-26 | Hosted Postgres reached through postgres.js | verified | postgres 4.1.1 latest (Unlicense, Node >=18); drizzle-orm peer `postgres >=3`; connected through pglite-server with `max: 1` (F-08) |

## Unverifiable here

1. A live Vercel deployment and a live Neon connection (docs checked only; the spine already marks the pilot as cuttable).
2. Real token counts and latency for the Judge (no key; F-09).
3. Windows behaviour of `npm run demo` and PGlite file paths (AD-19 claims cross-platform; only macOS and Linux were run).

## Reproduction

Scratch projects in the session scratchpad: `resolve2/` (full stack + test app), `n2212/` (Docker Node 22.12.0 run), `pq/` (ProtoQA file), `cna/` (unpacked `create-next-app@16.4.6`). Nothing under the repo was changed except this file.
