---
title: 'Story 5.3: Move Answers to another Group or a new Group'
type: 'feature'
created: '2026-11-23'
baseline_revision: 'b79f1a5cf39c7e89e82cbd27833f0b81b18c3f7f'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-5-2-merge-groups.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The rename field's card-top failure Notice ("Endringen ble ikke lagret. Prøv igjen." or "Brettet er allerede låst.") and its stale-tab refresh have no UI test.
    evidence: |-
      Integration tests prove review.rename's NOT_FOUND, WRONG_STATE and INVALID_INPUT results, and the e2e now covers the empty-name message, Esc and an unchanged Enter, but no e2e aborts the rename POST or renames from a stale tab. Story 5.4 makes rename reachable from every card (menu and label click) and should cover these paths there.
    location: >-
      src/components/ReviewGroups.tsx (onRenameKey failure branches)
    severity: low
  - summary: >-
      tests/integration/db.test.ts "pglite://<dir> creates the directory recursively and migrates" sometimes times out at 5000 ms under the full parallel suite.
    evidence: |-
      Seen in 1 of about 20 full `npm run test` runs during this story (TestTimeoutError, 5000 ms); every other run, and every isolated run, passed. The test migrates a fresh on-disk PGlite database, and the migration chain grows with each story (0010 here). It is not caused by 5.3's logic. Raise that test's timeout or run the file without parallel load.
    location: >-
      tests/integration/db.test.ts (openDb, NFR-1)
    severity: medium
---

<intent-contract>

## Intent

**Problem:** After 5.2 the Host can only join whole Groups. When the Judge joined Answers that mean different things, the Host cannot pull them apart, so a wrong Answer inflates a Group's Count on the Board (FR-20).

**Approach:** One `review.moveAnswers` entry point moves selected Answers (one Question, non-discarded Groups) either into an existing non-discarded Group of that Question or into a new Group with `origin = host`. It runs in one transaction: lock, resolve, move, delete emptied sources, `edit_count`, counters and clearing the reviewed mark. On the screen, Answer chips get checkboxes, and the SelectionBar gets "Flytt til gruppe" (a native select plus "Flytt") and "Ny gruppe". "Ny gruppe" opens the new Group's inline rename field, so 5.3 also ships a minimal `review.rename` that saves what the Host types there.

## Boundaries & Constraints

**Always:**
- First invoke the `ponytail` skill (level `full`), then `impeccable` (its launcher is not installed, so take the "Launcher unavailable" path), and read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win on conflict. Use Operate mode, WCAG 2.1 AA, 44 px targets and literal bokmål.
- **Origin.** Add `host` to the `group_origin` pgEnum and generate the migration with `npm run db:generate`; never edit generated SQL by hand. A Group made by "Ny gruppe" is inserted with `origin = 'host'` and a `randomUUID()` id (AD-10), never `judge` (SM-5, epics decision 10). Amend `ARCHITECTURE-SPINE.md`: in AD-12 *Writing results*, add a sentence *Amended in Story 5.3:* that Review's "Ny gruppe" inserts `origin = host`; in AD-18, mark the Story 5.3 sentence as resolved with the `host` value.
- **Order inside `review.moveAnswers`'s one transaction** (AD-4, AD-5, AD-11, AD-15, AD-18), following `review.merge`:
  1. `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.editReview })`.
  2. Every ID must be a UUID, else `NOT_FOUND`.
  3. Resolve every `answerId` through `answer → answer_group → question` constrained to `gameId`. Every one must be found, its Group must not be discarded, and all must share one `question_id`.
  4. If `groupId` is given, it must be a non-discarded Group of that same Question. Any miss is `NOT_FOUND` before any write.
  5. `grouping.moveAnswers(tx, …)` inserts the new Group (if any) and moves the Answers not already in the target. Only after the move does it delete source Groups left with no Answers, because deleting an `answer_group` cascades to its Answers. It then adds `edit_count + 1` to the target and to every surviving source Group that lost Answers. A new Group therefore ends with `edit_count = 1`.
  6. `games.bumpCounters`: an existing target gets `{ answersMoved: moved }`; a new Group gets `{ groupsCreated: 1, answersMoved: moved }`.
  7. `questions.setReviewed(tx, questionId, false)`.
