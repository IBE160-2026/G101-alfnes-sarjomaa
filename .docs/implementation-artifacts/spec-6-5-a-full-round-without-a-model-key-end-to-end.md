---
title: 'Story 6.5: A full round without a model key, end to end'
type: 'feature'
created: '2026-11-23'
baseline_revision: '91be659ddc09c7fe86ff505b9a14d5dfba10c9e7'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-6-4-next-question-final-scores-and-the-played-game.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Every Stage 1 step is proved by its own e2e test, but nothing proves the whole loop in one run with no model key and no network (FR-30), the axe pass over the answer form, Review and play is spread over several specs (NFR-6), and FR-11's server-output capture has never run over a full round. Story 6.5's three ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract (AD-13, AD-22).

**Approach:** One Playwright spec, `tests/e2e/no-key.spec.ts`, that drives one Host through register → Game → two Questions → three links → three Answer sets from three browser contexts → close → fallback Grouping with the `NO_KEY` Notice → one merge → mark both Questions → lock → two named Teams → scored and unscored Reveals, one undo, the next Question → "Sluttstilling", with axe on the answer form, Review and the play view, and the final Scores checked against the Counts the spec saw on the scored tiles. Reuse the e2e fixtures; the only fixture change extracts the form filling from `submitSets` so the spec can scan the filled form before it submits.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (`full`). No UI is built, so `impeccable` does not apply unless a real app bug needs a UI fix.
- **No key, no network:** the spec runs under the existing `playwright.config.ts` (`OPENROUTER_API_KEY: ""`, `JUDGE_PROVIDER: "replay"`) and imports `test` from `./fixtures`, so the default context passes through `localOnly`; every extra browser context the spec opens calls `localOnly(context)` before its first page. Review showing the `NO_KEY` Notice is the proof that replay missed with no key (AD-13).
- **Three contexts:** each Answer set is submitted from its own `browser.newContext({ baseURL })`, closed after its confirmation heading "Svarene dine er lagret.".
- **Fixture:** extract the per-link field filling from `submitSets` in `tests/e2e/fixtures.ts` into an exported `fillSet(page, i, sets = [SETS])` ("set i answers Question q with `sets[q][i]`"); `submitSets` calls it and otherwise behaves exactly as before.
- **Data:** Questions `QUESTION` (with `SETS`) and "Hvilken farge har hytta?" (sets `[["Rød"], ["Blå"], ["Rød"]]`); Team names "Hyttegjengen" and "Byfolket" typed over the prefilled fields.
- **Merge:** Frida and Per (Per is below the Board line as Group 9), so the merged Group counts 2 people and the "Ikke på brettet" region disappears.
- **Score check:** every scored Reveal reads its Count from the revealed tile (`/(\d+) poeng$/`) into a per-Team list, the undo removes the last one, and "Sluttstilling" must list each Team with exactly the sum of its list, sorted by Score with "Vinner" on the top Team. Unscored Reveals change no Score.
- **Robustness:** every step waits on UI state (URL, heading, text, role, `aria-pressed`, Score text); no fixed sleeps and no Playwright clock. The test is marked `test.slow()` (a full round is far longer than one 6.x test on a 4-core CI runner).
- **FR-11:** the teardown in `server-output.teardown.ts` already fails the run on any recorded Token or Answer in `start.log`/`dev.log`; the spec asserts, as `host-anonymity.spec.ts` does, that `secrets.jsonl` holds its three Tokens and every Answer it sent, so the scan covers this round.
- FR IDs in the test title. `tests/TRACE.md`: replace "Pending: Story 6.5." under FR-11 and FR-30 with the rows, and add NFR-3 and NFR-6 rows. Set story 6-5 to done in `sprint-status.yaml`; epic-6 stays in-progress.
- If the flow exposes a real app bug, fix it at its root with the smallest change and a test, and record it in this spec.

**Never:**
- No new dependency, test-only server hook, fixed sleep, retry, per-test network stub or second copy of the teardown's log scan.
- No change to other specs' behaviour beyond the `fillSet` extraction. No `wiki/`, `.logs/`, `.env` or `.claude/skills/excalidraw-diagram/` edits; no absolute machine paths or real names in tracked files.

