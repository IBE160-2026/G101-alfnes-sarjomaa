# Reconcile: Architecture spine vs secondary inputs

Spine: `ARCHITECTURE-SPINE.md` (status draft, 2026-11-21).
Inputs read: `brief.md`, `addendum.md`, `tilbakemelding-product-brief.md`, `proposal.md`, `wiki/kurs/sensorveiledning-del-1.md`. Spot-checked against the repo: root `.gitignore`, root `README.md`, `PRD.md` (only to avoid false findings), the spine `.memlog.md`.

The PRD is canonical. Where an input conflicts with the PRD, that is not a finding. Where the PRD already covers an item, it is noted and not counted.

Scope: what did not land in the spine (neither decided, deferred nor mapped), plus anything that contradicts the instructor feedback or the grading guide.

## Summary

| Severity | Count |
| --- | --- |
| High | 3 |
| Medium | 10 |
| Low | 9 |
| Total | 22 |

Contradictions with the instructor feedback or the grading guide: none hard. Two soft tensions, reported as M6 (scope against "not more complex than the app needs") and M9 (Node 26 prerequisite against a clean examiner machine).

---

## High

### H1. README is never specified as a deliverable

- **Source:** sensorveiledning "6. README og kjørbarhet" checklist and "Hva dette betyr" 3 and 7; tilbakemelding section 2, rows 6 and 7; 2026-11-19 announcement (README names the API keys), quoted in sensorveiledning point 7.
- **What is missing:** the spine mentions the README only in passing (demo credentials in AD-18, variable agreement in AD-20, script names in Conventions, "README states the limits" in the FR-14 row, the examiner-path line). Nothing says what the README must contain or who owns it. The sensor's checklist is: what the app does and for whom (with a screenshot), prerequisites with versions (Node, and "no database to install"), copy-paste install and start, an env var table with which key turns on the Judge, test data and test users, how to run the tests (including `npx playwright install chromium`), a folder overview, links to the planning and process documents, and what Stage 2 left out and why. A README that cannot get the examiner running caps criterion 2 and lowers criterion 6 (10 %). There is also no home for screenshot files in the tree.
- **Suggested spine fix:** Add a "README contract" row to Consistency Conventions that lists the sensor checklist items as required sections (plus Stage 2 omissions, the anonymity limits from PRD section 1.1 and the key statement), and add `README.md` and a screenshot folder to the Structural Seed tree.

### H2. Real-person data has more leak paths than the demo

- **Source:** addendum "Where data lives" and "Running without a model key"; tilbakemelding section 2, row 7 ("ingen svar om ekte personer committes"); sensorveiledning point 8; project CLAUDE.md redaction rule (public repo).
- **What is missing:** AD-18 only bans `.idea/` text in the demo. AD-19 says housewarming Answers are "scored only locally" but defines no mechanism. `judge:eval` reads only `data/protoqa/`, so a local run needs an input path, and `--live` and `judge:record` write rulings into tracked `data/rulings/`. Running either over housewarming data would put real people's answers in a tracked file. Other vectors are not covered: few-shot examples in `src/server/judge/prompt.ts` (a likely place to reuse real answers while tuning against `judge:eval`), unit and e2e fixtures, and the `prompting/` archive (`prompting/fase-3-arkitektur/` is untracked and unreviewed).
- **Suggested spine fix:** In AD-19 add `judge:eval --file <path>` for local sets that prints aggregates only and writes rulings only under `.data/`; widen AD-18 to "no `.idea/`-derived text in any tracked file: fixtures, few-shots, tests, rulings, `prompting/`".

### H3. The demo replay can silently degrade to singletons

- **Source:** addendum "Running without a model key" (demo data plus stored rulings); tilbakemelding section 1 row 6 and section 2 row 6 ("hurtigbufrede dommer-svar, slik at sensor kan se KI-flyten"); sensorveiledning point 7.
- **What is missing:** AD-14's key is `sha256([promptVersion, normalize(question), items])` over the whole sorted item list of a Question, and AD-12 treats a replay miss as a Judge failure that falls back to one Group per distinct text. Two silent failure modes follow. (a) Any prompt edit bumps `PROMPT_VERSION` (AD-13), so every fixture misses until `judge:record` is re-run with a live key; nothing in AD-21 checks that `demo.json` still matches. (b) The examiner tests "feil input og uventet bruk": adding one Answer set to the demo Game before close changes the items, the whole Question misses, and the AI path looks broken, with no key to re-record. AD-21 says `demo.spec.ts` uses the demo Game but not that it asserts the grouped result.
- **Suggested spine fix:** In AD-21 require an integration test that closes the seeded demo Game under `replay` and asserts `source = replay` and `fell_back = false` for every Question, and state in AD-18 that Games edited after seeding fall back to manual Review with a neutral label (see M8).

