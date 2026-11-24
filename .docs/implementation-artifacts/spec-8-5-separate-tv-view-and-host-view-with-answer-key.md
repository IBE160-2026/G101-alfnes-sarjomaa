---
title: 'Story 8.5: Separate TV view and host view with answer key'
type: 'feature'
created: '2026-11-24'
status: 'in-progress'
baseline_revision: '7f5d408f1b576a7ee456e36fa2395fbd1a27e608'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Play assumes the TV mirrors the laptop, so the room sees the control bar and the Host has no answer key. After testing the pilot (2026-11-24) the group asked for an extended-display mode: the Board on the TV, the answer key, Scores and controls on the laptop (EXPERIENCE.md Open Question 4).

**Approach:** Two new owner-only routes beside the unchanged `/spill/[id]/skjerm`. `/spill/[id]/tv` renders the same stage canvas with a controls-free Board. `/spill/[id]/vert` is a Host page with every slot's label and Count and the same play actions and shortcuts. The client play logic moves out of `Board` into one hook shared by the stage and the host view. The hook posts to a same-origin `BroadcastChannel` after every saved move and on Bom; the TV refreshes on a message and also polls every 2 s while visible. The server actions and `play` module are reused; only a read for the answer key is added.

## Boundaries & Constraints

**Always:**
- `/skjerm` looks and behaves exactly as before (its e2e and integration tests pass unchanged).
- Both new pages: `auth.requireHost` + `games.getOwned` (AD-5), missing, foreign and malformed ids → not-found, title = Game title. *ready* → Team setup as on `/skjerm`; *playing* → the view; *played* → Sluttstilling on `/tv`, final standing on `/vert`; any other state → redirect to the Game page.
- The TV's HTML/RSC payload never carries a hidden slot's label or Count: it renders from `play.load` (hidden slots already stripped).
- The answer key reads only `board_slot` label and Count through `review.getBoard` (AD-15), never Answers.
- Moves go through the existing actions (`revealSlot`, `undoReveal`, `passTurn`, `nextQuestion`) with their stale-tab protections (`lastReveal`, `position`, `STALE` refresh).
- TV: no control bar, no shortcut hint or overlay, no buttons; only `F` (fullscreen) is a key. Same 1920×1080 canvas, grid and stage tokens; reveal animation and score count-up for slots that became revealed since the last render; Bom panel on a channel message.
- Host view: Host-page tokens (light), usable at 1280 px, WCAG 2.1 AA, axe clean, keyboard and buttons for every action, a visible polite status line.
- Bokmål copy, "du" form, no exclamation marks. Ponytail `full`; impeccable Operate mode.
- No migration, no new table, no new route handler, no websockets.

