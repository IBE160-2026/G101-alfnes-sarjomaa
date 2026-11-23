# Epic 8 code review (bmad-code-review)

- **Date:** 2026-11-24
- **Scope:** `git diff origin/main...epic-8-trinn-2`, which covers Story 8.1 (Play a ready-made Question set). 7 commits, from `3978caa` to `43f1530`.
  - 29 files changed, +3,320/-33.
  - The reviewers read the diff without the generated `drizzle/meta/0014_snapshot.json`: 2,662 lines, about 121 kB. Triage checked the snapshot separately.
- **Mode:** `full`. The diff was checked against:
  - `spec-8-1-play-a-ready-made-question-set.md`, including its review triage log, Design Notes and residual risks. Items that log rejected were not raised again unless there was a new argument;
  - `epic-8-context.md` and Story 8.1 in `epics.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-1, AD-4, AD-11, AD-15 and AD-16 as amended;
  - the PRD: FR-33, FR-21, §4.8, §7 and §10 item 3;
  - `data/protoqa/ATTRIBUTION.md`, `data/question-sets/protoqa-nb.json` and the source `data/protoqa/dev.crowdsourced.jsonl`;
  - `EXPERIENCE.md` (play view, control bar).
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:**
  - the create-in-ready transaction and the owner checks;
  - that a set Game can never reach Collection, Grouping, Review or the usage report;
  - Board correctness: Counts equal the jsonl clusters, the cut at eight goes through the app's own `rankGroups` and `boardCut`, and ties;
  - migration 0014: a nullable column, safe on the pilot's Neon database;
  - the credit shown only for set Games;
  - data file integrity and traceability;
  - deletion and purge of set Games;
  - translation fidelity: several labels spot-checked against the English clusters, for the same meaning and unchanged Counts;
  - test gaps;
  - the open items the author listed: the report URL for a set Game, the played-page text about Answers being deleted, and no credit on Team setup or Final Scores.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `lib/ranking.ts`, `lib/game-state.ts`, the `game`, `question` and `board_slot` schema, `games.lockForMutation`, `games.getOwned`, `games.purgeExpired`, `grouping.usage`, the report route, the Review page's state gate, the Game page's panels, the 0013 and 0014 snapshots, and the pilot notes in `tests/manual/checklist.md`.
  - A script compared all 25 Questions and 182 Groups in the set file with the source jsonl (see "Verified clean").
  - No OpenRouter call was made, and no `.env` file was read.
- **Test run:** not run. No finding depended on a test result. `test:e2e` was not run either.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story file was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 1 | patch (deploy step) |
| Low | 10 | 6 patch, 1 decision needed, 3 defer |
| Dismissed | 13 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **The create-in-ready transaction (AD-1, AD-4).**
  - `review.createFromQuestionSet` validates the title and the set id with `createFromSetSchema` before it opens the transaction. The `!` on `QUESTION_SETS.find` is safe, because the schema's `refine` already proved that the id exists.
  - `games.insertReady`, `questions.insertAll` and the `board_slot` insert all run on the same `tx`. A failure in any of them rolls back the Game too, so a half-made set Game cannot exist.
  - `hostId` comes only from `auth.requireHost()` in the Server Action. The input carries no Game id, so there is nothing foreign to own-check. Host B gets `NOT_FOUND` on the new Game through the existing `getOwned` and `lockForMutation` (tested).
  - `insertAll` writes positions `1..n`, which satisfies `question_game_position_key`. Many `board_slot` rows with `group_id` null do not collide on `board_slot_group_id_key`, because Postgres treats NULLs as distinct in a unique index.
  - The module order holds: `review` already imports `games` and `questions`, and neither of them imports `review`.
- **A set Game cannot go backwards.** `TRANSITIONS` has no edge out of `ready` except to `playing`. Every operation of the earlier states (`editQuestions`, `createInviteLinks`, `closeCollection`, `writeGrouping`, `editReview`, `confirmBoard`) lists only earlier states in `PERMITTED`, so `lockForMutation` refuses it with `WRONG_STATE` (integration-tested). The Review page redirects to the Game page on `WRONG_STATE`. The Grouping runner acts only on `grouping`. The usage report is the one exception, and it is discussed under dismissed item 1.
- **Board correctness (FR-21, FR-33, AD-11).** Checked by script against `dev.crowdsourced.jsonl`, for all 25 Questions:
  - every `sourceId` is unique and exists;
  - every `cluster` exists in its row, and every `count` equals the source count (182 of 182 Groups);
  - each Question's Groups are exactly the source's top `min(8, n)` clusters by count;
  - no Question has a tie across the eighth place, so the cut never depends on the tie rule;
  - every label is 1 to 40 characters and unique within its Question, and every Question text is under 200 characters.
  - The Board itself is built by `boardCut(rankGroups(...))` with `rank1Count: 0`, so ties inside the Board are ordered by the `nb`-collated label, then by the cluster id. Finding 4 covers the fact that this order is never pinned against fixed data.
- **Migration 0014.** It is the single statement `ALTER TABLE "game" ADD COLUMN "question_set" text;`. A nullable column with no default is a catalog-only change in Postgres. There is no table rewrite and only a brief lock, so it is safe on Neon at any size. The 0014 snapshot's `prevId` is the 0013 id, and the only table that differs is `game`, by this one column. The column is additive, so the code that is live now keeps working after the migration. The order of deployment is the problem, not the migration (finding 1).
- **The credit only on set Games.** `ScreenPage` passes `QUESTION_SET_CREDIT` only when `game.questionSet` is set. `Board` keeps the old bar markup unchanged when `credit` is undefined. `play.test.ts` asserts that a Host-written Game has no credit, and `question-sets.test.ts` renders the stage for a set Game and asserts that it has one.
- **Data traceability.** Every Question keeps its `sourceId` and every Group its `cluster`. `ATTRIBUTION.md` names the derived file, the licence, the authors and four changes (selection, translation, labels, Board size). It also states that Counts are unchanged and that no model was used. The README credits ProtoQA as translated and adapted, and its collapsible list matches the file.
- **Deletion and purge.** `deleteGame` is permitted in every state. `question`, `team` and `reveal` cascade from `game`, and `board_slot` cascades from `question`, so deleting a set Game leaves no rows behind. `purgeExpired` works on `played_at` and `updated_at` and does not care how the Game was made. `insertReady` sets `updated_at`, so an unplayed set Game expires like any other.
- **Translation spot check.** About 30 labels were compared with their full source clusters. Every Count is unchanged. Most labels are faithful, for example:

  | Question | Label | Count | Source cluster |
  |---|---|---:|---|
  | r1q5 | Dusjer og pusser tennene | 43 | brush their teeth, go to the bathroom, showering, wash |
  | r1q10 | Allrom eller treningsrom | 29 | party room, family room, movie theater, work out room |
  | r2q12 | Basseng eller vanntank | 19 | water tank, tool, tank, pool, a pool |
  | r2q12 | Trampoline eller huske | 7 | piano, outdoor couches, bicycle, couch, a swing, trampoline, football goals |
  | r2q38 | TV, PC eller mobil | 20 | television, pc, batteries, cell phone, computer, watch, console, tv, phone |
  | r1q7 | Gresskar | 54 | pumking, calabaza pumking, auyama, pumpkin |
  | r1q17 | Ball eller medaljer | 7 | handbag, bat, ball, medal, medals, tennis, trophies |
  | r1q20 | En mobiltelefon | 1 | an iphone (brand removed, as the spec says) |
  | r2q8 | Vekter | 63 | watchmen, watchers, watchman, vigilant |
  | r1q11 | Politiet | 10 | police, 911 |
  | r2q14 | Studere likevel | 2 | study |
  | r1q18 | Undertøy | 84 | underpants, boxers, lingerie, panties |

  The labels pick the cluster's main meaning, and a few (r2q12 "Trampoline eller huske", r1q17 "Ball eller medaljer") name only part of a mixed cluster. That is a fair choice for raw survey data. Findings 2 and 3 list the places where the Norwegian does not fit.

## Findings

### Medium

#### 1. Merging the epic deploys code that reads `game.question_set` before the pilot database has the column

- **Location:** `src/server/games/index.ts:113-124` (`getOwned` selects `questionSet`), `src/server/games/index.ts:170` (`lockForMutation` uses `.select()`, which lists every column in the schema), `drizzle/0014_brainy_electro.sql`; the pilot procedure is in `tests/manual/checklist.md`, "Pilot (NFR-2, Story 7.5)".
- **Source:** triage, from the orchestrator's migration focus. No layer raised it.
- **What happens:**
  - The checklist records that the Vercel project deploys production from `main`, and that the pilot is migrated by hand with `npm run db:migrate`.
  - When the epic's PR is merged, the new build goes live at once. Until someone runs the migration against Neon, every query that names `game.question_set` fails with "column does not exist". That covers every Game page (`getOwned`) and every Host or Player mutation (`lockForMutation`), including the Participant's submit.
  - Nothing in the diff, the spec or the checklist says that the migration must run first.
- **Why it is safe to fix by order:** the column is nullable and additive. The code that is live now never names it, so migrating before the merge breaks nothing.
- **Fix (no code change):**
  - Run `npm run db:migrate` against `DATABASE_URL_UNPOOLED`, following the checklist's migrate note, before merging.
  - Say so in the PR description, and add a line to the pilot section: "a PR with a migration is merged only after the pilot is migrated".
  - Check `/api/health` and one Game page on the pilot after the deployment.

### Low

#### 2. Two translations do not fit their clusters (r2q47, r2q42)

- **Location:** `data/question-sets/protoqa-nb.json` (r2q47 text, r2q42 cluster `r2q42.3`), and the README list.
- **Source:** Blind Hunter (r2q47) and the triage spot check (r2q42).
- **What happens:**
  - r2q47, "Nevn noe du kan finne på å knuse med vilje." "Knuse" means to smash. It fits "Tallerken eller glass", but not "Papir eller konvolutt" (envelope, paper sheet, a letter), "Blyant" or "Spagetti eller kjeks". At the table, those slots read as wrong answers.
  - r2q42, "Glemte passet". The cluster is "forget the passport, forget your phone, forget something, time". The label is narrower than the cluster, so a team that says "glemte mobilen" may be refused a slot the data gives them.
- **Fix:** change the r2q47 text to "Nevn noe du kan finne på å ødelegge med vilje." and the r2q42 label to "Glemte noe viktig". Counts stay unchanged. Update the README list in the same commit.

#### 3. The tie order inside a Board is never checked against fixed data

- **Location:** `tests/integration/question-sets.test.ts:97-135`, `tests/unit/question-sets.test.ts:65-80`, `tests/e2e/question-sets.spec.ts:33`, and the group order in `data/question-sets/protoqa-nb.json`.
- **Source:** Blind Hunter.
- **What happens:**
  - 20 of the 25 Questions have equal Counts inside the Board. The file keeps such Groups in cluster-id order, while `rankGroups` orders them by the `nb`-collated label. So the file order is not the slot order. In r2q12, "Hageutstyr og trær" is listed first, but "Basseng eller vanntank" gets slot 1. In r2q21, the four Groups with Count 1 come out in reverse.
  - The AC2 test builds its expected slots with the same `boardCut(rankGroups(...))` call as production, so it proves that the data passes through the function, not that the order is right. The e2e takes `groups[0]` as slot 1, which holds only because the first Question of "Hjemme" has no tie at the top.
  - The spec's triage log rejected the `groups[0]` concern with "the data is in count order". That is true for Count, not for slot position.
- **Fix:** add one fixed assertion to the integration test, for example that r2q12's slot 1 is "Basseng eller vanntank" with Count 19. Add one sentence to the file's `note` (or to `ATTRIBUTION.md`) saying that the slot order is computed by the app, not taken from the file order.

#### 4. No test shows that the chosen set survives a failed submit

- **Location:** `src/components/CreateGameForm.tsx:21` and `:71-73`; `tests/e2e/question-sets.spec.ts:10-23`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** the select is controlled, and the comment says that the chosen set survives a failed submit. No test submits a failing form with a set chosen. If the select became uncontrolled, React would reset it to "Jeg skriver egne" after the action. The Host would then fix the title and silently get an empty draft instead of a set Game, and no test would fail.
- **Fix:** in the e2e test, choose "Hjemme", leave the title empty, submit, and expect the select to still have the value `hjemme`. Then fill the title and continue as now, so the existing "Klar" assertion proves that the second submit took the set path.

#### 5. The unit test does not pin the "at least four Groups" that the triage log relies on

- **Location:** `tests/unit/question-sets.test.ts:30-48`; the claim is in the spec's triage log ("the unit test pins five Questions with at least four Groups each").
- **Source:** Edge Case Hunter.
- **What happens:** the test asserts `groups.length === min(BOARD_SIZE, clusters)`, so a Question with zero Groups would pass. The rejection of the empty-insert finding (`insert().values([])` throws) rests on a check that does not exist. The data is fine today: the smallest Board has four Groups.
- **Fix:** add `expect(q.groups.length).toBeGreaterThanOrEqual(4)` inside the loop.

#### 6. The played page tells the Host that "alle svarene" will be deleted, on a Game that has none

- **Location:** `src/app/spill/[id]/page.tsx:270`.
- **Source:** triage, from the author's open item.
- **What happens:** a set Game has no Participants and no Answers. Every set Game ends on "Spillet og alle svarene slettes automatisk …". That is not harmful, but it is wrong for this kind of Game, and the Host sees it every time.
- **Fix:** for a set Game, show "Spillet slettes automatisk {dato}." `game.questionSet` is already on the page.

#### 7. The AD-15 amendment has a garbled sentence

- **Location:** `ARCHITECTURE-SPINE.md:324`.
- **Source:** Blind Hunter.
- **What happens:** "… so equal Counts are ordered by the Norwegian label in `nb` collation, with the cluster id as the final tie key, with `group_id` null." The last clause seems to qualify the tie key, but it is about the stored rows.
- **Fix:** split it into two sentences: one on the order, and one saying that `board_slot.group_id` is null for a set Game.

#### 8. r2q31 contradicts its own question on the Board (decision needed)

- **Location:** `data/question-sets/protoqa-nb.json`, set `blandet-drops`, r2q31.
- **Source:** Blind Hunter and Acceptance Auditor.
- **What happens:** the question is "Nevn et kjæledyr folk har i bur, men ikke en fugl.", and the Board shows "Papegøye" (7). It also shows "Løve eller tiger" and "Hund" as caged pets. That is faithful to the source, because respondents gave those answers, but on the TV it invites a dispute at the table. The spec dropped r2q19 for a similar reason (clusters that do not make sense in Norwegian).
- **Options:**
  - **A (recommended):** replace r2q31 with another crowdsourced Question that has no tie at the eighth place and is neither US-specific nor crude. Update the README list.
  - **B:** keep it as it is, and treat it as a faithful oddity of the source.
  - Rewording the question to drop the bird exclusion is not a good option. The Counts were collected under that exclusion, so the Board would no longer match the question.

#### 9. The epic context and the planning documents still state the preconditions that the group overrode (defer)

- **Location:** `.docs/implementation-artifacts/epic-8-context.md:1`, `:7` and `:18`; `epics.md`, Story 8.1 ("Precondition: … settled with the course staff"); PRD §7 ("Stage 2 work starts only once SM-1 passes in full") and §10 item 3.
- **Source:** Blind Hunter and Acceptance Auditor. The Acceptance Auditor rated it medium.
- **What happens:**
  - The context file is committed in this diff. It says "If not settled, stop and ask the group", and it names `games.createFromQuestionSet` as the entry point.
  - The group's decision of 2026-11-23 is recorded on `main` in `wiki/prosjekt/beslutninger.md`. It covers starting Story 8.1 before SM-1 and not asking the course staff. The spec and the spine are amended, but the context file and the planning documents are not.
  - A grader reading the context next to the spec sees a gate that seems to have been ignored. The SM-1 gate still applies to stories 8.2 to 8.4, so the line on SM-1 must not simply be deleted.
- **Why low and deferred:** no code depends on these files, the decision is recorded, and the fix edits agent-context and planning documents.
- **Fix:** add a dated "*Amended 2026-11-23*" note to the context file and to Story 8.1 in `epics.md`. The note should say that 8.1 started before SM-1 by the group's decision, that the provenance question was settled without asking the course staff, and that the entry point is `review.createFromQuestionSet`. It should link the decision row.

#### 10. `EXPERIENCE.md` still promises the credit "without a layout change" (defer)

- **Location:** `EXPERIENCE.md:311`; `src/components/Board.tsx:324-387`.
- **Source:** Acceptance Auditor.
- **What happens:** for a set Game, the bar's gap changes from `gap-8` to `gap-6`, and the right end becomes a two-line block. The spec's triage kept this as a decision, because one line does not fit 1920 px. The design contract, which wins over everything else in this project, was not amended, so the code and the contract now disagree.
- **Fix:** add a dated amendment line to the play-view rules in `EXPERIENCE.md`: for a set Game, the right end of the bar holds two lines, the hints above the credit.

#### 11. No prompt-archive entry for epics 6 to 8 (defer)

- **Location:** `prompting/fase-4-implementering/`, which ends with `2026-11-23-epic-2-til-5.md`.
- **Source:** Blind Hunter.
- **What happens:** `CLAUDE.md` asks for prompts in `prompting/` as the work goes on, as evidence of AI steering for the 30 % process criterion. Story 8.1 has material worth archiving: the AI translated the Questions by hand, and the spec lists AI suggestions that were rejected or corrected. The gap started before this epic.
- **Fix:** add one archive file for epics 6 to 8 at the next session log.

## Dismissed

1. **The report URL still answers for a set Game** (author's open item; Edge Case Hunter, Blind Hunter). Agreed with the author's rejection. The route returns the zero counters and `questions: []`, because `grouping.usage` inner-joins `grouping_result`, which a set Game never has. It holds no Answer content, the button is hidden, and the route is reached only by typing the URL. A guard would add a branch for a case no user meets.
2. **No credit on Team setup or Final Scores** (author's open item; Edge Case Hunter, Acceptance Auditor, including the context file's "keep the credit reachable" line). Agreed with the author's rejection. Team setup shows only the Team name fields, and Final Scores shows only Teams and Scores. Neither screen shows any ProtoQA material. CC BY asks for credit where the material is used, and the play view carries it for the whole round, as `ATTRIBUTION.md` says.
3. **The credit is hidden while the failure banner shows** (Edge Case Hunter). This was rejected in the spec's triage. The banner is transient, and the credit comes back with the bar.
4. **An empty set makes `insert().values([])` throw** (Edge Case Hunter). False. The sets are committed static data with at least four Groups per Question. Finding 5 adds the assertion that keeps it so.
5. **r2q46 is US-specific, and its labels are near-synonyms** (Acceptance Auditor, Blind Hunter). Tipping for good service is common in Norwegian restaurants too, so the Question does not depend on a US custom. The six labels map to six distinct source clusters with their own Counts. Merging them would change Counts, which the spec forbids. The Host rules on a guess aloud, as on any Board.
6. **The cluster-to-`rankGroups` mapping is pasted three times** (Blind Hunter). Production has one copy. The two test copies restate the mapping on purpose. Sharing a helper would make the tests even more self-referential, which is the problem in finding 3.
7. **`lib/question-sets.ts` is "server only" by comment, not by guard** (Blind Hunter). `Board` gets the credit as a prop and imports nothing from the module. No client module imports it today. A guard means moving the constant into its own module for a mistake nobody has made.
8. **The create form does not explain what a set does, and the Game page never names the set** (Blind Hunter). Neither the PRD nor `EXPERIENCE.md` asks for this. The "Ferdige sett" group label and the "Klar" state say what happened. This is a feature request, not a defect.
9. **Demo mode is handled only in the README** (Blind Hunter, Acceptance Auditor). The demo Host uses the same create form and can pick any set, so the sets are available in Demo mode as PRD §4.8 asks. Seeding a set Game was rejected in the spec's Design Notes. The long README line is cosmetic, and `format:check` passes.
10. **`trace.test.ts` does not check the FR-33 section** (Blind Hunter). By design it checks only Stage 1 headings, as the spec's Code Map says. A Stage 2 list would be a new feature of the test.
11. **The e2e fit check measures only the bar's direct children** (Blind Hunter). The credit wrapper is a direct child. Flex items do not overlap unless the row overflows, and `scrollWidth` catches overflow. The risk from Linux fonts is already recorded in the spec.
12. **`authz.test.ts` was not extended as the Code Map said** (Acceptance Auditor). The owner checks live in `question-sets.test.ts` (Host B gets `NOT_FOUND` on `getOwned` and `startPlay`). `createGame` takes no foreign id, so `authz.test.ts` has nothing new to cover.
13. **The context file's "credit on Final Scores" guidance** (Acceptance Auditor). Same as item 2. The guidance applies only if Final Scores shows set material, and it does not.

## Verdict

**Approve after the deploy step in finding 1 and one content decision.** No high findings.

- **Correct and well guarded:**
  - one transaction for the Game, its Questions and its Board, validated before it opens;
  - a set Game cannot reach Collection, Grouping or Review;
  - Counts and Board membership that match the source for all 182 Groups, with no tie at the cut;
  - an additive, catalog-only migration with a correct snapshot chain;
  - the credit only on set Games, proved both ways;
  - full traceability from every Question and Group back to the source;
  - deletion and purge that treat a set Game like any other.
- **The one medium finding:** the pilot must be migrated before the merge, or every Game page and every mutation fails there until it is (finding 1).
- **The low findings:**
  - two translations that do not fit their clusters (2) and one Question that contradicts its own Board (8, a decision);
  - three test gaps (3 to 5);
  - one piece of copy (6) and one garbled spine sentence (7);
  - three documentation items to defer (9 to 11).
- **Before the PR:** migrate the pilot and say so in the PR description (finding 1), and decide finding 8. Findings 2 to 7 are each a one-line change or one test.

## Epic 8 review fixes

Fix round of 2026-11-24 on `epic-8-trinn-2`. Each finding was checked against the code and the data before it was acted on. The report was committed unchanged in `a32055f`.

| Finding | Outcome | Commit |
|---|---|---|
| 1. Deploy order | Fixed in the checklist. The pilot section of `tests/manual/checklist.md` now says that the migrations run on Neon before a PR whose code reads a new column is merged. Running the migration on the pilot is left to the orchestrator before the merge. | `90c0950` |
| 2. r2q47 and r2q42 | Fixed. r2q47 now reads "Nevn noe du kan finne på å ødelegge med vilje." "Brekke" was considered and rejected, because Norwegian does not "brekke" a plate, an egg or paper; "ødelegge" fits every cluster on the Board. "Glemte passet" is now "Glemte noe viktig", which covers the whole cluster. Counts are unchanged, and the README list is updated. | `1886bef` |
| 3. Tie order not pinned | Fixed. The integration test pins r2q12's eight slots, with ties at 19, 11 and 4, as literal labels and Counts. `ATTRIBUTION.md` says that the app orders the slots, so the file order is not the slot order. | `91476c3`, `1886bef` |
| 4. Set lost after a failed submit | Fixed, together with impeccable M1. The e2e step chooses a set, submits with an empty title, expects the select to keep the set, then fills the title and expects "Klar". It fails without the fix. | `3aab31a` |
| 5. At least four Groups | Fixed. The unit test asserts at least four Groups per Question. | `91476c3` |
| 6. "alle svarene" on a set Game | Fixed. A set Game's played page says "Spillet slettes automatisk …", and its *ready* panel says "Brettet er klart". Host-written Games keep both old texts. Checked in e2e. | `03f193d` |
| 7. Garbled AD-15 sentence | Fixed. Split into one sentence on the tie order and one on `board_slot.group_id` being null. | `c9d1e16` |
| 8. r2q31 (decision) | Option A. r2q31 is replaced in "Blandet drops" by r1q1, "Nevn noe som er vanskelig å gjette om en person du nettopp har møtt.", translated by hand. It has seven clusters, so there is no cut and no tie at the eighth place, and it is not US-specific. | `1886bef` |
| 9. Context and planning documents | Fixed. Dated notes in `epic-8-context.md` and Story 8.1 in `epics.md` record the group's decision of 2026-11-23, that the SM-1 gate still applies to 8.2 to 8.4, and the entry point `review.createFromQuestionSet`. | `c9d1e16` |
| 10. `EXPERIENCE.md` credit layout | Fixed. A dated amendment says that the bar's right end holds two lines for a set Game. | `c9d1e16` |
| 11. Prompt archive | Deferred. The orchestrator handles `prompting/`. | |

Note on dismissed item 12: the ponytail review's finding 1 removed the Host B test from `question-sets.test.ts`. The owner checks now rest on `authz.test.ts` (`getOwned` and `startPlay` for Host B) and on the first test's `hostId` check on the new row.

Verification: `npm run lint`, `npm run typecheck` and `npm run test` are green on every commit. `npm run test:e2e` ran in full before the last commit and again at the end.
