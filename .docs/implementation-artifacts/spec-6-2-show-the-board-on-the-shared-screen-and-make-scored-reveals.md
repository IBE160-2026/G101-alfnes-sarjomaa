---
title: 'Story 6.2: Show the Board on the shared screen and make scored Reveals'
type: 'feature'
created: '2026-11-23'
baseline_revision: '7e63a5f3f526b16c2f6003b0875fc79a728754d1'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-6-1-name-the-teams-and-start-play.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      AC6's manual items (A1, A7, A8, A9 and timing row T6) are recorded in the checklist but not yet run.
    evidence: |-
      AC6 needs a real TV or projector viewed from 3 m and a stopwatch against the deployed app. An unattended run has neither, so a group member must run the rows and note date, device and result in tests/manual/checklist.md.
    location: >-
      tests/manual/checklist.md
    severity: low
  - summary: >-
      The generic save-failure banner "Fikk ikke lagret trekket. Prøv igjen." has no automated test.
    evidence: |-
      Only a Failure outside the stale codes reaches it (in practice INTERNAL), which e2e cannot force without a test hook. Story 6.3's AC4 owns the failed-save banner test; the rejected-call banner ("Mistet forbindelsen.") is tested here.
    location: >-
      src/components/Board.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** The *playing* screen from Story 6.1 is a fluid shell with no Board: no tiles, no Reveals, every Score a literal 0 (a `shortcut:` in `play.load`), no 1920×1080 canvas and no loading state, so the room cannot play (FR-24, FR-25, FR-27 reload). Story 6.2's six ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract.

