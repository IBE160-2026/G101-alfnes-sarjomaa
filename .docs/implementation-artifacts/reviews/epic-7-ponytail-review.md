# Epic 7 ponytail review

Scope: `git diff origin/main...epic-7-demo-og-levering` (stories 7.1 to 7.5). Assumed load: one examiner or group member running scripts on one laptop, plus CI. The pilot is a handful of Hosts at a time. Nothing was changed.

What this change does: It adds `npm run demo`, which recreates `.data/demo`, seeds an invented Host and a *collecting* Game through the real module functions, and starts `next dev` with stored rulings and a Demo band. It adds `npm run judge:eval`, which scores the Judge against the ProtoQA dev set with weighted B-cubed, offline from committed rulings (F1 0.6849). Stories 7.3 to 7.5 add the full permitted-operations matrix over the real entry points, a stricter trace check, the manual checklist and anonymity audit with two helper scripts (`seed:sizing`, `db:dump`), a CI job on real Postgres, the examiner README, the hand-in zip script and the pilot notes.

I traced the demo path (`src/cli/demo.ts` sets `DATABASE_URL`, `JUDGE_PROVIDER`, `DEMO_MODE` and `APP_BASE_URL` before `env.ts` loads, so a pilot `DATABASE_URL` or key in `.env.local` can never reach the demo), the `DEMO_MODE` surfaces (passed from server pages, never imported by a client component), `auth.createHost`, the whole `judge:eval` flow including the `--live` fallback and "nothing written on failure" paths, `parseLabelled` (an answer that normalises to empty is skipped safely, ties go to the first cluster), `bcubed`, `dump` and its "missing PGlite directory" guard, `tests/postgres-setup.ts` (the database name comes from `randomUUID`, so the `unsafe` SQL is safe), and `make-zip.sh`. `game-state.test.ts`, `judge-eval.test.ts`, `make-zip.test.ts`, `manual-tools.test.ts` and `trace.test.ts` pass locally (114 tests in about 4 s, so the spawned-CLI tests are not slow).

Checked and found clean:

- **The required tests are the right size for what they prove.** The game-state matrix (23 entry points × 7 states) is what Story 7.3 AC2 asks for. Its "every Operation has at least one entry point" check is not redundant: an empty array would let the matrix pass for that Operation. The pinned offline `judge:eval` run (52 Questions, 4887 answers, F1 0.6849) is the examiner's command, so it must stay. `bcubed.test.ts` (48 lines) is exactly AC1. `trace.test.ts` now checks that each Stage 1 FR names an existing test file, a manual item or CI, which is what "traced" means in SM-1.
- **The CI demo smoke step** overlaps with Playwright starting `npm run demo` on port 3101, but Story 7.1 AC1 names it, so it stays.
- **`shortcut:` comments:** two, both naming their limit and when to upgrade: the private Next path in `tsconfig.cli.json` (`src/cli/demo.ts:L7`) and the one-`next dev`-per-repo lock that also recreates `.data/demo` on each e2e run (`playwright.config.ts:L74`). The epic removes the old "until Story 7.3's real-Postgres CI job" shortcut in `collection.test.ts`, because that job now exists.
- **Dead code and AI leftovers:** no commented-out code, debug output, `.only` or unconditional `.skip`. The four `skipIf(onPostgres)` cases each say why they cannot run on a pooled connection.
- **Secrets:** `db:dump` prints only an error code, never the URL (tested with a password in the URL). The zip comes from `git archive HEAD`, so `.env.local`, `.idea/` and `.data/` cannot ship (tested).
- **README:** the main path is short. Clone, install, `npm run demo` and the login fit in one screen. Screenshots, flows, anonymity limits, SM-2 history, environment table, CI commands, database, folders and the zip are all in `<details>`. See finding 6 for the one block that could go.

## Must fix

None.

## Should fix

