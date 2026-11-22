# Epic 3 ponytail review

Scope: `git diff epic-2-innsamling..epic-3-lukking` (stories 3.1 to 3.3), 41 files, about 3,700 added lines. Reviewed read-only. I assumed the load from the PRD and the README: one Host, up to 50 invite links, up to 20 questions, 5 answers each, a handful of games at once.

What this change does: Closing the collection now runs in one database transaction. It turns every guest's answer set into `answer` rows with a fresh key per set and question, shuffles all rows across the whole game, deletes the invite links (the submissions go with them), moves the game to `grouping` and starts a 180 second lease. After the commit it runs a best-effort VACUUM FULL. Stories 3.2 and 3.3 add the anonymity tests (schema shape, data after close, Host view, server logs) and fix two flaky e2e tests.

No bugs found in the close logic. Checked: the Game lock is taken first, the count is checked again under the lock, the shuffle uses `crypto.randomInt`, and only the shuffled array is inserted. The worst case is 50 sets x 20 questions x 5 answers = 5,000 rows with 5 parameters each, which is 25,000 parameters. That is under Postgres's 65,535 limit, so the single INSERT is safe.

## Must fix

None.

## Should fix

1. **Same claim tested three times: the shuffle** (`tests/unit/shuffle.test.ts`, `tests/integration/collection.test.ts` "rows land shuffled", `tests/integration/anonymity.test.ts:260`)
   - **What this is:** Three tests prove that close does not keep arrival order.
   - **Problem:** The unit test proves the algorithm. The anonymity test proves the stored result (shuffled across keys and sets, one xmin and cmin) and is the strongest. The "no key's 5 rows stay contiguous" test in `collection.test.ts` proves a weaker version of the same thing. Each one has to be kept in step when the schema or fixture changes.
   - **Fix:** Delete the `collection.test.ts` shuffle test. Keep the unit test and the anonymity test.
   - **If we skip it:** Nothing breaks. You pay more upkeep and the proof looks bigger than it is.

2. **Same claim tested at two layers: "the Host sees nothing new"** (`tests/integration/host-view.test.ts:63` and `tests/e2e/host-anonymity.spec.ts:83`)
   - **What this is:** Both check that Host pages and responses are identical before and after a guest submits, that only the count changes at three, and that no output holds a Token or an Answer.
   - **Problem:** The integration test covers the server reads and refused actions. The e2e test covers the same ground through a browser, and the log capture covers "no secret in the output" a third time. Three places must change when the Host view changes.
   - **Fix:** Keep the integration test for the "identical output" claim. Cut the e2e test down to what only a browser can show: no push or polling during collection, and a used link reopens as an empty form. Leave the log scan to `server-output`.
   - **If we skip it:** Slower e2e runs and double edits. No wrong behaviour.

3. **Four near-identical race tests for close versus submit** (`tests/integration/collection.test.ts`, the last four `it(...)` under `describe("close")`)
   - **What this is:** Close between lookup and lock, submit before close, close waiting for a submit, and "unordered, never partial".
   - **Problem:** They all assert one rule: a set is either fully in the answers or the submit is refused. The Game lock gives that rule. The first, third and fourth differ only in who gets the lock first.
   - **Fix:** Keep "committed between lookup and lock" (the dangerous order) and "close waits for submit". Fold the other two into them.
   - **If we skip it:** About 80 lines of upkeep. The coverage is the same.

4. **Dead end until Story 4.2** (`src/app/spill/[id]/page.tsx`, the `grouping` branch)
   - **What this is:** After close the Game sits in `grouping` and shows "Gruppering ... Det tar vanligvis under to minutter". Nothing runs Grouping and nothing moves the Game on.
   - **Problem:** The `shortcut:` comment says this honestly. But once this branch is merged to `main`, a Host who confirms the dialog ("Dette kan ikke angres") has a Game that can only be deleted. The no-key sentence also promises manual grouping that does not exist yet.
   - **Fix:** No code change. Do not demo from `main` between the merge of epic 3 and epic 4, or merge both before sensor-facing use. Say so in the PR description.
   - **If we skip it:** Someone clicks close on `main`, waits, and thinks the app is broken.

## Nice to have

5. **`NORMALIZE_VERSION` is never read** (`src/lib/normalize.ts:3`, `tests/unit/normalize.test.ts:5`)
   - **What this is:** An exported constant, `1`, with a comment saying to bump it when the rule changes.
   - **Problem:** Nothing in `src/` uses it and nothing stores it, so bumping it does nothing. The only user is a test that asserts it equals 1. That test would pass even if the rule changed.
   - **Fix:** Delete the constant and its test. Keep the comment as plain text on `normalize`, or store the version in a column when Grouping needs it.
   - **If we skip it:** A reader thinks old rows can be told apart by version. They cannot.

6. **The focus-the-heading trick is now written three times** (`src/components/CloseCollection.tsx:38-47`, `InviteLinkView.tsx:65`, `AnswerForm.tsx:283`; `RouteFocus.tsx:7` does the same job)
   - **What this is:** Set `tabindex=-1` on the `<h1>` and focus it.
   - **Problem:** Four copies. A fix to one (for example when the h1 is missing) will miss the others.
   - **Fix:** Add one `focusHeading()` helper next to `RouteFocus` and call it from the four places.
   - **If we skip it:** Small drift risk, about 12 lines.

