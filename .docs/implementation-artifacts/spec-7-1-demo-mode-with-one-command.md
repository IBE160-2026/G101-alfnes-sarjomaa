---
title: 'Story 7.1: Demo mode with one command'
type: 'feature'
created: '2026-11-23'
baseline_revision: '943a3a91903696b52e614d4e6ec145d5a4908458'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The examiner must see what the Judge does without any key, account or network, from `git clone`, `npm install`, `npm run demo` (FR-31, NFR-1, UJ-5). No `demo` script, demo seed, demo rulings or Demo mode surfaces exist yet; `data/rulings/` is empty.

**Approach:** `npm run demo` runs `src/cli/demo.ts` through `tsx`: it recreates `.data/demo`, migrates, seeds an invented demo Host and one demo Game in *collecting* through module entry points, and starts `next dev` with replay and `DEMO_MODE=1`. A hand-written `data/rulings/demo.json` covers every demo Answer, so close takes the normal Grouping path and Review shows Judge Groups. Landing, login and every Host page show the Demo mode surfaces from one `src/lib` constant.

## Boundaries & Constraints

**Always:**
- No shell syntax in the `demo` script (AD-19); the child is spawned as `process.execPath` + Next's bin, so it runs on Windows too.
- `DATABASE_URL=pglite://.data/demo`, `JUDGE_PROVIDER=replay`, `DEMO_MODE=1`, `APP_BASE_URL=http://localhost:${PORT}` are set before any server module loads (`env.ts` parses on import).
- Only `.data/demo` is ever deleted, a fixed path; no environment value can widen the delete.
- Seed only through module entry points (`auth`, `games`, `questions`, `collection`); no raw SQL in the seed.
- Every Question, Answer, title and credential is invented, Norwegian, holds no real name and nothing from `.idea/` (§6.1). The demo login is `demo@toppsvar.test` on the reserved `.test` domain.
- The demo credentials reach the browser only when `DEMO_MODE=1` (passed from the server page, never imported by a client component).
- Ponytail at `full` and impeccable (Operate mode, DESIGN.md/EXPERIENCE.md win): Notice anatomy is a bold first phrase, then body text; WCAG 2.1 AA kept.

**Never:**
- No live `judge:record` run (no key here); the ruling file is hand-written in the exact AD-14 shape and the spec says so.
- No network in the demo, the tests or CI; no new dependency; no change to Review or Grouping logic.
- No README edit (Story 7.4), no `wiki/`, `.logs/` or `.claude/skills/excalidraw-diagram/` change.
- No new environment variable; no option on the demo command.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh run | `npm run demo`, `PORT` unset | `.data/demo` recreated, seeded, demo URL and login printed, `next dev` on 3000 | — |
| Custom port | `PORT=3101` (the e2e demo server) | `next dev` on 3101 with `APP_BASE_URL=http://localhost:3101`; the demo spec runs there | Invalid `PORT` fails on `env.ts` validation naming `PORT` |
| Close the demo Game | 6 seeded Answer sets, replay | every Question `source = replay`, `uncovered_items = 0`, `fell_back = false`; Review has no fallback Notice | — |
| Normal server | `DEMO_MODE` empty | no demo login on `/` or `/logg-inn`, no band | — |

</intent-contract>

## Code Map