- If every selected Answer already sits in the target, `moved = 0`. Then nothing is written: no counters, and the reviewed mark is kept. The call still succeeds.
- **Input.** Both schemas live in `src/lib/review.ts`.
  - `moveAnswersSchema`: `{ gameId: string, answerIds: string[], groupId?: string }` with 1 to `INVITE_LINKS_MAX * ANSWERS_PER_QUESTION_MAX` distinct IDs, else `INVALID_INPUT`. A missing `groupId` means a new Group.
  - `renameGroupSchema`: `{ gameId, groupId, label }`, where `label` is trimmed and must be 1 to 40 characters. Messages: empty gives "Skriv et navn.", over 40 gives "Navnet kan ha maks 40 tegn.".
  - Malformed UUIDs are `NOT_FOUND` in the module, as in merge.
- **Result.** `moveAnswers` returns `{ groupId, label, count, position, moved, created }`, where:
  - `groupId` is the target or the new Group;
  - `label` is its effective label after the move. A new Group has the FR-16 default label: `custom_label` stays null;
  - `count` is distinct Contributor keys, computed in SQL;
  - `position` is its 1-based place among the non-discarded ranked Groups.

  A move does not freeze the target's label; only merge does (AD-11).
- **`review.rename`** has the same lock, resolution (non-discarded, owned Group) and transaction. `grouping.renameGroup` sets `custom_label` and adds `edit_count + 1`. Then `bumpCounters({ groupsRenamed: 1 })` and `setReviewed(false)`. It returns `{ groupId, label }`.
- **Actions.** Add `moveAnswers` and `renameGroup` to `src/app/spill/[id]/actions.ts` through `hostAction(…, "gjennomgang")`.
- **Chips (UX-DR11).** The DTO chip becomes `{ text, n, ids }`, where `ids` are the chip's Answer IDs (random v4 UUIDs, no order signal). `collapseChips` gathers them.
  - On Board and *Ikke på brettet* multi-chip cards, every chip is a checkbox `<label>` (44 px). Its accessible name is the chip text plus "· N svar" when n > 1. A selected chip has a visible selected look with no layout shift.
  - *Forkastet* chips and compact rows have no chip checkbox; a compact row keeps its single Group checkbox.
  - Ticking a chip clears any Group selection, and ticking a Group clears any chip selection.
- **SelectionBar with Answers (UX-DR12).** The bar's existing look, place and `focus-inverse` rule stay.
  - Left: "{N} svar valgt", where N is the total Answer count of the ticked chips.
  - Right: a visible `<label>` "Flytt til gruppe" with a native `<select>` of every non-discarded Group of the Question (Board then below, the ranked order, which sorts by Count) as "label (N)", then "Flytt", "Ny gruppe" and "Fjern valg". Controls use a surface fill and ink text.
  - Pending labels are "Flytter …" and "Lager gruppe …". While pending, the cards that own the selected chips are `aria-busy` and dimmed, and repeat clicks are ignored.
- **Success.** The selection clears.
  - After a move, focus goes to `#gruppe-{groupId}` and one polite live region says "{moved} svar flyttet til «{label}».".
  - After "Ny gruppe", the new Group's card shows its rename field with focus, prefilled with its label, and the live region says "Ny gruppe «{label}» laget. Skriv et nytt navn eller trykk Enter.".
- **Rename field (only opened after "Ny gruppe" in 5.3).** Reuse `TextField` with the visible label "Navn på gruppen", `maxLength` 40, `autocomplete="off"` and an always-visible counter "N/40".
  - Enter with an unchanged trimmed value closes the field without a request.
  - Enter with a changed value saves through `renameGroup`, then closes the field, focuses the heading and announces "Navnet er endret.".
  - Esc cancels and focuses the heading; it must not reach the selection's Esc handler.
  - `INVALID_INPUT` shows `fieldErrors.label` under the field. Any other failure shows "Endringen ble ikke lagret. Prøv igjen." in a danger Notice at the top of that card and keeps the field open.
