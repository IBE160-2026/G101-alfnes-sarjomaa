# Product Brief: Toppsvar

## Executive Summary

Toppsvar is a Family Feud-style party game whose questions are about the people in the room. A host writes them about named members of a closed group and sends each participant a personal link. Participants answer anonymously in free text, several answers each in priority order, days before the party. When collection closes, a language model groups answers that mean the same thing into ranked top-lists, the host corrects the grouping, and the group plays live from one shared screen. Later, a group with no week to spare will be able to open a ready-made question set with known answer distributions and play tonight.

The game exists; the host assembles it by hand from tools built for something else, and the assembly costs an evening. Anonymity is part of the problem: a traceable answer gets softened, and a softened answer never tops the board.

Now is workable because grouping free text by meaning was the one step that needed a person, and a language model does it well enough to be corrected. The host keeps authority over the board; the clerical hours disappear.

## The Problem

A party game is funny in proportion to how well the room knows the people it names: a question about what someone does after far too much to drink lands because they are three seats away.

Before one housewarming party, a host built a fifteen-question form about a named friend group. It could not ask for several ranked answers or let anyone extend a submission, so both became instructions in the question text: at least two answers in priority order in one box, and no second submission. The promise of anonymity sat beneath the respondent's signed-in account: the host made it, and the tool could not keep it.

Then the tallying. Overslept, slept in and never woke up are three rows to a tool that counts strings and one answer to the room, so someone merged every response by hand and drew the board on paper. The whole arrangement also has to begin a week early, so the game is never what somebody suggests on the night. It worked that evening, but the group never ran it again; whether that generalises is what a pilot should test first.

## The Solution

**Starting.** Questions a host writes about the room are the core mode, and the one a group comes back for. A ready-made question set follows in the second stage: questions with a general rather than a personal answer, such as which superhero people rate highest, with answer distributions already collected, so a group can play at once.

**Collecting.** Each question takes several ranked answers as separate fields. Each participant gets a personal link whose opaque token keys exactly one set of answers: reopening the link extends that set rather than adding a second, which stops one person answering twice. The application never shows the host which answers came from which link, and the token is discarded at collection close. Answers are stored shuffled, without submission times, and no participant creates an account.

**Grouping.** A language model acts as judge: shown a question and two answers, it rules on whether they mean the same thing, and those rulings build the groups, ranked by how many participants named each. The judgement is contestable: merging too eagerly kills the distinction that made the question funny, too timidly splits one answer across three rows. The host therefore reviews every question and can merge, split and rename groups, or group by hand when no model is available; reordering and discarding follow in the second stage. Grouping runs once, when the host closes collection, and the confirmed result is stored, so the board never shifts during play. Nothing reaches the board unconfirmed.

**Playing.** The host drives the board from one shared screen while teams answer out loud; no participant device is in play. A spoken guess is typed in and matched to a group by the host; in the second stage the same judge proposes the match, and the host confirms before the reveal. A revealed group scores the number of participants who named it.

## What Makes This Different

**Content.** Kahoot-style quiz tools ask questions whose answers the host already holds; Google Forms collects free text and aggregates none of it; generic Family Feud apps only ask about strangers. Toppsvar will offer a ready-made set too, but the questions a host writes about the room are the reason to return.

**One flow.** Collection, grouping and play are three tools today, with an evening of clerical work between them. The advantage is that they become continuous, not that any step is clever.

**Anonymity.** No participant account, no address on screen, and no link between a person and an answer once collection closes. Anonymity should be the only setting, not a checkbox to find.

**The honest limit.** There is no proprietary algorithm here. Asking a language model whether two short answers mean the same thing is a standard technique, and the ready-made questions will come from a public dataset anyone can use. This case is harder than the general one: slang, nicknames and near-misses must stay apart, and the right number of groups is a judgement about a group's humour, not a measure of semantic distance. The host still reads the raw answers, so writing style is not anonymised. The rest is execution, and it can be copied.

## Who This Serves

