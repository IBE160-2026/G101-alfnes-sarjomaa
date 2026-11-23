# Manual checklist

What the automated tests cannot prove (SM-1). Each row is copied from the Accessibility Floor table in `EXPERIENCE.md`. Run every row before a release and before handing in, on a real phone where the row says so, and note the date, device and result.

| #   | Check                                                                                                                | Covers       |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| A2  | Complete the answer form with keyboard only (Tab, Shift+Tab, Enter, Space), including the error summary links        | NFR-6        |
| A3  | Complete the answer form with VoiceOver (iOS) or TalkBack: notice, legends, labels, errors and confirmation are read | NFR-6, FR-14 |
| A4  | Answer form at 360 px and 320 px, and at 200 % zoom: no horizontal scroll, keyboard never hides the focused field    | NFR-4, NFR-6 |
| A10 | Review, keyboard only: the focus ring is visible on every SelectionBar control                                       | NFR-6        |

## Timing (NFR-5)

Measured by hand on the sizing Game (30 Answer sets, 15 Questions, up to 5 Answers each) in Review, on a laptop against `npm run start`. Note the date, machine and the slowest of five tries.

| #   | Check                                                                                                                  | Covers       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| T1  | Merge two Groups: from the click on "Slå sammen 2 grupper" to the re-sorted list, within one second                    | NFR-5, FR-20 |
| T2  | Move Answers: from the click on "Flytt" (and on "Ny gruppe") to the refreshed list with focus moved, within one second | NFR-5, FR-20 |