7. **Nested ternary in `transition`** (`src/server/games/index.ts:147-157`)
   - **What this is:** One `.set(...)` that picks the update by target state.
   - **Problem:** Three branches inside one expression are harder to read than they need to be. The lease SQL is the only part that is special.
   - **Fix:** Build a small `extra` object before the update: `const extra = to === "played" ? {...} : to === "grouping" ? {...} : {}` and write `.set({ state: to, ...extra })`.
   - **If we skip it:** Works as is. Readability only.

8. **Second `next dev` server for the log test: keep it, the cost is acceptable** (`playwright.config.ts:60-84`, `tests/e2e/server-output.*`)
   - **What this is:** The question asked was whether a simpler setup proves the same thing. I looked for one.
   - **Finding:** I found none that proves the same thing. `next dev` is the only mode that prints Server Function arguments and forwards browser console output, so a log scan against `next start` alone would miss the leak path the test targets. A unit test of the logger would not show what Next itself prints. The setup is small: it uses a separate port and database, the `shortcut:` comment is honest, and the README warns about the one-dev-server rule. The teardown scan is the right size: one JSONL file of values, SHA-256 needles and a fail-if-log-empty check, so a broken capture cannot pass silently.
   - **Two cheap trims, optional:** (a) The `shortcut:` comment says one `next dev` runs per repo. That is the real friction, since a Host developer who forgets to stop `npm run dev` gets a confusing failure. Passing a different `distDir` to the e2e dev server via an env var in `next.config` would remove the README warning and the shortcut. Do that only if it bites. (b) `fixtures.ts` records secrets in an async `response` handler, so a response that finishes after teardown starts is missed. That is a small hole in a test that is otherwise a strict proof, not a reason to simplify.

9. **VACUUM FULL takes a strong lock** (`src/server/db/vacuum.ts`, called from `close`, `deleteOwned`, `purgeExpired`)
   - **What this is:** A table rewrite of `submission` and `invite_link` after each close, each delete of a collecting Game and each purge that removed one.
   - **Problem:** `SKIP_LOCKED` stops it waiting on a held table. If it does get the lock, it blocks live submits during the rewrite. With 50 links and small rows that is milliseconds, so it is fine at the expected load. It would not be fine with hundreds of games closing at once.
   - **Fix:** No change now. Add `shortcut: VACUUM FULL blocks submits during the rewrite, fine below a few hundred games, switch to plain VACUUM or a scheduled job above that` to `vacuum.ts`, since the file has no shortcut comment about this.
   - **If we skip it:** Nothing at current scale.

## Checked and found fine

- The pinned-column tests (`anonymity.test.ts:120`, `host-view.test.ts:241`, the env key list) are brittle on purpose. They fail when anyone adds a column, and the comment says to update them deliberately in Story 4.2. This is the required anonymity proof and is not duplicated elsewhere, so it stays.
- The `shortcut:` comments are honest: the grouping panel, the single dev server, and the fixture that skips Answers under 3 characters or shaped like a UUID. Each names its limit and when to upgrade.
- The flaky-test fixes in `games.spec.ts` (separate anonymous context, waiting for the loading prefetch) fix the cause and do not add retries.
- No requirement was cut. Nothing in the diff is unrequested product code.

Verdict: Ship. Nothing blocks the merge. Do 4 in the PR text, and 1 to 3 if you want less test upkeep.
Lean: about -230 lines possible (mostly duplicated tests in 1 to 3, plus 5 to 7).
Not checked: I did not run the test suites or the e2e run, and I did not check the line counts of the truncated test bodies exactly, so the lean number is an estimate.

## Epic 3 review fixes (2026-11-22)

Fixed on `epic-3-lukking` in commits 650b108, 0f3924b, 2c46106 and c2b0877. Every AC and every TRACE.md row is still covered, and `tests/TRACE.md` is updated.

- **1 (fixed).** The "no key's rows stay contiguous" test in `collection.test.ts` is deleted. In its place is a different property: close calls `shuffle` once with every row and inserts exactly what it returns (bmad finding 5). The unit test and the anonymity test still prove the algorithm and the stored order.
- **2 (fixed, trimmed).** `host-anonymity.spec.ts` no longer checks that the output before and after a submit is identical, and the request-ID normaliser and sort that check needed are gone. `host-view.test.ts` keeps that claim. The e2e still does what AC2 asks and what only a browser shows: the response-body scan, the no-push window and the empty used-link form. It also keeps the `secrets.jsonl` check, which guards the recorder.
- **3 (fixed).** "Submit committed before close" is deleted, because the main close test already submits every set before closing. "Unordered submit and close" is deleted too, because PGlite runs it in sequence. "Committed between lookup and lock" and "close waits for submit" stay, and a new test pins the `for update` lock (bmad finding 3).
- **4 (skipped).** It belongs in the PR text.
- **5 (not deleted).** Story 3.1 AC1 requires `NORMALIZE_VERSION` to be exported, and AD-12 records it in rulings and `grouping_result` in Epic 4. The comment now says that nothing stores it yet.
- **6 (fixed).** The four copies now call one `focusHeading()` helper, exported from `RouteFocus.tsx`: `RouteFocus`, `InviteLinkView`, `AnswerForm` and `CloseCollection`. It is a plain function rather than a hook, because `AnswerForm` calls it from a click handler.
- **7 (fixed).** `transition` builds its extra fields before the update.
- **8 (no change).** The review's own verdict was to keep it.
- **9 (fixed).** `vacuum.ts` now has a `shortcut:` comment about the ACCESS EXCLUSIVE rewrite.
