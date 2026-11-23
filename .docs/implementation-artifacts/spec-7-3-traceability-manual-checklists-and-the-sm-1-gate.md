---
title: 'Story 7.3: Traceability, manual checklists and the SM-1 gate'
type: 'chore'
created: '2026-11-23'
status: 'done'
baseline_revision: '9b34e7224e80e48b5c8775e23f701ea13330f31e'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      The CI Postgres job has only run locally, not on GitHub Actions.
    evidence: |-
      Two local runs against a fresh postgres:17-alpine with trust auth, as in ci.yml, gave 454 passed, 4 skipped, exit 0. Settled when the branch is pushed and the `postgres` job is green.
    location: >-
      .github/workflows/ci.yml
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** SM-1 can only be declared once every Stage 1 consequence is traced to a test or a manual check and the manual checks have been run. Today `tests/TRACE.md` has stale "Pending" notes, the trace test only checks headings, the AD-4 matrix test walks `lockForMutation` rather than the real operations, `tests/manual/checklist.md` lacks A5, result columns and a gate, `tests/manual/anonymity-audit.md` does not exist, and the group has no quick way to build the sizing Game the NFR-5 timings need or to dump a PGlite database for SM-3.

**Approach:** Tighten the two automated checks (AC1, AC2), turn the manual files into runnable, recordable procedures with an honest SM-1 gate section that lists what is still open (AC3, AC4), add two small CLIs that make those procedures quick (`npm run seed:sizing`, `npm run db:dump`), and attempt the cuttable CI Postgres job (AC5) inside a time box, cutting it with a recorded reason if it does not fit.

## Boundaries & Constraints

