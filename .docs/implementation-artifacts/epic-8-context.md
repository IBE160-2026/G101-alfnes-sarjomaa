# Epic 8 Context: Stage 2 - only after SM-1 passes

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Add the Stage 2 features that sit on top of the finished Stage 1 loop. FR-33 comes first: a Host creates a Game from a ready-made ProtoQA Question set and plays at once, with no Collection, Grouping or Review. The remaining stories (reorder Groups, assisted Guess matching, strikes and steals) follow only if time allows. No story starts until SM-1 passes in full on `main`. Design detail is decided now, inside AD-4, AD-13, AD-15 and AD-16, and the spine is amended in the same change.

## Stories

- Story 8.1: Play a ready-made Question set (FR-33, first)
- Story 8.2: Reorder Groups in Review (FR-22)
- Story 8.3: Assisted Guess matching (FR-28)
- Story 8.4: Strikes and steals (FR-29, rules decided by the group when Stage 2 starts)

## Requirements & Constraints

Story 8.1 (FR-33), all testable:
- Precondition: ProtoQA provenance and trademark are settled with the course staff (PRD open question 3). If not settled, stop and ask the group.
- Creating a Game from a Question set inserts it directly in *ready*. Collection, Grouping and Review are skipped and play can start (Team setup, then *playing*) with no other change to the play path.
- The Board equals the dataset's clusters and Counts for those Questions, capped at eight Groups with the same cut as FR-21. Counts are unchanged from the dataset.
- Questions and Group labels are in Norwegian bokmål (NFR-7), Counts untouched. The credit says the material is translated and adapted.
- The source dataset is credited on the play screen and in the README (CC-BY-4.0 attribution, ProtoQA authors).
- Only the crowdsourced portion of ProtoQA may be committed. Scraped, train and test files are never committed. Extend `data/protoqa/ATTRIBUTION.md` to cover any derived or translated Question-set file.
- Demo mode: if FR-33 ships, its Question sets are added to Demo mode.
- No model key, no network: a Question-set Game must work fully offline (NFR-1, NFR-3, FR-30 spirit).
- Question-set Games hold no Answers or Contributor keys, so FR-11 to FR-13 are not engaged. Do not weaken the anonymity inspection tests.

Story conventions that apply to every story here:
- Every acceptance criterion has a proof label: unit, integration, e2e or manual. Test titles carry FR IDs, and rows go into `tests/TRACE.md`.
- Lint, format, typecheck, `npm test` and `npm run test:e2e` stay green offline. Commit in small pieces locally, do not push.
- A new state-dependent operation gets a row in `src/lib/game-state.ts` and a `WRONG_STATE` case in `tests/integration/game-state.test.ts`. A new Host action gets a foreign-ID case in `tests/integration/authz.test.ts`.
- A story creates only the tables and columns it needs in `src/server/db/schema.ts` with a generated, committed migration. Every table with `game_id` cascades on delete.
- Screens ship finished: literal bokmål, new `ErrorCode`s in `src/lib/errors.ts`, loading/empty/error states, accessibility floor (WCAG 2.1 AA, never cut), voice. Nothing logs a Token, hash or Answer text. No real person's name or `.idea/` text in tracked files.
- Ponytail `full` plus `impeccable` for UI; the design contract (`DESIGN.md`, `EXPERIENCE.md`) wins over the skills.

## Technical Decisions

Exact rules from the spine (`.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md`), each named for Stage 2:

