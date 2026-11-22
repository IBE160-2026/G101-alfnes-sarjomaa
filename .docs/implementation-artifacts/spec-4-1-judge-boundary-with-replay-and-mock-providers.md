---
title: 'Story 4.1: Judge boundary with replay and mock providers'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'fb27565be0cd5912c48ba576fd23303680aa30e8'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-4-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Grouping (Story 4.2) needs a Judge, but nothing in `src/server/judge` exists yet. The app must group Answers with no key and no network, and the live OpenRouter provider (Story 4.4) must slot in later without touching callers.

**Approach:** Build the AD-13 boundary in `src/server/judge`: the `Judge` interface, `JudgeError(reason)`, a shared output check that validates and canonicalises assignments, `getJudge()` selecting by `JUDGE_PROVIDER`, a replay provider over `data/rulings/*.json` (AD-14 records, looked up by `normalize(question)`), and a deterministic mock. No live provider and no prompt text.

## Boundaries & Constraints

**Always:**
- `src/server/judge/index.ts` exports `getJudge()`, `JudgeError`, `FallbackReason` and the `Judge` type exactly as AD-13 shows them. `JudgeError.reason` ∈ `NO_KEY | NO_STORED_RULING | TIMEOUT | ERROR | REFUSAL | INVALID_OUTPUT`.
- Provider output is valid only when `assignments` is an array of `items.length` integers; otherwise `JudgeError('INVALID_OUTPUT')`. Valid output is renumbered in first-occurrence order `0..k-1`.
- Replay matches rulings by `normalize(ruling.question) === normalize(input.question)`, reuses `normalize` and `NORMALIZE_VERSION` from `src/lib/normalize.ts`, and returns `calls: 0`, `source: 'stored'`.
- A ruling record is `{ kind: "partition", promptVersion, normalizeVersion, model, question, items, assignments }` with `items` sorted (code-unit order) and distinct, and `assignments.length === items.length`. A file that is not a JSON array of such records fails with an error naming the file.
- No network and no I/O in the mock. Tests run offline (NFR-3). Fixtures are invented; no real names.
- Nothing outside `src/server/judge` (in `src/`) imports a provider or names the model endpoint; ESLint enforces it.

