# Epic 8 Context: Stage 2 - only after SM-1 passes

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Add the Stage 2 features on top of the finished Stage 1 loop. Done: ready-made Norwegian Question sets (FR-33, crowdsourced CC BY 4.0 ProtoQA part only) and a two-page play mode, a clean TV page for the room beside a Host page with the answer key and the controls. Both were started before SM-1 passed, by group decisions of 2026-11-23 and 2026-11-24. Story 8.6 made the two views the only way to play: the one-screen stage at `/spill/[id]/skjerm` is removed, play always runs on `/spill/[id]/vert` and `/spill/[id]/tv`, and Team setup moves to its own page `/spill/[id]/lag`. Stories 8.2 to 8.4 (reorder Groups, assisted Guess matching, strikes and steals) stay behind the SM-1 gate. Any departure from the architecture spine is amended in the same change.

## Stories

- Story 8.1: Play a ready-made Question set (FR-33), done
- Story 8.2: Reorder Groups in Review (FR-22), gated by SM-1
- Story 8.3: Assisted Guess matching (FR-28), gated by SM-1
- Story 8.4: Strikes and steals (FR-29), gated by SM-1, rules decided by the group first
- Story 8.5: Separate TV view and host view with answer key, done
- Story 8.6: Play needs two views: host view and TV view, implemented (spec: `.docs/implementation-artifacts/spec-8-6-play-needs-two-views-host-view-and-tv-view.md`)

## Requirements & Constraints

Play rules that hold on both views and must survive 8.6 unchanged:
- Team setup only from *ready*: two to four Teams, names 1 to 14 characters, Scores start at zero, then the Game is *playing*. Play cannot start from any other state.
- The room sees one Question at a time, Groups hidden with only the rank visible, the current Team and every Score. Question, labels, Counts, Team names and Scores are 48 px or more on a 1920x1080 view.
- Never shown in play: raw Answers, discarded Groups, Groups below the Board limit, Contributor data. The Host's answer key is Board content only.
- A click on a Group is a scored Reveal: label and Count appear and the Count goes to the current Team. A Score always equals the sum of its scored Reveals' Counts. A revealed Group is refused, enforced on the server.
- Undo removes only the latest Reveal on the current Question. Turns and Question changes are manual. Unscored Reveals change no Score. After the last Question the final Scores show and the Game moves to *played*.
- Play state survives a reload, so either view can be reopened at any time and shows saved state.
- The whole flow works with no model key and no network (FR-30, NFR-3). The Question-set source credit stays on the TV page. A Host action shows its result within 1 s (NFR-5). WCAG 2.1 AA is never cut (NFR-6). Bokmål (NFR-7).

Story conventions: every acceptance criterion has a proof label (unit, integration, e2e, manual); test titles carry FR IDs and rows go in `tests/TRACE.md`; lint, format, typecheck, `npm run test` and `npm run test:e2e` stay green offline; a new Host action gets a foreign-ID case in `tests/integration/authz.test.ts`; a new state-dependent operation gets a row in `src/lib/game-state.ts` and a `WRONG_STATE` case. Commit small and locally, never push. No Token, hash or Answer text in logs; no `.idea/` names in tracked files.

## Technical Decisions

