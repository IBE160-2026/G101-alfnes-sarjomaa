---
title: 'Story 5.2: Merge Groups'
type: 'feature'
created: '2026-11-23'
baseline_revision: '1d900fa25bc9684f2185ea0f6c6c5e37858ff3d7'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The SelectionBar's WRONG_STATE branch ("Brettet er allerede låst." with the link to the Game page) has no UI test.
    evidence: |-
      Integration tests prove review.merge returns WRONG_STATE outside in review, and the e2e now covers the NOT_FOUND stale-tab branch, but nothing in 5.2 can move a Game out of in review from the browser (locking is Story 5.5) and the repo has no component-test setup. Add an e2e in 5.5: lock the Board in a second tab, then merge in the stale tab and assert the locked message and link.
    location: >-
      src/components/ReviewGroups.tsx (merge failure branch)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** The Review screen (5.1) is read-only: when the Judge, or the no-key fallback, splits one answer over several Groups, the Host cannot join them, so one answer takes several rows on the Board and each row's Count is too low (FR-20).

**Approach:** A `review.merge` entry point (owner and *in review* checked under the Game lock, every Group ID resolved inside the owned Game and one Question) that, in one transaction, moves every Answer into the highest-ranked source Group, freezes that Group's effective label as `custom_label`, bumps its `edit_count`, deletes the emptied Groups, bumps `groups_merged` and clears the Question's reviewed mark. On the screen, Board and *Ikke på brettet* Groups get checkboxes and a sticky dark SelectionBar with "Slå sammen N grupper", pessimistic and announced per `EXPERIENCE.md`.

## Boundaries & Constraints

**Always:**
- Start with `ponytail` (full). Before UI edits, `impeccable` ("Launcher unavailable" path) and `reference/craft-floor.md`. `DESIGN.md`/`EXPERIENCE.md` win on conflict. Operate mode. WCAG 2.1 AA, 44 px targets, literal bokmål.
- Order inside the transaction (AD-4, AD-5, AD-11, AD-15, AD-18): `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.editReview })`; resolve the IDs; rank the Question's Groups with `rankGroups` (inputs read with `tx`); the first ranked source is the target; `grouping.mergeGroups(tx, …)` moves **every** Answer of the sources to the target **before** it deletes the sources (deleting an `answer_group` cascades to its Answers since 4.2), sets the target's `custom_label` to its effective label and `edit_count + 1`; `games.bumpCounters(tx, gameId, { groupsMerged: sources.length })` (Groups merged away, so merging 3 Groups counts 2); `questions.setReviewed(tx, questionId, false)`.
- Input: `mergeGroupsSchema` in `src/lib/review.ts`: `{ gameId: string, groupIds: string[] }`, 2 to `INVITE_LINKS_MAX * ANSWERS_PER_QUESTION_MAX` distinct IDs, else `INVALID_INPUT`. A malformed UUID, a missing, foreign, discarded or other-Question ID is `NOT_FOUND`, checked before any write, so nothing changes.
- Result `{ groupId, label, count, position }`: the target after the merge, `count` = distinct Contributor keys (SQL), `position` = its 1-based place among non-discarded ranked Groups (the rank the card shows).
- Action `mergeGroups` in `src/app/spill/[id]/actions.ts` through `hostAction`, which then revalidates `/spill/{gameId}/gjennomgang` as well as the Game page.
- UI (UX-DR12, UX-DR18): checkbox on every Board and *Ikke på brettet* GroupCard (none on *Forkastet*), accessible name `Velg «{label}»`, 44 px target; selected card = `group-card-selected` (primary-soft fill, 2 px primary edge) without layout shift. SelectionBar only with a selection, sticky to the bottom of the main pane, `bg-ink text-surface rounded-lg shadow-lg`, after the sections in tab order: left "1 gruppe valgt"/"N grupper valgt" in `title`; right, for 1 Group the hint "Velg minst to grupper for å slå sammen.", for ≥2 the button "Slå sammen N grupper", and always "Fjern valg". Buttons surface fill with ink text; focus inside the bar uses `focus-inverse` (3 px white). Esc or "Fjern valg" clears; a Question change clears (component keyed by position).
- Pessimistic: while pending, the selected cards are `aria-busy="true"` and dimmed, the merge button shows "Slår sammen …" and ignores repeat clicks. On success: selection clears, the refreshed list shows, focus moves to the merged Group's `<h4>`, and one polite live region announces "Slått sammen til «{label}», nå {N personer|1 person}, plass {P}.".
- Failure inside the SelectionBar above its actions, `danger-soft`/`danger`: `NOT_FOUND` (stale view) → `router.refresh()` and clear the selection; `WRONG_STATE` (Board locked in another tab) → "Brettet er allerede låst." with a link "Gå til spillet" to `/spill/{id}`; anything else, a rejected request included → "Endringen ble ikke lagret. Prøv igjen.", Groups and selection unchanged.
- Tests: FR IDs in titles; `tests/integration/review.test.ts` (AD-22 named file); foreign-Host case in `authz.test.ts`; rows in `tests/TRACE.md`; offline, no key, no real names.

