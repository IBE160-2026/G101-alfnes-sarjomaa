# Epic 6 ponytail review

Scope: `git diff origin/main...epic-6-spill` (stories 6.1 to 6.5). Assumed load: one Host per Game on one laptop mirrored to a TV, two to four Teams, at most 20 Questions with up to eight Board slots each, a handful of Games at once. Nothing was changed.

What this change does: It adds the `play` module with the `team`, `play_state` and `reveal` tables, Team setup and the shared screen at `/spill/[id]/skjerm`. The Host names two to four Teams, then reveals Board slots with or without points, marks misses, undoes the last Reveal, passes the turn and moves through the Questions to "Sluttstilling", which moves the Game to *played* and shows the deletion date. Story 6.5 adds the no-key, local-only end-to-end round with axe passes, and the Review e2e helpers move to `tests/e2e/fixtures.ts` so both specs share them.

I traced every write path: action, `hostAction`, the module entry point (`validate`, `lockForMutation` for the state in `PERMITTED`), and the queries under the Game row lock. The Team for a scored Reveal comes from `play_state`, never from the client. `boardSlotId` is matched inside `review.getBoard(tx, gameId)`, so another Game's slot, a random UUID and a malformed id all end as `NOT_FOUND`. A second Reveal of the same slot hits the unique index and returns `ALREADY_REVEALED`. Undo joins `play_state` on the current Question, so it can never reach an earlier Question. `nextQuestion` takes the position the screen shows, so a stale tab or a double press gets `WRONG_QUESTION` instead of skipping a Question or ending the Game. Score is a SQL sum over scored Reveals, never stored (AD-11), and a hidden slot carries no label or Count to the browser (FR-24). `npm run typecheck` and `npm run lint` are clean, and `tests/integration/play.test.ts` with `tests/unit/play.test.ts` pass (52 tests).

Checked and found clean:

- **Per-file test timeouts:** none added. The only timeout lines in the new tests are `test.slow()` in `no-key.spec.ts` (a full round, with a comment saying why) and a 3 s `toHaveCount(0)` in `play.spec.ts` that proves the Bom panel leaves after about 1.5 s.
- **`shortcut:` comments:** the epic removes three (the *ready* placeholder on the Game page, and the 6.1 notes on the literal Score and the *played* redirect) and adds none.
- **Dead code and AI leftovers:** no commented-out code, debug output, `.only` or `.skip`. Every new export has a caller.
- **The 1920×1080 canvas:** `.stage-canvas` in `globals.css` is nine declarations with no script. `tan(atan2(100vw, 1920px))` turns the window size into a plain ratio, and `scale: min(...)` letterboxes. It also works on the first server-rendered paint, which a resize listener would not. It cannot get much smaller.
- **The keyboard shortcuts:** one `keydown` listener in `Board.tsx` (about 20 lines) and one for `F` in `FullscreenKey.tsx`, which the final Scores reuse. No library, and every key calls the same function its button does. See finding 4 for the one duplicated guard.

## Must fix

None.

## Should fix

1. **The Team score list is written twice on the Game page** (`src/app/spill/[id]/page.tsx`, the *playing* and *played* branches)
   - **What this is:** The Game page shows each Team's name and Score in a `<dl>`, both while the Game is playing and after it is played.
   - **Problem:** The two `<dl>` blocks are the same 17 lines, including the `sr-only` " poeng" text. A change to one, for example to the accessible name of the Score, has to be made in both, and nothing tells the next person that.
   - **Fix:** Put the block in one small function in the same file, `scoreList(teams)`, and call it from both branches.
   - **If we skip it:** Nothing breaks now. The two lists will drift apart the first time only one of them is edited.

2. **The unit test for `revealSchema` repeats an integration test** (`tests/unit/play.test.ts`, the whole file)
   - **What this is:** It checks that `revealSchema` accepts a boolean `scored` and refuses a missing or non-boolean one.
   - **Problem:** `tests/integration/play.test.ts:L462` already sends a missing `scored`, the string `"true"` and a number `boardSlotId` through both `play.reveal` and the `revealSlot` action, and expects `INVALID_INPUT` with nothing written. That reaches the same schema through the real entry point. Every other integration test in the file proves that `scored: true` and `scored: false` are accepted.
   - **Fix:** Delete `tests/unit/play.test.ts` and point its TRACE row at `play.test.ts:L462`. The Score property test, which AD-22 asks for, lives in the integration file and stays.
   - **If we skip it:** Nothing breaks. One more file to keep in step with the schema.

