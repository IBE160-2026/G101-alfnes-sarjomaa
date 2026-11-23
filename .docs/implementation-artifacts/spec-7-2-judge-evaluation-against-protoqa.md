---
title: 'Story 7.2: Judge evaluation against ProtoQA'
type: 'feature'
created: '2026-11-23'
baseline_revision: 'e7e77bb0c3d3993447e680f525361d9ba4bfe34f'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** SM-2 says Grouping must be measured, not claimed (FR-32), but there is no B-cubed scorer, no `judge:eval` command, no ProtoQA data and no ProtoQA rulings. The teacher's PRD feedback (§4.5) added a decision rule: tune only before the 1 December freeze, then report the figure unchanged; the test checks that the figures are produced and reproducible offline, never that they reach 0.70.

**Approach:** Commit ProtoQA's crowdsourced dev file verbatim with a CC-BY-4.0 `ATTRIBUTION.md`. Add a pure weighted B-cubed scorer in `src/lib/bcubed.ts`, a labelling and evaluation module in `src/server/judge/eval.ts`, and `npm run judge:eval` (`src/cli/judge-eval.ts`), which by default replays `data/rulings/protoqa-dev.json` with no key and no network and prints aggregates only. There is no live key in this run, so `protoqa-dev.json` is committed as a clearly marked placeholder (every item alone, the no-Judge baseline) that the orchestrator replaces with a live recording and then re-pins.

## Boundaries & Constraints

**Always:**
- The default run makes no network call and reads no key: the replay provider only, through a `getReplayJudge()` export from `src/server/judge/index.ts` (the CLI never imports a provider, AD-13).
- Items are built exactly as `judge:record` builds them (sorted distinct non-empty normalised answers), so a recording from the same input covers every item.
- Raw answers that the ProtoQA annotators left out of every cluster have no gold label; they are dropped before the Judge sees the Question, and `ATTRIBUTION.md` says so.
- The figures are one micro-average over all respondent answers across Questions (each item weighted by its respondents, clusters scoped per Question).
- Output is aggregate figures only, for the default run, `--live` and `--file`: no Question text, no item. Error messages for a bad `--file` name the line, never its content.
- The command exits 0 whatever the figure; it states whether F1 reaches 0.70.
- `--live` and `--file` refuse with exit 1 and name `OPENROUTER_API_KEY` before reading any input when no key is set.

**Never:**
- No scraped or training ProtoQA file, no `dev.scraped.jsonl`, no test questions.
- No change to the prompt, model or `PROMPT_VERSION` in this story; tuning is the orchestrator's live step.
- No per-Question or per-item output, and no new CLI option beyond `--live` and `--file <path>`.
- No call to OpenRouter in this run; no `.env` read.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default replay | committed dataset + rulings, no key | precision, recall, F1 (4 decimals), calls per Question, prompt version(s), model(s), F1-vs-0.70 line; exit 0 | No error expected |
| Rulings from another version | placeholder rulings (`promptVersion`/`model` differ from `PROMPT_VERSION`/`JUDGE_MODEL`) | figures plus a warning on stderr naming both sets of versions | No error expected |
| Rulings miss a Question | `protoqa-dev.json` absent or missing a Question | exit 1: no stored ruling, re-record with `--live` | message names the count, not items |
| Rulings cover part of a Question | stale items | figures computed with uncovered items as singletons, warning with the uncovered count | No error expected |
| `--live` / `--file` without key | empty `OPENROUTER_API_KEY` | exit 1, stderr names `OPENROUTER_API_KEY`, nothing read or written | refuse first |
| `--live` with key | ProtoQA dataset | records one partition per Question via `record()`, writes `data/rulings/protoqa-dev.json`, then replays and reports real calls per Question | a `JudgeError` writes nothing, exit 1 |
| `--file <path>` with key | local labelled jsonl, ProtoQA format | live Judge, aggregates only, writes nothing | bad line → `Line N ...`, exit 1 |
| Unknown argument | e.g. `--foo` | usage line, exit 1 | |

</intent-contract>

## Code Map

