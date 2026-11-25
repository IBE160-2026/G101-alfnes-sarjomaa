# Story 8.6 ponytail review

Scope: `git diff origin/main...epic-8-to-skjermer` (Story 8.6: play needs two views; the one-screen stage is removed). Context: `spec-8-6-play-needs-two-views-host-view-and-tv-view.md`. Assumed load: the pilot, a handful of Hosts at a time, each with one Host view and one or two TV windows open, plus one examiner on one laptop and CI. Nothing was changed.

What this change does: The one-screen stage at `/spill/[id]/skjerm` is gone, and the path now only redirects to the Game page. Team setup moved to its own Host page, `/spill/[id]/lag`, and a successful start sends the Host to the Game page, which links the Host view (primary) and the TV page (secondary). In *ready* the TV page shows a waiting screen that follows into play over the existing channel and poll, and the Host view redirects to `/lag`. `Board.tsx` is deleted; the TV's tiles and Bom panel moved into `TvBoard.tsx`, and the stage-only state left `usePlay`, `FullscreenKey`, `PlayView` and `TeamSetup`.

I traced the state switch in `play-page.tsx` for `lag`, `tv` and `vert` in every Game state, the start flow (`TeamSetup` → `startPlay` → `postToTv("changed")` → `router.replace` → `RouteFocus`), the waiting TV (`TvWaiting` → `TvRefresh` → `useTvSync`), the `/skjerm` redirect, and every caller of what the change removed or moved. I grepped `src/` for each export, prop, CSS class and design token the stage used, and compared the e2e and integration tests that moved from `/skjerm` with the tests already on `/vert` and `/tv`.

Checked and found clean:

- **No leftover code from the stage.** `Board`, `BoardTiles`'s button branch, `listRef`, `pendingSlot` and `unscored` props, the stage `?` dialog, the visible F hint, `miss`/`missTimer` in `usePlay`, the `tv` props on `PlayView`, `FinalScores` and `PlayStage`, the `HOST_SHORTCUTS` filter, `visible()` and `screen()` in the tests, and the export of `focusPageHeading` are all gone. Every remaining export has a caller: `FocusOnMount` (the Host view's final standing), `StageLoading`, `TvRefresh` (`TvWaiting`), `isShortcut` (`usePlay` and `FullscreenKey`), `SHORTCUTS` (`HostPlay`). `clicked` in `usePlay` still drives the pending state of the Host view's Avslør buttons, and its resets in `undo` and on failure are still needed. `globals.css` is unchanged, and every stage token and class it defines (`stage-accent`, `stage-tile`, `count-badge`, `score-count`, `bom-panel`, `[data-revealing]` and the rest) is still used by `PlayView` or `TvBoard`.
- **The new pages are as small as they can be.** `lag/page.tsx` is 10 lines and mirrors `tv/page.tsx`, so the owner check and the state switch still exist once in `play-page.tsx`. `skjerm/page.tsx` is a three-line redirect. `TvWaiting` is a heading, a sentence, `TvRefresh` and `FullscreenKey` on the existing stage classes. Moving `BoardTiles` and `BomPanel` into `TvBoard.tsx` and making them private removed four props that only the stage used.
- **Correctness.** `/lag` redirects every state but *ready* to the Game page, `/vert` in *ready* redirects to `/lag`, and `/tv` in *ready* shows the waiting screen. `/tv` and `/vert` in *draft* to *in_review* still fall through to the Game page redirect. The start posts `changed` only after the server has saved it, so a waiting TV never refreshes too early. The `/skjerm` redirect skips the owner check, but it reveals nothing and lands on the Game page, which does the check; the id is URL-encoded, so it cannot leave `/spill/`.
- **Anonymity and AD-15 hold.** The waiting screen shows only the Game title. The TV still gets only `play.load`'s output, where hidden slots carry no label or Count, and the FR-24 (AC2) integration test now runs on `/tv`.
- **Security.** `/lag`, `/tv` and `/vert` go through `auth.requireHost` and `games.getOwned`. `authz.test.ts` now covers `/lag` for a foreign Game, a random UUID and `abc`.
- **New `shortcut:` comments:** one, at `TvRefresh` (a waiting TV on another device rests after `TV_IDLE_MS`). It names its limit and when to upgrade, so it is a decision, not a finding.
- **Dead code and AI leftovers:** no commented-out code, debug output, `.only`, `.skip` or `TODO` in the diff.

## Must fix

None.

## Should fix

