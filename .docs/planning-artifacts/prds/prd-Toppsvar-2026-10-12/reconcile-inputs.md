# Input reconciliation: Toppsvar PRD

PRD under test: `prd.md` (this folder, status draft, 2026-10-12).
Inputs: `brief.md`, `addendum.md`, `tilbakemelding-product-brief.md`, `.memlog.md` in `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/`.

Severity: **Must** = drops or contradicts a concrete input requirement or the anonymity/honesty stance. **Should** = weakens intent or leaves an explicit instructor request without an FR/NFR/constraint. **Nice** = polish, low risk.

Overall verdict: the PRD is a faithful carrier of the four inputs. All four instructor-suggested functional criteria, the stage split, the simple scoring rule, the once-at-close grouping, the one-token-per-participant rule and keyless running are present and testable. The gaps cluster in three places: (1) anonymity mechanics that the PRD makes stricter in some spots but leaves open or overclaims in others, (2) the honesty-about-limits and trust language that the brief and addendum treat as intent, and (3) instructor asks that live outside the FR list (timeline, data locations, traceability, test depth).

---

## 1. brief.md

### B-1 (Must) Host-facing link-to-answer separation during Collection is not a requirement
- **PRD:** §4.4, FR-8, FR-11, FR-12. FR-12 binds only "once Collection closes". FR-8 hides which links were used, but nothing says the Host cannot read raw Answers, or any per-link view, before close.
- **Input:** brief.md line 30 ("The application never shows the host which answers came from which link"); addendum.md lines 91, 95 ("must never be exposed in the host's interface or exports").
- **Gap:** the "never shown" rule applies for the whole life of the game in the inputs, and includes exports. The PRD only guarantees the post-close storage state and the count-only progress view.
- **Fix:** add an FR (Stage 1, FR-11 sibling): "At no time does any Host-facing page, API response or export associate an Answer or Answer set with an Invite link. Raw Answers are not visible to the Host before Collection closes." Add a testable consequence (UI/API test against a Host session during Collection).

### B-2 (Must) The Answer-set surrogate can re-link one person's answers across Questions
- **PRD:** FR-12 (no reference from Answer set to Invite link), FR-14 ("Answers from the same Answer set... raise Count by one"), FR-17/FR-18 (distinct-Answer-set recounts on merge/split), Review description (§4.6 shows raw Answers per Group).
- **Input:** brief.md line 65 / Anonymity criterion ("no stored field, timestamp or ordering supports [attribution]"); addendum.md line 91 ("host cannot see who submitted what even in the raw data").
- **Gap:** distinct-set counting after merge/split forces a persistent per-Answer set identifier after close. If that identifier is shared across Questions, the Host (who knows the group) can read one person's full set of answers and attribute it by writing style and content. FR-12 satisfies its own letter (no Invite-link reference) while the audit in SM-3 could still be defeated.
- **Fix:** add a consequence to FR-12 or FR-17/18: the post-close surrogate is scoped per Question (an Answer set id is meaningful only within one Question), and Review never exposes it. Name this as a deliberate design constraint for architecture.

### B-3 (Should) "Anonymity should be the only setting" is not captured
- **PRD:** §4.4, §7 Non-Goals. No statement forbids an anonymity toggle.
- **Input:** brief.md line 42.
- **Fix:** add a Non-Goal and an FR consequence: "No Game setting, Host option or flag weakens anonymity; there is no non-anonymous mode."