**Never:**
- No change to `play`'s mutations, schemas, error codes or the Score.
- No duplicated play logic between stage and host view.
- No unscored-mode preview on the TV (the toggle is the Host's; the TV shows the result).
- No TV access without the Host's login.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reveal on /vert | slot 2 hidden, TV open in same browser | TV shows label + Count with the reveal animation and the Score within 1.5 s | stale → refresh, as stage |
| Bom on /vert | any | TV shows the Bom panel for 1.5 s; nothing saved | — |
| Next spørsmål on last Question | /vert | /vert shows final standing; TV shows Sluttstilling | WRONG_QUESTION → refresh |
| TV on another device | logged in as the Host | follows within ~2 s by polling (Bom not shown: not saved) | poll paused while hidden |
| Keys on /tv | 1, m, z, t, u, n, →, ? | nothing happens; F toggles fullscreen | — |
| Foreign Game | /tv or /vert of another Host | not-found page | — |

</intent-contract>

## Code Map

- `src/app/spill/[id]/skjerm/page.tsx` -- owner/state switch (ready → `TeamSetup`, played → `FinalScores`, else redirect, playing → `PlayView` behind `Suspense`/`StageLoading`); move its body into a shared `playPage(id, view)` so three pages share one switch.
- `src/components/Board.tsx` -- stage tiles + control bar + all client play logic (`run`, `reveal`, `undo`, `nextTeam`, `next`, `bom`, `toggleUnscored`, shortcuts, focus refs, `STALE`). Logic → `usePlay`; tile list → exported `BoardTiles` reused by the TV.
- `src/components/PlayView.tsx` -- `PlayView` (canvas + Team column + `Board`), `FinalScores` (footer with deletion date, F hint, link), `StageLoading`. Add a `tv` variant to both.
- `src/components/FullscreenKey.tsx` -- `isShortcut`, `FullscreenKey`; mounted with `className="hidden"` keeps F with no hint (Board already does this under its banner).
- `src/server/play/index.ts` -- `load` builds `PlayView` with hidden slots stripped; add `answerKey` from the same read (labels and Counts for every slot).
- `src/app/spill/[id]/actions.ts` -- play actions; any `revalidatePath` makes Next re-render the calling page (`action-handler.js` `pathWasRevalidated`), so `/vert` needs no change here.
- `src/app/spill/[id]/page.tsx` -- *playing* panel with "Fortsett spillet" (add two links); `scoreList` reused by the host final standing → `src/components/ScoreList.tsx`.
- `src/lib/play.ts`, `src/lib/limits.ts` -- shared client/server constants (channel name, poll interval; cf. `GROUPING_POLL_MS`).
- `src/app/globals.css` -- `.stage-canvas`, `[data-revealing]`, `.score-count`, `.bom-panel`; reused unchanged.
- `tests/integration/play.test.ts` -- `gameIn`, `playing`, `prerender`, `props`, `text` helpers and the `/skjerm` page tests to mirror.
- `tests/e2e/question-sets.spec.ts` -- fastest path to a *ready* Game (question-set select) for the e2e.
- `tests/e2e/fixtures.ts` -- `registerHost`, `seriousViolations`.

## Tasks & Acceptance

**Execution:**
- Docs -- PRD §4.7 FR-24 to FR-27 amendment + §11 entry, `./scripts/sync-brief.sh`; EXPERIENCE.md (route table, play rules, platform row, Open Question 4), DESIGN.md (host view + TV notes); spine (AD-15 play reads, AD-16 reload, AD-17 polling + BroadcastChannel, routes row); epics.md Story 8.5; sprint-status.
- `src/server/play/index.ts` -- add `answerKey(hostId, gameId)` and `AnswerKey` type sharing `load`'s read.
- `src/lib/play.ts`, `src/lib/limits.ts` -- `playChannel(gameId)`, `TV_POLL_MS = 2_000`.
- `src/components/usePlay.ts` -- hook extracted from `Board`, plus channel posts (`changed` after an ok move, `bom`).
- `src/components/Board.tsx` -- use the hook; export `BoardTiles`.
- `src/components/TvBoard.tsx` -- `BoardTiles` without buttons; channel listener, visible-only poll, newly-revealed animation, Bom panel, hidden `FullscreenKey`.
- `src/components/PlayView.tsx` -- `tv` flag on `PlayView` and `FinalScores`.
- `src/components/HostPlay.tsx`, `src/components/OpenTvLink.tsx`, `src/components/ScoreList.tsx` -- host view, new-window TV link, shared score list.
- `src/app/spill/[id]/play-page.tsx`, `skjerm/page.tsx`, `tv/page.tsx`, `vert/page.tsx` -- shared switch and the three pages.
- `src/app/spill/[id]/page.tsx` -- links "Åpne TV-visning" and "Vertsvisning med fasit" in *playing*.
- `tests/integration/play.test.ts`, `tests/e2e/tv.spec.ts`, `tests/TRACE.md` -- proofs below.

**Acceptance Criteria:**
- Given a playing Game with one revealed slot, when `/tv` is rendered, then it shows the Question, the revealed label and Count, the Teams and Scores and rank-only hidden tiles, no control text, and no hidden label or Count anywhere in the markup (integration).
- Given the same Game, when `play.answerKey` runs or `/vert` is rendered, then every slot's label and Count is present with its revealed/hidden state, the Teams, Scores and "Spørsmål N av M" (integration).
- Given another Host's or a missing Game, when `/tv` or `/vert` loads or `answerKey` runs, then it is not-found; given *ready*, Team setup; given *draft*, a redirect; given *played*, Sluttstilling on `/tv` (no deletion line, no link) and the final standing on `/vert` (integration).
- Given `/vert` and `/tv` open in one browser context, when the Host reveals (button and key), Bom, Angre, Neste lag and Neste spørsmål through to Vis sluttstilling, then `/tv` shows each result within 1.5 s, including the Bom panel and Sluttstilling (e2e).
- Given `/tv`, when 1, m, z, t, u, n, →, ? are pressed, then nothing changes and there is no button; F toggles fullscreen (e2e).
- Given `/tv` at 1920×1080 and `/vert` at 1280×800, then the canvas fills the window with labels and Scores ≥ 48 px, and axe finds no serious violation on either (e2e).
- Given a playing Game page, then it links "Fortsett spillet", "Åpne TV-visning" and "Vertsvisning med fasit" (integration).

## Spec Change Log

## Review Triage Log

## Design Notes

- **Sync.** Channel name `toppsvar-spill-{gameId}`; messages `"changed"` and `"bom"`. A channel never delivers to its own sender, so the posting page does not refresh twice. The TV answers `"changed"` with `router.refresh()`; the poll is `setInterval(TV_POLL_MS)` that refreshes only when `document.visibilityState === "visible"`. Bom is not saved, so a TV on another device misses it (`shortcut:` comment).
- **Animation on the TV.** Keep the previous render's revealed ids per Question in state; ids revealed now and hidden before get `data-revealing` until the revealed set changes again, so a poll mid-animation does not cut it.
- **Host view layout.** `data-wide` two columns at ≥1024 px: left the Question (`h1`, display), "Spørsmål N av M", the answer key list, the action row and the status line; right the Teams (current Team on `primary-soft` with the word "Svarer nå"), "Åpne TV-visning" and "Trykk F i TV-vinduet for fullskjerm.". A hidden row has a secondary "Avslør" button (name "Avslør plass N"); a revealed row shows the word "Avslørt" (success) or "Uten poeng" (muted) and takes focus after a reveal, as the stage tile does.

## Verification

**Commands:**
- `npx prettier --check . && npm run lint && npm run typecheck && npm run test` -- green before every commit.
- `npm run test:e2e` -- green at the end (port not 3000/3101/3200).

**Manual checks (if no CLI):**
- Screenshots of `/tv` at 1920×1080 and `/vert` at 1280×800 look like the stage and a Host page.
