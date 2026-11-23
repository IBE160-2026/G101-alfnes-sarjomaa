---
title: 'Story 5.4: Rename, discard and restore Groups'
type: 'feature'
created: '2026-11-23'
baseline_revision: 'edc6ed6d036041978aebabd580127265a421eab3'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-5-3-move-answers-to-another-group-or-a-new-group.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      No executable check yet proves that a discarded Group never reaches play; today it rests on boardCut in review.load.
    evidence: |-
      board_slot, confirmBoard and getBoard arrive in Story 5.5. This story proves the Board cut (integration and e2e) and records the rule in AD-15. Story 5.5 should confirm a Board on a Question with a discarded Group and assert that no board_slot row carries its group_id or label.
    location: >-
      src/server/review/index.ts (confirmBoard, Story 5.5)
    severity: medium
  - summary: >-
      tests/unit/lint-zones.test.ts and tests/integration/db-open-retry.test.ts sometimes time out at 5000 ms under the full parallel suite on a loaded machine.
    evidence: |-
      Seen in 3 of 7 full `npm run test` runs during this story while the machine's load average was about 25. Both pass alone (lint-zones 27/27 in 1.7 s) and in every run at normal load. Neither touches this story's code; it is the same pattern as the db.test.ts timeout deferred in Story 5.3. Raise their timeouts or run these files without parallel load.
    location: >-
      tests/unit/lint-zones.test.ts, tests/integration/db-open-retry.test.ts
    severity: low
---

<intent-contract>

## Intent

**Problem:** After 5.3 the Host can rename a Group only right after "Ny gruppe", and cannot keep a hurtful Group off the shared screen at all (FR-20, FR-21). Story 5.4's three ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract.

**Approach:** Reuse 5.3's `review.rename` and inline rename field, and make them reachable from every Board and *Ikke på brettet* card: through an always-visible Group menu ("Gi nytt navn") and by clicking the label. Add `review.discard` and `review.restore`. Both flip `answer_group.discarded` through a new `grouping.setDiscarded` writer and never delete a Group or Answer. *Forkastet* moves into `ReviewGroups`, so its "Angre forkasting" button shares the live region, focus handling and card-top failure Notice.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (level `full`), then `impeccable` (its launcher is not installed, so take the "Launcher unavailable" path). Read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win on conflict. Use Operate mode, WCAG 2.1 AA, 44 px targets and literal bokmål.
- **Discard and restore follow `review.rename`.** Each runs in one transaction (AD-4, AD-5, AD-15, AD-18):
  1. `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.editReview })`.
  2. Resolve the Group inside the owned Game. A malformed UUID, a missing or foreign Group, or a Group in the wrong discarded state is `NOT_FOUND` before any write. Discard needs `discarded = false`; restore needs `discarded = true`.
  3. `grouping.setDiscarded(tx, { groupId, discarded })` sets the flag and adds `edit_count + 1`.
  4. `games.bumpCounters`: `{ groupsDiscarded: 1 }` or `{ groupsRestored: 1 }`.
  5. `questions.setReviewed(tx, questionId, false)`.

  Extend `ownedGroup` with the wanted discarded state instead of writing a second resolver.
