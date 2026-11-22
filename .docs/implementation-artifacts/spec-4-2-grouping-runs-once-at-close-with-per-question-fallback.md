---
title: 'Story 4.2: Grouping runs once at close, with per-Question fallback'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'ed8a7d62baa59efe1513974f4aae1c0dbde714c7'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** After close the Game sits in *grouping* forever: nothing runs the Judge, no Groups exist, and the grouping panel promises "under to minutter" behind a `shortcut:` comment from Story 3.1.

**Approach:** Add `answer_group`, `grouping_result` and `answer.group_id`; a `grouping` runner that partitions each Question once (30 s, 5 at a time, never inside a transaction), writes Groups, `group_id`s and one result per Question in one transaction each, falls back per Question with a reason code, resumes after a crash through the lease, and moves the Game to *in review*. The Game page shows "N av M spørsmål ferdig" with 3 s polling, then the *in review* summary.

## Boundaries & Constraints

**Always:**
- Start by invoking the `ponytail` skill (level `full`). Before any UI edit, invoke `impeccable` and read `reference/craft-floor.md` (its launcher is not installed: use the "Launcher unavailable" path). `DESIGN.md`/`EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win on conflict. WCAG 2.1 AA, 44 px targets, bokmål "du", no exclamation marks.
- A Question's items are its distinct `answer.normalized_text` values sorted with JS default `sort()` (code-unit order, never SQL `ORDER BY`). One `judge.partition` call per Question, under a 30 s `AbortController` that the runner aborts itself (`setTimeout` + race, so a provider that ignores the signal still times out as `TIMEOUT`). At most 5 Questions in flight. The Judge is never called inside a transaction.
- Fallback: a `JudgeError` gives its `reason`; any other throw is `ERROR`. A fallen-back Question gets one Group per item, all `origin = fallback`, `fell_back = true`, `fallback_reason` set, `source = fallback`. Other Questions keep their Judge Groups.
- On success, `source` is `judge` for `source: 'live'` and `replay` for `source: 'stored'`; the last `uncovered` cluster numbers are `origin = fallback`, the rest `judge`; `fell_back = false`, `fallback_reason` null.
- Every `grouping_result` stores `prompt_version` and `model_id` from `judge.info`, `normalize_version` = `NORMALIZE_VERSION`, `judge_calls` (the result's `calls`; `0` on fallback), `uncovered_items` (the result's `uncovered`; `0` on fallback).
- One transaction per Question: `games.lockForMutation(tx, { gameId, states: PERMITTED.writeGrouping })`, skip if the Question already has a `grouping_result`, insert Groups (client `randomUUID()` ids), set `answer.group_id` per cluster, insert the result, extend the lease. A `NOT_FOUND` or `WRONG_STATE` from the lock (Game deleted, or already finished) stops the whole run quietly: no throw, no log.
- `run` and `resumeIfStale` are `withBoundary("grouping", …)` entry points and both end in `finishIfComplete`. Their callers in `src/app` call them inside `after()` and `.catch(() => {})` (the boundary already logged). Module functions never call `after()`.
- The lease lives on `game` (owned by `games`): `games.acquireGroupingLease(gameId)` is one compare-and-set `UPDATE … WHERE state = 'grouping' AND grouping_lease_until < now()` setting `now() + GROUPING_LEASE_MS` in DB time; `games.extendGroupingLease(tx, gameId)` sets the same.
- Count is `count(distinct contributor_key)` in SQL only. Host-facing reads never select `contributor_key` or `rank`.
- Nothing logs or stores Answer text, items, Question text or provider output outside `answer`; `src/server/log.ts` gets only `{ module, op, code, sqlstate }`.
- Test titles carry FR/UX-DR IDs; rows go into `tests/TRACE.md`; no real names; offline (NFR-3).

**Never:**
- No `game_counter`/`bumpCounters` (Story 4.3), no `edit_count`, `custom_label` or `discarded` columns (4.3 / Epic 5), no usage report or button, no live provider or prompt text (4.4), no "Gå til gjennomgangen" button (Story 5.1 adds it; no dead buttons), no Review page, no fallback Notice (Epic 5).
- Never claim "Ingen KI-nøkkel" in the *in review* summary: it must read correctly for every reason code, in Demo mode, and for `NO_STORED_RULING` (EXPERIENCE.md consistency review row 3).
- No new dependency. No loosening of the `answer` column allow-list in `anonymity.test.ts`: add exactly `["group_id", "uuid", "YES", null]`.
- No timestamps, serials, identity columns or time-ordered IDs on `answer_group` (AD-10).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Game in *grouping*, mock Judge, 3 Questions | 3 `partition` calls, each over sorted distinct normalised items; Groups `origin = judge`; every `answer.group_id` set; 3 results `source = judge`, `fell_back = false`, `prompt_version`/`model_id` = mock info, `normalize_version` 1, `judge_calls` 1, `uncovered_items` 0; Game *in review* | — |
| Mock map merges | map `{ Q: [0,0,1] }` for items `a,b,c` | two Groups; Answers with `a` and `b` share one `group_id` | — |
| TIMEOUT | mock hangs for Q2 | at 29 999 ms Q2's signal is not aborted, at 30 000 ms it is; Q2 falls back with `TIMEOUT`; Q1/Q3 keep Judge Groups | fallback |
| ERROR / REFUSAL / INVALID_OUTPUT | mock throws `JudgeError(reason)` for chosen Questions | those fall back with that reason; others keep Judge Groups | fallback |
| Plain throw | mock throws `new Error()` | that Question falls back with `ERROR` | fallback |
| Invalid map | map value of the wrong length | `INVALID_OUTPUT` fallback (from `canonicalise`) | fallback |
| No key, no ruling | replay over an empty dir, no key | every Question `NO_KEY`, one `fallback` Group per item; Game *in review* | fallback |
| Ruling missing, key set | replay over an empty dir, `hasKey: true` | every Question `NO_STORED_RULING` | fallback |
| Replay partial | replay fixture covers some items | `source = replay`, `uncovered_items` = count; Groups of uncovered items `origin = fallback`, others `judge`; `fell_back = false` | — |
| Run again | `run` after a finished run | 0 `partition` calls; Groups, `group_id`s and results unchanged | — |
| Two resumes at once | lease expired, `Promise.all([resumeIfStale, resumeIfStale])` | exactly one wins the lease; one `partition` per Question; Game *in review* | — |
| Fresh lease | `resumeIfStale` right after close | returns without running (0 calls) | — |
| Crash mid-run | results exist for some Questions, lease expired | `resumeIfStale` partitions only the rest | — |
| Count | Group with two Answers of one Contributor key and one of another | `countsOf` gives 2 | — |
| Sizing Game | 30 sets × 15 Questions × up to 5 Answers, mock with a short await | done well under 2 min (assert < 10 s); max 5 in flight and exactly 5 reached; no `partition` call inside a transaction | — |
| Deleted mid-run | mock deletes the Game during its first call | `run` resolves, nothing logged, no rows left | stops quietly |
| Progress | 2 of 5 Questions have results | `progress` = `{ done: 2, total: 5 }` | — |

</intent-contract>

## Code Map

- `src/server/grouping/index.ts` -- today only `insertAnswers(tx, rows)`. Owner of `answer`, `answer_group`, `grouping_result` (AD-1). Add the runner and reads here.
- `src/server/judge/index.ts` -- `getJudge()`, `JudgeError`, types. Grouping imports only this, never a provider (ESLint zone).
- `src/server/judge/core.ts` -- `FallbackReason`, `JudgeError.reason`, `Judge.info`, `PartitionResult { assignments, calls, uncovered, source }`.
- `src/server/judge/providers/mock.ts` -- `createMockJudge(map)`; extend map values for failure injection.
- `src/server/judge/providers/replay.ts` -- `createReplayJudge({ dir, hasKey })`; covered clusters first, uncovered last (spine AD-13 amendment). Tests point it at `tests/fixtures/rulings` or an empty temp dir.
- `src/server/games/index.ts:140-160` -- `transition()` already sets the lease with `sql\`now() + ${GROUPING_LEASE_MS} * interval '1 millisecond'\``; reuse that expression for acquire/extend. `getOwned` already returns `leaseExpired` (DB time). `lockForMutation` without `hostId` does not touch `updated_at`.
- `src/server/questions/index.ts:51,60` -- `count(tx, gameId)` (use inside the transaction) and `ofGame(gameId)` (a `getDb()` read: never inside a transaction; PGlite deadlocks).
- `src/server/collection/index.ts` `close()` -- already inserts shuffled Answers and transitions to *grouping*. Read-only.
- `src/server/boundary.ts` -- `withBoundary(module, op, fn)`.
- `src/server/db/schema.ts` -- `answer` (comment "group_id arrives with answer_group in Story 4.2" becomes false), `game.groupingLeaseUntil`. `pgEnum` pattern: `gameState`.
- `drizzle/` -- generate `0007_*` with `npm run db:generate`; commit SQL and snapshot.
- `src/lib/limits.ts` -- add `JUDGE_TIMEOUT_MS = 30_000`, `JUDGE_CONCURRENCY = 5`, `GROUPING_POLL_MS = 3_000` next to `GROUPING_LEASE_MS`.
- `src/lib/normalize.ts:1-3` -- comment says nothing stores `NORMALIZE_VERSION` yet; now `grouping_result` does.
- `src/lib/game-state.ts` -- `writeGrouping: ["grouping"]` already exists; no new row needed.
- `src/app/spill/[id]/actions.ts` `closeCollection` -- wrap: on `ok`, `after(() => grouping.run(gameId).catch(() => {}))` (`after` from `next/server`). Keep the "use server" async-only exports.
- `src/app/spill/[id]/page.tsx:131-150` -- grouping panel with the Story 3.1 `shortcut:` comment and the slow-state sentence on `game.leaseExpired`. Add progress line, poller, `after(() => grouping.resumeIfStale(id).catch(() => {}))` when `leaseExpired`; add the `in_review` branch.
- `src/components/CollectingRefresh.tsx` -- polling pattern (`router.refresh()` in `setInterval`) to copy for a `GroupingRefresh`.
- `src/components/CloseCollection.tsx:52-57` + `src/components/RouteFocus.tsx` `focusHeading` -- focus moves to `#gruppering` when the panel unmounts after close; copy the unmount-focus idea for the move to *in review* (only when `document.activeElement` is `body`/null; pass the element, so a missing heading is a no-op).
- `src/components/ProgressCount.tsx` -- visual pattern for "N av M": display-size tabular figure + body text; static, no live region.
- `src/components/StatusBadge.tsx` -- already has "Til gjennomgang".
- `tests/setup.ts` -- global setup; add a `vi.mock("next/server", …)` whose `after` pushes tasks into a queue exported from `tests/integration/next-mocks.ts` (with a `runAfterTasks()` helper). Real `after()` throws outside a request scope, and seven integration files call `closeCollection` or render `GamePage`.
- `tests/integration/anonymity.test.ts:130-150` -- the exact `answer` column list (add `group_id`); `:168-180` identity/sequence check covers only `answer`: extend to `answer_group`.
- `tests/integration/collection.test.ts:1443` -- slow-state test renders `GamePage` after pushing the lease into the past; extend for the queued `resumeIfStale`.
- `tests/e2e/close.spec.ts` -- asserts "Grupperer" and the Gruppering heading focus right after close; the third test asserts "Grupperer" after a stale-tab refresh, which can now already be *in review* (replay, no rulings → instant `NO_KEY`): make it wait for "Til gjennomgang".
- `playwright.config.ts` -- e2e runs `JUDGE_PROVIDER=replay`, no key, no `data/rulings` → every Question `NO_KEY`.
- `tests/TRACE.md` -- FR-15 (~line 201) and FR-17 (~218) "Pending: Stories 4.2 …"; also UX-DR16/UX-DR23 sections if present.
- `ARCHITECTURE-SPINE.md` (`.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/`) -- AD-12 and AD-13 get "Amended in Story 4.2" lines.

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts` -- `groupOrigin` enum (`judge`,`fallback`), `groupingSource` enum (`judge`,`replay`,`fallback`), `fallbackReason` enum (six codes); `answerGroup(id uuid pk, question_id → question cascade, origin)`; `groupingResult(question_id uuid pk → question cascade, source, prompt_version text, normalize_version int, model_id text, judge_calls int, uncovered_items int, fell_back bool, fallback_reason nullable)`; `answer.group_id uuid nullable → answer_group.id`. Update the `answer` comment. -- AD-10, AD-14 "In the DB".
- `drizzle/0007_*.sql`, `drizzle/meta/*` -- generated.
- `src/lib/limits.ts`, `src/lib/normalize.ts` -- constants; comment.
- `src/server/games/index.ts` -- `acquireGroupingLease(gameId): Promise<boolean>`, `extendGroupingLease(tx, gameId)`, sharing one lease SQL expression with `transition`.
- `src/server/judge/providers/mock.ts` -- map values may also be a `FallbackReason` (throw `JudgeError(reason)`; `"TIMEOUT"` instead waits for the signal's `abort` and then throws `JudgeError("TIMEOUT")`, as the live provider will) or an `Error` (thrown as is). -- 4.1 carry-over: every fallback reason testable.
- `src/server/grouping/index.ts` -- `run(gameId)`, `resumeIfStale(gameId)`, `finishIfComplete(gameId)` (lock *grouping* quietly, `questions.count(tx)` vs results, `transition` to *in review*), `progress(gameId) → { done, total }`, `summary(gameId) → { questions, groupsProposed (origin = judge), fellBack }`, `countsOf(questionId) → { groupId, count }[]`. Private: items per Question, timed partition, write transaction.
- `src/app/spill/[id]/actions.ts` -- `closeCollection` starts `grouping.run` in `after()` on success.
- `src/components/GroupingRefresh.tsx` -- client: `router.refresh()` every `GROUPING_POLL_MS`; on unmount focus `#gjennomgang` if focus was lost.
- `src/app/spill/[id]/page.tsx` -- grouping panel: keep both contract sentences, add "{done} av {total} spørsmål ferdig", `<GroupingRefresh />`, queue `resumeIfStale` when `leaseExpired`, drop the `shortcut:`; new `in_review` section (`aria-labelledby="gjennomgang"`, `<h2 id="gjennomgang">Grupperingen er ferdig</h2>`, a `<dl>`: "Spørsmål", "Grupper foreslått", "Spørsmål å gruppere for hånd").
- `tests/setup.ts`, `tests/integration/next-mocks.ts` -- fake `after` queue.
- `tests/integration/grouping.test.ts` (new) -- every matrix row; inject Judges with `vi.mock("@/server/judge", …)` returning a per-test Judge from `getJudge` (keeps `run(gameId)`'s signature); the TIMEOUT row with `vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })` after the mock signals the hanging call, then real timers to finish; the transaction spy by wrapping `db.transaction` so its callback runs in an `AsyncLocalStorage` context the `partition` spy checks; `close → runAfterTasks() → in review` through the real action (AC1).
- `tests/integration/anonymity.test.ts` -- `group_id` in the allow-list; identity/sequence check also over `answer_group`.
- `tests/integration/collection.test.ts` -- slow-state test: the page queued exactly one after-task, and running it brings the Game to *in review*; a fresh-lease render queues none. *in review* page render shows the summary numbers and no "Ingen KI-nøkkel" text, also with `DEMO_MODE` on.
- `tests/e2e/close.spec.ts` -- after close: "0 av 1 spørsmål ferdig", then within the poll "Til gjennomgang", the summary values (1 / 0 / 1), focus on "Grupperingen er ferdig", axe clean at 360 px, no horizontal scroll; third test waits for "Til gjennomgang".
- `tests/TRACE.md` -- rows under FR-15, FR-17, UX-DR16/UX-DR23 (or the screen NFR sections), replacing "4.2" in Pending.
- `ARCHITECTURE-SPINE.md` -- "Amended in Story 4.2" under AD-12 (runner's own timer race; `judge_calls`/`uncovered_items` 0 on fallback; source mapping; lease functions in `games`; page queues `resumeIfStale` in `after()`; `summary`/`countsOf` reads; `edit_count` deferred to 4.3) and AD-13 (mock failure injection).
- `.docs/implementation-artifacts/sprint-status.yaml` -- `4-2-…: done` at the end.

**Acceptance Criteria:**
- Given a Game just closed through `closeCollection`, when its queued after-task runs with the mock Judge, then every Question has its Groups, `group_id`s and one result, and the Game is *in review* (AC1).
- Given the AC2/AC3/AC4/AC5 rows of the matrix, when the integration tests run offline, then each holds.
- Given the Game page in *grouping*, when the Host closes Collection in the browser, then the panel shows "0 av 1 spørsmål ferdig" and, by polling every 3 s, switches to the *in review* summary with badge "Til gjennomgang" (AC6); given an expired lease, the rendered panel shows "Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt." and the queued resume finishes Grouping (AC6, integration: an e2e cannot age a lease without a 3-minute wait).
- Given `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 33 findings — high 0, medium 0, low 26, false 7, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind Hunter: a non-gone `DomainError` escapes `run` unlogged, because `withBoundary` does not log `DomainError`s. The runner can only raise `NOT_FOUND` or `WRONG_STATE` (from `lockForMutation` without a `hostId`, `assertGameId` and `transition`), and both are meant to be silent. No other `DomainError` can be reached, and `FORBIDDEN` does not exist in `ErrorCode`.
  - `[low]` `[reject]` Blind Hunter: there is no index on `answer.group_id` or `answer.question_id`, so a cascaded delete scans `answer`. At pilot scale (a few thousand Answers) this costs nothing that anyone notices. The missing `question_id` index predates this story, and the same pilot-scale trade-off is already a `shortcut:` on `purgeExpired`. An index would be a schema change with no AC behind it.
  - `[low]` `[patch]` Blind Hunter: the partial-replay test could not catch first-occurrence renumbering, because its uncovered item ("mango") sorts last. Fixed: the test now adds "ananas", which sorts before every covered item, and expects it to get `origin = fallback`. A deliberate regression made the test fail.
  - `[false]` `[reject]` Blind Hunter: a Question with zero Answers gets a paid empty call and counts as a fallback. This cannot happen. `parseAnswerSet` refuses an empty Question ("Skriv minst ett svar."), and close requires at least three sets, so every Question has Answers.
  - `[low]` `[patch]` Blind Hunter: no test shows that the lease is extended. Fixed: the happy-path test starts with an expired lease, uses `run`, and asserts `grouping_lease_until > now()` afterwards. It fails without `extendGroupingLease`.
  - `[low]` `[patch]` Blind Hunter: the deleted-mid-run test (3 Questions, concurrency 5) never exercises `stopped`. Fixed: the test uses 8 Questions with a barrier, and asserts exactly 5 calls. It fails without the `stopped` check.
  - `[low]` `[reject]` Blind Hunter: two overlapping runs both call `partition`. Only `closeCollection` calls `run`. `resumeIfStale` needs an expired lease, and `run` extends the lease after each Question, at most about 30 s apart against 180 s. So in practice an overlap needs a dead run, and the in-transaction check stops double writes anyway. A fix (lease ownership for `run`, or claiming a row per Question) adds a branch.
  - `[low]` `[reject]` Blind Hunter: the slow-state sentence "Last inn siden på nytt" is out of date and shows for only one poll. It is the contract wording (EXPERIENCE.md, AC6). Disappearing once the resume holds a fresh lease is the intended "the next page load resumes it" (Design Notes).
  - `[low]` `[reject]` Blind Hunter: replay results record `model_id = 'replay'`, not the ruling's own model. This is the same root and reason as the 4.1 row: AD-13 keeps `info` static per provider, and each ruling keeps its own model in its file.
  - `[low]` `[reject]` Blind Hunter: `countsOf` is speculative and not wrapped in `withBoundary`. AC4 asks for it. It is an internal read like `insertAnswers`, and Epic 5's entry point will wrap it.
  - `[low]` `[patch]` Blind Hunter: under FR-16, TRACE.md said "None yet." above a new row. Fixed: the Count row moved to FR-15 (AC4), and FR-16 is back to "None yet." with its Pending line.
  - `[false]` `[reject]` Blind Hunter: `closeCollection` reads `gameId` from input that was never validated. That line runs only when `result.ok`, which means `collection.close` has already validated the input. `hostAction` uses the same cast for `revalidatePath`.
  - `[low]` `[reject]` Blind Hunter: the poll keeps running in background tabs, and a screen reader user whose focus is on another control is not told that Grouping finished. `CollectingRefresh` polls the same way. EXPERIENCE.md specifies a static panel and lists no live region for this change. The usual path (focus on the heading after close, then on `body`) does move focus to "Grupperingen er ferdig".
  - `[false]` `[reject]` Blind Hunter: the sprint status says `done` before review. It was only in the working tree, and it is committed after this review, as in 4.1.
  - `[low]` `[patch]` Intent Alignment: the AC labels in test titles and TRACE.md followed the spec, not `epics.md`. Fixed: they were relabelled AC1 to AC6 by the `epics.md` numbering, with Count traced under FR-15 AC4.
  - `[low]` `[reject]` Intent Alignment: AC1's `after()` is a global fake in Vitest. The real `after()` throws outside a request scope. The e2e exercises the real one: close, then the poll, then *in review*.
  - `[low]` `[reject]` Intent Alignment: "two page loads at once" is tested as two direct `resumeIfStale` calls. A page render only queues that same call, and the page-render test asserts that exactly one task is queued.
  - `[low]` `[patch]` Intent Alignment: AC2's "Review data is read repeatedly" was untested. Fixed: the run-again test reads `progress`, `summary` and `countsOf` twice, and Groups, `group_id`s and results stay unchanged.
  - `[low]` `[reject]` Intent Alignment: the `NO_KEY` integration tests build replay directly instead of going through `getJudge`. 4.1's unit test covers the env selection. The e2e (replay, no key) shows 1 / 0 / 1, and the patched collection render now goes through `getJudge`.
  - `[low]` `[reject]` Intent Alignment: the stale-lease part of AC6 is an integration test, not an e2e. Aging a lease in the browser needs a 3-minute wait, and the e2e cannot open the server's PGlite. This deviation is documented in the AC list.
  - `[low]` `[reject]` Intent Alignment: no test asserts the 3 s interval. `GroupingRefresh` uses `GROUPING_POLL_MS` from `limits.ts`, and the e2e reaches *in review* inside the poll window. A timer test would only test `setInterval`.
  - `[low]` `[patch]` Intent Alignment: "never claim no key" was tested only on a Game with no fallbacks. Fixed: `collection.test.ts` now renders *in review* after a real `NO_KEY` run and a real `NO_STORED_RULING` run, with `DEMO_MODE` off and on. It asserts the fallback counts and that "Ingen KI-nøkkel" never appears.
  - `[low]` `[reject]` Intent Alignment: FR-17's "told which Questions fell back" shows a count only. `epics.md` gives the reason-specific Notice to Story 5.1 (EXPERIENCE.md: the Fallback Notice in Review), and TRACE keeps 5.1 pending under FR-17.
  - `[false]` `[reject]` Intent Alignment: the spec and sprint status are uncommitted. They are committed at finalisation, after this review.
  - `[low]` `[reject]` Intent Alignment: §6.2 cost, because `judge_calls` is 0 on fallback. This is a documented `shortcut:` until Story 4.4. Mock and replay make no paid call, so 0 is exact today.
  - `[low]` `[reject]` Edge Case Hunter: overlapping runs partition a Question twice. Same root and reason as the Blind Hunter overlap row.
  - `[low]` `[reject]` Edge Case Hunter: a transient database error stops the run, so the Game waits for the lease before it resumes. That is AD-12's designed recovery: the boundary logs `INTERNAL` (now tested), and `resumeIfStale` takes over when the lease expires. Per-Question retry would add a branch.
  - `[false]` `[reject]` Edge Case Hunter: a provider returning assignments that are not dense or have the wrong length crashes the transaction. Every provider runs `canonicalise` (4.1), and replay numbers `0..k-1` densely, so that output never reaches the runner.
  - `[false]` `[reject]` Edge Case Hunter: a provider could report `uncovered > 0` without numbering those clusters last. Only replay reports `uncovered > 0`, and it numbers them last (spine AD-13, amended in 4.1, and now a regression test). openrouter uses a stored ruling only on an exact match, so `uncovered` is 0.
  - `[low]` `[reject]` Edge Case Hunter: `answer.group_id ON DELETE CASCADE` would delete Answers along with a non-empty Group. Nothing deletes Groups yet. AD-15 deletes only empty Groups (`deleteIfEmpty`). `delete.test.ts` (FR-3) requires every key under `game` to cascade, so `set null` or `restrict` would break that invariant. The spine amendment records the cascade for Epic 5.
  - `[low]` `[reject]` Edge Case Hunter (claim): "partitions each Question once" is not true for concurrent runs. Same root and reason as the overlap rows.
  - `[low]` `[patch]` Verification Gap: no test covers lease extension. Same root as the Blind Hunter lease row; fixed there.
  - `[low]` `[patch]` Verification Gap: no test sends a non-gone error through the runner. Fixed: a test renames `answer_group` and asserts that `run` rejects with `INTERNAL`, and that stderr gets exactly `{"module":"grouping","op":"run","code":"INTERNAL","sqlstate":"42P01"}`.

### AI suggestions corrected or rejected (grading evidence)

- **The orchestrator corrected its own first reading while planning:**
  - The epic-4 context file counted as stale, because `ARCHITECTURE-SPINE.md` is newer. That is only because 4.1 amended AD-13. The cache was kept, and the 4.1 spine diff was read directly instead of recompiling.
  - The 3.1 context implied a "Gå til gjennomgangen" button. It was left out, because `epics.md` gives it to Story 5.1 ("no dead buttons").
  - The stale-lease part of AC6 is labelled e2e. It is tested at integration level, because the e2e cannot age a lease without a 3-minute wait or reach the server's PGlite.
  - The runner owns the 30 s timer, rather than trusting providers that ignore the signal (mock and replay, per the 4.1 review).
  - `edit_count` was deferred to 4.3. The summary uses neutral labels rather than reason copy, so it can never claim "no key".
  - `resumeIfStale` runs in `after()` from the page, so a page load never waits for Grouping.
- **Corrected in the implementation subagent's work:**
  - Test titles and TRACE.md used the spec's own AC numbering instead of `epics.md`'s.
  - The Count test was traced under FR-16.
  - Tests were missing for lease extension, the `INTERNAL` path, the `stopped` flag and an uncovered item that sorts first.
- **Accepted from the implementation subagent, with a note:**
  - `answer.group_id` cascades on delete, because `delete.test.ts` requires every key under `game` to cascade. Epic 5 must delete only empty Groups (AD-15).
  - The two replay cases in `collection.test.ts` rely on `data/rulings` not covering their invented Questions. Story 7.1's demo ruling uses other Questions.
- **Rejected review suggestions:** see the `[reject]` rows above. The main ones are a lease or row claim against overlapping runs, a per-Question retry, indexes, `set null` on `group_id`, a live region for Grouping completion, and storing each ruling's own model.

## Design Notes

- **Timer race in the runner.** AD-13 gives abort handling to the live provider, and 4.1 left replay and mock ignoring the signal. The runner aborts the controller after 30 s and races an abort promise, so the 30 s bound holds for every provider:

```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
const timedOut = new Promise<never>((_, reject) =>
  controller.signal.addEventListener("abort", () => reject(new JudgeError("TIMEOUT"))));
try { return await Promise.race([judge.partition(input, controller.signal), timedOut]); }
finally { clearTimeout(timer); }
```

- **`judge_calls` on fallback is 0.** `JudgeError` carries no call count. For mock and replay 0 is exact; the live provider (4.4) may spend one or two calls before failing. Mark with `shortcut: a failed partition records 0 Judge calls, let JudgeError carry calls when Story 4.4's live provider can fail after spending some`.
- **Why `resumeIfStale` runs in `after()` from the page.** A page load must not wait up to two minutes. The render that resumes still shows the slow sentence (it read the expired lease); the next 3 s poll sees the fresh lease. That matches "the next page load resumes it".
- **Summary copy.** Three neutral labels, numbers only. "Grupper foreslått" counts `origin = judge` Groups, so a no-key Game honestly shows 0. No key sentence, so Demo mode and `NO_STORED_RULING` are never mislabelled; the reason-specific Notice is Epic 5's.
- **`edit_count`.** Not added here: Review (Epic 5) increments it and the report (4.3) reads it; 4.3 adds the column so the report has something to read.

## Verification

**Commands:**
- `npm run test` -- expected: all pass, new `tests/integration/grouping.test.ts` included
- `npm run lint && npm run typecheck && npm run format:check` -- expected: clean
- `npm run test:e2e` -- expected: all pass; no server left running

## Auto Run Result

Status: done

**Summary.** Closing Collection now really groups the Answers:
- `closeCollection` starts `grouping.run` in `after()`.
- Each Question gets one `partition` call over its sorted distinct normalised texts. The runner owns a 30 s timer, runs at most 5 Questions at once, and never calls the Judge inside a transaction.
- One transaction per Question writes the Groups, every `answer.group_id` and one `grouping_result`, then extends the lease. A Question that already has a result is skipped.
- A Judge failure falls only that Question back, with one Group per text and a reason code.
- When every Question has a result, `finishIfComplete` moves the Game to *in review*.
- A page load past the lease resumes the run through `resumeIfStale`. Only the lease winner runs.
- A deleted Game stops the run quietly.
- The Game page shows "N av M spørsmål ferdig", polls every 3 s, and switches to the *in review* summary. Focus moves to its heading.
- The mock Judge can now inject every fallback reason.

**Files changed**
- `src/server/db/schema.ts`, `drizzle/0007_lonely_ares.sql`, `drizzle/meta/*`: `answer_group`, `grouping_result`, `answer.group_id` and three enums.
- `src/server/grouping/index.ts`: `run`, `resumeIfStale`, `finishIfComplete`, `progress`, `summary`, `countsOf`, and the timed partition and the per-Question write.
- `src/server/games/index.ts`: `acquireGroupingLease`, `extendGroupingLease`, and one shared lease expression.
- `src/server/judge/providers/mock.ts`: failure injection (`FallbackReason`, `Error`, and `"TIMEOUT"` waiting for the abort).
- `src/app/spill/[id]/actions.ts`: Grouping runs in `after()` once close succeeds.
- `src/app/spill/[id]/page.tsx`: progress line, poller and queued resume; the *in review* summary. The 3.1 `shortcut:` is gone.
- `src/components/GroupingRefresh.tsx`: 3 s poll and the focus move on completion.
- `src/lib/limits.ts`, `src/lib/normalize.ts`: constants and a comment.
- `tests/integration/grouping.test.ts` (new); `tests/integration/anonymity.test.ts`, `tests/integration/collection.test.ts`, `tests/unit/judge.test.ts`, `tests/e2e/close.spec.ts`; `tests/setup.ts` and `tests/integration/next-mocks.ts` (the `after()` queue); `tests/TRACE.md`.
- `ARCHITECTURE-SPINE.md`: "Amended in Story 4.2" blocks in AD-12 and AD-13.
- `sprint-status.yaml`: 4-2 done.

**Review**
- 33 findings: 26 low and 7 false.
- 9 rows patched, as 7 fixes, all in tests or TRACE: lease extension, the `INTERNAL` path, an uncovered item sorting first, `stopped` with 8 Questions, AC labels, repeated reads, and the *in review* render after real fallbacks.
- 17 low rows rejected with reasons, plus 7 false. All are in the triage log.
- Nothing deferred.

**Follow-up review:** `false`. Every patched entry was low (0 high, 0 medium).

**Verification** (after the patches):
- `npm run test`: 502 passed in 36 files.
- `npm run test:e2e`: 86 passed. No server was left listening on 3100 or 3101.
- `npm run lint`, `npm run typecheck` and `npm run format:check`: clean.

**Residual risks**
- `answer.group_id` cascades on delete, so Epic 5 must delete only empty Groups.
- A failed partition records `judge_calls = 0` (`shortcut:` until Story 4.4).
- Overlapping runs (which in practice need a dead run) would spend a second Judge call for each pending Question.
- The two replay render cases in `collection.test.ts` depend on `data/rulings` not covering their test Questions.
- The e2e "0 av 1" assertion relies on `after()` running only after the close response has rendered.
