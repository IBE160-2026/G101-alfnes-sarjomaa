---
title: 'Story 7.5: Pilot deployment (first to cut)'
type: 'chore'
created: '2026-11-23'
status: 'done'
baseline_revision: 'ef1be2ab53b872a554d41802e19951a91fd2b078'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-7-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The pilot has run at the pilot URL since 2026-11-23, but nothing in the repository records Story 7.5's three manual acceptance checks, `tests/TRACE.md` and the checklist still call the story backlog, and the spine says `CRON_SECRET` is set and a daily Cron runs, which is not true on the live project. The spine also never mentions `vercel.json`, which pins the functions to `fra1`.

**Approach:** Record the pilot as it is. Add a "Pilot" section to `tests/manual/checklist.md` with rows P1 to P3 for the story's AC1 to AC3, plus the read-only evidence gathered for this story, with the Result cells left to a person. Amend AD-24 (and the matching AD-23 sentence) in the spine with what the pilot actually runs. Point the NFR-2 trace at the new rows. The two production changes that are missing (`CRON_SECRET` and the Cron entry) and the real-phone round go to the group as actions, not into the repository.

## Boundaries & Constraints

**Always:** The epics text is the contract, read through the 2026-11-23 amendment in AD-24 (open registration, previews on with PGlite and no key), which overrides "`REGISTRATION_CODE`" and "previews disabled" in AC1. Every fact written down was observed in this session with a read-only command or comes from `delivery-notes.md`. Files in English, except README (Norwegian). Tests pass offline; every commit green.

**Never:** Deploy, change a Vercel setting, add an environment variable, add a `crons` entry to `vercel.json`, or touch the production database. Print or write any environment value or secret, the Vercel org ID or a deployment URL other than the public pilot address. Fill a Result cell in the checklist (the AI fills none except F1). Touch README unless a fact in it is wrong. Touch `.logs/`, `wiki/`, `.claude/skills/excalidraw-diagram/`.

</intent-contract>

## Code Map

- `vercel.json` -- only `regions: ["fra1"]`; no `crons`. Confirmed live: every pilot response carries an `x-vercel-id` routed through `fra1`.
- `src/app/api/purge/route.ts` -- 404 `disabled` when `CRON_SECRET` is unset, 401 without `Bearer <secret>`. The pilot answers `{"status":"disabled"}`, so `CRON_SECRET` is not set in Production.
- `src/app/api/health/route.ts` -- the pilot answers `{"status":"ok"}` (database reachable).
- `src/server/db/migrate.ts:19` -- `migrateFromEnv()` migrates only `postgres://` URLs; `npm run db:migrate` reads `.env.local` with `--env-file-if-exists`, and an exported `DATABASE_URL` wins over the file (Node never overrides an existing variable).
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md:462-498` -- AD-23 "When it runs" (daily Cron) and AD-24 (environment table, 2026-11-23 amendment: "`CRON_SECRET` stays set"). Line 575 has the Cron in the diagram.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md` -- "Pilot measurements": two production runs (Grouping 18.9 s and 3.6 s, no fallback; every play action 3 to 786 ms; Board lock 1.22 s). "Stage 1 cut order" item 1 lists the pilot, CI Postgres and Vercel Cron.
- `tests/manual/checklist.md` -- row tables per section (`| # | Check | Covers | Run on | Result | Date |`), "Supporting evidence, not a result" paragraphs, SM-1 gate open-items list, slip-list bullets (line 95: "Story 7.5 is still in the backlog").
- `tests/TRACE.md:410-416` -- NFR-2 section; last bullet points to the README only.
- `README.md:174-175` -- "Av glidelista i PRD §6.5 kjører piloten (uten Vercel Cron)": still true, so README stays as it is. Its "Utvikling" section never names a host (AC3).
- Read-only Vercel facts (2026-11-23): project `toppsvar`, Git repository `IBE160-2026/G101-alfnes-sarjomaa`, production branch `main`, framework Next.js, Node.js 26.x. Production variables: `DATABASE_URL` (Neon integration, with a separate `DATABASE_URL_UNPOOLED`), `OPENROUTER_API_KEY`, `APP_BASE_URL` and the Neon integration's own variables; no `REGISTRATION_CODE`, no `CRON_SECRET`. Preview: only `DATABASE_URL`, marked sensitive (its value cannot be read back), and no key. Preview deployments answer 302 to Vercel's login, so they are not public.

