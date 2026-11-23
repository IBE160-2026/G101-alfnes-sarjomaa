# 2026-11-21 — Epics og stories (subagent, `bmad-create-epics-and-stories`)

**Kontekst.** UX og arkitektur var ferdige og krysssjekket (se
`ux-designs/ux-Toppsvar-2026-11-21/reviews/consistency-review-2026-11-21.md`). Skillen er
interaktiv, med steg-filer og menyer. Gruppa delegerte beslutningene, så subagenten fikk
beskjed om å ta valgene selv der skillen ber brukeren velge, og logge dem. Orkestratoren
styrte størrelsen bevisst: faglærers `beergame` har 199 stories, men vi har ni dager og to
personer.

## Prompt

```
Run the BMAD epics-and-stories workflow for Toppsvar: invoke the Skill tool with skill
"bmad-create-epics-and-stories" and follow its step files in order.

There is no interactive user. The group has delegated product decisions (as it did for the
PRD on 2026-10-13). Wherever a step asks the user to confirm, choose from a menu or continue,
choose the option that best fits the PRD and architecture, continue without stopping, and
record each such choice in the epics document's frontmatter or a short "Decisions made during
breakdown" section. Never invent scope.

Project root: <prosjektrot>
Inputs (all final):
- PRD: .docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md (FR-7 amended 2026-11-21)
- Architecture: .docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md
  (+ delivery-notes.md); cite AD-n numbers in stories
- UX: .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md and EXPERIENCE.md
Output: .docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md (instructor's
convention in IBE160-2026/beergame). English.

Shape the breakdown for the real constraint: two developers, implementation 23 Nov - 1 Dec
(Stage 1 freeze), hand-in 5 Dec, built story by story by an AI developer agent.
- Stage 1 only as implementable epics. Put all Stage 2 FRs (FR-22, FR-28, FR-29, FR-33) in one
  final epic clearly marked "Stage 2 - only after SM-1 passes", with stories but no detail
  beyond acceptance criteria.
- Aim for roughly 25-35 Stage 1 stories. Each story should be one focused session for an AI
  developer: one coherent change with its tests, completable and committable on its own.
- Order epics so every epic ends with a runnable app increment, roughly: foundation (scaffold
  per the architecture's Structural Seed, DB, migrations, auth, Games and state machine, CI) ->
  Questions and Collection -> close and anonymity -> Grouping and the Judge -> Review -> Play ->
  Demo mode, Judge evaluation, README and fresh-clone check. Adjust if the architecture's
  dependencies say otherwise.
- Story 1.1 must leave a running, tested, linted skeleton with CI, so every later story only
  adds behaviour.
- Every acceptance criterion is testable (Given/When/Then), traces to the PRD's testable
  consequences (cite FR-n / NFR-n) and names the kind of test that proves it (unit,
  integration on PGlite, Playwright e2e, or manual checklist for FR-24 legibility / parts of
  NFR-6). Include an FR-coverage table showing every Stage 1 FR maps to at least one story.
- The anonymity guarantees FR-11..FR-13 and SM-3 get explicit test stories or ACs (schema and
  data inspection after close, Host-session test during collection).
- No story for anything the PRD does not require (no extra features, settings or
  abstractions). Accessibility, validation, error states and empty states from EXPERIENCE.md
  are part of the stories that build those screens, not separate polish stories.
- No real names anywhere (public repo).

Rules: do NOT git commit; write only inside the output folder (plus any memlog the skill
writes there). Finish with: the output path, the epic list with story counts, the FR coverage
result, and every decision you made on the user's behalf (max ~25 lines).
```
