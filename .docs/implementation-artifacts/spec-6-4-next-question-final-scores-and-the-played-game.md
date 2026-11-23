---
title: 'Story 6.4: Next Question, final Scores and the played Game'
type: 'feature'
created: '2026-11-23'
baseline_revision: '1712e9d4d815a204bbdebcd6f9da89d0301e6b01'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-6-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-6-3-misses-undo-turns-and-unscored-reveals.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      Manual timing row T8 (Neste spørsmål and Vis sluttstilling within one second) is recorded but not yet run.
    evidence: |-
      NFR-5 timing is checked by hand with a stopwatch against the running app, like T1 to T7. An unattended run has no person to do it.
    location: >-
      tests/manual/checklist.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** The play view stays on Question 1 forever: the Host cannot move to the next Question, the round never ends, a *played* Game's screen redirects to the Game page (a `shortcut:` from Story 6.1), and the Game page shows nothing for *played* (FR-3, FR-27). Story 6.4's three ACs in `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` are the contract. Story 6.3 also left one assertion for this story: the "Vis resten uten poeng" toggle switches off on the next Question.

**Approach:** Add `play.nextQuestion` (AD-16: the smallest greater position, or `finish` → *played* with `deleteAfter`) behind one Server Action, `play.finalScores` for the *played* reads, the "Neste spørsmål [N]" / "Vis sluttstilling [N]" control with `N` and `→`, the "Sluttstilling" stage on `/spill/[id]/skjerm`, and the *played* panel on the Game page.

## Boundaries & Constraints