Spine: `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md`.
- **AD-15:** play reads only `board_slot`, through `review.getBoard`. The TV payload comes from `play.load`, which strips hidden slots, so no hidden label or Count may appear in its markup or RSC data. The Host view reads `play.answerKey`. Question-set Games use the same pages.
- **AD-16:** the saved reveal log is the only truth. A BroadcastChannel message or a poll only triggers a re-read of saved state and is never trusted as state. Reveal, undo, next Team, next Question and finish stay as they are, and move-actions keep their stale-tab protections.
- **AD-4:** all play operations go through `games.lockForMutation`. No new state or transition is expected, including for 8.6.
- **AD-5:** every play page is owner-only through `auth.requireHost()`; missing, foreign and malformed ids get the same not-found. There is no token access for a TV on another device, so it needs the Host's login. Do not invent one without amending AD-5.
- **AD-17 (amended 2026-11-24):** the channel is same-origin `toppsvar-spill-{gameId}` with messages `changed` and `bom`; the TV also polls every `TV_POLL_MS` (2 s, in `src/lib/limits.ts`) while visible. No websockets, no new Route Handler, no client data library. Bom is not saved, so a TV on another device misses it.
- **Routes today (after 8.6):** `/spill/[id]/lag`, `/tv` and `/vert` share one state switch in `src/app/spill/[id]/play-page.tsx`. `/lag` shows Team setup in *ready* and redirects to the Game page in every other state. In *ready* `/tv` shows a waiting screen (Game title and "Spillet starter snart", only `F`) that moves into play on a channel `changed` from Team setup or on its next poll, and `/vert` redirects to `/lag`. *playing* shows the view, *played* shows Sluttstilling on `/tv` (no deletion line, no link) and the final standing on `/vert`, any other state redirects to the Game page. `/spill/[id]/skjerm` only redirects to `/spill/[id]`. After a start the Host lands on the Game page, which links "Vertsvisning med fasit" and "Åpne TV-visning". Client play logic lives in the `usePlay` hook on the Host view; `TvBoard` renders the room's page.
- **What 8.6 changed (kept for history):** `/skjerm` goes; `/lag` becomes the Team setup route (bokmål ASCII segment, owner-only, same not-found rule). Every link, redirect and test that points at `/skjerm` must move: the Game page's start, play and *played* links (and its advice about using the TV as an extended display), README, and the e2e and integration tests. The spine route row, EXPERIENCE.md route table and play-view rules, and PRD section 4.7 get a dated amendment, as 8.5 did. Code only the one-screen stage used goes too (ponytail is on); reuse `usePlay`, `HostPlay` and `TvBoard` rather than rebuilding. Not decided anywhere, so the 8.6 spec decides: what `/vert` and `/tv` show in *ready* once `/lag` exists, how the Host reaches the TV window after starting, and where the fullscreen key applies.
- **AD-22:** Playwright runs on `next build && next start` with a temporary PGlite and no outside network; the axe pass covers play.
- **From 8.1:** `review.createFromQuestionSet` composes the owners' writers and inserts via `games.insertReady`; the credit shows only when `game.question_set` is set; data is `data/question-sets/protoqa-nb.json`.
- **8.2 to 8.4, orientation only:** 8.2 adds a manual order to `answer_group` (touches AD-11, AD-15); 8.3 adds `match` to the one Judge interface (AD-13) and falls back to FR-25 with no key; 8.4 needs the group's rules first and is off by default. Add no hooks for them in 8.6.

## UX & Interaction Patterns

`DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win over the design skills. Run `impeccable` in Operate mode and read `reference/craft-floor.md` before UI changes.
- **Two token families:** *stage* tokens (mint accent, forest Count badge) for the TV only; *light* Host-page tokens (berry accent) for `/vert` and Team setup. No mint on light, no berry on stage, no red for a miss.
- **TV page:** fixed 1920x1080 canvas scaled and letterboxed, no control bar, no buttons, no shortcut overlay. The only key is `F` (fullscreen); `1`-`8`, `M`, `Z`, `T`, `U`, `N`, `→`, `?` do nothing. Staged Reveal of about 700 ms (instant under reduced motion), the "Bom" panel, "uten poeng" dashed tiles, "Svarer nå" on the active Team, "Vinner" or "Uavgjort" in Sluttstilling.
- **Host view (`/vert`):** light page, usable at 1280 px, answer key with each slot's label, Count and revealed or hidden state, Teams with Scores, "Åpne TV-visning" link, the same actions and shortcuts as buttons and keys (Bom, Angre, Neste lag, "Vis resten uten poeng" toggle, Neste spørsmål or Vis sluttstilling), a polite live status line, "Spillet slettes automatisk {dato}." in the final standing. Titles are "TV – {title}" and "Vertsvisning – {title}" so the two windows can be told apart.
- **Team setup (`/lag`):** the existing light Host form, "Hvem spiller?", prefilled "Lag 1" and "Lag 2", "Legg til lag" up to four, "Fjern" down to two, "Start spillet". Over-long name: "Navnet kan ha maks 14 tegn.".
- **Stale views:** with two windows, `NOT_FOUND`, `ALREADY_REVEALED` and `WRONG_QUESTION` become ordinary; refresh from the server and show saved state, never retry.
- **Voice and targets:** bokmål "du" form, no exclamation marks or emoji on Host pages, errors say what happened then what to do. Host controls at least 44x44 px, state never by colour alone, one `<h1>` per page, visible focus.

## Cross-Story Dependencies

- 8.6 builds on and partly reverses 8.5. The 8.5 rule that `/skjerm` stays unchanged no longer holds, so its tests must be removed or moved, not left failing. 8.5's `tv.spec.ts`, `play.test.ts` and TRACE rows are the base to extend.
- 8.6 also reworks Epic 6's full-round e2e (`play.spec.ts`, `no-key.spec.ts`) and the 8.1 Question-set e2e, which start play through `/skjerm`, plus manual checks A1, A7, A8, A9, which run against the TV page.
- Docs to amend with dated notes in the 8.6 change: spine, EXPERIENCE.md, DESIGN.md if the Host view changes, PRD section 4.7 and its generated `PRD.md` (run `./scripts/sync-brief.sh`), README, `tests/TRACE.md`, `tests/manual/checklist.md`, `epics.md` and `sprint-status.yaml`.
- Depends on Epic 7 outputs (Demo mode, TRACE, checklist, README Stage 2 section).
