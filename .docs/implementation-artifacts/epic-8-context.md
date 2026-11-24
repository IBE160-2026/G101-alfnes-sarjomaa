# Epic 8 Context: Stage 2 - only after SM-1 passes

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Add the Stage 2 features on top of the finished Stage 1 loop. FR-33 (play a ready-made, Norwegian ProtoQA Question set) is done: Story 8.1 started before SM-1 passed, by the group's decision of 2026-11-23, using only the crowdsourced CC BY 4.0 part of ProtoQA. The next story, 8.5, splits play into two pages: a clean TV page the room watches, and a Host page with the answer key and the controls, kept in step by BroadcastChannel with polling as the fallback. This is the "extended display" idea the UX spine left as a Stage 2 candidate. Stories 8.2 to 8.4 (reorder Groups, assisted Guess matching, strikes and steals) stay behind the SM-1 gate. Design is decided inside AD-4, AD-13, AD-15, AD-16 and AD-17, and any departure amends the spine in the same change.

## Stories

- Story 8.1: Play a ready-made Question set (FR-33), done
- Story 8.2: Reorder Groups in Review (FR-22), gated by SM-1
- Story 8.3: Assisted Guess matching (FR-28), gated by SM-1
- Story 8.4: Strikes and steals (FR-29), gated by SM-1, rules decided by the group first
- Story 8.5: Separate TV view and host view with answer key (surfaces for FR-23 to FR-27). Story 8.5 in `epics.md` and `sprint-status.yaml`, started before SM-1 passed by the group's decision of 2026-11-24 after the pilot test.

## Requirements & Constraints

Play requirements 8.5 must keep, on both pages:
- Team setup only from *ready*, two to four Teams, every Score starts at zero, the Game moves to *playing*. Play cannot start on any other state.
- The room sees one Question at a time, its Groups hidden with only the rank number visible, the current Team and every Team's Score. Question, labels, Counts, Team names and Scores are 48 px or more on a 1920x1080 view (manual checks A1, A8, A9).
- Never shown anywhere in play: raw Answers, discarded Groups, Groups below the Board limit, Contributor data (manual check A7). The answer key is Board content only and must not become a way to show Review data.
- A click on a Group is a scored Reveal: label and Count appear and the Count goes to the current Team. A Team's Score always equals the sum of its scored Reveals' Counts. A Group already revealed is refused, enforced on the server.
- Undo removes only the most recent Reveal on the current Question, scored or unscored, and subtracts its Count. Turns and Question changes are manual. Unscored Reveals change no Score. After the last Question the final Scores show and the Game moves to *played*.
- Play state (Question, Team, Reveals, Scores) survives a reload, so either page can be reopened at any time and must show the saved state.
- The whole play flow works with no model key and no network (FR-30, NFR-3). The FR-33 source credit stays on the play screen the room sees.
- NFR-5: a Host action shows its result within one second. NFR-6: WCAG 2.1 AA, never cut. NFR-7: bokmål.