---

## Medium

### M1. Lint and format scope collides with a repo root shared with the BMAD framework

- **Source:** sensorveiledning criterion 5 (linter or formatter) and criterion 7; project CLAUDE.md (`_bmad/config.toml` is installer-managed, 39 skills under `.claude/skills/`).
- **What is missing:** AD-1 puts the app at the repo root and AD-21 runs `npm run lint` and `npm run format:check` in CI and, by README, for the examiner. The tree lists `.prettierrc` and `eslint.config.mjs` but no `.prettierignore`, ESLint `ignores` or tsconfig `include`. Prettier and ESLint over the whole root would hit `_bmad/`, `.claude/skills/`, `wiki/`, `.docs/`, `prompting/` and generated `drizzle/meta/*.json`, and the first CI run fails or reformats framework files. A failing README command is a named warning sign for the examiner.
- **Suggested spine fix:** In AD-21 or Style, scope `lint`, `format:check` and `typecheck` to `src tests` and the config files, and list the `.prettierignore` and ESLint `ignores` entries (`_bmad .claude wiki .docs prompting scripts drizzle .idea .next`).

### M2. Repo-root hygiene is only half specified, and `.data/` is not actually ignored

- **Source:** sensorveiledning criterion 7 ("Tydelig skille mellom kode og dokumentasjon", `.gitignore`, "ingen byggeartefakter", "ingen løse filer i rota") and its warning signs; tilbakemelding section 2, row 7.
- **What is missing:** checked in the repo: the root `.gitignore` exists and covers `node_modules`, `.next`, coverage, Playwright output, `.env*` with `!.env.example`, and `.idea/`, but it has no `.data/`, so the PGlite directories the spine calls "gitignored" would be committed. It also carries a large Python block that does not apply. The tree omits `.gitignore`, `package.json`, `package-lock.json` (required by `npm ci` in AD-21), `tsconfig.json` and `postcss.config.mjs`. The tree names only `wiki/ .docs/ prompting/ scripts/` as existing root content and omits `_bmad/`, `.claude/`, `.logs/`, `README.md`, `CLAUDE.md`, `product-brief.md`, `PRD.md` and `proposal.md`, so the spine's "docs stay beside the code" is not justified against the code and documentation separation criterion.
- **Suggested spine fix:** In the tree, add `.data/` to the `.gitignore` entry, add the missing config files and `package-lock.json` (committed), list the remaining root documents with one line saying why the app lives at the root.

### M3. Branch, PR and review-trace workflow is absent

- **Source:** sensorveiledning "Slik går sensor fram" step 6, criteria 1 and 3 ("Spor av kodegjennomgang"), "Hva dette betyr" 1, 2 and 9 (decided 2026-11-21: one branch and one PR per epic; commit often; log AI corrections); git log `cf9b660`.
- **What is missing:** AD-21 names `.github/workflows/ci.yml` but gives no triggers, no PR template and no rule tying a PR to a story or recording AI corrections. The sensor also treats planning documents that no longer match the code as a warning sign, and the spine has no rule for amending itself when code departs from it.
- **Suggested spine fix:** In AD-21 state that CI runs on `pull_request` and on push to `main`, add `.github/pull_request_template.md` ("AI output corrected or rejected?", "deviation from spine or PRD?"), and say a deviation amends this spine in the same PR.

### M4. Departures from `proposal.md` are not recorded in one place

- **Source:** proposal (Supabase Auth and RLS, REST route handlers, shadcn/ui, drag-and-drop review, Next.js 15, Claude Haiku 4.5, preset tables, stored `Team.score` and `AnswerGroup.member_count`, `SubmissionToken`); sensorveiledning criterion 1 ("forklarte avvik fra planen") and criterion 2 ("utelatt eller endret er beskrevet og begrunnet").
- **What is missing:** rationale is scattered (AD-2 for the database, AD-6 for auth, AD-11 for computed counts, AD-17 for Server Actions, Deferred for shadcn and drag). There is no consolidated delta against the proposal, and the examiner is told the proposal is the baseline. Check whether `wiki/beslutninger.md` already carries it; the spine does not link to it.
- **Suggested spine fix:** Add a short "Departures from proposal.md" table (item, decision, AD) or link the wiki note, so README and reflection can cite one source.

