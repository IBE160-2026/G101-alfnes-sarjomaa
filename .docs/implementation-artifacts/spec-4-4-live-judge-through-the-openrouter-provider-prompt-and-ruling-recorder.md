---
title: 'Story 4.4: Live Judge through the OpenRouter provider, prompt and ruling recorder'
type: 'feature'
created: '2026-11-22'
baseline_revision: '65f9399abf4351d9ce7aaca282861a3e24bf9941'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      AC5's second clause (one live judge:record run on a synthetic 250-item Question, with the measured tokens and latency replacing the estimates in delivery-notes.md) is not done.
    evidence: |-
      The intent reserves every live call for the orchestrator after this run ("Do not run judge:smoke or judge:record yourself"). judge:record now prints each call's usage and the total time, so that run produces the figures.
    location: >-
      .docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md
    severity: medium
  - summary: >-
      maxTokens(n) = 64 + 4n (1,064 at 250 items) is an estimate; if the model spends reasoning tokens or pads the JSON, large Questions end with finish_reason "length", INVALID_OUTPUT after two calls, and fall back.
    evidence: |-
      Unverified: settled by the live smoke (usage prints completion_tokens_details.reasoning_tokens) and by the 250-item recorder run. If reasoning tokens appear, raise the bound or send a reasoning parameter, and bump PROMPT_VERSION if the request changes.
    location: >-
      src/server/judge/prompt.ts
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The key-derived default still selects replay (4.1 `shortcut:`), so no real Game gets meaning-based Groups; a failed live call would record 0 Judge calls (4.2/4.3 `shortcut:`); replay stamps every result with the current prompt version instead of the ruling's own (4.1 deferred); and nothing can record new Stored rulings.

**Approach:** Add the `openrouter` provider (built-in `fetch`, stored-ruling short-circuit, one retry), put the prompt and output schema in `prompt.ts`, let `JudgeError` carry `calls` and `PartitionResult` carry `model` + `promptVersion`, and add two opt-in CLIs: `npm run judge:record` (writes AD-14 rulings) and `npm run judge:smoke` (one live call, prints model, latency, usage and grouping). No UI.

## Boundaries & Constraints

**Always:**
- Start with `ponytail` (level `full`). Tests run offline with no key (NFR-3); every fetch in tests is a `vi.stubGlobal("fetch", …)` mock.
- Request (verified against OpenRouter docs 2026-11-22): `POST https://openrouter.ai/api/v1/chat/completions`, headers `Authorization: Bearer <key>` and `Content-Type: application/json` only; body `{ model: JUDGE_MODEL, messages, response_format: { type: "json_schema", json_schema: { name: "partition", strict: true, schema } }, temperature: 0, max_tokens: maxTokens(items.length), provider: { require_parameters: true, data_collection: "deny" } }`. The messages hold only the fixed prompt, the Question text and the items. `schema` = `{ type: "object", properties: { assignments: { type: "array", items: { type: "integer" } } }, required: ["assignments"], additionalProperties: false }`.
- Response: `choices[0].finish_reason === "content_filter"` → `REFUSAL` (no retry). Otherwise `JSON.parse(choices[0].message.content).assignments` through `canonicalise`; anything unparsable or invalid is `INVALID_OUTPUT`.
- Retry exactly once, inside the signal, on `INVALID_OUTPUT`, HTTP 429 or HTTP ≥ 500. Other non-2xx and network errors → `ERROR`, no retry. An aborted signal (before or during a call) → `TIMEOUT`. `calls` counts every request sent, retries included, on success and on failure (`new JudgeError(reason, calls)`).
- Before any fetch, an exact stored ruling (same `normalize(question)`, same `NORMALIZE_VERSION`, `items` deep-equal to the sorted input) returns `{ source: "stored", calls: 0, uncovered: 0 }` with that ruling's `model` and `promptVersion`. No exact match and no key → `NO_KEY`.
- `getJudge()`: `JUDGE_PROVIDER=openrouter` (incl. the key-derived default) → openrouter. `info = { provider: "openrouter", model: JUDGE_MODEL, promptVersion: PROMPT_VERSION }`.
- `PartitionResult` gains `model` and `promptVersion`: mock and live use `info`; replay uses the ruling that covers the first covered item. Grouping stores those on success and `judge.info` on fallback; on fallback `judge_calls` = `JudgeError.calls` (0 for any other throw) and the counters bump the same figure.
- The runner's own timeout still bounds the call at `JUDGE_TIMEOUT_MS`, but rejects one `setImmediate` after the abort, so a provider that honours the signal settles first with its call count.
- `judge:record <input.json> <output.json>`: input is a JSON array of `{ question, answers: string[] }` (zod strict, non-empty); items = distinct non-empty `normalize(answer)`, sorted; one live call per entry (never a stored ruling); writes a JSON array of AD-14 rulings with the result's `model` and `promptVersion`. Refuses (exit 1, clear message, before any call) without `OPENROUTER_API_KEY`, and for an output path outside `.data/` other than `data/rulings/demo.json` or `data/rulings/protoqa-dev.json`. A `JudgeError` aborts the run with its reason and writes nothing.
- `judge:smoke`: without a key prints `skipped: no OPENROUTER_API_KEY` and exits 0. With a key: one partition of a fixed Norwegian Question with 7 synthetic answers, under `JUDGE_TIMEOUT_MS`; checks `source === "live"` and one assignment per item; prints model id, latency ms, calls, each call's `usage`, and the groups. Exit 1 with the reason on failure. Never prints the key.
- Both CLIs run as `tsx --conditions=react-server --env-file-if-exists=.env --env-file-if-exists=.env.local`. Neither is part of `npm run test`, `test:e2e` or CI.
- Remove the 4.1 shortcut in `judge/index.ts` and the 4.2 shortcut in `grouping/index.ts`. Test titles carry FR/AD IDs; rows in `tests/TRACE.md`; no real names in prompt or tests.

