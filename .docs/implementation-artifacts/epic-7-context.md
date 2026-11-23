# Epic 7 Context: The examiner runs it without keys: Demo mode, Judge evaluation and hand-in

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The examiner clones the repository, starts Demo mode in three commands (`git clone`, `npm install`, `npm run demo`), sees Judge Groups produced from Stored rulings, and runs the tests and the Judge evaluation offline. Grouping quality is measured with pinned, reproducible figures instead of claimed. Every Stage 1 consequence is traced to a test or a manual check, so the group can declare the Stage 1 acceptance gate passed. The README states the limits and cuts honestly. All of it works with no key, no paid account and no network. The pilot deployment is optional and the first thing cut.

## Stories

- Story 7.1: Demo mode with one command
- Story 7.2: Judge evaluation against ProtoQA
- Story 7.3: Traceability, manual checklists and the SM-1 gate
- Story 7.4: README, hand-in zip and fresh-clone check
- Story 7.5: Pilot deployment (first to cut)

## Requirements & Constraints

- **Demo mode:** an invented demo Host and one demo Game in *collecting* with invented Norwegian Questions and Answer sets. Closing it gives Judge Groups from Stored rulings: every Question has source `replay`, zero uncovered items, no fallback, no network call. No tracked file (fixtures, rulings, tests, `prompting/`) may hold text derived from `.idea/`; a manual checklist item verifies this.
- **Judge evaluation (SM-2, amended 2026-11-23):** one offline command replays committed rulings against ProtoQA's crowdsourced dev clusters and prints B-cubed precision, recall and F1, Judge calls per Question, prompt version and model ID, warns when the rulings' versions differ from the current ones, and states whether F1 reaches 0.70. B-cubed scores each Answer by the share of its Group in its cluster (precision) and the share of its cluster in its Group (recall). The test pins the figures for the committed rulings (reproducible offline) and never fails on a figure below 0.70. A figure below 0.70 does not fail SM-1; it is reported unchanged, discussed in the reflection report, and Review is the safeguard. ProtoQA is English, so the figure says nothing direct about Norwegian Answers.
- **Tuning rule:** until the Stage 1 freeze (1 December) a shortfall may be tuned (prompt, effort or `JUDGE_MODEL`, bump `PROMPT_VERSION`, re-record, re-pin), and every prompt version and model tried goes in the README with the figure. After the freeze the figure is final and nothing is changed to chase it; only fixes, tests and the README change.
- **Opt-in extras:** `judge:eval -- --live` regenerates rulings (needs a key). `judge:eval -- --file <path>` scores a local labelled set and prints aggregates only, never items.
- **Data licence:** `data/protoqa/` holds only the crowdsourced dev file. `ATTRIBUTION.md` gives the CC-BY-4.0 credit, states the changes made and covers `protoqa-dev.json`. No scraped or training file is ever committed.
- **SM-1 gate:** a unit test fails if any Stage 1 FR (1 to 21, 23 to 27, 30 to 32) is missing from `tests/TRACE.md`. `game-state.test.ts` walks every operation against every state and asserts exactly the permitted table. The manual checklist holds A1 to A10, NFR-5 timing for Review and play on the sizing Game, and the demo-content item, each with a recorded result and date. A failure needs a fix or, only for a slip-list item, a stated README slip. SM-1 is counted without slipped items the README names.
- **SM-3 audit:** `tests/manual/anonymity-audit.md`, run by someone not involved in the last change, using Host access, the Invite-link list and a database dump taken after the Board is confirmed. Result recorded: no Answer attributable to a link or joinable across Questions.
- **Slip list (binding):** the pilot deployment with the CI Postgres job and Cron; `judge:eval --live` and SM-4; end-to-end breadth beyond required specs. The README names every slip or says none slipped. Never cut the state machine, anonymity, replay demo, network-free tests or the README. Hand-in is 5 December.
- **README (Norwegian):** what and for whom with a screenshot in `docs-assets/`; prerequisites (Node 22.13+, git); the three commands and printed demo login; environment table stating the app runs without any key; test commands (`npm test`, `npx playwright install chromium` then `npm run test:e2e`, `npm run judge:eval`); structure linking `.docs/`, `wiki/`, `prompting/`; Stage 2 omissions and every Stage 1 cut with reasons; the SM-2 figure with all versions tried; retention runs only while the app runs and the pilot database is deleted when the course ends. The local path never mentions a host.
- **README anonymity section:** nobody can see who wrote an Answer, and Answers may be sent to an external AI service for grouping. It lists the eight limits in the delivery notes (Host reads Answers as written; a DB operator before close; WAL, freed pages and provider history after close; per-Question Answer counts between close and confirmation; the model provider; pilot access logs; three-set minimum protects only against a curious Host; Answers readable only on the submitting device) plus the unsent draft on the Participant's device, and points to the sprint change proposal of 2026-11-23.
- **Secrets and zip:** README table, `.env.example` and `env.ts` list the same variables, with no key or password in any tracked file. `scripts/make-zip.sh` builds from `git archive HEAD`, so the zip has no `.env.local`, `.idea/`, `.data/` or `node_modules/`.
- **Pilot (7.5):** Vercel Hobby (Node runtime) with Neon in the EU on a pooled URL, production from `main` only, `db:migrate` as an explicit deploy step, daily Cron on `/api/purge` with `CRON_SECRET`, Grouping inside the 300 s limit, a real-phone run to final Scores. A cut is stated with its reason.

## Technical Decisions

