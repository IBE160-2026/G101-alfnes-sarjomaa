---
title: 'Story 5.1: Review screen with ranked Groups, Counts and raw Answers'
type: 'feature'
created: '2026-11-23'
baseline_revision: '71d6106b309989c921bbbbea289727c042b89550'
status: 'done'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-5-context.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The chip spelling chosen on a tie between written forms is not pinned by an integration case.
    evidence: |-
      collapseChips keeps the first form in SQL order (normalized_text, then text); every fixture has a clear winner by count, so dropping asc(answer.text) would pass. Cosmetic, ties only. Add a two-form tie case with 5.2's merge tests.
    location: >-
      src/server/review/index.ts (answers orderBy)
    severity: low
  - summary: >-
      Several AC3 and AC4 states are proven by server render, not e2e.
    evidence: |-
      The e2e server runs replay with no key and no data/rulings, so it can only produce NO_KEY one-chip Groups; NO_STORED_RULING, Judge failure, Demo mode, no fallback, multi-chip cards, Forkastet and the reviewed header are rendered with renderToStaticMarkup in review.test.ts. Extend the e2e when 5.2-5.5 writers and Epic 7's demo rulings exist.
    location: >-
      tests/e2e/review.spec.ts
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** A Game in *in review* is a dead end: the Game page shows a summary with no way forward (the 4.4 `shortcut:` in its *in review* panel), and there is no screen where the Host can read each Question's Groups, Counts and raw Answers before anyone plays (FR-16, FR-17, FR-19).

**Approach:** Add `src/lib/ranking.ts` (`defaultLabel`, `rankGroups`, `boardCut`), a `review.load` read in a new `src/server/review` module that returns one Question's Groups with SQL-aggregated Counts and no linking column, and the server-rendered page `/spill/[id]/gjennomgang` laid out per `EXPERIENCE.md` → Surface: Review. The *in review* Game page gains the primary link "Gå til gjennomgangen".

## Boundaries & Constraints

**Always:**
- Start with `ponytail` (full). Before UI edits, `impeccable` ("Launcher unavailable" path) and `reference/craft-floor.md`. `DESIGN.md`/`EXPERIENCE.md` win on conflict. Operate mode: precision and restraint. WCAG 2.1 AA, 44 px targets, literal bokmål from the UX contract.
- Schema (decision 7: placement by first consumer): `question.reviewed boolean not null default false`, `answer_group.custom_label text` (nullable) and `answer_group.discarded boolean not null default false`. This story only reads them; 5.2 to 5.5 write them. One generated, committed migration.
- Ranking (AD-11): rows `{ groupId, count, rank1Count, labelCandidates: { text, count }[], customLabel?, discarded? }`. Order: Count desc, rank-1 count desc, label under `Intl.Collator('nb', { sensitivity: 'base' })`, then `groupId`. Default label: the candidate with the highest count, ties by shortest, then code-unit order; cut to 40 characters at a word boundary (hard cut when the first 40 hold no space). Effective label `customLabel ?? defaultLabel`. `boardCut` returns `{ board, below, discarded }`: the first `BOARD_SIZE = 8` non-discarded ranked Groups, the other non-discarded ones, and the discarded ones, each in ranked order.
- `review.load(hostId, gameId, position?)` is an entry point under `withBoundary`: `games.getOwned` (missing, foreign, malformed = `NOT_FOUND`), `WRONG_STATE` unless *in review*. Returns the Game title, every Question `{ id, position, text, reviewed, fallbackReason }` by position, and the current Question (the requested position, else the first unreviewed, else the first) with `{ board, below, discarded }` of `{ id, label, count, chips: { text, n }[] }`. Count = `count(distinct contributor_key)`, rank-1 count and label candidates are SQL aggregates; Answers are selected ordered by `normalized_text`, then `text`. No query result or DTO field holds `contributor_key` or `rank`.
- Chips: Answers of one Group with equal `normalized_text` collapse to one chip, `text` = its most common written form (ties: the first in the SQL order), `n` = Answers; chips keep the SQL (alphabetical) order.
- Page `/spill/[id]/gjennomgang?q=N`: `NOT_FOUND` → `notFound()`; `WRONG_STATE` → `redirect('/spill/[id]')`. Breadcrumb `Mine spill › {title} › Gjennomgang`; one `<h1>` (visually hidden, "Gjennomgang"). Layout and copy exactly as `EXPERIENCE.md` → Review anatomy and Responsive: rail 288 px at ≥1280, 240 px at 1024–1279, a GET `<form>` with a labelled `<select>` ("Spørsmål N av M – Gjennomgått/Ikke gjennomgått") and a "Vis" button above the main pane below 1024 (no navigation on change, WCAG 3.2.2) with "Lås brettet" at the page foot, and below 768 also `notice-info` "Gjennomgangen er laget for større skjerm. Den virker her, men blir trang."
- Fallback Notice (`notice-warning`, above the layout), from a pure function over the Questions and `env.DEMO_MODE`, shown while any fallback Question is unreviewed: not Demo mode and every Question fell back with `NO_KEY` → "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar."; otherwise `NO_KEY` and `NO_STORED_RULING` Questions → "Det finnes ingen lagret avgjørelse for spørsmål {N}, så det starter med én gruppe per ulikt svar." and `TIMEOUT`/`ERROR`/`REFUSAL`/`INVALID_OUTPUT` → "Dommeren fikk ikke gruppert spørsmål {N}. Det starter med én gruppe per ulikt svar.", with {N} an `Intl.ListFormat('nb')` list and "de" for several. Never the key sentence in Demo mode, for `NO_STORED_RULING`, or when some Question has Judge Groups.
- "Lås brettet" (primary, rail foot) is `aria-disabled` with "Gjennomgå alle spørsmålene først (N igjen)." as visible `body-sm` text tied by `aria-describedby`.
- Game page *in review*: the primary link "Gå til gjennomgangen" under the summary; the `shortcut:` comment goes.
- Test titles carry FR/UX-DR/NFR IDs; rows in `tests/TRACE.md`; a foreign-Host case for `review.load` and the page in `authz.test.ts`; `tests/integration/review.test.ts` (AD-22 named file); offline, no key, no real names.

