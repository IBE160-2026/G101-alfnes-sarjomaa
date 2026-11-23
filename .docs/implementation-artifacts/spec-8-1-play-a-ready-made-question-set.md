---
title: 'Story 8.1: Play a ready-made Question set'
type: 'feature'
created: '2026-11-23'
status: 'done'
baseline_revision: '4018755e706a2ad553b3c4522955bd7b38c528d7'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-8-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Host can only play after a full Collection, Grouping and Review. FR-33 promises a Game that is playable at once, from a ready-made Question set built from ProtoQA's crowdsourced clusters, translated to Norwegian and credited.

**Approach:** Commit five hand-translated Question sets of five Questions each (25 ProtoQA crowdsourced dev Questions) as one reviewable JSON file with the source ids. The existing create form gets a native `<select>` for the set. Choosing a set calls a new entry point, `review.createFromQuestionSet`. In one transaction it inserts the Game in *ready* (marked with `game.question_set`), the Questions at dense positions and the `board_slot` rows from `boardCut(rankGroups(...))` with `group_id` null. Play then runs unchanged through `review.getBoard` (AD-15). The play screen's control bar and the README credit the source as translated and adapted.

## Boundaries & Constraints

**Always:**
- **Group decisions.** The group decided to start before SM-1 passes. The PRD §10 item 3 precondition (ProtoQA provenance and trademark) is settled: the group decided on 2026-11-23 not to ask the course staff, and only the crowdsourced part (CC BY 4.0) is used (`wiki/prosjekt/beslutninger.md`).
- **Counts and the Board.** Counts are the dataset's cluster counts, unchanged. Each Board is the top clusters by count, capped at `BOARD_SIZE` (8), ordered by the app's own `rankGroups` and `boardCut`: count, then rank-1 count (0 for all), then the nb collation of the label, then the id.
- **Text limits.** Labels are 1..`LABEL_MAX` (40) characters. Question texts are 1..`QUESTION_TEXT_MAX` characters.
- **Translation.** The AI writes the translations by hand, into natural bokmål. No model or API call is made, and `OPENROUTER_API_KEY` is never used.
- **Attribution.** The data file carries every source Question id and cluster id. `data/protoqa/ATTRIBUTION.md` covers the derived file under CC BY 4.0, with the same credit and the changes stated.
- **AD-1.** Only owners write their tables. `games` exports `insertReady(tx, …)` and `questions` exports `insertAll(tx, …)`. `review` writes `board_slot` and is the entry point, because it is the latest module of the three. The spine is amended in the same change (AD-1 table, AD-4, AD-15, capability map, Deferred).
- **UI.** The UI follows `DESIGN.md` and `EXPERIENCE.md` (Operate mode): the house TextField look for the select, one primary action, WCAG 2.1 AA and axe clean. Copy is bokmål, in the "du" form, with no exclamation marks.
- **Gates.** Tests pass offline. Every commit is green, with a Norwegian message, and nothing is pushed.

**Never:**
- No separate play path, no change to `play` or the Score.
- No Judge call.
- No new table.
- No per-set route or page.
- No credit on Host-written Games.
- No US-specific Questions (baseball, Thanksgiving, US brands) and no crude ones. No English text on screen.
- No edits to `.logs/`, `wiki/` or `.claude/skills/excalidraw-diagram/`.
- No real names, and no `.env` reads.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create from set | logged-in Host, title "Fredag", set `hjemme` | Game in *ready* with `question_set = 'hjemme'`, 5 Questions at positions 1..5, `board_slot` rows equal to the data's Boards; redirect to `/spill/{id}` | — |
| Own Questions | set left at "Jeg skriver egne" (empty value) | Unchanged FR-2 path: a *draft* Game | — |
| Unknown set id | `questionSet: "finnes-ikke"` | No Game is created | `INVALID_INPUT`, field error "Velg et sett fra lista." |
| Bad title with a set | empty title, set chosen | No Game is created | The FR-2 title field error |
| Logged out | any input | Redirect to `/logg-inn`, no Game | — |
| Set Game afterwards | edit Questions, links, close, Review, confirm | Refused | `WRONG_STATE` (AD-4) |
| Play | Team setup → start → reveal slot 1 | The label and Count shown equal the data's top Group; the control bar shows the credit | — |

