# Epic 8 ponytail review

Scope: `git diff origin/main...epic-8-trinn-2` (Story 8.1 so far: ready-made Question sets, FR-33). Assumed load: the pilot, a handful of Hosts at a time, plus one examiner on one laptop and CI. Nothing was changed.

What this change does: The create row on `/spill` gets a native select, "Spørsmål", with "Jeg skriver egne" or one of five ready-made sets. Choosing a set calls `review.createFromQuestionSet`, which in one transaction inserts the Game directly in *ready* (marked by the new nullable `game.question_set`), its five Questions, and each Board cut by the app's own `rankGroups` and `boardCut`. Play then runs unchanged through `review.getBoard`, the control bar credits ProtoQA as translated and adapted, and the README and `data/protoqa/ATTRIBUTION.md` carry the full credit.

I traced the create path (`createGame` calls `requireHost` before it branches on `questionSet`, and `createFromSetSchema` extends the FR-2 title rule, so both paths validate every field), `createFromQuestionSet` (the `find(...)!` is safe because the schema already refused unknown ids; Question ids are made with `randomUUID` before the insert, so the Board rows never depend on the order Postgres returns rows), the two readers of `question_set` (the report button on the Game page and the credit on `/skjerm`), the credit's path through `PlayStage`, `PlayView` and `Board`, and the *ready* panel, which says nothing about Review. I also ran a one-off script over the data: in 11 of the 25 Questions the JSON lists the Groups in cluster-id order, and `rankGroups` reorders equal Counts by the Norwegian label. The top slot of the Question the e2e test uses (r1q5, Count 43) has no tie, so the e2e is right.

Checked and found clean:

- **The new column is needed.** After creation, nothing else reliably tells a set Game from a Host-written one, and two screens need to know (the credit and the hidden report). The other candidate, `board_slot.group_id IS NULL`, would be an implicit rule and an extra query on each page. The spine already listed `game.kind` as the Stage 2 decision, and one nullable text column covers both the kind and the set id. The anonymity guard in `host-view.test.ts` moved from 9 to 10 columns and still fails on any further column.
- **The data file is the right size.** 28 KB and 1,097 lines of pretty-printed JSON for 25 Questions and 182 Groups. Each Group keeps its `cluster` and each Question its `sourceId`, which the unit test needs to check every Count against the source and which CC BY's "indicate changes" relies on. The three top-level fields (`source`, `licence`, `note`) are unused by code, but they are three lines that document the file.
- **The loader is the smallest form.** A static JSON import is typed, needs no `fs` read or `outputFileTracingIncludes` entry (which the `data/rulings` reader needs), and stays on the server because `/spill` passes only `{id, name}` to the client form. The `../../` import with its `eslint-disable` line is the cheapest way out of `src`: a new path alias would touch `tsconfig`, Vitest and the lint zones for one import, and moving the file into `src` would split it from its source and attribution.
- **No new owners or tables.** `games.insertReady` and `questions.insertAll` take `tx` like the other exported writers (AD-1), and the spine is amended in the same change.
- **Dead code and AI leftovers:** no commented-out code, debug output, `.only`, `.skip`, `TODO` or `shortcut:` comments in the diff.
- **Accessibility:** the select has a real label, `aria-invalid` and `aria-describedby` on error, and axe runs on the create row and the play view.

## Must fix

None.

## Should fix

1. **Five tests prove what another test already proves** (`tests/integration/question-sets.test.ts:L187-193, L222-232, L254-265`, `tests/unit/question-sets.test.ts:L83-93`, `tests/e2e/question-sets.spec.ts:L91-96`)
   - **What this is:** The new test files repeat checks that already exist in this epic or in `authz.test.ts`.
   - **Problem:**
     - *Logged out* (integration L187-193): `createGame` calls `requireHost` before it looks at `questionSet`, and `authz.test.ts:L159` already proves the logged-out redirect for `createGame`.
     - *Host B gets `NOT_FOUND`* (integration L222-232): it runs `getOwned` and `startPlay`, two existing owner checks with their own tests. The only new owner-related line is `hostId` in `insertReady`, and the first test already checks `hostId: hosts.A` on the row.
     - *Schema refuses an unknown id* (unit L83-93): the integration test at L159-171 proves the same message end to end, and that no Game is made.
     - *Credit rendered on the stage* (integration L254-265): the e2e test at L40 proves the credit is visible in the real control bar, and must stay for the 1920×1080 fit check.
     - *Default select makes a draft* (e2e L91-96): the e2e already checks that the select defaults to `""` (L15), and the integration test at L144-157 proves that `""` makes a *draft*.
   - **Fix:** Delete the five blocks, the now unused `prerenderToNodeStream`, `ScreenPage` and `QUESTION_SET_CREDIT` imports in the integration file, and the `gamePath` line in the e2e. Update the three FR-33 bullets in `tests/TRACE.md` to match. Keep the negative credit check in `play.test.ts`, which nothing else proves.
   - **If we skip it:** Nothing breaks. About 50 lines that must change whenever the credit text, the owner rule or the form changes.

2. **One unit test cannot fail** (`tests/unit/question-sets.test.ts:L65-81`)
   - **What this is:** "rankGroups and boardCut keep every Group of a set Question" runs each Question's Groups through the two functions and checks that the Board has as many slots as the data has Groups.
   - **Problem:** `boardCut` drops only discarded Groups and anything past eight. The test above it (L30-49) already proves each Question has at most eight Groups, and the data has no `discarded` field. So the length always matches. The test also does not pin what the other tests quietly rely on, which is the order: in 11 of 25 Questions, the JSON order differs from the Board order.
   - **Fix:** Delete it. The integration test at L97-142 already checks the real Board, order included, through `review.getBoard`.
   - **If we skip it:** 17 lines that look like a guard but guard nothing.

## Nice to have

3. **The README section repeats the attribution file** (`README.md:L142-161`, `README.md:L236`)
   - **What this is:** The new "Ferdige spørsmålssett" section is six lines of prose plus a collapsible list of the 25 Questions, and the demo paragraph gets one extra sentence.
   - **Fix:** Keep the first sentence, the credit sentence with both links, and "oversatt og tilpasset". Drop "25 av 52 spørsmål, oversatt for hånd, med norske gruppenavn og de opptil åtte største gruppene. Tellingene er uendret.", since `ATTRIBUTION.md` (linked right after) lists the changes, which is what CC BY asks for. Keep the `<details>` list, which the group asked for. Wrap the new demo sentence like the rest of the paragraph; it is the only line in that block over 100 characters.
   - **If we skip it:** The README has two to three lines more than it needs, and the change list lives in two places.

4. **The select copies the field markup from `TextField`** (`src/components/CreateGameForm.tsx:L64-99`, `src/components/TextField.tsx:L31-58`)
   - **What this is:** The select repeats the label, the error paragraph with its hidden "Feil:" prefix, and the error and normal border classes from `TextField`.
   - **Fix:** Export the border class rule from `TextField.tsx` as a small function (`fieldClass(error)`) and use it in both places. Do not make a `Select` component for one use.
   - **If we skip it:** A later change to the field look must be made twice, and the select may drift from the house style.

Verdict: Ship. Findings 1 and 2 are test cleanups worth doing before the PR. Findings 3 and 4 are optional.

Lean: -70 lines possible (about 50 in duplicated tests, 17 in the unit test that cannot fail, and 3 in the README).

Not checked: the full Vitest and Playwright runs (other reviewers share this working copy), the control-bar fit with Linux CI fonts, and the quality of the Norwegian translations.
