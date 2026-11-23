---
title: 'Story 5.6 (extra): handoff from the instructor''s PRD feedback'
type: 'chore'
created: '2026-11-23'
baseline_revision: 'f9b56e8c6aa8aaea5edd8aab434aa85a53ff6835'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: []
deferred:
  - summary: >-
      The answer-form mock in key-screens.html still shows the old instruction line "Gi 1–5 svar per spørsmål, det viktigste først."
    evidence: |-
      EXPERIENCE.md rejects asking for "the most important" and fixes the line as "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1."; the UX memlog already records "Mock not updated" after the impeccable critique, so the drift predates this story.
    location: >-
      .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/mockups/key-screens.html:186
    severity: low
---

<intent-contract>

## Intent

**Problem:** The instructor's PRD feedback (`tilbakemelding-prd.md` on `main`) led to PRD amendments on `main` (2026-11-23) and a Sprint Change Proposal (`.docs/planning-artifacts/sprint-change-proposal-2026-11-23.md` on `main`) whose §6 hands work to this branch: the answer form's notice does not mention the model provider (FR-14), no test feeds the Judge a prompt-injection Answer (FR-15), no test scans for Answer text after deletion (FR-3), and the spine, epics and delivery notes still say "until it passes", "F1 at least 0.70" as a test assertion and "no pair is judged twice". This is an extra story, not in `epics.md`.

**Approach:** Apply handoff items H1, H2, H3, H5, H6, H7 and H8 as written in the proposal: one constant notice text in code, UX and tests; two new tests; text edits to the spine, epics, delivery notes and `tests/TRACE.md`. The optional H3 lint rule is cheap, so it is included.

## Boundaries & Constraints

**Always:** the notice is exactly "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet, og svarene kan bli sendt til en ekstern KI-tjeneste for gruppering." with no condition (proposal D1); tests run offline (NFR-3); the injection tests assert recoverability, not immunity (D3); Vitest timeouts stay global.

