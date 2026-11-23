---
title: 'Story 4.3: Usage counters and the usage report'
type: 'feature'
created: '2026-11-22'
baseline_revision: '14e1d6213ce088d49e5adbda5216dad7e9853630'
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

**Problem:** Nothing records how much the Judge proposed or how much the Host changed, so SM-5 and SM-C2 cannot be measured, and FR-18's export does not exist. Story 4.2 deferred `game_counter`, `bumpCounters` and `edit_count` to this story.

**Approach:** Add `game_counter` (one row per Game, nine counters) with `games.bumpCounters(tx, gameId, delta)` as its only writer, call it inside Grouping's per-Question transaction, add `answer_group.edit_count`, and serve a content-free JSON report at `GET /api/spill/[gameId]/rapport`, linked from the Game page as "Last ned bruksrapport" from *in review* onward.

## Boundaries & Constraints

**Always:**
- Start by invoking `ponytail` (level `full`). Before the UI edit, invoke `impeccable` and read `reference/craft-floor.md` (launcher not installed: "Launcher unavailable" path). `DESIGN.md`/`EXPERIENCE.md` win on conflict. WCAG 2.1 AA, 44 px targets, bokmål.
- `game_counter`: `game_id uuid` primary key → `game` `ON DELETE CASCADE`; integer columns `judge_groups_proposed`, `groups_merged`, `answers_moved`, `groups_created`, `groups_renamed`, `groups_discarded`, `groups_restored`, `judge_calls`, `questions_fell_back`, each `not null default 0`. No timestamp or other column.
- `games.bumpCounters(tx, gameId, delta)` is the only code that writes `game_counter`: one upsert that inserts the row with the delta or adds the delta to the existing row. The row is created lazily by the first bump.
- Grouping calls it in the same transaction as the Question's `grouping_result`, after the already-done skip: `judgeGroupsProposed` = that Question's `origin = judge` Groups, `judgeCalls` = the `judge_calls` it stores (0 on fallback, the existing 4.2 `shortcut:` until Story 4.4), `questionsFellBack` = 1 or 0.
- `answer_group.edit_count integer not null default 0`. Nothing increments it yet (Epic 5 does).
- The report is computed from the owned Game: `auth.requireHost()`, `games.getOwned` (missing, foreign and malformed are one `NOT_FOUND`), then the state must be in `REPORT_STATES` = `in_review`, `ready`, `playing`, `played` (in `src/lib/game-state.ts`), then `games.counters(gameId)` (zeros if no row) and `grouping.usage(gameId)`.
- Report body, and nothing else: `{ counters: { judgeGroupsProposed, groupsMerged, answersMoved, groupsCreated, groupsRenamed, groupsDiscarded, groupsRestored, judgeCalls, questionsFellBack }, questions: [{ position, source, fellBack, groups: [{ origin, editCount }] }] }`. Questions by `position`; Groups ordered by their random id. Headers `Content-Disposition: attachment; filename="toppsvar-bruksrapport.json"` and `Cache-Control: no-store`.
- Failures as JSON `{ code, message }` with `MESSAGES[code]`: `NOT_FOUND` 404 (identical for a foreign, a random and a malformed id), `WRONG_STATE` 409, anything else 500 (`INTERNAL`, the boundary logs it). Logged out: `requireHost`'s redirect to `/logg-inn`.
- The button is a plain `<a href="/api/spill/{id}/rapport">` styled as `button-secondary` (the `Button` `secondary` classes, min 44 px), shown only in `REPORT_STATES`, above the delete footer. Not primary: Story 5.1 adds the *in review* primary action.
- Test titles carry FR/UX-DR IDs; rows in `tests/TRACE.md` (FR-18 and UX-DR16 under the UX section); a foreign-Host case in `tests/integration/authz.test.ts`; offline (NFR-3); no real names.