- `src/server/judge/record.ts` -- `itemsOf` (sorted distinct normalised items), `record(entries, judge)` and `assertRecordTarget`; reuse `record()` for `--live`; export `itemsOf` only if needed.
- `src/server/judge/index.ts` -- `getJudge`, `getLiveJudge(onUsage?)`; add `getReplayJudge()` returning `createReplayJudge()` (default dir `data/rulings`).
- `src/server/judge/providers/replay.ts` -- matches by `normalize(question)`, only current `NORMALIZE_VERSION`; uncovered items become trailing singletons; a full miss throws `JudgeError` (`NO_KEY`/`NO_STORED_RULING`); result carries the ruling's `model`/`promptVersion`, `calls: 0`.
- `src/server/judge/prompt.ts` -- `PROMPT_VERSION` (current "1"); `src/server/env.ts` -- `env.JUDGE_MODEL`, `env.OPENROUTER_API_KEY`.
- `src/cli/judge-record.ts`, `src/cli/judge-smoke.ts` -- CLI style to copy (`fail()`, English messages, `process.argv`).
- `src/lib/normalize.ts` -- `normalize` (FR-17 rule).
- `tests/integration/judge-cli.test.ts` -- how to spawn a CLI through `tsx --conditions=react-server` with no env file and an empty key.
- `eslint.config.mjs` -- `src/cli` may import `@/server/judge`, `@/server/judge/record` and other non-provider judge files; `src/lib` is pure.
- `tests/TRACE.md` `## FR-32` -- "None yet. Pending: Story 7.2."
- Upstream data: `https://github.com/iesl/protoqa-data`, commit `c6c5696cd0cc18d990499a431c2923cef8003104`, `data/dev/dev.crowdsourced.jsonl`, 52 rows, sha256 `cd3bec04e9ec9294ebf5b75eda6eb0d5abcffec926407eaf852be9c744c67ce5`, licence CC-BY-4.0 (`LICENSE`). Every cluster string occurs in `raw`; 285 raw strings (305 of 5,192 respondent answers) are in no cluster ("na", "answer", nonsense); no normalised item spans two clusters.

## Tasks & Acceptance

**Execution:**
- `data/protoqa/dev.crowdsourced.jsonl` -- verbatim upstream copy -- AD-20 input.
- `data/protoqa/ATTRIBUTION.md` -- credit (ProtoQA dataset and paper, UMass Amherst IESL), CC-BY-4.0 link, source URL, commit and sha256, "no changes to the file", the changes the evaluation makes (normalisation, dropping unclustered answers), and that `data/rulings/protoqa-dev.json` is derived from it under the same licence -- AC4.
- `src/lib/bcubed.ts` -- `bcubed(items: { weight, gold, group }[])` returning `{ precision, recall, f1 }` -- AC1.
- `src/server/judge/eval.ts` -- `parseLabelled(jsonl)` (zod-validated ProtoQA rows → `{ question, items, weights, gold }`) and `evaluate(questions, judge)` (one partition per Question, micro B-cubed, calls, uncovered, models, prompt versions) -- AC2.
- `src/server/judge/index.ts` -- add `getReplayJudge()`.
- `src/cli/judge-eval.ts` + `package.json` script `judge:eval` (same `tsx` flags as `judge:record`) -- default replay, `--live`, `--file` -- AC2, AC3.
- `data/rulings/protoqa-dev.json` -- placeholder: the recorder's shape, every item its own cluster, `model: "placeholder: every item alone (no Judge)"`, `promptVersion: "placeholder"`, prettier-formatted -- until the live recording.
- `tests/unit/bcubed.test.ts` -- hand-computed weighted example; all-in-one and all-alone clearly below a correct partition -- AC1.
- `tests/integration/judge-eval.test.ts` -- `parseLabelled` on a tiny row (normalisation merge, weight sum, majority gold, dropped unclustered answer, bad line message without content); the spawned default run: offline, exit 0, pinned figures, versions, calls, the 0.70 line, the version warning, and no Question text or item in the output; `--live`/`--file` without key refuse; an unknown argument gives the usage line; the miss and partial-coverage rows through the spawned CLI in a temporary working directory holding its own `data/protoqa/` and `data/rulings/` (tsx with `--tsconfig` pointing at the repo's `tsconfig.json` and the script's absolute path); the `--file` scoring path through `evaluate()` with the mock Judge in-process (aggregates and calls). The live paths with a real key are AC3's manual opt-in check, never run by the suite -- AC2, AC3.
- `tests/TRACE.md` -- FR-32 rows.
- `ARCHITECTURE-SPINE.md` -- "Amended in Story 7.2" notes on AD-14 and AD-20 (placeholder, dropped answers, micro-average, aggregate-only output, `--file` is live and writes nothing, `--live` records then replays, `getReplayJudge`).

