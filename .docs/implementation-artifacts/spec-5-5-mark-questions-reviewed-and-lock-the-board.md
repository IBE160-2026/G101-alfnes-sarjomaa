---
title: 'Story 5.5: Mark Questions reviewed and lock the Board'
type: 'feature'
created: '2026-11-23'
baseline_revision: '87ef237c48aa94069a7b2ff235e482c0b5e4735c'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-5-4-rename-discard-and-restore-groups.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The lock clears contributor_key and rank with an UPDATE, so the old row versions keep the cleared values in the answer table's files until the space is reused.
    evidence: |-
      Postgres MVCC leaves the pre-update tuple as a dead row; only VACUUM FULL rewrites the file and drops the bytes (the anonymity test already relies on this for invite_link and submission after close). AD-10 specifies the clear as an UPDATE and asks for no vacuum after confirm, so this is a property of the architecture decision rather than a defect of this diff. Settling it means deciding whether FR-13 covers operator-level file access after lock, and if so extending the best-effort after-commit VACUUM (src/server/db/vacuum.ts, AD-9) to the answer table, which rewrites it for every Game.
    location: >-
      src/server/grouping/index.ts (clearContributorData), src/server/db/vacuum.ts
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Review has no way to finish. "Marker som gjennomgått" and "Lås brettet" are inert `shortcut:` placeholders, no `board_slot` exists, contributor data is never cleared, and the Game can never reach *ready* (FR-21, FR-13). Story 5.5's five ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract.

**Approach:** Add `review.setReviewed` (mark and unmark) and `review.confirmBoard`, which in one transaction writes `board_slot` from `boardCut(rankGroups())`, calls a new `grouping.clearContributorData` and moves the Game to *ready*. Replace the two inert buttons with small client components, give the Game page its *ready* panel, and add the per-Group on-Board flag SM-5 needs to the usage report.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (`full`), then `impeccable` ("Launcher unavailable" path). Read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win on conflict. Operate mode, WCAG 2.1 AA, 44 px targets, literal bokmål.
- **Schema.** New `board_slot(id uuid pk default random, question_id → question ON DELETE CASCADE, position int 1..8 (check), label text, count int, group_id uuid nullable → answer_group ON DELETE SET NULL)`, unique `(question_id, position)`. Generate the migration with `npm run db:generate` and commit it.
- **`review.setReviewed(hostId, { gameId, questionId, reviewed: boolean })`** (AD-4, AD-5, AD-15), one transaction: `games.lockForMutation(… PERMITTED.editReview)`; a malformed, missing or foreign `questionId` (or one of another Game) is `NOT_FOUND`; marking (`reviewed: true`) a Question with no non-discarded Group is `NO_GROUPS_ON_BOARD` ("Minst én gruppe må være på brettet før du kan markere spørsmålet."); then `questions.setReviewed`. No counter and no `edit_count` change. Result `{ position, next }`: `next` is the first unreviewed Question after this one, wrapping to the start, else `null`.
- **`review.confirmBoard(hostId, { gameId })`**, one transaction: lock with `PERMITTED.confirmBoard`; any unreviewed Question is the new `QUESTIONS_UNREVIEWED` ("Gjennomgå alle spørsmålene først."); for each Question, `boardCut(rankedGroups(tx, id)).board` → `board_slot` rows (position = index + 1, effective label, SQL Count, `group_id`), refusing an empty Board with `NO_GROUPS_ON_BOARD`; then `grouping.clearContributorData(tx, gameId)` (every `contributor_key` and `rank` of the Game NULL), then `games.transition(tx, gameId, "in_review", "ready")`. Counts are read before the clear. Result `{ questions: n }`.
- **Actions** `markReviewed` and `confirmBoard` in `src/app/spill/[id]/actions.ts` through `hostAction(…, "gjennomgang")`. Schemas in `src/lib/review.ts`.
- **Usage report (SM-5, AD-18).** Each Group in `grouping.usage` gains `onBoard: boolean`, true when a `board_slot` row has its `group_id` (a read-only left join). Nothing else is added. Amend AD-18 in the spine.
- **Mark button (UX-DR17, UX-DR18).** A client `MarkReviewed` in the Question header renders both states, so its polite live region survives the Question change: unreviewed → primary "Marker som gjennomgått" (pending "Markerer …"); reviewed → "✓ Gjennomgått" plus "Neste spørsmål" (unchanged markup). On success it navigates to `?q={next}` (or refreshes when `next` is null), announces "Spørsmål N er gjennomgått. Viser spørsmål M." (or "Spørsmål N er gjennomgått." when none is left), and moves focus to the Question heading. Failures show directly under the button: `NO_GROUPS_ON_BOARD` → its message; `WRONG_STATE` → "Brettet er allerede låst." with "Gå til spillet"; `NOT_FOUND` → refresh; anything else → "Endringen ble ikke lagret. Prøv igjen.". Reuse 5.4's `FailureNotice` (export it).
- **Lås brettet (UX-DR8, UX-DR17).** A client `LockBoard` keeps today's `aria-disabled` button and reason while any Question is unreviewed; otherwise a `ConfirmDialog` titled "Låse brettet?" with "Dette kan ikke angres. Brettet låses slik det er nå, og gjennomgangen kan ikke endres mer." and a primary "Lås brettet" (pending "Låser …"). Success → `router.push` to the Game page (RouteFocus takes focus to `<h1>`). In the dialog: `WRONG_STATE` → "Brettet er allerede låst." with "Gå til spillet"; `QUESTIONS_UNREVIEWED` and `NOT_FOUND` → refresh; anything else → retry sentence. If a refresh swaps the dialog for the disabled button while focus fell to `<body>`, focus the button (CloseCollection pattern).
- **Game page in *ready*.** A section with `<h2>` "Brettet er låst" and "{N} spørsmål er klare." ("1 spørsmål er klart."). The report link stays.
- **Every Review mutation** keeps the owner check and the *in review* lock (5.2–5.4). Esc handling stays as 5.4 left it; no second Esc path.
- Remove both `shortcut:` comments in `gjennomgang/page.tsx`. FR IDs in test titles, rows in `tests/TRACE.md`, offline, no key, no real names. Commits are made by the workflow's finalize step, in Norwegian.

