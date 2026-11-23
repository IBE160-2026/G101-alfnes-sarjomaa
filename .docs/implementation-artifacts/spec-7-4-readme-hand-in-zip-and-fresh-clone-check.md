---
title: 'Story 7.4: README, hand-in zip and fresh-clone check'
type: 'chore'
created: '2026-11-23'
status: 'done'
baseline_revision: 'c9efab30c699176bd36e59e97102f91c93edaa76'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
warnings: ['oversized']
deferred:
  - summary: >-
      `npm install` with npm 11.20.0 rewrites `package-lock.json` in a fresh clone.
    evidence: |-
      The F1 run added `"peer": true` to four optional entries. It is metadata only, `npm ci` (CI) leaves the file alone, and the lockfile predates this story. It leaves the examiner's tree dirty, so `make-zip.sh` warns after `npm install`. Settled by regenerating the lockfile with the npm version the group uses, or by accepting it.
    location: >-
      package-lock.json
    severity: low
---

<intent-contract>

## Intent

**Problem:** The README does not yet give the examiner the three commands with the demo login, the environment table, the anonymity section with its limits, the slip-list outcome, Stage 2 or the SM-2 figure, and the hand-in zip has no script. Four "Open" items in `tests/TRACE.md` and the F1 row in `tests/manual/checklist.md` wait on this story.

**Approach:** Add the missing README parts in the group's new style (short sentences, secondary material in `<details>`, the `oversikt` diagram first and visible), switch the examiner path from `npm run dev` to `npm run demo` (also in the `oversikt` diagram), add `scripts/make-zip.sh` on `git archive HEAD`, extend the env test so the README table must match `env.ts`, then run a real fresh clone and the zip procedure and record both.

## Boundaries & Constraints

**Always:** README in Norwegian bokmål, as compact as possible; the group's structure stays (same section order, `oversikt` visible, other diagrams collapsed). Every fact in the README matches its source: the demo login in `src/lib/demo.ts`, variables in `src/server/env.ts` and `.env.example`, limits in `delivery-notes.md` and `EXPERIENCE.md`, SM-2 history in the Story 7.2 spec, slip list in PRD §6.5. The local path never mentions a host. Tests pass offline; every commit green (`npm run test`, `npm run test:e2e` when code or the demo path changes, `npm run lint`, `npm run typecheck`, `npx prettier --check README.md`). The fresh clone and zip live in the session scratchpad, never in the repository, and are deleted afterwards. Rejected or corrected AI suggestions go in this spec's review section.