- `package.json` -- add `"demo": "tsx --conditions=react-server --env-file-if-exists=.env.local src/cli/demo.ts"` (AD-21 CLI form, like `db:migrate`).
- `src/server/env.ts` -- `env` is parsed once on import; `APP_BASE_URL` defaults from `PORT`; `DEMO_MODE` becomes a boolean.
- `src/server/db/migrate.ts:migrateFromEnv` -- opens (PGlite migrates on open) and closes its own handle; the CLI may import only this from `@/server/db` (`eslint.config.mjs` CLI zone, asserted in `tests/unit/lint-zones.test.ts:37`).
- `src/server/db/client.ts:closeDb` -- the seed must release the PGlite directory before `next dev` opens it; the CLI cannot import it, so `src/server/demo.ts` wraps it.
- `src/server/auth/index.ts:register` -- needs `cookies()`, so it cannot run outside a request; a session-less `createHost` reuses `registrationSchema`, `hashPassword` and the `host` insert.
- `src/server/games/index.ts:create`, `src/server/questions/index.ts:save` (client UUID `questionId`), `src/server/collection/index.ts:createInviteLinks` (returns full links, Token after `#`), `collection.submit(gameId, token, { editSecret, answers })` (`newToken()` from `src/lib/token.ts` is a valid edit secret), `collection.close(hostId, { gameId })`, `src/server/grouping/index.ts:run(gameId)`.
- `src/server/judge/providers/replay.ts` -- rulings are `{ kind, promptVersion, normalizeVersion, model, question, items, assignments }`; items sorted (code-unit), distinct, normalised (`src/lib/normalize.ts`, `NORMALIZE_VERSION = 1`); matched by `normalize(question)`.
- `src/server/judge/record.ts:FIXTURES` -- already allows `data/rulings/demo.json`; `next.config.ts` already traces `data/rulings/**`. Prettier checks `data/` (not in `.prettierignore`).
- `src/lib/review.ts:fallbackNotice`, `src/app/spill/[id]/page.tsx:135` -- already Demo-aware; no change.
- `src/app/page.tsx` (static today), `src/app/logg-inn/page.tsx`, `src/components/AccountForm.tsx` (controlled email, uncontrolled password), `src/components/HostChrome.tsx` (`data-host-chrome` hides chrome under the play stage), `src/app/spill/layout.tsx`, `src/components/Notice.tsx`, `src/components/Button.tsx` (`secondary` variant).
- `playwright.config.ts` -- second webServer is `npm run dev` on 3101 for `server-output.spec.ts`; Next 16's `lockDistDir` allows one `next dev` per repo, so a separate demo server cannot run beside it.
- `tests/e2e/fixtures.ts` -- `test`, `expect`, `localOnly`, `seriousViolations`; `tests/e2e/server-output.spec.ts` shows the slow-dev-server pattern.
- `tests/integration/grouping.test.ts` -- pattern for reading `grouping_result`; `env` is a mutable object tests override and restore.
- `tests/TRACE.md` (FR-31, NFR-1 rows), `tests/manual/checklist.md` (prettier-formatted tables), `.github/workflows/ci.yml`.

## Tasks & Acceptance

**Execution:**
- `src/lib/demo.ts` -- new: `DEMO_HOST = { email: "demo@toppsvar.test", password: "demo-passord" }` -- the one credentials constant (AD-19).
- `src/server/auth/index.ts` -- add `createHost(input): Promise<{ hostId }>`: validate with `registrationSchema`, hash, insert, no session or cookie -- seed through a module entry point outside a request.
- `src/server/demo.ts` -- new: the invented demo Game (title, three Norwegian Questions, six Answer sets), `seed()` (createHost, games.create, questions.save ×3, createInviteLinks 8, submit 6) returning `{ hostId, gameId, questionIds }`, and `seedAndClose()` that closes the DB afterwards -- shared by the CLI and the integration test.
- `src/cli/demo.ts` -- new: set the four env values, dynamic-import the server modules, `rm .data/demo`, `migrateFromEnv()`, `seedAndClose()`, print URL and login, spawn `next dev` with inherited stdio, forward SIGINT/SIGTERM, exit with the child's code.
- `data/rulings/demo.json` -- new, hand-written: one partition per demo Question over its sorted distinct normalised Answers, every item covered; `model: "hand-written"`, `promptVersion: "hand-written"` so nothing claims a model made it; prettier-formatted.
- `package.json` -- add the `demo` script.
- `src/app/page.tsx` -- `await connection()`; in Demo mode an info Notice with the demo login under the intro.
- `src/app/logg-inn/page.tsx`, `src/components/AccountForm.tsx` -- pass `demo={env.DEMO_MODE ? DEMO_HOST : undefined}`; AccountForm shows an info Notice with the login and a `secondary` button "Fyll inn demobrukeren" that fills email and password.
- `src/components/HostChrome.tsx`, `src/app/spill/layout.tsx` -- `demo` prop; a thin `primary-soft` band under the header: "**Demomodus:** alt innhold er oppdiktet, og dommeren bruker lagrede avgjørelser.", marked `data-host-chrome`.
- `tests/integration/demo-replay.test.ts` -- new: seed, then `close` and `grouping.run` with `env.JUDGE_PROVIDER = "replay"` and `fetch` spied; every `grouping_result` row `source = replay`, `uncovered_items = 0`, `fell_back = false`, Game *in_review*, `fetch` never called; seeded Game is *collecting* with six sets and the Host has the demo email.
- `tests/e2e/demo.spec.ts` -- new, on the demo server (3101): AC3 flow plus band on `/spill`, the Game page and Review; on the normal server (3100) `/` and `/logg-inn` show no demo login.
- `playwright.config.ts` -- the 3101 server becomes `npm run demo` (same port, `dev.log` capture), serving `server-output.spec.ts` and `demo.spec.ts`.
- `.github/workflows/ci.yml` -- demo smoke step: start `npm run demo` in the background, poll `/api/health` until 200 (fail with the log after 120 s), stop it.
- `tests/TRACE.md` -- FR-31 and NFR-1 rows; `tests/manual/checklist.md` -- demo-content row (AC4).
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- *Amended in Story 7.1* notes on AD-14 (hand-written demo ruling), AD-19 (`auth.createHost`, `src/server/demo.ts`) and AD-22 (3101 runs `npm run demo`).

