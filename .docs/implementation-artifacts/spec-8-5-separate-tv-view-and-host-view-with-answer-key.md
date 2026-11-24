---
title: 'Story 8.5: Separate TV view and host view with answer key'
type: 'feature'
created: '2026-11-24'
status: 'done'
baseline_revision: '7f5d408f1b576a7ee456e36fa2395fbd1a27e608'
review_loop_iteration: 0
followup_review_recommended: true
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

### 2026-11-24 — Review pass
- verdicts: 42 findings — high 0, medium 9, low 28, false 5, maybe-false 0 (20 patched, 22 rejected, 0 deferred)
- findings:
  - `[medium]` `[patch]` (intent) TV page in *ready* shows Team setup but never follows a start made on /vert — fixed: `TvRefresh` (shared `useTvSync`) mounted beside Team setup on /tv, and Team setup posts `changed` after a successful start; e2e starts with the TV on Team setup.
  - `[low]` `[patch]` (intent) sync from /skjerm to /tv untested — fixed: AC6 e2e presses "2" on /skjerm and sees it on the open TV within 1.5 s.
  - `[false]` `[reject]` (intent) 1 s in Behaviour vs 1.5 s in tests — the intent's Tests section sets 1.5 s, which is what the e2e asserts.
  - `[low]` `[reject]` (intent) other-device e2e allows 3 s against "about 2 s" — the bound is the 2 s poll plus one render; 3 s is that bound with margin, not a looser promise.
  - `[medium]` `[patch]` (intent) /vert keyboard path barely exercised — fixed: AC4 drives z, m, t, n and → on /vert besides the buttons.
  - `[medium]` `[patch]` (intent) uten-poeng toggle on /vert never used — fixed: AC4 toggles it, reveals, checks "Uten poeng", unchanged Scores and the TV tile.
  - `[low]` `[patch]` (intent) "Åpne TV-visning" never clicked — fixed: AC6 takes the popup and checks it lands on /tv.
  - `[low]` `[reject]` (intent) refresh RSC responses not fetched separately — every refresh re-runs `play.load`, which strips hidden slots; the e2e fetches the full HTML with inline RSC data before and after a reveal.
  - `[false]` `[reject]` (intent) /skjerm refactored and now posts channel messages — the intent asks for /skjerm moves to reach the TV; its tests are unchanged and pass.
  - `[low]` `[patch]` (intent) axe on /vert in one state only — fixed: also with the shortcut dialog open and uten poeng pressed.
  - `[low]` `[patch]` (intent) sprint-status still in-progress — set to done at finalize.
  - `[medium]` `[patch]` (verification-gap) focus after Reveal/Angre on /vert untested — fixed: AC4 asserts the revealed row and then "Avslør plass 3" are focused.
  - `[medium]` `[patch]` (verification-gap) same-browser sync test cannot tell the channel from the poll — fixed: the TV page reports itself hidden (init script), so its poll never refreshes and only the channel can move it; a fake clock also froze React's Suspense reveal, so it was not used.
  - `[medium]` `[patch]` (verification-gap) uten-poeng toggle unused — same fix as the intent row above.
  - `[medium]` `[patch]` (verification-gap) TV in *ready* does not follow the start — same fix as the first row.
  - `[low]` `[patch]` (verification-gap) OpenTvLink not clicked — same fix as above.
  - `[medium]` `[patch]` (blind) TV stuck on Team setup — same fix as the first row.
  - `[low]` `[reject]` (blind) TV in *ready* shows the Host's form to the room — the intent says a *ready* Game "shows the team-setup path as now" on both pages.
  - `[low]` `[reject]` (blind) no way into two-page mode before play starts — the intent puts the links in *playing*; a Host starts on /skjerm or the Game page and switches; adding links in *ready* is new UI nobody asked for.
  - `[low]` `[reject]` (blind) /vert does not follow other tabs — not asked for; a stale move refreshes the page through the existing STALE path.
  - `[low]` `[patch]` (blind) README and manual checklist not updated — fixed: two README sentences and a checklist note for A1, A7, A8, A9 on /tv.
  - `[low]` `[reject]` (blind) group decision not logged in the wiki — the intent forbids touching wiki/.
  - `[low]` `[patch]` (blind) status fields disagree and epic-8-context line 15 stale — fixed: context line updated; status set at finalize.
  - `[low]` `[reject]` (blind) 3 s vs about 2 s, no refresh on visibilitychange — the TV window is visible in use; the bound is poll plus render.
  - `[false]` `[reject]` (blind) Score check can pass trivially — the first Question's top Count is 43, which the TV card cannot show before the update ("0").
  - `[low]` `[patch]` (blind) all three pages share one title — fixed: "TV – {tittel}" and "Vertsvisning – {tittel}", /skjerm unchanged, EXPERIENCE.md updated.
  - `[low]` `[patch]` (blind) literal U+00A0 in the Bom text — fixed: `"Bom.\u00a0"` escape restored.
  - `[low]` `[reject]` (blind) poll load on the pilot not assessed — the intent sets the 2 s poll; it runs only while a TV page is open and visible.
  - `[low]` `[reject]` (blind) account risk of a logged-in TV on another device — the intent decides "a TV on another logged-in device" and owner-only pages.
  - `[low]` `[patch]` (blind) AC4 title claims NFR-5 but asserts 1.5 s — fixed: NFR-5 dropped from the title.
  - `[medium]` `[patch]` (edge) TV in *ready* not following the start — same fix as the first row.
  - `[low]` `[reject]` (edge) `post` throws without BroadcastChannel — every supported browser has it (Safari 15.4+); a guard adds branches for a case nobody meets.
  - `[low]` `[reject]` (edge) a failed poll refresh hands the TV to error.tsx and stops polling — same as any page's refresh on a server error; a local boundary adds complexity for a rare transient failure.
  - `[low]` `[reject]` (edge) TvBoard effect throws without BroadcastChannel — same reason as above.
  - `[low]` `[reject]` (edge) lost response after a saved move posts nothing — the poll shows it within 2 s and the host view shows "Mistet forbindelsen."
  - `[low]` `[reject]` (edge) stale state up to 2 s after the TV becomes visible — the TV window stays visible in use.
  - `[low]` `[reject]` (edge) overlapping refreshes on a slow server — router.refresh supersedes the earlier one; a guard is complexity for a cold start.
  - `[low]` `[reject]` (edge) undo then re-reveal of the same slot between two TV renders skips the animation — the channel refreshes after each move, so both renders happen; rare and cosmetic.
  - `[low]` `[reject]` (edge) Ctrl/Cmd/Shift-click opens a popup — rare on this button; the popup is still the TV page.
  - `[low]` `[patch]` (edge) a second click reloads the TV window and drops fullscreen — fixed: open the named window without a URL, navigate only if it is not already on this /tv, then focus.
  - `[false]` `[reject]` (edge, claim) /skjerm now breaks without BroadcastChannel — the stage already needed modern browsers; see the guard row above.
  - `[false]` `[reject]` (edge, claim) a committed move whose response is lost is never posted — the claim holds but is covered by the poll; recorded above as a rejected low.

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