Story 8.5 premise: the TV page shows only the audience Board (hidden tiles with rank, revealed labels and Counts, Teams and Scores). The Host page shows the answer key (hidden labels and Counts of the current Question's Board) plus the controls. Each Reveal, undo, turn and Question change shows on both without a manual reload. If the answer key's labels sit in the TV page's markup or payload, the TV page is not clean; check that. The PRD describes one shared screen and the UX spine assumes the TV mirrors the laptop, so this story supersedes those assumptions and should record that with its amendments.

Story conventions that apply: every acceptance criterion carries a proof label (unit, integration, e2e, manual); test titles carry FR IDs and rows go into `tests/TRACE.md`; lint, format, typecheck, `npm test` and `npm run test:e2e` stay green offline; commit small and locally, never push. A new Host action gets a foreign-ID case in `tests/integration/authz.test.ts`; a new state-dependent operation gets a row in `src/lib/game-state.ts` and a `WRONG_STATE` case. New `ErrorCode`s go in `src/lib/errors.ts`. Nothing logs a Token, hash or Answer text. No real person's name or `.idea/` text in tracked files.

## Technical Decisions

Spine rules (`.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md`) that 8.5 builds on:
- **AD-15:** play reads only `board_slot`, through `review.getBoard`. Both pages read this one snapshot. There is no separate play path for Question-set Games, so they use the same pages. Question-set Games hold no Answers or Contributor keys (FR-11 to FR-13 not engaged).
- **AD-16:** the saved reveal log is the only truth for play. Tables `team`, `play_state(game_id, current_question_id, current_team_id)`, `reveal(board_slot_id unique, team_id nullable, seq)`. Reveal takes only `{ boardSlotId, scored }`, with the Team read from `play_state` under the Game lock, and refuses with `WRONG_QUESTION` or `ALREADY_REVEALED`. Undo deletes the highest-`seq` Reveal on the current Question. Next Question is the smallest greater position. `finish` sets `played_at` and returns the deletion date. The play view renders from saved state on the server. The rule exists to prevent play state held only in the browser, so a channel message or a poll should only trigger a re-read of saved state, never carry or be trusted as state.
- **AD-4:** operations in *playing* are reveal, undo, next Team, next Question, finish; in *ready*, start play. All go through `games.lockForMutation`. No new state or transition is expected.
- **AD-5:** every Host page and action calls `auth.requireHost()`; a missing and a foreign Game get the same `NOT_FOUND` response; no proxy decides auth. Treat `/tv` and `/vert` as owner-checked unless the spine is amended. BroadcastChannel reaches only windows of the same browser and origin, which is why polling is needed. The planning docs define no token-based TV access for another device; do not invent one without amending AD-5.
- **AD-17:** pages read in server components; mutations are Server Actions with a sibling zod `schema.ts`; Route Handlers are limited to three GET routes; polling is `router.refresh()` on a timer (3 s in *grouping*, 30 s in *collecting*); "there are no websockets"; limits live only in `src/lib/limits.ts`. BroadcastChannel plus polling for play is therefore an AD-17 amendment: no new Route Handler, no websocket, no client data library, and the poll interval is a named limit.
- **Routes:** the spine's Conventions table and the EXPERIENCE.md route table list `/spill/[id]/skjerm` as the one play route. Add `/spill/[id]/tv` and `/spill/[id]/vert` to both in the same change, as bokmål ASCII segments. What happens to `/skjerm` (today Team setup, play view, final Scores) is not decided in the docs.
- **AD-22:** Playwright runs on `next build && next start` with a temporary PGlite and blocks every host but localhost; an axe pass covers play; manual checks A1, A7, A8, A9 need re-running against the TV page.
- **AD-1:** the `play` module owns `team`, `play_state`, `reveal`; `src/app` and `src/components` never import `src/server/db`.
- **From 8.1, still true:** `review.createFromQuestionSet` composes the owners' writers and inserts via `games.insertReady`; `game.question_set` is null for a Host-written Game; the credit shows only when it is set; data is `data/question-sets/protoqa-nb.json`.
- **8.2 to 8.4, for orientation:** 8.2 adds a manual order to `answer_group` and touches AD-11 and AD-15; 8.3 adds `match` to the one Judge interface (AD-13), deletes typed Guesses at *played*, and falls back to FR-25 with no key; 8.4 needs the group's rules first, off by default, and Games without it play as in Stage 1.

## UX & Interaction Patterns

Contract: `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win over the design skills. Run `impeccable` in Operate mode and read `reference/craft-floor.md` before UI changes.

- **Today:** `/spill/[id]/skjerm` is Team setup on a light Host page ("Hvem spiller?", two to four names of 1 to 14 characters, "Start spillet", hint "Trykk F for fullskjerm."), then the stage play view (full window, no top bar), then "Sluttstilling". The UX spine assumed the TV mirrors the laptop, so the room sees the control bar, which is why it is quiet. Its Open Question 4 names a two-window mode (controls on the laptop, clean board on the TV) as the Stage 2 candidate. That is 8.5.
- **Two token families:** *stage* (`stage`, `stage-raised`, `stage-tile`, `stage-line`, `stage-ink`, `stage-muted`, `stage-accent` mint, `stage-on-accent`, `count-badge` forest) for the TV only; *light* (`paper`, `surface`, `surface-sunken`, `ink`, `ink-muted`, `line`, berry accent) for Host pages. No mint on light, no berry on stage, no red for a miss. Focus on the stage and on ink surfaces uses `focus-inverse`. Tokens are Tailwind v4 `@theme` names in `globals.css`.
- **TV ramp and canvas:** fixed 1920x1080 canvas scaled with `transform: scale()`, letterboxed. Question 56 px (48 px above 80 characters, budgeted at four lines), labels, Counts and Team names 48 px, Score 80 px, final Scores 120 px, tabular figures. Main column 1312 px, Team column 448 px, 64 px gutters. Vertical budget 48 / 221 / 24 / 696 / 24 / 64. A revealed label never truncates; it wraps and the row grows to 112 px. The 24 px `tv-control` style is only for host-only text and the source credit, never for anything the room must read.
- **What the room sees (TV page):** hidden tiles with only the rank, revealed tiles with label and Count badge, unscored tiles dashed with "uten poeng", "Spørsmål N av M" at the top of the Team column, the credit under it for set Games (24 px `stage-muted`, may wrap), the mint active Team card with "Svarer nå", the "Bom" panel (80 px, 150 ms in, 1.2 s hold, 150 ms out, no state change), the staged Reveal of about 700 ms (CSS only, instant under reduced motion with the colour change kept), no sound, and final Scores with "Vinner" or "Uavgjort".
- **What the Host owns (Host page):** the control bar ("Bom [M]", "Angre [Z]", "Neste lag [T]", "Vis resten uten poeng [U]" as an `aria-pressed` toggle that resets on the next Question, "Neste spørsmål [N]" or "Vis sluttstilling" on the last), shortcuts `1`-`8`, `M`, `Z`, `T`, `U`, `N`/`→`, `F`, `?`, `Esc` (ignored in text fields), the "Alle svarene er avslørt." hint, the save-failure banner ("Fikk ikke lagret trekket. Prøv igjen." / "Mistet forbindelsen.", in place of the control row, never over the list), the pending state while a click waits for the server, polite live-region announcements of Reveals and undo, and the line "Spillet slettes automatisk {dato}." with "Tilbake til spillet". The final-Scores deletion line is a 24 px Host line.
- **Not decided by the docs, so it is new design work:** the Host page's look (light chrome or stage), how the answer key marks revealed against hidden Groups, where Scores and the active Team show on the Host page, how a lost connection reads on the TV, and which window takes `F` fullscreen. Reuse existing components and keep one primary action per state. Add no feature the PRD does not name.
- **Stale views:** with two windows, `NOT_FOUND`, `ALREADY_REVEALED` and `WRONG_QUESTION` become ordinary; the pattern is to refresh from the server and show saved state, never to retry.
- **Voice:** bokmål "du" form, no exclamation marks or emoji on Host pages, errors say what happened and then what to do. Targets at least 44x44 px on Host controls, state never by colour alone, one `<h1>` per page, visible focus.

## Cross-Story Dependencies

- 8.5 builds on Epic 6 (play module, `PlayView`, `Board`, `TeamSetup`, fullscreen key, the full-round e2e, the axe pass) and on 8.1 (credit slot in the Team column, Question-set Games on the same pages). Extend those tests and checks rather than duplicating them.
- Amend in the 8.5 change: the spine (AD-17 polling and BroadcastChannel, Conventions route row), EXPERIENCE.md (route table, play view rules, Open Question 4), and the README and `tests/TRACE.md` and manual checklist rows for the new pages. PRD §4.7 still says one shared screen; record the supersession with a date, as earlier amendments did.
- 8.3 and 8.4 would add Host-side input and extra play state later. Neither exists; add no hooks for them, but keep anything typed by the Host off the TV page until confirmed.
- Depends on Epic 7 outputs: Demo mode (`npm run demo`), `tests/TRACE.md`, the manual checklist, the README Stage 2 section, all to be extended.