**Never:**
- No UI to unmark (AD-4 allows it; the UI clears marks only through edits). No `review.getBoard`, no "Start spillet" link and no `/skjerm` route (Epic 6).
- No `contributor_key` or `rank` in any result, prop, DTO, report or log. No new Route Handler, client data library or dependency. No optimistic update.
- Do not touch `.env`, `.logs/` or `prompting/`; no absolute machine paths in tracked files; no per-file Vitest timeouts.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mark | Q1 of three, Q2 already reviewed | `reviewed = true`; `{ position: 1, next: 3 }`; counters unchanged | — |
| Mark last | Q3, the others reviewed | `{ position: 3, next: null }` | — |
| Unmark | reviewed Q1, `reviewed: false` | `reviewed = false` | — |
| All discarded | every Group of Q1 discarded, mark | nothing changes | `NO_GROUPS_ON_BOARD` |
| Bad ref | foreign, random, malformed `questionId`, or another Game's Question | nothing changes | `NOT_FOUND` |
| Bad input | missing or non-boolean `reviewed` | nothing changes | `INVALID_INPUT` |
| Confirm | all reviewed; Q1 has ten Groups, rank 3 discarded | Q1 gets 8 `board_slot` rows 1..8 = `boardCut` board (label, frozen Count, `group_id`), no row for the discarded Group; every key and rank NULL; Game *ready*; `{ questions: n }` | — |
| Confirm early | one Question unreviewed | nothing changes (no rows, keys kept, *in review*) | `QUESTIONS_UNREVIEWED` |
| Locked | Game *ready* after a real confirm; merge, move, new Group, rename, discard, restore, mark, unmark, confirm | nothing changes | `WRONG_STATE` |
| Foreign confirm | Host B on A's Game, random, malformed | nothing changes | `NOT_FOUND` |
| Report | after confirm | each Group `{ origin, editCount, onBoard }`; unchanged Judge Group on the Board `onBoard: true`, cut or discarded `false` | — |

