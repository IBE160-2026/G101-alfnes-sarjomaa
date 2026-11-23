# Epic 4 ponytail review

Scope: `git diff epic-3-lukking..epic-4-gruppering` (stories 4.1 to 4.4). Assumed load: one host per game, a few Questions, tens of distinct Answers each, a handful of games at once. Nothing was changed.

What this change does: It adds one Judge boundary (`src/server/judge`) with three providers: replay (stored rulings), mock (tests) and openrouter (live, with stored rulings first). A grouping runner groups each Question once after close, with a lease so a stalled run can be resumed and a per-Question fallback to one group per answer. It also adds the usage counters and the downloadable report, and the recorder and smoke scripts.

I traced the main flow: close, `after()`, `groupPending`, `timedPartition`, the transaction that writes groups, the result and the counters, then `finishIfComplete`. The writes are idempotent (a stored result skips the Question), the lease is a compare-and-set, and no Answer text reaches the report or the prompt identity. I found no bug that breaks a requirement. The `shortcut:` comments are honest.

## Must fix

None.

## Should fix

1. **Test code is larger than the code it tests** (`tests/integration/grouping.test.ts` 799 lines, `report.test.ts` 588, `unit/judge.test.ts` 753; 2538 test lines against 1214 source lines)
   - **What this is:** 66 tests across four files, with long names that repeat the requirement IDs.
   - **Problem:** Several scenarios are tested two or three times. "A DB step fails and the boundary logs one content-free line" is built by renaming a table in `grouping.test.ts`, again for `game_counter` in `report.test.ts` and in the counter tests. The "replay with empty directory and no key falls back" case appears in both grouping and report tests. Each copy must be read and kept green.
   - **Fix:** Keep one test per behaviour: one boundary-failure test, one fallback-per-reason table, one lease race, one anonymity check on the report. Dropping about a third of them loses no requirement. `debloat-sondre` is the tool for this.
   - **If we skip it:** Nothing breaks. Later changes (Epic 5 will touch counters and groups) cost more to update, and a grader skimming the tests sees repetition.

2. **Two different "find a stored ruling" algorithms** (`providers/openrouter.ts:L45-62` and `providers/replay.ts:L66-100`)
   - **What this is:** OpenRouter mode first looks for a stored ruling with exactly the same items. Replay mode instead maps every item to a stored cluster and numbers the missing ones as singletons.
   - **Problem:** Both normalise the Question text, filter by `NORMALIZE_VERSION` and read the same files, but the match rules differ. A Question whose items are covered only partly gets a live call in one mode and a mixed result in the other. That is correct per the spec, but it is two rules to keep in step.
   - **Fix:** No code change needed if the spec wants both. If not, let openrouter call the replay judge first and go live only when it throws `NO_STORED_RULING` or `NO_KEY`. That removes about 15 lines and one rule. The partial-coverage `uncovered` counter would then also work in openrouter mode.
   - **If we skip it:** A fixture that works in demo mode may behave differently with a key set.

## Nice to have

3. **The smoke script patches `globalThis.fetch`** (`src/cli/judge-smoke.ts:L28-36`)
   - **What this is:** It wraps `fetch` to keep the first 300 characters of any error body, so a wrong key can be told from a wrong model.
   - **Problem:** Replacing a global to read something the provider already has is odd. It also hides the status from `JudgeError`.
   - **Fix:** Let `JudgeError` carry an optional `status` or short detail, set in the provider's `!response.ok` branch. The smoke script then prints `error.detail` and the patch (about 10 lines) goes away.
   - **If we skip it:** It works. It is only fragile if a second fetch runs in the same process.

4. **Retries that cannot help** (`providers/openrouter.ts:L82-87`, `L112-122`)
   - **What this is:** One retry after 429, 5xx or invalid output.
   - **Problem:** The `shortcut:` comment admits a 429 is retried at once, so it usually fails again. A retry at temperature 0 after invalid output is also likely to give the same answer. Each wasted retry spends a call and up to 30 s of the budget.
   - **Fix:** Retry only 5xx and network-level failures, or sleep `Retry-After` inside the signal. Keep it if the pilot shows invalid output is random.
   - **If we skip it:** Slightly higher cost and latency on the failure path only.