1. **The trace and the architecture still say the demo ruling is hand-written** (`tests/TRACE.md:L380`, `ARCHITECTURE-SPINE.md:L308`, `tests/e2e/demo.spec.ts:L54`)
   - **What this is:** `data/rulings/demo.json` was first written by hand, with `model: "hand-written"`, and later recorded live with the real model (commit "Ta opp demokjennelsen live").
   - **Problem:** The FR-31 row in `TRACE.md` says `demo-replay.test.ts` checks "model `hand-written`". The test actually expects `deepseek/deepseek-v4.1-flash` and pins the full partition. The AD-14 amendment for Story 7.1 still says the file "is hand-written" with no follow-up note, unlike the ProtoQA placeholder note, which has one. `TRACE.md` is what the examiner reads to see what each test proves.
   - **Fix:** In `TRACE.md`, replace "model `hand-written`" with the recorded model and add "the full partition is pinned". Add one *Amended* line under AD-14 saying the file was recorded live on 2026-11-23. Change the comment in `demo.spec.ts` to "The recorded ruling joins near-synonyms".
   - **If we skip it:** The trace says one thing and the test checks another. A careful reader stops trusting the trace.

2. **The demo seed and the sizing seed are the same function written twice** (`src/server/demo.ts:L53-82`, `src/server/sizing.ts:L42-72`, `src/cli/demo.ts:L9-26`, `src/cli/sizing-game.ts`)
   - **What this is:** Both seeds create a Host, a Game, N Questions and M invite links, then submit one Answer set per link through `collection.submit`. Both have an identical `...AndClose()` wrapper. Both CLIs set `DATABASE_URL`, delete a fixed `.data/<name>` folder, migrate, seed and print the login.
   - **Problem:** About 25 lines are copied. A change to how a seed talks to the modules, for example a new required field on `collection.submit`, must be made in both places. Nothing links them except a comment ("as the demo seed").
   - **Fix:** Keep one `seedGame({ host, title, questions, sets, links })` in `src/server/demo.ts` that returns `{ hostId, gameId, questionIds }`, and one `seedAndClose(args)`. `sizing.ts` keeps only its data (`SIZING_HOST`, the Questions and `sizingSet`) and calls it. The two CLIs can share a small `reset(name)` for the delete and migrate.
   - **If we skip it:** Nothing breaks now. The two seeds drift the first time only one is updated.

3. **The second zip test proves things nobody asked for** (`tests/integration/make-zip.test.ts:L59-104`)
   - **What this is:** It builds a throwaway git repo, copies the script into it, and checks that the default output path is the repo root and that a dirty tree prints a warning.
   - **Problem:** Story 7.4 AC4 asks only that the zip has every entry under one folder and no `.env`, `.idea/`, `.data/`, `.next/` or `node_modules/`. The first test proves that on the real repo. The second test is 46 lines (half the file) guarding the default path and a warning line in an 18-line script.
   - **Fix:** Delete the second test. Keep the first.
   - **If we skip it:** Nothing breaks. One more test that must change whenever the script's output text changes.

## Nice to have

4. **Four fake OpenRouter preloads repeat the same header** (`tests/integration/judge-eval.test.ts:L25-78`)
   - **What this is:** `noNetwork`, `fakeOpenRouter`, `halfOpenRouter` and `downOpenRouter` are four generated `.mjs` files. Each blocks sockets and then replaces `fetch` in a different way.
   - **Fix:** Write one preload that blocks sockets and picks its `fetch` from an env variable (`FAKE_OPENROUTER=none|retry|half|down`), and pass that variable from `run()`. The test file shrinks by about 25 lines, and the "no socket" rule lives in one place.
   - **If we skip it:** A change to the socket guard must be made four times.