</intent-contract>

## Code Map

- `src/server/review/index.ts` -- `rankedGroups` :42 (counts from `contributor_key`, so read before the clear), `ownedGroup` :211 and `rename` :296 are the entry-point pattern, `UUID` :148. Add `setReviewed`, `confirmBoard` and their result types.
- `src/lib/ranking.ts:50` -- `boardCut` (board, below, discarded); no change.
- `src/server/grouping/index.ts` -- writers `setCustomLabel` :119 and `setDiscarded` :131; add `clearContributorData(tx, gameId)`. `usage` :363 gets the `onBoard` left join on `boardSlot.groupId`.
- `src/server/questions/index.ts:61` -- `setReviewed(tx, id, reviewed)`.
- `src/server/games/index.ts` -- `lockForMutation` :120, `transition` :184.
- `src/server/db/schema.ts` -- add `boardSlot` after `answer`; `drizzle/` gets `0011_*.sql` and its snapshot.
- `src/lib/game-state.ts` -- `PERMITTED.editReview` and `PERMITTED.confirmBoard` exist.
- `src/lib/errors.ts` -- add `NO_GROUPS_ON_BOARD` and `QUESTIONS_UNREVIEWED` to `ErrorCode` and `MESSAGES`.
- `src/lib/review.ts` -- add `markReviewedSchema` and `confirmBoardSchema`.
- `src/app/spill/[id]/actions.ts:103-131` -- action pattern.
- `src/app/spill/[id]/gjennomgang/page.tsx` -- `LockBoard` :41 and the header button :216 are the two `shortcut:`s; pass `gameId`, `questionId`, `reviewed`, positions and the next-link href to the new client components.
- `src/components/ReviewGroups.tsx:46` -- `FailureNotice` (export); `ConfirmDialog.tsx` and `CloseCollection.tsx` (dialog, busy, refresh and focus patterns); `RouteFocus.tsx` `focusHeading`; `useFormAction.ts` `callAction`.
- `src/app/spill/[id]/page.tsx` -- add the `ready` branch beside `in_review` (:188); `questions.list` gives N.
- `src/app/api/spill/[gameId]/rapport/route.ts` -- body unchanged except `onBoard`; update its comment.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- AD-15 :316 (`QUESTIONS_UNREVIEWED`, empty-Board guard) and AD-18 :362 (`onBoard` delivered) as *Amended in Story 5.5* sentences.
- Tests: `tests/integration/review.test.ts` (`reviewGame` :96, `render` :140, `snapshot` :612, the aria-disabled mark test :464 must change); `tests/integration/report.test.ts` (`groups` `toEqual`s at :373–:391 and :446, :458 need `onBoard`); `tests/integration/anonymity.test.ts` (shared Game; add a final `describe("after confirm")` that runs `grouping.run`, marks every Question and confirms); `tests/integration/authz.test.ts:317` pattern; `tests/e2e/review.spec.ts` (`collectingGame` :62, `submitSets` :30, `closeAndOpenReview` :92, `SETS_Q2`; the aria-disabled mark assertion :167 must change); `tests/manual/checklist.md`; `tests/TRACE.md` FR-13 :194, FR-18, FR-21 :293, NFR-5 :393.

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts`, `drizzle/` -- `boardSlot` and its generated migration.
- `src/lib/errors.ts`, `src/lib/review.ts` -- the two codes and two schemas.
- `src/server/grouping/index.ts` -- `clearContributorData`; `onBoard` in `usage`.
- `src/server/review/index.ts` -- `setReviewed`, `confirmBoard`.
- `src/app/spill/[id]/actions.ts` -- `markReviewed`, `confirmBoard`.
- `src/components/MarkReviewed.tsx`, `src/components/LockBoard.tsx` (new), `src/components/ReviewGroups.tsx` (export `FailureNotice`), `src/app/spill/[id]/gjennomgang/page.tsx` -- the two controls; shortcuts removed.
- `src/app/spill/[id]/page.tsx` -- the *ready* panel.
- `ARCHITECTURE-SPINE.md` -- the two amendments.
- `tests/integration/review.test.ts` -- every matrix row except Report and Foreign confirm, each refusal checked with `snapshot` plus `board_slot` rows and game state; the Locked row on a Game confirmed for real; the rendered page (active mark button, enabled lock trigger when all reviewed, the dialog copy); the Game page in *ready* ("9 spørsmål er klare." and "1 spørsmål er klart.").
- `tests/integration/report.test.ts` -- `onBoard` in existing expectations; the Report row.
- `tests/integration/anonymity.test.ts` -- AC4: after a real confirm every `contributor_key` and `rank` of the Game is NULL, and `board_slot` holds labels and Counts only.
- `tests/integration/authz.test.ts` -- Host B's `setReviewed` and `confirmBoard` (and actions) on A's Game → `NOT_FOUND`, A unchanged.
- `tests/e2e/review.spec.ts` -- AC5 on two Questions (nine Groups, then three): all three Groups of Q2 discarded → the `NO_GROUPS_ON_BOARD` message under the button, then restore one; mark Q1 → URL `?q=2`, rail "1 av 2 gjennomgått", the announcement, focus on the Question heading; mark Q2 → "✓ Gjennomgått"; Q1 shows "✓ Gjennomgått" and "Neste spørsmål"; "Lås brettet" opens the dialog with focus on "Avbryt", Esc cancels back to the trigger, confirm lands on the Game page with "Brettet er låst" and "2 spørsmål er klare."; axe clean with the dialog open and on the *ready* page. AC3 from a stale tab opened before the lock: mark, a merge in the SelectionBar (deferred from 5.2) and a discard each show "Brettet er allerede låst." with a working "Gå til spillet"; reloading Review redirects to the Game page.
- `tests/manual/checklist.md` -- row A6 copied from EXPERIENCE.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- FR-13, FR-18, FR-21, NFR-6 rows; 5-5 to done (epic-5 stays `in-progress`; the orchestrator closes it after its reviews).

**Acceptance Criteria:**
- Given a Game in review whose every Question is marked, when the Host confirms and downloads the usage report, then every Group carries `onBoard` and the report still holds no Answer text, label, key, id or rank.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 31 findings — high 0, medium 4, low 15, false 12, maybe-false 0
- findings:
  - `[false]` `[reject]` Intent: unmarking exists only on the server, not in the Review UI — AD-4 lists unmark as permitted, but EXPERIENCE gives a reviewed Question only "✓ Gjennomgått" and "Neste spørsmål", and AC1 is tagged integration. Edits clear the mark in the UI.
  - `[low]` `[reject]` Intent: the AC3 e2e covers mark, merge and discard from the stale tab, not all seven operations — all seven (plus unmark) are refused with `WRONG_STATE` in integration after a real lock, and move, rename and restore use the same `run()` branch as merge and discard. A step per operation would add minutes of e2e for no new path.
  - `[low]` `[reject]` Intent: the lock message is a heading "Brettet er låst" plus "N spørsmål er klare.", not one literal sentence — the words and order are the AC's; EXPERIENCE's *ready* row also lists "Brettet er låst." and the count as two parts of the panel, and every other state panel has an `<h2>` without a period.
  - `[false]` `[reject]` Intent: `QUESTIONS_UNREVIEWED` and `onBoard` go beyond the story text — AD-18 assigns the on-Board flag to Story 5.5 by name, and AD-17 requires every refusal to be a closed `ErrorCode`; neither existing code describes an un-reviewed Board.
  - `[false]` `[reject]` Intent: "Start spillet" is missing from the *ready* page — Story 6.1 AC2 owns it ("Given the *ready* Game page with 'Start spillet'"), and its target `/skjerm` does not exist yet.
  - `[false]` `[reject]` Intent: `review.getBoard` is not implemented — not a 5.5 criterion; play (Epic 6) is its only reader.
  - `[low]` `[patch]` Intent: marking the last Question announces only "Spørsmål N er gjennomgått." — grouped with the Blind screen-reader row; same patch.
  - `[medium]` `[patch]` Verification gap: LockBoard's `QUESTIONS_UNREVIEWED` refresh-and-focus path and its in-dialog `WRONG_STATE` notice were untested — patched with e2e steps: a second tab un-reviews Q1, and A's confirm leaves the disabled "Lås brettet" focused with "(1 igjen)"; after re-marking, A locks while the second tab's dialog is open, and its confirm shows "Brettet er allerede låst." with a working "Gå til spillet".
  - `[low]` `[patch]` Verification gap: MarkReviewed's `NOT_FOUND` refresh and generic retry branches were untested — patched the retry half: an aborted mark POST shows "Endringen ble ikke lagret. Prøv igjen." under the button with the rail unchanged. The `NOT_FOUND` half (reachable only by deleting the Game in another tab) is left, as the reviewer suggested.
  - `[low]` `[patch]` Blind: `board_slot.group_id` has no index, so the `SET NULL` check on Group deletion and the report's left join scan the table — patched with a unique index on `group_id` (many NULLs allowed); the uncommitted migration 0011 was regenerated.
  - `[false]` `[reject]` Blind: one Group could fill two slots — `boardCut` returns each Group once, and the new unique index now enforces it too.
  - `[false]` `[reject]` Blind: no database CHECK on `count` and `label` — the only writer is `confirmBoard`, whose Counts come from `count(distinct contributor_key)` over an inner join with `answer` (at least 1) and whose labels come from non-empty normalised Answers or a 1–40 character rename.
  - `[false]` `[reject]` Blind: `confirmBoard` locks a Game with no Questions — unreachable: Invite links are refused with zero Questions (FR-5), so no Game reaches *in review* without one, and Questions are frozen after *draft*.
  - `[false]` `[reject]` Blind: LockBoard shows "Prøv igjen" for `NO_GROUPS_ON_BOARD` — unreachable: marking needs a kept Group, any discard clears the mark under the same Game lock, and no Group without Answers exists (merge and move delete emptied Groups).
  - `[medium]` `[patch]` Blind: two LockBoard paths are untested — grouped with the verification-gap LockBoard row; same patch.
  - `[low]` `[patch]` Blind: a screen-reader user is not told that every Question is done — patched: when `next` is null the announcement is "Spørsmål N er gjennomgått. Alle spørsmålene er gjennomgått.", asserted in e2e.
  - `[false]` `[reject]` Blind: marking and locking define "on the Board" differently — they agree for every reachable state, because a Group without Answers cannot exist (same reasoning as Story 5.4's triage).
  - `[medium]` `[patch]` Blind: no test proves `clearContributorData` stays inside the locked Game — patched: the confirm test creates a second in-review Game first and asserts its keys and ranks survive the lock.
  - `[low]` `[reject]` Blind: no test runs two confirms at once — `lockForMutation` takes `SELECT … FOR UPDATE`, so the second confirm waits and then fails its state check with `WRONG_STATE`; the sequential `WRONG_STATE`-after-lock test covers that outcome, and PGlite serialises connections anyway.
  - `[low]` `[reject]` Blind: `onBoard` is false for every Group before the lock, which reads like "cut" — SM-5 is computed by the project on reports of locked Games, the AD-18 amendment documents the meaning, and a state field would add report surface no requirement asks for.
  - `[low]` `[reject]` Blind: the *ready* branch calls `requireHost` again and loads the Question list for its length — `requireHost` is `cache()`d per request, the list has at most 20 rows, and the *draft* branch uses the same pattern.
  - `[low]` `[reject]` Blind: the *ready* panel has no next step and no `shortcut:` comment — the next step is Story 6.1's "Start spillet", tracked in sprint status; this is unbuilt scope of a planned story, not a known limit of this code.
  - `[low]` `[reject]` Blind: `FailureNotice` is imported from `ReviewGroups.tsx`, and one `pendingLabel` uses braces — both components already ship on the same page, so the import adds nothing to the bundle; the braces are style only.
  - `[low]` `[patch]` Edge: the `NO_GROUPS_ON_BOARD` notice stays after "Angre forkasting" — patched: the page passes `hasBoard` and the notice shows only while the Question has no Board Group; e2e asserts it disappears.
  - `[low]` `[reject]` Edge: navigating through the rail while a mark is pending lets `router.push` take the Host to the next Question — a mark finishes within a second (NFR-5), and landing on the next unreviewed Question is what the Host asked for by marking.
  - `[false]` `[reject]` Edge: LockBoard treats `NO_GROUPS_ON_BOARD` as retryable — same as the Blind row: unreachable.
  - `[medium]` `[defer]` Edge: the UPDATE leaves the cleared keys and ranks in dead row versions until vacuum — real (Postgres MVCC), but AD-10 specifies the clear as an UPDATE with no vacuum after confirm, so this is an architecture question, not a defect of this diff. Deferred with the decision it needs.
  - `[false]` `[reject]` Intent (descriptive rows of the audit that matched the diff: AC1 refusal under the button, AC2 never more than eight and no discarded Group, AC4, AC5 checklist row A6) — the auditor reported these as matching; logged so the total counts every row.
  - `[low]` `[reject]` Intent: "Neste spørsmål" shows only when a next Question exists — the last Question has no next one, which is the same behaviour 5.1 built and tested.
  - `[low]` `[reject]` Intent: "next" wraps to earlier Questions, checked only in integration — the wrap is server logic with its own integration assertion; the UI just follows `next`.
  - `[false]` `[reject]` Intent: the stale tab in the original e2e could not reach confirm — now covered by the patched LockBoard steps.

## Design Notes

- **SM-5 needs only `onBoard`.** AD-18 defines SM-5 as the share of `origin = judge` Groups that reach the Board with `edit_count = 0`. `board_slot.group_id` already says which Groups reached it, so the report gains one boolean per Group and no counter.
- **A second polite live region.** `ReviewGroups` is keyed by Question, so its live region remounts on the very navigation a mark causes, and a region whose text arrives at mount is often not read. `MarkReviewed` sits outside the key and keeps its own region. The contract's "one polite region per page" is bent here on purpose; a shared region would mean restructuring `ReviewGroups`.
- **`QUESTIONS_UNREVIEWED` is a new code.** Neither `WRONG_STATE` ("Brettet er allerede låst.") nor `NOT_FOUND` describes a Board that a second tab un-reviewed, and AD-17 asks for a closed `ErrorCode` union. The UI only reaches it from a stale tab and refreshes.
- **Dialog copy** is not in the UX contract; it follows the close-Collection dialog's pattern ("Dette kan ikke angres." first).

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, with axe clean on Review with the lock dialog open and on the *ready* Game page.

## Auto Run Result

Status: done

**Summary.** The Host can mark each Question reviewed and lock the Board, which ends Review.
- `review.setReviewed` marks and unmarks a Question under the Game lock. Marking a Question with no Group on the Board is `NO_GROUPS_ON_BOARD`. The result names the next unreviewed Question, wrapping to the start.
- `review.confirmBoard` refuses while any Question is unreviewed (the new `QUESTIONS_UNREVIEWED`). In one transaction it writes `board_slot` from `boardCut(rankGroups())` with frozen labels and Counts, calls the new `grouping.clearContributorData`, and moves the Game to *ready*. A discarded Group never gets a slot.
- "Marker som gjennomgått" works: it opens the next unreviewed Question, announces "Spørsmål N er gjennomgått. Viser spørsmål M." (or "… Alle spørsmålene er gjennomgått." on the last one) and focuses the Question heading. Refusals show under the button.
- "Lås brettet" opens a ConfirmDialog and lands on the Game page, whose *ready* panel says "Brettet er låst" and "N spørsmål er klare." ("1 spørsmål er klart."). A stale tab shows "Brettet er allerede låst." with "Gå til spillet" for marking, selection operations, card operations and confirming.
- The usage report gives every Group an `onBoard` flag from `board_slot.group_id`, which is all SM-5 needs.
- Both `shortcut:` placeholders in the Review page are gone.

**Files changed.**
- `src/server/db/schema.ts`, `drizzle/0011_medical_adam_warlock.sql`, `drizzle/meta/*` -- the `board_slot` table (position 1–8, unique per Question, unique `group_id`).
- `src/lib/errors.ts`, `src/lib/review.ts` -- `NO_GROUPS_ON_BOARD`, `QUESTIONS_UNREVIEWED`, `markReviewedSchema`, `confirmBoardSchema`.
- `src/server/grouping/index.ts` -- `clearContributorData`; `onBoard` in `usage`.
- `src/server/review/index.ts` -- `setReviewed`, `confirmBoard`, `MarkResult`.
- `src/app/spill/[id]/actions.ts` -- `markReviewed` and `confirmBoard` actions.
- `src/components/MarkReviewed.tsx`, `src/components/LockBoard.tsx` (new), `src/components/ReviewGroups.tsx` (exports `FailureNotice`), `src/app/spill/[id]/gjennomgang/page.tsx` -- the two controls.
- `src/app/spill/[id]/page.tsx` -- the *ready* panel. `src/app/api/spill/[gameId]/rapport/route.ts` -- comment.
- `ARCHITECTURE-SPINE.md` -- *Amended in Story 5.5* sentences under AD-15 and AD-18.
- `tests/integration/review.test.ts`, `report.test.ts`, `anonymity.test.ts`, `authz.test.ts`, `delete.test.ts` (one explicit `SET NULL` exception), `tests/e2e/review.spec.ts`, `tests/e2e/close.spec.ts` (`onBoard` in the exact report JSON).
- `tests/manual/checklist.md` (A6), `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` (5-5 done; epic-5 stays `in-progress` for the orchestrator to close after its reviews).

**Review findings.** One pass, 31 findings (0 high, 4 medium, 15 low, 12 false).
- 6 entries patched (2 medium, 4 low): the LockBoard refusal paths in e2e, the cross-Game check for `clearContributorData`, the aborted-mark e2e step, the unique index on `board_slot.group_id`, the "Alle spørsmålene er gjennomgått." announcement, and the stale `NO_GROUPS_ON_BOARD` notice after a restore.
- 1 deferred (medium): dead row versions keep the cleared keys until vacuum (architecture question, see `deferred`).
- The rest rejected, each with its reason in the triage log.

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (implementation output, found in review).** The lock dialog's refusal paths had no test; a screen-reader user was not told when every Question was done; the "Minst én gruppe …" notice stayed after the Group was restored; `board_slot.group_id` had no index.
- **Rejected (reviewer suggestions).** An unmark button (not in the UX contract); a guard for a Game with no Questions and for Groups without Answers (both unreachable); database CHECKs on frozen values (one writer, values proven non-empty); a `state` field in the report; a `shortcut:` comment for Epic 6's "Start spillet"; a concurrent-confirm test (the Game lock already serialises it); moving `FailureNotice` to its own file.
- **Corrected in planning.** The cached epic context was older than the spine by one 5.4 amendment; it was read directly instead of recompiled, since the amendment was 5.4's own. The confirm refusal needed a code that neither `WRONG_STATE` nor `NOT_FOUND` fits, so `QUESTIONS_UNREVIEWED` was added (Design Notes). "1 spørsmål er klart." was added because "1 spørsmål er klare." is ungrammatical.
- **Corrected in orchestration.** The platform launched the implementation agent and the four reviewers in the background, although the workflow asks for blocking calls. Each result was awaited before the next step, so nothing was skipped.

**Follow-up review recommendation:** true. Two `medium` entries were patched. The specific unverified risk is the LockBoard stale-tab behaviour added in review (the dialog giving way to the disabled button with focus restored, and the in-dialog locked notice): it passes the full e2e run, but no fresh reviewer has read it.

**Verification.**
- `npm run lint`, `npm run typecheck` and `prettier --check .` are clean.
- `npm run test`: 668/668, offline, no key.
- `npm run test:e2e`: 91/91 after the review patches, including axe with the lock dialog open and on the *ready* Game page.

**Residual risks.**
- The deferred dead-tuple question (FR-13 at the file level after lock).
- Two polite live regions on the Review page (Design Notes).
- Manual check A6 (Review by keyboard only) and NFR-5 timing have not been run.
- `MarkReviewed`'s `NOT_FOUND` refresh is untested (only reachable by deleting the Game in another tab).
