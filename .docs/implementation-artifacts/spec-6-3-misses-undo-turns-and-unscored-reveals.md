---
title: 'Story 6.3: Misses, undo, turns and unscored Reveals'
type: 'feature'
created: '2026-11-23'
baseline_revision: '30e22a5eae2770246dbac613aeb3c2010324cf40'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-6-2-show-the-board-on-the-shared-screen-and-make-scored-reveals.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      AC4's "the unscored toggle switches off on the next Question" is built but has no automated test yet.
    evidence: |-
      The toggle is held as the Question position it was switched on for, so it is off on any other Question. The play view cannot reach another Question until Story 6.4 adds "Neste spørsmål", so the e2e assertion belongs to 6.4's test.
    location: >-
      src/components/Board.tsx
    severity: low
  - summary: >-
      Manual timing row T7 (Bom, Angre, Neste lag and the uten-poeng toggle within one second) is recorded but not yet run.
    evidence: |-
      NFR-5 timing is checked by hand with a stopwatch against the running app, like T1 to T6. An unattended run has no person to do it.
    location: >-
      tests/manual/checklist.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** The play view from Story 6.2 can only make scored Reveals: the Host cannot mark a miss, undo a misclick, pass the turn or reveal the rest without points, and the control bar holds only "Trykk F for fullskjerm." (FR-25 miss, FR-26, FR-27). Story 6.3's four ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract.