5. **Small leftovers in the new modules** (`src/cli/judge-eval.ts:L78`, `src/server/sizing.ts:L16, L28`, `src/server/demo.ts:L13`, `src/server/db/dump.ts:L13-18`)
   - **What this is:** `itemsOf(items)` in the `--live` fallback runs on items that `parseLabelled` already built with `itemsOf`, so it returns the same list. `SIZING_TITLE`, `sizingSet` and `DEMO_TITLE` are exported but used only in their own file. The "PGlite returns `{ rows }`, postgres.js an array" helper in `dump.ts` is the same as `sqlRows` in `tests/integration/driver.ts`.
   - **Fix:** Use `items` directly. Drop the three `export` keywords. Export `sqlRows` from `src/server/db/dump.ts` and import it in the tests instead of `driver.ts` keeping its own copy.
   - **If we skip it:** About 8 extra lines, and two copies of a driver quirk.

6. **The README repeats the CI file** (`README.md:L267-291`, "Kommandoene CI kjører")
   - **What this is:** A `<details>` block that lists every CI step, plus the Postgres job's command.
   - **Fix:** Replace the command list with one sentence and a link to `.github/workflows/ci.yml`. Keep the line about where the e2e `dev.log` lands, since that is not in the CI file.
   - **If we skip it:** The README and `ci.yml` drift the next time a CI step changes, and the README is about 20 lines longer than it needs to be.

Verdict: Ship. Finding 1 is a cheap doc fix worth doing before the PR, since the examiner reads `TRACE.md`. Findings 2 and 3 are cleanups. Findings 4 to 6 are optional.

Lean: -125 lines possible (about 25 in the seeds and CLIs, 46 in the zip test, 25 in the judge-eval preloads, 8 in leftovers and 20 in the README).

Not checked: the full Vitest and Playwright runs and the CI Postgres job on GitHub (other reviewers share this working copy), the pilot itself, the manual checklist and anonymity audit procedures by running them, and `data/rulings/protoqa-dev.json` against the live model.

## Epic 7 review fixes

Fixed on 2026-11-23 on `epic-7-demo-og-levering`. Every commit was green on lint, typecheck, format and `npm run test`, and `npm run test:e2e` passed in full before the last code commit.

| # | Finding | Outcome | Commit |
|---|---|---|---|
| 1 | Trace and spine still call the demo ruling hand-written | **Fixed** (same as bmad finding 2). | `63927c7` |
| 2 | Demo and sizing seeds written twice | **Fixed.** `src/server/demo.ts` has one `seedGame()` and one `seedAndClose(run)`; `sizing.ts` keeps only its data and both CLIs use the shared close. The suggested shared `reset(name)` for the two CLIs was left out: each CLI sets its own environment before any import, so a shared helper would need its own dynamic import and saves only a few lines. `seed:sizing` was run in a scratch directory and dumped: 1 Game, 15 Questions, 30 Answer sets. | `dcb4b45` |
| 3 | Second zip test proves things nobody asked for | **Fixed, test deleted.** Story 7.4 AC4 asks only for the zip's contents, which the first test proves on the real repository. The default path and the dirty-tree warning are I/O-matrix rows but no acceptance criterion; the default path is in the F1 record, and the warning now has no automated test. Spec 7.4 and TRACE say so. | `56b9786` |
| 4 | Four fake OpenRouter preloads | **Fixed.** One preload blocks sockets and picks its `fetch` from `FAKE_OPENROUTER` (`retry`, `half`, `down`, or none). | `c98cabc` |
| 5 | Small leftovers | **Fixed.** The `--live` fallback uses `items` directly; `DEMO_TITLE`, `SIZING_TITLE` and `sizingSet` are no longer exported; `sqlRows` lives only in `src/server/db/dump.ts` and `tests/integration/driver.ts` re-exports it. | `c98cabc`, `dcb4b45` |
| 6 | README repeats the CI file | **Fixed.** Two sentences and a link to `ci.yml`, keeping the `dev.log` hint. | `bcc55d1` |

Nothing was rejected or deferred. Epic 7 stays `in-progress`, because the manual SM-1 gate is still open.