**Acceptance Criteria:**
- Given a fresh clone after `npm install`, when `npm run demo` runs, then it recreates `.data/demo`, migrates, seeds the demo Host and Game, prints the URL and login, and `GET /api/health` answers 200; CI does the same in the background and stops it.
- Given the demo seed and `data/rulings/demo.json`, when `demo-replay.test.ts` closes the demo Game, then every Question has `source = replay`, `uncovered_items = 0` and no fallback, with no network call.
- Given the app in Demo mode, when `demo.spec.ts` opens `/` and `/logg-inn`, clicks "Fyll inn demobrukeren", logs in, closes the demo Game and opens Review, then both pages show the demo login, every Host page shows the band sentence, and Review shows Judge Groups with no fallback Notice and no "Manuell".
- Given the demo content, when reviewed before merge, then it is invented and none derives from `.idea/`; this is a row in `tests/manual/checklist.md`.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 26 findings — high 0, medium 3, low 19, false 4, maybe-false 0
- findings:
  - `low` `patch` (verification-gap) No test shows the Demo band is hidden under the play stage; `play.spec.ts` checks only `role=banner` on the non-demo server — `demo.spec.ts` now marks all three Questions, locks the Board, starts play with the default Teams and asserts the band is hidden once `[data-stage]` shows.
  - `false` `reject` (intent-alignment) `sprint-status.yaml` not updated and nothing committed — Finalize does both; the reviewer saw the tree mid-run.
  - `low` `reject` (intent-alignment) The printed login on stdout is not asserted — the same constant feeds the pages that `demo.spec.ts` asserts, and the manual run recorded the output; a missing console line is unlikely and a check adds a CI grep for little.
  - `low` `reject` (intent-alignment) Windows is untested — CI is Ubuntu only; the command spawns `process.execPath` plus Next's bin with no shell, the standard cross-platform form; a Windows runner is beyond this story.
  - `low` `reject` (intent-alignment) No truly fresh clone is tested (`.next/` exists when the CI smoke runs) — the fresh-clone check is Story 7.4's acceptance criterion; `next dev` builds nothing ahead, so an existing `.next/` does not change the demo path.
  - `false` `reject` (intent-alignment) `server-output.spec.ts` moved onto the demo server — it still runs on `next dev` with its own Host, the teardown still scans `dev.log`, and the move is recorded in AD-22; the FR-11 guarantee is unchanged.
  - `false` `reject` (intent-alignment) "Every Host page" read as including the play stage — EXPERIENCE.md puts the band "under the top bar", and the stage hides all Host chrome by design; the band is now proven hidden there.
  - `medium` `patch` (blind) The CI demo smoke's curl has no timeout and the step no `timeout-minutes`, so a stalled compile could hang the job — added `curl -m 5` and `timeout-minutes: 5`.
  - `low` `patch` (blind) `demo-replay.test.ts` checks metadata only, so stale or wrong `items`/`assignments` in `demo.json` pass — it now asserts each ruling's `items` equal the sorted distinct normalised seeded Answers and the Group count equals the distinct assignments; a same-count regrouping still passes (accepted, see Auto Run Result).
  - `low` `reject` (blind) `auth.createHost` lacks `register`'s `23505` → `EMAIL_TAKEN` mapping — the only caller seeds a freshly recreated directory or a per-file in-memory DB, so a duplicate is unreachable and would fail loudly as `INTERNAL`.
  - `medium` `patch` (blind) The band sat between `</header>` and `<main>`, outside every landmark — moved inside `<header>` below the bar, hidden with it under the stage; e2e and axe pass.
  - `false` `reject` (blind) The demo-login sentence is written in `page.tsx` and `AccountForm.tsx` and may drift — `demo.spec.ts` asserts the exact sentence on both `/` and `/logg-inn`, so any drift fails the test.
  - `low` `patch` (blind) Ctrl+C or SIGTERM made `npm run demo` exit 1 ("Lifecycle script failed") — exits 0 when the child ended on a signal; the `spawn` error-handler part rejected, since spawning `process.execPath` cannot miss.
  - `low` `reject` (blind) "Fyll inn demobrukeren" leaves earlier field errors visible — only after a failed login, and the next submit clears them; clearing `useFormAction` state from outside adds a path for a cosmetic case.
  - `low` `patch` (blind) `tsconfig.cli.json` maps to a private Next path without a `shortcut:` comment — the comment in `src/cli/demo.ts` is now a one-line `shortcut:` naming the path and the Next upgrade trigger.
  - `low` `reject` (blind) `await connection()` makes `/` dynamic in production — intended and commented: DEMO_MODE must be read at run time, and rendering a three-line page per request costs nothing measurable.
  - `low` `patch` (blind) An e2e run deletes the working copy's `.data/demo` — stated in the `shortcut:` comment in `playwright.config.ts` (and AD-22); a `DEMO_DIR` option was rejected, since it reopens the variable-path delete the spec forbids.
  - `medium` `patch` (edge-case) Same as the CI curl timeout above — grouped; same fix.
  - `low` `reject` (edge-case) A second `npm run demo` deletes `.data/demo` under a running demo — the second `next dev` then fails on the dist-dir lock and the first demo's data is disposable; a lock check adds code for a self-inflicted case.
  - `low` `reject` (edge-case) `PORT=' 3001'` or `3000.0` makes `APP_BASE_URL` invalid — fails loudly at `env.ts` validation before anything is deleted; unlikely input.
  - `low` `patch` (edge-case) A signal-ended child exits 1 — grouped with the exit-code finding above; same fix.
  - `low` `reject` (edge-case) `DEMO_SETS` longer than `DEMO_LINKS` would throw a TypeError — constants in one file, and `demo-replay.test.ts` fails at once on such a change.
  - `low` `reject` (edge-case) `createHost` with an existing email gives `INTERNAL` — same as the blind finding; unreachable for the only caller.
  - `low` `reject` (edge-case) `demo.spec.ts` cannot run twice against one server (`--repeat-each`) — Playwright runs with `retries: 0` and no repeat, like the smoke spec; every run starts a fresh demo.
  - `low` `patch` (edge-case) The root 404 renders `HostChrome` without `demo` — `not-found.tsx` now passes `demo={env.DEMO_MODE}`.
  - `low` `patch` (edge-case) Claim "exit with the child's code" broken on a signal — grouped with the exit-code finding; same fix.