**Acceptance Criteria:**
- Given `src/lib/bcubed.ts`, when its unit tests run, then the hand-computed weighted example matches (P 3/4, R 7/9, F1 42/55), and all-in-one and all-alone both score clearly below the correct partition (F1 1).
- Given the committed dataset and rulings, when `npm run judge:eval` runs with no key, then it prints precision, recall, F1, calls per Question, prompt version and model, warns when they differ from the current ones, the figures equal the pinned values, and it states whether F1 reaches 0.70 with exit 0.
- Given no key, when `--live` or `--file <path>` runs, then it exits 1 naming `OPENROUTER_API_KEY` and reads and writes nothing.
- Given `data/protoqa/`, when reviewed, then it holds only `dev.crowdsourced.jsonl` and `ATTRIBUTION.md`.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 36 findings — high 0, medium 2, low 31, false 3, maybe-false 0
- findings:
  - `low` `patch` (blind) The precision/recall comment in `bcubed.ts` read backwards ("share of its group in its gold cluster") — reworded to "the share of its Group that lies in its gold cluster" and the mirror for recall; the code was already right.
  - `low` `patch` (blind) The documented gold tie-break ("first cluster in the row") did not match the code (first cluster met in raw-answer order) — the comment in `eval.ts` and the AD-20 amendment now describe the code; the dev file has no ties, so no figure changes.
  - `low` `reject` (blind) The default run prints the placeholder figure next to the SM-2 bar — stdout's own `Model:` line says "placeholder: every item alone (no Judge)" and stderr warns about both versions; a special branch for placeholders adds code for a state that ends at the live recording.
  - `low` `reject` (blind) Calls per Question is 0.00 on replay and the live count is not stored — a design decision (AD-14 shape unchanged, recorded in Design Notes); the live run prints the real count, which goes in the README with the figure. Flagged to the orchestrator.
  - `medium` `patch` (blind) No test for a failing `--live` run — added a preload whose endpoint always answers 500: exit 1, "The Judge failed with ERROR after 2 calls; nothing was written.", existing rulings file byte for byte unchanged.
  - `low` `patch` (blind) The `judge:eval` npm script itself is never run by the suite — CI now runs `npm run judge:eval` after `npm test` (offline, no key, exits 0 whatever the figure).
  - `false` `reject` (blind) `evaluate` should catch only `NO_STORED_RULING` — replay without a key throws `NO_KEY` on a miss (`hasKey` false), which is the examiner's case; catching only `NO_STORED_RULING` would break the default run.
  - `low` `reject` (blind) `ATTRIBUTION.md` names no individual creators — the credit identifies them by the paper's title, arXiv link and the repository, a reasonable manner under CC-BY-4.0 §3(a)(1) when the licensor requests none; the project rule keeps personal names out of tracked files. Flagged to the orchestrator as a decision.
  - `low` `reject` (blind) TRACE cites an independent Python cross-check that is not committed — the check is recorded in this spec (Auto Run Result) and was run twice (planning and implementation); committing a one-off script adds a file nobody runs.
  - `false` `reject` (blind) The spec is missing from the diff — by design: the spec is the claims file, handed to the edge-case layer separately; it exists and is committed with the story.
  - `low` `reject` (blind) An empty `--file` gives "B-cubed needs at least one item." — the run still exits 1 with a refusal; a dedicated guard is code for an unlikely input.
  - `low` `patch` (blind) The spine said "no key read" while the script loads `.env` — reworded to "no key is used and no network call is made, even when `.env` holds a key".
  - `low` `patch` (blind) The test fixture hard-coded `normalizeVersion: 1` — it now imports `NORMALIZE_VERSION`.
  - `low` `patch` (blind) "1 items have no stored ruling" — the warning now reads "items with no stored ruling, each counted as its own Group: N".
  - `low` `patch` (blind) The question-leak loop in the default-run test could never fail, since stdout and stderr are pinned exactly — deleted.
  - `low` `reject` (blind) The tuning history has nowhere to live before the README — the README is Story 7.4 and off-limits here; the versions tried are recorded in this spec and the orchestrator's live step until then.
  - `low` `patch` (edge-case) Tie-break order — same root cause as the blind tie-break finding; same fix.
  - `low` `reject` (edge-case) A UTF-8 BOM in a `--file` input is rejected as line 1 — an unlikely input for a local file the group writes itself; the refusal names the line.
  - `low` `reject` (edge-case) Empty `--file` gives an unexplained message — same as the blind finding; rejected for the same reason.
  - `low` `reject` (edge-case) "after N calls" counts only the failing Question's calls — nothing is written on failure and the figure is not reported; counting the earlier calls adds a path for a cost hint.
  - `low` `reject` (edge-case) One failed Question discards a whole `--file` run — consistent with `judge:record` (a `JudgeError` stops the run) and the spec's matrix; scoring a failed Question as singletons would mix fallback into the figure.
  - `low` `reject` (edge-case) `--live` writes the rulings file non-atomically — a write of about 100 kB cut off mid-way is unlikely, and git restores the committed file.
  - `low` `reject` (edge-case) `--live` without `data/rulings/` loses the paid calls on ENOENT — the directory is tracked (it holds `demo.json`), so it exists in every checkout.
  - `low` `patch` (verification-gap) A model-only version mismatch was untested (`||` to `&&` would pass) — added a model-drift case; checked to fail with `&&`.
  - `low` `patch` (verification-gap) The `NO_STORED_RULING` miss (key set) was untested — the "no stored ruling" test now also runs with a key and expects the same message.
  - `medium` `patch` (verification-gap) The `--live` failure path was untested — same root cause as the blind finding; same fix.
  - `low` `patch` (verification-gap) The npm script is never exercised — same as the blind finding; CI step added.
  - `low` `patch` (verification-gap, other) Tie-break docs versus code — grouped with the tie-break fix.
  - `low` `reject` (verification-gap, other) The placeholder is loaded by replay and the live provider everywhere — AD-14 puts `protoqa-dev.json` in `data/rulings` by design; its 52 English Questions cannot match the Norwegian demo Questions, and the live recording will behave the same.
  - `low` `reject` (intent) The pinned AC2 test measures the no-Judge placeholder, not the Judge — the intent allowed a clearly marked placeholder, and the orchestrator re-pins after the live recording.
  - `low` `patch` (intent) Recording with `judge:record` from all raw answers would silently differ from `--live` — the AD-14 amendment now says the `judge:record` input must come from `parseLabelled`'s items, and the final report gives the exact command.
  - `low` `reject` (intent) Calls per Question cannot be reproduced from committed artifacts — same as the blind finding.
  - `low` `reject` (intent) The placeholder reaches the app's replay — same as the verification-gap note.
  - `low` `reject` (intent) Versions tried have no home in this diff — same as the blind tuning-history finding.
  - `false` `reject` (intent) Commits, sprint status and review section are missing — the reviewer saw the tree before Finalize, which does all three.
  - `low` `reject` (intent) No test exercises the real OpenRouter Judge or the real recording — intended: the run has no key and must not call OpenRouter; the live step is the orchestrator's.

