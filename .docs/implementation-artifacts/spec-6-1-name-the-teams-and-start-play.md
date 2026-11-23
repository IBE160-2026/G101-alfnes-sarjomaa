---
title: 'Story 6.1: Name the Teams and start play'
type: 'feature'
created: '2026-11-23'
baseline_revision: '392120c04d1aa939d1c0811481027c39f359e75a'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-5-5-mark-questions-reviewed-and-lock-the-board.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Game that reaches *ready* has nowhere to go: the Game page carries a `shortcut:` placeholder for "Start spillet", `/spill/[id]/skjerm` does not exist, and there are no `team` or `play_state` tables, so nobody can play (FR-23). Story 6.1's two ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract.

**Approach:** Add the `play` module with `team` and `play_state` (AD-16), a `play.start` entry point that names two to four Teams and moves the Game from *ready* to *playing* under the Game lock, and a `play.load` read. Add `/spill/[id]/skjerm` with Team setup in *ready* and a play view shell in *playing*, "Start spillet" on the *ready* Game page and "Fortsett spillet" on the *playing* one.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (`full`), then `impeccable` ("Launcher unavailable" path). Read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` win on conflict. Team setup is Operate mode on a light Host page; WCAG 2.1 AA, 44 px targets, literal bokmål, no exclamation marks.
- **Schema (AD-16).** `team(id uuid pk default random, game_id → game ON DELETE CASCADE, name text, position int)`, unique `(game_id, position)`, checks `position between 1 and TEAMS_MAX` and `char_length(name) between 1 and TEAM_NAME_MAX`. `play_state(game_id uuid pk → game CASCADE, current_question_id → question CASCADE not null, current_team_id → team CASCADE not null)`. No `reveal` (Story 6.2). Generate the migration with `npm run db:generate` and commit it.
- **Limits** in `src/lib/limits.ts`: `TEAMS_MIN = 2`, `TEAMS_MAX = 4`, `TEAM_NAME_MAX = 14`.
- **Schemas** in a new `src/lib/play.ts`: `teamNameSchema` (string, trimmed, 1–14: "Laget trenger et navn." / "Navnet kan ha maks 14 tegn.") and `startPlaySchema = { gameId: string, teams: teamNameSchema[] of 2–4 }` ("Velg to til fire lag." for a wrong count). The client validates each field with `teamNameSchema`; the module validates the whole input again.
- **`play.start(hostId, input)`** (AD-1, AD-4, AD-5, AD-16), an entry point in `src/server/play/index.ts`, one transaction: validate; `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.startPlay })`; insert the Teams with position = index + 1 and the trimmed names; read the Game's Question with the lowest position; insert `play_state` pointing at it and at the Team in position 1; `games.transition(tx, gameId, "ready", "playing")`. Result `void`. Owner and state checks stay inside this one transaction.
- **`play.load(hostId, gameId)`**: `games.getOwned`, `WRONG_STATE` unless *playing*; returns `{ question: { position, text }, total, teams: { id, name, score, current }[] }` with Teams in position order. `score` is 0 for every Team until Story 6.2 adds `reveal` (comment `shortcut:` naming 6.2 and AD-11). Reads no `board_slot`, `answer` or `answer_group`.
- **Action** `startPlay(input)` in `src/app/spill/[id]/actions.ts` through `hostAction(play.start, input, "skjerm")`.
- **`/spill/[id]/skjerm/page.tsx`** (server). Owned Game (missing, foreign, malformed → `notFound()`). *ready* → Team setup; *playing* → play view from `play.load`; any other state → `redirect` to `/spill/[id]`. Metadata title: the Game title (not-found title for a missing Game, as the Game page does).
- **Team setup** (client `TeamSetup`, UX-DR22): `<h1>` "Hvem spiller?"; fields labelled "Navn på lag N", prefilled "Lag 1" and "Lag 2"; "Legg til lag" adds a field prefilled "Lag N" and focuses it, hidden at four; each row has "Fjern" (accessible name "Fjern lag N") only while there are more than two, and removal focuses "Legg til lag". Submit validates every field: errors under the field via `TextField`'s `error`, focus to the first invalid field, a field's error clears when it is edited. "Start spillet" (primary, pending "Starter …") calls the action. Success: the revalidated page swaps to the play view and focus goes to its `<h1>` (CloseCollection's unmount pattern). Failures: `WRONG_STATE` → danger Notice "Spillet har allerede startet." with a link "Gå til spillet" to `/spill/[id]`; `NOT_FOUND` → `router.refresh()`; a rejected call → `NETWORK` plus `router.refresh()`; anything else → its message. No live region.
- **Play view shell** (server `PlayView` + client `FullscreenKey`): a full-window stage (`data-stage`, `bg-stage`, `text-stage-ink`, inverse focus ring) with the Question as `<h1>` (`text-tv-question` up to 80 characters, `text-tv-question-long` above), a Team column headed "Spørsmål N av M" in `text-tv-team` `stage-muted`, the current Team as a `stage-accent` card with "Svarer nå" above its name, every Team's name (48 px) and Score (80 px, tabular, with sr-only " poeng"), and the hint "Trykk F for fullskjerm." in `text-tv-control` `stage-muted`. `F` (no modifiers, not in a text field, not a repeat) toggles fullscreen; the hint is hidden while fullscreen. The Host chrome (skip link and header) is hidden while a `[data-stage]` element is on the page, by a CSS `:has` rule on a `data-host-chrome` marker. A `shortcut:` comment notes that the 1920×1080 canvas, Board tiles and control bar arrive in Stories 6.2 and 6.3.
- **Game page.** *ready*: keep "Brettet er låst" and the count, add the primary link "Start spillet" to `/spill/[id]/skjerm` (same classes as "Gå til gjennomgangen"), and remove the `shortcut:` comment. *playing*: a section `<h2>` "Spillet er i gang" with "Spørsmål N av M." and each Team's name and Score in a `dl`, plus the primary link "Fortsett spillet" to `/spill/[id]/skjerm`.
- FR IDs in test titles, rows in `tests/TRACE.md`, offline, no key, no real names. Commits in Norwegian are made in the finalize step.

**Never:**
- No `reveal` table, `review.getBoard`, Board tiles, control bar, 1920×1080 canvas or live-region announcements (Stories 6.2–6.4). No *played* view (6.4: redirect for now).
- No Team rename, reorder or delete after start; no duplicate-name rule (nothing asks for one).
- No new Route Handler, client data library or dependency; no optimistic update; no per-file Vitest timeouts.
- Do not touch `.env`, `.logs/`, `prompting/` or `.claude/skills/excalidraw-diagram/`; no absolute machine paths in tracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start | *ready*, Questions at positions 1–3, teams `[" Hyttegjengen ", "Lag 2"]` | two `team` rows (positions 1, 2, names trimmed); `play_state` → Question 1 and Team 1; *playing*; `load` gives scores `[0, 0]`, Team 1 current | — |
| Four, boundary | four names, one exactly 14 characters | four rows in order | — |
| Bad count | one or five names | nothing written, still *ready* | `INVALID_INPUT` |
| Bad name | `""`, `"   "`, 15 characters | nothing written | `INVALID_INPUT` with `fieldErrors.teams` |
| Wrong state | draft, collecting, grouping, in_review, playing, played | nothing written | `WRONG_STATE` |
| Foreign | Host B on A's Game, a random UUID, a malformed id | nothing written, A still *ready* | `NOT_FOUND` |
| Load early | `load` on a *ready* Game | — | `WRONG_STATE` |
| Delete | delete a *playing* Game | its `team` and `play_state` rows are gone | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- add `team` and `playState` after `boardSlot`, following its `check`/`uniqueIndex` style; `drizzle/0012_*.sql` and snapshot via `npm run db:generate`.
- `src/lib/limits.ts`, new `src/lib/play.ts` -- constants and schemas (pattern: `src/lib/review.ts` `renameGroupSchema`).
- `src/lib/game-state.ts` -- `PERMITTED.startPlay = ["ready"]` exists; `canTransition("ready","playing")` exists.
- `src/server/games/index.ts` -- `lockForMutation` :120, `transition` :184, `getOwned` :74.
- new `src/server/play/index.ts` -- `start`, `load`; pattern `review.confirmBoard` (`src/server/review/index.ts` :449) and `withBoundary`. `eslint.config.mjs` already lists `play` last in `MODULES`, so it may import every other module; reading `question` directly is fine (review does too).
- `src/app/spill/[id]/actions.ts` -- `hostAction` :42; add `startPlay`.
- `src/app/spill/[id]/page.tsx` -- *ready* branch :205 (the `shortcut:`), add a *playing* branch; the "Gå til gjennomgangen" link classes :195.
- new `src/app/spill/[id]/skjerm/page.tsx` -- pattern: `src/app/spill/[id]/gjennomgang/page.tsx` (owned Game, redirect for wrong state, metadata).
- new `src/components/TeamSetup.tsx` -- reuse `Button`, `TextField`, `Notice`, `callAction`/`NETWORK` (`useFormAction.ts`), `focusHeading` (`RouteFocus.tsx`); CloseCollection's `acted` ref + unmount focus pattern (`src/components/CloseCollection.tsx` :35–:56).
- new `src/components/PlayView.tsx`, `src/components/FullscreenKey.tsx` -- stage tokens in `src/app/globals.css` (`--color-stage*`, `--text-tv-*`); inverse ring pattern `[&_:focus-visible]:outline-focus-inverse` (`ReviewGroups.tsx` :472).
- `src/components/HostChrome.tsx`, `src/app/globals.css` -- `data-host-chrome` on skip link and header; one `body:has([data-stage]) [data-host-chrome] { display: none }` rule.
- Tests: `tests/integration/review.test.ts` (`reviewGame` :104, Game-page render :611, *ready* page test :1772); `tests/integration/authz.test.ts` (:402 pattern); `tests/integration/delete.test.ts` (catalog-driven cascade check covers new tables); `tests/integration/next-mocks.ts` (`RedirectError`); `tests/e2e/review.spec.ts` helpers `submitSets` :31, `collectingGame` :63, `closeAndOpenReview` :93 with `QUESTION` and `SETS` (move to `tests/e2e/fixtures.ts` unchanged so play reuses them); `tests/e2e/fixtures.ts` `seriousViolations`, `FOCUS_RING_INVERSE`.

## Tasks & Acceptance

**Execution:**
- `src/lib/limits.ts`, `src/lib/play.ts` -- limits and schemas.
- `src/server/db/schema.ts`, `drizzle/` -- `team`, `play_state`, generated migration.
- `src/server/play/index.ts` -- `start`, `load`.
- `src/app/spill/[id]/actions.ts` -- `startPlay`.
- `src/components/TeamSetup.tsx`, `src/components/PlayView.tsx`, `src/components/FullscreenKey.tsx`, `src/app/spill/[id]/skjerm/page.tsx` -- the route.
- `src/components/HostChrome.tsx`, `src/app/globals.css` -- hide the chrome under the stage.
- `src/app/spill/[id]/page.tsx` -- "Start spillet", the *playing* panel; shortcut removed.
- `tests/integration/play.test.ts` (new) -- every matrix row except Foreign; `updated_at` touched on start; the `startPlay` action's ok and Failure shapes; the skjerm page renders Team setup in *ready* ("Hvem spiller?", "Lag 1", "Lag 2") and the play view in *playing* ("Spørsmål 1 av 3", "Svarer nå", names, "Trykk F for fullskjerm."), and redirects for every other state; the Game page links "Start spillet" in *ready* and "Fortsett spillet" in *playing*.
- `tests/integration/authz.test.ts` -- the Foreign row for `play.start`, `startPlay` and `play.load`.
- `tests/integration/review.test.ts` -- the *ready* page test also expects the "Start spillet" link.
- `tests/e2e/fixtures.ts`, `tests/e2e/review.spec.ts` -- move the three flow helpers and `QUESTION`, `SETS` (pure move).
- `tests/e2e/play.spec.ts` (new) -- AC2: a collecting Game's `/skjerm` redirects to the Game page; through Review and lock to *ready*; "Start spillet" → `/skjerm` with "Hvem spiller?", "Lag 1"/"Lag 2", no "Fjern" at two, "Legg til lag" to four (then hidden), "Fjern" back to three with focus on "Legg til lag", the empty-name and 15-character errors with focus on the field; axe clean on setup; a second tab opened before the start; start → the play view with the hint, focus on the Question `<h1>`, the Host header hidden, "Svarer nå" on Team 1, scores 0, axe clean; `F` hides the hint (fullscreen); the stale tab's start shows "Spillet har allerede startet." and "Gå til spillet" works; the Game page shows "Fortsett spillet", which resumes the same Teams after a reload.
- `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- FR-23, UX-DR22 rows; 6-1 done, epic-6 in-progress.