</intent-contract>

## Code Map

- `tests/e2e/fixtures.ts` -- `test` (fixture context through `localOnly`), `localOnly(context)` (blocks non-local hosts, records Tokens and Answers into `$E2E_OUT_DIR/secrets.jsonl`), `collectingGame(page, questions)` (register, Game "Hyttetur", Questions, 3 links; returns `{ gamePath, links }`), `submitSets` (one context, loop body to extract as `fillSet`), `closeAndOpenReview(page, gamePath)` (waits up to 10 s for "Til gjennomgang"), `seriousViolations(page)` (waits for `<title>`), `QUESTION`, `SETS`.
- `tests/e2e/server-output.teardown.ts` -- global teardown: word-bounded scan of both logs for every recorded value and its sha256. Read-only.
- `tests/e2e/host-anonymity.spec.ts` (:210) -- the `secrets.jsonl` read pattern to copy.
- `tests/e2e/review.spec.ts` -- `NO_KEY` text (:15); merge through `[data-selection-bar]` and "Velg gruppen «X»" checkboxes, "Slå sammen 2 grupper" (:412); Frida + Per result (:296).
- `tests/e2e/play.spec.ts` -- locators for stage, tiles, teams list, control bar (`hint.locator("..")`), "Angre [Z]", "Neste lag [T]", the uten-poeng toggle, "Neste spørsmål"/"Vis sluttstilling [N]", "Sluttstilling" list (:446–:863); mark-and-lock flow for several Questions (:705).
- `playwright.config.ts` -- the no-key env and both webServers; unchanged.
- `tests/TRACE.md` -- FR-11 (:170), FR-30 (:366), NFR-3 (:404), NFR-6 (:435).
- `.docs/implementation-artifacts/sprint-status.yaml` -- `6-5-...: backlog`.

## Tasks & Acceptance

**Execution:**
- `tests/e2e/fixtures.ts` -- export `fillSet`; `submitSets` uses it.
- `tests/e2e/no-key.spec.ts` -- the one test described above, title starting "FR-30, FR-11, NFR-3, NFR-6:".
- `tests/TRACE.md` -- FR-11, FR-30, NFR-3, NFR-6 rows.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 6-5 done.