**Corrected AI suggestions (process record).** The implementation agent's first test file covered the live paths only by refusal without a key; the orchestrating agent added offline `--live` and `--file` runs against a stand-in endpoint so the matrix rows had tests. The reviewers' suggestions to catch only `NO_STORED_RULING`, to name individual dataset authors, and to store call counts in the rulings were rejected for the reasons above.

## Design Notes

**Why a placeholder ruling file.** The run has no key by intent. A placeholder in the recorder's exact shape keeps the pinned test real and green now; the orchestrator replaces it with `npm run judge:eval -- --live` (or `judge:record`), runs `npx prettier --write data/rulings/protoqa-dev.json`, and re-pins the three figures and the version strings. The placeholder's figure is also the no-Judge baseline (the FR-17 fallback groups by normalised text only), a useful reference for the reflection report.

**Calls per Question.** A replayed run makes no call, so it prints 0.00; `--live` prints the calls it made (wrapped live Judge counting `result.calls`). Stored rulings do not record calls (AD-14 shape unchanged), so SM-C2's figure comes from the live run.

**ProtoQA is English, the product Norwegian.** The figure says nothing direct about Norwegian Answers (SM-2, SM-4); the CLI's last line and `ATTRIBUTION.md` do not hide that.

## Verification

**Commands:**
- `npm run test` -- expected: all green, including `bcubed.test.ts` and `judge-eval.test.ts`.
- `npm run lint`, `npm run typecheck`, `npm run format:check` -- expected: clean.
- `npm run judge:eval` with no key -- expected: figures, warning, exit 0.
- `npm run test:e2e` -- expected: green (replay now also loads `protoqa-dev.json`).

