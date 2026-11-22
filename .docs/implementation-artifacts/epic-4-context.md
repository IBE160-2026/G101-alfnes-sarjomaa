# Epic 4 Context: The Judge groups the Answers, or the fallback does

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

After the Host closes Collection, Grouping runs once in the background. Each Question's Answers are partitioned into Groups by the Judge, or that Question falls back to one Group per distinct normalised Answer text, and the Game reaches *in review* with or without a model key. The Judge sits behind one vendor-neutral boundary (replay of stored rulings, a test mock, and last the live OpenRouter provider), so the whole flow runs offline. The Game also keeps content-free usage counters that the Host can download as a report, so the group can measure whether the Judge helps without storing any Answer. Nothing in the epic stores or logs Answer content outside the `answer` table.

## Stories

- Story 4.1: Judge boundary with replay and mock providers
- Story 4.2: Grouping runs once at close, with per-Question fallback
- Story 4.3: Usage counters and the usage report
- Story 4.4: Live Judge through the OpenRouter provider, prompt and ruling recorder

## Requirements & Constraints

- **Run once:** Grouping never re-partitions a Question that already has a `grouping_result`; only the lease winner runs. Count is `count(distinct contributor_key)` in SQL.
- **Fallback is normal:** no key, no stored ruling, a Judge failure or more than 30 s gives that Question one Group per distinct normalised text, `origin = fallback`, `fell_back = true` and a reason (`NO_KEY | NO_STORED_RULING | TIMEOUT | ERROR | REFUSAL | INVALID_OUTPUT`). Close still succeeds.
- **Usage counters (content-free):** one row per Game with `judge_groups_proposed`, `groups_merged`, `answers_moved`, `groups_created`, `groups_renamed`, `groups_discarded`, `groups_restored`, `judge_calls`, `questions_fell_back`. No Answer text, no identity, deleted with the Game. Grouping bumps only `judge_groups_proposed`, `judge_calls` and `questions_fell_back`, by that Question's figures, inside the same per-Question transaction; Review (Epic 5) owns the rest.
- **Usage report:** holds the counters, each Question's `source` and `fell_back`, and each Group's `origin` and `edit_count`. It contains no Answer text, no Group label (default or custom) and nothing linking an Answer to an Invite link or Contributor. It is for Games in *in review* or later. Another Host's Game gets the same response as a Game that does not exist.
- **What the report must make computable:** the share of `origin = judge` Groups that reach the Board with `edit_count = 0` (target at least 70 %) and the median `edit_count` of the changed ones; and Judge calls per Question, always reported alongside Judge quality, because more calls cost money and time.
- **No network in tests or demo:** Vitest forces `JUDGE_PROVIDER=mock` with no key; Playwright uses `replay`. Everything passes offline.
- **Privacy at the Judge:** only the Question text and its distinct normalised items are sent; the live request routes only to providers that honour the schema and do not store or train on data.
- **Conventions:** new `ErrorCode`s with bokmål messages in `src/lib/errors.ts`; FR IDs in test titles and rows in `tests/TRACE.md`; a foreign-Host case in `tests/integration/authz.test.ts` for every new Host entry point; any new state-dependent operation gets a row in `src/lib/game-state.ts` and a `WRONG_STATE` case; new tables and columns only as needed, with a generated, committed migration and `ON DELETE CASCADE` toward `game`; any departure from the architecture spine amends it in the same change; no Stage 2 stubs.

## Technical Decisions