## Design Notes

**Demo data.** Three Questions about a cabin trip, six Answer sets, Answers chosen so the hand-written partition is visible: spelling and case variants ("Kaffe", "kaffe", "Kaffe!") collapse by normalisation, and the ruling joins near-synonyms ("Kortstokk" with "Kortspill", "Ullsokker" with "Varme sokker", "Brunost" with "Geitost", "Ser film" with "Filmkveld"). Eight links are issued and six answered, so the Game page reads "6 av 8".

**Hand-written ruling.** The story assumes `judge:record` with a live key; there is none here. The file uses the recorder's exact shape, so `npm run judge:record -- <input.json> data/rulings/demo.json` (input: `[{ question, answers }]` from `src/server/demo.ts`) can replace it later, followed by `npx prettier --write data/rulings/demo.json`; `demo-replay.test.ts` then checks the live partition still covers every item.

**Why the demo replaces the dev webServer.** Next 16 locks the dist dir per `next dev`, so a third server cannot run beside the existing 3101 one. `npm run demo` is `next dev` too, so `server-output.spec.ts` keeps its guarantee (development-mode logging) and registers its own Host as before. Cost: an e2e run recreates the working copy's `.data/demo`, which every demo run does anyway.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run format:check` -- clean.
- `npm run test` -- all pass, including `demo-replay.test.ts`.
- `npm run test:e2e` -- all pass, including `demo.spec.ts` and `server-output.spec.ts` on the demo server.
- `PORT=<free port> npm run demo`, then `curl localhost:<port>/api/health` -- 200; stop with SIGTERM, no process left.

**Manual checks (if no CLI):**
- Rerun on an existing `.data/demo` gives a fresh *collecting* Game; a busy `PORT` makes the command exit non-zero with Next's EADDRINUSE error; SIGTERM stops `next dev` and the demo with it.

## Auto Run Result

Status: done

