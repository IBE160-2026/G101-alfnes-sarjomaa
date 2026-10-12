---
title: Toppsvar Addendum
status: final
created: 2026-09-14
updated: 2026-10-12
---

# Addendum

Supporting depth from the brief conversation that belongs in downstream documents (PRD, architecture, sprint planning) rather than in the brief.

## Source form from the housewarming party

The product idea comes from a real Google Form, titled "Leilighet til leilighet", written by the host and used at a housewarming party, then played back as a manually tallied Family Feud round.

**Redaction note.** This repository is public. The original form asks fifteen questions about named private individuals, several of them about drinking behaviour, and those people never agreed to appear in a public course repository. The names are therefore replaced with placeholders here. The unredacted original stays in the gitignored `.idea/main_brief/task.md` on the group's own machines. Nothing of design value is lost: what matters downstream is the shape of the questions, not who they are about.

Representative questions, redacted:

- What does [Person A] do when they have had far too much to drink?
- What is the most common reason [Person B] is late to a pre-party?
- What does [Person C] find in their pocket the day after?
- What is [Person D]'s most-used lie when drunk?
- What does [Person E] say to the bouncer that never works?
- Who always disappears over the course of a night out?

Structural observations that carry into the PRD:

- Fifteen questions, every one marked required.
- Every question is about a named person in a closed group, phrased as an open "what/who" question. None has a correct answer; the answer is whatever most people say.
- The host wrote every question; there was no question bank or template.

The instructions given to respondents matter as much as the questions, because each one is a workaround for something the tool could not do:

- "Give at least two answers in priority order for each question, preferably more. Write them in the same long-text field, do not submit the form again." The form had no way to collect a ranked list, so ranking was pushed into free text and de-duplication became the host's problem.
- "The answers are anonymous, so make it funny. Do not judge each other." Anonymity was asserted in prose while the form displayed the respondent's signed-in Google account above the questions.

## Aggregating free-text answers (the central design decision)

Three options were considered for turning free-text answers into playable top-lists.

**Manual grouping by the host.** The host reads every answer and merges duplicates by hand. Simple to build and always correct from the host's point of view, but it is the most tedious step of the manual process, so automating nothing here would leave the main problem unsolved.

**Fully automatic clustering.** A model groups semantically equivalent answers with no human in the loop. Best experience when it works, but a wrong merge only becomes visible mid-game, in front of the group, when a team's answer is scored against a group it does not belong to. There is no recovery at that point.