**Always:** Tests pass offline; every commit is green (`npm run test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, e2e when UI or server code changes). Manual items that need a person (real TV at 3 m, real phone, screen reader, stopwatch, a second reader for D1, a reviewer not involved in the last change for SM-3) stay open with an empty result; nothing is marked passed by the AI. Pilot timings from `delivery-notes.md` are cited as supporting evidence only, never as T-item results. Seeded content is invented, with no real person's name and nothing from `.idea/`. The dump CLI never prints the database URL.

**Never:** Touch `README.md`, `wiki/`, `.logs/`, `.claude/skills/excalidraw-diagram/` (Story 7.4 owns the README, including any statement that AC5 was cut). Call OpenRouter. Weaken an existing test. Change the demo content (D1). Add a dependency. Read, print, grep or commit any `.env*` file other than `.env.example`. Commit or push (the orchestrator commits). Use port 3200, or kill a process you did not start (ports 3000 and 3101 may be held by other projects; stop any server you start).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Trace heading missing | a Stage 1 FR heading removed from `TRACE.md` | `trace.test.ts` fails naming the FR | — |
| Trace section empty | a Stage 1 FR section holds only prose or "Pending" bullets | `trace.test.ts` fails naming the FR | — |
| Operation in a forbidden state | each real entry point × each of the 7 states outside its `PERMITTED` row | refused: `WRONG_STATE` (Host ops), `COLLECTION_CLOSED` (Participant ops), no `grouping_result` row (Grouping) | — |
| Operation in a permitted state | same, inside its row | not refused by state (any other outcome, e.g. `NOT_FOUND`, `TOO_FEW_ANSWER_SETS`) | — |
| Sizing seed | `npm run seed:sizing` | fresh `.data/sizing` with one collecting Game: 15 Questions, 30 links, 30 Answer sets of 1–5 Answers; prints the login only | PGlite locked by a running server: the error surfaces, nothing printed about content |
| Dump | `npm run db:dump` with a `DATABASE_URL` | JSON on stdout: every table in `public`, rows in physical order with `ctid` and `xmin` | bad URL: error without the URL |

</intent-contract>

## Code Map

- `tests/unit/trace.test.ts` -- heading check for Stage 1 FRs and story NFRs (AC1); extend to "each Stage 1 FR section has a bullet naming a `tests/…` file or CI".
- `tests/TRACE.md` -- 514 lines; stale Pending: FR-15 (Story 7.1, done), FR-14/FR-31/NFR-1/NFR-8 (7.4), NFR-2 (7.5), NFR-3/6/7 ("every story"). AD-4 integration line lives under `## UX`.
- `tests/integration/game-state.test.ts` -- existing `PERMITTED` walk against `lockForMutation` (keep); add the real-operation matrix here (AC2).
- `src/lib/game-state.ts` -- `GAME_STATES`, `PERMITTED`, `Operation` (13 ops; `finishPlay` shares `playMove`'s lock in `play.nextQuestion`).
- Entry points and state behaviour: `questions.save` (`src/server/questions`), `collection.createInviteLinks/revokeInviteLink/openInviteLink/submit/close` (Participant ops map `WRONG_STATE` to `COLLECTION_CLOSED`, state checked before the token), `grouping.run` (swallows `WRONG_STATE`, writes `grouping_result` only in `grouping`), `review.merge/moveAnswers/rename/discard/restore/setReviewed/confirmBoard`, `play.start/reveal/undo/nextTeam/nextQuestion`, `games.deleteOwned`. Input schemas in `src/lib/{invite-link,review,play,question}.ts`; validation runs before the lock, so inputs must be well-formed.
- `src/server/demo.ts` -- `seed()` pattern through module entry points; `src/cli/demo.ts` -- CLI pattern (set env before imports, `rm` a fixed `.data/<dir>`, `migrateFromEnv`, close the DB).
- `src/server/db/migrate.ts` -- `migrateFromEnv()` pattern for a DB-level CLI; `eslint.config.mjs` line ~130 lets `src/cli` import only `@/server/db/migrate` from db.
- `tests/manual/checklist.md` -- A1–A4, A6–A10, T1–T8, D1; no A5, no result columns. `EXPERIENCE.md` A5: axe or Lighthouse over the listed pages.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md` -- pilot Review timings (prod, 5-Question Game, scripted), cut order item 1 (CI Postgres job).
- `.github/workflows/ci.yml` -- one `check` job on Node 22/26.
- Probe (2026-11-23, local `postgres:17-alpine`, per-file database, migrated): 33 of 439 integration tests failed in 8 files; most from `(result as { rows }).rows` (PGlite's shape; postgres.js returns an array), plus a cluster-global role in `collection.test.ts`, a PGlite-only retry test and a query-log spy. A probe Postgres container may be running at `postgres://postgres:probe@127.0.0.1:55432/postgres` (Docker, `toppsvar-pg-probe`); the probe used a setup file, listed before `tests/setup.ts`, that creates a random database per test file, sets `DATABASE_URL` to it before any `@/server` import and migrates it with `migrateDb`. If the job is built, CI uses a `postgres` service container and `npm run test -- tests/integration`; locally, prove it green against the probe container. Time box: if more than the `.rows` shape and a few driver-specific skips are needed, cut it.

## Tasks & Acceptance

**Execution:**
- `tests/unit/trace.test.ts` -- add a per-FR check that each Stage 1 FR section has at least one bullet naming a test file, a manual item or CI -- AC1 must mean "traced", not "headed".
- `tests/integration/game-state.test.ts` -- add a matrix over every real entry point of every `Operation` × `GAME_STATES`, asserting refusal exactly outside `PERMITTED[op]`, plus a check that every `Operation` has at least one entry point -- AC2.
- `src/server/sizing.ts`, `src/cli/sizing-game.ts`, `package.json` (`seed:sizing`) -- invented sizing Game (Question 1 at 200 characters, a 40-character wide-letter Answer on its Board) through module entry points -- makes T1–T8, A6–A10 quick to run.
- `src/server/db/dump.ts`, `src/cli/db-dump.ts`, `package.json` (`db:dump`), `eslint.config.mjs` -- JSON dump of every `public` table in physical order with `ctid`, `xmin` -- SM-3 needs a dump and PGlite has no `pg_dump`.
- `tests/integration/manual-tools.test.ts` -- sizing seed shape and dump shape against `pglite://:memory:`.
- `tests/manual/checklist.md` -- add A5, how to prepare, a Result and Date column on every row, supporting pilot evidence, and the SM-1 gate section listing what is open -- AC3.
- `tests/manual/anonymity-audit.md` -- SM-3 procedure, ground-truth rule, record table -- AC4.
- `tests/TRACE.md` -- resolve stale Pending notes, add the new tests, SM-1/SM-3 pointers -- AC1, AC3.
- `.github/workflows/ci.yml` (+ test helpers) -- Postgres job if it fits the time box; otherwise record the cut here and hand the README sentence to Story 7.4 -- AC5.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 7-3 to done when complete.

**Acceptance Criteria:**
- Given `tests/TRACE.md`, when `npm run test` runs, then it fails if any Stage 1 FR (FR-1 to FR-21, FR-23 to FR-27, FR-30 to FR-32) is missing or has no bullet naming a test, manual item or CI.
- Given `src/lib/game-state.ts`, when `game-state.test.ts` runs, then every entry point of every operation is called in every state and is refused exactly outside its permitted row.
- Given `tests/manual/checklist.md`, when a group member opens it, then A1–A10, T1–T8 and D1 each have a procedure, an empty Result and Date, and the SM-1 gate section states that SM-1 has not passed and lists exactly the open items.
- Given `tests/manual/anonymity-audit.md`, when a reviewer not involved in the last change follows it, then the dump and Host access are produced by documented commands and the result is recorded in its table.
- Given AC5, when this story ends, then either CI has a green Postgres job running `tests/integration`, or this spec records the cut with its reason and Story 7.4 is told to state it in the README.

## Spec Change Log

- 2026-11-23, AC5 built, not cut. Inside the time box the job needed only the `.rows` shape (one helper, `sqlRows` in `tests/integration/driver.ts`, used in six files), a per-file database setup (`tests/postgres-setup.ts`, chosen by `TEST_POSTGRES_URL`) and four PGlite-only skips: the two `VACUUM_SKIPPED` tests (`SET ROLE` holds for one pooled connection only), the `PgliteSession` lock-SQL spy (on Postgres the race tests run for real) and `db-open-retry.test.ts` (it mocks PGlite's constructor). Against a fresh `postgres:17-alpine` with trust auth, as in CI: 451 passed, 4 skipped. Story 7.4 has no cut to state for it.

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 37 findings — high 0, medium 12, low 20, false 4, maybe-false 1
- findings:
  - Blind Hunter
    - `[medium]` `[patch]` The `finishPlay` matrix entry called `nextQuestion` at position 1 of 2 on a Game without `play_state`, so finishing was never run — `gameIn` now starts play through the real `play.start`; the entry moves `play_state` to Question 2 and calls position 2, which finishes the Game.
    - `[medium]` `[patch]` In a permitted state any outcome, a crash or `INTERNAL` included, counted as allowed — the test now requires "ok" or a DomainError other than the refusal and `INTERNAL`.
    - `[medium]` `[patch]` `trace.test.ts` counted "Open" bullets as traced — "Open" and "Pending" bullets never count now.
    - `[low]` `[patch]` A backticked `tests/…` path was never checked to exist — a traced bullet must name an existing file or CI (`existsSync`).
    - `[low]` `[patch]` NFR-4 and NFR-5 were missing from the heading list — added; the per-section traced check stays on Stage 1 FRs, which is what AC1 names.
    - `[low]` `[reject]` Nothing keeps the gate's open list in sync with the "Open" bullets — a parser for a hand-kept list adds more than it saves; the gate says to update it when an item closes.
    - `[low]` `[patch]` The dump test relied on the seed test running first — seeding moved to `beforeAll`.
    - `[low]` `[patch]` (two claims) The dump order check is tautological, and the CLI error path was untested although TRACE claimed it — the tautology is rejected as harmless (the order is what the SQL promises); the error path now has two spawn tests and the TRACE claim points at them.
    - `[medium]` `[patch]` Audit step 9 said all `answer` rows share close's `xmin`, but `confirmBoard` rewrites every row — the step now expects the Board lock's `xmin` and asks whether `ctid` order follows the ground-truth sets.
    - `[low]` `[patch]` Dead tuples and WAL under `.data/audit` are not inspected — the audit now says raw files and WAL are out of scope because the README states them as limits (delivery notes, anonymity limits).
    - `[low]` `[patch]` The pilot-evidence paragraph cited `delivery-notes.md` vaguely — repo-relative path given.
    - `[low]` `[reject]` `seed:sizing` deletes `.data/sizing` under a running server — test data only, the checklist says to stop the server first, and a lock probe adds a branch for a case nobody meets in normal use.
  - Edge Case Hunter
    - `[medium]` `[patch]` Crash counted as not refused in a permitted state — same fix as the Blind Hunter row.
    - `[medium]` `[patch]` Finish path never run — same fix as above.
    - `[low]` `[reject]` `submit` with a bad Token is refused before its in-lock `WRONG_STATE` mapping — the matrix proves the state gate at the entry point; the in-lock mapping is covered by `collection.test.ts`'s submit-racing-close tests.
    - `[low]` `[patch]` "Open" bullets and loose "CI" mentions count as traced — "Open" excluded; "CI" kept, since every CI bullet in TRACE names a CI step.
    - `[medium]` `[patch]` A mistyped PGlite directory silently gives an empty dump that reads as a clean audit — `dumpFromEnv` refuses a PGlite directory that does not exist, with a fixed message.
    - `[low]` `[patch]` `db:dump` loaded `.env.local`, so it could dump a hosted database the user did not name — the env file is no longer loaded for `db:dump`.
    - `[low]` `[reject]` Concurrent writes during a Postgres dump give an inconsistent snapshot — the audit dumps a stopped PGlite database; a read-only transaction adds a mode nobody uses.
    - `[low]` `[reject]` Seeding under a running server — same as the Blind Hunter row.
    - `[low]` `[reject]` `postgres-setup.ts` leaks a database if migration fails — CI starts a fresh container every run; the failure itself fails the job.
    - `[low]` `[patch]` Test interdependence in `manual-tools.test.ts` — same fix as above.
    - `[medium]` `[patch]` Claim: the matrix overstates what it proves — fixed by the two matrix patches above.
    - `[low]` `[patch]` Claim: AC1 accepts open items — fixed by the trace patch above.
  - Verification Gap
    - `[medium]` `[patch]` `db:dump`'s error path untested while TRACE claims it — two spawn tests added (password URL: exit 1, code only, no password, empty stdout; missing directory: exit 1, not created).
    - `[medium]` `[patch]` The CI Postgres job would pass silently on PGlite if `TEST_POSTGRES_URL` were dropped — `db.test.ts` has a test that runs only when `GITHUB_JOB` is `postgres` and fails unless the suite is on postgres.js.
    - `[low]` `[patch]` "Open" bullets count as traced — same fix as above.
    - `[low]` `[patch]` Empty dump from a mistyped directory — same fix as above.
  - Intent Alignment (descriptive; each divergence triaged)
    - `[false]` `[reject]` 7-3 set to done while the gate says "not passed" — the invocation intent says to set 7-3 done when complete and to leave the gate honestly open when humans must run checks; the story's automatable work is complete and the gate lists what remains.
    - `[false]` `[reject]` AC1 checks naming, not proof — the check now also requires the named file to exist and excludes open items; whether the test passes is what `npm run test` itself proves.
    - `[false]` `[reject]` AC2 checks the state gate, not successful operations — AC2 asks exactly that the permitted table is what is allowed; success inside a permitted state is the module tests' job, and crashes now fail.
    - `[medium]` `[patch]` SM-2 not stated at the gate — the gate now reports the live ProtoQA figure and says below 0.70 does not fail SM-1.
    - `[medium]` `[patch]` The §6.5 slip list was not spelled out — the gate lists the three items with what is known and hands the README statement to Story 7.4.
    - `[low]` `[patch]` The dump was taken after play, not right after the Board lock; the reviewer also created the data — the dump now follows the lock directly; a two-person split is recommended.
    - `[maybe-false]` `[defer]` AC5 not shown on GitHub — verified locally twice against a fresh `postgres:17-alpine` (454 passed, 4 skipped, exit 0); settles once the branch is pushed and the `postgres` job runs.
    - `[false]` `[reject]` Manual-run tooling in the production source tree — it follows the demo and `judge:*` CLIs' layout and lint zones; nothing in the app imports it.
    - `[low]` `[patch]` Reviewer columns invite real names — the columns now ask for initials.

## Design Notes

**Honest gate.** SM-1 counts every Stage 1 consequence except slip-list items the README names. The automated part is green in CI; the manual part is not run. The checklist's gate section is the single place that says which items are open, and it stays "not passed" until a person fills every Result. The AI fills none.

**Matrix predicate.** "Refused" is defined per entry kind because the code deliberately differs: Host actions throw `WRONG_STATE`, Participant link actions turn it into `COLLECTION_CLOSED` (the link page says "closed"), and Grouping swallows it (a stopped run leaves no trace). In a permitted state the outcome must be "ok" or a DomainError other than the refusal and `INTERNAL`; a crash fails. What each operation does inside its permitted states is covered by the module tests.

**Sizing seed instead of manual setup.** Building 30 Answer sets by hand takes 30 browser sessions. The seed reuses the demo's module-entry-point pattern, writes to its own fixed directory, and leaves the Game in _collecting_, so the tester still closes, reviews and plays through the UI they are timing.

## Verification

**Commands:**
- `npm run test` -- all unit and integration tests pass offline.
- `npm run lint` and `npm run typecheck` and `npm run format:check` -- clean.
- `npm run test:e2e` -- passes (no UI change, run once before the final commit).
- `npm run seed:sizing` then `DATABASE_URL=pglite://.data/sizing npm run db:dump | head` -- seed prints only the login; dump is JSON.

## Auto Run Result

Status: done (the story's automatable work). **SM-1 has not passed**: the gate in `tests/manual/checklist.md` lists every manual item a person must still run, and no result was filled in by the AI.

**Summary.** AC1: `trace.test.ts` now requires every Stage 1 FR section to have a bullet naming an existing `tests/…` file or CI, never counting "Open" or "Pending" bullets, and checks NFR-1 to NFR-8 headings. AC2: `game-state.test.ts` calls all 23 real entry points of the 13 operations in all 7 states and asserts refusal exactly outside `PERMITTED`, and "ok" or a non-`INTERNAL` DomainError inside it. AC3: the checklist has A5, preparation steps, Run on/Result/Date columns, supporting pilot evidence, the SM-2 figure as reported, the §6.5 slip list, and the SM-1 gate. AC4: `tests/manual/anonymity-audit.md` is the SM-3 procedure with a record table. AC5: built; a `postgres` CI job runs `tests/integration` on Postgres 17 with per-file databases. Two tools make the manual runs quick: `npm run seed:sizing` and `npm run db:dump`.

**Files.**
- `tests/unit/trace.test.ts` — the stronger SM-1 trace check.
- `tests/TRACE.md` — no "Pending" left; "Open" bullets for Story 7.4's README items; new rows for this story.
- `tests/integration/game-state.test.ts` — the real-operation AD-4 matrix.
- `tests/manual/checklist.md`, `tests/manual/anonymity-audit.md` — runnable manual procedures and the gate.
- `src/server/sizing.ts`, `src/cli/sizing-game.ts` — the invented sizing Game (`npm run seed:sizing`).
- `src/server/db/dump.ts`, `src/cli/db-dump.ts` — the SM-3 dump (`npm run db:dump`); `eslint.config.mjs` and `tests/unit/lint-zones.test.ts` allow the CLI that one import.
- `tests/integration/manual-tools.test.ts` — the seed, the dump and the dump CLI's error output.
- `tests/postgres-setup.ts`, `tests/integration/driver.ts`, `vitest.config.ts`, `.github/workflows/ci.yml` — the CI Postgres job; six integration files use `sqlRows`, four PGlite-only tests are skipped on Postgres, and `db.test.ts` fails the job if it ever runs on PGlite.
- `tests/integration/authz.test.ts`, `play.test.ts`, `review.test.ts` — eager promise arrays made lazy (see below).
- `package.json` — `seed:sizing`, `db:dump`.
- `.docs/implementation-artifacts/sprint-status.yaml` — 7-3 done.

**AI output corrected or rejected during the run.**
- The orchestrator's own first Postgres run of the implementer's job showed 14 unhandled rejections, exit 1, which the implementer had reported as green. Three tests built arrays of promises eagerly and awaited them one by one; on pooled postgres.js the later ones rejected before they were awaited. The orchestrator made them lazy; the assertions are unchanged.
- The implementer's first matrix counted a crash or `INTERNAL` in a permitted state as allowed, and its `finishPlay` entry never finished a Game. Corrected after review.
- The implementer's audit claimed all Answer rows keep close's `xmin` after the Board lock; `confirmBoard` rewrites them. Corrected after review.
- `db:dump` first loaded `.env.local` and silently created an empty database for a mistyped path. Corrected after review.
- The rejected review suggestions and their reasons are in the triage log above.

**Review.** 37 findings: 25 patched (12 medium, 13 low), 1 deferred (AC5 unverified on GitHub), 11 rejected (4 false, 7 low; reasons in the log). Follow-up review recommended: true. The matrix fixture, the trace check and the dump guards were rewritten after the review pass and have only been verified by their own tests, not re-reviewed.

**Verification.** After the patches: `npm run test` 802 passed, 1 skipped (the CI-only guard); `npm run lint`, `npm run typecheck`, `npm run format:check` clean; `npm run test:e2e` 99 passed; `GITHUB_JOB=postgres TEST_POSTGRES_URL=… npm run test -- tests/integration` on a fresh `postgres:17-alpine`: 454 passed, 4 skipped, exit 0. The containers used were stopped.

**Residual risks.** SM-1 cannot pass until a person runs A1–A10, T1–T8, D1, F1 and the SM-3 audit and Story 7.4 closes the README items. T5 (Board lock) measured 1.18 s on the pilot, so it may fail one second. The CI Postgres job has not run on GitHub yet.