- **AD-4** (`src/lib/game-state.ts`, `games` module): "State changes go only through `games.transition(tx, gameId, from, to)`, a compare-and-set. Only the transitions in the diagram exist. Stage 2 adds `games.createFromQuestionSet`, which inserts a Game directly in `ready` (FR-33)." Every state-dependent mutation starts with `games.lockForMutation(tx, { hostId?, gameId, states })`, and `INITIAL_STATE`/`TRANSITIONS` there currently assume games enter only as `draft`. The permitted-operations table is walked by an integration test, so a `ready`-born Game must be covered. The spine's Deferred list leaves "the Question-set import format and `game.kind` (FR-33)" to be decided now.
- **AD-15** (`review` module, `board_slot` table): "Play reads only `board_slot`, through `review.getBoard`." Prevents "a separate play path for Question-set Games." So `createFromQuestionSet` must write `question` rows and `board_slot(id, question_id, position 1..8, label, count, group_id nullable)` rows, with `group_id` null (it is already nullable, `ON DELETE SET NULL`), and play and Score stay untouched. `board_slot` has unique `(question_id, position)`, a position range 1..8, and a unique `group_id` index (nulls allowed). `confirmBoard` and `clearContributorData` are not involved.
- **AD-11** (`src/lib/ranking.ts`): order and Board cut only via `rankGroups()` and `boardCut()`. Use them, or the same tie rule, for the cap of eight rather than a second cut. Score is the SQL sum of `board_slot.count` over scored Reveals, which still works for dataset Counts.
- **AD-16** (`play` module): "`question.position` is dense `1..n` and unique per Game", frozen after `draft`. Tables `team`, `play_state(game_id, current_question_id, current_team_id)`, `reveal(id, game_id, board_slot_id unique, team_id nullable, seq)`. Reveal takes only `{ boardSlotId, scored }`, with `WRONG_QUESTION` and `ALREADY_REVEALED`. Undo deletes the highest-`seq` reveal on the current Question. `finish` sets `played_at`, returns `deleteAfter = played_at + 30 days`. Question-set Questions must get dense positions 1..n.
- **AD-13** (`src/server/judge/index.ts`): "Nothing outside `src/server/judge` imports a provider or calls the model endpoint." Question-set creation needs no Judge call at all. Stage 2 `match({ question, guess, labels }, signal)` (Story 8.3) is added to the same `Judge` interface, never a second Judge. "No Stage 2 stub or comment ships in Stage 1", so add it now, not earlier. `getJudge()` selects the provider through `JUDGE_PROVIDER`.
- **AD-1**: modules call only earlier modules in the order auth, games, questions, then grouping, then collection, review, then play, and "only the owning module writes a table". `question` is owned by `questions`, `board_slot` by `review`, but AD-4 names `games.createFromQuestionSet` and `games` comes before `review`. Resolve this explicitly and amend the spine in the same change (for example, an entry point that composes the owners' exported writers, which take `tx: Tx` first). Entry points open the transaction, exported writers take `tx`.
- Other rules that touch it: random UUID v4 IDs, limits only in `src/lib/limits.ts` (BOARD_SIZE 8), mutations are Server Actions with a sibling zod `schema.ts`, result shape `{ ok: true, data } | { ok: false, code, message, fieldErrors? }`, closed `ErrorCode` union in `src/lib/errors.ts`, `src/server/log.ts` takes only `{ module, op, code, sqlstate }`.
- Data facts: the committed `data/protoqa/dev.crowdsourced.jsonl` (52 rows, from `iesl/protoqa-data`, CC-BY-4.0, verbatim, English) has per Question `question.original` and `answers.clusters`, each cluster `{ count, answers[] }` with no label field. Label choice (and Norwegian translation) is therefore a Stage 2 design decision. Existing credit lives in `data/protoqa/ATTRIBUTION.md` and the README.
- Retention (30 days after `played_at`, 90 after `updated_at` for a never-played Game) and delete-in-any-state apply unchanged.

## UX & Interaction Patterns

(Files: `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md` and `DESIGN.md`. EXPERIENCE.md is Stage 1 only and has no Question-set screen, so FR-33 copy and the create entry point are new design work, constrained as below.)
- **Create flow today:** `/spill` has a create row, TextField "Navn på spillet" (1 to 80 characters, counter from 60) and "Lag spill", producing a *draft* Game. A Question-set entry must reuse the Host chrome, TextField and Button components, one primary action per state, and keep "Slett spillet" at the bottom of the Game page.
- **Game page in *ready*:** StatusBadge "Klar", panel "Brettet er låst. N spørsmål er klare.", primary action "Start spillet" going to `/spill/[id]/skjerm`. This is where a Question-set Game lands, so there is no *draft*, *collecting* or *in review* surface for it. Check that nothing there (usage-report button from *in review* onward, Review link, text about Answers) misleads for a Game with no Grouping.
- **Play view:** `/spill/[id]/skjerm` is Team setup ("Hvem spiller?", 2 to 4 Teams, 1 to 14 characters) then the fixed 1920x1080 canvas. It reads only the confirmed Board, never raw Answers, discarded Groups or Contributor data. "The control bar's right end is reserved for the FR-33 source credit, so it can arrive without a layout change." Labels and Scores stay at 48 px or more, labels never truncate (wrap to two lines, row 112 px), the control bar is 64 px, keyboard shortcuts and reduced-motion behaviour unchanged. The credit must fit that slot without breaking the vertical budget (48 px top gutter, 221 px Question block, 696 px list, 64 px control bar).
- **Final Scores** show the deletion-date line "Spillet slettes automatisk {dato}." and "Tilbake til spillet". Keep the credit visible or reachable there too if the credit lives in the control bar.
- **Voice:** bokmål "du" form, no exclamation marks or emoji on Host pages, errors say what happened then what to do. Run `impeccable` Operate mode and `reference/craft-floor.md` before UI changes.

## Cross-Story Dependencies

- Story 8.1 is first and independent of 8.2 to 8.4. It also needs the ProtoQA provenance decision and, for its Norwegian text, a translation approach that stays offline and key-free.
- Story 8.2 (manual order) changes `answer_group` and the Board cut, so it touches AD-11 and AD-15 and must keep `board_slot` as play's only source. Story 8.1 Boards need no Review, so ordering is unaffected.
- Story 8.3 adds `match` to the Judge boundary (AD-13), typed Guess storage deleted at *played*, and falls back to manual FR-25 play with no key. It acts on the Board, so Question-set Games could use it too.
- Story 8.4 needs the group's decision on strike and steal rules first, off by default, and must leave Games without it playing exactly as in Stage 1.
- Depends on Epic 7 outputs: Demo mode (`npm run demo`, `src/cli/demo.ts`), `data/protoqa/`, README Stage 2 section, `tests/TRACE.md`, and the e2e and axe passes, all to be extended rather than duplicated.