## Auto Run Result

**Summary.** `npm run judge:eval` scores the Judge against ProtoQA's crowdsourced dev clusters with weighted B-cubed, offline by default, and prints aggregates only. `data/protoqa/` holds the verbatim CC-BY-4.0 dev file and its attribution. `data/rulings/protoqa-dev.json` is a marked placeholder (every item alone, the no-Judge baseline) until the orchestrator records it live.

**Files changed.**
- `data/protoqa/dev.crowdsourced.jsonl` -- verbatim upstream copy (52 rows, sha256 `cd3bec04…7ce5`).
- `data/protoqa/ATTRIBUTION.md` -- CC-BY-4.0 credit, source commit and hash, changes made, derived rulings file, English-data note.
- `data/rulings/protoqa-dev.json` -- placeholder rulings, `promptVersion: "placeholder"`, `model: "placeholder: every item alone (no Judge)"`.
- `src/lib/bcubed.ts` -- pure weighted B-cubed.
- `src/server/judge/eval.ts` -- `parseLabelled` and `evaluate`.
- `src/server/judge/index.ts` -- `getReplayJudge()`; `src/server/judge/record.ts` -- `itemsOf` exported.
- `src/cli/judge-eval.ts`, `package.json` -- the command with `--live` and `--file`.
- `.github/workflows/ci.yml` -- runs `npm run judge:eval`.
- `tests/unit/bcubed.test.ts`, `tests/integration/judge-eval.test.ts` -- 3 and 18 tests.
- `tests/TRACE.md` -- FR-32 rows; `ARCHITECTURE-SPINE.md` -- AD-14 and AD-20 amended in Story 7.2; `epic-7-context.md` -- recompiled after the 2026-11-23 amendments.

**Review.** 36 findings: 15 rows patched (one medium: the untested `--live` failure path), 18 rejected with reasons above, 3 false. Nothing deferred. Follow-up review: not recommended (one medium and no high patched).

**Placeholder figures (pinned now).** 52 Questions, 2,246 items, 4,887 answers scored (305 unclustered answers dropped), precision 1.0000, recall 0.4032, F1 0.5747, 0.00 calls per Question. An independent Python computation over the jsonl gives the same figures. This is the no-Judge baseline, not an SM-2 result.