**Summary.** `npm run demo` (`src/cli/demo.ts` through `tsx`) recreates `.data/demo`, migrates, seeds the invented demo Host `demo@toppsvar.test` / `demo-passord` and the *collecting* Game "Hyttetur med gjengen" (three Questions, eight links, six Answer sets) through `auth.createHost`, `games.create`, `questions.save`, `collection.createInviteLinks` and `collection.submit`, prints the URL and login, and starts `next dev` with replay and `DEMO_MODE=1`. The hand-written `data/rulings/demo.json` covers every demo Answer, so closing gives Judge Groups. `/` and `/logg-inn` show the login (with "Fyll inn demobrukeren"), and the Demo band sits in the header of every Host page.

**Files changed.**
- `src/cli/demo.ts` -- the demo command: env overrides, fixed-path delete, migrate, seed, print, spawn `next dev`, signal forwarding.
- `tsconfig.cli.json` -- maps `next/navigation` to Next's react-server build so plain Node under `react-server` can load the server modules (deviation, see below).
- `src/server/demo.ts` -- the invented demo data, `seed()` and `seedAndClose()`.
- `src/lib/demo.ts` -- the one credentials constant.
- `src/server/auth/index.ts` -- `createHost`, a Host without session or cookie.
- `data/rulings/demo.json` -- hand-written partitions, `model`/`promptVersion` `"hand-written"`.
- `package.json` -- the `demo` script.
- `src/app/page.tsx`, `src/app/logg-inn/page.tsx`, `src/components/AccountForm.tsx` -- demo login Notice and fill button, only when `DEMO_MODE=1`.
- `src/components/HostChrome.tsx`, `src/app/spill/layout.tsx`, `src/app/not-found.tsx` -- the Demo band.
- `tests/integration/demo-replay.test.ts`, `tests/e2e/demo.spec.ts` -- AC2 and AC3 (plus the non-demo negative case and the band hidden under the play stage).
- `playwright.config.ts` -- the 3101 server is now `npm run demo`.
- `.github/workflows/ci.yml` -- demo smoke step.
- `tests/TRACE.md`, `tests/manual/checklist.md` (D1) -- trace rows and the AC4 manual item.
- `ARCHITECTURE-SPINE.md` -- *Amended in Story 7.1* notes on AD-14, AD-19 and AD-22.

**Review findings.** 26 findings: 10 patched (3 medium, 7 low, in 8 entries), 0 deferred, 16 rejected with the reasons in the triage log.

**Follow-up review recommended: true.** Two medium entries were patched (CI timeout, band landmark). The named unverified risk: the CI demo smoke step (timeout, background start on port 3000, stop) has run only as a local script on another port, never on GitHub Actions; the first CI run on the PR settles it.

**Rejected or corrected AI suggestions.**
- The implementer found the spec's exact script line cannot load the server modules (`next/navigation`'s client build crashes under `react-server`) and added `tsconfig.cli.json`. Accepted as a recorded deviation (AD-19 amendment, `shortcut:` comment), since the alternative was changing `boundary.ts` and `auth` imports used by the whole app.
- The planner's first I/O matrix listed rerun, busy port and stop rows that no automated test could cover cheaply; they were moved to manual checks before implementation, and the manual run confirmed them.
- Rejected reviewer suggestions: a `DEMO_DIR` variable for the e2e server (reopens the variable-path delete), a lock check before the delete, a shared login component, an `EMAIL_TAKEN` mapping in `createHost`, and clearing field errors on fill (reasons in the triage log).
- Accepted gap: `demo-replay.test.ts` does not pin the exact groups, so a regrouping with the same group count passes; the e2e test pins one join ("Kortstokk" with "Kortspill"). Pinning every group would duplicate the ruling file in the test.

**Verification.**
- `npm run lint`, `npm run typecheck`, `npm run format:check`: clean.
- `npm run test`: 43 files, 732 tests passed.
- `npm run test:e2e`: 99 passed, including `demo.spec.ts` and `server-output.spec.ts` on the demo server; the server-output teardown scanned 310 values with no leak.
- `PORT=3457 npm run demo` (port 3000 was held by another local project): login printed, `/api/health` 200, `/` showed the demo login, SIGTERM left no process. The implementer also confirmed a rerun gives a fresh Game, a busy port exits non-zero with EADDRINUSE and `PORT=abc` fails naming `PORT`.

**Residual risks.**
- `data/rulings/demo.json` is hand-written. A live `npm run judge:record` with a key may replace it (input `[{ question, answers }]` from `src/server/demo.ts`, then `npx prettier --write`); the tests then check coverage and items.
- `tsconfig.cli.json` depends on a private Next file path; re-check on a Next upgrade.
- Every e2e run recreates the working copy's `.data/demo`.
- Manual item D1 in `tests/manual/checklist.md` has no recorded result yet; someone other than the author should read the demo content before merge.