- **Input.** `groupRefSchema` `{ gameId: string, groupId: string }` in `src/lib/review.ts` serves both operations; anything else is `INVALID_INPUT`. The result is `{ groupId, label }`, where `label` is the effective label (`custom_label`, else the FR-16 default), taken from `rankedGroups`.
- **Rename is unchanged on the server.** It stays 1 to 40 trimmed characters and refuses a discarded Group with `NOT_FOUND`. Only its reach changes.
- **Discarded Groups are frozen.** They are never a merge, move or rename source or target; that is `NOT_FOUND`, as 5.2 and 5.3 already do. They are restored first. `boardCut` already keeps them out of the Board and of the ninth-Group promotion. 5.5's `confirmBoard` builds on `boardCut`, so they never reach play. Record this as an *Amended in Story 5.4* sentence under AD-15's *Review writes* in `ARCHITECTURE-SPINE.md`.
- **Actions.** Add `discardGroup` and `restoreGroup` to `src/app/spill/[id]/actions.ts` through `hostAction(…, "gjennomgang")`.
- **Group menu (UX-DR10, DESIGN GroupCard).** Every Board and *Ikke på brettet* card gets the menu, compact rows included. It sits right of the Count.
  - The trigger is a 44 px ghost button showing "⋯" (`aria-hidden`), with the accessible name "Mer for «{label}»", `aria-expanded` and `aria-controls`.
  - It is a disclosure: a list of two buttons, "Gi nytt navn" and "Forkast fra brettet", in a small surface popover below the trigger.
  - Esc closes it and returns focus to the trigger; that Esc must not reach the selection's Esc listener. A pointer-down outside closes it. Picking an item closes it.
  - It does nothing while an operation is pending.
- **Rename entry.**
  - "Gi nytt navn" or a click on the `<h4>` label opens 5.3's rename field for that Group, prefilled with its label, focused with the text selected, and with no announcement. This applies on non-discarded cards only.
  - The label shows it can be clicked (pointer cursor and a hover underline). The menu is the keyboard path.
  - Opening a rename cancels any other open rename, as Esc does.
  - Enter, Esc, the counter, the field errors and the 5.3 messages are kept as they are.
- **Discard.** "Forkast fra brettet" calls `discardGroup`. While it is pending, the card is `aria-busy` and dimmed. On success:
  - the card renders under *Forkastet*;
  - focus goes to its `#gruppe-{id}` heading;
  - the polite live region says "«{label}» er forkastet og vises ikke i spillet.";
  - the next Group below the line moves up by ranking alone.
- ***Forkastet* card.**
  - Label struck through, Count, Answers as plain text.
  - No checkboxes, no menu and no label click.
  - One `button-secondary` "Angre forkasting" right of the Count. Its accessible name starts with the visible text and adds a screen-reader-only " av «{label}»" (WCAG 2.5.3).
  - On success, focus goes to the restored `#gruppe-{id}` heading at its ranked place, and the live region says "«{label}» er tilbake.".
- **Card failures (EXPERIENCE Review states).** Rename, discard and restore failures show at the top of the affected card, through 5.3's `FailureNotice` in the `notice` slot. One card-failure state serves all three, and it clears when the next operation starts.
  - `NOT_FOUND` → `stale()` (refresh, clear, focus `#pa-brettet`);
  - `WRONG_STATE` → "Brettet er allerede låst." with "Gå til spillet";
  - anything else → "Endringen ble ikke lagret. Prøv igjen.", with the screen otherwise unchanged.
- **Selection.** A successful discard or restore clears any selection, as merge and move do; their IDs may be stale.
- **Tests.** Put FR IDs in test titles, add rows to `tests/TRACE.md`, and run offline with no key and no real names. Do not commit: the orchestrator commits.

**Never:**
- No `DELETE` of `answer_group` or `answer` on discard. No confirmation dialog, no optimistic update, no new Route Handler, no client data library, no new dependency.
- No `contributor_key` or `rank` in any result, prop, DTO or log, and no Answer text in logs.
- No marking reviewed, no `board_slot` and no locking (5.5). The disabled "Marker som gjennomgått" stays.
- Do not touch `.env`, `.logs/` or `prompting/`. Never run `judge:smoke` or `judge:record`. Never write absolute machine paths into tracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Discard on Board | Question with 9 non-discarded Groups, discard rank 3 | `discarded = true`, row and Answers kept; `load` shows 8 on the Board with the former rank 9, the Group under `discarded` with its chips; `edit_count + 1`, `groups_discarded + 1`, reviewed cleared; result `{ groupId, label }` | — |
| Restore | the Group above | back at its ranked place on the Board, the former rank 9 below again; `edit_count + 1` again, `groups_restored + 1`, reviewed cleared | — |
| Discard twice / restore kept | discard a discarded Group, restore a non-discarded one | nothing changes | `NOT_FOUND` |
| Foreign / random / malformed | Host B's Group, random UUID, `abc` Group or Game | nothing changes | `NOT_FOUND` |
| Bad input | missing `groupId` or a number | nothing changes | `INVALID_INPUT` |
| Wrong state | Game *ready* | nothing changes | `WRONG_STATE` |
| Frozen | merge, move or rename touching a discarded Group | nothing changes | `NOT_FOUND` (existing 5.2/5.3 tests) |