### M5. Only two of the brief's four testable criteria map to named tests

- **Source:** brief "Success Criteria, Functional"; tilbakemelding section 1 (Success Criteria row) and "Suggestions" 1; sensorveiledning point 4 ("Test også feil input").
- **What is missing:** AD-21 names `anonymity.test.ts` (criterion 3) and `no-key.spec.ts` (criterion 4). Nothing is named for (1) reopen and extend through the same link with one Answer set per link, or (2) refusal of the link and any new submission after close. Also unnamed: the wrong-Host `NotFound` behaviour (AD-5), over-limit and invalid input (AD-8, AD-17), and the close-versus-submit race (AD-4), which the examiner will try.
- **Suggested spine fix:** In AD-21 add `tests/integration/collection.test.ts` (reopen and extend, one set per link, refusal after close, race with close), `authz.test.ts` (AD-5) and a `tests/e2e/participant.spec.ts` for invalid input and revoked links.

### M6. No Stage 1 cut order for a short window

- **Source:** tilbakemelding "Tid og omfang: risiko" and "Prioriter slik at kjerneflyten blir ferdig og stabil først"; sensorveiledning "Hva dette betyr" 2 and 3 (what is left out must be justified in README); criterion 5 ("ikke mer komplekse enn appen trenger"). PRD line 456 sets a Stage 1 freeze in week 47.
- **What is missing:** the spine defers only Stage 2. Stage 1 carries a dual database driver, three Judge providers, a hosted pilot (AD-23), `judge:record` and `judge:eval --live`, Playwright e2e and 23 ADs, for two people with roughly two weeks to 5 December. There is no order for what is dropped first, and no instruction that a cut is explained in README.
- **Suggested spine fix:** Add a "Cut order" bullet to Deferred: AD-23 pilot and the postgres.js path first, then `--live` and record polish, then e2e breadth; never cut AD-4, AD-7 to AD-10, the replay demo or the README; each cut is stated in README.

### M7. The no-key path is modelled as a failure

- **Source:** addendum "Running without a model key" ("full paths, not error states"); tilbakemelding section 1 row 5 ("hele flyten ... uten nøkkel").
- **What is missing:** AD-13 sends an unset key to `replay`, and AD-12 treats a missing ruling as a Judge failure with `fell_back = true`. Every Game the examiner creates themselves (anything except the demo Game) therefore ends with every Question flagged as fallen back. The spine gives no reason code for "no Judge configured", so Review and the counters cannot tell it from a real fault.
- **Suggested spine fix:** In AD-12 define `fallback_reason` values including `NO_JUDGE` and `NO_STORED_RULING`, and require Review to show them as the normal "group by hand" state, not as an error.

### M8. `/svar` has no rule against rendering a signed-in identity

- **Source:** addendum "Anonymity mechanics" (the interface must not show a signed-in identity anywhere in the answering flow); brief "The Problem" (the source form showed the account above an anonymity promise).
- **What is missing:** AD-7 covers tokens, `Referrer-Policy` and logging, but nothing keeps the Host session out of the answer page. A Host opening their own link in the same browser carries the session cookie, and a shared root layout could render host chrome or read the session.
- **Suggested spine fix:** In AD-7 add "`app/svar` has its own root layout that never reads the session cookie or renders host chrome".

### M9. The examiner path has several untested assumptions

- **Source:** sensorveiledning step 3 (clean machine, README only, 15 to 20 minutes, every missing step noted) and criterion 6 ("forutsetninger med versjoner").
- **What is missing:** the examiner path is three commands after "Node 26 and git". Unspecified or at risk: AD-18 step 4 sets environment variables on the command line and step 1 recreates a directory, which fails on Windows if written as shell; the default port 3000 may be busy, which breaks the `APP_BASE_URL` default and the printed links; `demo` does not say whether it uses `next dev` (slow first compile) or a build; the `next start` in `test:e2e` needs a build step; and the examiner machine is more likely on Node 20 or 22 than on 26 (`engines >=24`, `.nvmrc` 26). This is the soft tension with the "clean machine" expectation.
- **Suggested spine fix:** In AD-18 specify `demo` as one `tsx` script with no shell syntax that picks a free port, sets `APP_BASE_URL` to match and runs `next dev`; in AD-21 make the Playwright `webServer` build first; state the minimum Node actually tested.