- **Demo command:** `src/cli/demo.ts` through `tsx`, no shell syntax. It recreates `.data/demo`, migrates, seeds through module functions (not raw SQL), then starts `next dev` on `PORT` with `DATABASE_URL=pglite://.data/demo`, `JUDGE_PROVIDER=replay`, `DEMO_MODE=1` and a matching `APP_BASE_URL`. Demo credentials are one constant in `src/lib`, printed on start and read by the login page and the Demo band. Answers added before close become their own Groups.
- **Rulings:** JSON arrays `data/rulings/demo.json` and `data/rulings/protoqa-dev.json`, each `{ kind: "partition", promptVersion, normalizeVersion, model, question, items, assignments }` over sorted distinct normalised items. Written only by `npm run judge:record` (needs a live key; writes only under `.data/` or to these two fixtures). Replay matches by normalised Question and only for the current `NORMALIZE_VERSION`. Rulings are traced into the deployed bundle.
- **Evaluation:** `src/cli/judge-eval.ts` reads `data/protoqa/dev.crowdsourced.jsonl` (`iesl/protoqa-data`; 52 rows though its README says 51). Raw answers are normalised, an item's weight is the sum of its respondents, and its gold cluster is the one holding most of that weight. `src/lib/bcubed.ts` is pure and takes the weights; unit tests need a hand-computed example, and "everything in one Group" and "every item alone" must both score clearly below a correct partition. `src/cli` reaches the Judge only through `src/server/judge` exports, never a provider.
- **Tuning limits:** `JUDGE_MODEL` is a pinned OpenRouter ID (never a `-latest` alias) with `structured_outputs` and `reasoning.mandatory` not `true`, since the request sends `effort: "none"` and a mandatory-reasoning model rejects it with a 400, which is `ERROR` on every Question. `reasoning` and `max_tokens` changes do not bump `PROMPT_VERSION`; any prompt change does.
- **Config (AD-21):** `DATABASE_URL`, `PORT`, `APP_BASE_URL`, `OPENROUTER_API_KEY`, `JUDGE_PROVIDER`, `JUDGE_MODEL`, `DEMO_MODE`, `REGISTRATION_CODE`, `CRON_SECRET`, read only through `src/server/env.ts`. `.env.example` keys must equal `env.ts` keys (tested).
- **Scripts:** README, CI and Playwright use only the convention names: `dev`, `demo`, `build`, `start`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `judge:eval`, `judge:record`, `judge:smoke`.
- **Tests (AD-22):** integration runs on fresh `pglite://:memory:` with real migrations; Vitest forces `mock`, clears the key, rejects non-localhost. Playwright runs on `next build && next start` with a temp PGlite dir and `replay`, blocking non-localhost. Only `demo.spec.ts` uses the demo Game. Test titles carry FR IDs.
- **CI:** `.github/workflows/ci.yml` on pull request and push to `main`, Node 22 and 26, no key, `NEXT_TELEMETRY_DISABLED=1`, README scripts only, plus a demo smoke (start `npm run demo` in the background, poll `/api/health` until 200, stop) that runs last, after the e2e run. The optional second job runs `tests/integration` on a Postgres service container.
- **Pilot (AD-24, amended 2026-11-23; overrides the 7.5 story text):** registration is open (`REGISTRATION_CODE` unset), previews are on with `DATABASE_URL=pglite:///tmp/toppsvar` and no key, and the live key has a USD 0.10 credit limit; when exhausted the Judge returns `ERROR` and Questions fall back to one Group per distinct Answer. `vercel.json` pins functions to `fra1`, next to Neon, since cross-continent round trips broke NFR-5.
- **Process:** a departure from the architecture spine amends the spine in the same PR.

## UX & Interaction Patterns

- **Demo surfaces:** landing and `/logg-inn` show the demo login; the login page has a "Fyll inn demobrukeren" button. A thin info band under the top bar on every Host page says the content is invented and the Judge uses stored decisions. In Demo mode Review shows Judge Groups and no fallback Notice.
- **Manual checks:** play legibility at 1920×1080, text at least 48 px (A1); answer form by keyboard only (A2), by screen reader (A3), at 360 and 320 px and 200 % zoom (A4); axe or Lighthouse over every page (A5); Review by keyboard only (A6); play never shows raw, discarded or below-limit Groups (A7); 200-character Question with eight Groups and wide four-Team names fit 1080 px (A8); a 40-character label is never truncated (A9); visible focus ring on every SelectionBar control (A10).

## Cross-Story Dependencies

- Epics 1 to 6 are done; seeding and replay use their modules. Story 7.1 is done. `tests/TRACE.md` and `tests/manual/checklist.md` exist and earlier stories fill them.
- 7.2 needs `data/rulings/protoqa-dev.json` recorded once with the group's live key before `judge-eval.test.ts` can pass; the examiner never needs a key. Re-recording means re-pinning the figures.
- SM-2 tuning (7.2) must finish before the 1 December freeze; its version and model history feeds the README (7.4).
- 7.3 needs every earlier story's TRACE rows, including 7.1 and 7.2's tests and 7.1's demo-content item. The gate excludes slipped items only if the README (7.4) names them.
- 7.4 depends on 7.1 (command, login), 7.2 (SM-2 figure and history), 7.3 (results, slip outcome) and 7.5 (live or cut). The fresh-clone run is recorded in the checklist, and CI uses the same script names.
- 7.5 is off the examiner path and first to cut.
- Epic 8 starts only after SM-1 passes in full on `main`.
