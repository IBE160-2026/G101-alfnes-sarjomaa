# 2026-11-21 — UX og arkitektur kjørt headless, parallelt

**Kontekst.** Kullet var allerede i implementering, og det var 14 dager til innlevering. For å
spare tid kjørte orkestratoren (Claude Opus 5.5 i Claude Code) `bmad-ux` og `bmad-architecture`
som to parallelle subagenter i headless-modus, i stedet for to interaktive økter. Gruppa
delegerte beslutningene til KI, slik den gjorde med PRD-en 2026-10-13. Rammene for stacken ble
likevel bestemt av orkestratoren på forhånd og sendt inn som bindende føringer, så den
headless arkitekten ikke skulle finne opp en stack.

Under står promptene slik de ble sendt. Stiene til kjøremappene følger faglærers referanserepo
`IBE160-2026/beergame`, som kullsjekken samme kveld viste. Resultatet og hva som ble rettet etterpå, står i
`.memlog.md` i hver kjøremappe og i PR-en for `fase-3-planlegging`.

---

## Prompt 1 — UX (subagent, `bmad-ux` headless)

```
Run the BMAD UX workflow for the Toppsvar project in HEADLESS mode: invoke the Skill tool with
skill "bmad-ux" and treat this message as the headless payload (headless: true, intent: create).
Follow the skill's references/headless.md for the whole run. Do not ask questions; record
inferences as assumptions and real gaps as open questions.

Project root: /Users/sondrealfnes/Documents/Molde/G101-alfnes-sarjomaa

Driving inputs (read them):
- PRD (canonical, final): .docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md
- Brief + addendum: .docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/{brief.md,addendum.md}
- Instructor feedback: same folder, tilbakemelding-product-brief.md
- Grading rubric summary: wiki/kurs/sensorveiledning-del-1.md (criterion 4 Design: consistency,
  clear navigation, understandable feedback/errors/EMPTY STATES, WCAG basics, responsive, and
  visible design work such as sketches/wireframes)

Output: the skill's two documents DESIGN.md and EXPERIENCE.md in the run folder
.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/ (same convention as the
instructor's reference repo IBE160-2026/beergame).

Binding constraints:
- Artifacts in ENGLISH (project rule). All UI microcopy examples in NORWEGIAN bokmål (NFR-7).
- Three surfaces: (1) Participant answer form on a phone at 360 px, fully keyboard and
  screen-reader usable; (2) Host pages on a laptop, with Review (FR-19 to FR-21) as the most
  demanding screen: sketch it FIRST and in most detail (merge, move answers to new/other group,
  rename, discard, mark reviewed, confirm Board, groups below the Board limit, fallback notice);
  (3) Play view on a 1920x1080 TV, labels and scores >= 48 px, legible at 3 m, never shows raw
  answers or discarded groups.
- WCAG 2.1 AA contrast. Every screen needs its empty, loading and error states specified.
- Must NOT imitate the TV show the format resembles (name, look, branding; PRD 6.3).
- Anonymity notice <= 2 sentences (FR-14); progress shows "færre enn 3" until three (FR-8);
  the Host never sees which invite links were used.
- Decide the two PRD deferred items owned by UX: §10 item 2 (how Review surfaces answers near
  the Judge's threshold; Stage 1 needs nothing beyond FR-19) and item 5 (unsent drafts kept
  locally in the browser or not; must never reach the server before submit).
- Implementation is Next.js + Tailwind CSS: make DESIGN.md tokens map cleanly onto a Tailwind
  theme, and keep the component set small. Two developers have ~9 days to build all of Stage 1.
- Include lightweight wireframes (ASCII in the docs, or a simple static HTML mock file in the
  run folder) for Review, the answer form and the play view, as visible design evidence.
- No real names anywhere (public repo). Invented personas from the PRD are fine.

Rules: do NOT git commit, do not touch files outside your run folder. Finish with the
skill's JSON result, then a summary of at most 12 lines of the key design decisions.
```

## Prompt 2 — Arkitektur (subagent, `bmad-architecture` headless)

```
Run the BMAD architecture workflow for the Toppsvar project in HEADLESS mode: invoke the Skill
tool with skill "bmad-architecture" and treat this message as the headless payload
(headless: true, intent: create, altitude: initiative, purpose: build-substrate). Follow the
skill's references/headless.md for the whole run, including the full Reviewer Gate with its
parallel reviewer subagents.

Project root: /Users/sondrealfnes/Documents/Molde/G101-alfnes-sarjomaa

Driving inputs (read them):
- PRD (canonical, final): .docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md
- Brief + addendum + instructor feedback: .docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/
- proposal.md in the repo root (earlier stack, data model and risk thinking; not binding where
  it conflicts with the PRD, e.g. it assumes Supabase, which breaks NFR-1 locally)
- wiki/kurs/sensorveiledning-del-1.md (how the examiner grades: runs the app ONLY from the
  README on a clean machine in 15-20 min with no keys, runs the tests, checks the folder
  structure matches the architecture, wants linter/formatter, .env.example, .gitignore)

doc_workspace: .docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/
(same convention as the instructor's reference repo IBE160-2026/beergame). Artifacts in ENGLISH.

Binding decisions from the group (do not reopen; verify current versions on the web):
1. Next.js (App Router) + TypeScript + Tailwind CSS, one deployable app.
2. PostgreSQL dialect. Locally an EMBEDDED database needing no install or account (candidate:
   PGlite), deployed against ordinary Postgres via DATABASE_URL; local vs deployed differ only
   in configuration (NFR-1, NFR-2). Pick the ORM/query layer and migration approach.
3. In-app Host auth: email + password, slow salted hash, DB-backed sessions in an httpOnly
   cookie. No third-party auth provider. Prefer no native modules (clean-machine installs).
4. One Judge behind one boundary (PRD 6.4) with implementations: live model provider, replay of
   Stored rulings, mock. No key => manual fallback grouping (FR-17). Load the "claude-api"
   skill to choose the current Claude model id for the live provider (cheapest model good
   enough for short Norwegian slang answers), and keep the provider swappable.
5. Vitest for unit/integration (against the embedded DB), Playwright for end-to-end, ESLint +
   Prettier, GitHub Actions running lint, typecheck and all tests with no network access.
6. Fresh clone to running Demo mode in at most three commands after prerequisites (NFR-1).

The spine MUST settle:
- Data model and the anonymity invariants FR-11 to FR-13: token hashes deleted at close;
  per-Question random Contributor keys; nothing that reveals insertion order after close
  (watch out for serial ids, created_at columns, and physical row order in a DB dump); how
  revoke (FR-9) deletes an answer set; how the Host can never read answers before close.
- Game state machine (PRD 4.1) and who may mutate what.
- Grouping strategy and cost (PRD 6.2): Judge calls and cost for the sizing Game (30 answer
  sets, 15 questions, up to 5 answers) and the largest Game (50 links, 20 questions, 5
  answers); caching so a pair is never judged twice; 30 s per-question timeout; runs once.
- Stored rulings format (prompt version + model id), Demo mode seed, and the Judge evaluation
  command (FR-32) with the committed ProtoQA crowdsourced data path and CC-BY-4.0 attribution.
- Folder layout, env vars (+ .env.example), test layout, and what CI runs.
- Resolve PRD §10 item 1 (Judge model and provider).

Rules: do NOT git commit; do not write outside your doc_workspace. Finish with the skill's
JSON result, then a summary of at most 15 lines of the key decisions.
```
