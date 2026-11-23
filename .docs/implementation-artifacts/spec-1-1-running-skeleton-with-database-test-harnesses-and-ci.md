---
title: 'Story 1.1: Running skeleton with database, test harnesses and CI'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_revision: 'c0cc75075967284f196f048807c96a382950f7d1'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md'
warnings: [oversized]
deferred:
  - summary: >-
      npm run db:migrate (migrateFromEnv) has no automated test, and its postgres branch has never run against a real Postgres.
    evidence: |-
      Verification-gap review: no test or CI step invokes migrateFromEnv or src/cli/db-migrate.ts; only a manual run against pglite (.data/local, exit 0) exists. The postgres branch needs a Postgres service, which this story's scope rules out.
    location: >-
      src/server/db/migrate.ts:19
    severity: medium
  - summary: >-
      The GitHub Actions workflow has never run on GitHub, so "the run is green" (AC6) is unobserved.
    evidence: |-
      Intent-alignment audit: only the workflow file exists; nothing is pushed (the user forbids pushing). Locally every CI step passes on Node 26 (and tests/e2e on Node 22). Settle by pushing epic-1-fundament and watching the Node 22 and 26 jobs; the drizzle drift step needs drizzle/ committed, which this run does.
    location: >-
      .github/workflows/ci.yml
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The repo holds only planning docs; there is no app, database client, lint, tests or CI, so no later story can add behaviour without first building plumbing.

**Approach:** Hand-build (no `create-next-app`, which refuses a non-empty dir) the Next.js 16.4.6 App Router skeleton at the repo root with the Stack's exact pins, the AD-2 DB client with auto-migration for `pglite://`, zod env (AD-21), ESLint layer zones (AD-1), Vitest and Playwright harnesses with network guards, and a GitHub Actions CI on Node 22 and 26 (AD-22). Story 1.1's six ACs in `epics.md` are the contract.

## Boundaries & Constraints

**Always:**
- Every package in the spine's Stack table is in `package.json` at the exact version (no `^`/`~`), even if first used later. `engines.node` `>=22.13`, `.nvmrc` = `22`.
- `<html lang="nb">`; no `next/font/google`; no `@types/node ^20`.
- Every `src/server/**` file starts with `import 'server-only'`.
- Only `src/server/db/client.ts` picks a driver; drivers are `await import()`ed; one handle promise cached on `globalThis`; PGlite data dir `mkdir -p`'d; postgres.js gets `prepare: false`; error messages never echo `DATABASE_URL` (may hold a password).
- Env read only via `src/server/env.ts`; empty string = unset; invalid env throws an error naming keys only, never values.
- `src/server/log.ts` copies only `module`, `op`, `code`, `sqlstate` from its argument (extra fields dropped at runtime, not just by type).
- Health route: `await connection()` before any DB access; `GET` only; 200 `{ status: 'ok' }`; DB failure → logged via `log.ts`, 503 `{ status: 'error' }`, no message leaked.
- Lint, format and typecheck ignore `_bmad .claude wiki .docs prompting scripts drizzle .idea .next .data .logs`, root `*.md`, `package-lock.json`, `next-env.d.ts`, `test-results`, `playwright-report`.
- Tests pass with no network and no key. Test titles carry the requirement ID they prove.

**Never:**
- No tables in `schema.ts` (Story 1.1 needs none; Story 1.3 adds `host`, `session`).
- No stub scripts for `demo`, `judge:eval`, `judge:record`, no CI demo smoke step or Postgres-service job (those features do not exist yet; their stories add them).
- No `not-found.tsx`/`error.tsx`/`global-error.tsx`, fonts, tokens or UI components (Story 1.2/1.3).
- No `@anthropic-ai/sdk`; no Vercel project or deploy; no edits to `_bmad/config.toml`, `wiki/`, `prompting/`, `scripts/`, `.logs/`.
- No `../` relative imports in `src`/`tests` (keeps lint zones alias-only).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| URL unset / empty | `DATABASE_URL` undefined or `''` | PGlite at `<cwd>/.data/local` | — |
| URL dir | `pglite://tmp/a/b` or `pglite:///abs/a/b` | PGlite at resolved dir, created recursively, migrated | — |
| URL memory | `pglite://:memory:` | in-memory PGlite, migrated | — |
| URL postgres | `postgres://…` / `postgresql://…` | postgres.js, `options.prepare === false`, not auto-migrated, no connection until first query | — |
| URL bad | `mysql://x`, `pglite://` | throws | message names allowed schemes, not the URL |
| Env defaults | empty source | `PORT 3000`, `APP_BASE_URL http://localhost:3000`, `JUDGE_PROVIDER replay`, `JUDGE_MODEL deepseek/deepseek-v4.1-flash` | — |
| Env key set | `OPENROUTER_API_KEY=k`, no provider | `JUDGE_PROVIDER openrouter` | — |
| Env invalid | `PORT=abc`, `JUDGE_PROVIDER=x`, `DEMO_MODE=yes` | throws | message lists key names only |
| Log extra fields | `log({module, op, code, message:'secret'})` | output lacks `secret` | — |
| Network in Vitest | `fetch('https://example.com')` | rejects ("network blocked") | — |
| Network in browser | page fetches non-localhost | aborted | — |