- **Failures in the SelectionBar** follow 5.2 exactly:
  - `NOT_FOUND` → `router.refresh()`, clear the selection, focus `#pa-brettet`;
  - `WRONG_STATE` → "Brettet er allerede låst." with the link "Gå til spillet";
  - anything else, a rejected request included → "Endringen ble ikke lagret. Prøv igjen.", with Groups and selection unchanged.

  The same `NOT_FOUND` and `WRONG_STATE` handling applies to the rename field.
- **Clearing.** "Fjern valg" or Esc clears the selection; a Question change clears it (`key={current.position}`).
- **Tests.** Put FR IDs in test titles; add rows to `tests/TRACE.md`; run offline, with no key and no real names. Do not commit: the orchestrator commits.

**Never:**
- No drag and drop, no confirmation dialog, no optimistic update, no client data library, no new Route Handler.
- No `contributor_key` or `rank` in any result, prop, DTO or log, and no Answer text in logs.
- No group menu, no label-click rename and no discard or restore (5.4); no marking reviewed or locking (5.5).
- Do not touch `.env`, `.logs/` or `prompting/`; never run `judge:smoke` or `judge:record`; never write absolute machine paths into tracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Move to existing | chips from A and B to C | Answers under C, Counts = distinct keys, `answers_moved + n`, C and surviving B `edit_count + 1`, reviewed cleared | — |
| Source emptied | all of B's Answers moved to C | B deleted, its Answers kept under C, the Question's Answer total unchanged | — |
| New Group | some of A's Answers, no `groupId` | new Group `origin = host`, `custom_label` null, FR-16 default label, `edit_count` 1, `groups_created + 1`, `answers_moved + n`, `judge_groups_proposed` unchanged | — |
| Already there | all selected Answers already in target | nothing written, `moved = 0` | — |
| Rename | `label` "  Ny  " / 40 chars | saved trimmed, `groups_renamed + 1`, `edit_count + 1`, reviewed cleared | — |
| Rename invalid | "" or 41 chars | nothing changes | `INVALID_INPUT` + field message |
| Two Questions | Answers from Q1 and Q2, or target in Q2 | nothing changes | `NOT_FOUND` |
| Discarded | target discarded, or an Answer in a discarded Group | nothing changes | `NOT_FOUND` |
| Foreign / random / malformed | Host B's IDs, random UUID, `abc` (Game, Answer or Group) | nothing changes | `NOT_FOUND` |
| Empty / duplicate | `[]`, `[a, a]` | nothing changes | `INVALID_INPUT` |
| Wrong state | Game *ready* | nothing changes | `WRONG_STATE` |
| Failing write | `bumpCounters` throws after the move | everything rolled back, no new Group | `INTERNAL` |

</intent-contract>

## Code Map