**Never:**
- No `contributor_key` or `rank` in any DTO, prop or rendered HTML; no confidence or threshold signal; no Answer order other than alphabetical (FR-12, FR-13, FR-19).
- No mutation, Server Action or writer in this story; no checkboxes, overflow menu, SelectionBar, rename field or "Angre forkasting" (5.2 to 5.4 bring them with their operations: no dead controls).
- No client data library, no new Route Handler, no `onChange` navigation.
- Do not touch `.env`, `.logs/`, `prompting/`; never run `judge:smoke`/`judge:record`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nine Groups | Question with 9 non-discarded Groups | 8 under "På brettet (8 grupper)", divider, "Ikke på brettet (1 gruppe)" with dashed cards and its sentence | — |
| ≤8 Groups | 3 Groups | "På brettet (3 grupper)", no divider, no *Ikke på brettet* | — |
| Discarded | a Group with `discarded = true` | under "Forkastet (1 gruppe)": struck label, Answers as plain text; never on the Board | — |
| Custom label | `custom_label = 'X'` | label "X" ranks and shows as X | — |
| Singleton | one chip, label = normalised chip text | compact 52 px row, no chip row | — |
| Duplicates | "Kari", "kari", "Kari" in one Group | chip "Kari · 3 svar" | — |
| Bad `q` | `?q=abc`, `?q=99` | first unreviewed Question (else Question 1) | — |
| Foreign / missing Game | Host B, random UUID, `abc` | bokmål 404, same for all | `NOT_FOUND` |
| Wrong state | Game in *draft*, *grouping*, *ready* | redirect to `/spill/[id]` | `WRONG_STATE` |
| No fallback | every Question grouped by the Judge | no warning Notice | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- add the three columns; `npm run db:generate` writes `drizzle/0009_*.sql`.
- `src/lib/limits.ts` -- `BOARD_SIZE = 8`, `LABEL_MAX = 40`.
- `src/lib/ranking.ts` (new) -- pure ranking; `src/lib` may not import server code (ESLint zone).
- `src/lib/review.ts` (new) -- pure `collapseChips(answers)` and `fallbackNotice(questions, demo)`.
- `src/server/review/index.ts` (new) -- `load`; may import `games`, `questions`, `grouping`, db (ESLint MODULES order: review is after grouping and collection). Reads cross-table like `grouping.summary` does.
- `src/server/games/index.ts:80` -- `getOwned` returns `{ title, state, … }`, throws `NOT_FOUND`.
- `src/server/boundary.ts` -- `withBoundary(module, op, fn)`.
- `src/app/spill/[id]/page.tsx:178` -- *in review* panel with the `shortcut:` to resolve.
- `src/app/spill/[id]/gjennomgang/page.tsx`, `loading.tsx` (new) -- the screen; loading is "skeleton rail + three skeleton cards", no `<h1>`.
- `src/components/GroupCard.tsx` (new) -- presentational card: normal, compact, below-the-line (dashed, sunken) and discarded looks.
- `src/components/HostChrome.tsx:52` -- children wrapper is `max-w-200` (800 px); Review needs the 1280 px host width: `has-[[data-wide]]:max-w-none`.
- `src/components/Button.tsx`, `Notice.tsx`, `CloseCollection.tsx` -- `aria-disabled` + `aria-describedby` reason pattern to copy.
- `tests/integration/report.test.ts:525` -- pattern for `renderToStaticMarkup(await Page({ params, searchParams }))` in integration tests; `next-mocks.ts` gives `RedirectError`/`NotFoundError`.
- `tests/integration/grouping.test.ts:140` -- `groupingGame` seeding pattern; mock Judge with reasons via `createMockJudge`.
- `tests/e2e/close.spec.ts` -- `collectingGame`/`submitAll` pattern to reach *in review* (replay, no key → every Question `NO_KEY`).

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts`, `drizzle/` -- columns + generated migration.
- `src/lib/limits.ts`, `src/lib/ranking.ts`, `src/lib/review.ts` -- pure logic.
- `tests/unit/ranking.test.ts`, `tests/unit/review.test.ts` -- AC1; chip collapse; every Notice branch incl. Demo mode, partial `NO_KEY`, plural lists, all reviewed.
- `src/server/review/index.ts` -- `load`.
- `src/app/spill/[id]/gjennomgang/page.tsx`, `loading.tsx`, `src/components/GroupCard.tsx`, `src/components/HostChrome.tsx` -- the screen.
- `src/app/spill/[id]/page.tsx` -- "Gå til gjennomgangen", drop the `shortcut:`.
- `tests/integration/review.test.ts` -- AC2 DTO shape and aggregates; rendered page for NO_KEY, NO_STORED_RULING, a failure reason, Demo mode and no fallback (AC4); sections, divider, compact row, chips, no confidence words (AC3 render); redirect for wrong state.
- `tests/integration/authz.test.ts` -- Host B, random UUID and `abc` → `NOT_FOUND`/`notFound()`, and the Review page's `generateMetadata` resolves to `{ title: "Vi finner ikke dette spillet" }` for all three (no title leak, AD-5).
- `tests/integration/review.test.ts` (in addition) -- a compact row with duplicates ("Kari", "kari", "Kari") renders the label "kari" followed by "Kari · 3 svar"; a renamed singleton whose raw Answer equals the custom label shows it once; the *Forkastet* card lists its raw Answers as plain text and is never a compact row; with `?q=2` the narrow-screen `<select>` has `option value="2"` selected; "Lås brettet" is outside the rail's `nav`.
- `tests/e2e/review.spec.ts` -- AC3/AC5 on a real Game (3 sets, 9 distinct normalised Answers, at least one written in two cases, replay without key) at 1280/1100/900/700, the raw written form with "· N svar" visible in a compact row, the NO_KEY Notice, axe, "Gå til gjennomgangen", redirect from a *collecting* Game.
- `tests/TRACE.md`, `sprint-status.yaml` -- rows; 5-1 done, epic-5 in-progress.

**Acceptance Criteria:** the five ACs of Story 5.1 in `epics.md` are the contract; the matrix above adds the edge cases. AC4's `NO_STORED_RULING`, failure and no-fallback cases are proven by rendering the page in `review.test.ts`, because the e2e server (replay, no key, no rulings) can only produce `NO_KEY`; the e2e proves the `NO_KEY` sentence end to end.

## Spec Change Log

### 2026-11-23 — Loop 1 (bad_spec)
- **Trigger:** review found that a one-chip Group showed only the normalised label ("kari") and hid the raw written form "Kari" and "· 3 svar", contradicting the matrix row "Duplicates → chip 'Kari · 3 svar'" and FR-19's raw Answers. The Design Notes had prescribed a `normalize()` comparison, which caused it; the same rule printed "Kari Kari" for a Group renamed to its own Answer.
- **Amended:** Design Notes → compact row now compares raw strings and always shows "· N svar" when n > 1; new "Rail landmark" note; Tasks → extra integration assertions (compact duplicates, renamed singleton, *Forkastet* Answers, selected `<option>`, lock outside `nav`), `generateMetadata` NOT_FOUND title in `authz.test.ts`, e2e with a two-case Answer.
- **Known-bad state avoided:** the Host reviewing a no-key Game (the examiner's path) never sees what Participants actually wrote; a foreign Review title path and a narrow-screen select default without tests.
- **KEEP:** the first pass is saved, complete and green (612 Vitest, 87 Playwright, lint, typecheck, prettier, drizzle-kit check), at `/private/tmp/claude-501/-Users-sondrealfnes-Documents-Molde-G101-alfnes-sarjomaa/258230a0-8f31-4584-b053-8d512f592f5b/scratchpad/pass1-implementation.patch` (applies cleanly to the baseline with `git apply`). Re-derive by applying it, then change only what this entry amends. Keep: the schema and migration `0009`, `src/lib/ranking.ts`, `src/lib/review.ts` (`collapseChips`, `fallbackNotice` with the partial-`NO_KEY` rule), `review.load` and its queries, the page layout, breakpoints, copy and GET select, `HostChrome`'s `has-[[data-wide]]`, the loading skeleton, the Game page link, the existing tests and TRACE rows, and `sprint-status.yaml`.

## Review Triage Log

### 2026-11-23 — Review pass
- verdicts: 33 findings — high 0, medium 5, low 16, false 10, maybe-false 2
- findings:
  - `[false]` `[reject]` Edge: an *in review* Game with zero Questions crashes `review.load` — Invite links need at least one Question (`QUESTIONS_REQUIRED`) and Questions freeze after *draft*, so such a Game cannot reach *in review*.
  - `[false]` `[reject]` Edge: a current Question with no Groups shows an empty pane — close needs ≥3 Answer sets that each answer every Question, and Groups are deleted only when emptied (5.2+), so a Question always has Groups.
  - `[low]` `[reject]` Edge: chip order follows the DB collation, so æ/ø/å may differ between PGlite and deployed Postgres — the spine (AD-10) prescribes SQL order by `normalized_text, text`; only the relative order of æ/ø/å chips can differ, and a JS re-sort is added code for a cosmetic difference.
  - `[low]` `[reject]` Edge: `defaultLabel` cuts UTF-16 code units and can split an emoji at character 40 — needs an Answer over 40 code units with an astral character exactly at the cut; 5.4's zod `max(40)` also counts code units, so changing only this side would make the two disagree.
  - `[false]` `[reject]` Edge: an empty or whitespace `custom_label` renders an empty heading — nothing writes `custom_label` yet, and 5.4's writer accepts only 1–40 characters (AC1 of 5.4).
  - `[low]` `[bad_spec]` Edge: `normalize()` at render time can disagree with the stored `normalized_text` — grouped with the compact-row entry; the amended rule compares raw strings, so `normalize()` leaves `GroupCard`.
  - `[low]` `[reject]` Edge (claim): "40 characters" measured in code units — same as the emoji finding above.
  - `[low]` `[reject]` Edge (claim): "alphabetical" depends on the server locale — same as the collation finding above.
  - `[medium]` `[bad_spec]` Gap: the Review page's `generateMetadata` NOT_FOUND title for a foreign, random and malformed id is untested (AD-5 title leak) — amended Tasks: assertion in `authz.test.ts`.
  - `[low]` `[bad_spec]` Gap: the *Forkastet* card's raw Answers are never asserted — amended Tasks: integration assertion.
  - `[low]` `[bad_spec]` Gap: the narrow-screen `<select>` is not checked to start on the current Question — amended Tasks: `option value="2"` selected with `?q=2`.
  - `[low]` `[defer]` Gap: the tie-break spelling of a chip (`asc(answer.text)`) is not pinned by an integration case — cosmetic on ties only; added to `deferred` for 5.2's merge tests.
  - `[medium]` `[bad_spec]` Blind: a one-chip Group shows only the normalised label and hides the raw written form and "· N svar" — verified in `GroupCard.tsx` (`normalize(chips[0].text) !== label`); on the no-key path every Group is one chip, so the Host never sees what was written. Root cause: the spec's Design Notes. Amended the compact-row rule.
  - `[medium]` `[bad_spec]` Blind: the raw-text check compares a normalised chip with a raw custom label, so "Kari" renamed "Kari" shows twice — same root cause; fixed by the same amendment.
  - `[low]` `[reject]` Blind: "Marker som gjennomgått" and "Lås brettet" are `aria-disabled` without a reason — deliberate transitional state recorded in Design Notes; the epic branch merges to `main` only after 5.5 makes both work, so no user meets it.
  - `[medium]` `[bad_spec]` Blind: `generateMetadata` has no test — same as the gap finding above.
  - `[false]` `[reject]` Blind: `review.load` crashes on zero Questions — same refutation as the edge finding.
  - `[maybe-false]` `[reject]` Blind: the three reads in `groupsOf` are not one transaction — no writer exists in 5.1; with 5.2+ a race needs a second tab writing mid-render and the next render corrects it, so even if true it is `low`. Settled by a concurrent-write test once 5.2 exists.
  - `[low]` `[reject]` Blind: `defaultLabel` counts code units — same as the emoji finding.
  - `[false]` `[reject]` Blind: sprint-status says done while the spec says in-review — the spec reaches `done` at Finalize in this same run, before the commit.
  - `[false]` `[reject]` Blind: a partial replay hit is not flagged as fallback — per AD-12 a partly covered Question has `fell_back = false` and did not fall back; FR-17's Notice is about fallen-back Questions.
  - `[false]` `[reject]` Blind: the Notice still names reviewed fallback Questions — the sentences stay true for them, and the contract only says when the Notice disappears (all fallback Questions reviewed).
  - `[low]` `[reject]` Blind: breadcrumb markup and button-link classes are duplicated — two copies, no named divergence yet; a shared component is an unrequested abstraction.
  - `[low]` `[bad_spec]` Blind: "Lås brettet" sits inside the `nav` landmark — every screen-reader user meets it and the fix is a few lines; amended Design Notes ("Rail landmark") and Tasks.
  - `[low]` `[reject]` Blind: the e2e pins `rgb(133, 125, 140)` and 52 px — the house style already pins tokens (`FOCUS_RING`); a token change should fail the test.
  - `[low]` `[reject]` Blind: the loading skeleton has no placeholder for the narrow select — it appears only after 300 ms, and the shift is cosmetic.
  - `[low]` `[reject]` Blind: `cache()` misses on a repeated `?q=` — a second owner-checked read on a hand-made URL, no wrong output.
  - `[maybe-false]` `[defer]` Intent: AC3 (chips, *Forkastet*, reviewed state) and AC4 (`NO_STORED_RULING`, failure, Demo, no fallback) are labelled e2e but proven by server render — the e2e server (replay, no key, no `data/rulings`) cannot produce those states and no writer exists; if it matters it is `medium`. Settled by e2e once 5.2–5.5 writers and Epic 7's demo rulings exist; deferred.
  - `[medium]` `[bad_spec]` Intent: in the fallback path the written form never renders, only normalised labels — same root cause as the compact-row entry.
  - `[false]` `[reject]` Intent: `custom_label` and `discarded` added though 5.1's Columns line names only `question.reviewed` — AC1 consumes both (effective label, cut over non-discarded), so 5.1 is their first consumer under decision 7; no bad outcome.
  - `[low]` `[reject]` Intent: "Marker som gjennomgått" is inert — same as the transitional-controls finding.
  - `[false]` `[reject]` Intent: spec status contradicts sprint-status — same refutation as above.
  - `[false]` `[reject]` Intent: AD-15/AD-17 are cited but not exercised — no defect: 5.1 has no mutation, and its reads follow AD-17 (server component, no Route Handler).

### 2026-11-23 — Review pass (after loop 1)
- verdicts: 21 findings — high 0, medium 0, low 11, false 8, maybe-false 2
- findings:
  - `[false]` `[reject]` Edge: every Group discarded leaves an empty Board with no heading — nothing writes `discarded` in 5.1; the state becomes reachable with 5.4's discard, and 5.5 owns its rule (`NO_GROUPS_ON_BOARD` under "Marker som gjennomgått").
  - `[low]` `[reject]` Blind: the Spec Change Log names a local scratchpad patch path — the fix would edit this build's spec (rejected by rule); the path holds no secret, and the members' names are already public in the repo's own docs.
  - `[false]` `[reject]` Blind: spec status disagrees with sprint-status — carried: the spec reaches `done` at Finalize before the commit.
  - `[low]` `[patch]` Blind: no render test checks the page HTML for Contributor keys (FR-12) — patched: the nine-Groups render case reads the Question's 9 `contributor_key` values and asserts none is in the HTML.
  - `[low]` `[patch]` Blind: the DTO check matches `/contributor|rank/i` against Answer text, so an Answer like "Frank" would fail it — patched: the check now collects object keys with a `JSON.stringify` replacer.
  - `[low]` `[patch]` Blind: "every Answer under exactly one Group" summed `n` over `board` only — patched: a per-Group map of normalised text to count from board, below and discarded must equal the same map from the DB rows.
  - `[low]` `[patch]` Blind: accessible names run "Spørsmål N av M" into the Question text and the Question text into "✓ Gjennomgått" — patched: explicit `{" "}` in the header and before the rail status.
  - `[false]` `[reject]` Blind: empty Board has no state — same refutation as the edge finding.
  - `[low]` `[reject]` Blind: "Neste spørsmål" points to position + 1, not the next unreviewed — unreachable until 5.5 sets `reviewed`; the anatomy says "Neste spørsmål", and 5.5 (AC5) owns the reviewed header; below 1024 px the select still reaches every Question.
  - `[low]` `[reject]` Blind: the e2e never moves between Questions — no defect shown: navigation is plain `Link`/GET-form hrefs, asserted in `review.test.ts`; a second e2e Question costs a slower spec for framework behaviour.
  - `[false]` `[reject]` Blind: the page's `q` parsing is untested for "abc", "", "1.5" and arrays — every non-matching value yields no Question at that position, and `load` falls back to the first unreviewed Question, as the matrix requires.
  - `[low]` `[reject]` Blind: no logged-out test for Review — the spill layout redirects before the page, both catches rethrow non-`DomainError`s (`requireHost`'s redirect), and the layout's redirect is already tested.
  - `[maybe-false]` `[reject]` Blind: two-digit ranks may overflow the 28 px rank box — "10." in tabular 18 px digits is about 25 px; settled by a screenshot of a 40-Group fallback Question; if true it is `low` (cosmetic).
  - `[false]` `[reject]` Blind: `severity: medium (unverified)` is non-standard — that is the exact form this workflow prescribes for a maybe-false deferral.
  - `[maybe-false]` `[defer]` Intent: AC3/AC4 states proven by server render, not e2e — carried: already in `deferred`.
  - `[low]` `[reject]` Intent: inert "Marker som gjennomgått" and "Lås brettet" — carried: transitional, the epic merges after 5.5.
  - `[low]` `[reject]` Intent: compact row means "any one-chip Group" (C3) rather than "chip text equals label" (C1) — the shown content is the same (label plus raw form); C1 would make almost every fallback Group a full card and defeat the row's stated purpose (~2,100 px instead of ~3,400 px for 40 singletons). Decided in loop 1.
  - `[false]` `[reject]` Intent: the key sentence is dropped when only some Questions are `NO_KEY` — "alle spørsmålene" would be false there; the no-stored-ruling wording is true for `NO_KEY` too, and the carry-over forbids claiming no key beyond the facts.
  - `[low]` `[reject]` Intent: the Notice's disappearance after all fallback Questions are reviewed is only unit-tested — `reviewed` cannot be set until 5.5; the pure function is tested for that case.
  - `[false]` `[reject]` Intent: `custom_label` and `discarded` beyond the Columns line — carried: AC1 consumes them.
  - `[false]` `[reject]` Intent: spec status leftover — carried.

## Design Notes

- **Transitional controls.** AC3 requires "Marker som gjennomgått" in the header, but marking is Story 5.5. It renders `aria-disabled` with a `shortcut:` comment naming 5.5; the epic branch merges as one PR after 5.5, so `main` never ships it inert. Same for "Lås brettet" when nothing is left (impossible until 5.5).
- **Compact row** = one chip, not discarded. The raw Answer (`{text}`, plus " · N svar" when n > 1) follows the label in `body-sm ink-muted` whenever the chip's raw `text` is not identical to the label or n > 1. Compare the raw strings, never `normalize()` output: the default label is the normalised text ("kari"), so a normalised comparison hid the written form "Kari" and its "· 3 svar", which FR-19 requires the Host to read. With fallback grouping every Group has one chip, so the e2e sees only compact rows; multi-chip cards are covered by the integration render until 5.2's merge produces them in e2e.
- **Rail landmark.** The rail is a wrapper (`<div>`) holding the `<nav aria-label="Spørsmål">` (count and Question links) and, after it and outside the `nav`, the "Lås brettet" block, so a primary action never sits inside a navigation landmark.
- **Question navigation** is plain links (`?q=N`) and a GET form, so it works without JavaScript and keeps focus where the Host clicked.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- no errors.
- `npm run test` -- all green offline, no key.
- `npm run test:e2e` -- all green, axe clean on Review.
- `npx drizzle-kit check` -- migration consistent.

## Auto Run Result

Status: done

**Summary.** The Review screen exists at `/spill/[id]/gjennomgang`. `src/lib/ranking.ts` ranks Groups and cuts the Board (AD-11); `review.load` returns one Question's Groups with SQL-aggregated Counts and no linking column; the page follows `EXPERIENCE.md` (rail, *På brettet*, divider, *Ikke på brettet*, *Forkastet*, compact rows with the raw written form, GET select below 1024 px, narrow-screen Notice, reason-specific fallback Notice). The *in review* Game page links to it with "Gå til gjennomgangen", and the 4.4 `shortcut:` is gone.

**Files changed.**
- `src/server/db/schema.ts`, `drizzle/0009_demonic_edwin_jarvis.sql`, `drizzle/meta/*` -- `question.reviewed`, `answer_group.custom_label`, `answer_group.discarded`.
- `src/lib/limits.ts` -- `BOARD_SIZE`, `LABEL_MAX`.
- `src/lib/ranking.ts` -- `defaultLabel`, `rankGroups`, `boardCut`.
- `src/lib/review.ts` -- `collapseChips`, `fallbackNotice`.
- `src/server/review/index.ts` -- `load`.
- `src/app/spill/[id]/gjennomgang/page.tsx`, `loading.tsx` -- the screen and its skeleton.
- `src/components/GroupCard.tsx` -- normal, compact, below-the-line and discarded cards.
- `src/components/HostChrome.tsx` -- `has-[[data-wide]]:max-w-none` for the 1280 px host width.
- `src/app/spill/[id]/page.tsx` -- "Gå til gjennomgangen".
- `tests/unit/ranking.test.ts`, `tests/unit/review.test.ts`, `tests/integration/review.test.ts`, `tests/integration/authz.test.ts`, `tests/e2e/review.spec.ts`, `tests/TRACE.md` -- coverage.
- `.docs/implementation-artifacts/sprint-status.yaml` -- 5-1 done, epic-5 in-progress.

**Review findings.** Pass 1: 33 findings, one bad_spec loop (the compact row hid the raw written form; the lock sat inside `nav`; three missing assertions), 2 deferred, the rest rejected with reasons in the triage log. Pass 2: 21 findings, 4 low patches (HTML key check, key-based DTO check, per-Group Answer count, spaces in accessible names), 0 new deferrals, the rest rejected or carried with reasons.

**AI suggestions rejected or corrected (grading evidence).**
- Corrected (loop 1): the spec's own Design Notes told the implementer to compare `normalize(chip)` with the label, which hid what Participants wrote; reviewers caught it and the rule now compares raw strings.
- Corrected (pass 2): reviewer suggestions to add four test assertions and two spaces were applied as patches.
- Rejected: an empty-state for zero Questions or zero Groups (unreachable by the state machine), a JS re-sort with the nb collator (the spine prescribes SQL order), grapheme-aware label cutting (5.4's zod limit counts code units too), a read transaction around three selects (no writer yet), shared Breadcrumb/link components (unrequested abstraction), tolerance in pinned e2e tokens, and an empty-Board state (belongs to 5.4/5.5). Each reason is in the triage log.

**Follow-up review recommendation:** false. This pass patched four `low` entries and no `medium` or `high`.

**Verification.** `npm run lint` (exit 0), `npm run typecheck` (exit 0), `prettier --check .` (clean), `drizzle-kit check` (fine), `npm run test` 614/614, `npm run test:e2e` 87/87 including axe on Review at 1280/1100/900/700 px. All offline, no key, no live Judge call.

**Residual risks.** "Marker som gjennomgått" and "Lås brettet" are inert (`aria-disabled`, `shortcut:` comments) until 5.5, so the epic branch must not merge before 5.5. Several AC3/AC4 states are proven by server render only (deferred). Chip order follows the DB collation for æ/ø/å.