</intent-contract>

## Code Map

Greenfield: no app code exists. Verified in a scratch install (2026-11-22):
- All Stack pins exist on npm. `next@16.4.6` has `agentRules?: boolean` (`next/dist/server/config-shared.d.ts:1753`; disables `next dev` writing `AGENTS.md`), `connection()` from `next/server`, and `next typegen` (writes `next-env.d.ts`, which `.gitignore` already ignores, so `typecheck` must run it first).
- `drizzle-kit generate` on an empty schema writes `drizzle/meta/_journal.json` (`entries: []`); `drizzle-kit check` passes; `drizzle-orm/pglite/migrator` accepts the empty journal. So "zero migrations" = commit that journal.
- `eslint-config-next@16.4.6` exports flat configs `eslint-config-next/core-web-vitals` and `/typescript` (`Linter.Config[]`).
- A `net.Socket.prototype.connect` patch in a Vitest setup file makes `fetch` to a non-local host reject.
- `server-only` exports `react-server` → `empty.js`, default → throwing `index.js`; alias the absolute path of `node_modules/server-only/empty.js` in Vitest.
- npm 11 blocks esbuild postinstall (`allowScripts`); esbuild still works via its optional platform package.
- Latest `actions/checkout` v7, `actions/setup-node` v7.
- Existing files to extend, not replace: `.gitignore` (has `.env*`, `.next/`, `node_modules/`; lacks `.data/`), `README.md` (Norwegian).
- Spine Style row (`ARCHITECTURE-SPINE.md` Consistency Conventions) lists the ignore set without `.logs`; amend it in the same change.

## Tasks & Acceptance