## Tasks & Acceptance

**Execution:**
- `tests/manual/checklist.md` -- add a "Pilot (NFR-2, Story 7.5)" section after "Fresh clone" with P1 (AC1 configuration, migration step and daily Cron), P2 (AC2 a Game on real phones to final Scores, Grouping under 300 s) and P3 (AC3 the README's local path names no host, and a cut is stated with its reason); Result and Date empty; one "Supporting evidence, not a result" paragraph with the read-only findings and what is missing; one short "How to migrate the pilot" note. Update the SM-1 open items and the slip-list bullet -- the manual ACs need a place where a person records them.
- `tests/TRACE.md` -- NFR-2: replace the README-only bullet with one naming `tests/manual/checklist.md` rows P1 to P3 -- trace points at the proof.
- `ARCHITECTURE-SPINE.md` -- AD-24: one "Amended in Story 7.5" bullet: `vercel.json` pins the functions to `fra1`; `CRON_SECRET` and the Cron are not set yet, purge on the pilot runs only from Host requests until the group adds them, and if they are missing at the freeze the scheduled expiry slips (PRD §6.5). AD-23: point its Cron sentence at that bullet -- the spine must not claim what the pilot does not run.
- `.docs/implementation-artifacts/sprint-status.yaml` -- `7-5-pilot-deployment-first-to-cut: done`; `epic-7` stays `in-progress`.

**Acceptance Criteria:**
- Given the checklist, when a group member opens it, then P1 to P3 exist with the story's three checks, empty Result cells, the evidence gathered, and the missing Cron named as open.
- Given `npm run test`, when it runs offline, then `tests/unit/trace.test.ts` stays green and the NFR-2 section names the checklist rows.
- Given the spine, when AD-23 and AD-24 are read, then neither claims a running Cron or a set `CRON_SECRET`, and `vercel.json`'s region is named.
- Given the repository, when searched, then no environment value, secret, org ID or preview URL was added.

## Spec Change Log

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 30 findings — high 0, medium 3, low 20, false 7, maybe-false 0
- findings:
  - Verification gap layer: no gaps reported.
  - `[low]` `[patch]` Edge: the migrate note says only `postgres://` works, but `src/server/db/client.ts:51` also accepts `postgresql://`, Neon's scheme — the note now names both.
  - `[medium]` `[patch]` Edge: an unset or mistyped exported `DATABASE_URL` falls back to `.data/local`, so production is silently not migrated — the note says so and asks the reader to check that `${DATABASE_URL%%:*}` prints `postgres` or `postgresql` first.
  - `[low]` `[patch]` Edge: the note did not say which Neon URL to use — it now says to use `DATABASE_URL_UNPOOLED` (direct) for the migration run, while the app keeps the pooled one.
  - `[low]` `[patch]` Edge: step 3 proved only the 401 and the listing, not a real Cron call — added "Run" on the Cron Jobs page with 200 `{"status":"ok"}` in the function log.
  - `[medium]` `[patch]` Edge: Preview's `DATABASE_URL` is sensitive and unreadable, so nobody has confirmed previews use PGlite — P1 now checks it (re-enter it if unsure), and "Still open" names it.
  - `[low]` `[patch]` Edge: P1 left out AC1's "no code difference from the local build" — added to P1.
  - `[low]` `[patch]` Edge: P3 covers NFR-1 but only NFR-2 cited it — NFR-2 now names P1 and P2, and NFR-1 has a bullet for P3.
  - `[low]` `[reject]` Edge: 7-5 is `done` while P1 to P3 have no result and the Cron is missing — the invocation explicitly orders "set 7-5 done". The open rows are recorded in the checklist's SM-1 list and reported to the orchestrator as a decision to check.
  - `[low]` `[reject]` Edge: the spec's Code Map repeats the `postgres://`-only claim — the fix is an edit to this build's spec, which triage rejects. The tracked checklist, where readers act on it, is patched.
  - `[low]` `[reject]` Blind: the story is marked done before it was checked — same as the Edge row above; the invocation directs it.
  - `[low]` `[patch]` Blind: P1 leaves out "no code difference" and the amended preview setup — same root as the Edge rows; patched there.
  - `[low]` `[patch]` Blind: AD-24's preview claim is unverified and the diff did not say so — same root as the Edge preview row; patched in the checklist. AD-24 states the rule, and the checklist records that it is unconfirmed.
  - `[low]` `[patch]` Blind: wrong URL scheme in the migrate note — same root as the Edge row; patched.
  - `[low]` `[patch]` Blind: the note does not name the unpooled URL — same as the Edge row; patched.
  - `[medium]` `[patch]` Blind: `export DATABASE_URL=...` typed at the prompt writes the password into shell history — the note now uses `read -rs DATABASE_URL && export DATABASE_URL`.
  - `[low]` `[patch]` Blind: step 3 never shows the Cron runs — same as the Edge row; patched.
  - `[low]` `[patch]` Blind: P2 passes trivially if the OpenRouter credit is exhausted and Grouping falls back at once — P2's Result now notes whether Grouping ran live or fell back.
  - `[low]` `[patch]` Blind: P3 is not traced under NFR-1 — same as the Edge row; patched.
  - `[low]` `[patch]` Blind: "if the pilot is cut, these rows leave the SM-1 count" did not match the SM-1 rule ("moved to Stage 2") — both places now read "cut (moved to Stage 2 under PRD §6.5, and named so in the README)".
  - `[low]` `[patch]` Blind: the AD-24 amendment was undated, and the diagram label "(not set up yet, see AD-24)" put transient status into the diagram — the bullet is dated 2026-11-23, and the label is back to `Vercel Cron daily`.
  - `[low]` `[patch]` Blind: the evidence paragraph did not say who ran the probes — it now opens "Read-only checks run by the AI on 2026-11-23". It was not split into bullets, since one paragraph matches the F1 and T-row evidence style.
  - `[low]` `[reject]` Intent: the diff adds no rerunnable check, only prose — AC1 to AC3 are tagged manual in `epics.md`, and the project keeps manual checks as checklist rows. P1's closing steps name the probe to repeat. A smoke script would be new code nobody asked for.
  - `[low]` `[reject]` Intent: `done` on the tracking surface while acceptance stays open — duplicate of the Edge status row; the invocation directs it.
  - `[false]` `[reject]` Intent: the diff amends the spine instead of following it — the spine's own delivery rule says "A departure from this spine amends it in the same PR". The pilot departs (no `CRON_SECRET`), so recording it is following the spine.
  - `[false]` `[reject]` Intent: AC1 preconditions are resolved in favour of AD-24 — AD-24's 2026-11-23 amendment is a later group decision that explicitly supersedes "previews disabled", and the epic context says it "overrides the 7.5 story text". The unverified preview value is handled by the patched Edge row.
  - `[false]` `[reject]` Intent: the migration is a manual step and the schema's existence is inferred — AC1 asks for "an explicit deploy step", which a manual `npm run db:migrate` is. A played round in production cannot happen without the tables, so the inference is sound.
  - `[false]` `[reject]` Intent: the README says nothing slipped while the checklist says the Cron is open — README line 174 already says the pilot runs "uten Vercel Cron", and the checklist's SM-1 list requires the README Status to be updated at the freeze. The two places do not contradict each other.
  - `[false]` `[reject]` Intent: the group's steps live in a tracked file — they are also in the run report. A manual check without its procedure would be worse.
  - `[false]` `[reject]` Intent: the review section was empty — the diff was taken mid-run, before this log was written.
  - `[false]` `[reject]` Intent: the rules about README, paths, names, secrets and production hold — this is a confirmation, not a defect.

### Rejected or corrected AI suggestions

- The implementation subagent changed the spine diagram label to "Vercel Cron daily (not set up yet, see AD-24)" without being asked. Review found it puts transient status into the architecture diagram, so the label was reverted.
- The subagent's first migrate note said "export the production URL" in the shell. That would put the database password in shell history and did not name the direct URL. It was corrected to `read -rs` with `DATABASE_URL_UNPOOLED` and a scheme check.
- The subagent proposed the Cron schedule `0 3 * * *`. It was kept as a suggestion for the group. Hobby allows one run a day at any hour, so the hour does not matter.
- The orchestrator considered adding the `crons` entry to `vercel.json` in this story. It was rejected because the entry registers a Cron on the next production deploy, and production changes were reserved for the group.
- The orchestrator considered checking Preview's `DATABASE_URL` by pulling the Preview environment into a scratch file, printing only its scheme and then deleting the file. Vercel returned the value as sensitive, so the check could not be done. It went to the group as part of P1.

## Design Notes

**Why no `crons` entry in this story.** Adding it to `vercel.json` registers the Cron on the next production deploy from `main`, which is a production change the orchestrator kept for the group. Without `CRON_SECRET` the route answers 404 anyway, so the entry alone would do nothing. The exact steps go to the group in the run report and in P1.

**Why the checklist, not a new runbook file.** The project already keeps every manual check in `tests/manual/checklist.md` with Result and Date, and the SM-1 gate reads from there. A second place would drift.

## Verification

**Commands:**
- `npm run test` -- expected: all pass, trace test green.
- `npm run lint`, `npm run typecheck`, `npx prettier --check tests/manual/checklist.md tests/TRACE.md` -- expected: clean.
- `git diff --stat` -- expected: only the four files above plus this spec.

## Auto Run Result

Status: done

**Summary.** The pilot at the pilot address was already live. This story records it in the repository and changes nothing in production. A "Pilot (NFR-2, Story 7.5)" section in the manual checklist holds rows P1 to P3 for AC1 to AC3, with empty Result cells for a person to fill in. Beside them are the read-only evidence, a safe way to migrate the pilot, and the three steps that close P1. The spine now states what the pilot runs: `fra1` through `vercel.json`, and no `CRON_SECRET` or Cron yet. The trace points at the rows.

**Files changed:**
- `tests/manual/checklist.md`: adds the Pilot section (P1 to P3, evidence, migrate note, steps to close P1), plus a new SM-1 open item and an updated slip-list bullet.
- `tests/TRACE.md`: the NFR-2 bullet names P1 and P2, and a new NFR-1 bullet names P3.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md`: AD-23's Cron sentence now says the Cron does not run yet. AD-24 loses "`CRON_SECRET` stays set" and gains a dated Story 7.5 bullet.
- `.docs/implementation-artifacts/sprint-status.yaml`: `7-5` is `done`. `epic-7` stays `in-progress`.
- `.docs/implementation-artifacts/spec-7-5-pilot-deployment-first-to-cut.md`: this spec.

**Review findings.** 30 findings. 20 were patched: 3 medium, covering shell history, the unverified Preview URL and the silent PGlite fallback, and 17 low. 0 were deferred. 10 were rejected: 3 low and 7 false, each with its reason in the triage log. 7 of the patched findings were duplicates of others.

**Follow-up review: recommended.** Three medium findings were patched. The risk not yet checked is that the steps for the group have never been run against the real project: pressing "Run" sends the secret, `db:migrate` works over `DATABASE_URL_UNPOOLED`, and the `crons` entry registers on Hobby.

**Verification.**
- `npm run test`: 805 passed, 1 skipped, both before and after the patches.
- `npm run lint`: clean.
- `npm run typecheck`: clean.
- `npx prettier --check tests/manual/checklist.md tests/TRACE.md`: clean.
- Read-only probes of the pilot:
  - `/api/health` answers 200 ok, routed through `fra1`.
  - `/api/purge` answers 404 `disabled`.
  - A preview deployment answers 302 to Vercel's login.
- Vercel, read-only, names only:
  - `vercel env ls`: Production has no `CRON_SECRET` and no `REGISTRATION_CODE`. Preview has only `DATABASE_URL`, which is sensitive.
  - `vercel project inspect`: the Git repository is connected and the production branch is `main`.
  - `vercel ls`: every deployment is Ready.

**Residual risks.**
- AC1 is not met until the group adds `CRON_SECRET` and the Cron.
- AC2 (real phones) has not been run.
- Nobody has confirmed that Preview's `DATABASE_URL` is PGlite.
- If these are still open at the freeze, the README must state the scheduled expiry as slipped (PRD §6.5).