## Auto Run Result

Status: done

**Summary.** Two owner-only play pages beside the unchanged `/spill/[id]/skjerm`: `/spill/[id]/tv` (the room's Board on the stage canvas, no controls, only F) and `/spill/[id]/vert` (answer key with every slot's label and Count, Teams and Scores, the same moves as buttons and shortcuts, "Åpne TV-visning"). The client play logic moved from `Board` to `usePlay`, shared by both control pages. After every saved move and on Bom, the hook posts on the `BroadcastChannel` `toppsvar-spill-{gameId}`; the TV answers by re-reading saved state and also polls every 2 s while visible. No migration, no new action, no change to `play`'s mutations.

**Files.**
- `src/server/play/index.ts` -- `readPlay` shared by `load` (hidden slots stripped) and the new `answerKey`.
- `src/lib/play.ts`, `src/lib/limits.ts` -- `playChannel`, `PlayMessage`, `TV_POLL_MS`.
- `src/components/usePlay.ts` -- play moves, shortcuts, focus, `postToTv`.
- `src/components/Board.tsx` -- stage rendering on the hook; exports `BoardTiles`, `BomPanel`.
- `src/components/TvBoard.tsx` -- `useTvSync`, `TvRefresh`, `TvBoard` (new-reveal animation, Bom, hidden F key).
- `src/components/HostPlay.tsx`, `OpenTvLink.tsx`, `ScoreList.tsx` -- host view, reusable TV window link, shared score list.
- `src/components/PlayView.tsx` -- `tv` variants of the stage and Sluttstilling.
- `src/components/TeamSetup.tsx` -- posts `changed` after a successful start.
- `src/app/spill/[id]/play-page.tsx`, `skjerm|tv|vert/page.tsx` -- one state switch and titles.
- `src/app/spill/[id]/page.tsx` -- "Åpne TV-visning" and "Vertsvisning med fasit" in *playing*.
- Tests: `tests/integration/play.test.ts`, `tests/integration/authz.test.ts`, `tests/e2e/tv.spec.ts`, `tests/TRACE.md`, `tests/manual/checklist.md`.
- Docs: PRD (FR-24 to FR-27, §11) and `PRD.md`, EXPERIENCE.md, DESIGN.md, ARCHITECTURE-SPINE.md (AD-15, AD-16, AD-17, routes, limits), epics.md, sprint-status, README.

**Review.** 42 findings: 20 patched (9 medium, 11 low rows; several rows share one root cause), 0 deferred, 22 rejected with reasons in the triage log. Follow-up review recommended: true. Patched at medium: 9 rows over 4 root causes (TV in *ready*, focus test, toggle test, channel-vs-poll test). The unverified risk: the patches themselves (`TvRefresh` beside Team setup, the reused TV window in `OpenTvLink`, the hidden-document trick in the e2e) were not seen by a fresh reviewer.

**Verification.** Before every commit: `npx prettier --check .`, `npm run lint`, `npm run typecheck`, `npm run test` (831 passed, 1 skipped). `npm run test:e2e` with a scratch config that moves the dev server off port 3101 (to 3105): 102 of 104 passed, the 2 failures were the `next dev` specs (`demo.spec.ts`, `server-output.spec.ts`, a navigation during cold compile); both passed on a rerun. The TV specs were also run 8 times in a row by the implementer. Screenshots of `/tv` at 1920×1080 and `/vert` at 1280×800 were inspected.

**Residual risks.** A TV on another device does not show Bom (not saved; `shortcut:` in `TvBoard.tsx`). `/vert` re-renders after a move because Next re-renders the calling page on any `revalidatePath`, not because the actions name `/vert`. Whether the SM-1 gate applies to 8.5 is the group's call (recorded as started before SM-1).
