# Manual checklist

What the automated tests cannot prove (SM-1). The A rows are copied from the Accessibility Floor table in `EXPERIENCE.md`. Run every row once before the Stage 1 freeze (1 December) and again before handing in, on a real phone or TV where the row says so. A person fills in Result and Date: write "pass" or "fail", the device or machine, and for a T row the slowest of five tries. The AI that builds the app fills in no result. A failed row needs a fix, or, only for a slip-list item, a slip stated in the README.

## How to prepare

Run on the Game named in the "Run on" column.

- **Sizing Game (S).** `npm run seed:sizing` recreates `.data/sizing` with one _collecting_ Game: 15 Questions, 30 links and 30 Answer sets of 1–5 Answers. Question 1 has 200 characters, and a 40-character Answer of wide letters ("MMMM…Ø") tops its Board. It prints the login. Then start the production build on it:

  ```bash
  npm run build
  DATABASE_URL=pglite://.data/sizing JUDGE_PROVIDER=replay npm run start
  ```

  Log in, close the Collection, review every Question, lock the Board and play. With `replay` and no Stored ruling for these Questions, every Question falls back to one Group per distinct Answer and no model is called. Stop the server before running `npm run seed:sizing` again.

- **Demo (D).** `npm run demo` starts the demo Game on `http://localhost:3000` and prints its login.
- **Own Game (O).** Any Game made through the UI with at least three Answer sets, for the Participant pages and the states the sizing Game does not reach by itself.
- **Real device.** A1 needs a real TV at 3 m, A3 and A4 a real phone. Note the model and browser.

## Accessibility

| #   | Check                                                                                                                                                                                   | Covers              | Run on   | Result | Date |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------- | ------ | ---- |
| A1  | Play view on a 1920×1080 window: question, labels, Counts, Team names and Scores measure ≥ 48 px in dev tools; readable from 3 m on a real TV                                           | FR-24               | S, TV    |        |      |
| A2  | Complete the answer form with keyboard only (Tab, Shift+Tab, Enter, Space), including the error summary links                                                                           | NFR-6               | O        |        |      |
| A3  | Complete the answer form with VoiceOver (iOS) or TalkBack: notice, legends, labels, errors and confirmation are read                                                                    | NFR-6, FR-14        | O, phone |        |      |
| A4  | Answer form at 360 px and 320 px, and at 200 % zoom: no horizontal scroll, keyboard never hides the focused field                                                                       | NFR-4, NFR-6        | O, phone |        |      |
| A5  | Run axe (or Lighthouse accessibility) on landing, log in, Game list, Game page in each state, Review, play view, answer form, closed and unknown pages: no serious or critical findings | NFR-6               | S, D, O  |        |      |
| A6  | Review end to end with keyboard only: merge, move, new Group, rename, discard, undo discard, mark, confirm                                                                              | NFR-6, FR-20, FR-21 | S        |        |      |
| A7  | Play view: no raw Answer, discarded Group or below-limit Group is visible at any point of a full round                                                                                  | FR-24               | S        |        |      |
| A8  | Play view, 200-character Question + 8 Groups, and four 14-character Team names of wide letters (e.g. "WWWW…"): everything fits 1080 px with the control bar and every Score visible     | FR-24               | S (Q1)   |        |      |
| A9  | Play view, a 40-character label of wide letters (e.g. "MMMM…Ø") shows in full, wrapped if needed, never truncated                                                                       | FR-24               | S (Q1)   |        |      |
| A10 | Review, keyboard only: the focus ring is visible on every SelectionBar control                                                                                                          | NFR-6               | S        |        |      |

For A5, the axe DevTools browser extension or Chrome's Lighthouse (Accessibility only) is enough. Visit the Game page in all seven states: _draft_ and _collecting_ on an own Game, _grouping_ right after close, then _in review_, _ready_, _playing_ and _played_ on the sizing Game. The closed page is an old link after close, and the unknown page is `/svar/<any uuid>/x`. Note any serious or critical finding with its page.

## Timing (NFR-5)

Measured by hand on the sizing Game (S) in Review and play, on a laptop against `npm run start` as prepared above. Time each action from the click to the result on screen, five times, and note the slowest try, the date and the machine.