**Never:** Touch `.logs/`, `wiki/`, `.claude/skills/excalidraw-diagram/`. Read, print, grep or commit `.env` (only `.env.example`). Call OpenRouter. Put absolute machine paths or real names (from `.idea/`) in tracked files. Use ports 3000, 3101 or 3200 for the fresh-clone demo (the clone's own e2e run uses 3100/3101 as configured, run only when nothing else holds them). Kill processes not started here. Push. Mark any A, T, D row or SM-3 as passed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zip, default | `./scripts/make-zip.sh` on a committed tree | `G101-alfnes-sarjomaa.zip` in the repo root, every entry under `G101-alfnes-sarjomaa/`, only tracked files; path printed | — |
| Zip, explicit path | `./scripts/make-zip.sh /abs/out.zip` | zip written there | — |
| Zip, dirty tree | uncommitted changes | zip still built from `HEAD`; a warning on stderr says uncommitted changes are left out | — |
| README env table drifts | a variable added to `env.ts` but not to the README table | `tests/integration/env.test.ts` fails | — |

</intent-contract>

## Code Map

- `README.md` -- 1014 words before. Sections: Produkt, Slik ser det ut, Flytene (`oversikt` visible, five collapsed), Medlemmer, Leveranser, Prosess, Utvikling (`npm run dev`, key notes, CI commands in `<details>`, DB in `<details>`), Dokumentasjon. `Produkt` links `#utvikling`.
- `src/lib/demo.ts:3` -- `DEMO_HOST` = `demo@toppsvar.test` / `demo-passord`; `src/cli/demo.ts` prints `Toppsvar demo: <APP_BASE_URL>/logg-inn` with the login, recreates `.data/demo`, runs `next dev` on `PORT`.
- `src/server/env.ts`, `.env.example` -- the nine variables: `DATABASE_URL`, `PORT`, `APP_BASE_URL`, `OPENROUTER_API_KEY`, `JUDGE_PROVIDER`, `JUDGE_MODEL`, `DEMO_MODE`, `REGISTRATION_CODE`, `CRON_SECRET`; `.env.example` comments give the defaults.
- `tests/integration/env.test.ts:5` -- `exampleKeys()` parses `.env.example`; first test compares with `envSchema.shape`. Add the README table the same way.
- `src/lib/limits.ts:43-46` -- retention 30 days after played, 90 days idle, purge every hour while the server runs. `vercel.json` has no Cron yet.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md` -- README contract, the eight anonymity limits, cut order.
- `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md:204` -- unsent draft in `localStorage` on the Participant's device.
- `.docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md:488` -- slip list: pilot (NFR-2, with scheduled expiry), live regeneration (FR-32), SM-4. Stage 2: FR-22, FR-28, FR-29, FR-33 (§8.2).
- `.docs/implementation-artifacts/spec-7-2-judge-evaluation-against-protoqa.md:190-219` -- SM-2 history: v1 `none` 0.6849 (P 0.9809, R 0.5261, 15 fallbacks, 1.40 calls), an earlier v1 `none` run 0.6739 (14 fallbacks), `medium` 0.6545 (25), `high` 0.6304 (33), all `deepseek/deepseek-v4.1-flash`; shell-exported key beats `.env`.
- `.github/workflows/ci.yml` -- `postgres` job (`npm run test -- tests/integration` with `TEST_POSTGRES_URL`) and `check` job (lint, format:check, typecheck, drizzle-kit check, migration check, `npm test`, `judge:eval`, e2e, demo smoke).
- `tests/TRACE.md:209,383,408,416,497` -- the "Open" README bullets to close (FR-14, FR-15, NFR-1, NFR-2, NFR-8).
- `tests/manual/checklist.md` -- F1 row (empty), "The AI that builds the app fills in no result", SM-1 gate open-items list.
- Scratchpad `excal/oversikt.py` -- the local box reads `npm run dev  ·  PGlite på disk  ·  …`; `excal/render.sh oversikt` writes to the `main-wt` worktree's `docs-assets/diagrammer/`, from where PNG and `.excalidraw` are copied into this repo (then the `main-wt` copies restored with `git checkout`).
- `playwright.config.ts:6,8` -- e2e uses 3100 and 3101.

## Tasks & Acceptance

**Execution:**
- `README.md` -- examiner path with `git clone`, `npm install`, `npm run demo` and the printed login; environment table (collapsed) and the no-key sentence visible; test commands visible, CI commands collapsed with the Postgres job; the shell-key note; an "Anonymitet" section (notice visible, nine limits collapsed, link to the sprint change proposal); retention and pilot deletion; a "Status" section with the SM-1 state, slip outcome, Stage 2, no Stage 1 cuts and the SM-2 table (collapsed); folder overview linking `.docs/`, `wiki/`, `prompting/` (collapsed); zip instructions (collapsed).
- `docs-assets/diagrammer/oversikt.{png,excalidraw}` -- re-render with `npm run demo` in the local box.
- `scripts/make-zip.sh`, `.gitignore` -- `git archive --format=zip --prefix=G101-alfnes-sarjomaa/ HEAD`, optional output path, warning on a dirty tree; ignore `*.zip`.
- `tests/integration/env.test.ts` -- README table variables equal `envSchema` keys (AC3).
- `tests/integration/make-zip.test.ts` -- run the script into a temp path, assert entries are prefixed and none is `.env` (other than `.env.example`), `.env.local`, `.idea/`, `.data/`, `.next/` or `node_modules/` (AC4).
- `tests/manual/checklist.md` -- record F1 (time, result, machine, how) and the zip check; update the SM-1 gate list.
- `tests/TRACE.md` -- turn the five README "Open" bullets into pointers to the README, the tests and F1.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 7-4 to done.

**Acceptance Criteria:**
- Given a clone of HEAD in a scratch directory with no `.env`, `.data` or `.next`, when `npm ci` and `npm run demo` run on a free port, then the printed login logs in and reaches the demo Game, and `npm run test`, `npm run test:e2e` and `npm run judge:eval` pass in the clone; the time and result are in F1.
- Given the README, when checked against delivery-notes, EXPERIENCE.md, PRD §6.5 and the 7.2 spec, then the anonymity notice, the eight limits plus the unsent draft, the link to the 2026-11-23 sprint change proposal, the slip outcome, Stage 2 and why, the SM-2 figure with every version and model tried, retention only while running and pilot deletion are all present.
- Given the README table, `.env.example` and `env.ts`, when `npm run test` runs, then all three list the same nine variables, and a scan of tracked files finds no real key or password (the invented demo login and test fakes excepted).
- Given `scripts/make-zip.sh`, when it builds the zip, then the zip has no `.env`, `.env.local`, `.idea/`, `.data/`, `.next/` or `node_modules/` and none of the private names from `.idea/`.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 34 findings — high 1, medium 6, low 20, false 7, maybe-false 0
- findings:
  - `medium` `patch` (blind) The default-path zip test wrote and then deleted `G101-alfnes-sarjomaa.zip` in the real repository root, destroying a hand-in zip the group built — replaced by a test in a throwaway git repository in a temp directory.
  - `medium` `patch` (blind) `npm test` needs bash and `unzip`, so it fails on Windows or without `unzip` — the tests now skip on win32, and the real-repo content test skips without `unzip`.
  - `low` `patch` (blind) The zip has no git history, which the course counts as process evidence — the README zip section now says so and links the GitHub repository.
  - `low` `patch` (blind) `*.zip` in `.gitignore` ignored every zip in the repository — anchored to `/G101-alfnes-sarjomaa.zip`.
  - `false` `reject` (blind) 7-4 set to done before review — the review runs inside this build, and the status is committed only after it.
  - `low` `patch` (blind) F1's Result reads "pass" though a person's run is still open — the cell now says it was the AI's run and that a person's run is open; the SM-1 gate line says the same.
  - `low` `defer` (blind) `npm install` changes `package-lock.json` in a fresh clone — pre-existing lockfile metadata from the npm version; recorded in `deferred`.
  - `low` `reject` (blind) No test ties the README demo login to `DEMO_HOST` — the login is one constant that is unlikely to change, and a new test is more than a direct correction.
  - `low` `reject` (blind) The env-table test does not check the "Standard" column — same reason; it would need a parser for free-text defaults.
  - `low` `patch` (blind) The README CI block said `db:generate` fails CI and lacked `npm ci` — `npm ci` added, comment reworded.
  - `low` `patch` (blind) The README "Status" section is dated and nothing reminds anyone to update it — an SM-1 gate line in `tests/manual/checklist.md` now asks for an update at the freeze and before hand-in.
  - `low` `reject` (blind) The zip and README tests also run in the CI Postgres job — about a second, no harm.
  - `medium` `patch` (verification-gap) The dirty-tree warning was only checked against the real tree's state, so clean CI never proved it — the throwaway-repo test now runs clean (no warning) and dirty (warning, exit 0).
  - `high` `patch` (edge) In the extracted hand-in zip there is no `.git`, so the zip test would make the examiner's `npm test` red — the real-repo test skips outside a git work tree.
  - `medium` `patch` (edge) Same as the first blind finding: a real root zip is overwritten and deleted — same fix.
  - `low` `patch` (edge) A failing assertion left a stray zip in the root — gone with the throwaway repository.
  - `low` `patch` (edge) Parallel tests could race the dirty-tree comparison — the comparison against the real tree is removed.
  - `low` `patch` (edge) Only a root-level `.env*` was checked — every entry's basename is now checked.
  - `low` `patch` (edge) Only root-level `.idea/`, `.data/`, `.next/` were checked — matched as path segments at any depth.
  - `medium` `patch` (edge) Hosts without bash or `unzip` fail `npm test` — same fix as the second blind finding.
  - `false` `reject` (edge) Outside a git work tree the script prints a raw git error — `set -e` stops it with git's own message and a non-zero exit, which is loud and correct.
  - `low` `reject` (edge) A Windows drive path under Git Bash is mangled — the script targets bash on macOS and Linux, and the default path needs no argument.
  - `low` `reject` (edge) The "Standard" column is untested — duplicate of the blind finding.
  - `false` `reject` (edge) The zip contains the private names — the matches are the same first names belonging to unrelated public people (font designers in a font licence list, a well-known author) in vendored skill data, not the private persons; the checklist wording now says this precisely.
  - `low` `reject` (edge) No automated check for the private names — a test would have to hold those names in a tracked file, which the project forbids.
  - `false` `reject` (edge) F1 used `npm install`, not `npm ci` — the story's AC1 and the intent both name `npm install`.
  - `low` `patch` (intent) The README said nothing had slipped while the pilot's Vercel Cron is unfinished — the slip line now says that whatever is unfinished at the freeze moves to Stage 2.
  - `false` `reject` (intent) Real names in the zip — duplicate of the edge finding, same refutation.
  - `low` `patch` (intent) F1 was an AI run on the developer's machine, not a fresh machine — same fix as the blind F1 finding.
  - `false` `reject` (intent) AC1's "CI uses the same script names" is only matched by name — CI runs exactly those scripts, and F1 ran the README's own commands.
  - `low` `reject` (intent) AC3's "no key in any tracked file" rests on one manual scan — the scan is recorded; automated secret scanning would be new tooling nobody asked for.
  - `false` `reject` (intent) Review logs empty and files uncommitted — the auditor saw a mid-run snapshot; this entry and the final commit settle it.
  - `medium` `patch` (intent) The zip test's side effect in the repository root — same fix as the first blind finding.
  - `low` `reject` (intent) Whether the README is "as compact as possible" — already trimmed before review (see Auto Run Result); the remaining visible words carry content the story requires.

## Design Notes

**F1 is recorded honestly.** The user asked for the fresh-clone result in F1, while the checklist says the AI fills in no result. The row records what was run (a fresh clone in a scratch directory on the developer's machine, by the AI, with a warm npm cache and Playwright browsers already installed) and the SM-1 gate keeps a person's run on another machine open.

**Slip outcome as of 2026-11-23.** The freeze is 1 December, so nothing has slipped yet: the pilot is live (Cron not set up), the live regeneration ran, SM-4 has not run. The README says this and that SM-4 moves to Stage 2 if it is not run by the freeze.

## Verification

**Commands:**
- `npm run test` -- expected: all pass, including the new env and zip tests.
- `npm run lint`, `npm run typecheck`, `npx prettier --check README.md` -- expected: clean.
- `npm run test:e2e` -- expected: green (the demo path is unchanged, run once before the final commit).

**Manual checks (if no CLI):**
- Fresh clone and zip procedure as in the acceptance criteria; README word count before and after.

## Auto Run Result

**Summary.** The README now gives the examiner the three commands and the printed demo login, the environment table (tested against `env.ts`), an "Anonymitet" section with the notice, retention and nine limits, a "Status" section with SM-1, the slip outcome, Stage 2 and the SM-2 figure with every version tried, the shell-key note, the CI commands including the Postgres job, a folder overview and the zip instructions. The `oversikt` diagram shows `npm run demo`. `scripts/make-zip.sh` builds the hand-in from `git archive HEAD`. A real fresh clone and the zip procedure were run and recorded in `tests/manual/checklist.md`.

**Files changed.**
- `README.md` -- the story's README content, in the group's collapsed style.
- `docs-assets/diagrammer/oversikt.{png,excalidraw}` -- `npm run demo` in the local box.
- `scripts/make-zip.sh` -- the hand-in zip from `HEAD`, warning on a dirty tree.
- `.gitignore` -- ignores the default zip.
- `tests/integration/env.test.ts` -- README table equals the `env.ts` keys.
- `tests/integration/make-zip.test.ts` -- zip contents on the real repository; default path and warning in a throwaway repository.
- `tests/TRACE.md` -- the README "Open" bullets closed with pointers.
- `tests/manual/checklist.md` -- F1 and zip records, SM-1 gate lines.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 7-4 done.

**Review.** 34 findings: 1 high, 6 medium and 13 low patched (grouped by three root causes in the zip test plus small README and checklist fixes), 1 low deferred (lockfile metadata), 7 false and 7 low rejected with reasons in the triage log.

**Follow-up review recommendation: false.** One high was patched: the zip test failing in the extracted hand-in zip. It was verified after the patch by extracting the zip built from the final commit and running the zip and env tests there (see Verification), so no unverified risk remains. Patched counts: high 1, medium 6, low 13.

**Corrected or rejected AI output.**
- The implementation agent's README grew from 1,014 to 2,004 words. The orchestrator trimmed it to 1,850 (visible text outside `<details>` 853 words, from 578): the printed login block, a stray "D1" reference without explanation, and repeated prose were removed.
- `tests/TRACE.md` claimed the README repeats the notice "word for word"; after the trim it states the notice's two statements, and the trace line was corrected.
- The agent's first zip test deleted a real hand-in zip in the repository root and would have failed in the extracted zip; both were caught in review and fixed.
- The agent set 7-4 to done before review; it stays, but is committed only after this review.
- The agent corrected two stale README claims of earlier AI work: that `data/rulings/` was empty, and the "120 to 180 distinct answers" figure that ProtoQA contradicts.

**Verification.** `npm run test` 805 passed, 1 skipped; `npm run lint`, `npm run typecheck` and `npx prettier --check README.md tests scripts` clean; `npm run test:e2e` 99 passed (implementation agent, and again in the fresh clone). Fresh clone of `4b353f1` with no key: clone and install 3 s, demo ready 3 s later on port 3457, Playwright login with the printed credentials 2.5 s to "Mine spill" and the demo Game ("6 av 8 svar mottatt"), `npm test` 805 passed in 13 s, e2e 99 passed in 74 s, `judge:eval` F1 0.6849 in 1 s, 125 s in all. Zip: 8.7 MB, 1,269 entries, all under `G101-alfnes-sarjomaa/`, no `.env` other than `.env.example`, no `.env.local`, `.idea/`, `.data/`, `.next/` or `node_modules/`. The clone and zips were deleted.

**Residual risks.** F1 was run by the AI on the developer's machine with a warm npm cache and Playwright browser; a group member still runs it on another machine (open in the SM-1 gate). The README "Status" section is dated 23 November and must be updated at the freeze. The CI Postgres job has still only run locally (deferred in Story 7.3).