5. **`maxTokens` formula** (`judge/prompt.ts:L33-36`)
   - **What this is:** `64 + 4 * items` as the output bound.
   - **Problem:** The live run showed reasoning tokens eating it. The simpler approach is not a better formula but a flat generous bound (for example 2048; the answer list is tiny anyway) plus turning reasoning down or off in the request. That deletes the function and its comment. The bmad review covers the real fix.
   - **If we skip it:** Another formula tweak the next time a model changes.

6. **`info.provider` is only read by tests** (`judge/core.ts:L30`, set in three providers)
   - **What this is:** A field naming the provider.
   - **Problem:** Production code reads only `info.model` and `info.promptVersion`. The field exists to satisfy two tests.
   - **Fix:** Drop `provider` and assert on `getJudge()` behaviour instead, or keep it if the usage report will show it in Epic 5.
   - **If we skip it:** Three dead lines.

7. **One UPDATE per group inside the transaction** (`grouping/index.ts:L109-119`)
   - **What this is:** For each group it runs `UPDATE answer SET group_id ... WHERE normalized_text IN (...)`.
   - **Problem:** At tens of Answers per Question this is tens of small statements while the Game row is locked. It is fine at the assumed load.
   - **Fix:** One `UPDATE ... FROM (VALUES ...)` per Question. Only worth it if pilot Questions have hundreds of distinct Answers.
   - **If we skip it:** None at this size.

8. **Comment weight** (all new source files)
   - **What this is:** Most functions carry two to four lines of AD-number comments, and some comments restate the next line (for example the `JudgeError.calls` and `canonicalise` comments).
   - **Fix:** Keep the ones that explain a constraint (anonymity, "outside any transaction", `setImmediate` ordering). Cut the rest.
   - **If we skip it:** Reading cost only.

Verdict: Ship. Findings 1 and 2 are worth doing before the PR, the rest are optional.

Lean: -250 lines possible (about 200 of tests, 50 of source).

Not checked: the e2e specs and `tests/TRACE.md`, the drizzle snapshots, and the live OpenRouter path against a real key.

## Epic 4 review fixes (2026-11-22)

**1. Test code larger than the code it tests: fixed in `f560f26`.** Repeated scenarios were cut to one test per behaviour:
- Replay with no ruling is now one `it.each` (`NO_KEY` and `NO_STORED_RULING`) that also checks the counters, which replaces the copy in `report.test.ts`.
- The runner's DB failure is tested once, through the `game_counter` rename. That test now also checks the content-free `grouping`/`run` log line, so the `answer_group` rename copy is gone.
- The "run after a finished run" test checks counters as well, which replaces the counters-only copy.
- The wrong-length map case is gone, because `judge.test.ts` covers it and the runner already tests `INVALID_OUTPUT` as a `JudgeError`.
- The "counters equal the sum" test is gone, because the exact-delta test proves the same thing.
- The report's random-UUID 404 is gone, because `authz.test.ts` has it.

The Vitest suite went from 573 to 567 tests, and `report.test.ts` and `grouping.test.ts` lost about 85 lines net. Every AC, every TRACE row (updated to point at the surviving test), and every anonymity, no-network and content-free-log assertion is kept. This is smaller than the suggested third: the remaining tests each pin a distinct behaviour or an AC row.

**2. Two stored-ruling algorithms: skipped.** AD-13 says openrouter uses a stored ruling "only when its item set matches exactly", while replay maps partial coverage. Routing openrouter through the replay judge would answer a partly covered Question from stored clusters instead of making a live call. That changes behaviour the spine specifies, so the change was not made.

**3. The smoke script patches `globalThis.fetch`: fixed in `2a7f7ea`.** `JudgeError` has an optional `status` (the last non-2xx HTTP status), set by openrouter. `judge:smoke` prints it, and the fetch patch is gone. One trade-off: the smoke script no longer prints the first 300 characters of the error body, so a wrong model and an unsupported parameter now look alike (both 400). A 401 still points at the key.

**4. Retries that cannot help: unchanged.** The retry on 429 and 5xx stays. AD-13 requires one retry on invalid output, so that retry stays too.

**5. `maxTokens` formula: fixed in `12ae29a`.** It is now a flat `MAX_TOKENS = 2048`, with the arithmetic in a comment, and reasoning is off.

**6–8: skipped as agreed.** `info.provider`, one UPDATE per Group, and comment weight were left as they are.
