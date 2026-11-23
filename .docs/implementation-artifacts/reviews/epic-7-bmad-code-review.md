# Epic 7 code review (bmad-code-review)

- **Date:** 2026-11-23
- **Scope:** `git diff origin/main...epic-7-demo-og-levering`, which covers stories 7.1 (Demo mode with one command), 7.2 (Judge evaluation against ProtoQA), 7.3 (traceability, manual checklists and the SM-1 gate), 7.4 (README, hand-in zip and fresh-clone check) and 7.5 (pilot deployment, first to cut). 23 commits. `origin/main` already holds epics 1 to 6 and the README and diagram rework, and both are merged into the branch.
  - 68 files changed, +6,734/-242.
  - The reviewers read the diff without `data/rulings/protoqa-dev.json`, `data/protoqa/dev.crowdsourced.jsonl`, `docs-assets/` and `.docs/`: 3,793 lines, 177 kB. The Acceptance Auditor also had the full diff, and it read the specs and planning documents directly.
- **Mode:** `full`. The diff was checked against:
  - `spec-7-1` to `spec-7-5`, including their review sections, `deferred` lists and orchestrator notes. Items those logs rejected were not raised again unless there was a new argument;
  - `epic-7-context.md` and Epic 7 in `epics.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-13, AD-14, AD-19, AD-20, AD-22, AD-23 and AD-24 as amended, and `delivery-notes.md`;
  - the PRD: FR-31, FR-32, NFR-1, NFR-2, NFR-3, SM-1, SM-2 and §6.5.
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:**
  - `npm run demo`: `src/cli/demo.ts`, the seed, the `tsconfig.cli.json` mapping into Next internals, whether deleting `.data/demo` is safe, and whether the `DEMO_MODE` surfaces ever show outside the demo;
  - `judge:eval`: the B-cubed maths, the per-Question fallback stored as `model: "fallback: <reason>"`, the version warning, keeping Question text out of the output, and how live calls are counted;
  - the new CI Postgres job and the game-state matrix test;
  - `trace.test.ts`;
  - `seed:sizing` and `db:dump`: they must never print URLs or secrets, and must not dump a hosted database by accident;
  - `scripts/make-zip.sh` and its test: it must never delete a real zip, and the zip must hold no secrets;
  - whether the README matches the code (commands, defaults in the environment table, limits and figures);
  - test gaps.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `parseEnv`, the replay provider's `loadRulings` and `partition`, `openDb`'s migrate-on-open, `games.purgeIfDue` and its only caller, `data/rulings/demo.json` and `protoqa-dev.json` (52 rulings: 37 from `deepseek/deepseek-v4.1-flash` and 15 `fallback: INVALID_OUTPUT`), the `live-half` and `live-down` tests in `judge-eval.test.ts`, the `db:dump` failure tests in `manual-tools.test.ts`, and the SM-1 gate and F1 record in `tests/manual/checklist.md`.
  - No OpenRouter call was made, and no `.env` file was read.
- **Test run:** not run. No finding depended on a test result. `test:e2e` was not run either.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story files was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 1 | decision needed |
| Low | 13 | patch |
| Deferred | 0 | |
| Dismissed | 17 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **`npm run demo` (FR-31, AD-19, AD-22).**
  - `src/cli/demo.ts` sets `DATABASE_URL`, `JUDGE_PROVIDER=replay`, `DEMO_MODE=1` and `APP_BASE_URL` before any server module is imported. Node's `--env-file-if-exists=.env.local` never overrides a key that is already set, so neither `.env.local` nor a key in the shell can point the demo at another database or at the live Judge. `next dev` inherits the same environment, and Next's own `.env` loading does not override it either.
  - The delete is `rm(path.join(process.cwd(), ".data", "demo"), { recursive: true, force: true })`. The path is fixed, no environment value can widen it, and `npm run` always sets `cwd` to the package root. If `.data/demo` is a symlink, only the link is removed.
  - The seed goes through `auth.createHost`, `games.create`, `questions.save`, `collection.createInviteLinks` and `collection.submit` only. It prints nothing but the URL and the invented login on the reserved `.test` domain. Tokens and links stay inside `seed()`.
  - `tsconfig.cli.json` re-declares `@/*`, because `paths` replaces the parent's map instead of merging with it, and maps `next/navigation` to its `react-server` build. The `shortcut:` comment in `demo.ts` records the upgrade risk. Only `demo` and `seed:sizing` use this file.
  - **`DEMO_MODE` surfaces.** Each one is gated on `env.DEMO_MODE` in a server component: the notice on `/`, the login hint and "Fyll inn demobrukeren" on `/logg-inn`, and the band in `HostChrome` on `/spill/**` and on the not-found page. `AccountForm` receives the login as a prop and never imports `DEMO_HOST`, so the login is in no client bundle unless Demo mode is on. `/` calls `connection()`, so a production build reads the flag at run time. The e2e test without `DEMO_MODE` checks `/`, `/logg-inn` and a Host page.
- **`judge:eval` (FR-32, SM-2, AD-20).**
  - **B-cubed maths.** `bcubed()` is the standard weighted micro B-cubed. An answer's precision is its weight in (gold ∩ group) divided by the group's weight, and its recall is the same intersection divided by the gold cluster's weight. Both are weighted by answer count and averaged over all answers. Keys are scoped per Question with the `q:` prefix and JSON-encoded so they cannot collide. F1 cannot divide by zero, because each item counts towards its own intersection. The hand-computed case in the unit test (P 3/4, R 7/9, F1 42/55) is correct.
  - **`parseLabelled`.** It builds items with the same `itemsOf` that `judge:record` uses, so `items`, `weights` and `gold` stay aligned by item. On a tie, gold goes to the cluster met first in the raw answers, as the comment says.
  - **Fallback.** A failed Question in `--live` is stored with `items` from `itemsOf`, assignments `0..n-1`, the current `PROMPT_VERSION` and `model: "fallback: <reason>"`. The version warning skips models that start with `fallback: `. When every Question fails, nothing is written. `protoqa-dev.json` matches the README and checklist: 15 fallbacks out of 52, all `INVALID_OUTPUT`.
  - **Output.** Only aggregates are printed. The fallback line lists reasons only. A bad `--file` line is named by its number, never its content.
  - **Live call counting.** The wrapper adds `result.calls` for each successful partition, and the catch block adds `error.calls` for each failed one. Replay returns `calls: 0`, so the offline run prints 0.00 by design (spec 7.2, Design Notes). The count is correct, but one branch of it is untested (finding 6).
  - **Refusal.** `--live` and `--file` refuse before reading any input when there is no key. The replay Judge is created after the rulings file is written and loads the file lazily, so the replay after `--live` reads the fresh file.
- **CI Postgres job.** It runs a `postgres:17-alpine` service with a health check. `tests/postgres-setup.ts` creates, migrates and later drops (`with (force)`) one database per test file, and it is listed before `tests/setup.ts`, so `DATABASE_URL` is set before `env.ts` parses it. `db.test.ts` fails the job if it ever runs on PGlite. The four skips that apply only to PGlite are recorded in spec 7.3. The job has not yet run on GitHub (deferred in 7.3).
- **Game-state matrix (AC2, AD-4).** It calls 23 entry points of the 13 operations in all 7 states. Inside a permitted state it requires a non-`INTERNAL` outcome. Outside one it requires the refusal that fits the kind: `WRONG_STATE` for a Host entry, `COLLECTION_CLOSED` for a Participant entry, and no `grouping_result` for a Grouping entry. Finding 8 covers the one weak branch.
- **`seed:sizing` and `db:dump`.**
  - `seed:sizing` deletes only the fixed `.data/sizing` path and prints only the invented login.
  - `db:dump` loads no env file, so it reads only the shell's `DATABASE_URL` or the default `pglite://.data/local`. On failure it prints only an error code, never the message, and the test with a password in the URL proves this. It refuses a PGlite directory that does not exist instead of creating one.
  - **Residual risk, not a defect:** a `postgres://` URL exported in the shell is dumped as asked. The pilot migration note has the tester export the production URL and then close the terminal session. That procedural step, not a code guard, is what keeps a later `npm run db:dump` in the same shell from dumping production. See the dismissed item 1.
- **`scripts/make-zip.sh`.** It deletes nothing. `git archive -o` writes only the chosen output, and by default that is the root `G101-alfnes-sarjomaa.zip`, which `.gitignore` anchors. Only tracked files are packed, so `.env.local`, `.idea/`, `.data/`, `.next/` and `node_modules/` cannot ship. The test writes its zips to a temporary directory or to a throwaway repository, and checks that the only `.env*` entry is `.env.example`. The F1 record also lists a name and secret scan of the zip.
- **README against the code.**
  - All nine variables and their defaults in the environment table match `env.ts` and `.env.example`.
  - "`npm run demo` setter selv …" names exactly the four keys that `demo.ts` sets.
  - The demo login and "seks svarsett" match `DEMO_HOST` and `DEMO_SETS`.
  - Node `>=22.13` and the CI matrix (22 and 26) match. The CI command list matches `ci.yml`, including the demo smoke and the Postgres command.
  - The SM-2 figures (F1 0.6849, P 0.9809, R 0.5261, 1.40 calls per Question, 15 `INVALID_OUTPUT`) match the checklist, spec 7.2 and the committed rulings.
  - The 30-second limit matches `JUDGE_TIMEOUT_MS`.
  - Findings 11 and 12 list what does not match.

## Findings

### Medium

#### 1. `judge:eval --file` stops the whole run on one failed Question, while `--live` now falls back per Question

- **Location:** `src/server/judge/eval.ts:87-96` (`evaluate` tolerates only `NO_KEY` and `NO_STORED_RULING`), and `src/cli/judge-eval.ts:101-104` and `:141-146`.
- **Source:** Blind Hunter and Edge Case Hunter.
- **What happens:**
  - `--file <path>` scores a local labelled set with the live Judge. This is the only route to SM-4, the measurement on real Norwegian Answers, which the README lists as not yet run.
  - A `TIMEOUT` or `INVALID_OUTPUT` on any one Question is rethrown and ends in exit 1 with no figure.
  - In the ProtoQA run, 15 of 52 Questions failed with `INVALID_OUTPUT`. A real `--file` run will very likely fail the same way and produce nothing, after it has already paid for every call made before the failure.
- **Why this is raised again:** the 7.2 log rejected this ("One failed Question discards a whole `--file` run", reason: "scoring a failed Question as singletons would mix fallback into the figure"). That decision came before the live recording. After the live recording, the same story changed `--live` to do exactly that mixing, because one failed Question "measured nothing" (spec 7.2, live-recording note). The two modes now treat the same failure in opposite ways, and the reason for the rejection no longer holds for `--live`.
- **Why it needs a decision:** spec 7.2's I/O matrix still describes the behaviour that stops on the first failure. A fix reverses a decision recorded in the spec.
  - **Option A (recommended):** give `--file` the same FR-17 fallback as `--live`. Score a failed Question as one Group per item, and print the count of fallen-back Questions with their reasons. No Question text is printed. Then amend spec 7.2's I/O matrix and AD-20.
  - **Option B:** keep the current behaviour, and state in the README and in AD-20 that `--file` gives no figure if any Question fails. In practice SM-4 then cannot be measured with this model.
- **Test (option A):** in `judge-eval.test.ts`, run `evaluate()` in-process with a Judge that throws `INVALID_OUTPUT` on the second Question. Assert that the result still has figures and that the fallback count is 1.

### Low

#### 2. Tests, trace and spine still say the demo ruling is hand-written after it was re-recorded live

- **Location:** `tests/TRACE.md:380` ("zero Judge calls and model `hand-written`"); `ARCHITECTURE-SPINE.md:308` (the 7.1 amendment: "`demo.json` is hand-written … `model` and `promptVersion` both `"hand-written"` so nothing claims a model made it"); `tests/e2e/demo.spec.ts:54` ("The hand-written ruling joins near-synonyms").
- **Source:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor.
- **What happens:**
  - Commit `e7e77bb` replaced `data/rulings/demo.json` with a live recording. All three rulings now carry `model: "deepseek/deepseek-v4.1-flash"`.
  - `demo-replay.test.ts` asserts that model and pins the full partition.
  - The trace row describes an assertion that no longer exists. The spine says the opposite of what the data now holds.
- **Why it matters:**
  - `TRACE.md` is the SM-1 evidence, and the spine's own Delivery rule says a departure amends it in the same PR.
  - A developer who follows the spine would hand-write the file with `"hand-written"`, and the pinned test would then fail.
- **Fix:**
  - Rewrite the TRACE bullet to name the recorded model and the pinned partition.
  - Add an "*Amended after the live recording*" line under AD-14.
  - Drop "hand-written" from the e2e comment.

#### 3. The CI demo smoke can outlive its step timeout and lose the log

- **Location:** `.github/workflows/ci.yml:68-84`; the claim is in `tests/TRACE.md:407` ("failing with the log after 120 s").
- **Source:** Edge Case Hunter and Acceptance Auditor.
- **What happens:**
  - The loop makes 120 tries, each `curl -m 5` plus `sleep 1`.
  - If `next dev` accepts the connection but hangs while compiling, the loop needs up to about 720 s.
  - `timeout-minutes: 5` then kills the step before `cat demo.log` runs, so the failure shows no log.
- **Fix:** use a deadline instead of a try count, for example `end=$((SECONDS+120)); while [ $SECONDS -lt $end ]`, with `curl -m 2`. Alternatively, raise `timeout-minutes` above the worst case of the loop.

#### 4. No test shows the demo band on the not-found page

- **Location:** `src/app/not-found.tsx:12`; `tests/e2e/demo.spec.ts`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** FR-31 puts the band on every Host page, and `not-found.tsx` was changed to pass `demo`. The demo e2e test never visits an unknown path, so dropping that prop would break no test.
- **Fix:** in the demo-server test, add `page.goto("/finnes-ikke")` and expect `BAND`.

#### 5. The working path of `npm run db:dump` has no test; only its failure paths do

- **Location:** `src/server/db/dump.ts:31-47` and `src/cli/db-dump.ts:4`; `tests/integration/manual-tools.test.ts:50-110`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** `dump(db)` is tested in-process. The CLI runs only twice, and both runs expect exit 1. Nothing runs `npm run --silent db:dump > file` against a real PGlite directory, which is the exact step the SM-3 audit uses. A lost `await` before `dump(...)`, or a stray line on stdout, would break the audit file and leave every test green.
- **Fix:** migrate a PGlite directory under `temp` (`openDb` and `migrateDb`), run `dumpCli("pglite://<dir>")`, and assert exit 0 and that `JSON.parse(stdout)` has a `game` key.

#### 6. No test counts the calls of a Question that fell back in a `--live` run

- **Location:** `src/cli/judge-eval.ts:75` (`calls += error.calls`); `tests/integration/judge-eval.test.ts:423-442`.
- **Source:** Acceptance Auditor.
- **What happens:** the 7.2 live-recording note says that a failed Question's calls now count. The `live-half` test never checks the "Judge calls per Question" line, so deleting that statement would break no test.
- **Fix:** in `live-half`, assert the calls line. The stand-in endpoint makes a known number of requests.

#### 7. No test covers a version warning caused only by a different prompt version

- **Location:** `src/cli/judge-eval.ts:110`; `tests/integration/judge-eval.test.ts:399-420`.
- **Source:** Acceptance Auditor.
- **What happens:** AC2 says the run "warns when they differ". The only warning test changes the model. The test that changed the prompt version was removed together with the placeholder, so dropping the `promptVersions.some(...)` clause would break no test.
- **Fix:** add one spawned run whose stored ruling has `promptVersion: "0"` and the current model, and expect the warning.

#### 8. The game-state matrix counts a crashing Grouping entry as "refused"

- **Location:** `tests/integration/game-state.test.ts:515-528`, and the comment at `:293`.
- **Source:** Blind Hunter and Acceptance Auditor.
- **What happens:**
  - For `kind: "grouping"`, a refusal is decided only by `results.length === 0`. Outside its permitted states, a `grouping.run` or `resumeIfStale` that throws `INTERNAL` or crashes still passes as refused.
  - The comment at `:293` says "any other outcome counts", but the code rejects `INTERNAL`.
- **Fix:**
  - In the Grouping branch, also require `outcome` to be `"ok"`, which is the silent stop the header describes.
  - Change the comment to "any outcome except `INTERNAL` or a crash".

#### 9. `trace.test.ts` counts bullets that say they are not covered

- **Location:** `tests/unit/trace.test.ts:36-41`.
- **Source:** Blind Hunter and Acceptance Auditor.
- **What happens:**
  - A bullet traces if it matches `\bCI\b` or names an existing `tests/` file, unless it *starts* with "Open" or "Pending".
  - So "Timed by hand, not in CI" counts as CI coverage.
  - `tests/TRACE.md:200` names `anonymity-audit.md` and ends with "Open until it is run", and it counts as traced.
  - No FR passes falsely today, because every affected section has a real bullet as well. The check is weaker than the header at `TRACE.md:3` says, though.
- **Fix:** also skip bullets that contain "not in CI" or "Open until". Then require "CI runs" rather than a bare "CI".

#### 10. `db:dump` hides its own error message for a PGlite directory that does not exist

- **Location:** `src/server/db/dump.ts:40`, and `src/cli/db-dump.ts:8-15`.
- **Source:** Blind Hunter.
- **What happens:** the error is thrown with a safe message and no `code`. The CLI prints only `code`, so an auditor who mistyped the path sees just "db:dump failed. Check DATABASE_URL.".
- **Fix:** set `code: "PGLITE_DIR_MISSING"` on the error. The existing `FAILED` pattern in the test already accepts a code.

#### 11. The two new scripts are missing from the spine's script list and from the README

- **Location:**
  - `ARCHITECTURE-SPINE.md:515`, the Scripts row: "README, CI and Playwright use these names only";
  - `ARCHITECTURE-SPINE.md:412`, the CLI row: every `src/cli` script loads `.env.local`;
  - `README.md:322`, the `src/cli` row: lists `demo`, `judge:*` and `db:*` but not `seed:sizing`;
  - `package.json:22-23`.
- **Source:** Acceptance Auditor.
- **What happens:** `db:dump` and `seed:sizing` were added, and both leave out `.env.local` on purpose, which was the 7.3 safety patch. Neither the Scripts row nor the CLI row was amended. A developer who follows the CLI row would add `.env.local` back to `db:dump`, and that undoes the patch.
- **Fix:**
  - Add both names to the Scripts row.
  - Add an "*Amended in Story 7.3*" note to the CLI row: `db:dump` and `seed:sizing` load no env file.
  - Add `seed:sizing` to the README row.

#### 12. The README's purge sentence leaves out the trigger

- **Location:** `README.md:116-117` ("Slettingen kjører bare mens appen kjører").
- **Source:** Blind Hunter. The Acceptance Auditor read the sentence as matching.
- **What happens:** the only triggers are `after(() => games.purgeIfDue())` in `src/app/spill/layout.tsx:17`, when a signed-in Host opens a `/spill` page, and `GET /api/purge` with `CRON_SECRET`. The pilot has no Cron (README line 174). A running app that no Host visits deletes nothing, so the sentence promises more than the code does.
- **Fix:** "Slettingen kjører når en vert åpner spillsidene (høyst én gang i timen), eller fra Cron."

#### 13. "Fyll inn demobrukeren" gives a screen reader no sign that it worked

- **Location:** `src/components/AccountForm.tsx:67-72`.
- **Source:** Blind Hunter.
- **What happens:** the fields fill silently and focus stays on the button, so a screen-reader user hears nothing (NFR-6).
- **Fix:** after filling, move focus to the "Logg inn" submit button. The button's name then tells the user what to do next. This adds one `ref` and needs no live region.

#### 14. The demo band says "lagrede avgjørelser", but the rest of the product says "kjennelser"

- **Location:** `src/components/HostChrome.tsx:55`; the README uses "lagrede kjennelser" (lines 213, 238 and 262).
- **Source:** Blind Hunter.
- **Fix:** change the band to "dommeren bruker lagrede kjennelser", and update `BAND` in `tests/e2e/demo.spec.ts:5-6`.

## Dismissed

1. **`db:dump` can dump production if the production URL is exported in the shell** (Acceptance Auditor). Low, and not reached in normal use. The command loads no env file (7.3 patch) and prints neither the URL nor the error message. The output goes only to the terminal of someone who already holds the production URL. The pilot note tells that person to close the session. A guard that refuses `postgres://` would remove a supported input (spec 7.3's I/O row). Listed under "Verified clean" as a residual risk.
2. **A second `npm run demo`, or an e2e run, deletes `.data/demo` under a demo that is already running** (Edge Case Hunter). This is recorded as a `shortcut:` in `playwright.config.ts`, and the README says to stop `dev` and `demo` before e2e. The second `next dev` then exits on Next's lock.
3. **No `child.on("error")` in `demo.ts`, and a double SIGINT** (Blind Hunter, Edge Case Hunter). The child is `process.execPath` running a resolved file, so spawn cannot fail in practice. Next handles a repeated SIGINT.
4. **`demo.ts` exits 0 when the child dies from an unforwarded signal** (Edge Case Hunter). The CI smoke checks `kill -0` and fails on a dead child before any health 200. A developer sees the crash in the terminal. The fix adds state for a case that is close to unreachable.
5. **`--live` with zero Questions overwrites the rulings with `[]`** (Edge Case Hunter). False. `--live` always reads the committed `DATASET`, which has 52 rows, and `--live` together with `--file` is refused.
6. **`--live` without `data/rulings/` loses the paid calls** (Edge Case Hunter). Rejected in the 7.2 log. The directory is tracked.
7. **`db:dump` on an empty existing directory, or with pending migrations, alters the audited database** (Edge Case Hunter). `openDb` migrates on open, but the audit database is built by the same commit, so no migration is pending and nothing is written. An empty directory needs a deliberate mistake that the procedure does not invite. Maybe-false. At worst low.
8. **The make-zip test inside an enclosing git work tree** (Edge Case Hunter). This needs the extracted zip to be placed inside another repository. It is unlikely, and the fix adds a guard.
9. **`auth.createHost` skips `REGISTRATION_CODE`, has no lint zone, and maps a duplicate email to `INTERNAL`** (Blind Hunter). It is a server module entry point, not a Server Action, so no request can reach it. Both callers seed a fresh, empty database, so a duplicate cannot occur.
10. **`VACUUM_SKIPPED` is never tested on Postgres** (Blind Hunter). Recorded in spec 7.3 as one of the four skips that apply only to PGlite: `SET ROLE` holds for one pooled connection only.
11. **No test covers `DEMO_MODE=1` on a production build** (Verification Gap, filed as `defer`). Low. The only documented demo path is `npm run demo` on `next dev`. Checking a built app with the flag at run time would need a third Playwright server.
12. **The extracted hand-in zip is never run** (Blind Hunter). No test or script depends on `.git`: the make-zip tests skip outside a repository or build their own. The F1 record ran the fresh clone, and the zip holds the same tracked tree.
13. **The replay provider in the app also loads `protoqa-dev.json`, including its fallbacks** (Acceptance Auditor). A Host's Question would have to normalise to one of the 52 English ProtoQA Questions. If one did, the result is one Group per item, which is the app's own fallback outcome.
14. **The default `judge:eval` run loads `.env`** (Acceptance Auditor). AD-20 as amended says "no key is used", and the run uses none. A malformed `.env` fails every key script the same way.
15. **"Open" bullets are not cross-checked against the SM-1 gate list, and NFR sections are checked only for a heading** (Blind Hunter). The trace test asserts neither, and its header does not claim it does. Adding the cross-check is a new feature of the test, not a defect.
16. **The README's `DATABASE_URL` row shows only `postgres://…`** (Acceptance Auditor). The row is an example, and `.env.example` names `postgres(ql)://`.
17. **`AccountForm` writes the password into the DOM directly** (Blind Hunter). The password field is uncontrolled, as before, so setting `.value` is the correct way to fill it.

## Verdict

**Approve after one decision and the low patches.** No high findings.

- **Correct and well guarded:**
  - Demo mode: a fixed delete path, environment overrides set before any import, and every surface gated on the server;
  - the B-cubed maths and the ProtoQA parsing;
  - the per-Question fallback as stored and the version warning;
  - aggregate-only output;
  - error handling in `db:dump` that never leaks secrets;
  - `make-zip.sh`, which never deletes anything and ships only tracked files;
  - the CI Postgres wiring;
  - the environment table in the README.
- **The one medium finding:** `judge:eval --file` stops on the first failed Question, while `--live` falls back. SM-4 cannot produce a figure with this model until the group decides (finding 1, option A recommended).
- **The low findings:**
  - documentation that went stale after the live demo recording (2), and the new scripts missing from the spine and README (11);
  - five test gaps (4 to 8) and a trace check weaker than its header (9);
  - the CI smoke timing (3), the `db:dump` message (10), the README purge sentence (12), feedback for screen-reader users (13), and one word in the copy (14).
- **Before the PR:** decide finding 1. Findings 2 to 14 are each a one-line or one-test change.

## Epic 7 review fixes

Fixed on 2026-11-23 on `epic-7-demo-og-levering`. Each finding was checked against the code before it was changed. `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run test` were green at every commit, and `npm run test:e2e` passed in full (99 tests) before the last code commit.

| # | Finding | Outcome | Commit |
|---|---|---|---|
| 1 | `judge:eval --file` stops on one failed Question | **Fixed, option A.** `evaluate()` treats a `JudgeError` other than `NO_KEY` and `NO_STORED_RULING` as `--live` does: one Group per item, its calls counted, its model reported as `fallback: <reason>`, and the same "Questions that fell back to one Group per item: N (reasons)." line. If every Question fails, the run exits 1 with the reason and no figure. Replay misses still stop the run. Tested with the stand-in endpoint (one fallback, and all failing). Spec 7.2 has a dated note and an amended matrix row; AD-20 is amended. | `c98cabc` |
| 2 | Demo ruling still called hand-written | **Fixed.** TRACE names the recorded model and the pinned partition, AD-14 has an "Amended after the live recording" line, and the e2e comment says "recorded". | `63927c7` |
| 3 | CI demo smoke can outlive its timeout | **Fixed.** A 120 s deadline with `curl -m 2`, so the log prints after at most about 123 s. TRACE states that bound. | `3fb74ee` |
| 4 | No test for the band on the not-found page | **Fixed.** The demo e2e visits `/finnes-ikke` signed in and expects the band. | `e57fb3e` |
| 5 | `db:dump` working path untested | **Fixed.** A spawned run on a migrated PGlite directory exits 0 with only JSON on stdout. | `c8635b5` |
| 6 | Calls of a fallen-back `--live` Question untested | **Fixed.** `live-half` asserts 1.50 calls per Question (one call plus a retried failure). | `c98cabc` |
| 7 | No warning test for a prompt-version-only change | **Fixed.** A spawned run with `promptVersion: "0"` and the current model expects the warning. | `c98cabc` |
| 8 | Matrix counts a crashing Grouping entry as refused | **Fixed.** Refused now means `outcome === "ok"` and no `grouping_result` row; the comment and TRACE say so. | `ffa69c8` |
| 9 | `trace.test.ts` counts uncovered bullets | **Fixed.** A bullet must say "CI runs" or name an existing `tests/` file, and bullets with "not in CI" or "Open until" never count. A small test pins the filter, and the TRACE header states the rule. | `ffa69c8` |
| 10 | `db:dump` hides the missing-directory reason | **Fixed.** The error carries `PGLITE_DIR_MISSING`, and the test expects that exact line. | `c8635b5` |
| 11 | New scripts missing from spine and README | **Fixed.** The Scripts row lists `db:dump` and `seed:sizing`, the CLI row says they load no env file on purpose, and the README `src/cli` row names `seed:sizing`. | `63927c7` |
| 12 | README purge sentence leaves out the trigger | **Fixed.** "Slettingen kjører når en vert åpner spillsidene (høyst én gang i timen), eller fra Cron når `CRON_SECRET` er satt." | `63927c7` |
| 13 | "Fyll inn demobrukeren" silent for screen readers | **Fixed.** Focus moves to "Logg inn" after filling, and the stale field errors from the last submit are hidden until the next one. | `e57fb3e` |
| 14 | "avgjørelser" against "kjennelser" | **Fixed, in the other direction.** The finding proposed changing the band to "kjennelser". `EXPERIENCE.md` uses "avgjørelser" for both the band and the fallback Notice, and the contract wins, so the README and the `oversikt` diagram now say "avgjørelser" and the band is unchanged. | `63927c7` |

**Dismissed item 1 revisited.** The residual risk of dumping a hosted database was closed with a cheap guard after all: `db:dump` refuses a `postgres://` URL unless `-- --postgres` is given. The supported input stays, but it must be chosen. Spec 7.3 and TRACE are amended. Commit `c8635b5`.

Nothing was deferred. Epic 7 stays `in-progress` in `sprint-status.yaml`, because the manual SM-1 gate is still open.
