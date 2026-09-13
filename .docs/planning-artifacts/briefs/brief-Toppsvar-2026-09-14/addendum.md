---
title: Toppsvar Addendum
status: final
created: 2026-09-14
updated: 2026-09-14
---

# Addendum

Supporting depth captured during the brief conversation that belongs in downstream documents (architecture / implementation plan / sprint planning) rather than the brief itself.

## Original question form from the housewarming party (user-authored, from prior discussion)

The product idea comes from a real Google Form, titled "Leilighet til leilighet", used at a housewarming party and then played back as a manually tallied Family Feud round.

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
- The host wrote all questions themselves. There was no question bank and no template.

The instructions given to respondents matter as much as the questions, because each one is a workaround for something the tool could not do:

- "Give at least two answers in priority order for each question, preferably more. Write them in the same long-text field, do not submit the form again." The form had no way to collect a ranked list, so ranking was pushed into free text and de-duplication became the host's problem.
- "The answers are anonymous, so make it funny. Do not judge each other." Anonymity was asserted in prose while the form displayed the respondent's signed-in Google account directly above the questions.

## Aggregating free-text answers (the central design decision)

Three options were considered for turning free-text answers into playable top-lists.

**Manual grouping by the host.** The host reads every answer and merges duplicates by hand. Simple to build and always correct from the host's point of view, but it is the single most tedious step in the current manual process, so automating nothing here would leave the main problem unsolved.

**Fully automatic clustering.** A model groups semantically equivalent answers with no human in the loop. Best experience when it works, but a wrong merge only becomes visible mid-game, in front of the group, when a team's answer is scored against a bucket it does not belong to. There is no recovery at that point.

**Chosen: automatic clustering with host override.** The model proposes groups; the host reviews them before play and can merge, split or rename. Rationale: the grouping decision is genuinely ambiguous ("overslept", "slept in" and "was late" may or may not be one answer, depending on the group's own sense of humour), so a human who knows the group should hold the final say. It also keeps the failure mode cheap: a bad grouping costs a few seconds of editing before the game rather than an argument during it.

Open questions for the architecture phase: whether clustering runs on submission or once at close; whether the host sees a confidence signal per group; how near-threshold answers are surfaced; what happens to answers that cluster into a group of one.

## Game flow and timing

Collection is asynchronous; play is live and co-located. The form is filled in during the days before the event, and the game is played together in one room off a single shared screen. This mirrors how the origin party actually worked and avoids building live multiplayer transport in a five-week project.

Consequences: the host needs a visible "answers collected so far" count while the form is open, a clear close step that freezes the data set, and a presentation mode that works on a TV or projector.

## Scoring rules

Not settled. Family Feud's own rules include strikes, steals and doubled rounds. Which of these survive into the first version is a PRD question. The minimum is points proportional to how many respondents gave an answer in the same group.

## Anonymity mechanics

The first version has no participant accounts; the host distributes a link or code. Requirements to carry into architecture: no identifying field is stored with an answer, the host cannot see who submitted what even in the raw data, and the interface should not display a signed-in identity anywhere in the answering flow. The last point is a direct response to the failure in the source form, where an account indicator sat above a promise of anonymity.

Tension to resolve later: with no accounts there is no reliable way to stop one person answering twice, and the original form's instruction not to resubmit shows this was already a live concern. Options include a one-time code per participant or simple per-device throttling.

## Comparison with existing tools

Kept out of the brief beyond a sentence, since none of it is verifiable without research.

- Quiz tools of the Kahoot type score against a predetermined correct answer. The whole point here is that there is no correct answer, only a most-common one.
- Form tools collect free text well but do not aggregate it into ranked buckets and have no play mode.
- Generic Family Feud apps ship fixed question banks about the general public, which removes the only thing that makes the group version funny.