**Never:**
- No Answer text, normalised text, Group label, Question text, Game title, Group id, Contributor key, rank, Count or fallback reason in the report (FR-11..FR-13). No query in this story selects `contributor_key` or `rank`.
- Not added to `PERMITTED`: that is AD-4's mutation table, and `played` permits no mutation (pinned by `tests/unit/game-state.test.ts`).
- No other Route Handler, no client data library, no new dependency, no `download` attribute (a logged-out redirect would save the login page as a file), no counter row created at `games.create`, no writes to the six Review counters, no `custom_label`/`discarded`, no live provider.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bump, Judge | mock merges `a,b` of 3 items on Q1, others singletons | Q1 adds `judgeGroupsProposed` 2, `judgeCalls` 1, `questionsFellBack` 0; totals over the Game equal the sum per Question | — |
| Bump, fallback | replay, empty dir, no key, 3 Questions | `judgeGroupsProposed` 0, `judgeCalls` 0, `questionsFellBack` 3 | — |
| Bump, partial replay | replay fixture covers some items | `judgeGroupsProposed` = Groups with `origin = judge` only, `judgeCalls` = result's `calls` | — |
| Same transaction | bump throws inside the Question's transaction | no Group, `group_id` or result for that Question is written | rolls back |
| Run again | `run` after a finished run | counters unchanged | — |
| Report | owner, Game in *in review* with Answers | 200, attachment headers, exact keys above, no Answer text, normalised text, label, Contributor key, title or Question text anywhere in the body | — |
| Report, later states | owner, `ready`/`playing`/`played` | 200 | — |
| Report, early states | owner, `draft`/`collecting`/`grouping` | 409 `WRONG_STATE` | — |
| Report, no counter row | *in review* Game inserted directly | 200 with all nine counters 0 | — |
| Foreign / missing | Host B on A's Game, random UUID, malformed id | three identical 404 `NOT_FOUND` bodies | — |
| Logged out | no session cookie | redirect to `/logg-inn` | — |
| DB failure | `game_counter` renamed away | 500 `INTERNAL`, one log line with only `module`, `op`, `code`, `sqlstate` | boundary |
| Delete | Game with a counter row, deleted by the Host or the purge | its `game_counter` row is gone | — |
| Button | Game page per state | "Last ned bruksrapport" present in the four report states, absent in the other three | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- add `gameCounter` and `answerGroup.editCount`. Pattern: `game.inviteLinksIssued` (`integer().notNull().default(0)`).
- `drizzle/` -- `npm run db:generate` gives `0008_*.sql` + snapshot; commit both.
- `src/server/games/index.ts` -- owner of `game` and `game_counter` (spine module table). `reserveInviteLinks` is the pattern for a counter write under the caller's lock; add `bumpCounters` and `counters` here. `getOwned` returns `state`.
- `src/server/grouping/index.ts:94-140` -- `groupQuestion`'s transaction: add the bump after `insert(groupingResult)`. `firstFallback` is already the count of `origin = judge` Groups. `summary()` is the read pattern for `usage()`.
- `src/lib/game-state.ts` -- pure; add `REPORT_STATES` next to `PERMITTED`.
- `src/lib/errors.ts` -- `MESSAGES` for the JSON bodies; no new code needed.
- `src/app/api/purge/route.ts` -- Route Handler pattern (`await connection()`, JSON responses, boundary already logged).
- `src/app/spill/[id]/page.tsx` -- the button goes after `{panel}`, before the footer, gated on `REPORT_STATES`.
- `src/components/Button.tsx:13` -- `secondary` classes; `src/app/page.tsx:3,23` -- precedent for a link styled as a secondary button.
- `tests/integration/grouping.test.ts` -- `groupingGame`, `mock`, `install`, `emptyDir`, `createReplayJudge` and the `vi.mock("@/server/judge")` hook: reuse them for the bump tests.
- `tests/integration/delete.test.ts` -- `deleteGame` + `run` helper; the catalog walk covers the FK automatically, but AC3 needs a Game that has a counter row.
- `tests/integration/authz.test.ts:141-225` -- "Host B against Host A's Game" block for the foreign case.
- `tests/integration/anonymity.test.ts` -- no change expected (`game_counter` has no timestamp, token-like or identity column); run it.
- `tests/e2e/close.spec.ts` -- the first test reaches *in review* (replay, no key): extend it with the download.
- `tests/TRACE.md:237-242` -- FR-18 "None yet / Pending: Story 4.3"; UX section for UX-DR16.
- `ARCHITECTURE-SPINE.md` (`.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/`) -- AD-18 gets an "Amended in Story 4.3" block; AD-12's "Deferred" line is now resolved.

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts`, `drizzle/0008_*` -- `game_counter` table and `answer_group.edit_count`; generated migration. -- AD-18.
- `src/lib/game-state.ts` -- `export const REPORT_STATES: readonly GameState[] = ["in_review", "ready", "playing", "played"]`. -- shared by the page and the route.
- `src/server/games/index.ts` -- `export type Counters`; `bumpCounters(tx, gameId, delta: Partial<Counters>)` (upsert on `game_id`, each column `+ delta`); `counters(gameId): Promise<Counters>` in `withBoundary`, zeros when no row. -- AD-18 sole writer.
- `src/server/grouping/index.ts` -- bump in `groupQuestion`'s transaction; `usage(gameId)` in `withBoundary` returning `{ position, source, fellBack, groups: { origin, editCount }[] }[]`, selecting only those columns. -- AC1, AC2.
- `src/app/api/spill/[gameId]/rapport/route.ts` -- `GET` as in Boundaries. -- AC2, AD-17.
- `src/app/spill/[id]/page.tsx` -- the link. -- AC4.
- `tests/integration/report.test.ts` (new) -- every matrix row except the foreign case: bumps through `grouping.run` with injected Judges, the rollback (an ESM namespace cannot be spied, so rename `game_counter` away, assert `run` rejects with `INTERNAL` and no Question has a Group or result, then rename it back in `finally`), route GET called with `new Request(…)` and `{ params: Promise.resolve({ gameId }) }`, page renders per state, delete via `deleteGame` and via `purgeExpired`.
- `tests/integration/authz.test.ts` -- Host B's GET on A's *in review* Game, a random UUID and a malformed id: identical 404 bodies.
- `tests/e2e/close.spec.ts` -- in collecting the link is absent; on *in review* it is visible, clicking it gives a download named `toppsvar-bruksrapport.json` whose JSON has the nine counters (`questionsFellBack` 1, `judgeGroupsProposed` 0), one Question with `source` `fallback`, and no "Kari" (the submitted Answer); axe stays clean.
- `tests/TRACE.md` -- FR-18 rows (AC1-AC4), UX-DR16 row.
- `ARCHITECTURE-SPINE.md` -- "Amended in Story 4.3" under AD-18: lazy row via upsert, `counters` zero default, `REPORT_STATES` outside `PERMITTED`, the route composes `getOwned` + `games.counters` + `grouping.usage` like the Game page, the body shape, 404/409/500, `judge_calls` 0 on fallback until 4.4, Host-made Groups (Story 5.3) must not use `origin = judge`. AD-12 "Deferred" line: point at 4.3.
- `.docs/implementation-artifacts/sprint-status.yaml` -- `4-3-usage-counters-and-the-usage-report: done` at the end.

**Acceptance Criteria:**
- Given Grouping writes a Question's result, when the transaction commits, then `game_counter` has grown by exactly that Question's figures; if the bump fails, nothing of that Question is written (AC1).
- Given a Game in *in review* or later, when its Host GETs the report, then the body is exactly the shape above and contains no Answer text or Group label; Host B gets the same 404 as for a Game that does not exist (AC2).
- Given a Game with a counter row, when it is deleted, then the row is gone (AC3).
- Given the Game page from *in review* onward, when the Host clicks "Last ned bruksrapport", then the report downloads; earlier states have no button (AC4).
- Given `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 27 findings — high 0, medium 0, low 22, false 5, maybe-false 0
- findings:
  - `[low]` `[patch]` Verification Gap: no test reaches the in-transaction `if (done) return;` with counters checked, so moving `bumpCounters` above the skip would pass every test. Fixed: a new test in `report.test.ts` stores Q1's `grouping_result` while Q1's partition runs, and asserts the counters hold only Q2's figures. With the bump moved above the skip, the test failed.
  - `[low]` `[reject]` Edge Case Hunter: the route reads `getOwned`, `counters` and `usage` outside one transaction, so a delete or a Review edit in between gives an inconsistent report. A Game deleted mid-request yields one zero report the Host already asked for; Review edits do not exist until Epic 5. One transaction across two modules adds a code path for a moment nobody meets.
  - `[low]` `[reject]` Edge Case Hunter: an empty delta gives `onConflictDoUpdate` an empty `set`. No caller passes one: Grouping always passes three keys, and Review (Epic 5) bumps the counter it changed. A guard would protect a state nothing reaches.
  - `[low]` `[reject]` Edge Case Hunter: a key present with `undefined` sets `col + NULL`. Same root and reason as the empty-delta row: every caller is typed internal code that passes numbers.
  - `[low]` `[reject]` Edge Case Hunter: negative or fractional deltas would corrupt the counters. The only callers are `grouping` and (later) `review`, which pass counts of rows they just wrote; validation belongs at trust boundaries, and this is not one.
  - `[low]` `[reject]` Edge Case Hunter: Games grouped before migration 0008 have no counter row, so their report says 0 proposed. No deployed database exists yet (pilot deployment is Story 7.5), and local data is disposable. A backfill would be migration SQL for no real data.
  - `[low]` `[reject]` Edge Case Hunter: clicking the link after the Game was deleted elsewhere shows a raw `{code, message}` JSON page. The message is the bokmål "Vi finner ikke dette spillet."; the browser's back button returns. A redirect-on-error branch for a download link is more than a direct correction. Left for the epic's impeccable `harden` pass before PR.
  - `[low]` `[patch]` Blind Hunter: the rerun test cannot catch a double count. Same root as the Verification Gap row; fixed there.
  - `[low]` `[reject]` Blind Hunter: `bumpCounters` accepts `{}` and `undefined` values. Same root and reason as the Edge Case Hunter delta rows.
  - `[low]` `[patch]` Blind Hunter: the six Review counters and two bumps adding through the conflict path are never exercised directly, though Epic 5 depends on the mapping. Fixed: a `bumpCounters` test bumps `groupsMerged`/`answersMoved` twice and `groupsRestored` once in one transaction and checks 4 / 2 / 1 and zeros.
  - `[low]` `[reject]` Blind Hunter: report errors open as a raw JSON page. Same root and reason as the Edge Case Hunter link row.
  - `[low]` `[patch]` Blind Hunter: SM-5 needs "reach the Board", which today's report cannot show (a discarded judge Group with `edit_count = 0` looks accepted). `board_slot` does not exist yet, so nothing can be exported now. Fixed in the spine: AD-18's 4.3 amendment now says Story 5.5 (`confirmBoard`) adds a per-Group on-Board flag from `board_slot.group_id`.
  - `[low]` `[reject]` Blind Hunter: the report leaves out `prompt_version`, `model_id`, `uncovered_items`, per-Question `judge_calls` and a format version. AD-18's export list names exactly the fields shipped; SM-C2 (Judge calls per Question) is `judgeCalls` over the Question count. Adding fields would widen the contract with no AC behind it; the columns stay in `grouping_result` for a later report.
  - `[low]` `[reject]` Blind Hunter: the report reads three snapshots. Same root and reason as the Edge Case Hunter transaction row.
  - `[low]` `[reject]` Blind Hunter: the secondary-button classes are copied a third time. `Button.tsx` is a client component a server component cannot take a string from; `src/app/page.tsx` already styles a link this way. Moving `VARIANTS` to a shared module is a refactor outside the story.
  - `[low]` `[reject]` Blind Hunter: the `forbidden` loop in `report.test.ts` and `not.toContain("Kari")` in the e2e cannot fail after an exact `toEqual`. They are deliberate FR-12 guards that keep failing if the exact assertion is ever loosened when Epic 5 adds fields.
  - `[low]` `[patch]` Blind Hunter: the UX-DR16 TRACE row sat between two Story 1.4 rows. Fixed: moved after them.
  - `[false]` `[reject]` Blind Hunter: the diff marks 4.3 done without its spec. The spec was left out of the review diff on purpose (it goes only to the edge-case layer as the claims file), and it is committed with the status change at finalisation.
  - `[low]` `[reject]` Intent Alignment: "the only writer" is tested by behaviour, not codebase-wide. Table ownership (AD-1) is enforced by convention and review for every table; a grep test for one table adds machinery nobody else has.
  - `[low]` `[patch]` Intent Alignment: SM-5's "reach the Board" cannot be derived from the report. Same root as the Blind Hunter SM-5 row; fixed in the spine there.
  - `[false]` `[reject]` Intent Alignment: the "Ny gruppe" exclusion exists only as a spine sentence. No Host-made Group exists until Story 5.3, and `judgeGroupsProposed` counts only `origin = judge`, which Grouping alone writes. epics.md item 10 gives the origin value to 5.3.
  - `[low]` `[reject]` Intent Alignment: SM-C2 has only the Game total, not calls per Question. Same reason as the Blind Hunter fields row: the per-Question figure SM-C2 names is the total over the Question count, and AD-18 lists no per-Question calls.
  - `[low]` `[reject]` Intent Alignment: *ready*, *playing* and *played* are tested by writing the state directly. Reaching them for real needs Epic 5 and 6; the route only checks `REPORT_STATES`, which these tests walk.
  - `[low]` `[reject]` Intent Alignment: the control is an `<a>` (role link), while EXPERIENCE.md says "Button". A download is navigation, and an anchor is the native element for it; it is styled as `button-secondary` exactly as the landing page styles its links. A `<button>` would need script to start a download.
  - `[low]` `[reject]` Intent Alignment: absence in *draft* and *grouping* is checked by rendering, not in a browser. The e2e checks absence in *collecting* and presence in *in review*; the render test walks all seven states through the real page component. *grouping* lasts under a second in e2e (replay, no key).
  - `[false]` `[reject]` Intent Alignment: tests check a contract the same change wrote into the spine. The tests follow the epics.md ACs and AD-18's export list; the amendment only records choices the spine left open (row creation, error codes), as the project convention requires.
  - `[false]` `[reject]` Intent Alignment: "no Group label" is vacuously true. The body is compared with an exact `toEqual`, so a label field added later (Epic 5's `custom_label`) fails the test until someone decides it on purpose.

### AI suggestions corrected or rejected (grading evidence)

- **The orchestrator corrected its own first plan while planning:**
  - The report entry point was first meant to be `games.report`. `grouping` already imports `games`, so that would be an import cycle; the route composes `getOwned` + `games.counters` + `grouping.usage`, like the Game page does.
  - Adding the report as a `PERMITTED` operation was dropped: AD-4's table is for mutations, and a unit test pins that `played` permits only `deleteGame`. `REPORT_STATES` sits beside it instead.
  - The `download` attribute was dropped, since a logged-out redirect would then save the login page as the file. `Content-Disposition: attachment` makes the download.
  - The rollback test first planned to drop `game_counter`; it renames the table away and back, so later tests in the file keep working.
- **Accepted from the implementation subagent, with a note:**
  - `tests/setup.ts` now mocks `connection()` as well as `after()`, since the real one throws outside a request.
  - A title wait was added before the *in review* axe check in `close.spec.ts`: the 3 s refresh briefly drops `<title>`, the same race the after-close check already waits out.
- **Corrected in the implementation subagent's work after review:** the missing skip test, the missing direct `bumpCounters` test, the TRACE order, and the SM-5 Board gap (spine note).
- **Rejected review suggestions:** see the `[reject]` rows above. The main ones are a repeatable-read transaction for the report, delta validation in `bumpCounters`, a backfill migration, a redirect for report errors, extra report fields, a shared button-class module, and a codebase-wide "only writer" test.

## Design Notes

- **Lazy row.** An upsert in `bumpCounters` means no hook in `games.create` and no special case for Games inserted directly by tests or created before this migration; `counters()` returns zeros for a Game that never bumped. The spine left the creation point open (epic-4 context).
- **Why the route composes.** `grouping` imports `games`, so a `games.report` that reads Groups would be an import cycle. The Game page already composes `getOwned` with `grouping.summary` ("no owner check: the caller has already resolved the owned Game"); the route does the same.
- **Why camelCase.** The body is Drizzle's own row shape; mapping to snake_case would be code for nothing. Names match the spine columns one to one.
- **Why `position`.** Groups need a Question to belong to for SM-5's per-Board reading, and `position` is the Host's own ordering, carrying nothing about Participants. Group ids are random but omitted anyway: the report needs none.

```ts
export async function bumpCounters(tx: Tx, gameId: string, delta: Partial<Counters>) {
  const set = Object.fromEntries(
    Object.entries(delta).map(([k, n]) => [k, sql`${gameCounter[k as keyof Counters]} + ${n}`]));
  await tx.insert(gameCounter).values({ gameId, ...delta })
    .onConflictDoUpdate({ target: gameCounter.gameId, set });
}
```

## Verification

**Commands:**
- `npm run test` -- expected: all pass, new `tests/integration/report.test.ts` included
- `npm run lint && npm run typecheck && npm run format:check` -- expected: clean
- `npm run test:e2e` -- expected: all pass; no server left running

## Auto Run Result

Status: done

**Summary.** The Game now keeps content-free usage counters and the Host can download them:
- `game_counter` (one row per Game, nine counters, cascades with the Game) is written only by `games.bumpCounters`, one upsert that creates the row on the first bump.
- Grouping bumps `judge_groups_proposed` (the Question's `origin = judge` Groups), `judge_calls` (the stored figure; 0 on fallback until 4.4) and `questions_fell_back` in the same transaction as the Question's result, after the already-done skip.
- `answer_group.edit_count` exists (default 0) for Epic 5 to increment.
- `GET /api/spill/[gameId]/rapport` returns `{ counters, questions: [{ position, source, fellBack, groups: [{ origin, editCount }] }] }` as an attachment for *in review* and later; 404 for missing, foreign and malformed alike, 409 earlier, 500 on failure, redirect when logged out.
- The Game page shows "Last ned bruksrapport" (a link styled as `button-secondary`) from *in review* onward.

**Files changed**
- `src/server/db/schema.ts`, `drizzle/0008_curvy_skullbuster.sql`, `drizzle/meta/*`: `game_counter` and `answer_group.edit_count`.
- `src/server/games/index.ts`: `Counters`, `bumpCounters`, `counters`.
- `src/server/grouping/index.ts`: the bump in the per-Question transaction; `usage(gameId)`.
- `src/lib/game-state.ts`: `REPORT_STATES`.
- `src/app/api/spill/[gameId]/rapport/route.ts` (new): the report route.
- `src/app/spill/[id]/page.tsx`: the report link.
- `tests/integration/report.test.ts` (new); `tests/integration/authz.test.ts` (foreign Host); `tests/e2e/close.spec.ts` (download); `tests/setup.ts` (`connection()` mock); `tests/TRACE.md`.
- `ARCHITECTURE-SPINE.md`: "Amended in Story 4.3" under AD-18; AD-12's deferred line resolved.
- `sprint-status.yaml`: 4-3 done. `epic-4-context.md`: recompiled.

**Review**
- 27 findings: 22 low, 5 false. 7 rows patched as 4 fixes (skip test, direct bump test, spine SM-5 note, TRACE order). 15 low and 5 false rejected with reasons. Nothing deferred.

**Follow-up review:** `false`. Every patched entry was low (0 high, 0 medium).

**Verification** (after the patches):
- `npm run test`: 532 passed in 37 files.
- `npm run test:e2e`: 86 passed. No server left on 3100 or 3101.
- `npm run lint`, `npm run typecheck`, `npm run format:check`: clean.

**Residual risks**
- A fallen-back Question records `judge_calls = 0` (existing `shortcut:` until Story 4.4).
- SM-5 needs an on-Board flag per Group; Story 5.5 must add it (spine note).
- Story 5.3's Host-made Groups must not use `origin = judge`.
- `tests/e2e/host-anonymity.spec.ts` failed once in the first full e2e run and passed on two reruns; it does not touch the changed surfaces (the link renders only from *in review*). Likely load flakiness.
- Report errors open as a plain JSON page; left for the epic's `harden` pass.