**Never:**
- No SDK, no new dependency, no `HTTP-Referer`/`X-Title` headers, no `reasoning` parameter, no streaming. No logging of Question or Answer text. No Answer identity (Contributor key, rank) in any request. Nothing outside `src/server/judge` names the endpoint or imports a provider. Do not read, print or commit `.env`; do not run `judge:smoke` or `judge:record` against the network.
- No change to `data/rulings/` content (no fixtures recorded in this story), no UI, no new `ErrorCode`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Live hit | fetch 200, content `{"assignments":[4,4,1]}` | `{ assignments:[0,0,1], calls:1, uncovered:0, source:"live", model:JUDGE_MODEL, promptVersion }`; body exactly as Always | — |
| Invalid then valid | 1st content `{"assignments":[0]}`, 2nd valid | valid result, `calls:2` | retried once |
| Invalid twice | both invalid / non-JSON content | `INVALID_OUTPUT`, `calls 2` | JudgeError |
| 429 / 503 then ok | status 429 then 200 | result `calls:2` | retried once |
| 5xx twice | 500, 500 | `ERROR`, `calls 2` | JudgeError |
| 400 / 401 | status 401 | `ERROR`, `calls 1`, no retry | JudgeError |
| Network error | fetch rejects TypeError | `ERROR`, `calls 1` | JudgeError |
| Refusal | `finish_reason:"content_filter"` | `REFUSAL`, `calls 1`, no retry | JudgeError |
| Abort mid-call | fetch waits for signal, then abort | `TIMEOUT`, `calls 1` | JudgeError |
| Pre-aborted | signal already aborted | `TIMEOUT`, `calls 0`, fetch not called | JudgeError |
| Exact stored | ruling items == input items | `source:"stored"`, ruling's model/version, fetch not called | — |
| Partial stored | ruling covers a subset | live call | — |
| No key, no match | `apiKey` empty | `NO_KEY`, fetch not called | JudgeError |
| Grouping, live fails after 2 calls | openrouter + 500,500 on Q | result `fell_back`, `ERROR`, `judge_calls 2`; counter `judgeCalls` +2 | fallback |
| Grouping, live timeout | fetch hangs until abort | `TIMEOUT`, `judge_calls 1` | fallback |
| Grouping, replay | ruling `promptVersion "0"`, `model "fixture/model"` | `grouping_result` has `"0"` / `"fixture/model"` | — |
| getJudge | `JUDGE_PROVIDER` unset, key set / not | `openrouter` / `replay` | — |
| record, no key | `OPENROUTER_API_KEY` empty | exit 1, message names the variable | refuse |
| record, bad path | `out = src/x.json`, `data/rulings/other.json`, `.data/../x.json` | refused | refuse |
| record, ok | mocked fetch, 2 entries | AD-14 rulings that `createReplayJudge` loads and replays | — |
| smoke, no key | empty key | stdout `skipped: no OPENROUTER_API_KEY`, exit 0 | — |