- **Counters schema:** `game_counter` is keyed by `game_id` (not a uuid `id`), one-to-one with `game`, owned by the `games` module. `games.bumpCounters(tx, gameId, delta)` is the only writer, called by `grouping` now and `review` later. The spine does not say when the row is created; decide it in 4.3.
- **`edit_count`:** an `answer_group` column added by Story 4.3 together with the report that reads it (4.2 deliberately deferred it). Review increments it on every edit of the affected Groups. `answer_group` must still carry no timestamps, serials or identity.
- **Grouping figures to bump:** Groups proposed means Groups with `origin = judge` (the same figure the *in review* summary shows via `grouping.summary`). On fallback, `judge_calls` and `uncovered_items` are recorded as 0, since `JudgeError` carries no call count; this is a `shortcut:` until 4.4 can fail after spending calls. `grouping_result.source` is `judge` (live), `replay` (stored) or `fallback`.
- **Report route:** `GET /api/spill/[gameId]/rapport` is one of only three allowed Route Handlers (with `/api/health` and `/api/purge`). It authenticates the Host with `auth.requireHost()`, resolves the Game through `games.getOwned` (which throws `NOT_FOUND` for missing and foreign Games alike), and calls `await connection()`. Groups survive `review.confirmBoard` (it only nulls `contributor_key` and `rank`), so the report works through *ready*, *playing* and *played*.
- **Anonymity guards:** Host-facing queries and DTOs never select `contributor_key` or `rank`; the report is a Host response and must stay clean under the FR-12 tests.
- **Error boundary:** entry points and `after()` tasks turn non-`DomainError`s into `INTERNAL` with no cause; `src/server/log.ts` takes only `{ module, op, code, sqlstate }`.
- **Live provider (4.4):** built-in `fetch` to OpenRouter chat completions, model `JUDGE_MODEL` (default pinned `deepseek/deepseek-v4.1-flash`), strict JSON-schema `response_format` for `{ assignments: number[] }`, `temperature: 0`, bounded `max_tokens`, `provider: { require_parameters: true, data_collection: "deny" }`. Uses a stored ruling without `fetch` only on an exact item-set match. One retry on invalid output, 429 or 5xx inside the signal, counted in `calls`; abort gives `TIMEOUT`, `content_filter` gives `REFUSAL`. Unset `JUDGE_PROVIDER` then means openrouter with a key, replay without. The prompt and `PROMPT_VERSION` live only in `src/server/judge/prompt.ts`; any change bumps the version. Only `OPENROUTER_API_KEY`, `JUDGE_PROVIDER` and `JUDGE_MODEL` are read, via `src/server/env.ts`. Nothing outside `src/server/judge` may contain `openrouter.ai` (ESLint).
- **Ruling recorder (4.4):** `npm run judge:record` writes stored-ruling records (`kind: "partition"`, versions, model, question, sorted distinct items, assignments), only under `.data/` except the designated demo and ProtoQA sources, and refuses without a key. One live run times a synthetic 250-item Question and replaces the estimates in the architecture delivery notes.

## UX & Interaction Patterns

- **"Last ned bruksrapport":** a button on the Game page from *in review* onward (*in review*, *ready*, *playing*, *played*), absent in *draft*, *collecting* and *grouping*. Clicking it downloads the report. Each Game state has exactly one primary action ("Gå til gjennomgangen", "Start spillet", and so on), so the report button is not primary: use `button-secondary` or `button-ghost`. "Slett spillet" stays at the bottom of the page.
- **Grouping panel** (in place from 4.2): "Dommeren, en KI-modell, grupperer svarene …", "N av M spørsmål ferdig", polling every 3 s; a run past its lease shows "Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt." Judge failures are not shown here; Review's fallback Notice reads `fallback_reason` later.
- **In review summary:** StatusBadge "Til gjennomgang", Question count, Groups proposed, number of fallback Questions, primary action "Gå til gjennomgangen".
- **Voice and accessibility:** literal bokmål from the UX contract, "du", no exclamation marks, errors say what happened and what to do; 44 px targets, visible focus, WCAG 2.1 AA (checked with axe in e2e). The Judge is "dommeren", the process "gruppering".

## Cross-Story Dependencies

- 4.1 and 4.2 are done: the Judge boundary, replay and mock (with failure injection for every fallback reason), `answer_group`, `grouping_result`, `answer.group_id`, the lease, `resumeIfStale`, `finishIfComplete`, `progress`, `summary`, `countsOf`, and the Game page panel and summary.
- 4.3 adds `game_counter`, `games.bumpCounters`, the bump inside 4.2's per-Question transaction, `answer_group.edit_count`, the report route and the button.
- 4.4 adds the live provider, `prompt.ts`, the key-based default in `getJudge()` and `judge:record`; every `grouping_result` must record the prompt version and model ID from the Judge's `info`.
- Epic 5 increments `edit_count` and the other six counters through `bumpCounters`, and reads `fallback_reason` and `origin`. Epic 7 consumes `data/rulings/demo.json` and `protoqa-dev.json` (recorded with `judge:record`) and the replay path for Demo mode.