**The host.** The primary user, and the only one with a real problem: the person who writes the questions, chases responses, and clerks for hours between the form closing and the game starting. Success is arriving with a finished board and running the round without leaving the application.

**Participants.** A secondary user, but not an untroubled one: answering is easy, believing the form is not. Ranked fields, an extendable submission and anonymity nobody has to take on trust change that. Success for a participant is the bold answer.

The groups are closed by definition: a friend group, a cohort, a team, a family at Christmas; closure is what makes the questions land. The housewarming party is this project's origin story and test scenario, not its target market.

## Success Criteria

**Functional, checked by automated tests.** These hold for the first stage and are written to become test cases:

- A participant can reopen their personal link and extend their answers until collection closes; opening a link again edits its one answer set, so no link can produce two. After close, the link and any new submission are refused.
- Once collection is closed, no stored table holds a submission time, an insertion order or a token that links an answer to a link.
- Groups rank by how many participants named them, and a team's score is the sum of the groups it revealed.
- Without a language-model key, the host can group by hand, match guesses by hand and play a full round to a final score.

**Grouping quality.** ProtoQA, a public dataset of Family Feud questions whose answers were collected from about a hundred people each and clustered by hand, is the standing test set: the judge reproduces those clusters for at least seven of every ten answers. The housewarming answers, labelled the same way, are the second, harder test, because answers about named people carry inside jokes no public dataset contains; they stay off the public repository. In live use the host accepts at least seven of every ten groups as proposed, and the median corrected group needs one edit rather than a rebuild.

**Anonymity.** Once collection has closed, a reviewer with host access and the invite list cannot attribute any answer to a person: no stored field, timestamp or ordering supports it.

**Pilot goals.** These test whether the product is wanted, not whether it works, and may not resolve within the semester. Three test hosts recruited outside the project group, given no guidance beyond the product, each build a form of eight to fifteen questions and collect answers from ten to thirty participants, and at least one runs a full round at a real gathering without developer help, paper board or spreadsheet. At least two of the three groups then ask for a second game within four weeks, unprompted.

## Scope

**First stage: the core flow, finished and stable before anything else.** A host account, the only login in the product; free-text questions about named people in a closed group; one personal link per participant, with no participant account; several ranked answers per question, reopenable through that link until close; grouping by a language-model judge into ranked top-lists once at close, with manual grouping as the fallback; host review before play, with merge, split and rename; a shared-screen play view where the host marks which group a guess hits, with reveal and scoring for two or more teams; and deletion of a game and its answers at any time. The whole stage runs without a model key, so anyone can run it from the README.

**Second stage, once the first is stable.** A ready-made question set with known answer distributions, playable without a collection round; guess matching proposed by the judge; reorder and discard in review; and scoring beyond the count of answers, such as strikes and steals.

Data in: host questions and anonymous ranked free-text answers. Data out: a grouped top-list per question and a score per team.

**Out of scope for both stages.** Participant accounts and login, which would negate link-based joining, the point of the product; payments and subscriptions; grouping applied without host confirmation; questions generated on demand for a particular group, as against the fixed ready-made set; hosts publishing their own question sets to other groups; remote play and a device per team; public games with strangers; and image or audio answers.

**Difficulty.** Medium, upper half, as the course staff confirmed; the review surface and the measurement of grouping quality carry more risk than the model call.

## Vision

The near-term goal is narrow: prove a host can go from an empty form to a finished board across a week of small efforts, and that the group asks to play again.

The second occasion is student introduction week, where the group is closed, the date fixed, and the organiser not a friend of the participants. Neither mode fits: the ready-made questions are about nobody in particular, and a blank form assumes an organiser who knows the group. That case needs the scaffolding in between: question shapes with the names left blank.

Board authority has to move with it: a game must become shareable without becoming unowned, so that any member of a group can start one rather than a single appointed host. In two to three years the ambition is that turning a group's inside jokes into a played game takes twenty minutes, and that the product earns trust: a group certain of its anonymity can be asked sharper questions, a standing built slowly and lost instantly.