### B-4 (Should) The honest-limit language is only half carried
- **PRD:** §1 Vision, FR-13, SM-C1. The "Host reads raw answers, style not anonymised" limit is there (§4.4, FR-13). Missing: "There is no proprietary algorithm here... the rest is execution, and it can be copied"; slang, nicknames and near-misses must stay apart; the right number of groups is a judgement about the group's humour, not a semantic distance.
- **Input:** brief.md lines 24, 32, 44; addendum.md line 76 ("Disagreement with human judgement is not always model error").
- **Gap:** PRD treats the Judge as something the Host "corrects", not as a contestable judgement where disagreement is often legitimate. This is the substantive reason for Review and is also the thing the instructor praised ("Ærlig", line 88).
- **Fix:** add a short "Known limits" paragraph to §1 or §6 (no moat; the Judge can be wrong; disagreement may be the group's humour, not an error). Keep it a constraint on how SM-2/SM-4 are interpreted.

### B-5 (Should) Single-origin evidence base not carried
- **PRD:** §1, §9. UJ section says the party is the "origin story and test scenario".
- **Input:** brief.md line 24 ("whether that generalises is what a pilot should test first"); feedback line 86 praises this explicitly.
- **Fix:** one sentence in §1 or §9 that all evidence comes from one party and that SM-5/SM-6 are the first generalisation test.

### B-6 (Should) Second grouping test (housewarming answers) is absent from the metrics
- **PRD:** SM-2 uses ProtoQA only. §6.1 mentions local evaluation on the real answers, but there is no metric for it.
- **Input:** brief.md line 63 ("the housewarming answers, labelled the same way, are the second, harder test").
- **Fix:** add SM-2b (local-only, aggregate score reported, never committed) or state in SM-2 that it is the second dataset and where its result is reported.

### B-7 (Should) SM-2 redefines the metric
- **PRD:** SM-2: "land in a Group whose majority belongs to the same hand-made cluster".
- **Input:** brief.md line 63: "reproduces those clusters for at least seven of every ten answers".
- **Gap:** a purity-style measure is not obviously the same as cluster reproduction, and no FR provides the evaluation harness (see Memlog/addendum gap A-5).
- **Fix:** keep the brief's wording as the primary definition, or mark the PRD's operationalisation `[ASSUMPTION]` and add it to §11.

### B-8 (Should) Pilot goal conditions dropped
- **PRD:** SM-5.
- **Input:** brief.md line 67: forms of eight to fifteen questions, "given no guidance beyond the product", full round "without developer help, paper board or spreadsheet".
- **Fix:** restore the three conditions in SM-5. Also reconcile the 8-15 expectation with FR-4's cap of 20 (already noted as assumption).

### B-9 (Should) Vision beyond Stage 1 is gone
- **PRD:** §1 Vision covers only the near term.
- **Input:** brief.md lines 81-87: student introduction week, scaffolding with blanks, shared board authority ("shareable without becoming unowned"), twenty-minute ambition, trust as a standing "built slowly and lost instantly", sharper questions as the long-run payoff. Feedback line 92 explicitly calls this "tydelig fremtid".
- **Fix:** add a short "Beyond Stage 2" subsection, labelled as non-binding, so downstream phases do not close doors (for example single-owner Host assumptions in the data model).

### B-10 (Nice) Teams "two or more" narrowed to two to four
- **PRD:** FR-22 (tagged ASSUMPTION). **Input:** brief.md line 71. Acceptable; ensure it stays in the §11 index (it does).

### B-11 (Nice) Review and measurement named as the main risk
- **PRD:** §4.6 says Review is the most demanding screen. **Input:** brief.md line 79 also names "the measurement of grouping quality". **Fix:** one line in §10 or §9 on measurement risk.

---

## 2. addendum.md

### A-1 (Must) Pre-close operator risk is not stated, and FR-13 may overclaim
- **PRD:** FR-12 ("During Collection the Token is stored only as a one-way hash"), FR-13 notice ("nobody can see who wrote an Answer").
- **Input:** addendum.md line 95: before close, someone with direct database access could still correlate; this "should be stated honestly rather than hidden".
- **Gap:** the honesty about the pre-close window is dropped entirely, and the participant notice says "nobody" without qualification. This is the exact failure the source form had (anonymity asserted above a visible account).
- **Fix:** add to FR-13 a consequence that the notice does not overclaim, and add a Constraint in §6.1: "Before close, a person with direct database access could correlate a hashed token with answers; this is an operator risk, documented in the README and not hidden." Align SM-3's scope accordingly (post-close only).

### A-2 (Must) Closed-link behaviour conflicts with token deletion
- **PRD:** UJ-2 resolution, FR-7, FR-10 ("every Invite link of the Game shows that Collection is closed"), FR-3 ("respond as unknown links, not as closed ones"), FR-12 (no Token or hash after close), Glossary (Token "discarded when Collection closes").
- **Input:** addendum.md line 95 (hash "deleted at collection close"); brief.md line 58 says only that the link "and any new submission are refused".
- **Gap:** once no token or hash is stored, the system cannot tell a once-valid link from a random one by token. The PRD promises a distinct "closed" response (and a distinct "unknown" response after deletion). It is only achievable if closed-state is derived from the Game identifier carried in the URL, not from the Token.
- **Fix:** state in FR-10 that closed status is determined by the Game, not by token lookup, or soften to "refused" as the brief does. Keep the FR-3 closed-versus-unknown distinction only if architecture confirms it is derivable.

### A-3 (Should) Links shown once; no Host-side labels, no product-sent invites
- **PRD:** Glossary says the Token "is never shown to the Host as data", yet UJ-1 has Maren copying and pasting each link. FR-5 does not say links can be re-displayed or not.
- **Input:** addendum.md line 95 (hash only; host issues a fresh link when one is lost; "knows which link went to whom" outside the product).
- **Fix:** FR-5 consequences: links are displayed once at creation and cannot be shown again (consequence of hash-only storage); the product stores no name, label, email or phone against any link; the product does not send invitations. Correct the Glossary sentence ("not retrievable after creation" rather than "never shown"). Add "product-sent invitations / contact details" to §7.

### A-4 (Should) Reissue keeps an orphaned Answer set, weakening duplicate-submission control
- **PRD:** FR-9 ("deleted if empty, and otherwise kept").
- **Input:** addendum.md line 93 (one token, one answer set; the point is that no person answers twice); line 95 (lost link starts an empty set).
- **Gap:** a Participant who answered, then lost the link, can answer again through the replacement, so one person has two sets. It also lets the Host infer from the count jump after a reissue that this person had answered, which FR-8 tries to prevent. The PRD assumption names only the benefit.
- **Fix:** record both costs in the FR-9 assumption and in Open Question 3, or choose a different rule (for example delete the old set and warn the Host). Do not leave it implicit.

### A-5 (Should) Open architecture questions from the addendum are not forwarded
- **PRD:** §10 has five questions, none of these.
- **Input:** addendum.md line 48: whether the Host sees a confidence signal per group; how near-threshold answers are surfaced; what happens to answers that cluster into a group of one. Line 87: whether a round ends when the board is cleared or after a fixed number of guesses.
- **Fix:** add as Open Questions 6-8 (confidence signal, near-threshold surfacing, singleton handling under the FR-20 eight-Group cap) and extend Open Question 5 with the round-end rule.

### A-6 (Should) No Stage 1 requirement or data plan for the ProtoQA evaluation
- **PRD:** SM-2 depends on ProtoQA evaluation questions, but ProtoQA appears in §8 only as Stage 2 (FR-31). No FR/NFR covers loading the evaluation set, running the harness against stored rulings, or where the data lives.
- **Input:** addendum.md lines 52, 77, 111, 116 (ProtoQA is the evaluation set "from the first stage onward"; evaluation runs against stored or mocked judge responses; crowdsourced sets may be committed with attribution, location an architecture decision).
- **Fix:** add a Stage 1 NFR or FR: "A repeatable evaluation command scores the Judge against the ProtoQA crowdsourced clusters using stored rulings and no network, and reports the SM-2 figure and Judge calls per Question." Add attribution requirement for the committed data (CC-BY-4.0).

### A-7 (Should) ProtoQA provenance caveat dropped from the PRD
- **PRD:** FR-31 (crowdsourced part, credit on screen and in README), §6.3 trademark line.
- **Input:** addendum.md lines 63-64: the large training portion was scraped from Family Feud fan sites; prefer the crowdsourced sets for anything user-facing; the caveat is "to carry into architecture and into the reflection report". Memlog line 31: "not legal advice and not yet checked with staff".
- **Fix:** add to §6.3: only the crowdsourced portions may be shipped to users; the scraped training portion is not used for user-facing content. Add an Open Question: provenance and trademark questions not yet cleared with staff.

### A-8 (Should) Judge failure modes only partly carried
- **PRD:** FR-14 (once, stored), §6.2 (cost, cache), SM-2 and SM-C2. Missing: prompt sensitivity as a named risk (prompt/model version should be recorded with stored rulings so SM-2 is reproducible), and the "disagreement is not always model error" point (see B-4).
- **Input:** addendum.md lines 71-76.
- **Fix:** add a consequence to FR-14 or SM-2: stored rulings record the prompt and model identifier used; SM-2 results are only comparable at the same version.

### A-9 (Should) Judge-as-one-module is not a stated constraint
- **PRD:** Glossary line "One Judge serves Grouping and Guess matching"; OQ4 says it must be swappable.
- **Input:** addendum.md line 112 ("The judge is one module, used by grouping and by guess matching alike"); feedback line 104.
- **Fix:** promote to a short constraint in §6 (capability-level, not a technology choice).

### A-10 (Nice) Per-device throttling rejection not recorded
- **Input:** addendum.md line 93. FR-11 (no IP, no fingerprint) is consistent but the rationale is not. Add one line to §7 or FR-7: device/IP-based duplicate prevention is rejected because it is trivially bypassed and would store identity.

### A-11 (Nice) Redaction rule not restated for tracked fixtures
- **PRD:** §6.1 and FR-30 cover real answers and demo data. Test fixtures and ProtoQA-evaluation labels are not mentioned. **Input:** addendum.md lines 16, 117. Add "no tracked file, including test fixtures, contains real names or real answers; real labelled answers live only in the gitignored folder".

### A-12 (Nice) Demo-mode wording is self-contradictory
- **PRD:** FR-30 consequence 1: "closing Collection on the demo Game produces Judge-proposed Groups", while the same FR and UJ-5 say the demo Game is "already collected and closed". **Input:** addendum.md line 110 (seed data plus stored rulings). **Fix:** decide whether the demo game starts in *collecting* with stored rulings applied at close, or starts *closed* with stored Groups, and word both UJ-5 and FR-30 the same way. Include the first option if the examiner is meant to see the close action.

---

## 3. tilbakemelding-product-brief.md (instructor feedback)

Instructor requests that are met: stage split (feedback line 74, PRD §8); simplest scoring (line 75, FR-25/FR-28); one code per participant (line 75, FR-5/FR-7); when grouping runs (line 27, FR-14); four functional criteria (line 90, SM-1 plus FR-7/10/12/29); pilot goals kept (line 26, SM-5/SM-6); demo mode with cached rulings (line 105, FR-30); manual path including guess matching without a key (line 65, FR-24/FR-29); cost strategy left to architecture with cache and mocks (line 66, §6.2, NFR-2); sketch Review first (line 103, §4.6); real-person answers never committed (line 106, §6.1); Review and play surfaces (line 103, NFR-3).

### F-1 (Must) No time frame, delivery date or capacity constraint
- **PRD:** none. §8 says Stage 2 starts "after Stage 1 is stable" but gives no date, no freeze point, no reserve.
- **Input:** feedback lines 27 and 111 ("Planlegg etter semesterets faktiske lengde"; correct "five-week"); line 56 ("tid til testing, retting og README til slutt"); line 60 (two people). CLAUDE.md gives final submission 5 December.
- **Fix:** add a §6.4 Delivery constraints: semester end and hand-in date (5 December per CLAUDE.md, tag `[ASSUMPTION]` if not confirmed), two developers, a Stage 1 freeze date, and reserved time for test, fix and README before the end. Add a go/no-go rule for starting Stage 2. Confirm the addendum no longer says "five-week" (the current addendum has "one-semester"; fine).

### F-2 (Should) Traceability brief → PRD → code/tests is not explicit
- **PRD:** SM-1 maps only the four functional criteria; each FR has only "Realizes UJ-n" at feature level.
- **Input:** feedback lines 79 and 100 (sensor follows "en sporbar vei fra plan til ferdig app"; "krav kan spores fra brief til kode").
- **Fix:** add a compact traceability table (brief criterion or scope item → FR/NFR → planned test) at the end of §9 or as an appendix. Include the grouping-quality and anonymity criteria, not only the four functional ones.

### F-3 (Should) Test-depth asks: unit tests for score, ranking and token
- **PRD:** FR-15 and FR-25 are unit-testable. FR-5 "cannot feasibly be guessed" is not.
- **Input:** feedback line 102 ("Supplér med enhetstester for poeng, rangering og token").
- **Fix:** make FR-5 testable: minimum token length or entropy, uniqueness within and across Games, constant-time lookup not required. State in NFR or SM-1 that unit tests cover score, ranking and token generation.

### F-4 (Should) Instructor asks "ferdig spørsmålssett og demodata følger med" for the examiner
- **PRD:** FR-30 ships demo data; the ready-made question set is Stage 2 (FR-31).
- **Input:** feedback line 65 (examiner run: the ready-made set and demo data should ship). The instructor's own staging (line 74) puts the ProtoQA set in Stage 2, so the two statements pull against each other.
- **Fix:** say explicitly in §4.8 that for Stage 1 the demo Game stands in for the ready-made set, and that if Stage 2 FR-31 ships it is added to Demo mode. This documents the conscious choice.

### F-5 (Should) Where ProtoQA data and labelled test data live
- **PRD:** FR-31 credits the dataset; NFR-7 covers secrets; §6.1 covers real answers. No decision on location or attribution for evaluation data or test fixtures.
- **Input:** feedback line 106 ("Bestem hvor ProtoQA-data og merkede testdata skal ligge").
- **Fix:** add a "Repository data" constraint: committed ProtoQA subset with attribution (path decided in architecture), real labelled answers only in the gitignored folder, test fixtures synthetic. Name it in §6 so architecture must answer it.

### F-6 (Should) Open items affecting testability remain partly open
- **PRD:** OQ5 (turn rules) and OQ3 (anonymity threshold) are open; FR-26 makes turn passing fully manual.
- **Input:** feedback line 27 ("Avklar de åpne punktene som påvirker testbarheten"); addendum.md line 87 (turns and round-end "open for the PRD").
- **Fix:** state which default is binding for Stage 1 tests (the PRD's assumption) and that changes need a PRD revision. Add the round-end rule to FR-26 or OQ5. Keep FR-10's threshold of three as the testable default.

### F-7 (Should) Dobbeltinnsending limits are not stated
- **PRD:** FR-7 prevents two sets per link; FR-9 can create a second effective set (see A-4); no limit written for a Host issuing two links to one person or a link shared between people.
- **Input:** feedback lines 27 and 75.
- **Fix:** add a "Known limits" line: duplicates are prevented per link, not per person; the Host is the trust anchor for who gets which link.

### F-8 (Nice) Beslutningspunkt and LAAJ not named
- **PRD:** Review is described, but the course-required named "Beslutningspunkt" (the point where the human overrides the AI) and the product owner's "LAAJ" term do not appear. **Input:** memlog line 10 and 24. **Fix:** name Review/Confirm Board as the decision point in §4.6 and mention LLM-as-judge once in the Glossary entry for Judge.

### F-9 (Nice) Judge as a single module (feedback line 104) — see A-9.

### F-10 (Nice) Weights correction (70/30, no oral) is out of PRD scope
- **Input:** feedback line 16; memlog line 44. The PRD makes no weight claims, so nothing to fix here. Verify separately that `CLAUDE.md` and `wiki/` carry the corrected split (CLAUDE.md currently still shows 30/40/30 in the context loaded for this task; it is also modified in the working tree, check it).

### F-11 (Nice) Metrics have no measurement hook
- **PRD:** SM-4 (70 % unchanged, median one edit), SM-C2 (Judge calls per Game), SM-2 (evaluation).
- **Input:** feedback lines 90, 102 (criteria must be checkable or testable).
- **Gap:** no FR records Host edit counts or Judge call counts, and the anonymity rules (FR-11) limit what can be logged. SM-4 is also only measurable in a live pilot.
- **Fix:** add an FR: per-Game counters (proposed Groups, Groups changed by merge/split/rename, Judge calls) that hold no Answer text or identity, exposed to the Host or in a local report.

---

## 4. .memlog.md (decision log)

### M-1 (Should) Recorded stack conflicts with NFR-1 and needs flagging
- **PRD:** NFR-1 ("no hosted service owned by the group"), FR-29/FR-30, §0 (no technology).
- **Input:** memlog line 41: proposed stack Next.js on Vercel, Supabase Postgres with row-level security, Supabase Auth, Claude Haiku 4.5 behind a swappable interface; "needs confirmation".
- **Gap:** a hosted-Supabase stack does not satisfy "runs from a fresh clone with three commands, no external account" unless a local container setup is chosen. The PRD correctly keeps stack out but does not warn architecture that the logged proposal is constrained by NFR-1.
- **Fix:** add a one-line note in NFR-1 or OQ4: any technology choice recorded earlier (for example in `proposal.md`) must satisfy NFR-1; local-only run is the binding requirement.

### M-2 (Should) Memlog line 31 caveat "not yet checked with staff"
- Covered under A-7 (add as Open Question).

### M-3 (Nice) Memlog line 46: "host-written mode is the core value" override
- Carried correctly (PRD §8.2 note and UJ-6 label). No gap. Keep the §8.2 PM note.

### M-4 (Nice) Memlog line 45: stage split "first stage... runs without a model key"
- Carried (FR-29). No gap.

### M-5 (Nice) Memlog line 47: "link-to-answer must never surface in the host UI, stored as hash, deleted at close"
- Hash and deletion carried (FR-12). "Never surface in the host UI" is the open item B-1.

### M-6 (Nice) Language decision
- Memlog line 11: BMAD artefacts in English. PRD is English; NFR-6 sets interface language as an assumption (the memlog is silent). Acceptable; flag only that NFR-6 is an invention, already tagged and indexed.

---

## 5. PRD-internal tensions found while reconciling (affect fidelity)

- **FR-22 versus FR-31 and the Game state model.** FR-22 says play cannot start unless the Board is confirmed (state *reviewed*), while FR-31 skips Review and Grouping. The state sequence in the Glossary has no path for Question-set Games. Add an explicit state path or an exemption in FR-22 (Stage 2).
- **FR-16 wording.** "each Answer starts in its own Group" (§4.5, UJ-3) versus "one Group per distinct Answer text" (FR-16 consequence). Pick one; the second needs a text normalisation rule (case, whitespace) or it is not testable.
- **FR-20 eight-Group cap versus "nothing is hidden by accident".** The cap silently drops Groups ranked below eight on Stage 1 where discard does not exist (FR-21 is Stage 2). Mention that Review shows what falls off the board.
- **FR-8 versus OQ3.** FR-8 shows a count from the first submission; OQ3 floats hiding it below three. Mark FR-8 as the default and OQ3 as a possible tightening so tests are written against one behaviour.

---

## Priority list for revision

1. B-1, B-2, A-1, A-2 (anonymity mechanics and honesty)
2. F-1 (timeline and capacity constraint)
3. A-3, A-4, F-7 (link lifecycle and duplicate limits)
4. A-6, F-5, F-2, F-3 (evaluation harness, data locations, traceability, test depth)
5. B-4, B-9, A-5, A-7, A-8 (honesty, vision, forwarded open questions)
6. Everything tagged Nice