</intent-contract>

## Code Map

- `src/server/judge/core.ts` -- `JudgeError(reason, calls = 0)`; `PartitionResult` + `model`, `promptVersion`. `canonicalise` reused for live output.
- `src/server/judge/prompt.ts` -- today only `PROMPT_VERSION = "1"`. Add the system prompt, `messages(input)`, `ASSIGNMENTS_SCHEMA`, `maxTokens(n)`. The first prompt is version "1" (no prompt existed before; fixtures already say "1").
- `src/server/judge/providers/replay.ts` -- export `loadRulings`; result carries the first covering ruling's `model`/`promptVersion` (4.1 deferred).
- `src/server/judge/providers/mock.ts` -- result adds `model: "mock"`, `promptVersion: PROMPT_VERSION`.
- `src/server/judge/providers/openrouter.ts` (new) -- `createOpenRouterJudge({ apiKey = env.OPENROUTER_API_KEY, model = env.JUDGE_MODEL, dir = "data/rulings" | null, onUsage? })`; `dir: null` skips stored rulings (recorder, smoke).
- `src/server/judge/index.ts` -- `case "openrouter"` → the new provider; export `getLiveJudge(onUsage?)` and the recorder helpers for `src/cli` (the CLI zone bans provider imports).
- `src/server/judge/record.ts` (new) -- `recordInputSchema`, `record(entries, judge)` → rulings, `assertRecordTarget(path)`.
- `src/server/grouping/index.ts:47-66,73-140` -- `timedPartition` returns `PartitionResult | JudgeError`; result columns and bump use `outcome.calls` / `outcome.model` / `outcome.promptVersion`; drop the shortcut at :130.
- `src/cli/judge-record.ts`, `src/cli/judge-smoke.ts` (new) -- thin CLIs; `src/cli/db-migrate.ts` is the pattern. `eslint.config.mjs` -- `no-console` off for `src/cli/**`.
- `package.json` -- `judge:record`, `judge:smoke` scripts.
- `tests/unit/judge.test.ts` -- getJudge test for key → openrouter (AC3); new `describe("openrouter provider")` for the matrix (AC1, AC2); record tests (AC5).
- `tests/integration/grouping.test.ts:255-290,480-520` -- `judged()`/`fellBack()` helpers; `install(judge)` hook; partial replay test now expects the ruling's model and version (AC4); add live-fallback call-count cases.
- `tests/integration/judge-cli.test.ts` (new) -- spawns `node_modules/.bin/tsx --conditions=react-server src/cli/…` with `OPENROUTER_API_KEY=""` and no env-file flag (so a developer's `.env` is never read): smoke skips with exit 0, record refuses with exit 1.
- `tests/TRACE.md:201-217` -- FR-15 rows; replace the "until Story 4.4" sentence.
- `ARCHITECTURE-SPINE.md` -- "Amended in Story 4.4" under AD-12, AD-13, AD-14; AD-21 CLI line.
- `README.md:51-82` -- two lines for `judge:smoke` / `judge:record` (bokmål).

## Tasks & Acceptance

**Execution:**
- `src/server/judge/core.ts`, `prompt.ts`, `providers/*.ts`, `index.ts`, `record.ts` -- provider, prompt, result fields, selection, recorder helpers. -- AC1-AC5.
- `src/server/grouping/index.ts` -- per-provider model/version, `JudgeError.calls` on fallback, `setImmediate` timeout. -- AC4, carry-overs.
- `src/cli/judge-record.ts`, `src/cli/judge-smoke.ts`, `package.json`, `eslint.config.mjs` -- CLIs. -- AC5, orchestrator smoke.
- `tests/unit/judge.test.ts`, `tests/integration/grouping.test.ts`, `tests/integration/judge-cli.test.ts` -- every matrix row.
- `tests/TRACE.md`, `README.md`, `ARCHITECTURE-SPINE.md` -- traces, docs, amendments.
- `.docs/implementation-artifacts/sprint-status.yaml` -- `4-4-…: done` at the end; `epic-4` stays `in-progress`.

**Acceptance Criteria:**
- Given the openrouter provider with a mocked fetch, when `partition` runs, then the request is exactly as specified and the retry, timeout, refusal and call-count rules hold (AC1).
- Given an exact stored ruling, when the openrouter provider partitions those items, then it returns `source: "stored"` without calling fetch (AC2).
- Given `JUDGE_PROVIDER` unset, when a key is set or not, then `getJudge()` is openrouter or replay (AC3).
- Given Grouping on mock or replay, then every `grouping_result` records the prompt version and model of what produced it (AC4).
- Given `npm run judge:record` with no key or a forbidden output path, then it refuses clearly; with a key it writes AD-14 rulings that replay accepts (AC5, the live 250-item timing is the orchestrator's manual run).
- Given `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then all pass offline.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 46 findings — high 0, medium 3, low 25, false 8, maybe-false 10
- findings:
  - `[low]` `[reject]` Blind Hunter: a bare `assignments` list cannot detect a reply shifted by one position. The `{ assignments: number[] }` shape is fixed by AD-13 and the intent; `canonicalise` catches wrong lengths, and the Host fixes a bad Group in Review.
  - `[maybe-false]` `[reject]` Blind Hunter: a per-request schema with `minItems`/`maxItems` would let strict decoding enforce the length. Whether OpenRouter's strict mode honours those keywords for this model is unknown (settle with a live call); if true it is only low, since `canonicalise` plus one retry already covers it.
  - `[low]` `[reject]` Blind Hunter: `finish_reason: "length"` is retried with the same budget. AC1 says invalid output is retried once, and a cut-off reply is invalid output; the second call costs a fraction of a cent. Whether the bound is too small is deferred (the `maxTokens` item).
  - `[low]` `[patch]` Blind Hunter: a 429 is retried at once, ignoring Retry-After. Fixed: a `shortcut:` comment names the limit and when to wait for Retry-After.
  - `[maybe-false]` `[reject]` Blind Hunter: a refusal in `message.refusal` and a 200 body with an `error` object become `INVALID_OUTPUT`. OpenRouter's normalised response schema (checked 2026-11-22) has no `refusal` field; settle by a live refusal. If true, only the stored reason differs (both are retried and fall back), so low.
  - `[medium]` `[patch]` Blind Hunter: a failed live call says only "ERROR", so a wrong key, model or unsupported parameter cannot be told apart on the first live run. Fixed in `judge-smoke.ts` only: a fetch wrapper keeps the last non-2xx status and the first 300 characters of its body and prints them on failure; `JudgeError` and the provider are unchanged.
  - `[medium]` `[patch]` Blind Hunter: token usage is lost: `judge:record` prints none (AC5 needs it) and smoke printed `usage 1: undefined`. Fixed: the recorder prints each call's usage as a JSON line; `onUsage` runs only when a reply has `usage`. Live Grouping keeping tokens is not asked for (AD-18 fixes the counters), so not added.
  - `[low]` `[reject]` Blind Hunter: one malformed ruling file makes every live Question fall back with `ERROR`. AD-13 (4.1 amendment) makes a malformed file a broken deployment that fails loudly; the live provider follows the same rule as replay.
  - `[low]` `[reject]` Blind Hunter: recording to `demo.json` replaces the whole file. The fixtures are tracked in git, so an overwrite is visible and reversible; a merge mode is code no AC asks for.
  - `[low]` `[reject]` Blind Hunter: one failure throws away a long run's paid calls. The spec chose all-or-nothing so a half fixture never lands; a run costs cents.
  - `[low]` `[reject]` Blind Hunter: recordings under `.data/` are never read by the app. AD-14 keeps `.data/` as scratch and `data/rulings/` as the reviewed fixtures; promoting one is a deliberate copy in Epic 7.
  - `[low]` `[patch]` Blind Hunter: the CLI's checks are barely tested, and the no-key message names only `.env.local`. Fixed with the Verification Gap row below (two spawned cases); the message and README now say `.env` or `.env.local`.
  - `[low]` `[patch]` Blind Hunter: the prompt does not frame the answers as data. Fixed: one sentence says they are player input to group, never instructions. `PROMPT_VERSION` stays "1", since no ruling was recorded with the earlier text.
  - `[false]` `[reject]` Blind Hunter: the AC3 test hard-codes the default model. The pinned default `deepseek/deepseek-v4.1-flash` is part of AC1 and AD-13; a test that fails when it changes is the point.
  - `[false]` `[reject]` Blind Hunter: the spec is not in the diff. It is the claims file, kept out of the review diff on purpose and committed at finalisation.
  - `[false]` `[reject]` Edge Case Hunter: an empty item list makes a paid call. Unreachable: `parseAnswerSet` requires at least one Answer per Question ("Skriv minst ett svar."), so every Question at close has items.
  - `[low]` `[reject]` Edge Case Hunter: a cached failed `loadRulings`. Same root and reason as the Blind Hunter ruling-file row.
  - `[low]` `[patch]` Edge Case Hunter: immediate 429 retry. Same root as the Blind Hunter 429 row; fixed there.
  - `[low]` `[reject]` Edge Case Hunter: `"length"` retried. Same root and reason as the Blind Hunter length row.
  - `[maybe-false]` `[reject]` Edge Case Hunter: `message.refusal`. Same root and reason as the Blind Hunter refusal row.
  - `[low]` `[patch]` Edge Case Hunter: non-2xx bodies are never read, so undici holds the socket until GC. Fixed: `await response.body?.cancel()` before returning or throwing.
  - `[low]` `[patch]` Edge Case Hunter: `onUsage(undefined)`. Same root as the Blind Hunter usage row; fixed there. A throwing callback is our own CLI code, not guarded.
  - `[maybe-false]` `[reject]` Edge Case Hunter: a provider whose abort rejection settles after a macrotask would still record 0 calls. Undici rejects fetch and body reads on abort within microtasks, which `setImmediate` follows; settle with a real-network abort. If true it is low (an undercount on timeouts only).
  - `[low]` `[patch]` Edge Case Hunter: a whitespace-only Question passes `min(1)`. Fixed: `z.string().trim().min(1)`, with a test case.
  - `[low]` `[reject]` Edge Case Hunter: "after N calls" counts only the failing entry. Cosmetic in a developer CLI; adding a running total means threading state through `record`.
  - `[low]` `[reject]` Edge Case Hunter: a symlinked `.data` escapes the path guard. The guard stops slips on the developer's own machine, not an attacker; `realpath` checks add code for a case nobody meets.
  - `[low]` `[reject]` Edge Case Hunter: fixture overwrite. Same root and reason as the Blind Hunter overwrite row.
  - `[low]` `[reject]` Edge Case Hunter (claim): mixed-fixture replay names only the first covering ruling. Known and marked with a `shortcut:` in `replay.ts`; today's fixtures never mix models.
  - `[low]` `[patch]` Edge Case Hunter (claim): the spine said "one live call per entry" though the retry can send two. Fixed: "one partition per entry (up to two requests with the retry)".
  - `[low]` `[patch]` Verification Gap: the CLI's output-path guard and input validation were never run (the spawn exits at the key check). Fixed: two spawned cases with a dummy key and no env file: `src/x.json` is refused, and a malformed input exits 1 and writes no file. Both stop before any call.
  - `[low]` `[patch]` Verification Gap: `getLiveJudge` (its `dir: null` and `onUsage`) was untested. Fixed: a unit test with an exact ruling under a spied `cwd` asserts one fetch, `source: "live"`, and the usage reaching the callback.
  - `[low]` `[patch]` Verification Gap (other): unread response bodies. Same root as the Edge Case Hunter body row; fixed there.
  - `[maybe-false]` `[reject]` Intent Alignment: field names are checked only against a stubbed fetch. Tests must stay offline (NFR-3); the names were checked against OpenRouter's docs on 2026-11-22, and the orchestrator's `judge:smoke` is the live check.
  - `[low]` `[reject]` Intent Alignment: the smoke and record CLIs run inside `npm run test`. The spawns force `OPENROUTER_API_KEY=""` (and a dummy key that stops before any call) and load no env file, so the suite never reaches a live call; the intent's rule is about the live call, and the skip message it asks for is what the test pins.
  - `[medium]` `[defer]` Intent Alignment: AC5's 250-item timing and the delivery-notes figures are open while 4-4 is done. The intent reserves live calls for the orchestrator; deferred.
  - `[maybe-false]` `[defer]` Intent Alignment: whether `maxTokens` suffices at 250 items is unverified; medium if true. Deferred with what settles it.
  - `[low]` `[patch]` Intent Alignment: the CLI with a key (parse, guard) had no test. Same root as the Verification Gap CLI row; fixed there. Writing a file needs a live call and stays manual.
  - `[maybe-false]` `[reject]` Intent Alignment: AC3 checks only `info`. `info.provider` is what selection decides; the provider's behaviour has its own tests. If wrong, low.
  - `[false]` `[reject]` Intent Alignment: smoke and rulings use the configured model id, not the response's `model`. AD-13 pins the id and `require_parameters` routes only to that model; the configured id is what a ruling must name.
  - `[false]` `[reject]` Intent Alignment: the spec and `epic-4-context.md` are not in the patch. The spec is the claims file and the context file is generated; both are committed at finalisation.
  - `[maybe-false]` `[reject]` Intent Alignment: reading C1 (static `info`) of AC4 against C2. The intent's carry-over asks for each ruling's own prompt version; the model follows the same reasoning (AD-13 4.1: "Each stored ruling keeps its own model"). If wrong, low.
  - `[false]` `[reject]` Intent Alignment: AC1 "only the Question text and the items" read literally would forbid a prompt. AD-13 puts the prompt in `prompt.ts`; the sentence bans user data beyond those two, which holds.
  - `[maybe-false]` `[reject]` Intent Alignment: E1 versus E2 (every sent request versus billed ones). AD-13 says "calls counts the retry"; an aborted request may or may not be billed, settle with OpenRouter's activity log. If wrong, low.
  - `[false]` `[reject]` Intent Alignment: `.env` versus `.env.local`. Both scripts read both, `.env` first; README and message now say so.
  - `[maybe-false]` `[reject]` Intent Alignment: H1 (set equality) versus H2 (sorted arrays). Items are always sorted and distinct (AD-12), so the two readings coincide.
  - `[false]` `[reject]` Intent Alignment: the docs check has no evidence in the diff. It is recorded in this spec's Always section and below; the check was context7's OpenRouter docs, which also showed `json_schema.name` is required.

### AI suggestions corrected or rejected (grading evidence)

- **The orchestrator corrected the architecture and its own plan:**
  - AD-13's `response_format` omits `json_schema.name`; OpenRouter's docs (context7, 2026-11-22) list `name` as required, so the request sends `name: "partition"`.
  - The runner's timeout first rejected synchronously on abort, which always beat the provider's `TIMEOUT(calls)` and recorded 0 calls for a live timeout. It now rejects one `setImmediate` later. A first idea, `setTimeout(…, 0)`, was dropped: the 4.2 test fakes `setTimeout`, so it would hang the "ignores the signal" case.
  - `info` was first meant to carry the result's model; replay mixes rulings, so `PartitionResult` carries `model` and `promptVersion` instead.
  - The recorder bypasses stored rulings (`dir: null`), or re-recording `demo.json` would replay the fixture instead of judging it again.
  - The CLI tests spawn `tsx` without any `--env-file` flag, so a developer's real `.env` key can never reach a test.
- **Accepted from the implementation subagent, with a note:** an extra test (abort during the retry gives `TIMEOUT` with 2 calls); `maxTokens(n) = 64 + 4n` (estimate, deferred to the live run).
- **Corrected in the implementation subagent's work after review:** the missing CLI guard tests, the untested `getLiveJudge`, unread response bodies, `usage: undefined`, no usage from the recorder, no HTTP detail in smoke, the blank-Question hole, the prompt's data framing, the `.env.local`-only wording, and the spine's "one call per entry".
- **Rejected review suggestions:** see the `[reject]` rows. The main ones are a different output shape, per-request schema bounds, special handling of `"length"` and `refusal`, merge or resume modes for the recorder, skipping malformed rulings in the live provider, and symlink checks.

## Design Notes

- **Why `setImmediate`.** The runner's abort listener is registered before fetch's, so a synchronous reject would always beat the provider's `TIMEOUT(calls)`. `setImmediate` runs after every microtask, so a provider that honours the signal settles first; it is not faked by the 4.2 timer test (`toFake: ["setTimeout", "clearTimeout"]`), so a Judge that ignores the signal still falls back.
- **Why model/version on the result.** Replay mixes rulings recorded by different models and prompt versions; `info` is static per provider and cannot say which ruling answered.
- **Retry loop shape:**

```ts
for (let calls = 1; ; calls++) {
  if (signal.aborted) throw new JudgeError("TIMEOUT", calls - 1);
  const outcome = await attempt().catch((e) => { throw new JudgeError(signal.aborted ? "TIMEOUT" : reasonOf(e), calls); });
  if (Array.isArray(outcome)) return { assignments: outcome, calls, … };
  if (calls === 2) throw new JudgeError(outcome.retry, calls);
}
```

## Verification

**Commands:**
- `npm run test` -- all pass, offline, no key
- `npm run lint && npm run typecheck && npm run format:check` -- clean
- `npm run test:e2e` -- all pass; no server left on 3100/3101

**Manual checks (orchestrator, with a key):**
- `npm run judge:smoke` -- prints model, latency, usage, grouping; exit 0
- `npm run judge:record` on a synthetic 250-item input -- times it; figures go into `delivery-notes.md`

## Auto Run Result

Status: done

**Summary.** Real Games now get meaning-based Groups when a key is set:
- `openrouter` provider: built-in `fetch` to the chat-completions endpoint with `JUDGE_MODEL`, a strict `json_schema` (`name: "partition"`), `temperature: 0`, `max_tokens = 64 + 4n` and `provider: { require_parameters: true, data_collection: "deny" }`. An exact stored ruling answers first without fetch. One retry on invalid output, 429 or 5xx; abort is `TIMEOUT`, `content_filter` is `REFUSAL`; `calls` counts every request.
- `getJudge()` with the key-derived default selects openrouter (4.1 shortcut removed).
- `JudgeError` carries `calls`, so a fallen-back Question records and counts what it spent (4.2/4.3 shortcut removed); the runner's timeout lets a signal-honouring provider settle first.
- `PartitionResult` carries `model` and `promptVersion`: replay stamps the ruling's own (4.1 deferred).
- `prompt.ts` holds the prompt, the schema and the token bound (`PROMPT_VERSION` "1").
- `npm run judge:record -- <in.json> <out.json>` writes AD-14 rulings, only under `.data/` or to the two fixtures, refusing without a key. `npm run judge:smoke` makes one live call and prints model, latency, calls, usage and groups, or skips with exit 0.

**Files changed**
- `src/server/judge/providers/openrouter.ts` (new): the live provider.
- `src/server/judge/record.ts` (new): recorder input schema, `record`, path guard.
- `src/server/judge/{core,prompt,index}.ts`, `providers/{mock,replay}.ts`: result fields, prompt, selection, `getLiveJudge`.
- `src/server/grouping/index.ts`: per-result model and version, failure call counts, timeout ordering.
- `src/cli/judge-record.ts`, `src/cli/judge-smoke.ts` (new); `package.json` scripts; `eslint.config.mjs` (`no-console` off in `src/cli`).
- `tests/unit/judge.test.ts`, `tests/integration/grouping.test.ts`, `tests/integration/judge-cli.test.ts` (new), `tests/TRACE.md`.
- `README.md`, `ARCHITECTURE-SPINE.md` (4.4 amendments under AD-12, AD-13, AD-14, AD-21), `sprint-status.yaml` (4-4 done), `epic-4-context.md` (recompiled).

**Review**
- 46 findings: 3 medium, 25 low, 8 false, 10 maybe-false. 14 rows patched as 11 fixes (2 medium, the rest low). 2 deferred (the 250-item live timing; the unverified `maxTokens` bound). The rest rejected with reasons above.

**Follow-up review:** `false`. Patched: 0 high, 2 medium (smoke HTTP detail, recorder usage), both CLI-only diagnostics verified by the suite; no unverified risk to name.

**Verification** (after the patches):
- `npm run test`: 573 passed in 38 files.
- `npm run test:e2e`: 86 passed. No server left on 3100 or 3101.
- `npm run lint`, `npm run typecheck`, `npm run format:check`: clean.
- No live call was made; `.env` was never read.

**Residual risks**
- The live path is untested against the real API until the orchestrator runs `npm run judge:smoke`.
- `maxTokens` may be too small if the model reasons (deferred).
- AC5's 250-item timing and the `delivery-notes.md` figures remain (deferred).
- Mixed-fixture replay names only the first covering ruling (`shortcut:`).