**Acceptance Criteria:**
- Given the app built with no key and every non-localhost browser request blocked, when `no-key.spec.ts` runs the whole round, then every step succeeds, Review shows the `NO_KEY` Notice, and each final Score equals the sum of that Team's scored Counts read from the tiles.
- Given the answer form (filled, before submit), Review (with the Notice) and the play view (with scored and unscored tiles), and "Sluttstilling", when axe scans each, then there are no serious or critical violations.
- Given the server-output capture, when the spec has run, then `secrets.jsonl` holds the spec's Tokens and Answers and the global teardown finds none of them in either server log.
- Given `--repeat-each=5`, when the spec runs five times in a row, then all five pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 24 findings — high 0, medium 3, low 16, false 5, maybe-false 0
- findings:
  - `[medium]` `[patch]` Blind: the Score check never pins a Count; it sums whatever the tiles show, so a wrong Count (e.g. the merge recount never reaching the locked Board) would still pass — `scored(n, team, text)` now waits for the exact tile text ("1Kari3 poeng", "2Frida2 poeng", "3Anne1 poeng", "1Rød2 poeng") before taking its Count.
  - `[low]` `[reject]` Blind: "checked to fail" only breaks the test's own bookkeeping, not the app — with the Counts now pinned, an undo that does not subtract fails `expectScores` after the pop; undo and unscored Reveals are also proved directly in the 6.3 integration and e2e tests. Proving it again by mutating app code adds nothing to this story.
  - `[low]` `[reject]` Blind: `secrets.jsonl` is shared by the run and de-duplicated, so `arrayContaining` passes even if the Participant contexts recorded nothing — AC3 is that every Token and Answer used in this spec is scanned; the teardown scans every value in the file whoever recorded it, so the assertion proves exactly that. The guest recorder itself is proved by `host-anonymity.spec.ts` with Answers unique to it.
  - `[low]` `[patch]` Blind: the title says "no network", but only browser requests are blocked (AD-22 guards the server by having no key) — title now reads "with no model key and every browser request outside localhost blocked".
  - `[low]` `[reject]` Blind: blocked requests are never counted — `localOnly` aborts them, which is the NFR-3 guard; a counter and assertion is new mechanism no AC asks for, and the app loads no external resource (`smoke.spec.ts` covers the block).
  - `[false]` `[reject]` Blind: the spec file is missing from the diff and its status disagrees with `sprint-status.yaml` — the spec is the claims file, kept out of the reviewed diff by the workflow; status and logs are mid-run state that finalize writes and commits.
  - `[low]` `[patch]` Blind: TRACE states "passes with `--repeat-each=5`" as if enforced — now "passed five times in a row with `--repeat-each=5` (2026-11-23)".
  - `[false]` `[reject]` Blind: Participant contexts leak when a step fails — a failed test makes Playwright tear down the worker and its browser, so no context outlives the failure; `submitSets` has run this way since Story 5.1 without trouble.
  - `[low]` `[patch]` Blind: a missed Count regex throws an opaque TypeError — fixed with the first row: the auto-retrying `toHaveText(text)` fails with the tile's real text, and the Count is parsed from the expected text.
  - `[low]` `[reject]` Blind: no `test.step` blocks — the commented phases and the retained trace locate a failure; no other spec uses steps, and consistency wins.
  - `[low]` `[patch]` Blind: the comment above `submitSets` duplicates `fillSet`'s — now says what `submitSets` adds (one context, a reload per link, submit, the confirmation).
  - `[low]` `[reject]` Blind: locators like `[role="status"].sr-only`, `.locator("..")` and `p[aria-live="polite"]` are tied to markup — the same locators `play.spec.ts` and `review.spec.ts` use; a markup change breaks those specs too, so one place to update.
  - `[false]` `[reject]` Edge: guest contexts stay open after a failed assertion — same refutation as the Blind leak row.
  - `[low]` `[reject]` Edge: the guest recorder could record nothing and the shared file still satisfies the check — same as the Blind `secrets.jsonl` row.
  - `[false]` `[reject]` Edge: a preset `E2E_OUT_DIR` keeps stale entries that satisfy `arrayContaining` — a stale value in the file is still scanned against this run's logs, so AC3 still holds; the logs are rewritten per run.
  - `[low]` `[reject]` Edge: the spec claims the scan covers the guest contexts — the claim (TRACE FR-11 row) is that the round's values are in the scan, which the assertion proves; see the Blind row.
  - `[low]` `[patch]` Intent: the server's own requests are not blocked — same root cause as the title row; wording fixed, AD-22's server guard (no key) is the architecture's answer.
  - `[medium]` `[patch]` Intent: the Score oracle is UI against UI, read once with `textContent()` — fixed by the pinned tile texts in the first row.
  - `[low]` `[reject]` Intent: the FR-11 leak check fails the run in the global teardown, not in this test — the spec forbids a second copy of the scan; the teardown runs on every Playwright run, including `npx playwright test tests/e2e/no-key.spec.ts` alone.
  - `[low]` `[reject]` Intent: Review is scanned by axe only before the merge — AC2 says "Review"; the merged, bar-open, menu-open and dialog states are scanned in `review.spec.ts`.
  - `[false]` `[reject]` Intent: the work is uncommitted and the review section empty — mid-run state; this entry and finalize fill both.
  - `[low]` `[patch]` Intent: the TRACE FR-30 row cites "AC4", which `epics.md` does not have — now cites AC1 only.
  - `[low]` `[patch]` Intent: TRACE claims the repeat run and the fail check with no evidence in the diff — same as the Blind TRACE row; the repeat run is reported under Auto Run Result.
  - `[medium]` `[patch]` Verification gap: the Design Note's claim that the merge recount reaches the final Score is not checked in play — fixed by "2Frida2 poeng" in the first row.

## Design Notes