### M10. Final delivery is a zip, and the spine says nothing about what goes in it

- **Source:** project CLAUDE.md status ("GitHub-repo som zip", 5 December); sensorveiledning point 2 and warning signs (committed keys or `.env` files, build folders).
- **What is missing:** a zip of the working folder includes gitignored `.env.local` (a live key), `.idea/` (real names), `.data/` (PGlite with test hosts) and `node_modules/`. Nothing in the spine or `scripts/` produces a clean archive.
- **Suggested spine fix:** Add a `scripts/make-zip.sh` that runs `git archive HEAD` to the structural seed and say in README that only tracked files ship.

---

## Low

### L1. ProtoQA credit and the Family Feud branding limit are only partly carried

- **Source:** addendum "Source of the ready-made questions" ("attribute ProtoQA visibly"; the name, interface and branding must not imitate the show).
- **What is missing:** AD-19 puts the credit only in `data/protoqa/ATTRIBUTION.md`, does not say it covers `rulings/protoqa-dev.json` (derived content), and does not record changes made to the dataset (CC-BY asks for that). PRD line 414 already requires the credit in the README and on the play screen, so only the attribution file's scope is open. The trademark limit is not carried into any convention.
- **Suggested spine fix:** In AD-19 Licensing, add "ATTRIBUTION.md states the changes made and covers `rulings/protoqa-dev.json`"; in Conventions add "no Family Feud name or branding in UI strings or assets".

### L2. Two of the addendum's three architecture-phase Review questions are neither decided nor deferred

- **Source:** addendum "Aggregating free-text answers" (confidence signal per group; near-threshold answers; group of one); proposal Risk 2 (accept a plain list if drag-and-drop proves costly).
- **What is missing:** Deferred covers near-threshold only. `Judge.partition` returns `assignments` and `calls`, so a per-group confidence signal is impossible without an interface change, and the spine does not say so. A group of one is not addressed (it is an ordinary Group under AD-12, but Review and `board_slot` behaviour is unstated). The proposal's list-first fallback for the Review screen is not recorded as the default.
- **Suggested spine fix:** Add to Deferred: "No per-group confidence signal in Stage 1; singleton Groups are ordinary Groups; a plain list is the default Review interaction, drag optional".

### L3. Judge evaluation has no regression gate and ignores run-to-run variance

- **Source:** addendum "The judge, and how it can be wrong" (non-determinism, prompt sensitivity); brief Success Criteria (grouping quality).
- **What is missing:** AD-19 prints one F1 per run. A live run varies, and nothing fails a prompt change that lowers the replayed score. The SM-2 baseline is deferred, which is fine, but the gate that uses it is not.
- **Suggested spine fix:** In AD-19 add "a replay test in `npm test` asserts F1 is at least the recorded baseline; `--live --runs N` reports mean, min and max".

### L4. Automated accessibility and bokmål error pages are not owned

- **Source:** sensorveiledning criterion 4 (contrast, keyboard, labels, "forståelige feilmeldinger", "tomtilstander"); tilbakemelding section 2 row 4; PRD NFR-6 and NFR-7.
- **What is missing:** the map sends NFR-6 to the UX documents plus a manual checklist; nothing runs an automated check, root layout language is not set, and AD-5's `notFound()` renders Next's default English 404 unless a bokmål page exists. The same goes for `error.tsx`.
- **Suggested spine fix:** In AD-21 add an `@axe-core/playwright` pass over the three surfaces; in Conventions add `<html lang="nb">` plus bokmål `not-found.tsx`, `error.tsx` and `global-error.tsx`.

### L5. The spine's own code block contains commented-out code

- **Source:** sensorveiledning criterion 5 and warning signs ("utkommenterte rester", "død kode").
- **What is missing:** the AD-13 interface block carries a commented Stage 2 `match(...)` line, while Style says "No commented-out code". If copied into `src`, it is the exact remnant the examiner looks for. The Style rule also has no enforcement mechanism.
- **Suggested spine fix:** Move the Stage 2 signature into prose and say no stub or comment ships; enforce "no commented-out code" through the PR template (M3), not new tooling.