**Acceptance Criteria:**
- Given a *playing* Game, when the Host reloads `/spill/[id]/skjerm`, then the same Teams, the current Team and Question 1 are shown from the server.
- Given the play view, when a screen reader user lands on it, then no Host chrome is reachable and the focus ring is the inverse one.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 37 findings — high 0, medium 1, low 22, false 14, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind: `play.load` crashes on a *playing* Game with no `play_state` row, and `start` assumes a first Question — unreachable: `play_state` is inserted in the same transaction as the move to *playing*, it cascades only with the Game, a Question or a Team, and Questions and Teams are frozen; a *ready* Game always has a Question, since Invite links are refused with zero Questions (FR-5) and Questions freeze after *draft*. Only tests that inserted a *playing* row by hand hit it, and those now start play for real.
  - `[low]` `[reject]` Blind: `play_state` can point at another Game's Question or Team, and the DB check lets a blank name through — only `play.start` writes either table, it resolves both inside the locked Game, and zod trims before the check; a composite foreign key adds schema for a state no code path creates.
  - `[low]` `[patch]` Blind: a server `INVALID_INPUT` shows "Sjekk feltene som er merket" with no field marked — the Notice now shows `fieldErrors.teams` (for example "Velg to til fire lag.") and falls back to the message.
  - `[low]` `[patch]` Blind: "Legg til lag" can prefill a name that is already used — the default now comes from the monotonic row key, so after removing a middle row the new field gets "Lag 4", not a second "Lag 3".
  - `[low]` `[reject]` Blind: the fullscreen hint shows on browsers without the Fullscreen API, and the call throws — the play view runs on a laptop browser mirrored to a TV, and every current desktop browser has the unprefixed API; a support guard adds a branch for a device the product does not target.
  - `[low]` `[patch]` Blind: after a rejected call that the server committed, the refresh swaps in the play view but focus falls to `<body>` — the rejected-call branch now arms the same unmount focus move as a success.
  - `[low]` `[reject]` Blind: `/skjerm` has no stage loading state ("Henter spillet …") — the Game route's skeleton appears only after 300 ms, so a normal load never shows it, and one loading file cannot serve both the light Team setup and the dark stage; the stage loading state belongs with the canvas in Story 6.2.
  - `[low]` `[patch]` Blind: the long-Question branch (`text-tv-question-long` above 80 characters) is untested — an integration case now renders 80 and 81 characters and asserts both classes.
  - `[false]` `[reject]` Blind: sprint status says done while the spec says in review — the finalize step sets the spec to done in the same commit series; the reviewers saw the run mid-way.
  - `[low]` `[patch]` Blind: `epic-6-context.md` says 6.1 creates `review.getBoard` and puts the actions in `skjerm/actions.ts` — corrected: `review.getBoard` and `reveal` are Story 6.2's (its story cites AD-15), and actions live in `src/app/spill/[id]/actions.ts` with schemas in `src/lib/play.ts`, so Stories 6.2–6.4 do not build a second actions file.
  - `[low]` `[patch]` Blind: the Team list has no accessible name and the current Team is marked only by text and colour — the `<ol>` is labelled "Lag" and the current `<li>` has `aria-current`.
  - `[low]` `[reject]` Blind: the *playing* setup is repeated in four test files — two or three lines each; a shared helper is worth it when 6.2 adds reveals to the setup.
  - `[low]` `[reject]` Blind: the e2e test is one long flow and one integration assertion depends on class order — the same structure as every Review e2e test in the repo (reaching *ready* through the UI costs most of the run), and the class assertion fails loudly, never silently.
  - `[medium]` `[patch]` Verification gap: Team setup's rejected-call (`NETWORK`) path is untested — e2e now aborts the start POST once and asserts the focused alert "Fikk ikke kontakt. Sjekk nettet og prøv igjen." with Team setup still shown. The `NOT_FOUND` refresh (reachable only by deleting the Game in another tab) is left, as in Story 5.5.
  - `[low]` `[patch]` Verification gap: the modifier guard on `F` is untested — e2e now presses Ctrl+F first and asserts no fullscreen and a visible hint.
  - `[low]` `[patch]` Verification gap (other): the rejected-call path does not arm the focus move — same root cause and patch as the Blind focus row.
  - `[false]` `[reject]` Intent: `review.getBoard` is not added although the epic context assigned it to 6.1 — Story 6.1 cites AD-4 and AD-16 only, and Story 6.2 cites AD-15 and `review.getBoard`; the context file was the error and is corrected (see the Blind context row).
  - `[false]` `[reject]` Intent: play reads the `question` table directly, not through `review` — AD-15's rule is about the Board, and the Question text is not in `board_slot`; `review` reads `question` directly the same way, and play reads no Board data in this story.
  - `[low]` `[patch]` Intent: the actions and schemas are not where the epic context says — same root cause and patch as the Blind context row.
  - `[false]` `[reject]` Intent: "every Score is zero" is a literal, not a sum — with no `reveal` table the sum over a Team's reveals is zero by definition; the literal carries a `shortcut:` naming Story 6.2 and AD-11.
  - `[false]` `[reject]` Intent: one and five Teams cannot be reached through the UI — that is the design (the form never offers them); AC1 tags the refusals as integration, and they are tested at the module and action.
  - `[false]` `[reject]` Intent: e2e checks the redirect only for *collecting* — the other states are covered by the integration render of the screen page; AC2's e2e tag is met by one state.
  - `[false]` `[reject]` Intent: a *playing* Game without `play_state` breaks the Game page — unreachable, as in the first Blind row.
  - `[false]` `[reject]` Intent: status bookkeeping differs between spec and sprint status — mid-run state, as in the Blind row.
  - `[false]` `[reject]` Intent: the play view shell, `F`, the hidden chrome and the *playing* panel go beyond AC1's text — AC2 requires the play view with its hint, the hint requires a working key, and EXPERIENCE gives *playing* "Current Question and Scores" with "Fortsett spillet".
  - `[false]` `[reject]` Edge: a *ready* Game with zero Questions crashes `start` — unreachable, as in the first Blind row.
  - `[false]` `[reject]` Edge: a *playing* Game without `play_state` crashes `load` — unreachable, as in the first Blind row.
  - `[low]` `[reject]` Edge: a delete or state change between the screen page's two reads shows the error page — the window is two consecutive reads in one request, and *playing* only leaves by deletion (6.4 adds *played*); catching it adds branches for a race nobody meets.
  - `[false]` `[reject]` Edge: a failing `play.load` takes down the whole Game page — the same unreachable missing-row state.
  - `[low]` `[patch]` Edge: rejected call loses focus — same as the Blind focus row.
  - `[low]` `[patch]` Edge: server `fieldErrors.teams` not shown — same as the Blind `INVALID_INPUT` row.
  - `[low]` `[patch]` Edge: duplicate default name after removing a middle row — same as the Blind prefill row.
  - `[low]` `[reject]` Edge: a name of only zero-width characters passes — nobody types those by accident, and the Host sees the field; a Unicode rule adds a refine for a case no user meets.
  - `[low]` `[reject]` Edge: zod counts UTF-16 units, the DB check code points, so eight emoji are refused as too long — client and server agree (both use zod), so the user gets a consistent message; the 14-character limit exists for width, and emoji are wider than letters anyway.
  - `[low]` `[reject]` Edge: no Fullscreen API on some browsers — same as the Blind fullscreen row.
  - `[low]` `[patch]` Edge: the hint shows if the view mounts while fullscreen is already on — `FullscreenKey` now reads the state once on mount.
  - `[false]` `[reject]` Edge: the spec says "No live region" but the Notice is `role="alert"` — the danger Notice is the house error pattern used by every failure path; the spec rule is about announcement regions, which the play view gets in Story 6.2.

