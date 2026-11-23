# Manual checklist

What the automated tests cannot prove (SM-1). Each row is copied from the Accessibility Floor table in `EXPERIENCE.md`. Run every row before a release and before handing in, on a real phone where the row says so, and note the date, device and result.

| #   | Check                                                                                                                                         | Covers              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| A1  | Play view on a 1920×1080 window: question, labels, Counts, Team names and Scores measure ≥ 48 px in dev tools; readable from 3 m on a real TV | FR-24               |
| A2  | Complete the answer form with keyboard only (Tab, Shift+Tab, Enter, Space), including the error summary links                                 | NFR-6               |
| A3  | Complete the answer form with VoiceOver (iOS) or TalkBack: notice, legends, labels, errors and confirmation are read                          | NFR-6, FR-14        |
| A4  | Answer form at 360 px and 320 px, and at 200 % zoom: no horizontal scroll, keyboard never hides the focused field                             | NFR-4, NFR-6        |
| A6  | Review end to end with keyboard only: merge, move, new Group, rename, discard, undo discard, mark, confirm                                    | NFR-6, FR-20, FR-21 |
| A7  | Play view: no raw Answer, discarded Group or below-limit Group is visible at any point of a full round                                        | FR-24               |
| A8  | Play view, 200-character Question + 8 Groups: everything fits 1080 px with the control bar visible                                            | FR-24               |
| A9  | Play view, a 40-character label of wide letters (e.g. "MMMM…Ø") shows in full, wrapped if needed, never truncated                             | FR-24               |
| A10 | Review, keyboard only: the focus ring is visible on every SelectionBar control                                                                | NFR-6               |

## Timing (NFR-5)

Measured by hand on the sizing Game (30 Answer sets, 15 Questions, up to 5 Answers each) in Review, on a laptop against `npm run start`. Note the date, machine and the slowest of five tries.

| #   | Check                                                                                                                       | Covers       |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------ |
| T1  | Merge two Groups: from the click on "Slå sammen 2 grupper" to the re-sorted list, within one second                         | NFR-5, FR-20 |
| T2  | Move Answers: from the click on "Flytt" (and on "Ny gruppe") to the refreshed list with focus moved, within one second      | NFR-5, FR-20 |
| T3  | Rename (Enter to the closed field with the new label), "Forkast fra brettet" and "Angre forkasting": each within one second | NFR-5, FR-20 |
| T4  | "Marker som gjennomgått": from the click to the next Question with focus on its heading, within one second                  | NFR-5, FR-21 |
| T5  | "Lås brettet" in the dialog: from the click to the Game page showing "Brettet er låst", within one second                   | NFR-5, FR-21 |
| T6  | Avslør a tile: from the click (or rank key) to the revealed label and Score, within one second                              | NFR-5, FR-25 |