**Approach:** Add `play.undo` and `play.nextTeam` (AD-16) behind two Server Actions, mark unscored Reveals in `play.load`, and give the 6.2 control bar its controls: "Bom [M]" (client-only panel), "Angre [Z]", "Neste lag [T]", the "Vis resten uten poeng [U]" toggle, "?" with a shortcut overlay, and the "Alle svarene er avslørt." hint.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (`full`), then `impeccable` ("Launcher unavailable" path: read `DESIGN.md`/`EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` directly). Read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. The design contract wins on conflict. Stage rules from 6.2 hold: inverse focus ring, 44 px targets, bokmål "du", no exclamation marks, no berry, no red, no shadows, no-break space before "…".
- **Schema** in `src/lib/play.ts`: `playGameSchema = z.object({ gameId: z.string() })`, shared by undo and next Team.
- **`play.undo(hostId, input)`**, one transaction: validate; `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.playMove })`; select the highest-`seq` `reveal` of this Game whose slot (through `review.getBoard(tx, gameId).as("board")`) is on `play_state.current_question_id`, left-joined to `team` for the name; none → `NOTHING_TO_UNDO`; delete that row. Returns `{ boardSlotId, label, count, team: string | null }` (null for an unscored Reveal). Reveals of earlier Questions are never touched. Score falls by itself, since it is the SQL sum (AD-11).
- **`play.nextTeam(hostId, input)`**, one transaction: validate; lock (`playMove`); read the Game's Teams by position and `play_state.current_team_id`; set `current_team_id` to the next Team by position, wrapping from the last to the first. Returns `{ team: string }` (the new current Team's name).
- **`play.load`**: a revealed slot gains `scored: boolean` (its Reveal's `team_id` is not null). Nothing else changes.
- **Errors** in `src/lib/errors.ts`: `NOTHING_TO_UNDO` "Det er ingenting å angre.".
- **Actions** `undoReveal(input)` and `passTurn(input)` in `src/app/spill/[id]/actions.ts` through `hostAction(..., "skjerm")`. One round trip per action, no `router.refresh()` on success (NFR-5).
- **Board (client)**: one action at a time across reveal, undo and next Team (the existing `busy` ref). The 6.2 failure handling applies to all three: rejected call → "Mistet forbindelsen."; `NOT_FOUND`, `WRONG_STATE`, `WRONG_QUESTION`, `ALREADY_REVEALED`, `NOTHING_TO_UNDO` → silent `router.refresh()`; any other Failure → "Fikk ikke lagret trekket. Prøv igjen.". The banner replaces the control-bar row's content (controls hidden, `FullscreenKey` kept mounted) and clears on the next attempt; tiles and shortcuts stay usable, so the Host can retry.
- **Control bar** (`text-tv-control` `text-stage-muted`, items are `<button type="button">` text buttons at least 44 px high, left to right): "Bom [M]", "Angre [Z]" (rendered only while a slot of the current Question is revealed), "Neste lag [T]", the toggle, "?" (`aria-label="Hurtigtaster"`); then, pushed right, a `role="status"` hint that reads "Alle svarene er avslørt." in `text-stage-ink` when every slot is revealed, and "Trykk F for fullskjerm.". The hint `<p>` stays a direct child of the bar.
- **Bom [M]** (client only, no action): the word "Bom" on a `stage-raised` panel with a 2 px `stage-line` border, padding 24/64 px, `text-tv-score` (80 px) `text-stage-ink`, centred over the list (same grid cell as the Board list, above it, `pointer-events: none`, `aria-hidden`). CSS animation `bom` 1.5 s: opacity in over the first 150 ms, hold, out over the last 150 ms; removed after 1.5 s by a timer; a second M restarts it. Reduced motion: no animation, shown for 1.5 s. The live region says "Bom.". No sound, no icon, no red; the turn does not pass.
- **Angre [Z]**: calls `undoReveal`; the live region says "Angret. «{label}» er skjult igjen, N poeng trukket fra {Team}." for a scored Reveal and "Angret. «{label}» er skjult igjen." for an unscored one. If the Angre button had focus and the undone Reveal was the last one (so Angre disappears), focus goes to the undone tile's button.
- **Neste lag [T]**: calls `passTurn`; the live region says "{Team} svarer nå.".
- **Vis resten uten poeng [U]**: a toggle with `aria-pressed`. On: the item reads "Avslører uten poeng [U]" in `text-stage-ink` `font-bold`, hidden tiles have a dashed border (pending stays solid `stage-ink`), and a tile click or rank key sends `scored: false`. It is held as the Question position it was switched on for, so it is off again on any other Question with no remount.
- **Unscored tile** (`board-tile-unscored`): `bg-stage-raised`, 2 px dashed `stage-line` border, label `text-stage-ink`, Count in `text-tv-count` `text-stage-muted` with no badge pill, and the visible words "uten poeng" in `text-tv-control` beside it, so the tile's text contains "uten poeng". The staged reveal animation applies as for a scored tile. The live region says "«{label}» er avslørt uten poeng.".
- **Shortcuts**: `M`, `Z` (only while Angre is shown), `T`, `U` case-insensitive with no modifier and not a repeat; `?` with any Shift state but no Ctrl/Meta/Alt. Every shortcut (also `1`–`8`) is ignored while focus is in a text field or inside the open overlay.
- **Overlay** (`?`): a native `<dialog>` opened with `showModal()`, heading "Hurtigtaster", a list of the keys (`1`–`8` "Avslør plassen med det nummeret", `M` "Bom", `Z` "Angre siste avsløring", `T` "Neste lag", `U` "Vis resten uten poeng", `F` "Fullskjerm av og på", `?` "Vis hurtigtastene", `Esc` "Lukk"), and a "Lukk" button. `Esc` closes it (native). Stage colours: `bg-stage-raised` `text-stage-ink`, 2 px `stage-line` border, inverse focus ring.
- **Motion** in `globals.css`: `@keyframes bom` and `.bom-panel`, removed under `prefers-reduced-motion: reduce`.
- **Manual checklist**: timing row T7 "Bom, Angre, Neste lag and the uten-poeng toggle each show their result within one second" (NFR-5, FR-25 to FR-27).
- FR IDs in test titles, rows in `tests/TRACE.md`, offline, no key, no real names, no per-file Vitest timeouts. Commits in Norwegian are made in the finalize step.

**Never:**
- No Neste spørsmål, `N`/`→`, final Scores or *played* view (Story 6.4). Pass the turn only by hand: a Reveal, miss or undo never moves it.
- No saved state for a miss, no undo of a miss, no undo across Questions.
- No new Route Handler, client data library, websocket, dependency, optimistic update or test-only server hook. No `wiki/` edits (decisions go in this spec).
- Do not touch `.env`, `.logs/`, `prompting/` or `.claude/skills/excalidraw-diagram/`; no absolute machine paths in tracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Undo scored | Q1: slot 1 by Team 1 (5), slot 2 unscored | undo deletes slot 2's Reveal (`team: null`), then slot 1's (`team: "Lag 1"`, Score 5 → 0) | — |
| Undo across Questions | Q1 reveals, `play_state` moved to Q2 by hand, Q2 scored + unscored reveals | undos delete Q2's in `seq` order; then refused; Q1's stay | `NOTHING_TO_UNDO` |
| Nothing to undo | no Reveal on the current Question | nothing written | `NOTHING_TO_UNDO` |
| Next Team | Teams 1–3, Team 3 current | Team 1 current; returns `{ team: "Lag 1" }` | — |
| Unscored | `scored: false` | `team_id` null; Score unchanged; `load` shows `scored: false` | — |
| Property | seeded random reveal / undo / next-Team sequences | after each step every Score equals the model's sum of its scored Counts and the raw SQL sum | — |
| Bad input | missing or non-string `gameId` | nothing written | `INVALID_INPUT` |
| Wrong state | *ready*, *played* | nothing written | `WRONG_STATE` |
| Foreign Host | Host B on A's Game, random UUID, `abc` | A unchanged | `NOT_FOUND` |

</intent-contract>

## Code Map

- `src/server/play/index.ts` -- `reveal` (:130) is the transaction pattern to copy; `load` (:74) builds `revealed` as a `Set` of slot ids (:107) — make it a map to `team_id !== null`; `PlayView.board` type (:22) gains `scored`.
- `src/lib/play.ts` -- add `playGameSchema` beside `revealSchema` (:23). Same one-field shape exists as `closeCollectionSchema` (`src/lib/invite-link.ts:28`), but play keeps its own schemas.
- `src/lib/errors.ts` -- `ErrorCode` union and `MESSAGES`; `tests/unit/errors.test.ts` checks every code has a message.
- `src/app/spill/[id]/actions.ts` -- `hostAction` (:42), `revealSlot` (end of file); add `undoReveal`, `passTurn`.
- `src/components/Board.tsx` -- the client Board: `reveal()` (:45) holds the busy/transition/failure logic to generalise into one `run()`; `STALE` (:12); key listener (:75); focus-after effect (:89); the control-bar row (:148). `FullscreenKey` (`src/components/FullscreenKey.tsx`) keeps its own `F` listener.
- `src/components/PlayView.tsx` -- passes `question.position` to `Board`; the canvas grid puts the Board list at `col-start-1 row-start-2` (the Bom panel shares that cell).
- `src/app/globals.css` -- `[data-revealing]` keyframes (:153) and the reduced-motion block (:196); add `bom`.
- `tests/integration/play.test.ts` -- `playing()` (:115) gives a playing Game with Lag 1 and Lag 2, `slotIds[q][i]`, `teamIds`; `revealsOf`, `scoresOf`, `rawSums`, `codeOf`; the 6.2 `load` test (:345) expects revealed slots without `scored`, so add it there.
- `tests/integration/authz.test.ts` -- the 6.2 foreign-Host reveal row (:540, `playingOf`) is the pattern for undo and next Team.
- `tests/e2e/play.spec.ts` -- the 6.1 test counts eight buttons on the play view (now tiles plus the controls); the 6.2 test finds the bar as `hint.locator("..")`. `tests/e2e/fixtures.ts`: `collectingGame`, `submitSets` (default `SETS`: nine Groups, eight on the Board), `closeAndOpenReview`, `seriousViolations`.
- `tests/manual/checklist.md` (Timing table, T6 last), `tests/TRACE.md` (FR-25, FR-26, FR-27 sections, "Pending: Story 6.3" lines), `.docs/implementation-artifacts/sprint-status.yaml`.

## Tasks & Acceptance

**Execution:**
- `src/lib/play.ts`, `src/lib/errors.ts` -- `playGameSchema`, `NOTHING_TO_UNDO`.
- `src/server/play/index.ts` -- `undo`, `nextTeam`, `scored` in `load`.
- `src/app/spill/[id]/actions.ts` -- `undoReveal`, `passTurn`.
- `src/components/Board.tsx`, `src/components/PlayView.tsx`, `src/app/globals.css` -- control bar, Bom panel, toggle and unscored tiles, overlay, shortcuts, all-revealed hint, generalised failure handling.
- `tests/integration/play.test.ts` -- AC2: the undo-across-Questions and nothing-to-undo rows through `play.undo` and `undoReveal` (ok shape, revalidated paths, Scores and `rawSums` after each undo); AC3: next Team wraps 1 → 2 → 3 → 1 with three Teams through `passTurn`, unscored `load` shows `scored: false`, and the property test (seeded PRNG, at least 200 random steps over a three-Team Game, moving `play_state` to the next Question by hand at random so earlier-Question Reveals exist; after each step `scoresOf` and `rawSums` equal the model, and undo with an empty model stack is `NOTHING_TO_UNDO`); bad input and *ready*/*played* `WRONG_STATE` for both operations.
- `tests/integration/authz.test.ts` -- Foreign Host row for `play.undo`, `undoReveal`, `play.nextTeam`, `passTurn` (A's *playing* Game with a Reveal, random UUID, `abc`): `NOT_FOUND`, A's Reveal and current Team unchanged.
- `tests/e2e/play.spec.ts` -- update the 6.1 button count; new test on the default flow (nine Groups, eight tiles, two Teams): AC1 — M shows "Bom" centred over the list at 80 px in `stage-ink` on `stage-raised`, no `svg`/`img` inside, animation `bom`, gone after about 1.5 s; "Svarer nå" still on Lag 1 and no tile revealed, also after a reload. AC4 — Angre absent; reveal tile 1 → Angre shown; Z → status "Angret. «{label}» er skjult igjen, N poeng trukket fra Lag 1.", tile 1 a button again, Score "0 poeng", Angre gone; click "Neste lag [T]" → "Svarer nå" on Lag 2, status "Lag 2 svarer nå.", T → back to Lag 1; U → toggle `aria-pressed="true"`, reads "Avslører uten poeng [U]", weight 700, colour `stage-ink`, hidden tiles `border-style: dashed`; click a tile → its text contains "uten poeng", Score unchanged; click Angre → undone ("Angret. «…» er skjult igjen."); U off → solid borders and `aria-pressed="false"`; an `<input>` injected into the stage and focused swallows `m`, `t`, `u`, `1`, `?`; `?` opens the dialog "Hurtigtaster", axe clean with it open, `Esc` closes it; a reveal whose request body is rewritten in flight (`"scored":true` → `"scored":"x"`, so the server answers `INVALID_INPUT`) shows "Fikk ikke lagret trekket. Prøv igjen." in the bar with the controls hidden and the tile still hidden, and a reload shows the state unchanged; revealing every tile shows "Alle svarene er avslørt."; axe clean with scored and unscored tiles.
- `tests/manual/checklist.md`, `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- T7; FR-25, FR-26, FR-27, UX-DR21 rows; 6-3 done.

**Acceptance Criteria:**
- Given the play view, when the Host presses "Bom [M]", then "Bom" shows as an 80 px panel centred over the list (150 ms in, 1.2 s hold, 150 ms out) with no sound, red or icon, and the saved play state is unchanged, so the turn does not pass.
- Given scored and unscored Reveals on the current Question and Reveals on an earlier Question, when the Host undoes repeatedly, then each undo deletes the highest-`seq` Reveal on the current Question, subtracting its Count from the Team that received it when scored; earlier Questions' Reveals are never undone, and undo with nothing to undo is refused.
- Given a round, when the Host passes the turn past the last Team and makes unscored Reveals, then the turn wraps to the first Team, unscored Reveals store a null Team and change no Score, and over arbitrary sequences of Reveals and undos each Score equals the sum of its scored Reveals' Counts.
- Given the control bar, when the Host uses Angre, Neste lag and the unscored toggle, then the behaviour, announcements, shortcut guards, overlay, all-revealed hint and failed-save banner are as listed under Always.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 38 findings — high 0, medium 2, low 26, false 10, maybe-false 0
- findings:
  - `[low]` `[patch]` Verification gap: no test presses shortcuts while the overlay is open — e2e now presses `1`, `m`, `t`, `u`, `f` with the overlay open and asserts nothing changed (tile, Bom panel, status, toggle, fullscreen).
  - `[low]` `[patch]` Verification gap: the Bom panel's reduced-motion rule is unverified — e2e presses `m` under reduced motion and asserts `animation-name: none`.
  - `[medium]` `[patch]` Verification gap: the silent refresh for `NOTHING_TO_UNDO` is never exercised by the client — e2e: a second tab undoes the Reveal, then Z here shows no banner, the tile is a button again and Angre is gone.
  - `[low]` `[patch]` Verification gap: `?` is pressed without Shift, which real keyboards always send — the overlay now opens with `Shift+?`.
  - `[low]` `[reject]` Intent: AC3's unit tag is met by a DB-backed property test, not a unit test — Score is an SQL sum by AD-11, so a test without the database would test a model, not the code; the seeded property test runs the real operations (Design Notes, as decided in 6.2's triage).
  - `[low]` `[defer]` Intent: the toggle switching off on the next Question is not tested — unreachable in the UI until Story 6.4 adds "Neste spørsmål"; 6.4 asserts it (frontmatter `deferred`).
  - `[false]` `[reject]` Intent: the failed-save banner is forced with `INVALID_INPUT`, not a 500 — a 500 makes the action call reject, which is the "Mistet forbindelsen." path (already tested in 6.2); the banner path is "any Failure outside the stale list", and a real server Failure reaches it with nothing test-only shipped. The intent named a 500 only as an example.
  - `[false]` `[reject]` Intent: earlier-Question Reveals come from a hand-moved `play_state` — there is no next-Question operation before 6.4; the test exercises the real undo query against real earlier-Question rows.
  - `[low]` `[reject]` Intent: the 150/1200/150 ms split is not measured — the timings are CSS constants in one keyframe; sampling opacity mid-animation would be flaky. The animation name, the removal after more than 1.2 s and the reduced-motion rule are asserted (same call as 6.2).
  - `[false]` `[reject]` Intent: the text-field guard is tested with an injected `<input>` — the play view has no text field, so injecting one is the only way to exercise the guard the AC names.
  - `[false]` `[reject]` Intent: `F` is not re-tested here — Story 6.1's e2e test still toggles fullscreen with `F` on the play view and runs in every suite.
  - `[false]` `[reject]` Intent: `NOTHING_TO_UNDO` extends the stale list — the intent asks to keep stale refusals consistent for undo; this is exactly that.
  - `[false]` `[reject]` Intent: the diff is uncommitted and the spec untracked — mid-run state; the finalize step commits both.
  - `[low]` `[patch]` Intent: a code comment tags the miss as FR-26 — `globals.css` now says FR-25.
  - `[low]` `[reject]` Blind: a failed control-bar action unmounts the focused control and a stale undo removes Angre with focus — the banner replacing the row is the design contract; a failure needs a server error (or a second tab for the stale case), the tiles and every shortcut still work, and a reload restores everything. Keeping focus would add state for a path a party rarely meets.
  - `[low]` `[patch]` Blind: a second Bom sets the same "Bom." text, so it is not re-announced — the text now alternates with a trailing no-break space.
  - `[low]` `[patch]` Blind: the U toggle gives no spoken feedback by key — the live region now says "Avslører uten poeng." / "Avslører med poeng.".
  - `[low]` `[patch]` Blind: `board-tile-unscored` is a class defined nowhere — removed.
  - `[low]` `[patch]` Blind: the `passTurn` test title claims both pages are revalidated but checks one — it now asserts `/spill/{id}` too.
  - `[low]` `[patch]` Blind: no test presses shortcuts with the overlay open — same patch as the first Verification-gap row.
  - `[low]` `[reject]` Blind: the one-move-at-a-time guard is untested — the server stays consistent under the Game lock either way; only UI sequencing is affected (same call as 6.2).
  - `[medium]` `[patch]` Blind: the stale `NOTHING_TO_UNDO` path has no UI test — same patch as the Verification-gap row.
  - `[low]` `[reject]` Blind: Z with Angre hidden, Shift+M/T/U/Z and key repeat are untested — each is a one-condition guard whose failure is harmless (a hidden-Angre Z gets `NOTHING_TO_UNDO` and a silent refresh); `Shift+?` is now tested.
  - `[low]` `[patch]` Blind: the fuller control bar is not checked for overflow — e2e asserts `scrollWidth <= clientWidth` and `scrollHeight <= clientHeight` at the fullest state (toggle on, all revealed).
  - `[low]` `[reject]` Blind: `playingGame` lives in `play.spec.ts`, not `fixtures.ts` — it has one caller; moving it buys nothing until a second spec needs it.
  - `[low]` `[reject]` Blind: the new e2e test is one long test — it follows 6.2's pattern; splitting repeats the Review-to-play setup (about 5 s) per test.
  - `[false]` `[reject]` Blind: `nextTeam` crashes without a `play_state` row — unreachable: `play_state` is written in the transaction that moves the Game to *playing*, with at least two Teams (6.1 and 6.2 triage).
  - `[low]` `[reject]` Blind: `undo()` decides "last Reveal" from the board before the call — only a second tab changing Reveals between render and click makes it wrong, and the outcome is focus staying on the body; rare and harmless.
  - `[false]` `[reject]` Blind: sprint status says done while the spec is in review — mid-run state; finalize sets both in the same commit.
  - `[low]` `[reject]` Edge: the banner hides the controls, so a mouse-only Host cannot reach Angre or Neste lag until a tile click clears it — same as the Blind focus row: the contract prescribes the replacement, failures need a server error, and a reload restores the bar.
  - `[low]` `[patch]` Edge: Z while a revealed row has focus drops focus to the body — `undo()` records the focused `[data-slot]` and returns focus to the tile it hid again; e2e asserts it.
  - `[low]` `[reject]` Edge: a second Angre before the refreshed board arrives reads a stale "last" — same as the Blind stale-board row.
  - `[low]` `[patch]` Edge: a repeated Bom is not announced — same patch as the Blind row.
  - `[false]` `[reject]` Edge: an empty Board shows "Alle svarene er avslørt." — a locked Board has at least one slot per Question (`NO_GROUPS_ON_BOARD` refuses marking a Question with none), so `board` is never empty.
  - `[low]` `[reject]` Edge: U while the banner is up turns the mode on with no visible toggle — the hidden tiles turn dashed, which shows the mode, and the next reveal clears the banner.
  - `[false]` `[reject]` Edge: `nextTeam` with no `play_state` or no Teams — same unreachable state as the Blind row.
  - `[low]` `[patch]` Edge: the property loop skipped 55 of 240 steps, below the spec's 200 — a reveal with nothing hidden now becomes an undo, so all 240 steps assert.
  - `[low]` `[patch]` Edge: the `passTurn` revalidation claim — same patch as the Blind row.

## Design Notes

- **Failed-save banner without a test hook.** AC4 needs a non-stale Failure, which 6.2 could not force. Rewriting the action's request body in flight (Playwright `route.continue({ postData })`) makes the real server answer `INVALID_INPUT`, a Failure outside the stale list, so the banner path runs end to end with nothing shipped for tests.
- **AC3's unit tag.** Score is an SQL sum by AD-11, so a test without the database would test a model of the code, not the code. The property-style test runs the real `play.reveal`, `play.undo` and `play.nextTeam` on in-memory PGlite and lives in the integration suite; 6.2's triage made the same call.
- **Toggle off on the next Question** is held as "on for Question position P", so it is off for any other Question without remounting the Board (a remount would drop the live region's text). Its e2e assertion needs "Neste spørsmål", which Story 6.4 adds; 6.4 asserts it.
- **Announcements not given by EXPERIENCE** (unscored Reveal, unscored undo, next Team, miss) follow the given ones in tone: "«{label}» er avslørt uten poeng.", "Angret. «{label}» er skjult igjen.", "{Team} svarer nå.", "Bom.". The turn change and the miss are otherwise silent to a screen reader.
- **Toggle feedback.** The U key also announces "Avslører uten poeng." or "Avslører med poeng.", since `aria-pressed` is only read when the button has focus (added in review).
- **Stale codes.** `NOTHING_TO_UNDO` joins the silent-refresh list: it only reaches a tab whose Angre was shown while another tab undid the last Reveal, and the saved state is the answer, as 6.2 decided for the other codes.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, axe clean on the play view with the overlay open and with scored and unscored tiles.

## Auto Run Result

Status: done

**Summary.** The Host can now mark a miss, undo the last Reveal, pass the turn and reveal the rest without points, all from the play view's control bar or by key.
- `play.undo` (AD-16) deletes the highest-`seq` Reveal on the current Question in one transaction under the Game lock and returns label, Count and Team (null when unscored); earlier Questions' Reveals are never touched, and nothing to undo is `NOTHING_TO_UNDO`. The Score falls by itself, since it is the SQL sum (AD-11).
- `play.nextTeam` moves `play_state.current_team_id` to the next Team by position and wraps from the last to the first.
- `play.load` marks each revealed slot `scored` true or false. `undoReveal` and `passTurn` are one action round trip each, with no refresh on success (NFR-5).
- The control bar has "Bom [M]" (a client-only 80 px panel over the list, 1.5 s, nothing saved), "Angre [Z]" (only while the Question has a Reveal), "Neste lag [T]", the "Vis resten uten poeng [U]" toggle with `aria-pressed` and dashed hidden tiles, and "?" with a native-dialog shortcut overlay. Unscored tiles have their own dashed look with "uten poeng". "Alle svarene er avslørt." shows when every tile is revealed. Every move shares one failure path: "Mistet forbindelsen.", a silent refresh for stale codes (now also `NOTHING_TO_UNDO`), or "Fikk ikke lagret trekket. Prøv igjen." replacing the bar.

**Files changed.**
- `src/server/play/index.ts` -- `undo`, `nextTeam`, `scored` in `load`.
- `src/lib/play.ts`, `src/lib/errors.ts` -- `playGameSchema`, `NOTHING_TO_UNDO`.
- `src/app/spill/[id]/actions.ts` -- `undoReveal`, `passTurn`.
- `src/components/Board.tsx`, `src/components/PlayView.tsx`, `src/app/globals.css` -- control bar, Bom panel, toggle, unscored tiles, overlay, shortcuts, hint, shared failure handling.
- `src/components/FullscreenKey.tsx` -- `F` is ignored inside the open overlay, like every other shortcut.
- `tests/integration/play.test.ts`, `tests/integration/authz.test.ts`, `tests/e2e/play.spec.ts` -- undo, next Team, the seeded Score property test, foreign-Host rows, the 6.3 e2e flow; 6.1/6.2 expectations updated for the new buttons and the second status element.
- `tests/TRACE.md`, `tests/manual/checklist.md` (T7), `.docs/implementation-artifacts/sprint-status.yaml` (6-3 done).

**Review findings.** One pass, 38 findings (0 high, 2 medium, 26 low, 10 false).
- Patched, 13 rows in 10 entries (1 medium, 9 low): the stale-undo e2e case; shortcuts with the overlay open; reduced-motion Bom; `Shift+?`; bar overflow check; repeated Bom announced again; spoken feedback for the U toggle; focus kept when Z undoes a focused row; dead class removed; the FR-25 comment tag; the `passTurn` revalidation assertion; every property step asserting.
- Deferred, 1 finding plus one process item: the toggle's switch-off on the next Question (needs 6.4); the manual T7 timing run.
- Rejected: every other row, with its reason in the triage log (the contract's banner replacing the bar, unreachable states, flaky timing assertions, harmless one-condition guards, test-structure preferences).

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (planning).** The intent suggested forcing the failed-save banner with a 500 or a test-only hook. A 500 makes the action call reject, which is the lost-connection path, and a hook would ship test code. The plan rewrites the request body in flight so the real server answers `INVALID_INPUT`, a Failure outside the stale list.
- **Corrected (implementation output, found in review).** Repeated misses were silent to screen readers; the U key gave no spoken feedback; Z on a focused row dropped focus; the property test asserted only 185 of 240 steps; the stale-undo path, the overlay key guard, `Shift+?` and the reduced-motion Bom were untested; a dead CSS class and a wrong FR tag.
- **Rejected (reviewer suggestions).** Keeping the controls under the failure banner (the design contract says the banner replaces the row); a pure unit test for Score (AD-11 makes Score SQL, so it would test a model); guards for a missing `play_state` (unreachable); moving a one-caller helper and splitting the e2e test; measuring the 150/1200/150 ms split.
- **Corrected in orchestration.** The platform ran the implementation agent and the four reviewers in the background, although the workflow asks for blocking calls. Each result was awaited before the next step, so nothing was skipped.

**Follow-up review recommendation:** false. One `medium` entry was patched (a missing test of the stale undo path), below the threshold of two.

**Verification.** After the review patches: `npm run lint` clean; `npm run typecheck` clean; `npm run test` 720 passed (43 files); `npm run test:e2e` 94 passed, axe clean on the play view with the overlay open and with scored and unscored tiles. All offline, no key.

**Residual risks.** The toggle's switch-off on the next Question is untested until 6.4. The failure banner hides the control buttons, so after a rare server error a mouse-only Host gets them back by clicking a tile or reloading. T7 is not yet run by hand.
