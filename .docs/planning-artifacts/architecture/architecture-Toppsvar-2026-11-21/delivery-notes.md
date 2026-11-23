---
title: Toppsvar architecture delivery notes
companion-of: ARCHITECTURE-SPINE.md
status: final
created: 2026-11-21
updated: 2026-11-22
---

# Delivery notes for the Toppsvar architecture

This companion holds what the course's examiner and the README need, and what the spine points to without binding builders. Rules live in `ARCHITECTURE-SPINE.md`; nothing here overrides it.

## Grouping cost and time (PRD §6.2)

Assumptions: `deepseek/deepseek-v4.1-flash` on OpenRouter at USD 0.05 per million input tokens and USD 0.20 per million output tokens (changed from `claude-haiku-5-5` on 2026-11-22; the group has an OpenRouter key); one partition call per Question over distinct normalised Answers; about 14 tokens per item including JSON overhead; a prompt of about 700 tokens; 2 to 4 output tokens per item for the assignment array (up to 3 digits and a comma), with reasoning disabled by `reasoning: { effort: "none" }`. `max_tokens` is a flat 2,048 on every call, a cap that is billed only for tokens actually produced. The token figures are estimates; the live 7-item smoke run with reasoning on (before the fix) used 19 content tokens, about 2 per item plus the wrapper.

| Game | Items per Question (max) | Judge calls | Tokens per call (in / out) | Cost | Wall time |
| --- | --- | --- | --- | --- | --- |
| Sizing: 30 Answer sets, 15 Questions, up to 5 Answers | 150 | 15 (at most 30 with retries) | about 2.8K / 0.6K | about USD 0.004 (worst case about 0.008) | expected about 30 s; at most 3 waves × 30 s = 90 s |
| Largest: 50 Invite links, 20 Questions, 5 Answers | 250 | 20 (at most 40) | about 4.2K / 1.0K | about USD 0.008 (worst case about 0.016) | expected about 40 s; at most 4 waves × 30 s = 120 s |
| Naive all-pairs, for comparison | n(n−1)/2 per Question | 167,625 (sizing) / 622,500 (largest) | — | — | not feasible |

The sizing Game's worst case is inside FR-15's two minutes. The largest Game's worst case is inside the 300 s Vercel Hobby limit. The ProtoQA evaluation set has at most 88 distinct raw answers per question, so `judge:eval` does not exercise the 150 to 250 item case. Hard ceiling: even if every call of the largest Game's 40 hit the 2,048-token cap, the cost stays under USD 0.03.

### Live measurements (2026-11-22, after `reasoning: { effort: "none" }`)

Run by the orchestrator with the group's key through `npm run judge:smoke` and `npm run judge:record` on synthetic Questions (inputs in the session scratchpad, outputs under the gitignored `.data/`). Every call reported `reasoning_tokens: 0`.

| Distinct items | Calls | Out tokens | Wall time | Result |
| --- | --- | --- | --- | --- |
| 7 (smoke) | 1 | 26 | 1.7 s | correct grouping, USD 0.00006 |
| 60 | 1 | 125 | 1.3 s | valid ruling |
| 120 | 1 | 245 | 1.3 s | valid, 30 groups, every one correct (30 dishes × 4 variants) |
| 180 | 2 | 437 / 389 | — | `INVALID_OUTPUT` both times, fell back |
| 240 | 2 | 645 / 405 | 6.7 s total | `INVALID_OUTPUT` both times, fell back |

Before the fix, the 7-item smoke run needed 2 calls because reasoning used all 92 output tokens of the old `64 + 4n` bound.

**Consequence.** Time is never the limit: 240 items took 6.7 s against the 30 s timeout. The limit is output reliability. The model returns a valid positional `assignments` array up to at least 120 distinct items and fails somewhere between 120 and 180. A Question above that falls back to manual grouping after 2 calls (about USD 0.0006), which FR-17 allows. The sizing Game (at most 150 raw Answers per Question, usually far fewer distinct after normalisation) is normally below the limit; only a Question in the largest Game where almost every Answer is different reaches it. `shortcut: positional output fails above ~120-180 distinct items; if real Games hit it, split large Questions into chunks or ask for groups instead of a positional array.`

### Pilot measurements (2026-11-23, production)

Run by the orchestrator with a Playwright script against https://toppsvar.vercel.app (Neon Postgres in `fra1`, live Judge), one fictional Game of 5 Questions and 5 Answer sets, timed from the click until the UI settled. Grouping of all 5 Questions took 18.9 s with no fallback. Collection close, including `VACUUM (FULL, SKIP_LOCKED)`, logged no error or skip.

