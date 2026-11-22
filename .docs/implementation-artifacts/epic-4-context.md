# Epic 4 Context: The Judge groups the Answers, or the fallback does

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

After the Host closes Collection, Grouping runs once in the background. Each Question's Answers are partitioned into Groups by the Judge, or that Question falls back to one Group per distinct normalised Answer text, and the Game reaches *in review* with or without a model key. The Judge sits behind one vendor-neutral boundary with three providers (replay of stored rulings, a test mock, and the live OpenRouter provider), so the whole flow runs offline. The Game also keeps content-free usage counters the Host can download as a report, so the group can measure whether the Judge helps without storing any Answer.

## Stories

- Story 4.1: Judge boundary with replay and mock providers
- Story 4.2: Grouping runs once at close, with per-Question fallback
- Story 4.3: Usage counters and the usage report
- Story 4.4: Live Judge through the OpenRouter provider, prompt and ruling recorder

## Requirements & Constraints

- **Run once, resumable:** a Question with a `grouping_result` is never partitioned again; only the lease winner runs; Reopening Review never re-runs Grouping. The sizing Game (30 Answer sets, 15 Questions, up to 5 Answers) finishes within two minutes, with at most five Questions in flight.
- **Fallback is normal, not an error:** no key, no stored ruling, a Judge failure or more than 30 s gives that Question one Group per distinct normalised text (`origin = fallback`, `fell_back = true`, reason `NO_KEY | NO_STORED_RULING | TIMEOUT | ERROR | REFUSAL | INVALID_OUTPUT`). Close still succeeds and Questions already grouped keep their Judge Groups.
- **No network in tests or demo:** Vitest forces `JUDGE_PROVIDER=mock` with no key; Playwright and Demo mode use `replay`. Lint, typecheck, unit, integration and e2e all pass offline and without a key.
- **Privacy at the Judge:** only the Question text and its distinct normalised items are sent, never identity or Contributor keys. The live request must route only to providers that honour the schema and do not store or train on data. No prompt, fixture, few-shot example or ruling may contain text derived from `.idea/` or a real person.
- **Content-free counters and report:** counters, each Question's `source` and `fell_back`, and each Group's `origin` and `edit_count`; no Answer text, no Group label, nothing linking an Answer to an Invite link or Contributor. Host-facing queries and DTOs never select `contributor_key` or `rank`. Another Host's Game answers like a missing one.
- **What the report must make computable:** the share of `origin = judge` Groups that reach the Board unchanged (target at least 70 %, SM-5) and the median `edit_count` of changed ones; Judge calls per Question always reported alongside quality, because more calls cost money and time.
- **Quality and cost:** the Judge reaches B-cubed F1 of at least 0.70 on `judge:eval` (SM-2); if not, change `JUDGE_MODEL` and re-record. Expected cost is about USD 0.004 for the sizing Game and about USD 0.008 for the largest (50 links, 20 Questions, 5 Answers); retries count in `calls`.
- **Conventions:** new `ErrorCode`s with bokmål messages in `src/lib/errors.ts`; FR IDs in test titles and rows in `tests/TRACE.md`; a foreign-Host case in `tests/integration/authz.test.ts` per Host entry point; state-dependent operations get a `src/lib/game-state.ts` row and a `WRONG_STATE` case; migrations generated and committed, `ON DELETE CASCADE` toward `game`; a spine departure amends the spine in the same change; no Stage 2 stubs (no `match`).

## Technical Decisions