### L6. The deployed Postgres path is never exercised by a test

- **Source:** sensorveiledning criterion 3 ("tester som kan kjøres etter README og tester meningsfull logikk"); criterion 5 (not more complex than needed).
- **What is missing:** AD-2 claims queries are written once for both drivers, but CI runs only `pglite://memory`, so the postgres.js path used by the pilot is unverified. Bundling `data/rulings` on Vercel (the diagram says "bundled") also needs file-tracing configuration that is not stated.
- **Suggested spine fix:** Either add a CI job with a Postgres service running the integration tests through `DATABASE_URL=postgres://`, or mark AD-23 as unverified until the pilot (and list it first in the cut order, M6).

### L7. CLI and test runner interplay with `server-only`, env files and `after()` (adjacent, not from the sources)

- **Source:** not from the secondary inputs; it affects "tests runnable per README" (sensorveiledning step 8). Verify in the first story.
- **What is missing:** every `src/server` file starts with `import 'server-only'`, and `src/cli` and `tests/integration` import those modules; outside Next that package throws unless the `react-server` condition is set (tsx flag, Vitest alias). `tsx` does not read `.env.local`, so `judge:record` and `judge:eval --live` need `--env-file` while `env.ts` reads only `process.env`. AD-9 says `collection.close` starts Grouping after commit, while AD-12 starts it with Next's request-scoped `after()` in the action; the owner is ambiguous, and integration tests and the demo seed call module functions outside a request.
- **Suggested spine fix:** In AD-1 and AD-21 state the `server-only` alias for Vitest and `tsx --conditions=react-server --env-file`, and say Grouping is started by the Server Action adapter, never by the module function.

### L8. The one-minute grouping target is only stated as a 90 to 120 s bound

- **Source:** proposal "Technical Constraints" and "Success Criteria" (grouping within one minute for 30 participants and 15 Questions).
- **What is missing:** AD-12 gives a worst-case bound (3 waves of 30 s = 90 s), not an expected time, and no place where the proposal's one-minute target is measured. PRD NFR-5 excludes Grouping itself from its one-second rule; check PRD section 6.2 for a stated Grouping budget, and drop this finding if it already sets one.
- **Suggested spine fix:** In AD-12 state the expected wall time and that the Judge story measures it against the one-minute target, with the bound as the degraded case.

### L9. The architecture document's name and location do not match the root README

- **Source:** root `README.md` "Leveranser" table lists `solution-architecture.md` (not yet written); project CLAUDE.md copy pattern for `product-brief.md` and `PRD.md` via `scripts/sync-brief.sh`.
- **What is missing:** the spine is `.docs/.../ARCHITECTURE-SPINE.md`. The spine does not say whether a root copy under the README's name is delivered (and generated by the sync script) or whether the README link changes. The examiner reads the README first.
- **Suggested spine fix:** Add one line under `companions` or the tree stating where the architecture is delivered and how the README links it.

---

## Checked and found landed (no finding)

- No key and no network: replay-first Judge (AD-13), demo fixtures (AD-18), localhost-only network guard and CI without `ANTHROPIC_API_KEY` (AD-21).
- One Judge module for grouping now and Guess matching later; Grouping once at close and stored; cost sizing replaces all-pairs (AD-12, AD-13).
- Token hashed, deleted at close; no per-answer timestamps, order or identity; the schema-level anonymity test (AD-8 to AD-10).
- `.env.example` and gitignored `.env*` (AD-20, confirmed in the root `.gitignore`); ProtoQA data location and the CC-BY credit file (AD-19); housewarming data kept in `.idea/`.
- Linter and formatter exist and run in CI (AD-21, Style); unit tests for score, ranking and token (AD-21); a manual checklist (AD-21).
- Review screen risk: interaction design is deferred to UX with no data contract depending on it (see L2 for the gaps).
- Host cannot see per-link state before close; the pre-close operator risk is routed to the README via the FR-14 row (PRD section 1.1).
- Instructor point that a ready-made question set should ship for the examiner: in Stage 1 the demo Game stands in for it (PRD line 381), so that is PRD-owned, not a finding.