**Never:** add or edit the PRD or the proposal on this branch; rewrite done-story specs or `epic-2-context.md` (they are records); create `judge-eval.test.ts` (Story 7.2); change the prompt or `PROMPT_VERSION`; touch `.logs/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hostile Answer in the prompt | `messages()` with an Answer holding quotes, `]}`, a fake `{"assignments":[0` and a newline | System message byte-identical to the normal one; the user content parses to exactly `{question, answers}` and the Answer is one element of `answers` | No error expected |
| Judge obeys the injection | Mock puts every item in one Group | Game reaches *in review* with one `judge` Group; `review.moveAnswers` into a new Group moves the hostile Answer out, Counts follow | No error expected |
| Judge returns wrong-length output | Mock returns too few assignments | Already covered: `canonicalise` "wrong length" is `INVALID_OUTPUT` (`judge.test.ts`), and the reason loop in `grouping.test.ts` falls a Question back with `INVALID_OUTPUT`; referenced in TRACE, not duplicated | Fallback |
| Deletion | Marker in a Question, Answers and a renamed Group label; closed, grouped, deleted | No `text`, `varchar`, `json` or `jsonb` column in any user schema holds the marker | — |

</intent-contract>

## Code Map

- The proposal (§6 holds the exact replacement text for H1 to H8) and the amended PRD exist only on `main`: read them with `git show origin/main:.docs/planning-artifacts/sprint-change-proposal-2026-11-23.md` and `git show origin/main:.docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md` (PRD §6.5 holds the slip list). Never write them to this branch.
- `src/components/AnswerForm.tsx:40-41` -- `NOTICE` constant, rendered at `:354` in an info `Notice`.
- `tests/e2e/answer-form.spec.ts:13-14` -- e2e pin of the notice; asserted at `:114` (360 px test at `:107`, 320 px at `:157`).
- `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md:155-185, :193, :132` -- wireframe, exact copy, "(split)" wording.
- `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/mockups/key-screens.html:185` and `.memlog.md:25` (superseded decision; append, do not edit).
- `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md` -- `:44` FR-14 summary, `:48` FR-18 "split", `:109` cut order, `:133` UX-DR19, `:562` Story 2.4 AC1, `:1021` Story 5.3, `:1315-1318` Story 7.2 AC2, Story 7.3 AC1/AC3, Story 7.4 AC2/AC5, `:1551` note 14.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- `:237` AD-12 cost, `:282` AD-13 quality bar, `:425` AD-22 judge-eval line, `:493` Delivery row, `:618` Deferred.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md:75-83` -- Stage 1 cut order.
- `src/server/judge/prompt.ts` -- `messages()` (read only): system prompt plus `JSON.stringify({question, answers})`.
- `tests/unit/judge.test.ts:92-109` -- `canonicalise` tests; the new `messages()` test goes beside them.
- `tests/integration/grouping.test.ts` -- `groupingGame`, `mock`, `groupsOf`, `stateOf`; reason loop at `:423`. `review.moveAnswers(hostId, input)` (`src/server/review/index.ts:245`) is the Host path for "Ny gruppe".
- `tests/integration/delete.test.ts` -- cascade catalog test; the real close path is shown in `grouping.test.ts:733-771`.
- `eslint.config.mjs:23-26` -- `PROVIDERS` ban applied to every `src/server` zone except `src/server/judge`; `tests/unit/lint-zones.test.ts` holds one case per rule.
- `tests/TRACE.md` -- FR-3 (`:33`), FR-14 (`:197`), FR-15 (`:205`).

## Tasks & Acceptance

**Execution:**
- `src/components/AnswerForm.tsx`, `tests/e2e/answer-form.spec.ts` -- new notice text -- H1.
- `EXPERIENCE.md`, `mockups/key-screens.html`, UX `.memlog.md`, `epics.md` `:44`, `:133`, `:562` -- same text; wireframe reflowed at its column width; memlog entry superseding `:25` -- H1.
- `tests/unit/judge.test.ts` -- `messages()` injection test -- H2.
- `tests/integration/grouping.test.ts` -- all-in-one-Group mock with a hostile Answer, then `review.moveAnswers` to a new Group -- H2.
- `tests/integration/delete.test.ts` -- marker text scan after a real create, submit, close, group, rename and delete -- H3.
- `eslint.config.mjs`, `tests/unit/lint-zones.test.ts` -- `@/server/judge/record` is private to `src/server/judge` and `src/cli` -- H3 optional.
- `ARCHITECTURE-SPINE.md` -- AD-12, AD-13, AD-22, Delivery, Deferred -- H5.
- `epics.md` -- Story 7.2 AC2, Story 7.3, Story 7.4, `:109`, `:1551`, `:48` -- H6; `:1021` and `EXPERIENCE.md:132` -- H8.
- `delivery-notes.md` -- cut order mirrors PRD §6.5 -- H7.
- `tests/TRACE.md` -- FR-3, FR-14, FR-15 lines -- H1 to H3.
- `sprint-status.yaml` -- `5-6-teacher-feedback-handoff: done` under epic 5.

**Acceptance Criteria:**
- Given an open Invite link, when the answer form renders at 360 px, then the info Notice above the first Question reads exactly the new text and there is no horizontal scroll.
- Given the spine, epics and delivery notes on this branch, when searched, then none says "until it passes", "F1 at least 0.70" as a test assertion, or "no pair is judged twice".
- Given `npm run lint`, `npm run typecheck`, `npm run test` and `npm run test:e2e`, when run offline, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 32 findings — high 0, medium 9, low 17, false 6, maybe-false 0
- findings:
  - `[medium]` `[patch]` (verification gap) The new lint ban on `@/server/judge/record` is bypassed because the `@/server/judge` barrel re-exports `record` — verified with eslint on `import { record } from "@/server/judge"` in grouping; fixed by removing the re-export (the CLI imports `@/server/judge/record` directly), so the barrel route is a type error and the deep route a lint error.
  - `[low]` `[patch]` (verification gap) TRACE FR-3 line claimed "no Judge cache or ruling store keeps the Game's text", but the scan reads only database columns — reworded to what the scan shows; the ruling-store guarantee now rests on the lint and barrel line.
  - `[medium]` `[patch]` (blind) Lint rule bypassable through the barrel — same root and fix as the first row.
  - `[false]` `[reject]` (blind) The README contract's "With live Grouping on, Answer texts are sent to the model provider" contradicts D1 — it states when sending happens, which agrees with the notice's "may be sent"; D1 governs the notice, not the README limit.
  - `[low]` `[patch]` (blind) delivery-notes README contract lacked the §6.5 slip outcome and the SM-2 tuning history that the spine and Story 7.4 now require — added to the contract's Stage 2 bullet.
  - `[false]` `[reject]` (blind) sprint-status says done while the spec says in-review — the spec was mid-review; finalisation sets it to done in the same commit.
  - `[low]` `[reject]` (blind) The spec does not say why H4 is skipped — the fix edits this build's spec; H4 (README) belongs to Story 7.4 and is noted in the run result.
  - `[low]` `[patch]` (blind) TRACE FR-14 read as if "no condition on the provider" were tested, while e2e runs only with replay — reworded: one constant in code, no condition.
  - `[medium]` `[patch]` (blind) The text scan skipped column types outside text, varchar, json and jsonb (arrays, citext, character) — the type filter is dropped, every column in user schemas is cast to text and scanned.
  - `[low]` `[patch]` (blind) TRACE FR-3 overclaim — same root and fix as the second row.
  - `[low]` `[defer]` (blind) key-screens.html still shows the old instruction line — pre-existing drift (memlog: "Mock not updated"); deferred.
  - `[low]` `[patch]` (blind) ARCHITECTURE-SPINE still called "Ny gruppe" a split — renamed to "move to a new Group"; the Board-cut "split" at line 216 is another sense and stays.
  - `[low]` `[reject]` (blind) Story 7.2 AC2 does not say where the pinned values live — the text is the proposal's; choosing the location is Story 7.2's design work, and nobody meets the gap before then.
  - `[low]` `[patch]` (blind) Story 7.3 AC1, a unit test, carried a README slip rule it cannot check — the clause moved to AC3 (manual) and AC1 has its original text.
  - `[low]` `[patch]` (blind) AD-12 put no-retry figures next to "at most 40 per Game" — the figures are now labelled as the case without retries.
  - `[low]` `[reject]` (blind) The spec's acceptance criteria and verification do not list every test — the fix edits this build's spec; the full suite and full e2e ran anyway.
  - `[false]` `[reject]` (blind) Export `NOTICE` and import it in the e2e spec — the literal in the spec is the pin; importing the constant would let a code change pass its own test.
  - `[medium]` `[patch]` (edge case) Barrel re-export bypasses the lint ban — same root and fix as the first row.
  - `[medium]` `[patch]` (edge case) Type filter in the scan — same root and fix as the ninth row.
  - `[medium]` `[patch]` (edge case) TRACE claims lint makes the recorder unreachable from Grouping — true after the barrel fix; the line now names both routes.
  - `[low]` `[patch]` (edge case) TRACE FR-3 overclaim — same root and fix as the second row.
  - `[false]` `[reject]` (edge case) The cut order also cuts the CI Postgres job and e2e breadth, which PRD §6.5 does not list — neither is a PRD requirement (they are architecture extras), and handoff H7 prescribes exactly this list.
  - `[medium]` `[patch]` (intent) The injection integration test did not close a Game, as the FR-15 consequence and H2 say — it now goes through `createInviteLinks`, `submitAnswerSet` (the hostile text, newline included, is accepted and stored as written), `closeCollection` and the after-task.
  - `[low]` `[patch]` (intent) The scan reaches only the database while TRACE claimed the ruling store — same root and fix as the second row.
  - `[medium]` `[patch]` (intent) Barrel bypass — same root and fix as the first row.
  - `[low]` `[patch]` (intent) "Always shown" is true by construction, not by test — same fix as the FR-14 TRACE row.
  - `[medium]` `[patch]` (intent) TRACE lacked lines for FR-17's invalid output and FR-15's "every Answer in exactly one Group", which the handoff's success criterion requires — lines added that point only at existing tests (`canonicalise`, the openrouter retry, the reason loop, `ungrouped()` and the single `answer.group_id` key).
  - `[low]` `[patch]` (intent) Story 7.3 AC1 slip clause — same root and fix as the Story 7.3 row above.
  - `[false]` `[reject]` (intent) Story 7.3 AC3 now allows a stated slip only for §6.5 items, beyond H6 — this is PRD §6.5's own "Nothing else slips" rule.
  - `[false]` `[reject]` (intent) Status fields disagree — same as the blind row; transient during review.
  - `[low]` `[reject]` (intent) The memlog entry does not cite line 25 — it says it supersedes the anonymity notice decision above, which is unambiguous; no reader is misled.
  - `[low]` `[reject]` (intent) Blank rows in the wireframe's right column — needed to keep the two columns aligned after the longer notice; cosmetic only.

### AI suggestions corrected or rejected

- Corrected: the implementing agent's first lint rule looked complete, and its own test passed, but three reviewers found that the barrel re-export made it bypassable. The fix removes the re-export instead of adding a second lint rule.
- Corrected: the first injection test inserted a Game directly in *grouping*, which skipped the close the PRD consequence names. TRACE lines that claimed more than the tests check (the ruling store, "no condition") were reworded.
- Rejected: exporting `NOTICE` so the e2e spec imports it. A test that imports the text it checks cannot catch a wrong text.
- Rejected: treating the README limit "with live Grouping on, Answer texts are sent" as a contradiction of D1, and treating the CI Postgres job in the cut order as a PRD slip. Neither holds against the PRD.
- Kept from the proposal as written, though a reviewer questioned it: the pinned-value wording in Story 7.2 AC2. Story 7.2 decides where the values live.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck` -- expected: clean.
- `npm run test` -- expected: all pass, including the three new tests.
- `npx playwright test tests/e2e/answer-form.spec.ts` -- expected: pass with the new notice.

**Manual checks:**
- Screenshot of the answer form at 360 px: the notice wraps cleanly inside its box and the instruction line follows it.

## Auto Run Result

Status: done

**Summary.** The answer form's FR-14 notice now names the external AI service, with no condition (D1), in code, UX, epics and tests. Two new tests check FR-15: a unit test of `messages()` with a hostile Answer, and an integration test where a closed Game's hostile Answer is obeyed by the Judge and then moved out in Review. A new FR-3 test scans every column for a marker after a real create, submit, close, group, rename and delete. `record` is no longer reachable from Grouping: the deep import is a lint error and the barrel no longer re-exports it. The spine, epics and delivery notes follow H5 to H8.

**Files.**
- `src/components/AnswerForm.tsx`: new notice text.
- `src/server/judge/index.ts`, `src/cli/judge-record.ts`: `record` and its helpers are imported only from `@/server/judge/record`.
- `eslint.config.mjs`, `tests/unit/lint-zones.test.ts`: `JUDGE_PRIVATE` bans `@/server/judge/(providers|record)` in every `src/server` zone outside the Judge.
- `tests/unit/judge.test.ts`, `tests/integration/grouping.test.ts`, `tests/integration/delete.test.ts`, `tests/e2e/answer-form.spec.ts`: the new tests and the new notice pin.
- `tests/TRACE.md`: FR-3, FR-14, FR-15 and FR-17 lines.
- `EXPERIENCE.md`, `mockups/key-screens.html`, UX `.memlog.md`, `epics.md`, `ARCHITECTURE-SPINE.md`, `delivery-notes.md`, `sprint-status.yaml`: handoff text.

**Review.** 32 findings. 9 medium and 13 low were patched across 11 root causes, 1 low was deferred (the mock's old instruction line), and 6 false and 7 low were rejected, each with its reason in the triage log.

**Follow-up review: recommended.** Five medium entries were patched, so the rule recommends one. Risk not yet checked: the new FR-15 and FR-17 TRACE lines and the barrel change were checked only by the agent that wrote them. The full suite passes, but no second reader has reviewed the TRACE wording.

**Verification.** `npm run lint` and `npm run typecheck` are clean. `npm run test`: 41 files, 675 tests pass. `npm run test:e2e`: 91 pass. The answer form was screenshotted at 360 px: the notice wraps inside its box, and "KI-tjeneste" breaks at its hyphen, which reads fine.

**Residual risks.** H4 (README) and H9 (reflection report) are outside this story. The A3 screen-reader check of the longer notice is still manual.
