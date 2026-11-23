---
title: 'Story 8.1: Play a ready-made Question set'
type: 'feature'
created: '2026-11-23'
status: 'in-progress'
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
- **Group decisions.** The group decided to start before SM-1 passes. The PRD §10 item 3 precondition (ProtoQA provenance and trademark with the course staff) is recorded as **open** and does not block this story.
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