- **Why `fillSet` and not a fourth context for axe.** AC2 asks for the answer form reached in the spec. Extracting the filling lets the spec scan the real, filled form in the first Participant's context just before it submits, without a hook option on `submitSets`.
- **Why Frida + Per.** It is the one merge that changes what play shows: Per moves up from below the Board line, nine Groups become eight, and the merged Count (2) is then a scored Reveal, so the merge's recount reaches the final Score.
- **Counts pinned on the tiles, Scores summed from them.** AC1 says "the sum of that Team's scored Counts". Each scored tile must show its known label and Count (Kari 3, the merged Frida 2, Anne 1, Rød 2); the expected Scores are summed from those, minus the undone Reveal, and compared after every move and on "Sluttstilling". (The first draft read the Counts off the tiles unpinned; review showed a wrong Count would then pass.)

## Verification

**Commands:**
- `npm run lint` -- expected: clean
- `npm run typecheck` -- expected: clean
- `npm run test` -- expected: all pass
- `npx playwright test tests/e2e/no-key.spec.ts --repeat-each=5` -- expected: 5 passed (plus the smoke project)
- `npm run test:e2e` -- expected: all pass, teardown clean

## Auto Run Result

Status: done

**Summary.** One Playwright test, `tests/e2e/no-key.spec.ts`, runs the whole Stage 1 round on `next build && next start` with no model key and every browser request outside localhost blocked: register, a Game with two Questions, three links, three Answer sets from three browser contexts, close, the fallback Grouping with the `NO_KEY` Notice, the Frida + Per merge, both Questions marked, the lock, Teams "Hyttegjengen" and "Byfolket", scored Reveals, a turn pass, one undo, an unscored Reveal, the next Question and "Sluttstilling". Each scored tile must show its known label and Count, and each Score (after every move and on "Sluttstilling") equals the sum of that Team's scored Counts. Axe runs on the filled answer form, Review with the Notice, the play view with scored and unscored tiles, and "Sluttstilling". The spec asserts that `secrets.jsonl` holds its Tokens and Answers, so the global teardown scans both server logs for them. The full flow exposed no app bug, so no source file changed.

**Files changed.**
- `tests/e2e/no-key.spec.ts` -- new: the full no-key round (FR-30, FR-11, NFR-3, NFR-6).
- `tests/e2e/fixtures.ts` -- `fillSet` extracted from `submitSets`, which calls it and behaves as before.
- `tests/TRACE.md` -- rows under FR-11, FR-30, NFR-3 and NFR-6; the "Pending: Story 6.5." lines are gone.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 6-5 done; epic-6 stays in-progress.

**Review.** 24 findings from four layers: 3 medium, 16 low, 5 false. Patched: one medium root cause (Counts pinned on the tiles; three rows) and four low ones (the title's network wording, TRACE's "AC4" and run claim, the duplicated fixture comment, the opaque regex error). Rejected with reasons in the triage log: the shared `secrets.jsonl` (the assertion proves exactly AC3), a blocked-request counter, `test.step`, markup-tied locators shared with the other specs, a second log scan inside the test, axe on more Review states, the context leak and the mid-run status rows. Nothing deferred.

**Corrected AI suggestions.** The planning step's first design read the Counts off the tiles without pinning them; three reviewers showed a wrong Count would pass, so the expected tile texts are now fixed. The implementation agent's TRACE row cited an "AC4" that `epics.md` does not have and stated the repeat run as if enforced; both reworded. Reviewer suggestions to add a `requestfailed` counter, `test.step` blocks, `try/finally` around each context and a per-test log scan were rejected (see the triage log).

**Follow-up review:** not recommended. One medium entry patched, no high; the patch is an assertion made stricter and was re-run five times.

**Verification.**
- `npm run lint`, `npm run typecheck` and Prettier: clean.
- `npm run test`: 43 files, 732 tests passed.
- `npx playwright test tests/e2e/no-key.spec.ts --repeat-each=5`: 8 passed (3 smoke + 5 runs of the no-key test, five workers in parallel, about 11 s each), before and after the review patches; teardown clean.
- `npm run test:e2e`: 96 passed in 1.0 min; the teardown scanned 304 values and found no leak. No server left running.

**Residual risks.** `test.slow()` gives the test 90 s; locally it takes about 11 s under five parallel workers, so a 4-core CI runner has wide margin, but it has not yet run on CI. The NFR-5 timing rows (T6 to T8) remain manual.
