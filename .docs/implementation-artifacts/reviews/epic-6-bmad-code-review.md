# Epic 6 code review (bmad-code-review)

- **Date:** 2026-11-23
- **Scope:** `git diff origin/main...epic-6-spill`, which covers stories 6.1 (name the Teams and start play), 6.2 (show the Board on the shared screen and make scored Reveals), 6.3 (misses, undo, turns and unscored Reveals), 6.4 (next Question, final Scores and the played Game) and 6.5 (a full round without a model key, end to end). Eleven commits.
  - 42 files changed, +7,493/-152.
  - The reviewers read the diff without `drizzle/meta/*` snapshots and without `.docs/`: 32 files, +4,266/-145, 4,921 lines, 219 kB.
- **Mode:** `full`. The diff was checked against:
  - `spec-6-1` to `spec-6-5`, including their triage logs and `deferred` lists (rejected items were not raised again without a new argument);
  - `epic-6-context.md` and Epic 6 in `epics.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-1, AD-4, AD-5, AD-11, AD-15, AD-16, AD-17 and AD-23;
  - the PRD: FR-3, FR-23 to FR-27, FR-30, NFR-5 and NFR-6, and the state table in §4.1;
  - `DESIGN.md` and `EXPERIENCE.md` (Play view rules, ConfirmDialog, Interaction Primitives, State Patterns, Accessibility Floor).
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:**
  - the play state machine and its transactions (start, reveal, undo, nextTeam, nextQuestion and finish), with owner and state checks;
  - Score correctness: the SQL sum, scored against unscored Reveals, and undo;
  - that play reads only `board_slot` and never sends hidden labels or Counts to the browser;
  - stale-tab paths;
  - keyboard shortcuts against inputs and overlays;
  - accessibility of the stage, and test gaps;
  - an explicit judgement on the one-key finish on the last Question.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `games.lockForMutation` and `games.transition`, `PERMITTED` in `game-state.ts`, `review.getBoard`, and the stale-tab and overlay steps in `tests/e2e/play.spec.ts`.
  - Also checked: the cross-Question undo test and the exact-shape `load` assertions in `tests/integration/play.test.ts`, and the play cases in `authz.test.ts`.
- **Test run:** not run. No finding depended on a test result. `test:e2e` was not run either.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story files was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 1 | patch |
| Low | 1 | patch |
| Deferred | 0 | |
| Dismissed | 23 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **Owner and state checks on every mutation.**
  - `start`, `reveal`, `undo`, `nextTeam` and `nextQuestion` each open a transaction and start with `games.lockForMutation`. `start` checks `PERMITTED.startPlay` (`ready`). The four moves check `PERMITTED.playMove` (`playing`), which equals `finishPlay`, so the one lock in `nextQuestion` also covers `finish`.
  - `load` and `finalScores` use `games.getOwned` plus their own state check.
  - `authz.test.ts` gives Host B `NOT_FOUND` on every operation and action, for A's Game, for a random UUID and for a malformed ID, and checks that A's rows are unchanged.
  - The played-Game test runs every operation, action and `load` and expects `WRONG_STATE` with nothing changed.
- **The transactions.**
  - `start` inserts the Teams, points `play_state` at the lowest-position Question and Team 1, and moves `ready → playing` through `games.transition` in one transaction.
  - `reveal` resolves the slot through `review.getBoard` inside the owned Game, so a foreign or malformed ID is `NOT_FOUND`. A slot on another Question is `WRONG_QUESTION`.
  - `reveal` takes the Team from `play_state` under the lock, never from the client (AD-16). The unique `board_slot_id` with `onConflictDoNothing` gives `ALREADY_REVEALED`, and `seq` is `max + 1` under the lock with a unique `(game_id, seq)` index behind it.
  - `undo` deletes the highest-`seq` Reveal joined to `play_state.current_question_id`, so earlier Questions are never touched. The integration test proves this with Reveals on two Questions.
  - `nextTeam` wraps by position.
  - `nextQuestion` requires the client's `position` to equal the saved one, so a double press or a stale tab gets `WRONG_QUESTION`. It moves to the smallest greater position, or calls `finish`.
  - `finish` sets `played_at` in the same `transition` update and returns `played_at + 30 days`.
- **Score (AD-11, FR-25, FR-26, FR-27).**
  - Score is never stored. `teamsWithScores` sums `board_slot.count` over `reveal ⋈ team` through the `getBoard` subquery, with `coalesce(…, 0)`.
  - An unscored Reveal has a null `team_id`, so it never joins a Team and changes no Score.
  - Undo deletes the row, so the Score falls with it.
  - The seeded property test runs 240 reveal, undo, next-Team and next-Question steps against the raw SQL sum.
  - The 6.5 no-key e2e pins each tile's Count before comparing the Scores.
- **No hidden label or Count reaches the browser (FR-24, AD-15).**
  - `load` maps a hidden slot to `{ id, position, revealed: false }` only. The integration test asserts that exact shape with `toEqual`, and the 6.2 render test scans the HTML for every hidden, discarded and below-limit label.
  - The *playing* Game page calls `play.load` on the server but passes only the position, total and Teams to the markup.
  - Play reads `board_slot` only through `review.getBoard`, and never reads `answer` or `answer_group`.
- **Stale tabs.**
  - `ALREADY_REVEALED`, `NOTHING_TO_UNDO` and `WRONG_QUESTION` each have a second-tab e2e step that ends in a silent refresh with no banner. `WRONG_STATE` and `NOT_FOUND` are in the same list but untested (finding 2).
  - Undo is the one move whose stale case is wrong (finding 1).
- **Shortcuts against inputs and overlays.**
  - One guard skips `input, textarea, select, [contenteditable], dialog`, any Ctrl, Meta or Alt, and key repeat. `?` is checked before the Shift return, so `Shift+?` works.
  - The e2e test presses `1`, `m`, `t`, `u`, `n`, `ArrowRight` and `f` with the overlay open and asserts that nothing changed. It also exercises the text-field guard with an injected `<input>`.
  - `FullscreenKey` repeats the same guard.
- **Stage accessibility.**
  - Hidden tiles are `<button>`s named "Avslør plass N". Revealed rows are static text, and an unscored row carries "uten poeng".
  - The current Team has `aria-current` and the words "Svarer nå". Scores have an sr-only "N poeng" behind the CSS counter.
  - One sr-only `role="status"` region carries every announcement, and a repeated "Bom." alternates a no-break space so it is read again.
  - Focus moves to the new Question's `<h1>` when a focused tile unmounts, and to "Sluttstilling" when the Game finishes.
  - The stage uses `focus-inverse`, and the Host chrome leaves the tab order through `body:has([data-stage])`.
  - axe runs clean on Team setup, the play view (with the overlay open, and with scored and unscored rows) and "Sluttstilling".

## Findings

### Medium

#### 1. Undo from a stale tab removes a Reveal the Host cannot see, and the Score falls with it

- **Location:** `src/server/play/index.ts:207-247`, `src/lib/play.ts:29-30`, `src/components/Board.tsx:130-151` and `:200-201`.
- **Source:** found in triage while checking the stale-tab paths. No layer raised it. The 6.3 log rejected a related row ("`undo()` decides 'last Reveal' from the board before the call"), but only for its focus effect, not for which Reveal gets deleted.
- **What happens:**
  - `undo` takes only `{ gameId }` and deletes the highest-`seq` Reveal on the *saved* current Question. The client sends nothing that says which Reveal it shows as the last one.
  - The client offers Angre and `Z` whenever its own, possibly stale, Board has a revealed slot (`canUndo`).
  - Two cases follow:
    - **Same Question, double undo:** tab A shows Reveals r1 and r2. Tab B undoes r2. In tab A the Host presses `Z` to undo r2, and the server deletes r1 instead. Two Reveals are gone, and r1's Count is taken from its Team.
    - **Another Question:** tab A still shows Question 2 with a Reveal. Tab B has moved on to Question 3 and revealed a tile. `Z` in tab A deletes Question 3's Reveal, which tab A has never shown.
  - Both calls return `ok`, so the refusal-and-refresh path never runs. The Host hears "Angret. «…» er skjult igjen, N poeng trukket fra …" for a label that was not the one they meant, then the view refreshes.
- **Why it matters:**
  - Score correctness is the round's outcome (FR-25: "A Team's Score always equals the sum of the Counts of its scored Reveals" still holds, but the wrong Reveal is gone).
  - Re-revealing does not repair it, because a new Reveal credits the *current* Team, which may not be the Team that earned it.
  - The epic guards the same stale-tab class everywhere else: `reveal` refuses a slot on another Question (`WRONG_QUESTION`), and `nextQuestion` takes `position` precisely so that "a stale tab or a double press must never skip a Question or end the Game" (`src/lib/play.ts:32-33`). AD-16 lists "reveals credited to the wrong Team or Question" under *Prevents*. Undo is the one move left unguarded.
  - It needs a second tab, which is why this is medium and not high. The e2e suite opens second tabs three times, so the team treats that setup as real.
- **Fix:**
  - Mark the last Reveal in `PlayView`: `load` already reads every Reveal of the Game, so it can order them by `seq` and flag `last: true` on the current Question's highest-`seq` slot.
  - `Board.undo` sends `{ gameId, boardSlotId }` for that slot.
  - In `play.undo`, refuse with `NOTHING_TO_UNDO` (already in `STALE`, so the tab refreshes silently) when the highest-`seq` Reveal on the current Question is not that slot. This keeps AD-16's rule ("Undo deletes the highest-`seq` reveal on the current Question") and only adds a staleness check, the same pattern as `nextQuestion`'s `position`.
  - Tests:
    - Integration: two Reveals; undo naming the older slot gives `NOTHING_TO_UNDO` and deletes nothing.
    - e2e: extend the second-tab step at `tests/e2e/play.spec.ts:522` to two Reveals, and assert that one Reveal is still shown after `Z` in the stale tab.

### Low

#### 2. The `WRONG_STATE` and `NOT_FOUND` stale paths in the Board have no test

- **Location:** `src/components/Board.tsx:18-24` and `:101-103`; `tests/e2e/play.spec.ts:778-795`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:**
  - `STALE` lists five codes. `ALREADY_REVEALED`, `NOTHING_TO_UNDO` and `WRONG_QUESTION` each have a second-tab e2e step.
  - Nothing sends a move that gets `WRONG_STATE` (the Game was finished in another tab) or `NOT_FOUND` (it was deleted). Integration tests cannot reach this client branch.
  - If either code is dropped from `STALE`, the stale tab shows "Fikk ikke lagret trekket. Prøv igjen." in place of the controls, and every retry fails the same way. No test would catch it.
- **Why it matters:** the most likely stale moment in a real round is the end. A second tab left on the last Question while the main tab shows "Sluttstilling" should refresh to "Sluttstilling".
- **Fix:** at `tests/e2e/play.spec.ts:778`, keep `other` open on Question 3 while the main tab presses "Vis sluttstilling". Then press `n` (or `t`) in `other`, and assert that its `h1` reads "Sluttstilling" with no banner.

## The one-key finish on the last Question: is a confirm or an undo warranted?

**No.** The PRD requires neither, and the architecture rules out an undo.

- **Undo of finish contradicts the state machine.**
  - PRD §4.1 gives *played* no outgoing transition: "| *played* | the last Question is finished (FR-27) | none |". AD-4 agrees.
  - FR-26 scopes undo to Reveals: "The Host can undo the most recent Reveal … Undo is available only for the most recent Reveal on the current Question." Moving on is not a Reveal.
  - An undo of finish would need a new transition `played → playing`, a way to clear `played_at`, and an exception in the purge.
- **A confirm is not asked for, and the design contract forbids it.**
  - FR-27 says only that "after the last Question the screen shows the final Score of every Team, and the Game moves to *played*", and that moving on is manual.
  - EXPERIENCE gives ConfirmDialog to "open Collection, revoke, close Collection, confirm Board, delete Game", and Interaction Primitives says "Confirmation only for the five actions listed under ConfirmDialog". Spec 6.4 repeats this as a *Never*.
  - The 6.4 rejection ("a dialog would contradict the design contract") is therefore correct. One nuance: ConfirmDialog's own criterion, "Irreversible … actions only", does describe finishing, so the contract's closed list is a deliberate choice, not an oversight in the code.
- **What an accidental `N`/`→` actually costs:**
  - No Score is lost, since all Reveals stay and "Sluttstilling" shows them.
  - The Host loses the FR-27 option to make unscored Reveals of the last Question's remaining Groups.
  - The 30-day purge clock starts a few minutes early.
  - This is the same loss as an accidental `N` on any earlier Question, which also cannot be reversed, because there is no "previous Question". A confirm on the last Question alone would protect one transition out of eight to fifteen identical ones.
  - Double presses and stale tabs are already harmless, through `nextQuestion`'s `position` guard.
- **Recommendation:**
  - Keep the behaviour.
  - The decision lives only in the 6.4 triage log. A row in `wiki/prosjekt/beslutninger.md` would make it visible to the examiner, like the count-up colour row 6.2 added.
  - If the group still wants protection against presenter clickers (which send `→`), the lightest contract-compatible option is to amend EXPERIENCE so that `→` does not finish on the last Question and only `N` and the button do. That is a design change for the group, not a code defect.

## Dismissed

1. **One `N`/`→` ends the Game with no confirm, and clickers send `→`** (Blind Hunter, Edge Case Hunter). Rejected in the 6.4 log on the same clicker argument. See the section above.
2. **The failure banner hides every control, and focus drops to `<body>` when it unmounts the focused control** (Blind Hunter, Edge Case Hunter ×2). Rejected in the 6.3 log with no new argument. EXPERIENCE prescribes the banner "in place of the control-bar row". Tiles and every shortcut still work, the next move clears the banner, and a reload restores the bar.
3. **Fullscreen only by the `F` key, and no Fullscreen API on some browsers** (Blind Hunter, Edge Case Hunter). EXPERIENCE gives `F` and the hint. The browser's own fullscreen command works for a mouse user. The missing-API case was rejected in the 6.1 log (the stage runs in a current laptop browser).
4. **No way back to the Game page during play** (Blind Hunter). EXPERIENCE: "The play view has no top bar; it is a full-window canvas with its own control bar." The browser's Back button and the URL work, and the Game page offers "Fortsett spillet".
5. **The "uten poeng" toggle is not persisted** (Blind Hunter). FR-27's persistence list is Question, Team, Reveals and Scores. After a reload the toggle reads "Vis resten uten poeng [U]" with solid tiles, so the mode is visibly off, and a scored Reveal made by mistake can be undone.
6. **Duplicate Team names are accepted** (Blind Hunter, Edge Case Hunter). No requirement asks for distinct names. The defaults never repeat (6.1 patch), and the Host types and sees every name. A refine would be a new rule.
7. **zod counts UTF-16 units and the database counts code points** (Blind Hunter). Rejected in the 6.1 log: client and server both use zod, so the message is consistent.
8. **No composite foreign keys tie `reveal` and `play_state` to the same Game** (Blind Hunter). Rejected in the 6.1 log: only `play` writes these tables, and it resolves every ID inside the locked Game.
9. **Unchecked destructuring in `start`, `load`, `reveal`, `nextTeam` and `nextQuestion`, a *ready* Game with zero Questions, and a *played* Game with a null `played_at`** (Blind Hunter, Edge Case Hunter ×2). False, because none of these states can be reached:
   - `play_state` is inserted in the transaction that leaves *ready*.
   - Questions are frozen after *draft*, and Teams have no delete, so no cascade can remove the rows.
   - `transition` sets `played_at` in the same update that sets *played*.
   - Rejected in the 6.1, 6.3 and 6.4 logs.
10. **`play.load` reads without a snapshot, and the screen and Game pages race a delete or finish between two reads** (Blind Hunter, Edge Case Hunter ×2). Rejected in the 6.1 and 6.4 logs, and the same call as Epic 5's dismissed item 3: a millisecond window in one Host's own tabs, healed by the next refresh.
11. **Whole-Game Board and Reveal reads are filtered in JavaScript** (Blind Hunter). At most 15 Questions × 8 slots = 120 rows, and at most 120 Reveals per Game. The cost is negligible.
12. **Duplicated Team/Score `<dl>` and keydown guard, and a listener re-bound every render** (Blind Hunter). No named harm. Re-binding is deliberate, so the listener sees the current Board without stale closures.
13. **`deleteAfter` in the `nextQuestion` result is unused** (Blind Hunter). Rejected in the 6.4 log: AC1 requires `finish` to return it, and the integration test asserts it.
14. **The manual checklist has no keyboard-only or screen-reader run of the play view** (Blind Hunter). The checklist copies EXPERIENCE's Accessibility Floor table, which has no such row, and NFR-6 names the answer form for keyboard and screen-reader use. The e2e tests drive the play view by keyboard and run axe on it. This is the same call as Epic 5's dismissed item 8.
15. **Unit tests are thin, and `nextQuestionSchema` accepts 0 or a negative `position`** (Blind Hunter). A position that does not match the saved one is `WRONG_QUESTION` and writes nothing, and the schema, Score and turn logic are proved in integration against the real database (AD-11).
16. **Digits need Shift on AZERTY, so `1`–`8` never fire** (Edge Case Hunter). The product is Norwegian-only, and the Norwegian layout has unshifted digits. The numpad works, and spec 6.3 deliberately takes the shortcuts with no modifier.
17. **No fallback without `:has()` or `tan(atan2())`** (Edge Case Hunter). Rejected in the 6.2 log: the stage runs in a current laptop browser.
18. **`TeamSetup`'s heading observer is never disconnected** (Edge Case Hunter). Rejected in the 6.2 log: it waits only for the next `<h1>`, which is the page heading wherever the Host lands.
19. **The six-promise loop at `tests/integration/play.test.ts:1026` can raise an unhandled rejection** (Edge Case Hunter). Maybe-false. Every promise is created before its handler, but PGlite serialises the transactions, so each rejection lands after the loop has attached `codeOf` to it. The suite has passed repeatedly. If it ever flakes, the fix is thunks; at worst this is low.
20. **Team setup's refresh after a lost response is untested** (Verification Gap, filed `defer`). Low. The path needs a request that committed on the server but whose response never arrived. The "Gå til spillet" link recovers by hand, and the e2e route setup for a committed-then-dropped response is out of proportion to the risk.
21. **The play view has two polite live regions where EXPERIENCE says one** (Acceptance Auditor). Low. Spec 6.3 asks for the `role="status"` hint. Polite regions queue rather than interrupt, so both messages are read. Merging the hint into the announcer adds a branch for no user-visible gain.
22. **Play buttons set no `aria-busy` or in-progress verb** (Acceptance Auditor). The play view's own rule (the `stage-ink` pending border on the tile) is more specific than the general Button rule, repeat presses are ignored by `busy`, and the result is announced within NFR-5's one second.
23. **`Z` works while Angre is hidden behind the banner** (Acceptance Auditor). Harmless, and consistent with the same spec's "tiles and shortcuts stay usable, so the Host can retry". The only fix is to edit the spec, which triage does not do.

## Verdict

**Approve with patches.** No high findings.

- **Correct and well tested:**
  - the play state machine, its owner and state checks, and the transactions;
  - the SQL Score, including scored against unscored Reveals and undo;
  - the rule that play reads only through `review.getBoard`, so no hidden label or Count reaches the browser;
  - the shortcut guards.
- **The one medium finding:** undo is the only move without a stale-tab guard. From a second tab it can delete a Reveal the Host does not see and take the Count from its Team (finding 1). The fix follows the `position` pattern `nextQuestion` already uses.
- **The low finding:** missing evidence for the end-of-game stale path (finding 2).
- **The one-key finish on the last Question:** it complies with the PRD, AD-4 and EXPERIENCE. Neither a confirm nor an undo of finish is warranted.
- **Before the PR:** fix finding 1. Finding 2 is a short extension of an existing e2e step.

## Epic 6 review fixes (2026-11-23)

Both findings were checked against the code before they were fixed, and both held.

**1. Undo from a stale tab: fixed in `2afa998`.** `play.load` now returns `lastReveal`, the slot of the highest-`seq` Reveal on the current Question (null when there is none). `Board` sends it back as `boardSlotId` with every undo, and `undoSchema` requires it. `play.undo` keeps AD-16's rule (delete the highest-`seq` Reveal on the current Question) and refuses with `NOTHING_TO_UNDO` when that Reveal is not the one the tab named, so the tab refreshes silently through `STALE`. `canUndo` now reads `lastReveal !== null`, which is the same condition as before. New integration tests cover the two scenarios in the finding: a tab that still names Ola after another tab undid it (and a tab naming the older Kari while Per is the last), and a tab still on Question 1 after another tab revealed on Question 2. In both, the Reveals and Scores stay. The seeded property test now reads `lastReveal` from `load` before every undo and checks it against the model. The second-tab e2e step now makes two Reveals: after the other tab undoes the second one, `Z` in the stale tab refreshes with no banner, Kari is still shown and scored, and the next `Z` undoes Kari as usual. That step fails without the fix. The undo calls in `authz.test.ts` and the played-Game test send a `boardSlotId`, so they still reach the owner and state checks.

**2. `WRONG_STATE` stale path untested: fixed in `c998ea1`.** In the three-Question e2e test a second tab is opened on Question 3 before the main tab presses "Vis sluttstilling". After the finish, `n` in that tab gets `WRONG_STATE` and the tab lands on "Sluttstilling" with neither "Fikk ikke lagret trekket" nor "Mistet forbindelsen". The `NOT_FOUND` path (a deleted Game) is still covered only by the integration tests, since it reaches the same `STALE` branch and would need a delete flow inside the play test.

**The one-key finish:** unchanged, as recommended. The decision is logged in `wiki/prosjekt/beslutninger.md` on `main`.

**Dismissed items:** none were reopened. Item 21 (two polite live regions) was fixed anyway, because the impeccable audit raised it as N1 with the reason that a screen reader often reads only one of two simultaneous updates (`dfa15c6`).
