---
title: 'Story 8.6: Play needs two views: host view and TV view'
type: 'feature'
created: '2026-11-25'
status: 'in-progress'
baseline_revision: '87638b6ec13b4b9c59a66becdc6e1e4d855ce583'
review_loop_iteration: 0
followup_review_recommended: false
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
