# Story 8.5 ponytail review

Scope: `git diff origin/main...epic-8-vertsvisning` (Story 8.5: separate TV view and Host view with answer key, FR-24 to FR-27). Context: `spec-8-5-separate-tv-view-and-host-view-with-answer-key.md`. Assumed load: the pilot, a handful of Hosts at a time, each with at most one or two TV windows open, plus one examiner on one laptop and CI. Nothing was changed.

What this change does: Two new owner-only pages sit beside the unchanged `/spill/[id]/skjerm`. `/spill/[id]/tv` shows the room's Board on the same stage canvas with no controls, and `/spill/[id]/vert` is a light Host page with an answer key (every slot's label and Count), the Teams and the same moves as buttons and keys. The play logic moved out of `Board` into a shared `usePlay` hook, which posts `changed` or `bom` on a same-origin `BroadcastChannel` after each saved move; the TV page answers with `router.refresh()` and also polls every 2 s while visible.

I traced the three pages through `play-page.tsx` (one owner check through the cached `ownedGame`, then one state switch), the TV path (`PlayStage` → `play.load`, which still strips hidden slots, → `PlayView tv` → `TvBoard`), the Host view path (`play.answerKey` → `readPlay` → `review.getBoard`, never Answers), every caller of the moved code (`Board`, `HostPlay`, `TeamSetup`, `TvBoard`), the channel and poll in `useTvSync`, and `OpenTvLink`. I diffed the old `Board` body against `usePlay`: the move is verbatim except two `postToTv` lines, so `/skjerm` behaves as before.

Checked and found clean:

- **The refactor is the smallest way to get three views.** A hook is the plain React way to share stateful logic between two different layouts. The other option, a `view` prop on `Board`, would put a dark stage bar and a light Host page in one component. `play-page.tsx` takes the old `/skjerm` body almost unchanged and lets three 10-line pages share it, so the owner check and the state switch exist once. The hook returns 17 values, but each one is used by `Board` or `HostPlay`.
- **No duplicated logic between the three views.** `BoardTiles` and `BomPanel` are shared by `Board` and `TvBoard`, `ScoreList` by the Game page and the Host final standing, and `OpenTvLink` by the Game page and the Host view. `HostPlay` repeats the action row labels and the shortcut dialog markup from `Board`, but in different tokens (light Host page against the dark stage). The text of the shortcuts lives once in `SHORTCUTS`. Merging the two renderings would need a theme prop for one caller each, so the repeat is the cheaper choice.
- **`TvBoard`'s Bom timer** repeats four lines of `usePlay`'s `bom()`. A shared helper would be about as long as what it replaces.
- **Anonymity and AD-15 hold.** `readPlay` reads the Board only through `review.getBoard`, `load` still maps hidden slots to `{ id, position, revealed }`, and the TV gets only `load`'s output. The integration test checks the TV markup for every hidden label of this and later Questions, and the second-browser e2e fetches the full HTML with its RSC data before and after a Reveal.
- **Security.** Every page and `answerKey` go through `auth.requireHost` and `games.getOwned`. `authz.test.ts` covers Host B, a random UUID and `abc` on `answerKey`, `/tv` and `/vert`.
- **Load.** Each open, visible TV page re-renders about every 2 s (one session read, two owner reads and five play reads). That is fine for the pilot and stops on its own when the Game is *played* or the TV window is hidden.
- **New `shortcut:` comments:** one, in `TvBoard.tsx` (Bom does not reach a TV on another device). It names its limit and when to upgrade, so it is a decision, not a finding. See finding 2 for where it sits.
- **Dead code and AI leftovers:** no commented-out code, debug output, `.only`, `.skip` or `TODO` in the diff. Every new export has a caller.
- **Test size against what the tests prove.** The four e2e tests (263 lines) each prove an acceptance criterion that only a real browser can prove: the channel (with the TV page reported hidden so the poll cannot cover for it), polling from a second context, dead keys and F on the TV, the popup reuse, the 48 px sizes and axe. The `/tv` and `/vert` render tests prove AC1 to AC3. Only the overlap in finding 1 is extra.

## Must fix

None.

## Should fix

1. **The not-found and load checks are proven twice** (`tests/integration/play.test.ts:L377-385, L394-400, L1067-1068, L1128-1129`)
   - **What this is:** The `play.answerKey` tests and the `/tv` and `/vert` page tests also check foreign, random and malformed ids, and re-check values that `play.load` already returns.
   - **Problem:** `authz.test.ts:L680-709` already gives `NOT_FOUND` for `play.answerKey`, `TvPage` and `HostViewPage` with a foreign Game, a random UUID and `abc`. The three page loops in `play.test.ts` run the same `ownedGame` call. In the first `answerKey` test, line 375 already proves `answerKey` equals `play.load` apart from the board, so the `toMatchObject` and Team checks at L377-385 re-test `load`, which has its own tests for Question, total, Scores and `lastReveal`.
   - **Fix:** Delete L377-385, the `live` Game and NOT_FOUND loop at L394-400 (rename the test to the two WRONG_STATE cases), and the two `missing` loops at L1067-1068 and L1128-1129. Update the FR-23 and FR-24 bullets in `tests/TRACE.md` so they point to `authz.test.ts` for the not-found cases.
   - **If we skip it:** Nothing breaks. About 20 lines that must change with the owner rule or the play read, for no extra proof.

## Nice to have

2. **The `shortcut:` comment sits on the wrong line** (`src/components/TvBoard.tsx:L34`)
   - **What this is:** The comment says Bom is not saved, so a TV on another device misses it.
   - **Fix:** Move it two lines up, above `if (data !== "bom") return;`, where Bom is handled. It now sits above the poll, which a reader takes as the shortcut.
   - **If we skip it:** `ponytail-debt` points to the poll, and the next person looks at the wrong code.

Verdict: Ship. Finding 1 is a test cleanup worth doing before the PR. Finding 2 is optional.

Lean: -20 lines possible (all in duplicated integration checks).

Not checked: the Vitest and Playwright runs (other reviewers share this working copy), the TV page on a real TV and a second device, and how robust the e2e hydration wait on React's internal `__reactFiber` key is across React upgrades.

## Fixes

Fix round on 2026-11-24, on `epic-8-vertsvisning`. Both findings were checked and accepted.

1. **Fixed** in `0348bf8`. `authz.test.ts` already covers a foreign Game, a random UUID and `abc` for `play.answerKey`, `TvPage` and `HostViewPage`. The answerKey test's `toMatchObject` and Team checks, the `live` NOT_FOUND loop and the two `missing` loops in the `/tv` and `/vert` page tests were deleted. The tests were renamed, and the FR-23 and FR-24 bullets in `tests/TRACE.md` now point to `authz.test.ts`. The `/tv` metadata test still checks the not-found title.
2. **Fixed** in `eaf2527`. The `shortcut:` comment about Bom now sits above `if (data !== "bom") return;`. The poll has its own `shortcut:` comment now, about the 10-minute idle stop added in `4961856` after the bmad review.