</intent-contract>

## Code Map

- `data/protoqa/dev.crowdsourced.jsonl` -- source (52 rows). Each row has `metadata.id`, `question.original` and `answers.clusters[id] = {count, answers[]}`. There are no labels.
- `data/protoqa/ATTRIBUTION.md` -- the existing credit. Extend it with a "Derived Question sets" section.
- `src/lib/ranking.ts` -- `rankGroups` and `boardCut` (AD-11). Pass `customLabel` as the Norwegian label, `rank1Count: 0`, `labelCandidates: []` and `groupId` as the cluster id.
- `src/lib/limits.ts` -- `BOARD_SIZE`, `LABEL_MAX` and `QUESTION_TEXT_MAX`.
- `src/lib/game.ts` -- `createGameSchema` (the title rule) to extend.
- `src/lib/game-state.ts:16` -- the `INITIAL_STATE` comment says only `games.create` enters a state. Amend the comment; no new PERMITTED row (creation is not an operation on an existing Game).
- `src/server/db/schema.ts:51` -- `game` table. Add the nullable `question_set text` and run `npm run db:generate`.
- `src/server/games/index.ts` -- `create`, `getOwned` (returns `questionSet` too) and `lockForMutation`. Add `insertReady`.
- `src/server/questions/index.ts` -- the owner of `question`. Add `insertAll(tx, gameId, texts)`, which returns ids in position order.
- `src/server/review/index.ts:452-509` -- `confirmBoard` (the pattern for the `board_slot` insert) and `getBoard`. Add `createFromQuestionSet`.
- `src/app/spill/actions.ts` -- `createGame`. It branches on a non-empty `questionSet`.
- `src/app/spill/page.tsx`, `src/components/CreateGameForm.tsx` -- the create row. Add the select; the page passes `{id, name}` options, so the JSON stays out of the client bundle.
- `src/app/spill/[id]/page.tsx` -- *ready* panel. Hide `DownloadReport` for set Games (no Grouping to report).
- `src/app/spill/[id]/skjerm/page.tsx`, `src/components/PlayView.tsx`, `src/components/Board.tsx:312-366` -- the control bar, whose right end is reserved for the credit (EXPERIENCE.md, play view rules).
- `tests/integration/authz.test.ts:125` -- `createGame` tests to extend. `tests/e2e/fixtures.ts` -- `registerHost` and `seriousViolations`.
- `tests/TRACE.md` -- has no FR-33 section yet. `trace.test.ts` checks only Stage 1 headings.

## Tasks & Acceptance

**Execution:**
- `data/question-sets/protoqa-nb.json` -- five sets × five Questions: `{id, name, questions: [{sourceId, text, groups: [{cluster, label, count}]}]}`, with the top ≤8 clusters only.
- `data/protoqa/ATTRIBUTION.md` -- add a derived-file section.
- `src/lib/question-sets.ts` -- typed import of the JSON, `QUESTION_SETS`, `createFromSetSchema` and `QUESTION_SET_CREDIT`.
- `src/server/db/schema.ts`, `drizzle/` -- add `game.question_set` and its generated migration.
- `src/server/games/index.ts`, `src/server/questions/index.ts`, `src/server/review/index.ts` -- `insertReady`, `insertAll` and `createFromQuestionSet`.
- `src/app/spill/actions.ts`, `src/app/spill/page.tsx`, `src/components/CreateGameForm.tsx` -- the select and the branch.
- `src/app/spill/[id]/page.tsx`, `src/app/spill/[id]/skjerm/page.tsx`, `src/components/PlayView.tsx`, `src/components/Board.tsx` -- the credit in the control bar; no report button for set Games.
- `tests/unit/question-sets.test.ts` -- data checks against the jsonl.
- `tests/integration/question-sets.test.ts` -- create path, owner checks, `WRONG_STATE` for Collection, Grouping and Review, and the Board read through `review.getBoard`.
- `tests/e2e/question-sets.spec.ts` -- create from a set, play a reveal, the credit and axe.
- `README.md` -- a few lines and a collapsible list of the sets.
- `tests/TRACE.md` -- an FR-33 section.
- `ARCHITECTURE-SPINE.md` -- the amendments listed under Boundaries.
- `sprint-status.yaml` -- epic-8 in-progress, 8-1 done.