| #   | Check                                                                                                                       | Covers                     | Run on | Result | Date |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------ | ------ | ---- |
| T1  | Merge two Groups: from the click on "Slå sammen 2 grupper" to the re-sorted list, within one second                         | NFR-5, FR-20               | S      |        |      |
| T2  | Move Answers: from the click on "Flytt" (and on "Ny gruppe") to the refreshed list with focus moved, within one second      | NFR-5, FR-20               | S      |        |      |
| T3  | Rename (Enter to the closed field with the new label), "Forkast fra brettet" and "Angre forkasting": each within one second | NFR-5, FR-20               | S      |        |      |
| T4  | "Marker som gjennomgått": from the click to the next Question with focus on its heading, within one second                  | NFR-5, FR-21               | S      |        |      |
| T5  | "Lås brettet" in the dialog: from the click to the Game page showing "Brettet er låst", within one second                   | NFR-5, FR-21               | S      |        |      |
| T6  | Avslør a tile: from the click (or rank key) to the revealed label and Score, within one second                              | NFR-5, FR-25               | S      |        |      |
| T7  | Bom, Angre, Neste lag and the uten-poeng toggle each show their result within one second                                    | NFR-5, FR-25, FR-26, FR-27 | S      |        |      |
| T8  | "Neste spørsmål" to the next Question, and "Vis sluttstilling" to "Sluttstilling", each within one second                   | NFR-5, FR-27               | S      |        |      |

**Supporting evidence, not a result.** On 2026-11-23 a Playwright script timed six Host actions on the pilot (Vercel functions in `fra1`, Neon Postgres, one invented Game of 5 Questions and 5 Answer sets): merge 0.82 s, rename 0.29 s, discard 0.31 s, mark reviewed 0.81 to 0.83 s, Board lock 1.18 s including the redirect to the Game page, and saving a Question 0.18 s. See "Pilot measurements" in `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md`. It was a smaller Game, a scripted run and a hosted database, so it fills no T row. It does show that T5 is the row most likely to miss one second.

## Demo content

Before a branch that changes the demo is merged, and once before the freeze, someone reads `src/server/demo.ts`, `src/lib/demo.ts` and `data/rulings/demo.json`. Note the reviewer, the result and the date.

| #   | Check                                                                                                                                      | Covers      | Run on | Result | Date |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------ | ------ | ---- |
| D1  | Every Question, Answer, title and credential in the demo is invented, holds no real person's name, and nothing in it derives from `.idea/` | FR-31, §6.1 | files  |        |      |

## Fresh clone

Story 7.4 records the fresh-clone run here.

| #   | Check                                                                                                                                                                                                           | Covers       | Run on        | Result | Date |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------- | ------ | ---- |
| F1  | On a machine without the repository and with no key set: `git clone`, `npm install`, `npm run demo` and the printed login reach the demo Game; `npm run test`, `npm run test:e2e` and `npm run judge:eval` pass | NFR-1, FR-30 | fresh machine |        |      |

## SM-1 gate

**Status: not passed** (last updated 2026-11-23).

SM-1 counts every testable Stage 1 consequence, except slip-list items the README names as moved to Stage 2. The automated part is `tests/TRACE.md`, checked by `tests/unit/trace.test.ts`, and runs green in CI with no key and no network. SM-1 passes only when every item below is closed: each row above has a Result and Date with "pass" (or a fix and a new pass), and each open trace item is done. Update this list whenever an item closes.

Open items:

- Accessibility rows without a result: A1, A2, A3, A4, A5, A6, A7, A8, A9, A10.
- Timing rows without a result: T1, T2, T3, T4, T5, T6, T7, T8.
- Demo content: D1.
- Fresh clone: F1 (Story 7.4).
- SM-3 anonymity audit: `tests/manual/anonymity-audit.md` has no recorded run.
- README items marked "Open" in `tests/TRACE.md` (Story 7.4): the anonymity section and its limits (FR-14), the three commands and printed demo login (FR-31, NFR-1), and the environment table and hand-in zip (NFR-8).

SM-2 is reported, not gated. The live ProtoQA figure, recorded 2026-11-23 with prompt version 1 and `deepseek/deepseek-v4.1-flash`, is B-cubed F1 0.6849 (precision 0.9809, recall 0.5261), 1.40 calls per Question, with 15 of 52 Questions falling back on `INVALID_OUTPUT`. Reasoning was tried and rejected (see `.docs/implementation-artifacts/spec-7-2-judge-evaluation-against-protoqa.md`). The figure is below 0.70, which does not fail SM-1. The README (Story 7.4) reports it.

The slip list in PRD §6.5 has three items. What is known about each:

- Pilot deployment: live at the pilot URL since 2026-11-23, but Story 7.5 is still in the backlog.
- `judge:eval --live`, the live regeneration of the rulings: run on 2026-11-23 (Story 7.2).
- SM-4, the local measurement on real Answers: not run in this repository.

The README (Story 7.4) must state which of them slipped.