**Never:**
- No openrouter provider, no `fetch`, no prompt text, no `judge:record` (Story 4.4). No grouping tables, runner or fallback writer (Story 4.2). No counters (Story 4.3). No `match()` stub (Stage 2).
- No new dependency, no SDK. No edits to `env.ts` selection logic (it already derives `openrouter` with a key, else `replay`).
- No hand-written `data/rulings/demo.json` or `protoqa-dev.json` (AD-14: written only by `judge:record`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Select mock | `JUDGE_PROVIDER=mock` | `getJudge().info.provider === 'mock'` | — |
| Select replay | `JUDGE_PROVIDER=replay` or unset, no key | `info.provider === 'replay'` | — |
| Canonicalise | raw `[5, 5, 2, 7, 2]` for 5 items | `[0, 0, 1, 2, 1]` | — |
| Wrong length | raw `[0, 1]` for 3 items | throws | `JudgeError('INVALID_OUTPUT')` |
| Non-integer | raw `[0, 1.5, 0]`, `[0, "1", 0]`, `[NaN, 0, 0]`, non-array | throws | `JudgeError('INVALID_OUTPUT')` |
| Replay full hit | Question matches a ruling covering every item | stored clusters, `uncovered: 0`, `calls: 0`, `source: 'stored'` | — |
| Replay partial | some items covered | covered get stored clusters (canonical, numbered first); each uncovered item is its own cluster numbered after them; `uncovered` = count | — |
| Replay question differs only in case/space/trailing punctuation | `"  NEVN noe…!"` vs stored `"Nevn noe"` | matches | — |
| Replay miss | no covered item (unknown Question, or no item covered) | throws | `NO_KEY` without a key, `NO_STORED_RULING` with one |
| Two rulings, same Question | items covered by different rulings | clusters from different rulings never merge | — |
| No rulings dir | `data/rulings` absent | treated as no rulings → miss | `NO_KEY` / `NO_STORED_RULING` |
| Malformed file | bad JSON, not an array, wrong `kind`, unsorted or duplicate items, length mismatch, non-integer assignment, extra key | `partition` rejects with `Error` whose message names the file | plain `Error` (Story 4.2 counts it as `ERROR`) |
| Mock map | `createMockJudge({ [question]: raw })` | `canonicalise(raw)`, `calls: 1`, `uncovered: 0`, `source: 'live'` | invalid raw → `INVALID_OUTPUT` |
| Mock no map | Question not in map | one cluster per item `[0..n-1]` | — |

</intent-contract>

## Code Map

- `src/lib/normalize.ts` -- `normalize`, `NORMALIZE_VERSION` (Story 3.1). Reuse; update its comment ("nothing stores it yet") only if it becomes false — it stays true until 4.2, leave it.
- `src/server/env.ts` -- already has `OPENROUTER_API_KEY`, `JUDGE_PROVIDER` (derived default), `JUDGE_MODEL`. Read-only.
- `.env.example`, `tests/integration/env.test.ts` -- already cover the Judge variables. Read-only.
- `next.config.ts:5` -- `outputFileTracingIncludes: { "/*": ["./data/rulings/**"] }` already present (AD-24). Add a test assertion only.
- `eslint.config.mjs` -- `PROVIDERS` ban already applies to `src/server/**` modules and `src/cli/**`; `NO_DB` bans all of `@/server/judge` from `src/app`, `src/components`, `src/*.ts`; the judge zone bans modules. Add the endpoint-literal rule.
- `tests/unit/lint-zones.test.ts` -- table of `[file, import, banned]`; extend.
- `tests/unit/next-config.test.ts` -- extend with the tracing assertion.
- `tests/unit/guards.test.ts:20` -- says "no Judge runs yet"; TRACE row text likewise.
- `tests/setup.ts` -- blocks non-local sockets; vitest env sets `JUDGE_PROVIDER=mock`, empty key.
- `tests/TRACE.md` -- FR-15 (line ~201), FR-17 (~215), NFR-3 (~324): replace "Pending: 4.1" with rows.
- `ARCHITECTURE-SPINE.md` AD-13 / tree (`judge/` line ~536) -- amend for `core.ts`, mock map, replay info, numbering, missing dir, SDK → endpoint ban.

## Tasks & Acceptance

**Execution:**
- `src/server/judge/core.ts` -- `FallbackReason`, `JudgeError extends Error { reason }`, `Judge` and `PartitionResult` types, `canonicalise(raw: unknown, length: number): number[]` -- shared by providers without an import cycle through `index.ts`.
- `src/server/judge/prompt.ts` -- `export const PROMPT_VERSION = "1"` only -- every provider's `info.promptVersion`; Story 4.4 adds the prompt text beside it.
- `src/server/judge/providers/mock.ts` -- `createMockJudge(map: Record<string, number[]> = {})`, keyed by the exact Question text, `Object.hasOwn` lookup -- AC5.
- `src/server/judge/providers/replay.ts` -- `createReplayJudge({ dir = join(process.cwd(), "data/rulings"), hasKey = Boolean(env.OPENROUTER_API_KEY) } = {})`; zod `z.strictObject` record schema with refinements; loads every `*.json` in `dir` once per instance (lazy, cached promise; ENOENT on the dir → `[]`); partition per the matrix -- AC3, AC4.
- `src/server/judge/index.ts` -- re-export from `core`; `getJudge()` switches on `env.JUDGE_PROVIDER`: `mock` → `createMockJudge()`, `replay` → `createReplayJudge()`, `openrouter` → replay with a `shortcut:` comment until Story 4.4 -- AC1.
- `eslint.config.mjs` -- one block for `src/**` ignoring `src/server/judge/**`: `no-restricted-syntax` on `Literal`/`TemplateElement` containing `openrouter.ai` -- AC1 ("or the SDK": there is no SDK by AD-13, so the ban is on the endpoint).
- `tests/fixtures/rulings/*.json` -- two invented files, Norwegian questions, one Question split across both.
- `tests/unit/judge.test.ts` -- AC1 (getJudge via `vi.stubEnv` + `vi.resetModules` + dynamic import), AC2 (via mock map and `canonicalise`), AC3, AC4 (malformed files written to an `os.tmpdir()` dir), AC5. Titles carry FR-15 / FR-17 / NFR-3 / AD-13 / AD-14.
- `tests/unit/lint-zones.test.ts`, `tests/unit/next-config.test.ts` -- new cases.
- `tests/TRACE.md`, `tests/unit/guards.test.ts` title -- rows for FR-15, FR-17, NFR-3.
- `ARCHITECTURE-SPINE.md` -- amendment lines "Amended in Story 4.1".
- `sprint-status.yaml` -- 4-1 done, epic-4 in-progress.

**Acceptance Criteria:**
- Given `JUDGE_PROVIDER` is `mock`, `replay` or unset (no key), when `getJudge()` is called, then it returns the mock, replay, replay.
- Given a file in `src/server/grouping` (or any `src/` path outside the judge), when it imports `@/server/judge/providers/*` or names `openrouter.ai`, then `npm run lint` fails; the same inside `src/server/judge` passes.
- Given the I/O matrix rows, when the tests run offline, then each row's behavior holds.
- Given `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run format:check`, then all pass.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 35 findings — high 0, medium 0, low 28, false 7, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind Hunter: `getJudge()` builds a new replay instance per call, so the files are re-read per call. Story 4.2 calls `getJudge()` once per run, so that is one read per run of small fixture files. Memoising per process would add state nobody needs yet.
  - `[low]` `[reject]` Blind Hunter: a failed load stays cached on the instance. The instance lives for one Grouping run, so a transient failure costs that run (every Question falls back with `ERROR`) and the next run reloads. Unlikely, and the fix adds a retry branch.
  - `[false]` `[reject]` Blind Hunter: a non-ENOENT `readdir` error does not name the directory. Node's own message names it (`ENOTDIR: not a directory, scandir '<dir>'`).
  - `[low]` `[reject]` Blind Hunter: mock and replay ignore `signal`. AD-13 gives abort handling (`TIMEOUT`) to the openrouter provider. Replay does only a local file read, and Story 4.2 owns the 30 s race and its fake-timer test.
  - `[low]` `[patch]` Blind Hunter: the schema accepts non-normalised items, which then silently never match. Fixed: a refine requires `normalize(item) === item` for rulings at the current `NORMALIZE_VERSION`, with a malformed-file test row.
  - `[low]` `[patch]` Blind Hunter: the endpoint lint ban is case-sensitive. Fixed: both selectors carry the `i` flag, and `OpenRouter.AI` is a lint-zones case.
  - `[false]` `[reject]` Blind Hunter: a later `no-restricted-syntax` block could replace this one. No other `no-restricted-syntax` rule exists in `eslint.config.mjs`, so nothing is replaced today; the harm is hypothetical.
  - `[low]` `[patch]` Blind Hunter: the `openrouter` branch of `getJudge()` is untested. Fixed with the key-set test (see the Verification Gap row).
  - `[low]` `[reject]` Blind Hunter: no test shows the once-per-instance cache. It is a performance detail with no AC behind it, and the test would need file deletion between calls.
  - `[low]` `[reject]` Blind Hunter: no test shows one bad file failing the whole replay. The behaviour is in the spine amendment, and the malformed-file tests already prove the error. A mixed-directory test adds no new branch.
  - `[low]` `[patch]` Blind Hunter: the tests leave temp directories behind. Fixed: every `mkdtemp` directory is removed in `afterAll`.
  - `[low]` `[patch]` Blind Hunter: the missing-directory test used a fixed shared path. Fixed: it uses an `absent` subpath of a fresh temp directory.
  - `[low]` `[reject]` Blind Hunter: replay reports the current `PROMPT_VERSION`, not the ruling's own, so stale rulings replay under the new label. The AD-13 interface makes `info` static per provider. Each ruling keeps its own versions in its file, and AD-20's `judge:eval` warns on a mismatch. Story 4.4 owns the prompt and its version.
  - `[low]` `[patch]` Blind Hunter: the NFR-3 TRACE row said replay reads "only" the fixtures. Fixed: it now names the temp directories too.
  - `[low]` `[patch]` Verification Gap: nothing tested which ruling wins when two rulings cover the same item. Fixed: a test writes `a.json` and `b.json` with an overlapping item in different clusters and asserts that it follows `a.json`.
  - `[low]` `[patch]` Verification Gap: nothing tested the key-set path or the default `hasKey`. Fixed: a test stubs `JUDGE_PROVIDER=""` and `OPENROUTER_API_KEY="k"`, and asserts replay and a `NO_STORED_RULING` miss.
  - `[low]` `[patch]` Edge Case Hunter: the endpoint ban is case-sensitive. Same root as the Blind Hunter row; fixed there.
  - `[low]` `[reject]` Edge Case Hunter: a failed load is cached. Same root and reason as the Blind Hunter row.
  - `[false]` `[reject]` Edge Case Hunter: duplicate uncovered strings in `items` get separate clusters. Items are distinct by contract (AD-12: a Question's items are its distinct normalised texts), and Story 4.2 builds them.
  - `[low]` `[reject]` Edge Case Hunter: `items = []` throws a miss while the mock returns `[]`. A miss on zero items only falls back to zero Groups. Whether Grouping calls the Judge for a Question with no Answers is Story 4.2's call, and a guard here would add a branch.
  - `[low]` `[patch]` Edge Case Hunter: `canonicalise` let a sparse array through, because `every()` skips holes. Fixed: it validates and maps over `Array.from(raw)`, with a "sparse array" test row.
  - `[low]` `[reject]` Edge Case Hunter: the signal is ignored. Same root and reason as the Blind Hunter row.
  - `[low]` `[patch]` Edge Case Hunter: the missing-directory test used a fixed path. Same root as the Blind Hunter row; fixed there.
  - `[low]` `[patch]` Edge Case Hunter (claim): the endpoint ban is weaker than the AC wording suggests. Fixed with the `i` flag, and the spine amendment now says that it matches literals only, in any letter case.
  - `[false]` `[reject]` Intent Alignment: replay's numbering is not first-occurrence. This is deliberate, and it reconciles AC2 with AC3's "after them" (see Design Notes). The spine is amended, and the partial-hit test pins `[0, 0, 2, 1, 3]`.
  - `[low]` `[patch]` Intent Alignment: AC2 through `partition` covered only a wrong-length mock map. Fixed: the mock test also runs a non-integer map value.
  - `[false]` `[reject]` Intent Alignment: "or the SDK" became an endpoint ban. AD-13 forbids an SDK ("built-in `fetch` (no SDK)") and states the rule as "imports a provider or calls the model endpoint". The ban follows that rule, and the spine records it.
  - `[low]` `[reject]` Intent Alignment: AC4 names `data/rulings`, but the tests use fixtures and temp directories. AC3 asks for fixtures under `tests/` explicitly, `data/rulings` does not exist until Story 7.1, and the key-set test now exercises the default path (absent, so a miss).
  - `[low]` `[patch]` Intent Alignment: the default `hasKey` was untested. Same root as the Verification Gap key-set row; fixed there.
  - `[low]` `[patch]` Intent Alignment: key set with the provider unset was untested. Same root as the Verification Gap key-set row; fixed there.
  - `[low]` `[reject]` Intent Alignment: no test asserts that the mock does no I/O. The mock imports nothing but `core` and `prompt`, and the global socket guard fails any network use. A file-system spy would test the imports list.
  - `[low]` `[patch]` Intent Alignment: TRACE.md carried wrong AC labels. Fixed: lint-zones is AC1 and next-config is AD-24. FR-17 is split into AC3 (replay), AC2 (`INVALID_OUTPUT`) and AC4 (malformed files), and the NFR-3 mock row is AC5.
  - `[false]` `[reject]` Intent Alignment: the spec and epic-4 context are missing from the diff and the work is uncommitted. They were left out of the review diff on purpose, and the commits happen at finalisation.
  - `[low]` `[patch]` Intent Alignment: the check does not require normalised items. Same root as the Blind Hunter row; fixed there.
  - `[false]` `[reject]` Intent Alignment: AD-14's "In the DB" part is not built. The `grouping_result` table belongs to Story 4.2 (its **Tables** line), and this story's AC4 covers only the file shape.

### AI suggestions corrected or rejected (grading evidence)

- **The orchestrator corrected its own first reading:**
  - Validation was not wrapped centrally in `getJudge()`. A central wrapper would renumber replay's output and destroy the "uncovered after covered" numbering that Story 4.2 needs to find fallback singletons. Each provider calls `canonicalise` on its own raw output instead.
  - Shared types live in `core.ts`, not `index.ts`, to avoid an import cycle between `index.ts` and the providers. The spine tree is amended.
  - "The SDK" in AC1 became a ban on the endpoint literal, since the spine has no SDK at all.
- **Corrected in the implementation subagent's work:**
  - TRACE.md AC labels: lint was labelled AC2, next-config AD-14, and the mock row AC3.
  - The missing-directory test used a shared fixed path, and the test temp directories were never removed.
- **Accepted from the implementation subagent, with a note:** replay skips rulings whose `normalizeVersion` differs from `NORMALIZE_VERSION`, rather than failing on them. A bump of the rule then turns old rulings into misses (fallback), not into a broken deployment. It is tested and in the spine.
- **Rejected review suggestions:** see the `[reject]` rows above. The main ones are a per-process judge cache, retry after a failed load, abort handling in mock and replay, and reporting each ruling's own prompt version.
- **Context compiler:** the epic-4 context came out at about 2.5K tokens against an 800–1500 target. It was kept, since epic 3's context is the same size and the extra covers 4.2–4.4.

## Design Notes

- **Two numbering rules.** AD-13 says valid output is canonical (first occurrence). AD-13 also says replay numbers uncovered items "after" the covered clusters. Both hold: `canonicalise` runs on raw output (stored assignments, mock maps, later the model), and replay then numbers covered clusters `0..c-1` in first-occurrence order over covered items and uncovered items `c..k-1` in item order. So replay output is canonical when the uncovered items come last, and Story 4.2 can find the uncovered singletons as the last `uncovered` cluster numbers (they get `origin = fallback`).
- **Replay `info`.** `{ provider: 'replay', model: 'replay', promptVersion: PROMPT_VERSION }`; mock is `{ provider: 'mock', model: 'mock', ... }`. Static per provider, as the interface requires; each stored ruling keeps its own model and prompt version in the file.
- **Several rulings for one Question.** Each item takes its cluster from the first matching ruling that covers it; cluster identity is `(ruling, stored cluster)`, so two rulings never merge clusters.
- **Malformed file → plain `Error`.** Not a `JudgeError`: it is a broken deployment, not a Judge verdict. AD-12 counts any other throw as `ERROR`.
- **Tests may import providers.** The zone covers `src/`; tests must construct a mock with a map and a replay pointed at fixtures.

## Verification

**Commands:**
- `npm run test` -- expected: all pass, new `tests/unit/judge.test.ts` included
- `npm run lint && npm run typecheck && npm run format:check` -- expected: clean
- `npm run test:e2e` -- expected: all pass (no UI change)

## Auto Run Result

Status: done

**Summary.** `src/server/judge` now holds the AD-13 boundary:
- `getJudge()` selects mock, replay, or replay for unset (and for `openrouter` until Story 4.4, marked with a `shortcut:` comment).
- `JudgeError(reason)` and the `Judge` type.
- `canonicalise` validates provider output and renumbers it, else throws `INVALID_OUTPUT`.
- A replay provider reads AD-14 rulings from `data/rulings/*.json`, keyed by `normalize(question)`.
- A deterministic mock with no I/O.

ESLint now also bans the `openrouter.ai` endpoint literal outside the judge. No UI, schema or network code was added.

**Files changed**
- `src/server/judge/core.ts`: types, `JudgeError`, `canonicalise`.
- `src/server/judge/index.ts`: `getJudge()` and re-exports.
- `src/server/judge/prompt.ts`: `PROMPT_VERSION`.
- `src/server/judge/providers/mock.ts`: the map-driven mock.
- `src/server/judge/providers/replay.ts`: the ruling loader with a strict zod schema, and the partition logic.
- `eslint.config.mjs`: the endpoint-literal ban, case-insensitive.
- `tests/unit/judge.test.ts`: covers AC1–AC5 and every matrix row.
- `tests/fixtures/rulings/{a,b}.json`: invented rulings.
- `tests/unit/lint-zones.test.ts`, `tests/unit/next-config.test.ts`: new cases.
- `tests/TRACE.md`: rows under FR-15, FR-17 and NFR-3.
- `ARCHITECTURE-SPINE.md`: an "Amended in Story 4.1" block in AD-13, and `core.ts` in the tree.
- `sprint-status.yaml`: 4-1 done, epic-4 in-progress.
- `epic-4-context.md`: compiled.

**Review.**
- 35 findings: 28 low and 7 false.
- 13 rows patched, as 9 fixes: case-insensitive endpoint ban; normalised-item check; sparse-array rejection; overlap-precedence test; key-set test; non-integer mock test; temp-directory hygiene; TRACE labels; spine wording.
- 15 low rows rejected with reasons, plus 7 false. All are in the triage log.
- Nothing deferred.

**Follow-up review:** `false`. Every patched entry was low.

**Verification** (after the patches):
- `npm run test`: 469 passed in 35 files.
- `npm run test:e2e`: 86 passed. No server was left listening.
- `npm run lint`, `npm run typecheck` and `npm run format:check`: clean.

**Residual risks**
- Replay labels results with the current `PROMPT_VERSION` and `model: 'replay'`, not each ruling's own.
- The mock cannot simulate `TIMEOUT` yet, so Story 4.2 must add failure injection.
- `getJudge()` with a key selects replay until Story 4.4.