- **Interface:** `getJudge()`, `JudgeError(reason)` and `Judge.partition({ question, items }, signal)` returning `{ assignments, calls, uncovered, source: 'live' | 'stored' }`, plus static `info { provider, model, promptVersion }`. Types and `canonicalise` live in `src/server/judge/core.ts`, re-exported by `index.ts`. Output is validated and renumbered `0..k-1` in first-occurrence order; bad output is `INVALID_OUTPUT`. Nothing outside `src/server/judge` imports a provider, and an ESLint rule rejects any literal containing `openrouter.ai` outside it.
- **Selection:** `JUDGE_PROVIDER` picks the provider; unset means openrouter when `OPENROUTER_API_KEY` is set, replay otherwise. Since 4.4 the key-derived default selects openrouter. Only `OPENROUTER_API_KEY`, `JUDGE_PROVIDER`, `JUDGE_MODEL` are read, through zod-validated `src/server/env.ts`; `.env.example` keys must match `env.ts`.
- **Replay semantics (built):** rulings in `data/rulings/*.json`, matched by `normalize(question)` and only when `normalizeVersion` equals the current one. Covered items take stored clusters, uncovered items become singletons numbered last; no covered item is a miss (`NO_KEY` without a key, else `NO_STORED_RULING`). A malformed file throws a plain `Error` naming the file, counted as `ERROR`. Mock takes a map keyed by exact Question text and can inject any fallback reason (`TIMEOUT` waits for the abort).
- **Stored ruling format:** `{ kind: "partition", promptVersion, normalizeVersion, model, question, items, assignments }` with sorted distinct normalised items, in JSON-array fixtures `data/rulings/demo.json` and `protoqa-dev.json`, written only by `judge:record`. `data/rulings/**` is traced for deployment via `outputFileTracingIncludes`.
- **Live provider (4.4):** the openrouter provider uses a stored ruling only when its item set matches exactly (`source: 'stored'`, no `fetch`). Otherwise built-in `fetch` (no SDK) to `https://openrouter.ai/api/v1/chat/completions` with model `JUDGE_MODEL` (default pinned `deepseek/deepseek-v4.1-flash`, never a `-latest` alias), strict JSON-schema `response_format` for `{ assignments: number[] }`, `temperature: 0`, `max_tokens: MAX_TOKENS` (2,048, a flat cap that fits the largest Question's 250 items), `reasoning: { effort: "none" }` (reasoning tokens count against `max_tokens`; a model with `reasoning.mandatory: true` cannot be used) and `provider: { require_parameters: true, data_collection: "deny" }`. One retry on invalid output, 429 or 5xx inside the signal, counted in `calls`; abort gives `TIMEOUT`, `content_filter` gives `REFUSAL`. Its `info` reports the real model and prompt version, which Grouping stores in every `grouping_result`.
- **Prompt:** lives only in `src/server/judge/prompt.ts` with `PROMPT_VERSION`; any prompt change bumps the version. Wording is tuned against `judge:eval`.
- **Ruling recorder (4.4):** `npm run judge:record -- <input.json> <output.json>` runs through `tsx --conditions=react-server` with `.env` and `.env.local` if present, refuses clearly without a key, and writes only under `.data/` except the designated demo and ProtoQA sources. One live run times a synthetic 250-item Question; measured tokens and latency replace the estimates in `delivery-notes.md`. It is the second item in the Stage 1 cut order, so it must not endanger the replay path.
- **Grouping (built):** the runner owns the 30 s bound with its own `AbortController` at `JUDGE_TIMEOUT_MS` and races it, so a provider that ignores the signal still yields `TIMEOUT`; the Judge is never called inside a transaction; one transaction per Question writes Groups, `answer.group_id`, `grouping_result` and the counter bump. `grouping_result.source` is `judge` (live), `replay` (stored) or `fallback`.
- **Calls on fallback (closed in 4.4):** `JudgeError(reason, calls)` carries the requests sent, so `judge_calls` is recorded on success and on fallback. `npm run judge:smoke` makes one live call on a synthetic Question for a quick check of key and model.
- **Counters (built in 4.3):** `game_counter` is keyed by `game_id`, created lazily by `games.bumpCounters(tx, gameId, delta)`, the only writer. Grouping bumps `judge_groups_proposed`, `judge_calls`, `questions_fell_back` inside the Question's transaction. `answer_group.edit_count` is bumped by Review. Report route `GET /api/spill/[gameId]/rapport` is one of three allowed Route Handlers; it serves the attachment `toppsvar-bruksrapport.json` for *in review*, *ready*, *playing* and *played*.
- **Error boundary:** entry points and `after()` tasks turn non-`DomainError`s into `INTERNAL` without cause; `src/server/log.ts` takes only `{ module, op, code, sqlstate }`. Nothing logs Answer text, and never a Token or key.

## UX & Interaction Patterns

- The Game page in *grouping* shows "Dommeren, en KI-modell, grupperer svarene …" with "N av M spørsmål ferdig", polling every 3 s; a run past its lease shows "Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt." Judge failures are not shown there; Review's fallback Notice reads `fallback_reason` later, and `NO_KEY` and `NO_STORED_RULING` read as the normal group-by-hand state.
- From *in review* onward the page has a secondary "Last ned bruksrapport" button; each state keeps exactly one primary action.
- Voice: literal bokmål from the UX contract, "du", no exclamation marks, "dommeren" and "gruppering"; 44 px targets, visible focus, WCAG 2.1 AA checked with axe.

## Cross-Story Dependencies

- Stories 4.1 to 4.4 are built: the boundary, Grouping, counters and report, and the live provider with `prompt.ts`, the key-based default in `getJudge()`, `judge:record` and `judge:smoke`.
- Epic 5 increments `edit_count` and the other six counters through `bumpCounters`, reads `fallback_reason` and `origin`, and its Board-locking story must add an on-Board flag per Group to the report (SM-5 cannot tell a Board Group from a discarded one until then). Host-made Groups must never use `origin = judge`.
- Epic 7 consumes `data/rulings/demo.json` and `protoqa-dev.json` (recorded with `judge:record`), `judge:eval` and the replay path for Demo mode.