**Acceptance Criteria:**
- AC1 (FR-33):
  - **Given** a Host choosing a Question set, **when** the Game is created, **then** it is in *ready*, and Questions, links, close, Review and confirm are refused with `WRONG_STATE`.
  - **And** Team setup and play start on it.
- AC2 (FR-33): **Given** a set Game, **when** its Board is read through `review.getBoard`, **then** each Question's slots equal the dataset's top clusters (≤8) with unchanged Counts, ordered by `rankGroups`.
- AC3 (FR-33):
  - **Given** a set Game in play, **when** the play view shows, **then** the control bar reads "Spørsmål fra ProtoQA (CC BY 4.0), oversatt og tilpasset".
  - **And** the README credits ProtoQA as translated and adapted.
  - **And** every Question and label on screen is Norwegian.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass

Totals: 32 findings — high 0, medium 1, low 25, false 6, maybe-false 0.

**Verification gap**
- `[medium]` `[patch]` Nothing caught a Host-written Game showing the ProtoQA credit. The `play.test.ts` bar check is a substring match, and TRACE claimed it proved "no credit". *Fixed:* `play.test.ts` now asserts `not.toContain(QUESTION_SET_CREDIT)`, and `question-sets.test.ts` renders `ScreenPage` for the set Game and asserts that the credit is present. TRACE wording updated.
- `[low]` `[reject]` The report route still serves a set Game on a direct GET while the button is hidden. *Rejected:* it is reachable only by typing the URL, and it returns harmless zero counters with an empty Question list. A route guard adds a branch for a case no user meets.

**Intent alignment**
- `[low]` `[patch]` (a) Spine AD-15 said the cluster id was "for the tie rule only". In fact, equal Counts are ordered by the nb-collated label first. *Fixed:* the spine is reworded. The tie at the cut is avoided by the data (unit-tested), not applied.
- `[low]` `[reject]` (b) No credit on Team setup or Final Scores, and the credit is hidden while the failure banner shows. *Rejected:* the credit is visible for the whole round on the play view, and the banner is transient. Adding it to two more screens is extra surface FR-33 does not require.
- `[low]` `[reject]` (c) EXPERIENCE.md promised the credit "without a layout change", but the right end became a two-line block with `gap-6`. *Rejected as a defect, kept as a decision:* one line does not fit 1920 px in the worst case. Host-written Games keep the old bar exactly. The e2e proves the 64 px bar holds every item.
- `[false]` `[reject]` (d) Hiding the usage report is a behaviour difference. It is not a defect: a set Game has no Grouping or Review counters to report. The spec chose this explicitly.
- `[low]` `[reject]` (e) No page-level test opens Review or Collection for a set Game. *Rejected:* those pages are already state-gated and tested. The module actions are tested for `WRONG_STATE`.
- `[low]` `[reject]` (f) No owner test for `revealSlot` or delete on a set Game. *Rejected:* those actions are not new. Their foreign-id cases are already in `authz.test.ts`, and the set Game goes through the same lock.
- `[low]` `[reject]` (g) "Norwegian on screen" is not tested. *Rejected:* a test cannot prove a language. The texts were written and reviewed by hand, and the README list makes them reviewable.
- `[low]` `[patch]` (h) PRD §4.8 says the sets are added to Demo mode. *Fixed:* the README demo paragraph now says the demo Host can create a Game from a set. Seeding them was rejected in Design Notes.
- `[false]` `[reject]` (i) Docs are uncommitted and the sprint says done. Finalize commits them after triage, which is the workflow's order.
- `[false]` `[reject]` (j) The anonymity column-count test changed from 9 to 10. The new column holds a set id, not Participant data, and the guard still fails on any further column.