## Design Notes

- **Chrome-less stage without moving routes.** The play view must have no Host top bar, but `src/app/spill/layout.tsx` wraps every Host page in `HostChrome`. Moving `/skjerm` out of the layout would duplicate its auth and purge. A `display: none` rule keyed on `body:has([data-stage])` removes the header and skip link from both view and tab order, which is the same `:has` technique `HostChrome` already uses for `data-wide`.
- **Score is a literal 0 for now.** AD-11 defines Score as a sum over `reveal`, which Story 6.2 adds. Story 6.1 returns `0` with a `shortcut:` comment rather than adding a table out of its story.
- **`F` arrives here, not in 6.3,** because AC2 promises the hint "Trykk F for fullskjerm." on this view; a hint for a dead key would be false.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, axe clean on Team setup and the play view.

## Auto Run Result

Status: done

**Summary.** The Host can name two to four Teams and start play, and a started Game can be resumed.
- `play.start` validates two to four names of 1–14 characters (trimmed), and in one transaction under the Game lock stores the Teams in order, points `play_state` at the first Question and Team 1, and moves the Game from *ready* to *playing*. Any other state is `WRONG_STATE`; a foreign, random or malformed Game is `NOT_FOUND`.
- `play.load` reads the saved state for the screen and the Game page. Every Score is 0 until Story 6.2 adds reveals (`shortcut:` comment).
- `/spill/[id]/skjerm` shows Team setup in *ready* ("Hvem spiller?", "Lag 1"/"Lag 2", "Legg til lag" up to four, "Fjern" down to two, the two field errors) and the play view shell in *playing* (the Question, "Spørsmål N av M", "Svarer nå" on the current Team, Scores, "Trykk F for fullskjerm." with a working `F`). Other states redirect to the Game page. The Host chrome is hidden under the stage.
- The *ready* Game page links "Start spillet"; its `shortcut:` comment is gone. The *playing* Game page shows the Question, the Teams with Scores and "Fortsett spillet".
- A stale tab's start says "Spillet har allerede startet." with "Gå til spillet"; a lost connection says "Fikk ikke kontakt. Sjekk nettet og prøv igjen.".

