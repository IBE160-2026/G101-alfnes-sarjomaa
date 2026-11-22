# Epic 4 code review (bmad-code-review)

- **Date:** 2026-11-22
- **Scope:** `git diff epic-3-lukking..epic-4-gruppering`, which covers stories 4.1 (Judge boundary with replay and mock providers), 4.2 (Grouping runs once at close with per-Question fallback), 4.3 (usage counters and the usage report) and 4.4 (OpenRouter provider, prompt, ruling recorder and `judge:smoke`), plus the flaky-test fix in `host-anonymity.spec.ts`.
  - 50 files changed, +6,232/-55.
  - The reviewers read the diff without `drizzle/meta/*` snapshots and without `.docs/`: 4,489 lines, 173 kB.
- **Mode:** `full`. The diff was checked against:
  - `spec-4-1` to `spec-4-4`, including their triage logs (rejected items were not raised again without a new argument);
  - `epic-4-context.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-12 to AD-14, AD-18 and AD-21 as amended;
  - PRD FR-15 to FR-18, section 6.2, SM-5 and SM-C2.
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Live evidence from the orchestrator**, triaged as a confirmed finding (finding 1): `npm run judge:smoke` against `deepseek/deepseek-v4.1-flash` needed 2 calls for its Question. Call 1 used 92 completion tokens, all 92 of them reasoning, so there was no content and the call was retried. Call 2 used 92 completion tokens, 73 of them reasoning. `judge:smoke` sends 7 items, so `maxTokens(7) = 64 + 4 × 7 = 92`, which matches the cap exactly.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `log.ts`, `env.ts`, `vitest.config.ts`, `playwright.config.ts`, the spine and the delivery notes.
  - The model's reasoning metadata was read from OpenRouter's public, unauthenticated `GET /api/v1/models` and `/endpoints` listings. No key was used.
  - `.env` was not read, and `judge:smoke` and `judge:record` were not run.
- **Test run:** `npm run test` passed 38 files and 573 tests in 8.9 s. `test:e2e` was not run.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story files was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 1 | patch |
| Medium | 0 | |
| Low | 4 | patch |
| Deferred | 2 | 1 low, plus 1 medium that is unverified and was already deferred |
| Dismissed | 16 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **What the Judge receives.** `prompt.ts` `messages()` sends the fixed system prompt plus `JSON.stringify({ question, answers: items })`. `items` are distinct normalised texts sorted in JS. No Contributor key, rank, id, count or Game data is sent. Headers are only `Authorization` and `Content-Type`.
- **The usage report holds counts only.** `grouping.usage()` maps away the Question id and returns `position`, `source`, `fellBack` and `{ origin, editCount }` per Group. `games.counters()` returns only the nine counters. The route sends `Cache-Control: no-store`.
- **The key never reaches a log.**
  - `env.ts` names keys only when it fails.
  - `log.ts` copies only four string fields.
  - `judge:smoke` prints the status and the first 300 characters of a non-2xx response body, never the request or its headers. OpenRouter's error bodies do not echo the Authorization header.
  - `judge:record` prints only `usage` objects and the failure reason.
- **Tests never reach the network.**
  - `tests/setup.ts` blocks every non-local socket.
  - `vitest.config.ts` forces `OPENROUTER_API_KEY=""` and `JUDGE_PROVIDER=mock`.
  - `playwright.config.ts` sets all nine env keys, with the key empty and `JUDGE_PROVIDER=replay`, so a developer's `.env` with a real key does not leak into e2e.
- **The examiner path without a key.** `parseEnv` defaults `JUDGE_PROVIDER` to `replay` when there is no key. With `data/rulings` absent (as now), every Question falls back with `NO_KEY`. That matches AD-13 until Epic 7 commits `data/rulings/demo.json`, but see finding 1 for why recording that fixture is blocked today, and finding 4 for the README.
- **Grouping runs once and resumes without judging twice.** Each Question commits its Groups, its `grouping_result`, the counter bump and the lease extension in one transaction under the Game lock, after an already-done check. A resumed run skips Questions that already have a result. Only Questions that were in flight when the run died are judged again.
- **Lease and timeout.**
  - `acquireGroupingLease` is a compare-and-set on `now()`, so one page load wins.
  - The lease is extended after every Question, at most about 30 s apart, against a lease of 180 s.
  - `timedPartition` rejects one `setImmediate` after its own abort, so a provider that honours the signal settles first with its own call count.
- **Fallback reason codes.** All six codes are stored in `fallback_reason`. The *in review* panel shows only numbers, and that copy reads correctly for every reason. The reason-specific Notice belongs to Story 5.1, as the 4.2 triage already recorded.
- **Call counting.** `JudgeError.calls` carries the requests sent, and `judgeCalls = outcome.calls` stores it on success and on fallback (the 2 calls in the live evidence were counted correctly).

## Findings

### High

#### 1. Reasoning uses up the `max_tokens` budget, so the live Judge fails or costs double on any Question of real size

- **Location:**
  - `src/server/judge/providers/openrouter.ts:68-82` (request body; no `reasoning` field)
  - `src/server/judge/prompt.ts:33-36` (`maxTokens = 64 + 4n`)
  - `src/server/judge/providers/openrouter.ts:115-121` (empty content becomes `INVALID_OUTPUT`, and the retry sends the same body)
- **Source:** orchestrator live evidence, Blind Hunter and Edge Case Hunter (the `finish_reason: "length"` retry).
- **What happens:**
  - OpenRouter's model listing for `deepseek/deepseek-v4.1-flash` gives `reasoning: { mandatory: false, default_enabled: true, default_effort: "high", supported_efforts: ["max", "high", "low", "none"] }`.
  - The request sends no `reasoning` parameter, so the model reasons at high effort by default.
  - OpenRouter counts reasoning tokens against `max_tokens` and bills them as output.
  - The bound `64 + 4n` was sized for the assignment array alone.
  - On the 7-item smoke Question, reasoning took all 92 tokens on call 1 (no content, so `INVALID_OUTPUT` and a retry) and 73 of 92 tokens on call 2.
- **Failure scenario:** a Host closes the sizing Game (15 Questions, up to 150 items each) with a key set.
  - Reasoning at high effort grows with the input. Both calls are cut off with no content, or with JSON cut off midway.
  - Each Question falls back with `INVALID_OUTPUT` after 2 paid calls.
  - The Host groups everything by hand, and the usage report shows `judgeCalls = 30`, `questionsFellBack = 15`.
  - FR-15/FR-16 live grouping, SM-2 (`judge:eval`) and SM-5 are not met in practice.
  - The delivery-notes worst case ("at most 30 with retries") becomes the typical case, and every call pays for reasoning tokens the notes assume are not requested.
  - Reasoning at high effort also adds latency, which makes the 30 s `TIMEOUT` more likely on large Questions.
- **Knock-on effects:**
  - **`judge:record` (`src/server/judge/record.ts:31-46`)** stops the whole run on the first `JudgeError` and writes nothing. Recording `data/rulings/protoqa-dev.json` (up to 88 items) or `demo.json` will very likely fail. The examiner's no-key demo path in Epic 7 depends on those fixtures.
  - **4-4 triage rejected rows** "`finish_reason: "length"` is retried with the same budget" as low and deferred the `maxTokens` question as maybe-false. The live run is the new argument: the bound is not merely tight at 250 items, it is already exhausted at 7.
- **Fix:**
  1. Add `reasoning: { effort: "none" }` to the request body in `openrouter.ts`.
     - The model lists `"none"` as supported and `mandatory: false`.
     - Every endpoint in the model's `/endpoints` listing includes `reasoning` in `supported_parameters`, so `provider.require_parameters: true` still routes.
     - This makes the delivery-notes assumption ("reasoning not requested") true and keeps `64 + 4n` meaningful.
  2. Optionally, treat `finish_reason: "length"` as `INVALID_OUTPUT` without the retry, because a retry of the same body at `temperature: 0` with reasoning off will be cut off again. AC1 says invalid output is retried once, so either keep the retry or amend AC1 in the same change. The minimal fix is step 1 alone.
- **Places that depend on this change:**
  - **`tests/unit/judge.test.ts:432-454`** pins the whole body with `toEqual`, so it fails until `reasoning: { effort: "none" }` is added there. A test with a stubbed reply of `content: null` and `finish_reason: "length"` would pin the empty-content path, which is untested today.
  - **`tests/TRACE.md:217`** lists the body fields. Add `reasoning`.
  - **`ARCHITECTURE-SPINE.md`:**
    - line 274 lists the request settings and line 295 gives the exact body (AD-13); both need `reasoning: { effort: "none" }`.
    - line 282 says any model with `structured_outputs` will do. Add that the model must not have `reasoning.mandatory: true`, because such a model rejects `effort: "none"`, which here would be a 400, so `ERROR` on every Question.
  - **`delivery-notes.md:15`** should state "reasoning disabled with `reasoning: { effort: "none" }`" instead of "reasoning not requested". After the fix, re-run `judge:smoke` and confirm `reasoning_tokens: 0` and `calls: 1`. Then do the deferred AC5 run (D2) so measured figures replace the estimates in the cost table.
  - **`PROMPT_VERSION`:** AD-13 requires a bump only for changes to `SYSTEM`, `messages()` or the schema, and no rulings exist yet (`data/rulings` is absent). No bump is needed, but if rulings were recorded under `"1"` before the fix, re-record them.
  - **Call counting** needs no change: `calls` already counts each request, and `onUsage` passes `usage` through unchanged.

### Low

#### 2. A non-`JudgeError` throw inside the Judge becomes a silent `ERROR`

- **Location:** `src/server/grouping/index.ts:66-67` (`timedPartition`).
- **Source:** Blind Hunter and Edge Case Hunter.
- **What happens:** any throw that is not a `JudgeError` becomes `new JudgeError("ERROR")` and nothing is logged. That includes replay's and openrouter's `Invalid ruling file: <path>` and any coding bug in a provider.
- **Failure scenario:** a malformed `data/rulings/demo.json` ships. Every Question falls back with `ERROR`, the Host sees "Spørsmål å gruppere for hånd: N", and stderr has no line saying why.
- **New argument against the 4-4 rejection** ("a malformed file is a broken deployment that fails loudly"): nothing in the chain makes it loud. AD-13 counts the throw as `ERROR`, but neither the runner nor the boundary logs it.
- **Fix:** in the `catch` of `timedPartition`, call `log({ module: "grouping", op: "partition", code: "INTERNAL" })` when the error is not a `JudgeError`. That is one content-free line, within AD-17's four fields, so no file path or text leaks.

#### 3. No test checks that a refused close queues no Grouping run

- **Location:** `src/app/spill/[id]/actions.ts:94`. Tests: `tests/integration/collection.test.ts:1199-1205`, `tests/integration/authz.test.ts:432`, `tests/integration/grouping.test.ts:787`.
- **Source:** Verification Gap (pre-verified).
- **What happens:** the `if (result.ok)` guard is correct today. But removing or inverting it passes every test: the refused-close tests (`TOO_FEW_ANSWER_SETS`, Host B's `NOT_FOUND`, a second close on a Game that is already grouping) assert only the `ActionResult` and the database rows, never `afterTasks`.
- **Failure scenario:** a regression in that guard would start an unleased `grouping.run` on a stale-tab second close (a duplicate paid `partition` per pending Question), or on another Host's Game. No test would catch it.
- **Fix:** add `expect(afterTasks).toHaveLength(0)` to the TOO_FEW `it.each` and to the Host B `NOT_FOUND` loop. Add one case to the `close` describe in `grouping.test.ts`: close, clear the queue, close again, expect `WRONG_STATE` and an empty queue.

#### 4. The README does not say what Grouping does without a key

- **Location:** `README.md:54` and `README.md:63-69`.
- **Source:** Blind Hunter.
- **What happens:** the README says the app needs no key, and that a key turns on the live Judge. It does not say what happens without one. With replay as the default and no `data/rulings` committed yet, every Question falls back with `NO_KEY`, and the *in review* panel shows "Grupper foreslått 0".
- **Failure scenario:** the examiner runs the app as documented, closes a Game and sees zero groups proposed. Nothing tells them that this is the designed no-key path rather than a bug. README and runnability count for 10 % of the grade.
- **Fix:** add one sentence after line 63, for example: "Uten nøkkel bruker dommeren lagrede kjennelser fra `data/rulings/`; spørsmål uten kjennelse grupperes for hånd." `JUDGE_PROVIDER` and `JUDGE_MODEL` are already documented in `.env.example`, so a pointer there is enough.

#### 5. TRACE still lists Story 4.3 as pending under FR-3 and FR-12

- **Location:** `tests/TRACE.md:44` (FR-3) and `tests/TRACE.md:178` (FR-12).
- **Source:** Acceptance Auditor.
- **What happens:** both lines still say "Pending: Stories 4.3, …". Story 4.3 shipped tests titled "FR-18, FR-3 (AC3)" (`report.test.ts:547`, `:554`) and "FR-18, FR-12 (AC2)" (`report.test.ts:387`), but they appear only under FR-18.
- **Failure scenario:** the examiner, or the Epic 5 builder, reads TRACE and concludes that FR-3 counter cleanup and the FR-12 report anonymity are untested.
- **Fix:** add those rows under FR-3 and FR-12, and drop 4.3 from both "Pending" lines.

### Deferred

#### D1. The spine and the epic-4 context were not updated for 4.4 (low)

- **Source:** Acceptance Auditor (verified).
- **What is out of date:**
  - `ARCHITECTURE-SPINE.md:385` (AD-20) still describes `judge:record --out` and `data/protoqa`.
  - The Scripts row at line 490 omits `judge:smoke`, while saying "README, CI and Playwright use these names only".
  - Line 358 (AD-18) still says `judgeCalls` is "0 on fallback until Story 4.4".
  - `epic-4-context.md:30`, `:37` and `:49` still describe the state before 4.4: replay as the key-derived default, the `judge_calls` shortcut, and "only 4.4 remains".
- **Harm:** Epic 5 and Epic 7 builders read these files. They will be told a shortcut exists that is gone, and that the recorder takes `--out`.
- **Why deferred:** the fix edits planning and context files, not code. Do it together with the spine amendment for finding 1.

#### D2. The live 250-item timing and the measured delivery-notes figures are still open (medium if true, unverified)

- **Source:** Acceptance Auditor, already deferred in the 4-4 triage log.
- **New point:**
  - `record()` and `judge:smoke` both use `AbortSignal.timeout(JUDGE_TIMEOUT_MS)` (30 s). A 250-item call slower than 30 s would end in `TIMEOUT` and record nothing, and Grouping would fall back on Questions that size.
  - With reasoning on (finding 1), that is likely.
- **What settles it:** after the finding 1 fix, one live `judge:smoke`-style run on a synthetic 250-item Question, recording latency, `completion_tokens` and `reasoning_tokens`.

## Dismissed

1. **Overlapping runs: the losing run's paid calls are not counted** (Edge Case Hunter, Blind Hunter). Low. The 4.2 triage already rejected overlapping runs: an overlap needs a dead run, because the lease is extended about every 30 s against 180 s. Counting the loser's calls would add a branch on the done path.
2. **A runner-side `TIMEOUT` records 0 calls when a provider ignores the signal** (Edge Case Hunter claim). Already rejected as maybe-false in the 4-4 log. The live provider honours the signal and settles one `setImmediate` before the runner.
3. **`message.refusal` is not mapped to `REFUSAL`** (Edge Case Hunter, Blind Hunter). Already rejected in the 4-4 log: OpenRouter's normalised schema has no such field. No new argument.
4. **A network error is not retried** (Edge Case Hunter). Not a defect: AD-13 states that "other non-2xx and network errors are `ERROR`", without a retry.
5. **`JUDGE_PROVIDER=mock` could run outside Vitest** (Edge Case Hunter). Low. It needs an explicit misconfiguration by a developer. The mock's results are labelled `model: "mock"`, and a production guard adds a branch.
6. **`answer.group_id ON DELETE CASCADE` deletes Answers with a Group** (Edge Case Hunter, Blind Hunter). Already rejected in the 4.2 log: nothing deletes Groups yet, AD-15 deletes only empty ones, and `delete.test.ts` requires the cascade.
7. **`bumpCounters` with an empty delta** (Edge Case Hunter). Already rejected in the 4.3 log: no caller passes one.
8. **No CHECK constraints on `grouping_result`** (Blind Hunter). Low. The single writer derives `source`, `fell_back` and `fallback_reason` from the same `fellBack` boolean, so no contradictory row is reachable. A constraint would need a migration.
9. **An Answer could point at another Question's Group** (Blind Hunter). Low. No writer sets `group_id` from Host input until Epic 5, and that story owns its validation.
10. **No index on the new foreign-key columns** (Blind Hunter). Already rejected in the 4.2 log for pilot scale.
11. ***In review* has no primary action** (Blind Hunter). Deliberate: spec 4.2 leaves the "Gå til gjennomgangen" button to Story 5.1 ("no dead buttons").
12. **`countsOf` is not wrapped in `withBoundary`** (Blind Hunter). Already rejected in the 4.2 log.
13. **`judge:record` discards every ruling after one failure** (Blind Hunter). Already rejected: all-or-nothing is the spec's choice, so a half fixture never lands. The live failure mode it amplifies is covered by finding 1.
14. **A single-item Question still makes a model call** (Blind Hunter). Low. It is rare, because it needs every Answer to normalise to the same text. Skipping the call adds a branch and a special-cased result.
15. **`answer_group.id` has no database default** (Blind Hunter). Low. Spec 4.2 chose client `randomUUID()` ids, and no caller inserts without an id. A deviation from convention, with no named harm.
16. **Report errors open as a raw JSON page** (Blind Hunter). Already rejected in the 4.3 log.

## Epic 4 review fixes (2026-11-22)

**Finding 1 (High), fixed in `12ae29a`.** The OpenRouter request now sends `reasoning: { effort: "none" }`. The field and value were checked against OpenRouter's reasoning-tokens documentation: on Chat Completions, `effort: "none"` disables reasoning, and a model whose `/models` entry has `reasoning.mandatory: true` rejects it with a 400. The `64 + 4n` formula is replaced by a flat `MAX_TOKENS = 2048`. The largest Question has 50 × 5 = 250 items, at most 4 tokens each (up to 3 digits and a comma) is 1,000 tokens, plus about 10 for the wrapper, so 2,048 leaves twice that. The cap is billed only for tokens produced. The empty-content path is now pinned by a reply cut off with `finish_reason: "length"`. The retry on invalid output stays, because AD-13 requires one retry. `PROMPT_VERSION` was not bumped: AD-13 ties the version to `SYSTEM`, `messages()` and the schema, and no rulings exist yet. Updated: `judge.test.ts`, `TRACE.md`, AD-13 (body, prompt, and the "not `reasoning.mandatory`" rule for `JUDGE_MODEL`), the AD-12 cost line, `delivery-notes.md` (assumptions, a table with 0.6K/1.0K output tokens, USD 0.004 and 0.008, and a hard ceiling under USD 0.03), and `epic-4-context.md`. The orchestrator still has to confirm `reasoning_tokens: 0` and `calls: 1` with a live `judge:smoke`. That run was not done here.

**Finding 2 (Low), fixed in `a17fbd3`.** When `timedPartition` catches something that is not a `JudgeError`, it logs `{ module: "grouping", op: "partition", code: "INTERNAL" }` before it records `ERROR`. The plain-Error test checks that this is the only line written and that the message (a file path) is not in it.

**Finding 3 (Low), fixed in `a17fbd3`.** The TOO_FEW `it.each`, Host B's `NOT_FOUND` loop and a new second close (`WRONG_STATE`) in `grouping.test.ts` each assert an empty `after()` queue. Removing the `result.ok` guard made 5 tests fail.

**Finding 4 (Low), fixed in `a17fbd3`.** The README says that without a key the Judge uses stored rulings from `data/rulings/` (replay by default). A Question with no stored ruling falls back with `NO_KEY`, each distinct Answer becomes its own Group, and "Grupper foreslått 0" is expected while the folder is empty. `NO_KEY` is the right code: replay throws `NO_STORED_RULING` only when a key is set.

**Finding 5 (Low), fixed in `a17fbd3`.** FR-3 and FR-12 in TRACE now have the Story 4.3 rows, and 4.3 is gone from their "Pending" lines.

**D1, fixed in `12ae29a`.** AD-18 now says `judge_calls` counts requests on fallback since 4.4. AD-20 names `judge:record -- <input.json> <output.json>` and the two fixtures. The Scripts row lists `judge:smoke`. `epic-4-context.md` no longer describes the state before 4.4.

**D2, still open.** The live 250-item timing needs a key, and this run was told not to make live calls.