**Execution:**
- `package.json` -- name `toppsvar`, private, `"type": "module"`, engines, exact Stack pins, scripts `dev build start lint format format:check typecheck test test:e2e db:generate db:migrate` (`typecheck` = `next typegen && tsc --noEmit`; `db:migrate` = `tsx --conditions=react-server --env-file-if-exists=.env.local src/cli/db-migrate.ts`) -- AC1, Conventions
- `.nvmrc`, `tsconfig.json` (strict, `@/*`→`src/*`, include `src tests *.ts *.mjs next-env.d.ts .next/types`), `next.config.ts` (`serverExternalPackages: ['@electric-sql/pglite']`, `outputFileTracingIncludes` `data/rulings/**`, `agentRules: false`), `postcss.config.mjs` -- AC1, AC6, AD-24
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` (`@import "tailwindcss";`) -- minimal `/` with `lang="nb"`, title Toppsvar -- AC1
- `src/app/api/health/route.ts` + `src/server/health.ts` (`checkDatabase()` runs `select 1` via `getDb`) -- AC1, AC2
- `src/server/env.ts` -- `envSchema`, `parseEnv(source)`, `env` -- AC4
- `src/server/log.ts` -- `log(entry)` writing one JSON line to stderr from the four fields -- AC5
- `src/server/db/schema.ts` (empty), `client.ts` (`parseDatabaseUrl`, `openDb`, `getDb`, `closeDb`, `Db`, `Tx`), `migrate.ts` (`migrateDb(handle)` for either driver), `src/cli/db-migrate.ts`, `drizzle.config.ts`, `drizzle/meta/_journal.json` -- AC2, AC3
- `.env.example` (nine keys), `.gitignore` (+`.data/`) -- AC4
- `eslint.config.mjs` (next core-web-vitals + typescript + prettier; `no-console` except `src/server/log.ts`; `no-restricted-imports` zones: everywhere no `../*`; app/components no `@/server/db*`, `@/server/judge*`; lib no `@/server*`, `@/app*`, `@/components*`, `@/cli*`; module order `auth < games < questions < grouping < collection < review < play`, each barred from later ones; db and judge barred from modules; cli only `@/server/db/migrate` from db; providers only inside judge), `.prettierrc`, `.prettierignore` -- AC5
- `vitest.config.ts` (`@` alias, `server-only` alias, `test.env` `DATABASE_URL=pglite://:memory:`, `JUDGE_PROVIDER=mock`, `OPENROUTER_API_KEY=''`, setup `tests/setup.ts`), `tests/setup.ts` (socket guard + `afterAll(closeDb)`) -- AC5
- `playwright.config.ts` (chromium; webServer `npm run build && npm run start` on port 3100, env `DATABASE_URL=pglite://<tmp>/db`, `JUDGE_PROVIDER=replay`, empty key, telemetry off; `E2E_DB_DIR` shared via `process.env`), `tests/e2e/fixtures.ts` (context routes abort non-localhost), `tests/e2e/smoke.spec.ts` -- AC1, AC2, AC5
- Tests: `tests/unit/log.test.ts`, `tests/unit/lint-zones.test.ts` (ESLint API `lintText` table), `tests/unit/guards.test.ts`, `tests/unit/trace.test.ts`, `tests/integration/env.test.ts`, `tests/integration/db.test.ts` -- I/O matrix + AC2–AC6
- `tests/TRACE.md` -- one `## FR-n` heading per Stage 1 FR plus this story's NFR rows -- AC6
- `.github/workflows/ci.yml`, `.github/pull_request_template.md` -- AC6
- `README.md` -- short Norwegian "Utvikling" section with the scripts CI runs -- AD-22 (CI runs README scripts)
- `ARCHITECTURE-SPINE.md` -- add `.logs` to the Style ignore list -- spine discipline

**Acceptance Criteria:**
- Given a fresh clone, when `npm install && npm run dev`, then `/` renders `<html lang="nb">` and `GET /api/health` returns 200 (checked manually by curl, and by e2e on `next start`).
- Given the e2e server just started, when no request has hit the DB yet, then the temp DB dir does not exist; after `GET /api/health` it does (build and start never open the DB).
- Given `src/app/x.ts` importing `@/server/db`, when linted, then ESLint reports `no-restricted-imports`.
- Given CI on Node 22 and 26, when run with no key, then lint, `format:check`, `typecheck`, `drizzle-kit check`, `npm test`, Playwright install and `test:e2e` all pass (locally verified on Node 26).

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 53 findings — high 0, medium 10, low 32, false 10, maybe-false 1
- findings:
  - `[false]` `[reject]` Blind Hunter: CI/README call `npx drizzle-kit check` and `npx playwright install` instead of listed script names; `demo`/`judge:*` scripts missing — AC6 names exactly these commands, the delivery-notes README contract says `npx playwright install chromium`, and adding a `db:check` script would itself break the fourteen-name rule; the missing scripts belong to the stories that build demo and Judge.
  - `[low]` `[patch]` Blind Hunter: `drizzle-kit check` does not catch a schema change without a generated migration — added CI steps `npm run db:generate` + fail if `git status --porcelain -- drizzle` is non-empty.
  - `[low]` `[patch]` Blind Hunter: README says PGlite migrates "ved oppstart", but it migrates lazily on first DB use; no reset hint — reworded to "første gang appen bruker databasen", added restart/stop/reset line.
  - `[low]` `[patch]` Blind Hunter: TRACE.md NFR-2 claims "connecting lazily and never auto-migrating", not asserted — TRACE row and test title/comment reworded to what is proven (`prepare: false`, opening does not throw under the network guard).
  - `[medium]` `[patch]` Blind Hunter: untested behaviour — failed open retry, cause-chain SQLSTATE, `db:migrate`, close-on-migration-failure — added `tests/integration/db-open-retry.test.ts` and cause/errno cases in `db.test.ts`; `db:migrate` part deferred (see verification-gap row); close-on-migration-failure not tested (straight-line `try/catch`, hard to provoke, low value).
  - `[low]` `[patch]` Blind Hunter: `sqlstateOf` matches five-letter Node errno codes (EPIPE) — now rejects `^E[A-Z]{4}$` (no Postgres SQLSTATE class starts with E). Suggestion to move it next to `log.ts` rejected: only one caller today; the AD-17 error-boundary story moves it when a second caller appears.
  - `[low]` `[patch]` Blind Hunter: lint zones let `src/server/**` import `@/app`/`@/components` — `NO_UI` ban added to every server zone with a test. Suggestion to ban `node:*` in `src/lib` rejected as false: `src/lib/token` and `shuffle` need `node:crypto` (AD-7, AD-9).
  - `[medium]` `[patch]` Blind Hunter: CI `retries: 1` makes a retried first smoke test always fail on the existing DB dir — `retries: 0`. Temp-dir cleanup and preset `E2E_DB_DIR` rejected (low, rare, OS cleans tmp).
  - `[medium]` `[patch]` Blind Hunter: e2e (`next start` loads `.env.local`) and Vitest inherit local `DEMO_MODE`/`REGISTRATION_CODE`/`CRON_SECRET` — all nine keys now set explicitly in both configs (verified @next/env never overrides a key already in `process.env`, even `""`).
  - `[low]` `[patch]` Blind Hunter: CI lacks `permissions`, artifact upload, browser cache, concurrency, Node 24 — added `permissions: contents: read`; the rest rejected (convenience only; Node 24 is not in the AD-22 matrix of 22 and 26).
  - `[false]` `[reject]` Blind Hunter: font, axe and `data/rulings` tracing added before use — AC1 requires `package.json` to pin every Stack version and AD-24 requires the tracing include.
  - `[low]` `[reject]` Blind Hunter: `DATABASE_URL` default defined in both `env.ts` and `parseDatabaseUrl` — both encode the one AD-2 default and are tested; removing one only moves code.
  - `[low]` `[reject]` Blind Hunter: `client.ts` ↔ `migrate.ts` import cycle — one side is a dynamic import and ESM handles it; no failure shown.
  - `[false]` `[reject]` Blind Hunter: PR template lacks prompting/sync-brief items — the delivery notes fix the template at three questions, which it asks.
  - `[false]` `[reject]` Blind Hunter: trace test checks only headings — that is exactly AD-22's rule ("a unit test checks that every Stage 1 FR appears").
  - `[low]` `[patch]` Blind Hunter: `APP_BASE_URL` accepts any scheme; `CRON_SECRET` has no minimum length — `APP_BASE_URL` limited to http/https with a test; `CRON_SECRET` length rejected (policy for Story 1.5's purge route, not set by the spine).
  - `[low]` `[reject]` Edge Case Hunter: cyclic `cause` chain loops `sqlstateOf` forever — drivers never build cyclic causes; a guard adds a branch for an unseen case.
  - `[low]` `[patch]` Edge Case Hunter: Node errno logged as SQLSTATE — same fix as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: health hangs if Postgres stalls — postgres.js `connect_timeout` (30 s) bounds it; a race timer adds code for the pilot only.
  - `[low]` `[reject]` Edge Case Hunter: `closeDb` while a `getDb` caller awaits returns a closed db — `closeDb` is only called by tests and the CLI after all work.
  - `[low]` `[reject]` Edge Case Hunter: reopening a dir while the previous PGlite still closes — same: test/CLI only, tests use `:memory:`.
  - `[low]` `[patch]` Edge Case Hunter: dev keeps a stale handle after a new migration — README now says to restart dev after `db:generate`.
  - `[low]` `[patch]` Edge Case Hunter: `db:migrate` and `dev` opening one PGlite dir — README now says to stop dev first (spine rule: one process per directory).
  - `[false]` `[reject]` Edge Case Hunter: `db:migrate` reads only `.env.local`, not `.env` — AD-21 prescribes exactly `--env-file-if-exists=.env.local`.
  - `[false]` `[reject]` Edge Case Hunter: `DEMO_MODE=0` fails startup — it fails loudly with "Invalid environment variables: DEMO_MODE"; AD-21 defines only `1` and empty.
  - `[low]` `[reject]` Edge Case Hunter: `JUDGE_PROVIDER=openrouter` without a key passes env parsing — no Judge exists yet; the Judge story owns provider validation (AD-13).
  - `[low]` `[patch]` Edge Case Hunter: `APP_BASE_URL` scheme/trailing slash — scheme fixed (see above); trailing slash rejected, nothing builds URLs yet.
  - `[low]` `[reject]` Edge Case Hunter: whitespace or uppercase scheme in `DATABASE_URL` — uppercase fails loudly; whitespace is a config typo with no named caller.
  - `[low]` `[patch]` Edge Case Hunter: `connect("5432", host)` bypasses the network guard — numeric strings now treated as ports and the host checked.
  - `[low]` `[reject]` Edge Case Hunter: dgram/DNS not guarded — nothing in the stack uses UDP; DNS lookups leak no data and tests run offline in CI anyway.
  - `[medium]` `[patch]` Edge Case Hunter: `env.test.ts` uses `git check-ignore`, which fails outside a git repo (the hand-in zip) — now reads `.gitignore` directly.
  - `[medium]` `[patch]` Edge Case Hunter: CI retry of the smoke test always fails — same fix as Blind Hunter (`retries: 0`).
  - `[low]` `[reject]` Edge Case Hunter: preset existing `E2E_DB_DIR` — only if a developer sets it by hand.
  - `[low]` `[reject]` Edge Case Hunter: mkdtemp dirs pile up — a few empty dirs in the OS temp dir.
  - `[low]` `[patch]` Edge Case Hunter: `./../x` bypasses the parent-import ban — regex now `(^|/)\.\.(/|$)` with a test.
  - `[low]` `[reject]` Edge Case Hunter: `src/server/health.ts` could import `./judge/providers/x` relatively — contrived, visible in review; the alias ban covers the normal form.
  - `[low]` `[patch]` Edge Case Hunter: files directly under `src/` are unzoned — `src/*.{ts,tsx}` added to the app zone with a test.
  - `[low]` `[patch]` Edge Case Hunter (claim): "everywhere no ../*" not met for `./../x` — same fix as above.
  - `[low]` `[reject]` Edge Case Hunter (claim): "providers only inside judge" not met for relative paths — unzoned part fixed with `src/*`; relative-path part rejected as above.
  - `[medium]` `[patch]` Edge Case Hunter (claim): AC "DB dir absent before first request" unreliable under CI retries — same fix (`retries: 0`).
  - `[medium]` `[patch]` Verification gap: `sqlstateOf` cause walk never exercised (drizzle wraps errors as `DrizzleQueryError` with `.cause`) — added cause-only and errno cases to `db.test.ts`.
  - `[medium]` `[patch]` Verification gap: failed open not proven to be uncached — added `tests/integration/db-open-retry.test.ts`.
  - `[medium]` `[defer]` Verification gap: `db:migrate`/`migrateFromEnv` has no automated test — needs a Postgres service, out of this story's scope; deferred (manual pglite run exits 0).
  - `[low]` `[patch]` Verification gap (other): errno codes logged as SQLSTATE — same fix as above.
  - `[medium]` `[patch]` Verification gap (other): CI retry always fails the first smoke test — same fix (`retries: 0`).
  - `[false]` `[reject]` Intent audit: `npm run dev` is not exercised by an automated test — AD-22 puts e2e on `next build && next start`; dev was checked by hand in this run (`lang="nb"`, health 200, POST 405, no `AGENTS.md`).
  - `[false]` `[reject]` Intent audit: first health call creates the PGlite dir and migration table ("side effects") — opening the DB on first use is required by AC2/AC3; the route changes no application data.
  - `[false]` `[reject]` Intent audit: migrations run on first DB open, not at dev/setup start — no query can run before migration, so the difference is unobservable, and lazy opening is what keeps `next build` DB-free (AC2).
  - `[maybe-false]` `[defer]` Intent audit: AC6 "the run is green" has no observed GitHub run — settle by pushing the branch; deferred as medium (unverified).
  - `[false]` `[reject]` Intent audit: pulled-in spine items (tracing include, derived `JUDGE_PROVIDER`, TRACE test) — AD-24, AC4 ("the nine AD-21 variables with their defaults", where the default is "derived (AD-13)") and AC6/AD-22 require them.
  - `[low]` `[reject]` Intent audit: dynamic driver import not tested — would need bundle inspection; the code is a plain `await import()`.
  - `[low]` `[reject]` Intent audit: "fresh DB per integration file" not asserted — `afterAll(closeDb)` in setup plus Vitest per-file isolation.
  - `[low]` `[reject]` Intent audit: pins and starter removal checked only by inspection — visible in `package.json` and `layout.tsx`; a test would restate the file.

### AI suggestions corrected or rejected (grading evidence)

- **Spec author (orchestrator) corrected the implementer** with 11 review patches: a zip-breaking `git check-ignore` test, a socket guard bypass, a CI retry that could never pass, local `.env.local` values leaking into e2e, lint-zone escapes, and an overclaiming TRACE row.
- **Reviewer suggestions rejected:** Node 24 in the matrix, a `db:check` script, `CRON_SECRET` minimum length, a cycle guard in `sqlstateOf`, banning `node:*` in `src/lib`, a timeout race on the health check, and extra PR-template items. Each one either contradicts the spine or adds code for a case nobody can reach (reasons above).
- **Implementer departure accepted:** `db:generate` runs `node --conditions=react-server node_modules/drizzle-kit/bin.cjs generate`, because plain `drizzle-kit` loads `schema.ts`, whose `import 'server-only'` throws.

## Design Notes

- **Linear module order.** The spine draws tiers (`auth · games · questions → grouping → collection · review → play`) but also has `questions` calling `games.lockForMutation`, so the order is read as linear in listed order. That is stricter than tiers for `collection`/`review` and never blocks a call the spine names.
- **Lazy DB open + migrate.** Auto-migration happens on first `getDb()` for `pglite://`, not at process start. That keeps `next build` DB-free (AC2) and covers dev, `next start` (e2e) and tests with one code path.
- **`src/server/health.ts`.** The app may not import `src/server/db`, and no domain module exists yet, so the health read lives in a top-level server file beside `env.ts` and `log.ts`.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npx drizzle-kit check` -- expected: "Everything's fine"
- `npm test` -- expected: all unit + integration pass offline
- `npx playwright install chromium && npm run test:e2e` -- expected: smoke spec passes
- `npm run db:migrate` -- expected: exit 0 against `.data/local`

**Manual checks:**
- `npm run dev`, then `curl -s localhost:3000/` contains `lang="nb"` and `curl -i localhost:3000/api/health` is 200; no `AGENTS.md` is created.

## Auto Run Result

Status: done

**Summary.** Next.js 16.4.6 App Router skeleton at the repo root with every Stack pin, the AD-2 DB client (PGlite on disk or in memory, or postgres.js with `prepare: false`, chosen by `DATABASE_URL`, dynamically imported, cached on `globalThis`, PGlite auto-migrated on first open), committed zero-migration journal, zod env for the nine AD-21 variables, a log line limited to the four allowed fields, a DB-reading `GET /api/health` behind `await connection()`, ESLint layer zones and module order, Vitest and Playwright harnesses with network guards, CI on Node 22 and 26, a PR template and `tests/TRACE.md`. PGlite in-process works under both `next dev` and `next start`, so the AD-2 fallback was not needed.

**Files.**
- `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`: app and toolchain with exact pins.
- `src/app/layout.tsx`, `page.tsx`, `globals.css`: minimal `/` with `lang="nb"`.
- `src/app/api/health/route.ts`, `src/server/health.ts`: health check, 503 plus SQLSTATE-only log on failure.
- `src/server/env.ts`, `src/server/log.ts`: config and logging boundary.
- `src/server/db/{schema,client,migrate}.ts`, `src/cli/db-migrate.ts`, `drizzle.config.ts`, `drizzle/meta/_journal.json`: DB layer and migrations.
- `eslint.config.mjs`, `.prettierrc`, `.prettierignore`: lint/format with the Conventions ignore list (+ `.logs`, root `*.md`).
- `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`, `tests/e2e/*`, `tests/unit/*`, `tests/integration/*`, `tests/TRACE.md`: harnesses and tests.
- `.github/workflows/ci.yml`, `.github/pull_request_template.md`: CI and PR template.
- `.env.example`, `.gitignore` (+`.data/`), `README.md` (Utvikling section): config template and docs.
- `ARCHITECTURE-SPINE.md`: `.logs` added to the Style ignore list (spine discipline).

**Review.** 53 findings (high 0, medium 10, low 32, false 10, maybe-false 1). Patched: 21 rows (10 medium, 11 low entries, grouped into 11 fixes). Deferred: 2 (the `db:migrate` postgres path has no automated test; the CI run on GitHub has not been observed). Rejected: 30, each with its reason in the triage log.

**Follow-up review recommended: true.** Patched entries by verdict: medium 10, low 11. The specific unverified risk is that the patched CI workflow (`permissions`, the `db:generate` drift check) has run only locally, never on GitHub.

**Verification (after patches, Node 26.12):** `npm run lint` clean; `format:check` clean; `typecheck` clean; `npx drizzle-kit check` "Everything's fine"; `npm test` 94/94 in 7 files; `npm run test:e2e` 3/3; `npm run db:migrate` exit 0. Manually: `next dev` serves `/` with `lang="nb"`, `/api/health` 200, POST 405, no `AGENTS.md` written. Before the patches the implementer also ran `npm test` and e2e on Node 22.23 (green).

**Residual risks.** CI has not run on GitHub yet. npm 11 warns that esbuild's install script is not allow-listed (harmless). Running `db:migrate` while `dev` holds `.data/local` is forbidden by the spine and documented, not enforced.