**Files changed.**
- `src/server/db/schema.ts`, `drizzle/0012_living_jackpot.sql`, `drizzle/meta/*` -- `team` and `play_state`.
- `src/lib/limits.ts`, `src/lib/play.ts` -- Team limits and schemas.
- `src/server/play/index.ts` -- `start`, `load`.
- `src/app/spill/[id]/actions.ts` -- `startPlay`.
- `src/app/spill/[id]/skjerm/page.tsx`, `src/components/TeamSetup.tsx`, `src/components/PlayView.tsx`, `src/components/FullscreenKey.tsx` -- the screen route.
- `src/components/HostChrome.tsx`, `src/app/globals.css` -- chrome hidden under the stage.
- `src/app/spill/[id]/page.tsx` -- "Start spillet" and the *playing* panel.
- `tests/integration/play.test.ts` (new), `authz.test.ts`, `review.test.ts`, `delete.test.ts` and `report.test.ts` (their *playing* Game is now started for real, since the Game page reads `play_state`), `tests/e2e/play.spec.ts` (new), `tests/e2e/fixtures.ts` and `review.spec.ts` (three flow helpers moved unchanged), `tests/TRACE.md`.
- `.docs/implementation-artifacts/epic-6-context.md` (new, corrected in review), `sprint-status.yaml` (6-1 done, epic-6 in-progress).