</intent-contract>

## Code Map

- `src/server/review/index.ts:211` -- `ownedGroup(tx, gameId, groupId)` filters `discarded = false`; give it the wanted state. `rename` at :296 is the entry-point pattern. `rankedGroups` at :42 gives the effective label (includes discarded Groups). `placeOf` at :197 filters discarded ones out; do not use it for a discarded Group.
- `src/server/grouping/index.ts:117` -- `setCustomLabel` is the writer pattern; add `setDiscarded` beside it (the spine's module table already lists it).
- `src/lib/review.ts` -- `renameGroupSchema` pattern; add `groupRefSchema`.
- `src/lib/ranking.ts:50` -- `boardCut` already splits off discarded Groups and promotes the ninth; no change.
- `src/server/games/index.ts:227` -- `bumpCounters` (`groupsDiscarded`, `groupsRestored` exist, `schema.ts:70`). `src/server/questions/index.ts:61` -- `setReviewed`.
- `src/app/spill/[id]/actions.ts:103-119` -- `mergeGroups`, `moveAnswers` and `renameGroup` show the action pattern.
- `src/app/spill/[id]/gjennomgang/page.tsx:238-256` -- passes *Forkastet* as `children` of `ReviewGroups`; pass `discarded={current.discarded}` instead and drop the `GroupCard` import if it is unused.
- `src/components/ReviewGroups.tsx` -- `run()` (selection operations; bar failure), `stale()`, `closeRename`, `onRenameKey`, `Renaming.failure`, `card()`, the `done` focus effect and the live region. Generalise `run()` for card operations (busy card id, card failure) instead of writing a second runner. Render the *Forkastet* section here (markup now in `page.tsx`).
- `src/components/GroupCard.tsx` -- add an `actions` slot after the Count (menu or "Angre forkasting") and an `onLabelClick` on the `<h4>`. The `notice` slot exists. Update the header comment ("No menu until Story 5.4").
- New `src/components/GroupMenu.tsx` -- a small client disclosure (trigger, list, Esc, pointer-down outside). `Button` in `src/components/Button.tsx` has `ghost` and `secondary`.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md:314` -- AD-15 *Review writes*; add the frozen-discarded sentence.
- `tests/integration/review.test.ts` -- `reviewGame` :96, `render` :140, `groupIdOf` :156. The discarded-render test at :409 shows how a Group is discarded directly in the DB. The `describe("review.rename")` at :1187 is the pattern for `describe("review.discard and review.restore")`.
- `tests/integration/authz.test.ts` -- the foreign-Host rename and move cases are the pattern.
- `tests/e2e/review.spec.ts` -- `collectingGame` :62, `submitSets` :30, `closeAndOpenReview` :92 and `SETS` (nine singleton Groups: kari 3 at rank 1, per at rank 9). The merge test at :278 has the route-abort and stale-tab patterns. `tests/e2e/fixtures.ts` has `seriousViolations`.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` (`5-4-rename-discard-and-restore-groups`).

## Tasks & Acceptance

**Execution:**
- `src/lib/review.ts` -- `groupRefSchema`.
- `src/server/grouping/index.ts` -- `setDiscarded`.
- `src/server/review/index.ts` -- `ownedGroup` with the discarded state; `discard` and `restore` exports (sharing one private helper); `DiscardResult` type.
- `src/app/spill/[id]/actions.ts` -- `discardGroup`, `restoreGroup`.
- `src/components/GroupMenu.tsx`, `src/components/GroupCard.tsx`, `src/components/ReviewGroups.tsx`, `src/app/spill/[id]/gjennomgang/page.tsx` -- menu, label click, *Forkastet* with "Angre forkasting", card failures, focus and announcements.
- `ARCHITECTURE-SPINE.md` -- the AD-15 amendment.
- `tests/integration/review.test.ts` -- every server row of the matrix, with nothing changed in each refusal. Counts come through `review.load`, counters through `games.counters`, and `discarded` and `edit_count` from `answer_group`. Answers are counted before and after a discard to prove nothing was deleted. Also a page render: every Board and below-the-line card has a "Mer for «label»" button (compact rows included), and a *Forkastet* card has "Angre forkasting" and no menu.
- `tests/integration/authz.test.ts` -- Host B's `review.discard` and `review.restore` on A's Groups → `NOT_FOUND`, with A unchanged.
- `tests/e2e/review.spec.ts` -- AC3 on the nine-Group Question:
  - the menu has `aria-expanded`, its two items, and Esc closes it with focus back on the trigger;
  - "Gi nytt navn" opens the focused field with "N/40"; Enter saves, the heading changes and "Navnet er endret." is announced;
  - a label click opens the field, and Esc cancels;
  - an aborted rename POST shows "Endringen ble ikke lagret. Prøv igjen." at the top of that card with the field still open (5.3's deferred test);
  - a rename from a stale tab, after another tab discarded that Group, refreshes and focuses `#pa-brettet`;
  - "Forkast fra brettet" moves the card to *Forkastet*: struck label, no checkbox in the section, "Angre forkasting", rank-9 Group now on the Board, the announcement, focus on its heading;
  - "Angre forkasting" puts it back at its rank, with the announcement;
  - an aborted discard shows the card-top Notice;
  - axe is clean with the menu open and with *Forkastet* shown.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- FR-20, FR-21 and NFR-6 rows; set 5-4 to done.

**Acceptance Criteria:**
- Given a Game in review, when the Host discards a Group and then restores it, then the usage report (`games.counters`) shows `groupsDiscarded` 1 and `groupsRestored` 1, and the Group's `edit_count` is 2.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 34 findings — high 0, medium 10, low 11, false 13, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind: the label lookup in `flipDiscarded` crashes for a Group with no Answers (`rankedGroups` inner-joins `answer`) — no such Group can exist. Grouping inserts Groups from Answers, and merge and move delete every source they empty in the same transaction.
  - `[medium]` `[patch]` Blind: the Group menu stays open when keyboard focus leaves it — patched. `GroupMenu` closes on blur when `relatedTarget` is outside the root. A null `relatedTarget` is ignored, so a Safari mouse-down on an item still clicks.
  - `[low]` `[reject]` Blind: the menu trigger is silently inert while an operation is pending — a pending operation lasts under a second (NFR-5), and every other control on the screen ignores input while pending in the same way (5.2/5.3). `aria-disabled` flicker would add noise for no gain.
  - `[low]` `[reject]` Blind: opening a rename on another card drops the open field's typed text — that is the spec's rule ("cancels any other open rename, as Esc does"), and the Host takes an explicit action on another Group. A dirty-field confirmation would be a new dialog nobody asked for.
  - `[low]` `[reject]` Blind: the label's click handler sits on a non-interactive `<h4>` — lint is clean, and EXPERIENCE names the always-visible menu as the keyboard path. A button in every heading would add a second tab stop on each of up to about 40 cards.
  - `[false]` `[reject]` Blind: no usage-report test for the new counters — the report's `counters` body is `games.counters` itself (AD-18), and the integration tests read `groups_discarded` and `groups_restored` through it.
  - `[medium]` `[patch]` Blind: keyboard, outside-click and Esc-with-selection paths of the menu are untested — grouped with the verification-gap rows below; same patch.
  - `[low]` `[reject]` Blind: stale-tab coverage is rename-only — discard and restore use the same `run()` NOT_FOUND branch, which the 5.2 merge stale-tab e2e and the 5.4 rename stale-tab e2e exercise. Their server NOT_FOUND cases (a discarded Group discarded again, a kept one restored) are integration-tested.
  - `[low]` `[reject]` Blind: the integration test counts compact rows by the `min-h-13` class — the same pin is used in the 5.2 and 5.3 tests. A change to the 52 px row should fail.
  - `[false]` `[reject]` Blind: the e2e test is one large test — this is house style for Review (5.2 and 5.3 do the same), so it is not a defect.
  - `[false]` `[reject]` Blind: the diff leaves out the spec and the epic context — by design. The spec goes to the edge-case layer as the claims file, and both are committed at finalize.
  - `[false]` `[reject]` Blind: `DiscardResult` is shared by restore, and `ownedGroup` takes a positional boolean — no caller diverges and no rule breaks. The name is the result shape of both operations.
  - `[false]` `[reject]` Blind: TRACE.md claims coverage of 5.5's lock — the row says the guarantee comes through `boardCut`, and the FR-21 section lists "Pending: Story 5.5".
  - `[medium]` `[patch]` Verification gap: Esc in an open Group menu must not clear the selection, and nothing tested it. Patched with e2e steps, and the new step exposed a real bug. Next's App Router attaches React's root listener to `document`, so React's `stopPropagation` cannot stop the selection's own `document` listener. The selection's Esc listener now skips events that are already `defaultPrevented`. The menu and the rename field both call `preventDefault`, so this also fixes the same untested bug in 5.3's rename field.
  - `[medium]` `[patch]` Verification gap: closing the menu with an outside click was untested — patched. The e2e test clicks the "På brettet" heading and asserts `aria-expanded="false"`, and Tabbing past the last item also closes the menu.
  - `[medium]` `[patch]` Verification gap: the failure and pending state of a restore were untested — patched. The e2e test aborts the POST and clicks "Angre forkasting"; the retry alert shows inside that card, which stays under *Forkastet*.
  - `[medium]` `[defer]` Intent: "never reaches play" has no executable check, because play reads `board_slot`, which does not exist until 5.5 — deferred to 5.5's `confirmBoard` (see `deferred`).
  - `[false]` `[reject]` Intent: no ranking or selection query changed, and there are no new merge/move tests with discarded Groups — every selector already filters `discarded = false`. The existing tests already cover discarded sources and targets for merge ("Groups of two Questions, a discarded Group …"), move ("a discarded target or source …") and rename ("a discarded, random or malformed Group …").
  - `[false]` `[reject]` Intent: the decision lives in `ARCHITECTURE-SPINE.md` and in an uncommitted spec — the spec is committed at finalize with the decision in its Design Notes. Amending the spine with *Amended in Story N* is the project's practice (5.3 did the same).
  - `[false]` `[reject]` Intent: AC1 is not re-tested in this diff — 5.3's `describe("review.rename")` tests AC1 word for word: 1 to 40 characters, `INVALID_INPUT`, the cleared mark and `groups_renamed`.
  - `[false]` `[reject]` Intent: the e2e test does not read a discarded Group's Answer text — the AC2 integration test asserts the discarded DTO's chips, and the 5.1 render test asserts plain Answer text under *Forkastet*.
  - `[medium]` `[patch]` Intent: there is no e2e test for a failed restore — grouped with the restore-failure verification-gap row; same patch.
  - `[low]` `[reject]` Intent: the label click is pointer-only — grouped with the `<h4>` row; same reason.
  - `[false]` `[reject]` Intent: restore increments `edit_count` instead of reverting it — AD-15 says every edit increments the affected Groups, and the Design Notes record why.
  - `[false]` `[reject]` Intent: earlier e2e and integration assertions were rewritten — they only make room for the new "⋯" button (`useInnerText`, a regex, one extra Tab stop). Every original check is kept.
  - `[false]` `[reject]` Edge: `rankedGroups(...).find(...)!` can be undefined — same as the first Blind row: no Group without Answers exists.
  - `[medium]` `[patch]` Edge: "Angre forkasting" has `pending` but no `pendingLabel`, so it renders empty after 300 ms — patched with `pendingLabel="Angrer …"`.
  - `[low]` `[patch]` Edge: once every Group is discarded there is no `#pa-brettet`, so `stale()` loses focus — patched. `stale()` falls back to the `#forkastet` heading.
  - `[medium]` `[patch]` Edge: several menus can be open at once after Tabbing — grouped with the menu-blur row; same patch.
  - `[medium]` `[patch]` Edge: Esc after Tabbing out of an open menu clears the selection and leaves the menu open — grouped with the menu-blur row; same patch.
  - `[low]` `[reject]` Edge: a menu that is open when an operation starts keeps items that do nothing — after the blur patch, any way to start an operation (a pointer-down elsewhere, or focus moving out) closes the menu first.
  - `[low]` `[reject]` Edge: opening a rename leaves a failed merge's message in the SelectionBar — the message is still true for the selection the Host keeps, and the next selection operation clears it.
  - `[low]` `[reject]` Edge (claim): Answers are counted only after the discard — the fixture has exactly nine Answers, so asserting nine afterwards is the before/after check.
  - `[low]` `[patch]` Edge (claim): `stale()`'s focus target is missing once every Group is discarded — grouped with the `#pa-brettet` row; same patch.

## Design Notes

- **Discarded Groups are frozen (merge, move, rename).** As a source, merge or move would silently resurrect the discarded Group's Answers onto the Board. As a target, they would hide non-discarded Answers off the Board. Both lose information without telling the Host. Refusing them (`NOT_FOUND`, the existing 5.2/5.3 behaviour) and requiring "Angre forkasting" first keeps every effect visible. The UI cannot send such a request, because *Forkastet* cards have no checkboxes or menu. A stale tab is the only path, and it refreshes.
- **Wrong-state discard and restore are `NOT_FOUND`, not a no-op.** A second tab that already discarded the Group shows a stale view. `NOT_FOUND` refreshes it, as for merge. Counting a no-op discard would also skew `groups_discarded`.
- **`edit_count`.** Discard and restore each add 1, because AD-15 says every edit increments the affected Group. A Judge Group discarded and restored therefore no longer counts as accepted unchanged for SM-5. That is honest: the Host acted on it.
- **Forkastet moves into the client component.** "Angre forkasting" needs the shared runner, live region and focus effect. Keeping it as server `children` would need a second runner.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, with axe clean on Review with the Group menu open and with *Forkastet* shown.

## Auto Run Result

Status: done

**Summary.** The Host can rename any Group from its menu or by clicking its label, and can discard a Group from the Board and restore it.
- Every Board and *Ikke på brettet* card, compact rows included, has an always-visible "⋯" disclosure, "Mer for «label»", with "Gi nytt navn" and "Forkast fra brettet".
- Rename reuses 5.3's `review.rename` and inline field; no second rename path.
- `review.discard` and `review.restore` only flip `answer_group.discarded` through the new `grouping.setDiscarded`. Each runs in one transaction with the owner and *in review* checks (wrong discarded state is `NOT_FOUND`), `edit_count + 1`, `groups_discarded` or `groups_restored`, and the cleared reviewed mark. Nothing is deleted.
- *Forkastet* is rendered by `ReviewGroups`, so "Angre forkasting" shares the runner, the live region and the focus handling. Discard promotes the ninth Group by ranking alone, and restore returns the Group to its ranked place.
- Rename, discard and restore failures show at the top of the card.
- Discarded Groups are frozen for merge, move and rename until restored (Design Notes, AD-15 amendment).

**Files changed.**
- `src/lib/review.ts` -- `groupRefSchema`.
- `src/server/grouping/index.ts` -- the `setDiscarded` writer.
- `src/server/review/index.ts` -- `ownedGroup` with the wanted discarded state; `discard`, `restore` and `DiscardResult`.
- `src/app/spill/[id]/actions.ts` -- the `discardGroup` and `restoreGroup` actions.
- `src/components/GroupMenu.tsx` (new) -- the Group menu disclosure.
- `src/components/GroupCard.tsx` -- the `actions` slot and `onLabelClick`.
- `src/components/ReviewGroups.tsx` -- card operations in `run()`, one card-failure state, `openRename`, the *Forkastet* section, and an Esc listener that skips handled events.
- `src/app/spill/[id]/gjennomgang/page.tsx` -- passes `discarded` instead of children.
- `ARCHITECTURE-SPINE.md` -- the AD-15 amendment (discarded Groups frozen, never deleted).
- `tests/integration/review.test.ts`, `tests/integration/authz.test.ts`, `tests/e2e/review.spec.ts` -- coverage, plus small adaptations of earlier assertions to the "⋯" button.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- FR-20, FR-21 and NFR-6 rows; 5-4 set to done.
- `.docs/implementation-artifacts/epic-5-context.md` -- regenerated, because the spine had changed in 5.3.

**Review findings.** One pass with 34 findings (0 high, 10 medium, 11 low, 13 false).
- 5 entries were patched (4 medium, 1 low): the menu closing on blur, the untested menu paths (which exposed the Esc bug), the untested restore failure, the blank "Angre forkasting" while pending, and the focus fallback in `stale()`.
- 2 items were deferred: the play-level check to 5.5, and the load-sensitive test timeouts.
- The rest were rejected with reasons in the triage log.

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (implementation output).**
  - "Angre forkasting" went blank while pending.
  - The menu stayed open after Tabbing out.
  - `stale()` had no focus target once every Group was discarded.
  - The selection's Esc listener could not be stopped by `stopPropagation`, because React's root listener is on `document` in the App Router. This bug was also latent in 5.3's rename field, and was found only by the new review-driven e2e step.
- **Rejected (reviewer suggestions).**
  - A button inside every label heading (a second tab stop per card; the menu is the keyboard path).
  - A confirmation before dropping another open rename (a new dialog; the spec equates it with Esc).
  - `aria-disabled` on the menu trigger while pending.
  - Re-testing the report's counters and AC1 (both already covered).
  - A guard for Groups with no Answers (cannot exist).
  - Splitting the e2e test (house style).
- **Corrected in planning.**
  - The cached epic context was stale (the spine changed in 5.3), so it was regenerated before planning.
  - The decision on discarded Groups in merge, move and rename (frozen, `NOT_FOUND`, restore first) was made explicit, because the epics leave it open.
- **Corrected in orchestration.** The platform launched every subagent (context, implementation and the four reviewers) in the background, although the workflow asks for blocking calls. Each result was awaited before the next step, so nothing was skipped.

**Follow-up review recommendation:** true. This pass patched four `medium` entries. The specific unverified risk is the late change to the selection's Esc listener (`defaultPrevented`). It changes Esc for the 5.2 and 5.3 selection and the 5.3 rename field too. It is covered by the full e2e run (90/90), but no fresh independent review has looked at it.

**Verification.**
- `npm run lint`, `npm run typecheck` and `prettier --check .` are clean.
- `npm run test`: 653/653. Some runs on a heavily loaded machine (load average about 25) hit the deferred timeouts in `lint-zones.test.ts` and `db-open-retry.test.ts`; both pass alone.
- `npm run test:e2e`: 90/90 after the review patches, including axe with the Group menu open and with *Forkastet* shown.
- Offline, with no key and no live Judge call.

**Residual risks.**
- The play-level guarantee rests on 5.5 using `boardCut`.
- `aria-busy` on a card during a pending discard has no test; the same `busy` path is tested for move in 5.3.
- `WRONG_STATE` ("Brettet er allerede låst.") on card operations can only be reached after 5.5's lock; it is untested, as for merge.
- The manual keyboard check A6 has not been run.
