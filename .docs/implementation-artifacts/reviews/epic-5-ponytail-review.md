# Epic 5 ponytail review

Scope: `git diff origin/main...epic-5-gjennomgang` (stories 5.1 to 5.6). Assumed load: one host per game, at most 20 Questions, tens to a few hundred Answers per Question, a handful of games at once. Nothing was changed.

What this change does: It adds the Review screen (`/spill/[id]/gjennomgang`) and the `review` module behind it. The Host sees each Question's Groups ranked in Board order, with Counts and raw Answers, and can merge Groups, move Answers to another or a new Group, rename, discard and restore. Each Question is then marked reviewed, and "Lås brettet" writes a frozen `board_slot` snapshot, clears every Contributor key and rank, and moves the Game to *ready*. Story 5.6 adds the instructor's follow-ups: the new answer-form notice, a prompt-injection test, a text scan after delete, and a lint rule that keeps `judge/record` private.

I traced every write path: action, `hostAction`, the module entry point (`validate`, `lockForMutation` for *in review*, ID resolution inside the owned Game and one Question), the `grouping` writer, the counter bump, the cleared reviewed mark, and the result that the client announces. Every edit runs in one transaction under the Game row lock, so two tabs cannot interleave. The DTOs pick named fields from `rankedGroups`, so `rank1Count` and `labelCandidates` never reach the browser, and no query selects `contributor_key` or `rank` for the Host. `confirmBoard` reads the Counts before `clearContributorData` empties the keys they come from. Every Question needs at least one Answer per Answer set (`parseAnswerSet`), so a Question can never be stuck with no Group to mark. `npm run typecheck` and `npm run lint` are clean. I found no bug that breaks a requirement, no `shortcut:` comment added in this epic, and no commented-out code or debug output.

## Must fix

None.

## Should fix

1. **Per-file Vitest timeouts left behind after the global setting** (`tests/integration/*.test.ts`, 14 files; `tests/unit/password.test.ts:L37`; `tests/integration/judge-cli.test.ts:L28-68`)
   - **What this is:** Commit `87ef237` moved the timeouts into `vitest.config.ts` (`testTimeout: 30_000`, `hookTimeout: 60_000`) and removed the per-file line only from `db.test.ts`.
   - **Problem:** Twelve integration files still start with `vi.setConfig({ testTimeout: 30_000 })`, and `anonymity.test.ts` with `{ testTimeout: 30_000, hookTimeout: 60_000 }`. These now repeat the global values exactly. `review.test.ts:L72` is new in this epic, so the branch adds one more. `password.test.ts` passes `{ timeout: 30_000 }` to `describe`, and `judge-cli.test.ts` passes `30_000` as the third argument to four `it` calls, also equal to the global value. The spec for 5.6 says "Vitest timeouts stay global", and a reader cannot tell which file actually needs a longer limit.
   - **Fix:** Delete the line (and its blank line) in the 13 files that repeat the global values, the `describe` option in `password.test.ts`, and the four trailing `30_000` arguments in `judge-cli.test.ts` (keep the `spawnSync` `timeout`, which is a process limit, not a test limit). Keep `host-view.test.ts:L37` (60 s, above the global value) with a one-line comment saying why it needs more.
   - **If we skip it:** Nothing breaks. The next time the global value changes, these lines silently override it, and a grader sees configuration repeated in 15 files.

2. **The same WRONG_STATE refusal is tested five times** (`tests/integration/review.test.ts:L840-862`, `L1126-1143`, the *ready* part of `L1241` and `L1399`, and `L1732-1772`)
   - **What this is:** After a real lock, the test at `L1732` calls merge, move, new Group, rename, discard, restore, mark, unmark and confirm, checks that each is `WRONG_STATE`, and checks that nothing changed. Before it, each operation's own `describe` sets the Game to *ready* by a direct UPDATE and checks the same refusal again.
   - **Problem:** Every operation reaches the refusal through the same line, `games.lockForMutation(tx, { states: PERMITTED.editReview })`. The four earlier copies add no path the real-lock test does not already cover, and they use a faked state instead of the real lock. The `draft` case in `L840` checks the same `PERMITTED` table row with a different value.
   - **Fix:** Delete the merge `it.each(["ready", "draft"])` and the move "Game in ready" test, and drop the *ready* assertions from the combined rename and discard tests. Point the TRACE rows for 5.2 AC2, 5.3 AC1 and 5.4 at `L1732`. About 50 lines go, with no loss of coverage. The epic-4 review raised the same pattern, and `debloat-sondre` is the tool for it.
   - **If we skip it:** Nothing breaks. Each copy must be kept green when the setup helpers change.

## Nice to have

3. **Two identical result types** (`src/server/review/index.ts:L302`, `L325`)
   - **What this is:** `RenameResult` and `DiscardResult` are both `{ groupId: string; label: string }`.
   - **Fix:** Keep one (for example `LabelResult`) and use it for rename, discard and restore.
   - **If we skip it:** One extra type to read.

Verdict: Ship. Findings 1 and 2 are cheap cleanups worth doing before the PR. Finding 3 is optional.

Lean: -80 lines possible (about 30 of timeout lines, 50 of repeated tests).

Not checked: the full Vitest and Playwright runs (other reviewers share this working copy), the drizzle snapshots, and whether the integration page-render tests in `review.test.ts` overlap with `tests/e2e/review.spec.ts` beyond what the titles show.