**Review findings.** One pass, 37 findings (0 high, 1 medium, 22 low, 14 false).
- Patched, 9 entries (1 medium, 8 low): the aborted-start e2e step; the Ctrl+F e2e check; focus after a rejected call that committed; the server field error in the Notice; non-repeating default names; the long-Question test; `aria-label` and `aria-current` on the Team list; the fullscreen state read on mount; the epic context corrected.
- Deferred: none.
- Rejected: every other row, each with its reason in the triage log (unreachable states, browsers the product does not target, races inside one request, and test-structure preferences).

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (planning).** The compiled epic context said Story 6.1 creates `review.getBoard` and puts actions in `skjerm/actions.ts`. The story text gives `review.getBoard` to 6.2 (it cites AD-15) and the repo keeps Host actions in `src/app/spill/[id]/actions.ts`, so the spec followed the story and the context file was corrected in review.
- **Corrected (implementation output, found in review).** A rejected start lost focus; a server field error showed a "marked fields" sentence with nothing marked; "Legg til lag" could prefill a duplicate name; the Team list had no name and no `aria-current`; the network path, the Ctrl+F guard and the long-Question size had no test.
- **Rejected (reviewer suggestions).** Guards for a *playing* Game without `play_state` and a *ready* Game without Questions (both unreachable); a composite foreign key on `play_state`; a Fullscreen-API support check; a stage loading state in this story; Unicode and emoji length rules; splitting the e2e flow and a shared test helper.
- **Corrected in orchestration.** The platform ran the implementation agent and the four reviewers in the background, although the workflow asks for blocking calls. Each result was awaited before the next step, so nothing was skipped.

**Verification.** `npm run lint` clean; `npm run typecheck` clean; `npm run test` 696 passed (42 files); `npm run test:e2e` 92 passed, axe clean on Team setup and the play view. All offline, no key.

**Follow-up review recommendation:** false. One `medium` entry was patched (a missing test, now present), below the threshold of two.

**Residual risks.** `F` fullscreen is verified in headless Chromium only, not on a real TV. The play view is a fluid shell until Story 6.2's 1920×1080 canvas; at small windows it scrolls.