**Always:**
- First invoke `ponytail` (`full`), then `impeccable` ("Launcher unavailable" path: read `DESIGN.md`/`EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/` directly). Read `.claude/skills/impeccable/reference/craft-floor.md` right before UI edits. The design contract wins on conflict. Stage rules from 6.2/6.3 hold: inverse focus ring, 44 px targets, bokmål "du", no exclamation marks, no berry, no red, no shadows, no-break space before "…", nothing the room reads below 48 px.
- **Schema** in `src/lib/play.ts`: `nextQuestionSchema = z.object({ gameId: z.string(), position: z.number().int() })`, where `position` is the Question position the Host's screen shows.
- **`play.nextQuestion(hostId, input)`**, one transaction: validate; `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.playMove })`; read the current Question's position through `play_state`; if it is not `position` → `WRONG_QUESTION` (a stale tab or a double press must never skip a Question or end the Game). Otherwise take the Game's Question with the smallest `position` greater than it: if one exists, set `play_state.current_question_id` to it (the current Team is unchanged) and return `{ finished: false, position }`; if none, call a module-private `finish(tx, gameId)` that runs `games.transition(tx, gameId, "playing", "played")` and returns `{ finished: true, deleteAfter }` with `deleteAfter = played_at + RETENTION_PLAYED_MS` (`src/lib/limits.ts`). `PERMITTED.finishPlay` equals `playMove`; say so in one comment.
- **`games.transition`** returns `{ playedAt: Date | null }` from its `returning`, so `finish` gets the `played_at` it set; existing callers ignore it. **`games.getOwned`** also selects `playedAt`.
- **`play.finalScores(hostId, gameId)`**: `games.getOwned`; state not *played* → `WRONG_STATE`; returns `{ teams: { id, name, score }[], deleteAfter }`, Teams sorted by Score descending, ties in Team position order. Score is the same SQL sum as `play.load` (AD-11): extract the Teams-with-Scores query into one module-private helper used by both.
- **Error message**: `WRONG_QUESTION` now reads "Spillet er på et annet spørsmål nå." so it fits both a reveal and a next-Question refusal (update the 6.2 test that asserts the old text).
- **Action** `nextQuestion(input)` in `src/app/spill/[id]/actions.ts` through `hostAction(..., "skjerm")`. One round trip, no `router.refresh()` on success (NFR-5): the revalidated screen page re-renders to the next Question or to "Sluttstilling" in the same response.
- **Board (client)**: new prop `total`. The control "Neste spørsmål [N]", or "Vis sluttstilling [N]" when `questionPosition === total`, is a `CONTROL` button after the toggle and before "?"; when every tile is revealed it reads in `font-bold text-stage-ink` (EXPERIENCE: "emphasised"). It calls `nextQuestion` through the existing `run()` (one move at a time, same failure handling; `WRONG_QUESTION` is already a silent refresh). On `{ finished: false, position }` the live region says "Spørsmål {position} av {total}."; on `finished` nothing (the page swaps). Shortcuts `n` (case-insensitive) and `ArrowRight`, with the existing guards (no modifier, no repeat, not in a text field or the open overlay). The overlay list gains `["N, →", "Neste spørsmål"]` before `F`. The uten-poeng toggle needs no change: it is held as the Question position, so it is off on the next Question.
- **PlayView** passes `total` to `Board`.
- **Final Scores** (`FinalScores` server component in `src/components/PlayView.tsx`, `/spill/[id]/skjerm` for a *played* Game): the same `data-stage` + `stage-canvas` 1920×1080 canvas. A centred column (about 1120 px wide), vertically centred: `<h1>` "Sluttstilling" in `text-tv-question`; an `<ol aria-label="Sluttstilling">` of Team cards in `finalScores` order, each a row with the status word (if any) and the Team name in `text-tv-team` on the left and the Score in `text-tv-score-final` (120 px) `tabular-nums` on the right with sr-only " poeng". The top Score: a single Team gets "Vinner"; when two or more Teams share it, each of them gets "Uavgjort". Those cards take the `team-score-active` look (`bg-stage-accent text-stage-on-accent`), the rest `bg-stage-raised`. Below, in `text-tv-control` (24 px): "Spillet slettes automatisk {formatDate(deleteAfter)}." in `text-stage-muted` and a `next/link` "Tilbake til spillet" to `/spill/{id}` (`text-stage-ink`, underlined, at least 44 px high). All of it fits 1080 px with four Teams. The heading takes focus on mount through a small client component in `src/components/RouteFocus.tsx` that calls `focusHeading()`, since the Board and its live region unmount when the Game finishes.
- **`/spill/[id]/skjerm` page**: *played* → `<FinalScores gameId={...} {...await play.finalScores(hostId, id)} />`; the 6.1 `shortcut:` comment goes. Other non-*ready*, non-*playing* states still redirect to the Game page.
- **Game page, *played* panel** (`src/app/spill/[id]/page.tsx`): `<section aria-labelledby="sluttstilling">`, `<h2>` "Sluttstilling", the Teams with Scores as a `dl` like the *playing* panel's (in `finalScores` order), the primary link "Vis sluttstilling" to `/spill/{id}/skjerm` (`PRIMARY_LINK`), and `<Notice tone="info">` "Spillet og alle svarene slettes automatisk {formatDate(deleteAfter)}.".
- **Manual checklist**: timing row T8 "Neste spørsmål to the next Question, and Vis sluttstilling to Sluttstilling, each within one second" (NFR-5, FR-27).
- FR IDs in test titles, rows in `tests/TRACE.md` (replace the "Pending: Story 6.4" lines), offline, no key, no real names, no per-file Vitest timeouts. Commits in Norwegian are made in the finalize step.

**Never:**
- No going back to an earlier Question, no confirmation dialog before "Vis sluttstilling", no automatic turn change on a new Question, no Stage 2 features.
- No new Route Handler, client data library, websocket, dependency, optimistic update or test-only server hook. No `wiki/` edits (decisions go in this spec).
- Do not touch `.env`, `.logs/`, `prompting/` or `.claude/skills/excalidraw-diagram/`; no absolute machine paths in tracked files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Next Question | on Q1 (Q1 has a Reveal), `position: 1` | `play_state` → Q2, Team unchanged; `{ finished: false, position: 2 }`; `load` shows Q2 with every slot hidden; Q1's Reveal and Scores kept | — |
| Finish | on Q3 of 3, `position: 3` | state *played*, `played_at` set; `{ finished: true, deleteAfter: played_at + 30 d }` | — |
| Played | the Game just finished | `reveal`, `undo`, `nextTeam`, `nextQuestion`, `start` and `load` refused, nothing written | `WRONG_STATE` |
| Stale position | on Q2, `position: 1` or `3` | nothing written | `WRONG_QUESTION` |
| Bad input | missing `gameId` or `position`, `position: "2"` or `1.5` | nothing written | `INVALID_INPUT` |
| Wrong state | *ready* | nothing written | `WRONG_STATE` |
| Foreign Host | Host B on A's *playing* Game, random UUID, `abc` | A's `play_state` unchanged; `finalScores` on A's *played* Game refused | `NOT_FOUND` |
| Final order | Scores 3, 7, 7 by position | `finalScores` order: position 2, 3, 1; both 7s "Uavgjort", no "Vinner" | — |
| Final not played | `finalScores` on *playing* | — | `WRONG_STATE` |