3. **The *played* refusal is tested again with a faked state** (`tests/integration/play.test.ts:L292`, `L478`, `L639`)
   - **What this is:** Three `it.each` tables put the Game in *played* by a direct UPDATE (with no Teams and no play state) and check that start, reveal, undo and next Team return `WRONG_STATE`.
   - **Problem:** The test at `L1014` finishes a real Game and then checks every play operation and action, plus `play.load`, against it. That covers the same `lockForMutation` line with real data, so the three faked *played* cases add nothing. The epic-5 review found the same pattern.
   - **Fix:** Remove `"played"` from the three `it.each` arrays (the *ready* cases and the other states stay). Point any TRACE row that names them at `L1014`.
   - **If we skip it:** Nothing breaks. Four extra test runs that must stay green when the `gameIn` helper changes.

## Nice to have

4. **The "is this key for us" check is written twice** (`src/components/Board.tsx:L191-195`, `src/components/FullscreenKey.tsx:L12-17`)
   - **What this is:** Both listeners skip a key with Ctrl, Cmd or Alt, a repeat, or focus in a text field or the open overlay.
   - **Fix:** Export one `isShortcut(event)` from `FullscreenKey.tsx` and use it in both listeners. The selector `"input, textarea, select, [contenteditable], dialog"` then lives in one place.
   - **If we skip it:** If someone adds a new place where shortcuts must be ignored, `F` may keep working there while the other keys stop.

5. **Two almost identical revealed tiles** (`src/components/Board.tsx:L242-281`)
   - **What this is:** A scored and an unscored revealed tile are two separate 20-line `<div>` blocks. They share the `data-slot`, `data-revealing`, `tabIndex`, the rank span and the label span, and differ only in the outer colours and the Count part.
   - **Fix:** One `<div>` with the classes chosen by `slot.scored`, and only the Count part branched.
   - **If we skip it:** About 12 extra lines, and a change to the label (for example its wrap rule) must be made twice.

Verdict: Ship. Findings 1 to 3 are cheap cleanups worth doing before the PR. Findings 4 and 5 are optional.

Lean: -50 lines possible (about 15 in the Game page, 19 in the unit test, 4 in the key guard and 12 in the tiles).

Not checked: the full Vitest and Playwright runs (other reviewers share this working copy), the drizzle snapshots, the canvas on a real TV or projector, and how much `tests/e2e/play.spec.ts` overlaps with the page-render tests in `tests/integration/play.test.ts` beyond what the titles show.

## Epic 6 review fixes (2026-11-23)

Every finding was checked against the code before it was fixed. None was rejected.

**1. The Team score list written twice: fixed in `b064a13`.** `scoreList(teams)` in `src/app/spill/[id]/page.tsx` renders the `<dl>` for both the *playing* and the *played* branch.

**2. The unit test for `revealSchema`: fixed in `b064a13`.** `tests/unit/play.test.ts` is deleted. Its TRACE row is gone, and the FR-25 integration row now says that the missing, non-boolean and numeric inputs reach `revealSchema` through both `play.reveal` and the action.

**3. The faked *played* cases: fixed in `b064a13`.** `"played"` is removed from the three `it.each` arrays (start, reveal, and undo with next Team). The test that plays a real Game to the end checks every operation, action and `load`. The TRACE rows for FR-23, FR-25, FR-26 and FR-27 point there.

**4. The duplicated key guard: fixed in `19ca741`.** `isShortcut(event)` in `FullscreenKey.tsx` holds the modifier, repeat and text-field/overlay check, and both listeners use it. `F` still refuses Shift on its own, and the Board still lets Shift through for `?`.

**5. Two revealed tiles: fixed in `19ca741`.** One revealed `<div>` chooses its colours by `slot.scored` and branches only the Count part. That made the impeccable M1 fix (`min-w-0`, `30e855a`) a single class.

Result: the Vitest suite went from 734 tests (after the two stale-undo tests in `2afa998`) to 730 in `b064a13`, and ended at 731 after the S3 test in `b2ddea6`.