**Edge case**
- `[low]` `[reject]` The report route for set Games. Same as the verification-gap row above.
- `[false]` `[reject]` An empty set makes `insert().values([])` throw. Unreachable: the sets are static committed data, and the unit test pins five Questions with at least four Groups each.
- `[low]` `[reject]` No runtime schema check on the JSON. *Rejected:* it is committed data, checked in CI by `question-sets.test.ts`, with no untrusted input.
- `[low]` `[reject]` The credit is hidden under the failure banner. Same as (b).
- `[low]` `[reject]` The e2e takes `groups[0]` as slot 1. *Rejected:* the data is in count order, and the top Group of the first Question (43) has no tie. A tie there would also fail the integration test loudly.
- `[low]` `[reject]` The integration test is coupled to JSON order. Same reasoning.
- `[low]` `[reject]` ATTRIBUTION claims the credit is on "the play screen", while setup and final scores show none. Same as (b). The play view is the play screen.

**Blind hunter**
- `[low]` `[reject]` The report route. Same as above.
- `[low]` `[patch]` Demo mode. Same as (h).
- `[low]` `[reject]` Norwegian is not tested. Same as (g).
- `[low]` `[patch]` The AD-15 test's `group_id` read was not scoped to its Game. *Fixed:* it is limited to the Game's Questions and checks the row count.
- `[low]` `[reject]` The README duplicates the 25 Questions and may drift. *Rejected:* the group asked for a collapsible list of the sets. Translations change rarely, and both places are reviewed.
- `[low]` `[reject]` The JSON `source`/`licence` fields are unused and the credit is a constant. *Rejected:* there is one source today. The fields document the file for reviewers.
- `[low]` `[patch]` The on-screen credit has no authors. *Fixed:* ATTRIBUTION now says the screen carries the short form, and that the full credit with the authors is in ATTRIBUTION and the README.
- `[low]` `[patch]` The spine's tie-rule wording. Same as (a). The collator duplicate-label part is *rejected*: no two labels on one Board differ only in case or accents.
- `[false]` `[reject]` The sprint says done before review. Same as (i).
- `[low]` `[reject]` No decision row in `wiki/` and no prompting entry. *Rejected for this run:* the instructions forbid touching `wiki/`. The decision to start early is logged on `main` by the group.
- `[false]` `[reject]` The diff leaves out files. The generated drizzle snapshot was left out on purpose, and the spec and context are committed in `3978caa`.
- `[low]` `[reject]` The e2e end asserts little. *Rejected:* "Utkast" is asserted. Absence of the credit is now proved in `play.test.ts`.
- `[low]` `[reject]` No runtime bound on set size. Same as the schema-check row.

## Design Notes