**Verification.** `npm run test` 751 passed; `npm run lint`, `npm run typecheck`, `npm run format:check` clean; `npm run test:e2e` 99 passed (run after the implementation, before the review patches, which touched only the CLI's warning text, tests, CI and docs); `OPENROUTER_API_KEY= npm run judge:eval` exit 0 with the figures and the version warning. A mutation check (`||` to `&&` in the version warning) fails the model-drift test.

**Live recording (orchestrator step).**
1. With the group's key in `.env.local`: `npm run judge:eval -- --live` (52 calls, about one per Question; it writes `data/rulings/protoqa-dev.json`, then replays it and prints the figures and the live calls per Question). Alternative: build the input with `npx tsx --conditions=react-server -e 'import { readFileSync, writeFileSync } from "node:fs"; import { parseLabelled } from "./src/server/judge/eval.ts"; writeFileSync(".data/protoqa-input.json", JSON.stringify(parseLabelled(readFileSync("data/protoqa/dev.crowdsourced.jsonl", "utf8")).map(({ question, items }) => ({ question, answers: items })), null, 2));'`, then `npm run judge:record -- .data/protoqa-input.json data/rulings/protoqa-dev.json`.
2. `npx prettier --write data/rulings/protoqa-dev.json`.
3. `npm run judge:eval` with no key; copy its figures into the default-run test in `tests/integration/judge-eval.test.ts` (precision, recall, F1 lines, the 0.70 line, `Prompt version`, `Model`) and expect an empty stderr when the versions match; update the TRACE row.
4. Record the prompt version, model, figures and live calls per Question for the README's SM-2 history (Story 7.4).

**Residual risks.**
- The pinned figures are the placeholder's until step 3 above is done.
- `--live` and `--file` have run only against a stand-in endpoint, never the real one.
- Calls per Question is 0.00 in the offline run by design; SM-C2's figure comes from the live run's output.
- `ATTRIBUTION.md` credits the dataset authors collectively, not by name.

## Live recording (2026-11-23, orchestrator)

The first `npm run judge:eval -- --live` with the group's OpenRouter key stopped on the first `INVALID_OUTPUT` and wrote nothing, because one failed Question ended the whole run. That measured nothing. The run now treats a failed Question the way the app does (FR-17): it is stored as one Group per item with `model: "fallback: <reason>"`, the other Questions are recorded, and the offline replay reproduces the figure and names the fallback in its `Model` line. A test with a fake endpoint that answers the first Question and returns invalid output for the second covers it. The live run also counted calls only for Questions that succeeded; a failed Question's calls now count too.

The second live run (prompt version 1, `deepseek/deepseek-v4.1-flash`, about 1 m 45 s) gave:

| Figure | Value |
|---|---|
| Questions | 52 (4,887 answers scored, 2,246 distinct items) |
| B-cubed precision | 0.9809 |
| B-cubed recall | 0.5261 |
| B-cubed F1 | **0.6849**, below the SM-2 bar of 0.70 |
| Judge calls per Question (live) | 1.40 |
| Questions that fell back | 15 of 52, all `INVALID_OUTPUT` |

An earlier live run the same day, with the old call counter, gave F1 0.6739 with 14 fallbacks; the model is not fully deterministic at temperature 0, so figures move by about 0.01 between recordings. The committed file is the second run, and `judge-eval.test.ts` pins its figures.

**What the fallbacks show.** Every fallback was a reply with the wrong number of assignments. The Questions that succeeded have 9 to 61 distinct items, and the ones that fell back 40 to 83, so the model starts miscounting at around 40 items. A fallback puts every answer alone (precision 1, recall low), which is why recall, not precision, pulls F1 under 0.70. A real Game can reach that: up to 50 invite links (`INVITE_LINKS_MAX`) with up to 5 answers per Question each (`ANSWERS_PER_QUESTION_MAX`) gives up to 250 answers per Question, and a big party with spread-out answers passes 40 distinct items easily. The demo Game and the pilot runs (5 to 6 sets) stayed far below it, which is why it never showed there. A prompt that numbers the items, or asks for groups of item numbers instead of one number per item, is the obvious next version to try before the 1 Dec freeze; SM-2 allows tuning until then, with every version tried reported.

## Tuning tried: reasoning effort (2026-11-23)

A group member suggested turning the model's reasoning on, since every fallback above was a miscount. Both settings were run live once, with `MAX_TOKENS` raised from 2048 to 16000 so the reasoning tokens fit, and with everything else as prompt version 1. Neither change was kept; the code and the committed rulings stay at `effort: "none"`.

| Reasoning effort | B-cubed F1 | Precision | Recall | Fallbacks | Reason | Calls per Question | Run time (52 Questions in sequence) |
|---|---|---|---|---|---|---|---|
| `none` (committed) | **0.6849** | 0.9809 | 0.5261 | 15 | `INVALID_OUTPUT` | 1.40 | 1 m 45 s |
| `medium` | 0.6545 | 0.9911 | 0.4886 | 25 | `TIMEOUT` | 1.04 | 20 m 38 s |
| `high` | 0.6304 | 0.9979 | 0.4607 | 33 | `TIMEOUT` | 1.00 | 22 m 28 s |

Reasoning removes the miscounts: with `medium`, no Question fell back on `INVALID_OUTPUT`, and the Questions with 72 and 83 items were grouped. But the model writes thousands of reasoning tokens first (one small smoke call went from about 30 to 1,131 output tokens and took 4 s), so large Questions pass the 30 s Judge timeout (`JUDGE_TIMEOUT_MS`) and fall back anyway. Raising the timeout would break the 180 s Grouping lease for a full Game. The two runs cost about USD 0.35.

Decision: the figure is reported at prompt version 1 without reasoning, and SM-2 is not tuned further before the freeze. Ready-made Question sets (FR-33, Story 8.1) do not depend on the Judge at all.

**Which key.** `--env-file` does not override a variable already exported in the shell, so the two prompt-version-1 recordings above (and the live `data/rulings/demo.json` from Story 7.1) were billed to another project's key exported in the developer's shell, not to the group's key in `.env`. The model and settings were the same, so the rulings stand. The reasoning runs used `env -u OPENROUTER_API_KEY` so that `.env` applied. The README should tell developers to check for an exported `OPENROUTER_API_KEY` before running the key scripts (Story 7.4).