1. **The TV sync e2e test repeats moves that `play.spec.ts` now proves** (`tests/e2e/tv.spec.ts:L108-L122, L127-L153`)
   - **What this is:** The first `tv.spec.ts` test opens the TV page reported hidden, so only the `BroadcastChannel` message (a same-browser message between tabs) can move it. It then runs every play move on the Host view and checks the TV after each one.
   - **Problem:** Before this story, `play.spec.ts` drove the stage, so this test was the only one that ran the moves on `/vert`. Now `play.spec.ts` drives `/vert` and reads `/tv` too: Angre by `z` and by its button with focus (L635-L676), Neste lag by key and button (L681, L739), the unscored Reveal (L692-L703) and the Bom panel leaving after 1.5 s (L602-L620). Every saved move posts the same `changed` message from one place, `run()` in `usePlay.ts`, so one Reveal proves the channel for all of them.
   - **Fix:** Keep the waiting screen and start, the Reveal by button and by key, one Bom press, the walk through the Questions and Sluttstilling (it holds the only check that the TV does not focus its heading). Delete the Angre block (L108-L122), the Bom-leaves and Bom-button lines (L127-L130), and the Neste lag and unscored blocks (L132-L153). Shorten the test title to match.
   - **If we skip it:** Nothing breaks. About 40 lines of slow browser steps must change with every Host view label, and the suite runs longer.

2. **The new axe test repeats checks made elsewhere** (`tests/e2e/tv.spec.ts:L360-L371`)
   - **What this is:** The last `tv.spec.ts` test runs axe (an automated accessibility checker) on the waiting TV, `/lag` and the playing Game page, then checks the `/lag` and `/skjerm` redirects.
   - **Problem:** The first `play.spec.ts` test already runs axe on `/lag` (after the name errors) and on the playing Game page, and checks that `/lag` redirects a Game that is not ready. The `/lag` and `/skjerm` redirects and the two-window line are proven in `tests/integration/play.test.ts` (the `/spill/[id]/lag` and `/spill/[id]/skjerm` blocks, and the Game page test). Only the waiting TV's axe run and its F key are new.
   - **Fix:** Keep the test up to the F loop and delete L360-L371. Rename it to the waiting TV page, and point the AC6 bullet in `tests/TRACE.md` to `play.spec.ts` for `/lag` and the Game page.
   - **If we skip it:** Nothing breaks. About 12 lines that prove nothing new and start a second Game in the browser.

3. **The TV's Sluttstilling is checked twice in the integration tests** (`tests/integration/play.test.ts:L1046-L1052`)
   - **What this is:** The `/tv` test for *draft* and *played* also renders a finished Game's TV page and checks its heading and that no Host text is on it.
   - **Problem:** The "Sluttstilling (AC3)" test now renders the same TV page and checks the heading and the whole visible text with `toBe`, which already proves there is no deletion line, no "Tilbake til spillet" and no "Trykk F". The tie test checks "Uavgjort" on the TV too.
   - **Fix:** Delete the `played` part (L1046-L1052) and rename the test to the *draft* redirect and the title.
   - **If we skip it:** Nothing breaks. About 8 lines to keep in step with the TV's final markup.

## Nice to have

4. **Comments still describe the stage** (`src/app/globals.css:L151, L196`; `src/components/RouteFocus.tsx:L15-L16`; `src/components/usePlay.ts:L99, L111`)
   - **What this is:** Comments on the Reveal animation, the Bom panel, `FocusOnMount` and `clicked`.
   - **Problem:** `globals.css` says `Board.tsx` removes the Bom panel and that only "the tile this tab revealed" animates; the TV now animates every new Reveal and `TvBoard.tsx` removes the panel. `FocusOnMount` says "the Board and its live region unmount", but its only caller is the Host view's final standing. The two `usePlay` comments say `clicked` controls the animation; it now only marks the pending Avslør button.
   - **Fix:** Reword the five comments to name `TvBoard.tsx`, the Host view and the pending button. No code changes.
   - **If we skip it:** The next reader looks for `Board.tsx` and for an animation that `clicked` no longer drives.

5. **Two e2e files keep their own copies of the same helpers** (`tests/e2e/tv.spec.ts:L34, L49, L75-L79, L216-L220, L347-L351`; `tests/e2e/play.spec.ts:L18-L25, L36, L285`)
   - **What this is:** The wait for React to take over the page (`__react` keys), the answer-key rows `keyRows` and `fontSize`.
   - **Problem:** `play.spec.ts` now has a `hydrated()` helper, but `tv.spec.ts` writes the same `waitForFunction` inline three times. `keyRows` and `fontSize` are defined in both files.
   - **Fix:** Move `hydrated` and `keyRows` to `tests/e2e/fixtures.ts`, which both files already import, and use `hydrated` in `tv.spec.ts`.
   - **If we skip it:** A change to React's internal key names must be fixed in four places instead of one.

Verdict: Ship. Findings 1 to 3 are test cleanups worth doing before the PR. Findings 4 and 5 are optional.

Lean: -70 lines possible (about 60 in duplicated tests, about 10 in duplicated test helpers).

Not checked: the Vitest and Playwright runs (other reviewers share this working copy), and a waiting TV on a second real device.