- **Why `review` is the entry point.** AD-4 named `games.createFromQuestionSet`. But `games` is first in the module order and can call neither `questions` nor `review`, the owners of `question` and `board_slot` (AD-1). `review` comes after both. Its entry point composes the owners' `tx` writers, as `confirmBoard` already does with `grouping`.
- **`question_set` instead of `game.kind`.** One nullable text column serves both as the kind (null means the Host wrote the Questions) and as the set id, which the play screen needs for the credit.
- **Rejected alternatives.** A per-set seed through Demo mode was rejected, because FR-33 is a Host choice and is not limited to the demo. Labels taken from the most frequent raw answer were rejected, because the clusters mix English, Spanish and typos and a human-chosen Norwegian label reads better.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm run format:check` -- expected: clean
- `npm run test` -- expected: all pass, including the new unit and integration files
- `npm run test:e2e` -- expected: all pass, including `question-sets.spec.ts`
- `npx drizzle-kit check` -- expected: no drift

## Auto Run Result

Status: done

**Summary.** A Host picks one of five ready-made sets in the create row ("Spørsmål": "Jeg skriver egne", or a set under "Ferdige sett"). `review.createFromQuestionSet` then creates the Game in *ready*, with 5 Questions and their Boards cut by `rankGroups` and `boardCut`. Play runs unchanged through `review.getBoard`. The control bar credits ProtoQA as translated and adapted. The README and `data/protoqa/ATTRIBUTION.md` carry the full credit.

**Precondition.** PRD §10 item 3 (ProtoQA provenance and trademark) is settled by the group's decision of 2026-11-23 in `wiki/prosjekt/beslutninger.md`: the course staff is not asked, and only the crowdsourced part (CC BY 4.0) is used, credited as translated and adapted.

**Files**
- **Data**
  - `data/question-sets/protoqa-nb.json`: the five sets × five Questions, with `sourceId`, `cluster` and unchanged `count`.
  - `data/protoqa/ATTRIBUTION.md`: the derived-file credit and the list of changes.
- **Schema**
  - `src/server/db/schema.ts`, `drizzle/0014_brainy_electro.sql`: the nullable `game.question_set` column.
- **Library and server code**
  - `src/lib/question-sets.ts`: the sets, `createFromSetSchema` and the credit text.
  - `src/lib/game-state.ts`: comment only.
  - `src/server/games/index.ts`: `insertReady`, and `getOwned` now returns `questionSet`.
  - `src/server/questions/index.ts`: `insertAll`.
  - `src/server/review/index.ts`: `createFromQuestionSet`.
- **Routes and components**
  - `src/app/spill/actions.ts`: the branch on `questionSet`.
  - `src/app/spill/page.tsx`, `src/components/CreateGameForm.tsx`: the select.
  - `src/app/spill/[id]/page.tsx`: no report button for set Games.
  - `src/app/spill/[id]/skjerm/page.tsx`, `src/components/PlayView.tsx`, `src/components/Board.tsx`: the credit in the bar.
- **Tests**
  - `tests/unit/question-sets.test.ts`, `tests/integration/question-sets.test.ts`, `tests/e2e/question-sets.spec.ts`: new tests.
  - `tests/integration/play.test.ts`: the no-credit check.
  - `tests/integration/host-view.test.ts`: 10 `game` columns.
- **Documentation and tracking**
  - `tests/TRACE.md`: the FR-33 section.
  - `README.md`: the section on the sets and the demo line.
  - `ARCHITECTURE-SPINE.md`: AD-1, AD-4, AD-15, the capability map and Deferred.
  - `sprint-status.yaml`: epic-8 in-progress, 8-1 done.

**Review.**
- 6 patches applied: 1 medium and 5 low.
- 0 deferred.
- 26 rejected. The reasons are in the triage log.
- Follow-up review recommended: false, since there were no high patches and only one medium.

**AI suggestions rejected or corrected in this run**
- **The context compiler's reading of AD-4.** It read AD-4 as placing the entry point in `games` (`games.createFromQuestionSet`). That was rejected because of the AD-1 module order, and `review.createFromQuestionSet` composes the owners' writers instead.
- **The implementer's first credit layout.** It put the credit on one line, and the bar overflowed in the worst case. It was corrected to a two-line right end, with an e2e measurement.
- **Translation choices.**
  - The cluster "an iphone" became "En mobiltelefon", with no brand.
  - r2q31 ("Besides birds…") became "Nevn et kjæledyr folk har i bur, men ikke en fugl.", replacing a first draft that opened with a colon.
  - r2q14 cluster "study" became "Studere likevel", so it reads sensibly under "i stedet for å studere videre".
- **Question selection.** Questions with a tie at the eighth place were dropped (r1q14, r2q40, r2q49), so the Board cut needed no tie rule at the boundary. Crude and US-specific Questions were dropped as well (r1q3, r1q9, r1q12, r2q11), and so was r2q19, whose clusters (kangaroos, car batteries) do not translate.

**Verification.**
- `npm run lint`, `npm run typecheck` and `npm run format:check` are clean, and `npx drizzle-kit check` is clean.
- `npm run test`: 49 files, 824 passed and 1 skipped (after the patches).
- `npm run test:e2e`: 100 passed. The review patches touched only integration tests and docs.
- The worst-case control-bar screenshot at 1920×1080 was inspected: every item fits the 64 px bar.

**Residual risks**
- **Font width in CI.** The bar is measured with macOS system fonts. On Linux CI, `system-ui` may be wider. The e2e fit check would catch it there.
- **No credit off the play view.** Team setup and Final Scores show no credit.
- **No report route guard.** A direct GET of the report for a set Game returns an empty report.