**Chosen: automatic clustering with host override.** The model proposes groups; the host reviews them before play and can merge, split or rename. Rationale: the grouping decision is genuinely ambiguous ("overslept", "slept in" and "was late" may or may not be one answer, depending on the group's own sense of humour), so a human who knows the group should hold the final say. It also keeps the failure mode cheap: a bad grouping costs a few seconds of editing before the game rather than an argument during it.

Settled 2026-10-12: clustering runs once, when the host closes collection, and the confirmed result is stored. In the first stage review means merge, split and rename; reorder and discard come in the second. Open questions for the architecture phase: whether the host sees a confidence signal per group; how near-threshold answers are surfaced; what happens to answers that cluster into a group of one.

## Source of the ready-made questions

The second stage ships a question set that needs no collection round, so a group can play the same evening. The source is **ProtoQA** (Boratko et al., "ProtoQA: A Question Answering Dataset for Prototypical Common-Sense Reasoning", EMNLP 2020), published at `github.com/iesl/protoqa-data` under **CC-BY-4.0**. Verified 2026-09-14. It is also the grouping evaluation set from the first stage onward (see the judge section).

Why it fits:

- It is built from Family Feud survey questions, which is exactly the question shape the game needs: a general question with no single correct answer.
- It carries answer clusters **with their sizes**, not just ordered answer lists. The popularity split is the board.
- Roughly 8,800 training instances scraped from fan sites, plus evaluation sets where about a hundred people answered each question and the answers were clustered by hand.
- CC-BY-4.0 permits reuse with attribution, which a student project on a public repository can satisfy.

Two caveats to carry into architecture and into the reflection report:

- The large training portion was **scraped from Family Feud fan sites**, so the underlying material originates with a commercial television franchise even though the dataset itself is released openly. The smaller crowdsourced portions were collected by the authors directly and are cleaner in provenance. Prefer the crowdsourced sets for anything user-facing, and attribute ProtoQA visibly.
- "Family Feud" is a trademarked format. Describing the game as Family Feud-style in a course document is ordinary comparison, but the product name, interface and any shipped branding must not imitate the show.

## The judge, and how it can be wrong

Grouping, and from the second stage guess matching, use a language model as a judge: given a question and two candidate answers, it rules on whether they mean the same thing. The same mechanism answers both "do these two submitted answers belong in one group" and "does this team's spoken guess match an existing group". In the first stage the host matches guesses by hand.

Known failure modes, all of which the host override is designed to absorb:

- **Non-determinism.** The same pair can be judged differently across runs. Grouping therefore happens once, at collection close, and the result is stored — the board is not recomputed during play.
- **Prompt sensitivity.** Where the model draws the line between one group and two shifts with phrasing. This is why the measurable target is agreement with hand-labelled clusters rather than an abstract accuracy figure.
- **Cost and latency.** A naive all-pairs comparison grows quadratically with the number of answers. For ten to thirty participants over eight to fifteen questions this is tractable, but the strategy (blocking, candidate generation, or clustering then judging only the boundaries) is an architecture decision.
- **Disagreement with human judgement is not always model error.** Whether two answers are "the same" often depends on the group's own humour, which the model cannot know. This is the substantive reason the host confirms, not merely a safety net.

ProtoQA doubles as the evaluation set: because its clusters were built by hand from about a hundred human answers per question, the judge can be scored against them directly, which is far stronger evidence than self-assessment.

## Game flow and timing

Collection is asynchronous; play is live and co-located. The form is filled in during the days before the event, and the game is played together in one room off a single shared screen. This mirrors how the origin party worked and avoids building live multiplayer transport in a one-semester project with two developers.

Consequences: the host needs a visible "answers collected so far" count while the form is open, a clear close step that freezes the data set, and a presentation mode that works on a TV or projector.

## Scoring rules

Settled 2026-10-12, following the course staff's advice to choose the simplest rules for the first version: a revealed group scores the number of participants who named it, and a team's score is the sum of the groups it revealed. Strikes, steals and doubled rounds belong to the second stage. Still open for the PRD: how turns pass between teams, and whether a round ends when the board is cleared or after a fixed number of guesses.

## Anonymity mechanics

There are no participant accounts; the host distributes one personal link per participant (see below). Requirements to carry into architecture: no identifying field is stored with an answer, the host cannot see who submitted what even in the raw data, and the interface should not display a signed-in identity anywhere in the answering flow. The last point responds to the source form, where an account indicator sat above a promise of anonymity.

Duplicate answers, settled 2026-10-12: the opaque token in each personal link keys exactly one answer set. Reopening the link edits that set; there is no shared link that mints new ones. Per-device throttling was rejected as trivially bypassed.

What this costs, for architecture to minimise: the host necessarily knows which link went to whom, so the link-to-answer association must never be exposed in the host's interface or exports, should be stored only as a token hash, and must be deleted at collection close. Before close, someone with direct database access could still correlate; that is an operator risk, not a host-interface one, and should be stated honestly rather than hidden. Losing a link means the host issues a fresh one, which starts an empty answer set.

## Comparison with existing tools

Kept out of the brief beyond a sentence, since none of it is verifiable without research.

- Quiz tools of the Kahoot type score against a predetermined correct answer. The whole point here is that there is no correct answer, only a most-common one.
- Form tools collect free text well but do not aggregate it into ranked buckets and have no play mode.
- Generic Family Feud apps ship fixed question banks about the general public, which removes the only thing that makes the group version funny.

## Running without a model key

The examiner runs the application from the README without the group's keys, paid accounts or infrastructure, so the first stage must play end to end with no language-model key. Requirements for architecture:

- Manual grouping and manual guess matching are full paths, not error states.
- A demo mode ships seed data (a question set with answers) and stored judge rulings for that data, so the AI-assisted flow can be shown without a key.
- Tests and the ProtoQA evaluation run against stored or mocked judge responses by default; live calls are opt-in. This also caps cost, given the quadratic growth of pairwise comparisons.
- The judge is one module, used by grouping and by guess matching alike.

## Where data lives

- ProtoQA's crowdsourced evaluation sets may be committed with attribution (CC-BY-4.0); their location is an architecture decision.
- Labelled housewarming answers are about real people and **never enter the repository**. They stay in the gitignored `.idea/` folder; any evaluation on them is run locally and only aggregate scores are reported.
- Keys live in an untracked environment file with a committed example file beside it.