</intent-contract>

## Code Map

- `src/server/play/index.ts` -- `load` (:76) holds the Teams-with-Scores query (:93–:106) to extract; `reveal` (:141) is the transaction pattern; `nextTeam` (:231) is the closest shape for `nextQuestion`. Imports `gt` from drizzle-orm.
- `src/server/games/index.ts` -- `getOwned` (:80) select; `transition` (:184) already sets `playedAt` for `played` and returns `{ id }` (:197) — return `playedAt` instead.
- `src/lib/limits.ts` -- `RETENTION_PLAYED_MS` (:44). `src/lib/format.ts` -- `formatDate` ("22. november 2026", Europe/Oslo).
- `src/lib/play.ts` -- add `nextQuestionSchema` beside `playGameSchema`. `src/lib/errors.ts` (:41) -- `WRONG_QUESTION` message.
- `src/app/spill/[id]/actions.ts` -- `hostAction` (:42); add `nextQuestion` after `passTurn`.
- `src/components/Board.tsx` -- `run()` (:72), `STALE` (:12, already has `WRONG_QUESTION`), `SHORTCUTS` (:24), key listener (:161), `allRevealed` (:66), control bar (:270), toggle held as `unscoredFor` (:58).
- `src/components/PlayView.tsx` -- `STAGE` class, `PlayView`, `StageLoading`; add `FinalScores`.
- `src/components/RouteFocus.tsx` -- `focusHeading()` to reuse for the mount-focus helper.
- `src/app/spill/[id]/skjerm/page.tsx` -- `ownedGame` (:15), the redirect with the 6.1 `shortcut:` (:47).
- `src/app/spill/[id]/page.tsx` -- the *playing* panel (:216) is the pattern for the *played* one; `Notice` from `src/components/Notice.tsx`.
- `tests/integration/play.test.ts` -- `gameIn` (three Questions, Boards 3/2/1 slots), `playing()`, `revealsOf`, `scoresOf`, `rowsOf`, `codeOf`, `screen`, `gamePage`, `text`; `moveTo` (:491) stays for the undo tests and the property test, which wraps back to Q1 (fix its comment); the 6.2 `WRONG_QUESTION` message (:436); the skjerm redirect `it.each` (:438) lists `played` — remove it there; the *ready*/*played* `WRONG_STATE` `it.each` blocks (:475, :635) cover seeded states (no `played_at`), so the real finish gets its own test.
- `tests/integration/authz.test.ts` -- the 6.3 undo/next-Team foreign-Host row (:582) is the pattern; `NotFoundError` for pages (:195).
- `tests/integration/purge.test.ts` (:212) -- checks `transition` sets `played_at`; still passes.
- `tests/e2e/play.spec.ts` -- `playingGame` (:420) is one Question; the 6.1 test counts 12 buttons (now 13, its one Question shows "Vis sluttstilling [N]"); the 6.3 test asserts the bar does not overflow at its fullest state. `tests/e2e/fixtures.ts`: `collectingGame(page, questions)`, `submitSets(browser, baseURL, links, sets)`, `closeAndOpenReview`, `seriousViolations`, `SETS`, `QUESTION`. `tests/e2e/review.spec.ts` (:23, :845) shows a multi-Question mark flow (marking moves Review to the next unreviewed Question).
- `tests/manual/checklist.md` (Timing table, T7 last), `tests/TRACE.md` (FR-3 :47, FR-27 :360, NFR-5 :429 "Pending: Story 6.4" lines), `.docs/implementation-artifacts/sprint-status.yaml`.

## Tasks & Acceptance

**Execution:**
- `src/lib/play.ts`, `src/lib/errors.ts` -- `nextQuestionSchema`; `WRONG_QUESTION` message.
- `src/server/games/index.ts` -- `playedAt` in `getOwned`; `transition` returns `{ playedAt }`.
- `src/server/play/index.ts` -- shared Scores helper, `nextQuestion` with private `finish`, `finalScores`; export the result types.
- `src/app/spill/[id]/actions.ts` -- `nextQuestion`.
- `src/components/Board.tsx`, `src/components/PlayView.tsx`, `src/components/RouteFocus.tsx` -- the control, shortcuts, overlay row, `total`; `FinalScores`; the mount-focus helper.
- `src/app/spill/[id]/skjerm/page.tsx`, `src/app/spill/[id]/page.tsx` -- *played* branches.
- `tests/integration/play.test.ts` -- AC1 through the `nextQuestion` action: Q1 → Q2 → Q3 → finished, each with the result shape, `play_state`, unchanged current Team, the new Question's slots hidden in `load`, earlier Reveals and Scores kept, both paths revalidated; at finish `state` *played*, `played_at` within the test's clock window and `deleteAfter` exactly `played_at` + 30 days; then every play operation and action plus `load` is `WRONG_STATE` and nothing changes. Stale position, bad input and *ready* rows from the matrix. `finalScores` order/tie row and *playing* → `WRONG_STATE`. AC3: the screen page of a finished Game renders "Sluttstilling", the Teams in Score order, "Vinner" on the winner, "Spillet slettes automatisk {dato}." and "Tilbake til spillet" to the Game page; a tied Game shows "Uavgjort" on each tied Team and no "Vinner"; the Game page shows the Teams with Scores, the "Vis sluttstilling" link and "Spillet og alle svarene slettes automatisk {dato}.", the date from `formatDate(played_at + 30 d)`.
- `tests/integration/authz.test.ts` -- Foreign Host row: B's `play.nextQuestion` and `nextQuestion` on A's *playing* Game, a random UUID and `abc` are `NOT_FOUND` and A's `play_state` and state are unchanged; B's `play.finalScores` on A's *played* Game is `NOT_FOUND`, and the screen page calls `notFound()`.
- `tests/e2e/play.spec.ts` -- update the 6.1 button count; new test on a three-Question Game (`QUESTION` with `SETS`; Q2 with sets `[["Rød"], ["Blå"], ["Rød"]]`, two tiles; Q3 with `[["Oslo"], ["Oslo"], ["Oslo"]]`, one tile): on Q1 reveal tile 1 for Lag 1 (Kari, 3), then `u` (toggle on, tiles dashed); the button reads "Neste spørsmål [N]"; `n` → Q2's text, "Spørsmål 2 av 3", every tile hidden, status "Spørsmål 2 av 3.", the toggle `aria-pressed="false"` reading "Vis resten uten poeng [U]" with solid tile borders (deferred from 6.3), "Svarer nå" still on Lag 1; `t`, reveal Q2 tile 1 for Lag 2 (Rød, 2); a second tab opened on Q2, then `ArrowRight` here → Q3, and `n` in the stale tab refreshes it to Q3 without moving on (still "Spørsmål 3 av 3"); a reload keeps Q3; on Q3 the button reads "Vis sluttstilling [N]" and turns bold `stage-ink` once every tile is revealed (reveal Oslo with the toggle on, so no Score changes); click it → "Sluttstilling" focused, Teams in Score order (Lag 1 3, Lag 2 2), Scores at 120 px, the winner's card in `stage-accent` with "Vinner", the line "Spillet slettes automatisk {dato}." (the date `nb-NO`/Europe/Oslo 30 days from now; accept the next day too for a run across midnight) and "Tilbake til spillet"; everything inside 1080 px; axe clean; a reload shows "Sluttstilling" again; "Tilbake til spillet" → the Game page with "Ferdig", the Scores, "Vis sluttstilling" and the info notice with the date; axe clean; "Vis sluttstilling" → "Sluttstilling".
- `tests/manual/checklist.md`, `tests/TRACE.md`, `.docs/implementation-artifacts/sprint-status.yaml` -- T8; FR-3, FR-27, NFR-5, UX-DR21 rows; 6-4 done.

**Acceptance Criteria:**
- Given a *playing* Game, when the Host moves to the next Question and then past the last one, then the next Question is the one with the smallest greater position with its Groups hidden, and past the last `finish` moves the Game to *played*, sets `played_at` and returns `deleteAfter` = `played_at` + 30 days; every play operation on the *played* Game is then `WRONG_STATE`.
- Given the play view, when the Host presses "Neste spørsmål [N]", `n` or `→`, and on the last Question "Vis sluttstilling", then the next Question shows with hidden tiles and the toggle off, and finally "Sluttstilling" shows the Teams by Score at 120 px with "Vinner" (or "Uavgjort" on every tied Team), "Spillet slettes automatisk {dato}." and "Tilbake til spillet".
- Given a *played* Game, when the Host opens its Game page and its play URL, then the Game page shows the final Scores, "Vis sluttstilling" and "Spillet og alle svarene slettes automatisk {dato}." with the date 30 days after `played_at`, and the play URL shows the final Scores.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 25 findings — high 0, medium 0, low 15, false 10, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind: `finalScores` and `finish` crash on a *played* Game with a null `played_at` — `games.transition` is the only way into *played* and sets `played_at` in the same update; the purge's `isNull(played_at)` branch is for Games that were never played. Only hand-seeded test rows reach the state, and those now set it.
  - `[low]` `[reject]` Blind: one `N`/`→` on the last Question ends the Game with no confirmation, and presentation clickers send `→` — EXPERIENCE prescribes `N or →` and the label "Vis sluttstilling" with no dialog; the Scores are kept and the final screen is the next step anyway. A dialog would contradict the design contract.
  - `[low]` `[patch]` Blind: `F` does nothing on "Sluttstilling", so a Host who opens it from the Game page cannot go fullscreen — `FullscreenKey` is now in the footer row with its hint; e2e asserts the hint.
  - `[low]` `[reject]` Blind: the *played* Game page reads the Game twice (`ownedGame`, then `finalScores` → `getOwned`) — the *playing* branch does the same through `play.load`; one indexed primary-key read per page load.
  - `[false]` `[reject]` Blind: `deleteAfter` in the action result is unused — AC1 requires `finish` to return it, and the integration test asserts it.
  - `[low]` `[reject]` Blind: a stale tab's `N` refreshes to the current Question without announcing it — the 6.2/6.3 convention is a silent refresh for stale codes; the intent asks to keep it consistent.
  - `[low]` `[patch]` Blind: the fixture comment "which finish sets" reads as if finish ran in the test — reworded in `delete.test.ts` and `report.test.ts`.
  - `[low]` `[patch]` Blind: `n` and `ArrowRight` are not in the text-field and overlay-open guard lists — added to both lists in the 6.3 e2e test; that Game is on its last Question, so a leak would end it and fail the test.
  - `[low]` `[reject]` Blind: two simultaneous `nextQuestion` calls are not tested — PGlite runs one transaction at a time, so such a test passes without the lock (the `collection.test.ts` `shortcut:` until Story 7.3); the lock is the same `lockForMutation` row lock every move uses.
  - `[false]` `[reject]` Blind: the spec is untracked and sprint status says done — mid-run state; finalize commits both together.
  - `[false]` `[reject]` Blind: `FinalScores` reads `teams[0]` with no guard — a *played* Game always has two to four Teams (`start` requires them in the transaction that leaves *ready*).
  - `[false]` `[reject]` Edge: null `played_at` — same as the first Blind row.
  - `[low]` `[reject]` Edge: a delete between `getOwned` and the Scores read returns no Teams — a millisecond window in one Host's own two tabs; `play.load` has the same read pattern; a reload shows the not-found page.
  - `[low]` `[reject]` Edge: `FinalScores` with an empty `teams` array crashes — only reachable through the row above.
  - `[low]` `[reject]` Edge: the screen page shows the error page instead of not-found when `finalScores` hits that race — same window as the rows above.
  - `[low]` `[reject]` Edge: the Game page has the same race — same window.
  - `[low]` `[patch]` Edge: `N`/`→` with focus on a tile unmounts it and drops focus to the body — when focus was inside the Board list, the new Question's `<h1>` takes focus once it renders (as at the start of play); e2e asserts it.
  - `[low]` `[reject]` Edge: an accidental `n`/`→` on the last Question ends the Game — same as the second Blind row.
  - `[low]` `[reject]` Intent: "Uavgjort" is tested by rendering the screen page in integration, not in e2e — the markup is server-rendered, so the integration render is the same output; an e2e tie needs another full collection round (about 10 s).
  - `[low]` `[reject]` Intent: the e2e accepts today + 30 or + 31 days — the exact `played_at` + 30 days is asserted in integration; the e2e cannot read `played_at` and may cross midnight.
  - `[false]` `[reject]` Intent: `finalScores` reads outside the Game lock — the lock rule covers mutations; a read of a *played* Game changes nothing.
  - `[false]` `[reject]` Intent: the shared `WRONG_QUESTION` message changed — a recorded decision (Design Notes); the stale reveal still refreshes silently, so the text is never shown in the play view.
  - `[false]` `[reject]` Intent: NFR-5 timing is manual only — as T1 to T7; T8 is added and deferred to a hand run.
  - `[low]` `[reject]` Intent: EXPERIENCE says "Final Scores table" but the panel is a `dl` — the *playing* panel's name-value list, read as a table of two columns; a `dl` is the right semantics for Team → Score.
  - `[false]` `[reject]` Intent: the spec is untracked and its review log empty — mid-run state; this entry and finalize fill both.

## Design Notes

- **The client sends the Question it shows.** `nextQuestion` is the only play move that cannot be undone, and its last step ends the Game. Taking `position` and refusing a mismatch with `WRONG_QUESTION` (already a silent refresh in the Board) means a double press, a second tab or a slow refresh can never skip a Question or finish the Game by accident. Without it, two quick `N` presses on the second-to-last Question would end the round.
- **One operation for "next" and "finish".** The client cannot know better than the server whether a greater position exists, so one action decides; `finish` stays a named private step as AD-16 describes it. The button label comes from `position === total`, which holds because positions are dense `1..n` and frozen after *draft* (AD-16).
- **`WRONG_QUESTION` message.** The old text named a slot ("Den plassen …"); the code now also covers a stale next-Question press, so the message says what both mean: the Game is on another Question.
- **`played_at` from the transition.** `finish` needs `played_at` inside the transaction that set it, and `getOwned` cannot run inside a transaction, so `transition` returns it. Pages read it through `getOwned`.
- **Focus on "Sluttstilling".** The Game ending swaps the whole stage, so the focused control and the live region unmount; focusing the new `<h1>` tells a screen reader where it is.
- **Ties.** EXPERIENCE says "Uavgjort" on every tied Team; read as the Teams that share the top Score (a tie further down decides nothing). They share the active card look, so the word, not the colour, carries the result.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: no errors.
- `npm run test` -- expected: all green, offline, no key.
- `npm run test:e2e` -- expected: all green, axe clean on the final Scores stage and the *played* Game page.

## Auto Run Result

Status: done

**Summary.** The Host can now move through the Questions and end the round on the final Scores, and a *played* Game has its own screen and Game page panel.
- `play.nextQuestion` (AD-16) moves `play_state` to the Question with the smallest greater position in one transaction under the Game lock, or past the last one calls the private `finish`, which moves the Game to *played* through `games.transition` and returns `deleteAfter` = `played_at` + 30 days. The client sends the position it shows, so a stale tab or a double press is refused with `WRONG_QUESTION` (a silent refresh) instead of skipping a Question or ending the Game.
- `play.finalScores` reads a *played* Game's Teams with their SQL-summed Scores (AD-11), highest first, ties in Team order, plus `deleteAfter`.
- The control bar has "Neste spørsmål [N]", or "Vis sluttstilling [N]" on the last Question, bold once every tile is revealed; `n` and `→` do the same. The live region says "Spørsmål N av M.", the uten-poeng toggle is off on the new Question, and a focused tile hands focus to the new Question's heading.
- `/spill/[id]/skjerm` shows "Sluttstilling" for a *played* Game (the 6.1 `shortcut:` redirect is gone): Teams by Score at 120 px, "Vinner" on the top Team or "Uavgjort" on every Team sharing the top Score, "Spillet slettes automatisk {dato}.", "Trykk F for fullskjerm." and "Tilbake til spillet", with focus on the heading. The Game page shows the final Scores, "Vis sluttstilling" and the info notice "Spillet og alle svarene slettes automatisk {dato}.".

**Files changed.**
- `src/server/play/index.ts` -- shared Scores query, `nextQuestion`, private `finish`, `finalScores`.
- `src/server/games/index.ts` -- `getOwned` returns `playedAt`; `transition` returns `{ playedAt }`.
- `src/lib/play.ts`, `src/lib/errors.ts` -- `nextQuestionSchema`; the `WRONG_QUESTION` message fits both refusals.
- `src/app/spill/[id]/actions.ts` -- `nextQuestion` action.
- `src/components/Board.tsx`, `src/components/PlayView.tsx`, `src/components/RouteFocus.tsx` -- the control, shortcuts and overlay row; `FinalScores`; `FocusOnMount`.
- `src/app/spill/[id]/skjerm/page.tsx`, `src/app/spill/[id]/page.tsx` -- the *played* branches.
- `tests/integration/play.test.ts`, `tests/integration/authz.test.ts`, `tests/e2e/play.spec.ts` -- AC1 to AC3, the matrix rows, the foreign-Host row, the three-Question e2e flow (with the toggle switching off, deferred from 6.3).
- `tests/integration/delete.test.ts`, `tests/integration/report.test.ts` -- their seeded *played* Games now set `played_at`, as `finish` does.
- `tests/TRACE.md`, `tests/manual/checklist.md` (T8), `.docs/implementation-artifacts/sprint-status.yaml` (6-4 done).

**Review findings.** One pass, 25 findings (0 high, 0 medium, 15 low, 10 false).
- Patched, 4 low: fullscreen key and hint on "Sluttstilling"; focus to the new Question's heading when a focused tile unmounts; `n` and `ArrowRight` in the e2e guard lists; a misleading fixture comment.
- Deferred, 1 process item: the manual T8 timing run.
- Rejected: every other row, with its reason in the triage log (unreachable states, the design contract's undialogued finish, the silent-refresh convention, a millisecond delete race, test-surface preferences).

**AI suggestions rejected or corrected (grading evidence).**
- **Corrected (planning).** The obvious reading, "next" taking only the Game id, lets two quick `N` presses on the second-to-last Question end the round. The plan makes the client send the Question it shows and refuses a mismatch.
- **Corrected (implementation output, found in review).** No fullscreen key on "Sluttstilling"; focus dropped to the body when `N` unmounted a focused tile; the new keys missing from the shortcut-guard tests; a misleading test comment.
- **Rejected (reviewer suggestions).** A confirmation dialog before "Vis sluttstilling" or ignoring `→` on the last Question (EXPERIENCE prescribes both keys and no dialog); a fallback for a *played* Game without `played_at` (unreachable); dropping `deleteAfter` from the result (AC1 requires it); announcing the stale refresh (breaks the agreed silent-refresh convention); a concurrent-call test (PGlite serialises transactions, so it would pass without the lock).
- **Corrected in orchestration.** The platform ran the implementation agent and the four reviewers in the background, although the workflow asks for blocking calls. Each result was awaited before the next step, so nothing was skipped.

**Follow-up review recommendation:** false. Only low entries were patched.

**Verification.** After the review patches: `npm run lint` clean; `npm run typecheck` clean; `npm run test` 732 passed (43 files); `npm run test:e2e` 95 passed, axe clean on "Sluttstilling" and the *played* Game page. All offline, no key.

**Residual risks.** One `N` or `→` on the last Question ends the round for good, as the design contract prescribes. T8 is not yet run by hand. A *played* row written by hand without `played_at` would crash its pages (the app never writes one).
