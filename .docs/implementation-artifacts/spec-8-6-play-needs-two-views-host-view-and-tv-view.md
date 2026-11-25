---
title: 'Story 8.6: Play needs two views: host view and TV view'
type: 'feature'
created: '2026-11-25'
status: 'done'
baseline_revision: '87638b6ec13b4b9c59a66becdc6e1e4d855ce583'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Testing Story 8.5 on the pilot (2026-11-25), the Host found the one-screen stage `/spill/[id]/skjerm` useless, because the answer key is not there, and "Start spillet" lands straight in it. The group decided (wiki/prosjekt/beslutninger.md, 2026-11-25) that play always uses two views.

**Approach:** Remove the stage and "Fortsett spillet". Team setup moves to its own Host page `/spill/[id]/lag`; after a successful start the Host goes to the Game page, which offers "Vertsvisning med fasit" (primary) and "Åpne TV-visning" (secondary). `/skjerm` only redirects to `/spill/[id]`. `/tv` in *ready* shows a waiting screen that follows into play over the existing channel and poll; `/vert` in *ready* redirects to `/lag`. Delete everything only the stage used; move its e2e coverage to `/vert` + `/tv`.

## Boundaries & Constraints

**Always:**
- `/lag`, `/tv`, `/vert`: `auth.requireHost` + `games.getOwned` (AD-5); missing, foreign and malformed ids → not-found.
- `/lag`: *ready* → the existing `TeamSetup` (same form, validation, copy) on a light Host page with Host chrome; any other state → redirect to `/spill/[id]`.
- `/tv`: *ready* → waiting screen on the stage canvas (Game title + "Spillet starter snart", no form, no button, only `F`), moving into play on a channel `changed` or a poll; *playing* and *played* unchanged. Never shows the Team setup form.
- `/vert`: *ready* → redirect to `/spill/[id]/lag`; *playing* and *played* unchanged.
- Game page: *ready* "Start spillet" → `/lag`; *playing* "Spillet er i gang", "Spørsmål N av M.", Scores, "Vertsvisning med fasit" (primary), "Åpne TV-visning" (secondary), one line saying play needs two windows or two devices, and the existing mirroring warning; *played* the TV link instead of the `/skjerm` link.
- `/skjerm` → `redirect("/spill/[id]")` for any id; no stage content.
- All `play` server logic and its tests stay; no change to `play`'s mutations, reads, schemas or error codes.
- Every FR-24 to FR-27 acceptance criterion keeps a test; `tests/TRACE.md` bullets name real tests; `trace.test.ts` passes. axe on the new or changed pages.
- Bokmål, "du" form, no exclamation marks, short copy. Ponytail `full`; impeccable Operate mode; WCAG 2.1 AA.

**Never:**
- No new route handler, migration, table, websocket or token access.
- No Team setup on `/tv`; no controls on `/tv`.
- No keeping dead code "for later": stage control bar, stage `?` overlay, visible fullscreen hint, stage-only `usePlay` state go.
- Do not touch `.logs/`, `wiki/`, `refleksjonsrapport.md`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start from `/lag` | *ready*, valid names | Host on `/spill/[id]` "Spillet er i gang"; a waiting `/tv` in the same browser shows Question 1 within 1.5 s | network loss → refresh; started anyway → `/lag` redirects to the Game page |
| Start twice | second tab, Game already *playing* | "Spillet har allerede startet. Gå til spillet" as now | — |
| `/lag` later | *playing*, *played*, *draft* | redirect to `/spill/[id]` | — |
| `/vert` early | *ready* | redirect to `/spill/[id]/lag` | — |
| Old bookmark | `/spill/[id]/skjerm`, any state or id | redirect to `/spill/[id]` (which owns not-found) | — |
| TV on another device | waiting screen | follows into play on the next 2 s poll | poll rests after `TV_IDLE_MS` until focus |

</intent-contract>

## Code Map