- `src/server/db/schema.ts:109` -- `groupOrigin` pgEnum; add `"host"`. `answerGroup` is at :127. Migrations are in `drizzle/` (latest `0009_*`), generated with `npm run db:generate`.
- `src/server/grouping/index.ts:45` -- `mergeGroups` is the writer pattern; add `moveAnswers` and `renameGroup` beside it. `randomUUID` is already imported (used at :131).
- `src/server/review/index.ts` -- `rankedGroups(db|tx, questionId)`, `groupsOf` (the answers query must also select `answer.id` for chip `ids`), and `merge` with its `UUID` regex and resolution pattern to copy; add `moveAnswers` and `rename`. `ReviewGroup.chips` gains `ids`.
- `src/lib/review.ts` -- `mergeGroupsSchema` pattern; `collapseChips` gains `id` input and `ids` output.
- `src/server/games/index.ts:227` -- `bumpCounters(tx, gameId, Partial<Counters>)` (`answersMoved`, `groupsCreated`, `groupsRenamed` exist). `src/server/questions/index.ts:61` -- `setReviewed`.
- `src/app/spill/[id]/actions.ts` -- `hostAction(op, input, "gjennomgang")`, as for `mergeGroups`.
- `src/components/ReviewGroups.tsx` -- the selection state, the Esc listener, `clear()`, `merge()` with its result handling, the SelectionBar and the live region. Generalise them to the two selection kinds and to one announcement or focus target.
- `src/components/GroupCard.tsx` -- chips (non-discarded branch) become checkboxes when given chip handlers; the header renders the rename field instead of the `<h4>` while renaming; add a slot for a card-top Notice.
- `src/components/TextField.tsx` -- reuse it for the rename field. `src/components/Button.tsx` has the `inverse` variant; `Notice` has tone `danger`; `focusHeading` is in `RouteFocus.tsx`.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- AD-12 *Writing results* (around line 230), AD-18 (around line 358).
- `tests/integration/review.test.ts` -- `reviewGame(spec, judge)` at :92, `mock(...)`, `render()` at :136 and `groupIdOf()` at :152; `describe("review.merge")` is the pattern for a new `describe("review.moveAnswers")` and `describe("review.rename")`.
- `tests/integration/authz.test.ts` -- the foreign-Host merge case is the pattern.
- `tests/integration/report.test.ts` -- the report lists Group `origin`s; check it still passes, and add `host` coverage there if it fixes the origin set.
- `tests/unit/review.test.ts` -- tests for `collapseChips` and `mergeGroupsSchema`.
- `tests/e2e/review.spec.ts` -- `collectingGame`, `submitSets`, `closeAndOpenReview`, and the merge test at :264 as the pattern; `tests/e2e/fixtures.ts` (`seriousViolations`, `FOCUS_RING`).
- `tests/manual/checklist.md` -- T1 (merge timing) is the pattern for T2.
- `.docs/implementation-artifacts/sprint-status.yaml` -- `5-3-move-answers-to-another-group-or-a-new-group`.

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts` and the generated `drizzle/0010_*` -- the `host` origin.
- `src/lib/review.ts` -- `moveAnswersSchema`, `renameGroupSchema`, and `ids` in `collapseChips`.
- `src/server/grouping/index.ts` -- the `moveAnswers` and `renameGroup` writers.
- `src/server/review/index.ts` -- chip `ids`, the `moveAnswers` and `rename` entry points, and their result types.
- `src/app/spill/[id]/actions.ts` -- the `moveAnswers` and `renameGroup` actions.
- `src/components/GroupCard.tsx`, `src/components/ReviewGroups.tsx` -- chip selection, the SelectionBar for Answers, the rename field, focus and announcements.
- `ARCHITECTURE-SPINE.md` -- the AD-12 and AD-18 amendments.
- `tests/integration/review.test.ts` -- every row of the matrix (counts read through `review.load`, counters through `games.counters`, `origin` and `edit_count` read from `answer_group`), checking that nothing changed in each refusal. Also: a page render shows chip checkboxes on Board and below-the-line multi-chip cards, and none under *Forkastet*.
- `tests/integration/authz.test.ts` -- Host B's `review.moveAnswers` and `review.rename` on A's IDs → `NOT_FOUND`, with A unchanged.
- `tests/unit/review.test.ts` -- schema bounds, and `collapseChips` `ids`.
- `tests/e2e/review.spec.ts` -- AC4 on a Game with two Questions:
  - tick a Group, then a chip: the Group is unticked and the bar shows "N svar valgt";
  - the select options in ranked order as "label (N)";
  - "Flytt": focus on the target heading and the announcement;
  - "Ny gruppe": the rename field has focus and the announcement plays; Enter keeps the label. Then a second split is renamed by typing, and "Navnet er endret." is announced;
  - an aborted request shows the message in the bar, and the selection stays;
  - Esc clears; a Question change clears;
  - the white focus ring is on the select;
  - axe is clean with the Answer bar open and with the rename field open.
- `tests/manual/checklist.md` -- T2: the move timing (NFR-5) on the sizing Game.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- FR-20, FR-16 and NFR-6 rows; set 5-3 to done.

**Acceptance Criteria:** the four ACs of Story 5.3 in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract; the matrix adds the edge cases.
- Given a split made with "Ny gruppe", when the usage report is read, then the new Group has `origin` `host` and `judgeGroupsProposed` is unchanged.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 31 findings — high 0, medium 9, low 14, false 8, maybe-false 0
- findings:
  - `[low]` `[reject]` Intent: compact rows get no chip checkbox, so on a no-key fallback Question move and "Ny gruppe" need a multi-chip card first — the Host can still do everything: moving a singleton into a Group gives the same partition as merging the two, and splitting a one-chip Group changes nothing. EXPERIENCE's SelectionBar contract (one Group gives the merge hint) wins over the compact-row aside, as recorded in Design Notes.
  - `[false]` `[reject]` Intent: rename is broader than the field 5.3 opens — deliberate and recorded in Design Notes: AC4's field must save what the Host types (epics decision 8). 5.4 reuses it.
  - `[false]` `[reject]` Intent: the reviewed mark is kept when nothing moves — AC1 clears it "when the Host moves them", and nothing moved. The UI no longer sends such a move (see the medium patch below).
  - `[low]` `[reject]` Intent: no e2e covers stale-tab NOT_FOUND or WRONG_STATE for move — move and merge share `run()`, whose NOT_FOUND branch the 5.2 two-tab e2e exercises. WRONG_STATE needs 5.5's lock and is already deferred in the 5.2 spec.
  - `[false]` `[reject]` Intent: the spec is in-review, its logs are empty, and sprint-status already says done — the review was still running; Finalize sets both before the second commit.
  - `[medium]` `[patch]` Intent: no UI test covers `aria-busy` during a move or the rename failure Notice — grouped with the pending-state row below. The rename Notice is deferred to 5.4.
  - `[false]` `[reject]` Intent: the intent cites epics "decision 9", but the rule is decision 10 — a typo in the prompt; the spec and code follow decision 10.
  - `[medium]` `[patch]` Gap: no test covers a partial move, where some Answers are already in the target — patched with an integration case: kari (already in A) and per (2 from B) into A, asserting `moved` 2, `answersMoved` 2, and `edit_count` 1 on A and on B.
  - `[medium]` `[patch]` Gap: pending labels and `aria-busy` for move are untested — patched: the e2e holds the move POST, asserts `aria-busy="true"` only on the card that owns the ticked chip and "Flytter …" on the button, then releases it.
  - `[low]` `[patch]` Gap: the Answer count and un-ticking were only tested with single-Answer chips — patched: the e2e ticks "Kari · 3 svar", asserts "3 svar valgt", un-ticks it and asserts the bar is gone.
  - `[medium]` `[patch]` Gap: the rename field's error and cancel paths are untested — patched in the e2e: Enter on an empty field shows "Skriv et navn." (as the field's accessible description) and keeps it open; Esc closes it with focus on the heading. The card-top failure Notice is deferred to 5.4.
  - `[medium]` `[patch]` Gap (other): "0 svar flyttet" — grouped with the default-target row below.
  - `[medium]` `[patch]` Blind: the select defaults to the Group that already holds the ticked Answers, so "Flytt" moves nothing and announces "0 svar flyttet" — patched: `options` leaves out every Group that holds all ticked Answers, and the select and "Flytt" are hidden when none is left. The server's moved = 0 path stays.
  - `[false]` `[reject]` Blind: with no target, "Flytt" silently makes a new Group — `options` was empty only for a Question with no non-discarded Group, where no chip can be ticked. After the patch, the empty case hides "Flytt".
  - `[false]` `[reject]` Blind: chip selection keyed on `ids[0]` goes stale after a refresh — every path that refreshes the list (success, NOT_FOUND) clears the selection first, and nothing else re-renders the props.
  - `[low]` `[patch]` Blind: rename state outlives the Group it belongs to when another operation runs — patched: `run()` cancels any open rename before the request.
  - `[low]` `[reject]` Blind: the field stays open on blur — no text is lost, because it stays in the open field. EXPERIENCE defines only Enter (save) and Esc (cancel), and closing on blur would invent a save rule.
  - `[medium]` `[patch]` Blind: the e2e misses Esc, INVALID_INPUT and the failure Notice of the rename field — grouped with the rename gap row; same patch and deferral.
  - `[low]` `[patch]` Blind: "Enter with an unchanged value sends no request" is unchecked — patched: the e2e counts action POSTs around that Enter.
  - `[medium]` `[patch]` Blind: the pending states of a move are untested — grouped with the pending-state row; same patch.
  - `[false]` `[reject]` Blind: sprint-status says done while the spec says in-review — same as the intent row: Finalize sets both.
  - `[low]` `[patch]` Blind: the spine's module table lists `createGroup`, `setCustomLabel` and `deleteIfEmpty`, and AD-18 does not record the units — patched: the writer is renamed `setCustomLabel`; the table is amended (no `createGroup` or `deleteIfEmpty`, because `moveAnswers` creates the `host` Group and deletes emptied sources); AD-18 records the `answers_moved` unit and the `edit_count` rule.
  - `[false]` `[reject]` Blind: the migration snapshot is missing from the reviewed diff — the review diff left out the generated `drizzle/meta/0010_snapshot.json` on purpose (760 lines of generated JSON); it is committed in the implementation commit.
  - `[low]` `[reject]` Blind: `ADD VALUE 'host'` cannot be reverted — the repo's migrations are forward-only and none has a down step. Reverting would be a new migration, as for every earlier one.
  - `[low]` `[reject]` Blind: the chip height assertion `toBe(44)` is brittle — the same exact pin is house style for the compact row (5.2), and the fixture's chip text is fixed and short. A change to the 44 px target should fail.
  - `[medium]` `[patch]` Edge: a no-op move announces "0 svar flyttet" and clears the selection — grouped with the default-target row; same patch.
  - `[low]` `[patch]` Edge: Esc while a rename is pending drops a later failure — patched: Esc is swallowed, and the field stays open while a save is pending.
  - `[low]` `[patch]` Edge: "Ny gruppe" while another rename field holds typed text drops it silently — grouped with the rename-state row. `run()` now cancels the open rename explicitly, as Esc does.
  - `[low]` `[patch]` Edge: a merge or move while the field is open leaves a stale prefill — grouped with the rename-state row; same patch.
  - `[low]` `[patch]` Edge: focus is lost when Answers move into the Group whose field is open (no `<h4>`) — grouped with the rename-state row: the field is closed before the request, so the heading renders.
  - `[low]` `[reject]` Edge (claim): a no-op move still touches `game.updated_at` — `lockForMutation` touches it for every Host call by design (AD-4), and the UI no longer sends no-op moves.

## Design Notes

- **Why rename arrives here.** AC4 says "Ny gruppe" opens the new Group's rename field, and a field that ignores what the Host types would be a dead control (epics decision 8). So 5.3 ships `review.rename` and the inline field, reachable only after "Ny gruppe". Story 5.4 adds the menu, the label-click entry, discard and restore, and reuses both.
- **`edit_count`.** As in merge, each surviving Group the edit touched gets +1: the target, and every source that lost Answers but still has some. Deleted sources have no row left. A new Group starts at 0 and gets +1 as the target, so it ends at 1; SM-5 ignores it anyway, since its origin is `host`.
- **Counters.** `answers_moved` counts Answers, and a split moves Answers too, so "Ny gruppe" bumps it as well as `groups_created`. Recorded here because AD-18 does not fix the unit.
- **Compact rows.** EXPERIENCE says that "Flytt" or "Ny gruppe" on a compact row equals selecting the Group. The SelectionBar contract is that one Group gives the merge hint and Answers give the move controls. So a compact row stays a Group checkbox, and a singleton moves by merging.
- **A move does not freeze the target's label.** AD-11 freezes the label only on merge, so the announcement names the label after the move, which is the one the focused heading shows.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, with axe clean on Review with the Answer bar open and with the rename field open.

## Auto Run Result

Status: done

**Summary.** The Host can tick Answer chips on the Review screen and move them to another Group, or split them into a new one.
- `review.moveAnswers` locks the Game in *in review* and resolves every Answer and the target inside the owned Game, one Question and non-discarded Groups (`NOT_FOUND` otherwise, before any write).
- In one transaction it inserts the new Group with `origin = host` (a new `group_origin` value, migration 0010), moves the Answers, deletes the emptied sources after the move, adds `edit_count + 1` to the target and the surviving sources, bumps `answers_moved` (and `groups_created` for a split) and clears the reviewed mark.
- The SelectionBar shows "N svar valgt", a native "Flytt til gruppe" select in ranked order as "label (N)" (without Groups that already hold every ticked Answer), "Flytt", "Ny gruppe" and "Fjern valg".
- "Ny gruppe" opens the new Group's rename field with focus, backed by a minimal `review.rename` (1–40 characters, `groups_renamed`), which Story 5.4 reuses.
- Every change is saved on the server before the screen updates, and is announced with the literal UX strings.

**Files changed.**
- `src/server/db/schema.ts`, `drizzle/0010_loving_black_cat.sql`, `drizzle/meta/*` -- the `host` origin.
- `src/server/grouping/index.ts` -- the `moveAnswers` and `setCustomLabel` writers.
- `src/server/review/index.ts` -- chip `ids`, `moveAnswers`, `rename`, `placeOf`, `ownedGroup`.
- `src/lib/review.ts` -- `moveAnswersSchema`, `renameGroupSchema`, chip `ids` in `collapseChips`.
- `src/app/spill/[id]/actions.ts` -- the `moveAnswers` and `renameGroup` actions.
- `src/components/GroupCard.tsx` -- chip checkboxes, a rename slot and a card-top notice slot.
- `src/components/ReviewGroups.tsx` -- Answer selection, the move controls in the SelectionBar, the rename field, a shared `run()`.
- `ARCHITECTURE-SPINE.md` -- amended AD-12 (`origin = host`), AD-18 (counter units, `edit_count`) and the module table.
- `tests/integration/review.test.ts`, `tests/integration/authz.test.ts`, `tests/integration/report.test.ts`, `tests/unit/review.test.ts`, `tests/e2e/review.spec.ts` -- coverage.
- `tests/TRACE.md`, `tests/manual/checklist.md` -- the FR-16, FR-20, NFR-5 and NFR-6 rows; T2.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 5-3 done.

**Review findings.** One pass with 31 findings (0 high, 9 medium, 14 low, 8 false).
- 4 medium entries were patched: a no-op default move target, untested pending state, an untested partial move, untested rename error and cancel paths.
- 4 low entries were patched: an open rename surviving other operations, Esc during a pending rename, the multi-Answer chip count, the spine's writer names and units, plus the unchanged-Enter request check.
- 2 items were deferred: the rename failure Notice UI test (to 5.4), and a pre-existing flaky `db.test.ts` timeout.
- The rest were rejected with reasons in the triage log.

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (implementation output).**
  - The first implementation let "Flytt" default to the Group that already held the ticked Answers, which gave "0 svar flyttet".
  - It kept an open rename field across other operations, closed the field on Esc while a save was pending, named the writer `renameGroup` against the spine's `setCustomLabel`, and left the spine's module table stale.
  - All of these were patched after review.
- **Rejected (reviewer suggestions).**
  - Chip checkboxes on compact rows (merge gives the same partition; the SelectionBar contract wins).
  - Closing the rename field on blur (it would invent a save rule).
  - Unpinning the 44 px height assertion (house style).
  - A down migration for the enum value (migrations are forward-only).
  - Treating a no-op `updated_at` touch as a write (AD-4 by design).
  - Guards for unreachable states (a chip's IDs changing without a refresh, "Flytt" with no target before the patch).
- **Corrected in planning.**
  - The prompt cited epics "decision 9"; the rule is decision 10.
  - The prompt asked to refresh on `WRONG_QUESTION`, which exists only in Play (AD-16); Review's cross-Question misses are `NOT_FOUND` (AD-5).
  - AC4's rename field cannot be a dead control, so a minimal rename was pulled forward from 5.4 instead of deferring the AC.
- **Corrected in orchestration.** The implementation subagent ran in the background although the workflow asks for blocking subagents. Its result was awaited before verification, so nothing was skipped.

**Follow-up review recommendation:** true. This first pass patched four `medium` entries. The specific unverified risk: the post-review UI changes (filtering the move target, cancelling a rename in `run()`, the Esc guard while a save is pending) were checked only by the targeted e2e and by this triage, not by a fresh independent review. The rename failure Notice has no UI test until 5.4.

**Verification.** `npm run lint` (clean), `npm run typecheck` (clean), `prettier --check .` (clean), `npm run test` 648/648 (one run in about 20 hit the deferred `db.test.ts` timeout), `npm run test:e2e` 89/89, including axe on Review with the Answer bar open and with the rename field open. Offline, no key, no live Judge call.

**Residual risks.**
- NFR-5 timing (T2) and the keyboard check A6 are manual checklist items not yet run.
- The `db.test.ts` timeout is intermittent.
- A no-key fallback Question shows only compact rows, so splitting there starts with a merge (by design, recorded in Design Notes).