**Approach:** Add `reveal` (AD-16), `review.getBoard` (AD-15), a `play.reveal` entry point that credits the `play_state` Team under the Game lock, and real Scores as an SQL sum (AD-11). Rebuild the play view as a scaled 1920×1080 canvas with hidden Board tiles that reveal by click or rank key, a staged CSS reveal, a live region, a 64 px control-bar row and "Henter spillet …" while loading.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (`full`), then `impeccable` ("Launcher unavailable" path: read `DESIGN.md`/`EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` directly). Read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. The design contract wins on conflict. The stage is a TV view read from 3 m: WCAG 2.1 AA, inverse focus ring, 44 px targets, literal bokmål, no exclamation marks, no berry (`primary`) on the stage, no shadows.
- **Schema (AD-16).** `reveal(id uuid pk default random, game_id → game CASCADE not null, board_slot_id → board_slot CASCADE not null, team_id → team CASCADE nullable, seq int not null)`, unique `board_slot_id`, unique `(game_id, seq)`. A null `team_id` is an unscored Reveal. Migration via `npm run db:generate`, committed.
- **`review.getBoard(db: Db, gameId)`** (AD-15), not an entry point (takes a `Db`; a `Tx` is assignable): returns the un-awaited drizzle select of `board_slot` joined to `question` on `question.gameId = gameId`, fields `{ id, questionId, position, label, count }`, ordered by question position then slot position. Awaited it gives rows; `.as("board")` makes it the Score subquery. Play reads `board_slot` only through it.
- **Schema** in `src/lib/play.ts`: `revealSchema = { gameId: string, boardSlotId: string, scored: boolean }` (AD-16's `{ boardSlotId, scored }`).
- **`play.reveal(hostId, input)`** in `src/server/play/index.ts`, one transaction: validate; `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.playMove })`; find the slot in `await review.getBoard(tx, gameId)` by id (absent, malformed or another Game's → `NOT_FOUND`, no uuid cast of the input); read `play_state` joined to `team` for the current Question, Team id and name; slot not on the current Question → `WRONG_QUESTION`; insert the Reveal with `team_id = scored ? currentTeam : null` and `seq = (max seq for the Game) + 1` (a subquery is fine under the lock), `onConflictDoNothing` on `board_slot_id` → nothing returned means `ALREADY_REVEALED`. `play_state` is unchanged (the turn does not pass). Returns `{ label, count, team: string | null }` (Team name, null when unscored).
- **`play.load`** keeps its shape and adds `board`: the current Question's slots in position order, each `{ id, position, revealed: false }` or `{ id, position, revealed: true, label, count }`. **A hidden slot never carries its label or Count** (not in the props, the RSC payload or the DOM). Each Team's `score` is `coalesce(sum(board.count), 0)` over its Reveals (`team left join reveal on team_id left join getBoard(...).as("board")`, grouped by Team), so unscored Reveals never count. Remove the 6.1 `shortcut:` comment. Reads no `answer`, `answer_group` or `grouping_result`.
- **Errors** in `src/lib/errors.ts`: `WRONG_QUESTION` "Den plassen hører til et annet spørsmål." and `ALREADY_REVEALED` "Den plassen er allerede avslørt.".
- **Action** `revealSlot(input)` in `src/app/spill/[id]/actions.ts` through `hostAction(play.reveal, input, "skjerm")`. A successful Reveal costs one action round trip whose response carries the revalidated page: no `router.refresh()` on success (NFR-5).
- **Screen page.** *playing* returns `<Suspense fallback={<StageLoading />}>` around an async child that renders `PlayView` from `play.load`. `StageLoading`: a `data-stage` full-window `bg-stage` with "Henter spillet …" (no-break space) in `text-tv-team` `text-stage-ink`, the text `animate-appear` so fast loads never flash it.
- **Canvas (UX-DR21).** `PlayView` keeps the `data-stage` full-window wrapper (`fixed inset-0 overflow-hidden bg-stage`, inverse ring) and puts a 1920×1080 canvas in it, centred and scaled to fit with letterboxing by pure CSS in `globals.css`: `translate: -50% -50%; scale: min(tan(atan2(100vw, 1920px)), tan(atan2(100vh, 1080px)))` from `left/top: 50%` (one comment: `tan(atan2(a, b))` is the unitless ratio a/b). Grid: columns 1312 px and 448 px with a 32 px gap; 64 px side gutters, 48 px top; rows `minmax(221px, auto)` (Question `<h1>`, 56 px up to 80 characters, 48 px above), `minmax(0, 1fr)` (Board), 64 px (control bar, spanning both columns), 24 px row gap. The Team column spans the first two rows: "Spørsmål N av M" in `text-tv-team` `text-stage-muted`, then the 6.1 Team list (`aria-label="Lag"`, `aria-current`, mint active card with "Svarer nå", names 48 px).
- **Board tiles (UX-DR13).** An `<ol>` with one `<li>` per slot keyed by slot id, top-aligned, 8 px gaps, each row `flex: 0 1 <h>` with `h = clamp(80, (696 − 8(n − 1)) / n, 104)` px computed in TS, so a wrapped row may grow while the others shrink and the list stays inside its row. Hidden: a `<button>` named "Avslør plass N" showing only the rank (56 px rank slot, `text-tv-label`), `bg-stage-tile`, 2 px `stage-line` border, `rounded-md`; while its Reveal waits for the server the border is `stage-ink`. Revealed: no longer a button; an element with `tabIndex={-1}` on `bg-stage-ink` / `text-ink`: rank, label in `text-tv-label` at line-height 1.05 that wraps and never truncates (row up to 112 px), Count in `text-tv-count` `tabular-nums` `text-stage-ink` in a `bg-count-badge` pill with `min-width: 96px` and sr-only " poeng".
- **Reveal flow** (client `Board`, rendered by `PlayView`, owning the list, the live region and the control-bar row). A click on a hidden tile, or key `1`–`8` (no modifier, not a repeat, ignored while focus is in a text field, ignored for a revealed or missing rank) calls `revealSlot({ gameId, boardSlotId, scored: true })`; one Reveal at a time. Success: the revalidated page shows the tile revealed with the staged animation, the polite live region (`role="status"`, sr-only, always rendered) says "«{label}», N poeng til {Team}." from the action result, and a tile that had focus hands it to its revealed row. Rejected call → banner "Mistet forbindelsen."; `NOT_FOUND`, `WRONG_STATE`, `WRONG_QUESTION`, `ALREADY_REVEALED` → `router.refresh()` with no banner (the saved state is the answer); any other Failure → banner "Fikk ikke lagret trekket. Prøv igjen.". The banner (`role="alert"`, `text-stage-ink` weight 700) replaces the control-bar row's content, never covers the list, is never red, leaves the tiles as they were, and clears on the next attempt.
- **Motion (CSS only, in `globals.css`).** Only the tile revealed by this tab animates (mark it at click time, so a reload or a refresh shows revealed tiles static): fill `stage-tile` → `stage-ink` 180 ms; label fades in with a 12 px slide from 120 ms (220 ms); Count badge fades in scaling 0.9 → 1 from 300 ms (160 ms). Score count-up: a registered `@property --score` (`<integer>`, `inherits: false`, initial 0) set inline on an `aria-hidden` span whose `::after` is `counter(score)`, with `transition: --score 400ms 460ms`; the real value is sr-only "{score} poeng" next to it. `prefers-reduced-motion: reduce` removes the animations and the transition (the colour change is kept).
- **Control bar row (64 px, UX-DR21).** `bg-stage-raised`, `rounded-md`, `text-tv-control` `text-stage-muted`, holding "Trykk F for fullskjerm." (`FullscreenKey`, unchanged behaviour) until Story 6.3 adds its controls; the banner takes its place on failure.
- **Manual checklist** (AC6): add A1, A7, A8 and A9 from `EXPERIENCE.md`'s Accessibility Floor table to `tests/manual/checklist.md`, and timing row T6 "Avslør a tile: from the click (or rank key) to the revealed label and Score, within one second" (NFR-5, FR-25).
- FR IDs in test titles, rows in `tests/TRACE.md`, offline, no key, no real names, no per-file Vitest timeouts. Commits in Norwegian are made in the finalize step.

**Never:**
- No Bom, Angre, Neste lag, unscored toggle, unscored tile look, "?" overlay, `Esc`, "Alle svarene er avslørt." or Neste spørsmål (Stories 6.3, 6.4). No *played* view. The module accepts `scored: false`, but no UI sends it.
- No count-up colour change to `stage-accent`: the scored Team is always the mint active card, where accent digits would be invisible (see Design Notes).
- No new Route Handler, client data library, websocket, animation library or dependency; no optimistic update; no JS-measured canvas scaling.
- Do not touch `.env`, `.logs/`, `prompting/` or `.claude/skills/excalidraw-diagram/`; no absolute machine paths in tracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Scored | *playing*, Q1 slots (Counts 5, 3, 2), Team 1 current; reveal slot 1 | `reveal` row with Team 1, seq 1; result `{ label, count: 5, team: "Lag 1" }`; `load` shows slot 1 revealed, Scores `[5, 0]`, Team 1 still current | — |
| Sum | then reveal slot 2 with `play_state` moved to Team 2 by hand | Scores `[5, 3]`, each equal to a raw SQL sum of `board_slot.count` over that Team's scored Reveals; seq 2 | — |
| Unscored | `scored: false` | `team_id` null, result `team: null`, no Score changes | — |
| Again | an already revealed slot | nothing written | `ALREADY_REVEALED` |
| Other Question | a slot of Q2 while Q1 is current | nothing written | `WRONG_QUESTION` |
| Foreign slot | random UUID, `abc`, another Game's slot | nothing written | `NOT_FOUND` |
| Bad input | missing or non-boolean `scored`, non-string id | nothing written | `INVALID_INPUT` |
| Wrong state | *ready*, *played* | nothing written | `WRONG_STATE` |
| Foreign Host | Host B on A's Game | A unchanged | `NOT_FOUND` |
| Delete | delete a Game with Reveals | its `reveal` rows are gone | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- add `reveal` after `playState` (:243), same `uniqueIndex` style as `boardSlot` (:197); `drizzle/0013_*.sql` + meta via `npm run db:generate`.
- `src/server/review/index.ts` -- add `getBoard`; imports `Db`/`Tx` (:26) and `boardSlot`, `question` (:28) already. `eslint.config.mjs` MODULES puts `play` after `review`, so play may import it.
- `src/server/play/index.ts` -- `start` (:19) is the transaction pattern; `load` (:50) has the `shortcut:` to remove; `PlayView` type (:11) gains `board`.
- `src/server/games/index.ts` -- `lockForMutation` :120 (touches `updated_at`); `src/lib/game-state.ts` already has `PERMITTED.playMove = ["playing"]`.
- `src/lib/play.ts`, `src/lib/errors.ts` (`ErrorCode` union :4, `MESSAGES` :22) -- schema and codes; `tests/unit/errors.test.ts` checks every code has a message.
- `src/app/spill/[id]/actions.ts` -- `hostAction` :42, `startPlay` :145; add `revealSlot`.
- `src/app/spill/[id]/skjerm/page.tsx` -- *playing* branch :49; `cache`d `ownedGame` gives `hostId`.
- `src/components/PlayView.tsx` -- the 6.1 shell to rebuild (its `shortcut:` goes); `FullscreenKey.tsx` reused as is (key-listener guard pattern for `1`–`8`).
- new `src/components/Board.tsx` -- client; reuse `callAction` (`src/components/useFormAction.ts`), the `useTransition` + `router.refresh()` handling of `TeamSetup.tsx` :96–:120.
- `src/app/globals.css` -- stage tokens and `--animate-appear` exist; add the canvas, staged-reveal and `--score` rules plus the reduced-motion block.
- `src/app/spill/[id]/page.tsx` -- *playing* panel :221 reads `play.load`; real Scores flow through unchanged.
- Tests: `tests/integration/play.test.ts` (`gameIn` :48 writes no Board yet; `screen` helper :101 uses `renderToStaticMarkup`, which renders only the Suspense fallback; a `react-dom/static` `prerenderToNodeStream` helper renders the async content); `tests/integration/authz.test.ts` (6.1 play rows); `tests/integration/delete.test.ts` (catalog-driven cascade); `tests/e2e/play.spec.ts` (6.1 asserts no buttons on the play view: now the tiles are buttons); `tests/e2e/fixtures.ts` (`collectingGame`, `submitSets` with custom sets, `closeAndOpenReview`, `seriousViolations`, `FOCUS_RING_INVERSE`); `tests/e2e/review.spec.ts` :611 (menu "Mer for «X»" → "Forkast fra brettet").

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts`, `drizzle/` -- `reveal` and its migration.
- `src/lib/play.ts`, `src/lib/errors.ts` -- `revealSchema`, the two codes.
- `src/server/review/index.ts` -- `getBoard`.
- `src/server/play/index.ts` -- `reveal`; `load` with `board` and summed Scores.
- `src/app/spill/[id]/actions.ts` -- `revealSlot`.
- `src/app/spill/[id]/skjerm/page.tsx`, `src/components/PlayView.tsx`, new `src/components/Board.tsx`, `src/app/globals.css` -- Suspense with `StageLoading`, canvas, tiles, reveal flow, motion, control-bar row.
- `tests/integration/play.test.ts` -- `gameIn` also writes `board_slot` rows (labels and Counts) for each Question; every matrix row except Foreign Host and Delete through `play.reveal` and `revealSlot` (ok shape, revalidated paths); AC2: a fixture with a discarded `answer_group`, a below-limit Group not on the Board and `answer` rows with known texts, rendered (prerender) before and after revealing every slot of Q1: only revealed `board_slot` labels and Counts appear, never a hidden label, the discarded or below-limit labels or any Answer text; the playing screen renders tiles "Avslør plass N" and real Scores; `renderToStaticMarkup` of the playing screen shows "Henter spillet …" on a `data-stage` element.
- `tests/integration/authz.test.ts` -- Foreign Host row for `play.reveal` and `revealSlot` (A's Game, A's slot from B's own *playing* Game, random UUID, `abc`).
- `tests/integration/delete.test.ts` -- Delete row (a Reveal is present when the Game is deleted).
- `tests/unit/play.test.ts` (new) -- `revealSchema` accepts the AD-16 shape and refuses a missing or non-boolean `scored` (AC3's unit tag).
- `tests/e2e/play.spec.ts` -- update 6.1's expectations (tiles are the only buttons, Scores "0 poeng"); new test: a 200-character Question and three custom Answer sets giving 13 Groups (raw "kari!" groups with "Kari"), one discarded in Review, so 8 on the Board and 4 below the limit; at 1920×1080: the canvas fills the window, computed font sizes of Question (48 px), Team names (48), Scores (80), and after reveals labels and Counts (48) are ≥ 48 px, the control bar's bottom ≤ 1080, 8 tiles "Avslør plass 1–8"; at 1280×720 the canvas box is 1280×720; a delayed reveal POST shows the tile border `stage-ink` before the server answers; click and key `2` reveal with label and Count shown, the tile no longer a button, the staged animation present, the status "«Kari», 3 poeng til Lag 1." and the Score "3 poeng"; under `reducedMotion: "reduce"` a reveal has no animation; an aborted POST shows "Mistet forbindelsen." in the control-bar row with the tile still hidden; a second tab's reveal then a click on the same tile here shows it revealed with no banner; reload restores Question, current Team, revealed tiles and Scores; after all 8 the page has none of the discarded, below-limit or raw Answer texts; axe clean with revealed tiles.
- `tests/manual/checklist.md`, `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- A1, A7, A8, A9, T6; FR-24, FR-25, FR-27, UX-DR13, UX-DR14, UX-DR21 rows; 6-2 done.

**Acceptance Criteria:**
- Given a *playing* Game at 1920×1080, when the play view renders, then the canvas shows "Spørsmål N av M", the Question, one rank-only tile per Board slot, the mint "Svarer nå" card and every Score with no Host top bar, every room-facing text ≥ 48 px and the control bar inside 1080 px, also for a 200-character Question with eight Groups.
- Given a hidden tile, when the Host clicks it or presses its rank key, then its border is `stage-ink` until the server answers, then the label and Count appear in the staged reveal, the Score counts up (instant under reduced motion), the live region announces "«{label}», N poeng til {Team}." and the tile is no longer a button.
- Given a round with Reveals, when the screen is reloaded, then Question, current Team, revealed tiles and Scores come back from the server, and no discarded, below-limit or raw Answer text is in the DOM at any point.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 45 findings — high 0, medium 2, low 32, false 11, maybe-false 0
- findings:
  - `[false]` `[reject]` Intent: sprint status says done while the spec is in review and nothing is committed — mid-run state; the finalize step sets the spec to done and commits in the same run.
  - `[low]` `[defer]` Intent: AC6 says the manual items pass, but they are only added to the checklist — they need a real TV at 3 m and a stopwatch, which an unattended run does not have; deferred to a group member (frontmatter `deferred`).
  - `[low]` `[reject]` Intent: AC3's unit tag is met only by a schema test, not a Score test — Score is an SQL sum by AD-11, so it can only be proved against a database (integration, `rawSums`); the pure part of AC3 is the input shape, which the unit test covers. Story 6.3 adds the property test over Reveal and undo sequences.
  - `[medium]` `[patch]` Intent: the pending-border check cannot fail, since the revealed `<div>` also has a `stage-ink` border — same root cause and patch as the Verification-gap pending row.
  - `[low]` `[reject]` Intent: the count-up is checked only at its end value — sampling an intermediate value of a 400 ms transition is timing-dependent and would make the test flaky; the transition rule and reduced-motion removal are asserted.
  - `[low]` `[reject]` Intent: "about 700 ms" is asserted only through animation names — the durations are CSS constants in one place; asserting them restates the stylesheet.
  - `[false]` `[reject]` Intent: the count-up keeps `stage-on-accent` instead of `stage-accent` — deliberate: the scored Team is always the mint card, so mint digits would be 1:1 contrast (FR-24, NFR-6); recorded in Design Notes and now in `wiki/prosjekt/beslutninger.md`.
  - `[false]` `[reject]` Intent: stale reveals refresh silently instead of showing a message, and `WRONG_STATE` joins the list — `EXPERIENCE.md` (State Patterns, "Any Host action") prescribes exactly this refresh; the refreshed tile shows the saved state, and a `WRONG_STATE` refresh lands on the Game page through the screen page's redirect, which is the clearest message available.
  - `[false]` `[reject]` Intent: the schema takes `gameId` besides AD-16's `{ boardSlotId, scored }` — every Host action carries `gameId` for the lock and `revalidatePath` (AD-17); AD-16 rules out a client-chosen Team, not the Game id.
  - `[low]` `[reject]` Intent: NFR-5 and the lock are not measured automatically — one transaction and no refresh on success are visible in the code; timing is manual row T6, as for Review (T1–T5).
  - `[low]` `[patch]` Intent: AC numbers differ between TRACE/e2e (spec's three) and integration/unit (story's six) — TRACE and the e2e title now use the story's AC1–AC6.
  - `[low]` `[reject]` Intent: the AC2 integration fixture writes the Board by hand — that is what makes the labels distinguishable from Group labels and Answer texts; the real Review flow is covered by the e2e test (13 Groups, one discarded, four below the line).
  - `[low]` `[reject]` Intent: "Spørsmål N av M" placement and the missing top bar are not asserted — the text and its 48 px size are; the hidden chrome is asserted by Story 6.1's e2e test, which still runs.
  - `[low]` `[patch]` Blind: a stale refresh animates a tile this tab did not reveal — `clicked` is now cleared on every non-ok result; e2e asserts no `data-revealing` on the stale tile.
  - `[low]` `[patch]` Blind: focus falls to `<body>` when a focused tile hits the stale path — the stale branch now hands focus to the revealed row like a success; e2e asserts it. Graded low: it needs a second tab.
  - `[false]` `[reject]` Blind: an unscored Reveal would announce "poeng til null." — no UI sends `scored: false` in this story; Story 6.3 adds the unscored toggle and its announcement.
  - `[low]` `[reject]` Blind: four Teams with wrapping names can overflow the Team column — 14 characters were chosen so four names fit on one line (EXPERIENCE); only names of wide capitals wrap, and four of them at once is not a case a party meets. Computed fit for four one-line Teams: 882 of 941 px.
  - `[low]` `[patch]` Blind: letterboxing is untested because both viewports are 16:9 — e2e now checks a 1280×1024 window: canvas 1280×720, centred vertically.
  - `[low]` `[patch]` Blind: `pb-[3px]` is unexplained — one comment now gives the budget arithmetic.
  - `[false]` `[reject]` Blind: a Question taller than 221 px pushes tiles under the control bar — rows are `flex: 0 1 <h>` in a `minmax(0, 1fr)` row, so they shrink to fit the row actually available; they cannot overflow while each row's content (one 48 px line) fits.
  - `[low]` `[reject]` Blind: TeamSetup drops `focusPageHeading()`'s cleanup — the observer only waits for the next `<h1>`, which is the page heading wherever the Host lands; keeping the cleanup needs extra state for a path no user takes.
  - `[low]` `[patch]` Blind: the no-break space in "Henter spillet …" is invisible in the source — written as `&nbsp;` now.
  - `[low]` `[reject]` Blind: no concurrency test for the lock and `seq` — PGlite runs one connection, so a `Promise.all` test serialises anyway and proves nothing; the lock pattern is the one every module uses.
  - `[low]` `[patch]` Blind: the count-up colour deviation lives only in the spec — a row in `wiki/prosjekt/beslutninger.md` now records it.
  - `[false]` `[reject]` Blind: status fields disagree — mid-run state, as in the first Intent row.
  - `[low]` `[reject]` Blind: `reveal.team_id` has no index — Reveals are at most 160 per Game and Games are purged 30 days after play; an index adds a migration for no measurable gain.
  - `[low]` `[reject]` Blind: the long-label wrap (112 px) is untested — the row grows by flex `min-height: auto` while the others shrink; manual row A9 covers it on a real screen.
  - `[low]` `[patch]` Blind: "Henter spillet …" has no status role — `role="status"` added; the integration test expects it.
  - `[medium]` `[patch]` Verification gap: the pending-border poll also matches the revealed tile — the POST is now held on a promise the test releases; tile 1 is asserted to be a button with a `stage-ink` border before release (and `stage-line` before the click).
  - `[low]` `[patch]` Verification gap: the drawn Score digits are never observed — e2e asserts a non-zero width of `.score-count`.
  - `[low]` `[patch]` Verification gap: `getBoard`'s order is unpinned — `gameIn` inserts slots last position first; removing the `orderBy` fails five tests (checked, then restored).
  - `[low]` `[reject]` Verification gap: the one-Reveal-at-a-time guard is untested — the server stays consistent under the lock either way; only UI sequencing is affected.
  - `[low]` `[defer]` Verification gap: the generic failure banner is untested — only `INTERNAL` reaches it, which e2e cannot force without a hook; Story 6.3's AC4 owns the failed-save banner (frontmatter `deferred`).
  - `[low]` `[patch]` Verification gap (other): stale tile animates — same root cause and patch as the Blind animation row.
  - `[low]` `[reject]` Verification gap (other): lingering observer — same as the Blind TeamSetup row.
  - `[low]` `[patch]` Edge: `clicked` not cleared on failure — same as the Blind animation row.
  - `[low]` `[patch]` Edge: focus lost on the stale path — same as the Blind focus row.
  - `[low]` `[reject]` Edge: lingering observer — same as the Blind TeamSetup row.
  - `[false]` `[reject]` Edge: a wrapped label in eight 80 px rows spills over the next tile or the bar — the wrapped row's `min-height: auto` keeps its content height and the seven others shrink to about 76 px, still taller than their one-line content.
  - `[low]` `[reject]` Edge: four wrapped Team names are clipped — same as the Blind Team-column row.
  - `[low]` `[reject]` Edge: no `tan(atan2())` support on old browsers — the stage runs in a current laptop browser mirrored to the TV (EXPERIENCE, Responsive & Platform); every current engine supports it, and Story 6.1 rejected the Fullscreen-API guard on the same ground.
  - `[false]` `[reject]` Edge: `reveal` crashes when a *playing* Game has no `play_state` row — unreachable: `play_state` is written in the same transaction that moves the Game to *playing* (Story 6.1 triage).
  - `[false]` `[reject]` Edge: `load` crashes without `play_state` — same unreachable state.
  - `[low]` `[reject]` Edge: `busy` clears a few milliseconds before the revalidated Board commits — a second key in that window either reveals another tile (correct) or gets `ALREADY_REVEALED` and a refresh (harmless).
  - `[false]` `[reject]` Edge: `overflow-hidden` replaced the old scrolling — the canvas is scaled to fit the window and its content is budgeted to 1080 px, so nothing is hidden that scrolling would have reached.

## Design Notes

- **Canvas scaling without JS.** `tan(atan2(100vw, 1920px))` is the ratio 100vw/1920px as a plain number (CSS cannot divide lengths yet in every browser), so the canvas is right from the first server-rendered paint, with no resize listener and no flash at scale 1. If the CSS pipeline rewrites the expression, verify in the built CSS and fall back to a small client measure only then.
- **AD-15 and AD-11 together.** Play must read `board_slot` only through `review.getBoard`, and Score must be an SQL sum of `board_slot.count`. Returning the un-awaited select lets play both await it (tiles, Reveal checks) and use it as a subquery (Score), so neither rule bends.
- **Count-up colour.** EXPERIENCE says the digits count up in `stage-accent`, but Reveals always credit the current Team, whose card is filled `stage-accent`: mint on mint is 1:1 contrast. The count-up keeps the card's `stage-on-accent`; legibility (FR-24, NFR-6) wins.
- **Hidden means absent.** A hidden slot's label is not sent to the client at all, so neither the DOM nor the RSC payload can leak the Board before it is revealed (FR-24).

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, axe clean on the play view with revealed tiles.

## Auto Run Result

Status: done

**Summary.** The shared screen shows the locked Board, and the Host can make scored Reveals that survive a reload.
- `reveal` (AD-16) stores one row per revealed slot with the Team (null for unscored) and a per-Game `seq`. `review.getBoard` (AD-15) is the only read of `board_slot` in play: awaited for tiles and Reveal checks, used as a subquery for the Score.
- `play.reveal` runs in one transaction under the Game lock: a slot outside the Game is `NOT_FOUND`, a slot on another Question `WRONG_QUESTION`, a second Reveal `ALREADY_REVEALED`; the Team comes from `play_state`, and the turn does not pass. `revealSlot` returns label, Count and Team for the announcement, and the revalidated page comes back in the same response (no extra refresh round trip, NFR-5).
- `play.load` returns the current Question's Board, where a hidden slot carries no label or Count, and real Scores as an SQL sum of `board_slot.count` over each Team's scored Reveals (AD-11). The 6.1 `shortcut:` is gone.
- The play view is a 1920×1080 canvas scaled to the window by pure CSS and letterboxed. Hidden tiles are buttons "Avslør plass N" showing only the rank; a click or key `1`–`8` reveals with a `stage-ink` pending border, a staged CSS reveal, a Score count-up and the announcement "«{label}», N poeng til {Team}."; all instant under reduced motion. A lost connection shows "Mistet forbindelsen." in the 64 px control-bar row; stale codes refresh to the saved state. "Henter spillet …" shows on the stage while it loads.

**Files changed.**
- `src/server/db/schema.ts`, `drizzle/0013_large_thaddeus_ross.sql`, `drizzle/meta/*` -- `reveal`.
- `src/lib/play.ts`, `src/lib/errors.ts` -- `revealSchema`, `WRONG_QUESTION`, `ALREADY_REVEALED`.
- `src/server/review/index.ts` -- `getBoard`.
- `src/server/play/index.ts` -- `reveal`; `load` with `board` and summed Scores.
- `src/app/spill/[id]/actions.ts` -- `revealSlot`.
- `src/app/spill/[id]/skjerm/page.tsx`, `src/components/PlayView.tsx`, `src/components/Board.tsx` (new), `src/app/globals.css` -- Suspense loading state, canvas, tiles, reveal flow, motion, control-bar row.
- `src/components/RouteFocus.tsx`, `src/components/TeamSetup.tsx` -- `focusPageHeading()` extracted so focus after "Start spillet" waits for the stage's `<h1>` behind the new loading state.
- `tests/unit/play.test.ts` (new), `tests/integration/play.test.ts`, `authz.test.ts`, `delete.test.ts`, `tests/e2e/play.spec.ts`, `tests/TRACE.md`, `tests/manual/checklist.md` (A1, A7, A8, A9, T6).
- `wiki/prosjekt/beslutninger.md` -- the count-up colour decision; `sprint-status.yaml` -- 6-2 done.

**Review findings.** One pass, 45 findings (0 high, 2 medium, 32 low, 11 false).
- Patched, 10 entries (1 medium, 9 low): the pending-border e2e check made able to fail; stale tiles no longer animate and keep focus; letterboxing tested at 1280×1024; the drawn Score digits checked; Board slots inserted out of order in fixtures; the `pb-[3px]` budget comment; `&nbsp;` and `role="status"` on the loading text; story AC numbering in TRACE and the e2e title; the colour decision in the wiki.
- Deferred, 2: AC6's manual run (needs a TV and a person); the generic failure-banner test (Story 6.3 AC4).
- Rejected: every other row, with its reason in the triage log (unreachable states, flaky timing assertions, wide-letter Team names, PGlite concurrency tests that prove nothing, an index without measurable gain).

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (planning).** The design contract asks for the count-up in `stage-accent`, but the scored Team's card is filled with that colour, so the digits would vanish. The spec kept the card's own text colour; the decision is in the wiki.
- **Corrected (implementation output, found in review).** A tile revealed in another tab replayed this tab's reveal animation and dropped keyboard focus; the pending-border test passed even with the pending style broken; letterboxing and the drawn Score were untested; fixtures could not catch a missing sort.
- **Corrected (implementation agent, unprompted).** The new loading state made focus after "Start spillet" miss the play view's `<h1>`; the agent extracted `focusPageHeading()` from `RouteFocus` instead of adding a second observer.
- **Rejected (reviewer suggestions).** An "uten poeng" announcement before 6.3 sends unscored Reveals; a `@supports` fallback for engines the product does not target; concurrency tests on single-connection PGlite; an index on `reveal.team_id`; asserting intermediate count-up values and animation durations; a silent-refresh message other than the one EXPERIENCE prescribes.
- **Corrected in orchestration.** The platform ran the implementation agent and the four reviewers in the background, although the workflow asks for blocking calls. Each result was awaited before the next step, so nothing was skipped.

**Follow-up review recommendation:** false. One `medium` entry was patched (a test that could not fail, now able to), below the threshold of two.

**Verification.** `npm run lint` clean; `npm run typecheck` clean; `npm run test` 710 passed (43 files); `npm run test:e2e` 93 passed, axe clean on the play view with revealed tiles. All offline, no key. Run after the review patches.

**Residual risks.** The canvas scaling relies on `tan(atan2())` (all current engines; checked in the built CSS and in headless Chromium). AC6's TV checks and the timing row are not yet run. A label of 40 wide capitals is covered only by manual row A9, and four Team names of wide capitals that wrap are not covered (rejected as unlikely).