- `src/app/spill/[id]/play-page.tsx` -- one state switch for the play pages (`View`, `TITLE_PREFIX`, `playMetadata`, `playPage`, `PlayStage`, `HostFinal`). Becomes `"lag" | "tv" | "vert"`; *ready* branch splits per view.
- `src/app/spill/[id]/skjerm/page.tsx` -- becomes a redirect page. New `src/app/spill/[id]/lag/page.tsx` mirrors `tv/page.tsx`.
- `src/components/TeamSetup.tsx` -- on success posts `changed` (keep) then `router.replace("/spill/{id}")`; the `acted`/`focusPageHeading` unmount effect is replaced by `RouteFocus` (focuses the new page's `<h1>` on any client route change, `src/components/RouteFocus.tsx`).
- `src/app/spill/[id]/page.tsx:217-277` -- *ready*, *playing*, *played* panels; `PRIMARY_LINK`, `SECONDARY_LINK`, `OpenTvLink`, `ScoreList`.
- `src/app/spill/[id]/actions.ts:146-172` -- play actions revalidate `"skjerm"` → `"vert"`; `tests/integration/play.test.ts` asserts the paths (lines ~249, 397, 568, 727, 1239, 1291).
- `src/components/Board.tsx` -- `Board` (stage control bar, `?` dialog, live region) is stage-only → delete. `BoardTiles` (button branch, `listRef`, `pendingSlot`, `unscored` only for the stage) and `BomPanel` move into `TvBoard.tsx`; delete the file.
- `src/components/PlayView.tsx` -- `tv` prop and every non-TV branch (Board, FocusOnMount, deletion line, visible F hint, "Tilbake til spillet") go; add `TvWaiting`. `StageLoading` stays.
- `src/components/FullscreenKey.tsx` -- every remaining use is hidden; drop the hint state and `className`, return `null`. `isShortcut` stays (used by `usePlay`).
- `src/components/usePlay.ts` -- drop `miss`, `missTimer`, `BOM_MS` (moves to `TvBoard.tsx`) and the `F` row of `SHORTCUTS`; comments name only the Host view.
- `src/components/HostPlay.tsx` -- drop `HOST_SHORTCUTS` filter; comment update.
- `src/components/TvBoard.tsx` -- `useTvSync`, `TvRefresh`, `TvBoard`; receives `BoardTiles`, `BomPanel`, `BOM_MS`.
- `src/app/globals.css` -- stage tokens and `[data-revealing]`, `.bom-panel`, `.score-count` stay (TV uses them).
- `tests/integration/play.test.ts`, `tests/integration/authz.test.ts`, `tests/e2e/play.spec.ts`, `tests/e2e/tv.spec.ts`, `tests/e2e/no-key.spec.ts`, `tests/e2e/question-sets.spec.ts`, `tests/e2e/demo.spec.ts` -- tests through `/skjerm` move to `/lag`, `/vert`, `/tv` (see Design Notes).
- `tests/TRACE.md`, `tests/manual/checklist.md` -- bullets naming `/skjerm`, "Fortsett spillet", the control bar.
- `README.md` -- play text, `docs-assets/skjermbilder/spill-brett.png`, `spill-hurtigtaster.png`.

## Tasks & Acceptance

**Execution:**
- Docs -- PRD §0, §4.7 FR-23 to FR-27, §11 ("Amended 2026-11-25") + `./scripts/sync-brief.sh`; EXPERIENCE.md, DESIGN.md, spine (AD-15, AD-16, AD-17, routes); epics.md Story 8.6; sprint-status; epic-8-context.
- `src/app/spill/[id]/play-page.tsx`, `lag/page.tsx`, `skjerm/page.tsx` -- new switch, `/lag`, redirect.
- `src/components/PlayView.tsx` -- TV-only `PlayView`/`FinalScores`, `TvWaiting`.
- `src/components/TvBoard.tsx`, delete `src/components/Board.tsx` -- TV tiles only.
- `src/components/FullscreenKey.tsx`, `usePlay.ts`, `HostPlay.tsx`, `TeamSetup.tsx` -- trims and redirect after start.
- `src/app/spill/[id]/page.tsx`, `actions.ts` -- links, copy, revalidate path.
- Tests -- integration for AC1, AC2, AC4, AC5; e2e for AC3, AC6; move every `/skjerm` e2e to `/vert` + `/tv`; TRACE and checklist.
- `README.md` + two screenshots.

**Acceptance Criteria:**
- Given a *ready* Game, when `/lag` renders, then "Hvem spiller?" Team setup shows; given *draft*, *playing* or *played*, `/lag` redirects to `/spill/[id]`; given a foreign or missing Game, not-found; given *ready*, `/vert` redirects to `/lag` (integration).
- Given a *ready* Game, when `/tv` renders, then the Game title and "Spillet starter snart" show on the stage canvas with no form, input or button (integration).
- Given `/tv` waiting in the same browser, when the Host starts on `/lag`, then the Host lands on `/spill/[id]` with "Spillet er i gang" and `/tv` shows Question 1 within 1.5 s (e2e).
- Given a Game page, then *ready* links "Start spillet" to `/lag`; *playing* has primary "Vertsvisning med fasit" → `/vert`, secondary "Åpne TV-visning" → `/tv`, the two-window line and the mirroring warning and no "Fortsett spillet"; *played* links "Åpne TV-visning" (integration).
- Given any id, when `/skjerm` is requested, then it redirects to `/spill/[id]` (integration).
- Given the moved e2e suite, then every FR-24 to FR-27 criterion that ran on `/skjerm` passes on `/vert` + `/tv`, and axe is clean on `/lag`, the waiting `/tv` and the *playing* Game page (e2e).

## Spec Change Log

## Review Triage Log

### 2026-11-25 — Review pass
- verdicts: 23 findings — high 0, medium 3, low 16, false 4, maybe-false 0 (12 patched, 11 rejected, 0 deferred)
- findings:
  - `[low]` `[patch]` (blind) epic-8-context.md calls 8.6 upcoming and describes the 8.5 routes — fixed: the context now describes the state after 8.6 and keeps the old note as history.
  - `[medium]` `[patch]` (blind) a waiting TV on another device stops polling after `TV_IDLE_MS`, because its `version` never changes — fixed by recording it: a `shortcut:` comment at `TvRefresh`, plus the limit in the spine's AD-17 note, EXPERIENCE.md and checklist row T9. Behaviour kept, so a forgotten TV window still rests.
  - `[low]` `[reject]` (blind) the waiting screen has no link from `/lag` or the *ready* Game page — the intent puts the TV link in *playing*. The waiting screen serves a TV opened by URL, reloaded, or left open, and adding a link is new UI nobody asked for.
  - `[low]` `[reject]` (blind) no test of a waiting TV on another device following the start — that path is the same `useTvSync` poll the existing second-context Reveal test proves.
  - `[low]` `[patch]` (blind) the `/skjerm` redirect skips `auth.requireHost` with no note in AD-5 — fixed: the spine's routes row says the Game page does the owner check.
  - `[low]` `[patch]` (blind) three EXPERIENCE.md passages still describe the stage (Navigation, the Play view error row, the Team setup row) — fixed with 2026-11-25 notes.
  - `[false]` `[reject]` (blind) PRD §1 and DESIGN.md still say "one shared screen" — the room still watches one shared screen, the TV; only the Host's controls moved.
  - `[low]` `[patch]` (blind) AC labels did not match the test titles (AC5 FR-24 against FR-23; AC6) — fixed: AC5 is FR-23, AC6 is FR-23 to FR-27 and NFR-6, and the tv.spec title matches.
  - `[low]` `[reject]` (blind) e2e hydration waits read `__react*` keys — the same pattern 8.5's tv.spec already used. It fails loudly on a React change and is test-only.
  - `[low]` `[reject]` (blind) `FullscreenKey` returns null (could be a hook), and the F hint is not on the Game page — a rename is churn with no behaviour change. The hint stays on `/vert` so the Game page copy stays short, as asked.
  - `[low]` `[patch]` (blind) `/lag` had the same title as the Game page — fixed: "Lagoppsett – {tittel}", with tests and EXPERIENCE.md updated.
  - `[low]` `[patch]` (blind) the README hard wrap was broken and the status date was 23 November — fixed: rewrapped, dated 25 November.
  - `[low]` `[patch]` (blind) the manual checklist had no real two-window check, and T6 did not say where it is timed — fixed: new row T9, and T6 is timed on the Host view.
  - `[medium]` `[patch]` (verification-gap) F on the waiting TV and on the TV Sluttstilling was untested — fixed: e2e presses F on both and polls `document.fullscreenElement` on, then off.
  - `[low]` `[reject]` (edge) the waiting screen is unreachable from the UI — same as the blind row above.
  - `[low]` `[reject]` (edge) a lost start response posts no channel message — rare, and a visible TV's 2 s poll still picks it up.
  - `[low]` `[patch]` (edge) `focusPageHeading` was still exported with no outside caller — fixed: no longer exported.
  - `[medium]` `[patch]` (intent) the waiting TV on another device rests after 10 minutes — same root cause and fix as the blind row.
  - `[low]` `[reject]` (intent) the redirect after the start is proven only in a browser — it is client-side by design, and e2e AC3 covers it.
  - `[low]` `[reject]` (intent) the *played* Game page links the TV, not `/vert` — a recorded choice (EXPERIENCE.md, epics AC4). The Game page already shows the final Scores, so the remaining job is showing the room.
  - `[false]` `[reject]` (intent) stage-only criteria retired, not moved — every FR-24 to FR-27 consequence keeps a test on `/vert` + `/tv`. Only the stage's own chrome checks (control bar, hint, pending border) went, as TRACE records.
  - `[false]` `[reject]` (intent) bookkeeping unfinished — finalize sets the spec and sprint-status to done and commits them.
  - `[false]` `[reject]` (intent) screenshots — the reviewer confirmed that both match their alt texts. That is a confirmation, not a defect.

## Design Notes

- **Waiting screen.** `TvWaiting({ gameId, title })` in `PlayView.tsx`: `data-stage` + `STAGE` + `stage-canvas`, centred `h1` (Game title, `text-tv-question`, `break-words text-balance`) and `p` "Spillet starter snart" (`text-tv-team text-stage-muted`), plus `<TvRefresh>` and `<FullscreenKey />`. One `<h1>`.
- **Game page *playing* copy.** "Spillet trenger to vinduer, ett på PC-en og ett på TV-en, eller to enheter." then "Bruk TV-en som utvidet skjerm, ikke speilet, ellers ser alle i rommet fasiten." in `text-body-sm text-ink-muted`.
- **Game page *played*.** `<OpenTvLink className={PRIMARY_LINK}>` replaces "Vis sluttstilling" → `/skjerm`; the TV page in *played* is Sluttstilling.
- **e2e move.** A stage tile click becomes the `/vert` "Avslør plass N" button; the stage control bar buttons become the `/vert` buttons of the same names; Score, tile and Sluttstilling checks read `/tv` (a second page in the same context). The visible "Trykk F for fullskjerm." hint and the stage's own focus rules go with the stage.

## Verification

**Commands:**
- `npx prettier --check . && npm run lint && npm run typecheck && npm run test` -- green before every commit.
- `npm run test:e2e` -- green at the end (dev server not on 3000/3101/3200).

**Manual checks (if no CLI):**
- Screenshots: `/tv` at 1920×1080 with two reveals; `/vert` at 1280 wide with the shortcut dialog open; both under ~400 KB.

## Auto Run Result

Status: done

**Summary.** Play always runs on two pages. The one-screen stage and "Fortsett spillet" are removed. Team setup is its own Host page, `/spill/[id]/lag` (title "Lagoppsett – {tittel}"). After a successful start the Host is sent to the Game page, which links "Vertsvisning med fasit" (primary) and "Åpne TV-visning" (secondary), with the two-window line and the mirroring warning. `/tv` in *ready* is a waiting screen (Game title, "Spillet starter snart", only F) that follows into play over the channel or the poll; `/vert` in *ready* redirects to `/lag`. `/skjerm` only redirects to `/spill/[id]`. No change to `play`'s logic; the play actions revalidate `/vert` instead of `/skjerm`.

**Files.**
- `src/app/spill/[id]/play-page.tsx`, `lag/page.tsx`, `skjerm/page.tsx` -- the state switch for lag/tv/vert, the new page and the redirect.
- `src/app/spill/[id]/page.tsx`, `actions.ts` -- the *ready*, *playing* and *played* links and copy; the revalidate path.
- `src/components/PlayView.tsx` -- TV-only `PlayView`/`FinalScores`, new `TvWaiting`.
- `src/components/TvBoard.tsx` -- takes the TV's tiles and Bom panel; `Board.tsx` deleted (252 lines).
- `src/components/FullscreenKey.tsx`, `usePlay.ts`, `HostPlay.tsx`, `TeamSetup.tsx`, `RouteFocus.tsx` -- stage-only state removed; redirect after the start.
- Tests: `tests/integration/play.test.ts`, `authz.test.ts`, `tests/e2e/play.spec.ts`, `tv.spec.ts`, `no-key.spec.ts`, `question-sets.spec.ts`, `demo.spec.ts`, `tests/TRACE.md`, `tests/manual/checklist.md`.
- Docs: PRD (§0, §4.7, §11) and `PRD.md`, EXPERIENCE.md, DESIGN.md, ARCHITECTURE-SPINE.md, epics.md (Story 8.6), sprint-status, epic-8-context, README with three new screenshots.

**Review.** 23 findings. 12 patched as 10 fixes: 2 entries at medium (the waiting TV's idle rest on another device, recorded rather than changed; F on the waiting TV and the TV Sluttstilling now tested) and 8 at low. 11 rejected with reasons in the triage log, 0 deferred. Follow-up review recommended: true. Two medium entries were patched. The unverified risk is the deliberate idle limit itself: a TV opened on another device more than 10 minutes before the start does not follow until someone wakes it, and nobody has checked that on real hardware (checklist T9).

**Verification.** `npx prettier --check .`, `npm run lint`, `npm run typecheck` and `npm run test` (833 passed, 1 skipped) passed before every commit. `npm run test:e2e` on a scratch config (dev server on 3106, deleted afterwards) passed 106 of 106 on the first run, after the review fixes. Screenshots inspected: `spill-brett.png` (`/tv` 1920×1080, two reveals, 124 KB), `spill-hurtigtaster.png` (`/vert` 1280 wide, shortcut dialog open, 124 KB), `sluttstilling.png` (`/tv` played, 50 KB).

**Residual risks.** The idle rest above. The TV's hidden tiles never showed the unscored-mode dashes, and still don't (TV tiles were always rendered with it off). `docs-assets/diagrammer/vertsflyt.excalidraw`/`.png` still say "2–4 lag, én skjerm", and the landing page says "spill topplista sammen på én skjerm"; both are left as they are (the room still watches one screen).