| Host action | Functions in `iad1` | Functions in `fra1` |
| --- | --- | --- |
| Merge two Groups | 5.3 s | 0.82 s |
| Rename | 3.3 s | 0.29 s |
| Discard | 3.8 s | 0.31 s |
| Mark reviewed | 3.3 to 3.9 s | 0.81 to 0.83 s |
| Lock the Board, including the redirect to the Game page | 6.3 s | 1.18 s |
| Save a Question | 1.8 s | 0.18 s |

A second run after Epic 6 was merged (2026-11-23, 3 Questions, 5 Answer sets, 3 Teams) played a whole round in production. Grouping took 3.6 s with no fallback. Every play action (reveal, miss, undo, next Team, next Question, reload of the stage) took 3 to 786 ms; a reveal took about 280 ms. Board lock took 1.22 s, and registration and Game creation took 1.3 to 1.4 s. The Scores matched the scored Counts at every check.

**Consequence.** NFR-5 failed by a factor of 3 to 6 while the functions ran on another continent from the database, because every action makes several round trips. `vercel.json` now pins the functions to `fra1`, next to Neon. Only Board lock is slightly above one second, and that figure includes the navigation it triggers.

## README contract

The README covers the sensorveiledning checklist:

- **What and for whom:** what the app does and who it is for, with a screenshot in `docs-assets/`.
- **Prerequisites:** Node.js 22.13 or newer (tested on 22 and 26) and git. No database to install.
- **Install and start:** the three commands `git clone`, `npm install`, `npm run demo`, plus the printed demo login.
- **Environment:** the variable table from AD-21, which says that the app runs without any key and that `OPENROUTER_API_KEY` switches on the live Judge. `.env.example` is the template.
- **Tests:** `npm test`, and `npx playwright install chromium` once followed by `npm run test:e2e`. Also `npm run judge:eval`.
- **Structure and links:** the folder overview, with links to `.docs/` (brief, PRD, UX, this architecture), `wiki/` and `prompting/`.
- **Stage 2:** what Stage 2 left out and why, every Stage 1 cut, with the reason, the outcome of the PRD §6.5 slip list (what slipped, or that nothing did), and the SM-2 figure with every prompt version and model tried.
- **Anonymity limits.** Nobody can see who wrote an Answer. Then name who can see what:
  - The Host reads every Answer as written, and writing style is not anonymised.
  - Before close, a DB operator could correlate a link's hash with its Answer set.
  - After close, the database's write-ahead log, freed disk pages and the provider's point-in-time history can still hold deleted rows for a while.
  - Between close and Board confirmation, how many Answers a person gave per Question could link their Answers across Questions. Keys and ranks are cleared at confirmation.
  - With live Grouping on, Answer texts are sent to the model provider.
  - The pilot host's access logs record IP addresses and times (never the Token).
  - The minimum of three Answer sets protects against a curious Host, not one who answers through links they keep.
  - Answers can be read only on the device that submitted them, so changing Answers from another device means starting over.
- **Deletion:** retention runs only while the app is running. The pilot database is deleted when the course ends.

## Departures from proposal.md

| proposal.md | Now | Governed by |
| --- | --- | --- |
| Supabase Postgres, Row-Level Security, Supabase Auth | PGlite locally, any Postgres when deployed; ownership checks in code; in-app scrypt auth | AD-2, AD-5, AD-6 |
| REST route handlers per resource | Server Actions; three Route Handlers (health, purge, report) | AD-17 |
| `SubmissionToken`, and `submission_token_hash` on Answers | `invite_link` and `submission` until close; Answers carry only a random Contributor key, cleared at confirmation | AD-8 to AD-10 |
| Stored `member_count` and `Team.score` | Count and Score derived when read; frozen in `board_slot` at confirmation | AD-11, AD-15 |
| Next.js 15, Claude Haiku 4.5 | Next.js 16.4, `deepseek/deepseek-v4.1-flash` via OpenRouter | Stack, AD-13 |
| Preset tables in the main schema | Stage 2, through `board_slot` | AD-15 |
| shadcn/ui, drag-and-drop Review | UX: no UI library; list-based Review | `DESIGN.md`, `EXPERIENCE.md` |

## Stage 1 cut order

The binding slip list is PRD §6.5 (amended 2026-11-23). This order mirrors it. If time runs short, cut in this order:

1. The pilot deployment, the CI Postgres job and Vercel Cron.
2. `judge:eval --live` (live regeneration of the rulings, FR-32) and SM-4.
3. End-to-end breadth beyond the required specs.

Never cut AD-4, AD-7 to AD-10, the replay demo, the network-free tests or the README. The README states every cut.

## Process traces

- One branch and one PR per epic.
- `.github/pull_request_template.md` asks three things: whether AI output was corrected or rejected, whether the code departs from the spine or PRD, and whether any text comes from `.idea/`.
- A departure from the spine amends the spine in the same PR.
- `scripts/make-zip.sh` builds the hand-in with `git archive HEAD`, so untracked `.env.local`, `.idea/` and `.data/` never ship.