**Never:**
- No Answer selection, "Flytt til gruppe" or "Ny gruppe" (5.3), no menu or rename (5.4), no mark/lock (5.5); no confirmation dialog for merge (EXPERIENCE: reversible).
- No optimistic update, no client data library, no new Route Handler, no `contributor_key` or `rank` in any result, prop or log.
- Do not touch `.env`, `.logs/`, `prompting/`; never run `judge:smoke`/`judge:record`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shared key | A (3 keys) and B (2 keys, one also in A) | target = A's ID, label frozen, Count 4 (< 5), B deleted, every Answer kept | — |
| Three sources | A, B, C | one Group, two deleted, `groups_merged + 2`, target `edit_count + 1` | — |
| Below the line | a rank-9 Group with a Board Group | merged Group takes the Board Group's ID | — |
| Custom label | highest-ranked source renamed "X" | target keeps `custom_label = 'X'` | — |
| Reviewed | Question `reviewed = true` | `reviewed = false` after merge | — |
| Two Questions | IDs from Q1 and Q2 | nothing changes | `NOT_FOUND` |
| Foreign / random / malformed | Host B's, random UUID, `abc` | nothing changes | `NOT_FOUND` |
| Discarded | one ID discarded | nothing changes | `NOT_FOUND` |
| One / duplicate ID | `[a]`, `[a, a]` | nothing changes | `INVALID_INPUT` |
| Wrong state | Game *ready* (or *draft*) | nothing changes | `WRONG_STATE` |

</intent-contract>

## Code Map

