# Epic 5 code review (bmad-code-review)

- **Date:** 2026-11-23
- **Scope:** `git diff origin/main...epic-5-gjennomgang`, which covers stories 5.1 (Review screen with ranked Groups, Counts and raw Answers), 5.2 (merge), 5.3 (move Answers to another or a new Group), 5.4 (rename, discard and restore), 5.5 (mark Questions reviewed and lock the Board) and 5.6 (teacher feedback handoff), plus the e2e fix in `475b5a7` and the global Vitest timeouts in `87ef237`.
  - 67 files changed, +9,998/-115.
  - The reviewers read the diff without `drizzle/meta/*` snapshots and without `.docs/`, `wiki/` and `prompting/`: 6,905 lines, 292 kB.
- **Mode:** `full`. The diff was checked against:
  - `spec-5-1` to `spec-5-6`, including their triage logs and `deferred` lists (rejected items were not raised again without a new argument);
  - `epic-5-context.md` and Epic 5 in `epics.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-4, AD-10 to AD-15 and AD-18 as amended;
  - the PRD on `main` (amended 2026-11-23): FR-11 to FR-13, FR-19 to FR-21, NFR-5 and NFR-6;
  - `DESIGN.md` and `EXPERIENCE.md` (Review anatomy, Responsive, Accessibility Floor, manual checklist).
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:** the Review state machine and its transactions, owner and state checks on every action, anonymity at Board confirmation, concurrency and stale tabs, the 5.4 Esc change, Review accessibility and test gaps. Two items flagged by earlier specs were read specifically: the `LockBoard` stale-tab code added in the 5.5 review, and 5.6's new TRACE lines.
- **Triage:** every claim was checked at the cited lines, and past the diff where needed: `games.lockForMutation`, `game-state.ts`, `ConfirmDialog.tsx`, `GroupCard.tsx`, the e2e stale-tab steps, `tests/manual/checklist.md` and the Accessibility Floor and Responsive tables in `EXPERIENCE.md`.
- **Test run:** `npm run test` passed 41 files and 675 tests in 10.1 s. `test:e2e` was not run.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story files was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 1 | patch |
| Low | 7 | patch |
| Deferred | 0 | |
| Dismissed | 14 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **Owner and state checks on every action.** All seven mutations (`merge`, `moveAnswers`, `rename`, `discard`, `restore`, `setReviewed`, `confirmBoard`) open a transaction and start with `games.lockForMutation(tx, { hostId, gameId, states })`. That is a `SELECT … FOR UPDATE` on `game.id` and `game.host_id`, so a foreign Game is `NOT_FOUND` and any state other than *in review* is `WRONG_STATE`. The six edits use `PERMITTED.editReview` and `confirmBoard` uses `PERMITTED.confirmBoard`, and both are `["in_review"]`. `review.load` uses `games.getOwned` plus its own *in review* check, and the page maps the two codes to `notFound()` and a redirect.
- **Every child ID is resolved inside the owned Game, under the lock, before any write.** Merge and move join `answer_group` (and `answer`) to `question.game_id`, require every ID to be found, require one Question, and refuse discarded Groups. `ownedGroup` does the same for rename, discard, restore and a move's target. `setReviewed` finds the Question in the owned Game's own list, so no foreign or malformed ID ever reaches a query. `authz.test.ts` has a Host B `NOT_FOUND` case for every operation and action, and an after-lock test runs every operation on a Game that was really locked.
- **The transactions.**
  - Merge moves Answers before it deletes the sources, because the delete cascades to Answers. It freezes the effective label of the highest-ranked Group (FR-20), and counts `sources.length` merges.
  - Move deletes only the sources it emptied (`NOT EXISTS`), writes nothing when `moved` is 0, and gives a new Group `origin = host`.
  - Every edit clears the Question's mark in the same transaction (FR-20).
  - Marking needs a non-discarded Group. Every Group has at least one Answer, because merge deletes its sources and move deletes the Groups it empties.
- **`confirmBoard` and anonymity (FR-13, FR-21).** Under the lock it refuses an unreviewed Question (`QUESTIONS_UNREVIEWED`). It writes `board_slot` from `boardCut(rankGroups())` with Counts read before `clearContributorData` sets every `contributor_key` and `rank` of the Game to NULL, then it moves the Game to *ready*, all in one transaction. The clear is scoped to the Game's Questions, and a second in-review Game keeps its keys in the test. `anonymity.test.ts` "after confirm" checks 45 Answers with 0 keys and 0 ranks, and that `board_slot` has no key, rank, time or text column. No slot carries a discarded Group's ID or label, which closes the 5.4 deferral. The dead-tuple question stays deferred from 5.5 as an architecture decision.
- **The `LockBoard` stale-tab paths work.** `QUESTIONS_UNREVIEWED` and `NOT_FOUND` refresh, and `WRONG_STATE` shows "Brettet er allerede låst." with "Gå til spillet". The e2e covers a second tab un-reviewing Q1 (the dialog gives way to the focused, disabled trigger with "(1 igjen)") and a second tab's open dialog after the lock. With two `LockBoard` instances (rail and foot), only the visible one can take focus, because `focus()` on a `display: none` button is a no-op. The one side effect, focus taken where it should not be, is finding 2.
- **The 5.4 Esc change is correct for the menu and the rename field.** In the App Router, React's root listener is on `document` and is registered at hydration, before the selection's `keydown` listener (added in an effect). Because of that, `preventDefault` in `GroupMenu` and `onRenameKey` is visible as `defaultPrevented` when the selection listener runs. The one path that slips through is the native lock dialog, which is finding 3.
- **5.6's TRACE lines.** Every cited test exists and asserts what TRACE says: the `messages()` injection case, the obeyed-injection close followed by a "Ny gruppe" move, the column scan after delete, the lint-zone cases for `@/server/judge/record`, the `ungrouped()` checks, the FR-17 reason loop, and the openrouter retry tests that stop at 2 calls. The test title in finding 8 claims slightly more than its body does, but TRACE does not.

## Findings

### Medium

#### 1. NFR-5 has no check for rename, discard, restore, mark or lock, and TRACE still lists 5.4 and 5.5 as pending

- **Location:** `tests/TRACE.md:401-407`, `tests/manual/checklist.md:13-20`.
- **Source:** Verification Gap (other finding) and Blind Hunter.
- **What happens:**
  - NFR-5 requires every Host action in Review to show its result within one second.
  - Only T1 (merge) and T2 (move and "Ny gruppe") exist, and TRACE still says "Pending: Stories 5.4, 5.5 and Epic 6".
  - Both stories have shipped. Rename, discard, restore, mark and "Lås brettet" have no timing check, manual or automated.
- **Why it matters:**
  - `confirmBoard` is the heaviest Review transaction. On the sizing Game it runs two aggregate queries and one insert per Question (15 Questions), then one UPDATE over every Answer of the Game, all while holding the Game's row lock.
  - It is the one Review action whose timing nobody has measured.
  - The examiner reads TRACE, and a "Pending" line for shipped stories reads as unfinished.
- **Fix:**
  - Add three rows under *Timing (NFR-5)*, in the same form as T1 and T2:
    - T3: rename (Enter to the closed field with the new label), discard, and "Angre forkasting";
    - T4: "Marker som gjennomgått" to the next Question with focus on its heading;
    - T5: "Lås brettet" in the dialog to the Game page on the sizing Game.
  - Replace the TRACE line with the T3 to T5 rows and "Pending: Epic 6".

### Low

#### 2. `LockBoard`'s focus fix takes focus after every edit or mark that changes `ready`, not only after its own refused confirm

- **Location:** `src/components/LockBoard.tsx:28-37`.
- **Source:** Acceptance Auditor, confirmed independently in triage.
- **What happens:**
  - The effect runs on any change of `ready` in either direction. It focuses the lock button whenever `document.activeElement` is `<body>`.
  - At 1024 px and wider, the rail's `LockBoard` comes before the main pane in the tree, so its passive effect runs before those of `ReviewGroups` and `MarkReviewed`.
  - Two everyday cases trigger it:
    - Marking the last Question removes the clicked mark button, so focus falls to `<body>`.
    - Any merge, move, rename, discard or restore on a fully reviewed Game removes the SelectionBar, menu or field that had focus.
  - In both cases focus goes first to "Lås brettet", then on to the heading the operation intended.
- **Harm:**
  - The final focus is right, which the e2e at "Spørsmål 2 er gjennomgått …" confirms.
  - But a screen reader can announce "Lås brettet" (with "Gjennomgå alle spørsmålene først (1 igjen)" after an edit) before the real target, every time.
  - The 5.5 spec asks for this focus move only when a refresh swaps the dialog for the disabled button.
- **Fix:** set a ref in `lock()` when the result is `QUESTIONS_UNREVIEWED`. In the effect, focus only when that ref is set, then clear it.

#### 3. Esc in the "Låse brettet?" dialog also clears the Host's selection

- **Location:** `src/components/ReviewGroups.tsx:145-156`, `src/components/ConfirmDialog.tsx:52-54`.
- **Source:** Acceptance Auditor (verified).
- **What happens:**
  - The selection listener on `document` clears on any Escape `keydown` that is not `defaultPrevented`.
  - The native `<dialog>` closes on Esc through its `cancel` event and never prevents the `keydown`. `onCancel` prevents only the `cancel` event, and only while busy.
  - So with every Question reviewed and a Group ticked, Esc in the lock dialog closes the dialog and also drops the selection.
  - While the lock is pending, Esc cannot close the dialog, but it still clears the selection, because `clear()` checks only `ReviewGroups`' own `pending`.
- **Harm:** this is the "second Esc path" that 5.4 and 5.5 ruled out. It is minor, because the selection is lost but nothing is saved wrongly.
- **Fix:**
  - In `onKey`, also skip events whose target is inside a dialog: `(event.target as Element | null)?.closest?.("dialog")`.
  - Add one e2e step: tick a Group, open the lock dialog, press Esc, and expect the SelectionBar to stay.

#### 4. An uppercase UUID crashes into `INTERNAL` instead of `NOT_FOUND` or success

- **Location:** `src/server/review/index.ts:138` (the `UUID` regex has the `i` flag), and the in-memory comparisons at `:181-183`, `:205-211` and `:354-356`.
- **Source:** Edge Case Hunter (verified).
- **What happens:**
  - An uppercase Group ID passes the regex, and Postgres compares `uuid` values case-insensitively, so the guard queries find the row.
  - The JavaScript comparisons then fail, because `includes` and `===` compare against the lowercase IDs that Postgres returns:
    - in merge, `target` is `undefined`;
    - in `placeOf`, `kept[-1]` is `undefined`;
    - in `flipDiscarded`, `find()!` is `undefined`.
  - The resulting `TypeError` rolls the transaction back and surfaces as `INTERNAL`, with an `INTERNAL` log line.
- **Harm:** only a crafted request can do this, because the UI sends server-issued lowercase IDs. But AD-5 expects such a request to be `NOT_FOUND`, not a server error.
- **Fix:** drop the `i` flag, so that uppercase IDs are `NOT_FOUND` before any query.

#### 5. `defaultLabel` can cut a surrogate pair in half

- **Location:** `src/lib/ranking.ts:26-29`.
- **Source:** Blind Hunter and Edge Case Hunter.
- **What happens:**
  - A normalised Answer longer than 40 code units, with no space in its first 41 code units, is cut with `text.slice(0, LABEL_MAX)`.
  - If an emoji straddles position 40, the label ends in a lone high surrogate.
  - Merge freezes that label into `custom_label`, and `confirmBoard` freezes it into `board_slot.label`, so the TV would show U+FFFD.
- **Fix:** a one-line correction, `text.slice(0, LABEL_MAX).replace(/[\uD800-\uDBFF]$/, "")`, which keeps the 40-code-unit rule that the rename schema and the counter use. Add one unit case.

#### 6. The "Ikke på brettet" list restarts its numbering at 1

- **Location:** `src/components/ReviewGroups.tsx:410-411`.
- **Source:** Blind Hunter.
- **What happens:** the `<ol>` below the line starts at 1, while each card shows its rank from `BOARD_SIZE + 1` ("9."). Assistive technology that reports list position therefore tells the Host "1" for the card labelled "9.".
- **Fix:** add `start={BOARD_SIZE + 1}` to that `<ol>`.

#### 7. The Group menu trigger silently ignores clicks while an operation is pending

- **Location:** `src/components/GroupMenu.tsx:74`.
- **Source:** Blind Hunter.
- **What happens:**
  - `onClick={() => !busy && …}` drops the click without `aria-disabled`.
  - During any pending operation (up to about a second, NFR-5), a keyboard or screen-reader user who presses "Mer for «…»" on another card gets no response and no state.
  - The other Review controls use the `aria-disabled` pattern.
- **Fix:** add `aria-disabled={busy || undefined}` to the trigger.

#### 8. The 5.6 delete-scan test title says "after create", but nothing goes through create

- **Location:** `tests/integration/delete.test.ts:278`.
- **Source:** Acceptance Auditor.
- **What happens:** the Game comes from `insertGame("draft")` and the Question from a direct insert, not from `games.create` or `questions.save`. The title claims more than the test proves. The TRACE line was worded to avoid exactly that, and the deletion guarantee itself is not weakened.
- **Fix:** rename the test to "after a Question, submit, close, Grouping, rename and delete, …".

## Dismissed

1. **The Host cannot unmark a Question in the UI** (Blind Hunter). Already rejected in the 5.5 log, and EXPERIENCE gives a reviewed Question only "✓ Gjennomgått" and "Neste spørsmål". The new argument, that a dummy edit skews SM-5, does not hold: the mark does not block any edit, so a Host never needs to unmark in order to change something.
2. **The rename field has no pointer or touch way out** (Blind Hunter). It matches the contract, which says "Enter saves, Esc cancels" (EXPERIENCE, Rename). Touch keyboards have Enter, an unchanged Enter closes the field, and any other operation or rename cancels it.
3. **`review.load` reads without a snapshot** (Blind Hunter). Low. A torn render needs the same Host to edit from another tab within the milliseconds between three reads, and the next refresh heals it. The fix adds a transaction with an isolation level.
4. **The narrow-screen Notice uses `md` instead of `lg`** (Blind Hunter). False. EXPERIENCE, Responsive, says the select appears below 1024 px and the Notice below 768 px, and spec 5.1 says the same.
5. **The lock dialog does not preview the frozen labels and Counts** (Blind Hunter). Not in the contract: the dialog copy is fixed by spec 5.5 and EXPERIENCE. A preview is a new feature, and the labels are FR-16 defaults that the Host has just reviewed.
6. **`board_slot` has no CHECK on `count` or the label length** (Blind Hunter). Already rejected in the 5.5 log: there is one writer, and its values are proven non-empty.
7. **Labels can repeat within a Question** (Blind Hunter). No requirement asks for distinct labels, and a warning would be a new feature.
8. **There is no screen-reader row for Review in the manual checklist** (Blind Hunter). The checklist copies the Accessibility Floor table in EXPERIENCE, which has no such row. A6 and A10 are the contract's Review rows. The NFR-5 half of this finding is finding 1.
9. **The *ready* Game page is a dead end and runs an extra query** (Blind Hunter). "Start spillet" belongs to Epic 6, as spec 5.5 records. The second `requireHost` and `questions.list` are deduplicated per request, and the cost is negligible.
10. **`LockBoard` shows the retry sentence for `NO_GROUPS_ON_BOARD`** (Edge Case Hunter). False, because the case cannot happen. Every edit clears the mark, marking needs a non-discarded Group, and no Group exists without Answers, so `confirmBoard` cannot reach that refusal.
11. **The mark check and `confirmBoard` count Groups differently** (Edge Case Hunter). False for the same reason: a Group without Answers cannot be reached. The 5.5 log already rejected a guard for it.
12. **A move with `moved === 0` announces "0 svar flyttet"** (Edge Case Hunter). Low. It is reachable only from a stale tab after another tab made the same move. The sentence is true, the list refreshes through `revalidatePath`, and the fix adds a branch.
13. **Compact rows have no chip checkbox** (Edge Case Hunter). Already rejected in the 5.3 log, with a Design Note: a singleton moves by merging, which gives the same partition.
14. **TRACE's "never more than 2 calls" is asserted only through `calls: 2`** (Acceptance Auditor). False. In `tests/unit/judge.test.ts`, `stubFetch` returns `undefined` to a third request, so the provider would fail or report `calls: 3`, and either outcome fails the test. The bound is enforced.

## Verdict

**Approve with patches.** No high findings. The Review state machine, the owner and state checks, the transactions and the FR-13 clear at Board confirmation are correct and well tested. The stale-tab `LockBoard` code from the 5.5 review does what spec 5.5 asks, but its focus effect fires too broadly (finding 2). The 5.4 Esc change holds for the menu and the rename field, but not for the native lock dialog (finding 3). The one medium finding is missing evidence (NFR-5 timing for five Review actions and a stale TRACE line), not a code defect. Findings 2 to 8 are small, direct corrections. None of them blocks the PR, but findings 1 to 3 should be fixed before it.

## Epic 5 review fixes (2026-11-23)

Every finding was checked against the code before it was acted on, and all eight held.

**Finding 1 (Medium), fixed in `37aae6f`.** `tests/manual/checklist.md` has three new timing rows in the same form as T1 and T2: T3 for rename, "Forkast fra brettet" and "Angre forkasting", T4 for "Marker som gjennomgått" to the next Question with focus on its heading, and T5 for "Lås brettet" in the dialog to the Game page. The NFR-5 section of TRACE points to them and now lists only Epic 6 as pending. The rows have not been timed yet; that is part of the manual run before handing in.

**Finding 2 (Low), fixed in `29a3d7d`.** `LockBoard` sets a `refused` ref when its own confirm comes back `QUESTIONS_UNREVIEWED`, and the focus effect runs only when that ref is set (then clears it). The `shown` ref is gone. A new e2e step listens for `focusin` while the last Question is marked and asserts that "Lås brettet" never received focus on the way to the heading. It failed before the fix. The existing step that expects focus on the disabled trigger after a refused confirm still passes.

**Finding 3 (Low), fixed in `29a3d7d`, with a different fix.** Instead of skipping events inside a `<dialog>` in the selection listener, `ConfirmDialog` now handles Esc in its own `onKeyDown`: it calls `preventDefault()` and closes the dialog itself unless it is busy. That keeps the 5.4 rule that every Esc another control has handled is `defaultPrevented`, so the selection listener needs no special case. A prevented keydown fires no native `cancel` event, so the busy guard no longer depends on Chrome's repeated-Esc behaviour for this path. `onCancel` and the `onClose` re-open stay for other close requests. The e2e test ticks a Group, opens the lock dialog, presses Esc and expects the dialog closed with the selection kept, and a second Esc then clears it. It failed before the fix.

**Finding 4 (Low), fixed in `2349bee`.** The review module's `UUID` regex lost its `i` flag, so an uppercase ID is `NOT_FOUND` before any query. The merge, move, rename and discard/restore `NOT_FOUND` tests each gained an uppercase case. Before the fix, move and discard gave `INTERNAL`, while merge and rename went through: merge with an uppercase source merged nothing but still cleared the reviewed mark. `games.UUID` still accepts uppercase Game IDs, because Postgres compares them correctly and no JavaScript comparison uses them.

**Finding 5 (Low), fixed in `2349bee`, more broadly than suggested.** The hard cut in `defaultLabel` now stops at the last whole grapheme within 40 code units (`Intl.Segmenter`), so neither a surrogate pair nor a letter with a combining mark is split. The unit test covers an emoji at code units 39 and 40, `e` + U+0301 at the same place, and an emoji that fits.

**Finding 6 (Low), fixed in `29a3d7d`.** The *Ikke på brettet* list is `<ol start={BOARD_SIZE + 1}>`, and the nine-Group page test asserts `start="9"`.

**Finding 7 (Low), fixed in `29a3d7d`.** The Group menu trigger has `aria-disabled` while an operation is pending, and the click guard stays. The e2e merge test asserts it on another card's trigger while the merge is held.

**Finding 8 (Low), fixed in `9a4c308`.** The delete-scan test is titled "after a Question, submit, close, Grouping, rename and delete, …".

**Checks.** After every commit, lint, typecheck and `npm run test` passed (675 tests at the end). The full `npm run test:e2e` passed 91 of 91. One earlier full run failed `server-output.spec.ts` once, because `next dev` kept recompiling and reloading `/registrer`. That spec passed on its own and in the next full run, and no change in this round touches it.