- `src/server/review/index.ts` -- `groupsOf` holds the two rank queries (groups with `countDistinct`/rank-1 filter, label candidates) on `getDb()`; extract them into `rankedGroups(db: Db | Tx, questionId)` reused by `groupsOf` and `merge`. Add `merge(hostId, input)` under `withBoundary`.
- `src/server/grouping/index.ts` -- owner of `answer`/`answer_group` writes (AD-1); add `mergeGroups(tx, { targetId, sourceIds, label })`.
- `src/server/questions/index.ts` -- add `setReviewed(tx, questionId, reviewed)` (AD-15's only non-draft `question` write).
- `src/server/games/index.ts` -- `lockForMutation` (malformed gameId → `NOT_FOUND`), `bumpCounters`.
- `src/lib/game-state.ts` -- `PERMITTED.editReview = ["in_review"]` already exists.
- `src/lib/review.ts` -- add `mergeGroupsSchema` (zod); `src/lib/question.ts` is the schema pattern; `src/lib/errors.ts` `validate`.
- `src/lib/ranking.ts` -- `rankGroups`, `boardCut` (read-only).
- `src/app/spill/[id]/actions.ts` -- `hostAction(op, input)`; give it an optional sub-path to revalidate.
- `src/app/spill/[id]/gjennomgang/page.tsx` -- server page; Board/below sections move into the new client component, *Forkastet* passed as `children`.
- `src/components/GroupCard.tsx` -- presentational; gains optional `selected`, `busy`, `onToggle` and an `id` on its `<h4>` for focus.
- `src/components/Button.tsx` -- add an `inverse` variant (surface fill, ink text) for the dark bar.
- `src/components/CloseCollection.tsx` -- pattern: `useTransition` + `callAction` (`src/components/useFormAction.ts`), `REFRESH_ON`, `router.refresh()`; `focusHeading` in `src/components/RouteFocus.tsx`; `Notice` tone `danger`.
- `tests/integration/review.test.ts` -- `reviewGame(spec, judge)` seeds one Contributor key per set and groups with a mock Judge (`createMockJudge`); `render()` for page HTML.
- `tests/integration/authz.test.ts:225` -- foreign-Host Review pattern.
- `tests/e2e/review.spec.ts` -- `collectingGame`/`submitSets`; `tests/e2e/fixtures.ts` `seriousViolations`, `FOCUS_RING`.

## Tasks & Acceptance

**Execution:**
- `src/lib/review.ts` -- `mergeGroupsSchema`.
- `src/server/questions/index.ts`, `src/server/grouping/index.ts` -- `setReviewed`, `mergeGroups`.
- `src/server/review/index.ts` -- `rankedGroups` extraction, `merge`.
- `src/app/spill/[id]/actions.ts` -- `mergeGroups` action.
- `src/components/Button.tsx`, `src/components/GroupCard.tsx`, `src/components/ReviewGroups.tsx` (new client component: Board and below sections, selection, SelectionBar, live region), `src/app/spill/[id]/gjennomgang/page.tsx` -- UI.
- `tests/integration/review.test.ts` -- AC1 (shared key: ID, frozen label, Count less than the sum, sources deleted, Answer count of the Question unchanged and all under the target, reviewed cleared, `edit_count` 1, `groups_merged` 1 via `games.counters`; three sources count 2; custom label kept; a below-the-line source); AC2 two Questions, discarded, malformed, one/duplicate ID, *ready* → `WRONG_STATE`, nothing changed each time; a failing write after the move (e.g. `bumpCounters` mocked to throw) rolls everything back; the page renders checkboxes only on non-discarded cards. Also 5.1's deferred tie case: two forms "Kari"/"kari" once each give the chip "Kari" (SQL order).
- `tests/integration/authz.test.ts` -- Host B's `review.merge` on A's Groups, a random UUID and `abc` Game → `NOT_FOUND`, A's Groups unchanged.
- `tests/unit/review.test.ts` -- `mergeGroupsSchema` bounds.
- `tests/e2e/review.spec.ts` -- AC3: tick one (hint), two ("Slå sammen 2 grupper"), merge, the list re-sorts, focus on the merged heading, the announcement, a multi-chip card; failure path with the action POST aborted → the message inside the bar, selection and Groups unchanged; Esc clears; white focus ring on bar controls; axe clean with the bar open.
- `tests/manual/checklist.md` -- A10 and the NFR-5 merge timing item on the sizing Game.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- FR-20 and NFR-5 rows; 5-2 done.

**Acceptance Criteria:** the four ACs of Story 5.2 in `epics.md` are the contract; the matrix above adds the edge cases.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 29 findings — high 0, medium 2, low 15, false 12, maybe-false 0
- findings:
  - `[medium]` `[patch]` Gap: the SelectionBar's WRONG_STATE and NOT_FOUND branches have no test — patched for NOT_FOUND: the merge e2e merges "dina" + "erik" in a second tab, then merges "erik" + "ola" in the stale tab and asserts the bar is gone, no checkbox checked, no error, and the refreshed card shows both chips. WRONG_STATE needs 5.5's lock to be produced from the browser; added to `deferred`.
  - `[low]` `[reject]` Gap: clearing the selection on a Question change (`key={current.position}`) is untested — the e2e Game has one Question, a two-Question fixture costs a slower spec to guard one prop; 5.5's e2e moves between Questions after marking.
  - `[low]` `[patch]` Gap: `position` ignoring discarded Groups is unpinned — patched: integration case discards the top Group, merges two lower ones and asserts `position` equals the merged Group's Board index + 1 (would be 2 without the filter).
  - `[false]` `[reject]` Edge: a selected Group with no Answers is dropped by the inner join and `target` becomes undefined — unreachable: Groups are created with their Answers (4.2) and every operation deletes the Groups it empties, so no Answer-less Group exists.
  - `[low]` `[reject]` Edge: Esc in a native select or a future dialog also clears the selection — EXPERIENCE says "Esc clears"; Esc on the closed narrow select clearing it is harmless, and the inline rename and dialogs arrive in 5.4, which owns their Esc coordination.
  - `[low]` `[patch]` Edge: an identical second announcement is not re-read — patched: `merge()` empties the live region (`setMerged(undefined)`) before the request.
  - `[false]` `[reject]` Edge (claim): "deletes the emptied Groups" is untrue for Answer-less Groups — same refutation: such Groups cannot exist.
  - `[false]` `[reject]` Intent: the intent's AD list differs from the story's — no defect; the code satisfies AD-4, AD-5, AD-11, AD-15, AD-17 and AD-18.
  - `[false]` `[reject]` Intent: the schema is in `src/lib/review.ts`, not a sibling `schema.ts` — AD-17 also requires the module to re-validate with shared `src/lib` schemas, and no route in the repo has a `schema.ts`; every action so far follows this convention.
  - `[false]` `[reject]` Intent: failure handling differs from AC3's literal sentence for NOT_FOUND and WRONG_STATE — deliberate: EXPERIENCE (which wins) prescribes refresh on stale views and "Brettet er allerede låst." on a locked Board; the generic sentence covers every other failure as AC3 asks. Its test gap is the medium row above.
  - `[low]` `[reject]` Intent: AC4's one-second timing is not measured — AC4 is a manual criterion whose deliverable is the checklist item (epics note 12: measured manually on the sizing Game, not in CI); T1 is in `tests/manual/checklist.md`.
  - `[false]` `[reject]` Intent: `groups_merged` counts N−1 — the unit is a recorded design decision (Design Notes) and AD-18 does not fix it.
  - `[false]` `[reject]` Intent: only the surviving Group's `edit_count` rises — the sources are deleted, so they have no row to increment.
  - `[false]` `[reject]` Intent: extra refusals (discarded, malformed, duplicate) beyond AC2 — they follow from AD-5 and AD-17, and each is tested with nothing changed.
  - `[false]` `[reject]` Intent: the frozen label is tested with a directly written `custom_label` — rename arrives in 5.4; the rule under test (keep the highest-ranked effective label) is the same.
  - `[false]` `[reject]` Intent: UX-contract behaviours beyond the ACs — required by UX-DR12/UX-DR18, which AC3 cites.
  - `[false]` `[reject]` Blind: sprint-status says done while the spec says in-review — the spec reaches `done` at Finalize in the same run, before the commit.
  - `[low]` `[reject]` Blind: AC4 has no measured result — same as the intent row.
  - `[medium]` `[patch]` Blind: the WRONG_STATE and NOT_FOUND failure paths are untested — grouped with the first row; same patch and deferral.
  - `[low]` `[reject]` Blind: the stale-view refresh changes the screen without saying why — EXPERIENCE prescribes a silent refresh showing the saved state; announcing it would invent copy outside the UX contract's literal strings.
  - `[low]` `[patch]` Blind: the live region stays silent on an identical second sentence — grouped with the edge row; same patch.
  - `[low]` `[reject]` Blind: Esc clears regardless of target — same as the edge row.
  - `[low]` `[reject]` Blind: the SelectionBar has no role and its count/hint is not announced — each checkbox announces its own state, the bar follows the sections in tab order, and axe is clean with it open; a status region that mounts with content is not reliably announced anyway.
  - `[low]` `[patch]` Blind: the Kari/kari tie test sits under `review.merge` and has no TRACE row — patched: moved into `describe("review.load")` and given its FR-19 row.
  - `[false]` `[reject]` Blind: a renamed lower-ranked source loses its name — that is AD-11's rule (merge keeps the highest-ranked source's effective label) and PRD FR-20; merge ↔ split is the reversal.
  - `[low]` `[patch]` Blind: `clear()` finds the checkbox by DOM walking — patched: the checkbox has `id="velg-{id}"` and is focused by id.
  - `[low]` `[patch]` Blind: `people`/`groups` copied in three files — patched: one copy each in `src/lib/format.ts`, imported by the card, the page and `ReviewGroups`.
  - `[low]` `[reject]` Blind: tests repeat literal values (251, `rgb(245, 231, 240)`) — house style pins tokens (`FOCUS_RING`, 5.1's pinned colours); a changed limit or token should fail a test.
  - `[low]` `[reject]` Blind: NOT_FOUND carries "Vi finner ikke dette spillet." for stale Groups — the UI never shows that message for merge, and AD-5 wants one identical NOT_FOUND; a separate code would add a branch for no visible gain.

## Design Notes

- **Who writes what.** `grouping.mergeGroups` owns the row changes (AD-1); `review.merge` composes lock, resolution, ranking, the writer, the counter bump and `setReviewed` in one transaction, as AD-15 lists them. No shared "after edit" helper until 5.3/5.4 need it.
- **Counter unit.** `groups_merged` counts Groups merged away (sources minus the target), matching the other counters, which count objects (`answers_moved`, `groups_created`). Recorded here because AD-18 does not fix the unit.
- **Focus timing.** The action's `revalidatePath` refreshes the page in the same round trip; the success state is set inside the transition, so the new props and the state commit together, and an effect then focuses `#gruppe-{id}` and writes the announcement.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- no errors.
- `npm run test` -- all green offline, no key.
- `npm run test:e2e` -- all green, axe clean on Review with the SelectionBar open.

## Auto Run Result

Status: done

**Summary.** The Host can merge Groups on the Review screen. `review.merge` locks the Game in *in review*, resolves every Group ID inside the owned Game and one Question (`NOT_FOUND` otherwise, before any write), and in one transaction moves every Answer into the highest-ranked source, deletes the emptied Groups, freezes the effective label as `custom_label`, bumps `edit_count`, `groups_merged` (Groups merged away) and clears the reviewed mark. Board and *Ikke på brettet* cards have checkboxes; a sticky dark SelectionBar offers "Slå sammen N grupper", waits for the server, dims the busy cards, moves focus to the merged heading and announces "Slått sammen til «…», nå N personer, plass P.". Failures show inside the bar; a stale tab refreshes; a locked Board shows "Brettet er allerede låst." with a link.

**Files changed.**
- `src/server/review/index.ts` -- `rankedGroups` shared by `load` and `merge`; `merge` entry point and `MergeResult`.
- `src/server/grouping/index.ts` -- `mergeGroups` writer (Answers move before the delete).
- `src/server/questions/index.ts` -- `setReviewed`.
- `src/lib/review.ts` -- `mergeGroupsSchema`.
- `src/lib/format.ts` -- shared `people`/`groups` count text.
- `src/app/spill/[id]/actions.ts` -- `mergeGroups` action; `hostAction` also revalidates a sub-path.
- `src/components/ReviewGroups.tsx` (new) -- Board and below sections, selection, SelectionBar, live region.
- `src/components/GroupCard.tsx` -- checkbox, selected look, `aria-busy`, heading id.
- `src/components/Button.tsx` -- `inverse` variant for the dark bar.
- `src/app/spill/[id]/gjennomgang/page.tsx` -- renders `ReviewGroups` keyed by Question, *Forkastet* as children.
- `tests/integration/review.test.ts`, `tests/integration/authz.test.ts`, `tests/unit/review.test.ts`, `tests/e2e/review.spec.ts`, `tests/e2e/fixtures.ts` -- coverage.
- `tests/TRACE.md`, `tests/manual/checklist.md` -- FR-20, NFR-5 and NFR-6 rows; A10 and T1.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 5-2 done.

**Review findings.** One pass, 29 findings: 7 entries patched (one medium: the untested stale-tab path, now e2e; six low: discarded-above-target `position` test, live region re-announcement, misplaced tie test and its TRACE row, checkbox id for focus, one copy of the count helpers), 1 deferred (WRONG_STATE UI path, needs 5.5's lock), the rest rejected with reasons in the triage log.

**AI suggestions rejected or corrected (grading evidence).**
- Corrected: reviewers found the implementation's stale-tab (`NOT_FOUND`) branch untested, the announcement silent on a repeated sentence, a test filed under the wrong `describe`, a DOM walk that 5.3/5.4 would break, and duplicated count text; all patched.
- Rejected: an Esc guard for selects and dialogs (EXPERIENCE says Esc clears; 5.4 owns its dialogs), an announcement for the silent stale refresh (copy not in the UX contract), a status role on the bar (checkboxes announce themselves; axe clean), a two-Question e2e for the `key` prop, guards for Answer-less Groups (unreachable), a separate error message for stale Groups (AD-5 wants one NOT_FOUND), unpinning token literals in tests (house style), and moving the schema to a sibling `schema.ts` (repo convention and AD-17's shared `src/lib` schemas).
- Corrected earlier in the run: the implementation subagent committed its own work although the spec did not ask it to; the commit was kept (suite green, Norwegian message) and the review patches go in a second commit.

**Follow-up review recommendation:** false. This pass patched one `medium` entry and six `low`, no `high`.

**Verification.** `npm run lint` (clean), `npm run typecheck` (clean), `prettier --check .` (clean), `npm run test` 629/629, `npm run test:e2e` 88/88 including axe on Review with the SelectionBar open. Offline, no key, no live Judge call.

**Residual risks.** The WRONG_STATE bar message is untested until 5.5 (deferred). NFR-5 (T1) and A10 are manual checklist items not yet run. The implementation run saw one unexplained axe `document-title` finding in one of four full e2e runs; the test now waits for the title before axe, and it has not recurred.
