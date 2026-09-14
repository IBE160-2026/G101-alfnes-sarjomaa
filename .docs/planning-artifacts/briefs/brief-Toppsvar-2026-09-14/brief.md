---
title: Toppsvar Product Brief
status: final
created: 2026-09-14
updated: 2026-09-14
---

# Product Brief: Toppsvar

## Executive Summary

Toppsvar is a Family Feud-style party game whose questions are about the people in the room. A host writes them about named members of a closed group and shares a link. Participants answer anonymously in free text, several answers each in priority order, days before the party. At collection close a language model judges which answers mean the same thing and groups them into ranked top-lists, the host corrects that grouping, and the group plays live from one shared screen. A group with no week to spare can instead open a ready-made question set whose answer distribution is already known, and play tonight.

The problem is not that the game is unavailable. The host assembles it by hand from tools built for something else, and the assembly costs an evening. Anonymity belongs to that assembly: a traceable answer gets softened, and a softened answer never tops the board.

Now is a workable moment because grouping free text by meaning was the one step that needed a person, and a language model does it well enough to be corrected. That decision point stays supervised: the host keeps authority over the board, and the clerical hours disappear.

## The Problem

A party game is funny in proportion to how well the room knows the people it names: a question about what one of them does after far too much to drink lands only because they are three seats away.

Before one housewarming party, a host built a fifteen-question form about a named friend group. It could not ask for several ranked answers or let anyone extend a submission, so both became instructions in the question text: at least two answers in priority order in one box, and no second submission. Above the promise of anonymity sat the respondent's signed-in account: the promise was the host's, and the tool could not keep it.

Then the tallying. Overslept, slept in and never woke up are three rows to a tool that counts strings and one answer to everyone in the room, so someone merged every response by hand and drew the board on paper. The whole arrangement also has to begin a week early, so the game is never what somebody suggests on the night. It worked that evening; this group never ran it again, and whether that generalises is what a pilot should test first.

## The Solution

**Starting.** A ready-made question set is playable at once: questions with a general rather than a personal answer, such as which superhero people rate highest or where people hide things from their parents, whose answer distribution has already been collected. The questions a host writes about the room are the second mode, and the one a group comes back for.

**Collecting.** Each question takes several ranked answers as separate fields, and an unfinished submission can be reopened and extended: an opaque token carried in the link keys one set of answers, is never shown to the host, and is discarded at collection close. Answers are stored shuffled, without submission times, and no participant creates an account.

**Grouping.** A language model is put in the role of judge: shown a question and two answers, it rules on whether they mean the same thing, and those rulings build the groups, ranked by how many participants named each. The judgement is contestable: merging too eagerly kills the distinction that made the question funny, merging too timidly splits one answer across three rows. The host therefore reviews every question and can merge, split, rename, reorder or discard, or group by hand when the model is unavailable. Nothing reaches the board unconfirmed.

**Playing.** The host drives the board from one shared screen while teams answer out loud, so no participant device is in play. A spoken guess is typed in, the same judge proposes which group it matches, and the host confirms before the reveal.

## What Makes This Different

**Content.** Kahoot-style quiz tools ask questions whose answers the host already holds; Google Forms collects free text and aggregates none of it; generic Family Feud apps only ever ask about strangers. Toppsvar ships a ready-made set too, so a group can start tonight, but the questions with no fixed answer are the ones a host writes about the room, and those are the reason to return.

**One flow.** Collection, grouping and play are three tools today, with an evening of clerical work between them. The honest advantage is that they become continuous, not that any step is clever.

**Anonymity.** No participant account, no address on screen, no stored field linking a person to an answer. The form the host used could have been configured this way and was not: anonymity should be the only setting, not a checkbox to find.

**The honest limit.** There is no proprietary algorithm here. Asking a language model to judge whether two short answers mean the same thing is a standard technique, and the ready-made questions come from a public dataset anyone else can use too. This case is harder than the general one, with slang, nicknames and near-misses that have to stay apart, and the right number of groups is a judgement about a group's humour rather than a measure of semantic distance. The host still reads the raw answers, so writing style is not anonymised. The rest is execution, and it can be copied.

## Who This Serves

**The host.** The primary user and the only one with a real problem: the person who writes the questions, chases responses, and clerks for hours between the form closing and the game starting. Success is arriving with a finished board and running the round without leaving the application.

**Participants.** A secondary user, but not an untroubled one: answering is easy, believing the form is not. What changes is ranked fields, a submission they can extend, and an anonymity nobody has to take on trust. Success for a participant is the bold answer.

The groups are closed by definition: a friend group, a cohort, a team, a family at Christmas. Closure is what makes the questions land. The housewarming party that produced the source form is this project's origin story and test scenario, not its target market.

## Success Criteria

**Host autonomy.** Three test hosts recruited outside the project group, with no guidance beyond the product, each build a form of eight to fifteen questions and collect answers from ten to thirty participants. At least one runs a full round to a final score at a real gathering, with no developer help, no paper board, no spreadsheet.

**Grouping quality.** ProtoQA, a public dataset of Family Feud questions whose answers were collected from about a hundred people each and then clustered by hand, is the standing test set: the judge reproduces those clusters for at least seven of every ten answers. The housewarming answers, labelled the same way, are the second and harder test, because answers about named people carry inside jokes no public dataset contains. In live use the host accepts at least seven of every ten groups as proposed, and the median corrected group needs one edit rather than a rebuild.

**Anonymity.** A reviewer with host access and the invite list cannot attribute any answer to a person: no stored field, timestamp or ordering supports it.

**Repeat pull.** At least two of the three groups ask for a second game within four weeks, unprompted, or a second host in one of them starts one.

## Scope

**In for the first version.** A host account, the only login in the product; a ready-made question set with known answer distributions, playable without a collection round; free-text questions a host writes about named people in a closed group; link or code access with no participant account and no stored identity; several ranked answers per question, reopenable through the link token; grouping by a language-model judge into ranked top-lists, with manual grouping as the fallback; host review before play, with merge, split, rename, reorder and discard; a shared-screen play view with assisted guess matching, reveal and scoring for two or more teams; and deletion of a game and its answers at any time. Data in: host questions and anonymous ranked free-text answers. Data out: a grouped top-list per question and a score per team.

**Explicitly out of the first version.** Participant accounts and login, the negation of link-based joining and the point of the product; payments and subscriptions, because nothing is sold; grouping applied without host confirmation; questions generated on demand for a particular group, as against the fixed set that ships; hosts publishing their own question sets to other groups; remote play and a device per team; public games with strangers; and image or audio answers.

**Difficulty.** Medium; the review surface and the measurement of grouping quality carry the risk, more than the model call does.

## Vision

The near-term goal is narrow: prove a host can go from an empty form to a finished board across a week of small efforts, and that the group asks to do it again.

The second occasion is the student introduction week, where the group is closed, the date fixed, and the organiser not a friend of the participants. Neither mode quite fits it: the shipped questions are about nobody in particular, and a blank form assumes an organiser who already knows the group. What that case needs is the scaffolding in between, question shapes with the names left blank.

Board authority has to move with it: a game needs to become shareable without becoming unowned, so that any member of a group can start one rather than a single appointed host. In two to three years the ambition is that turning a group's inside jokes into a played game is a twenty-minute task, and that the product holds a position of trust: a group certain of its anonymity can be asked sharper questions, a standing built slowly and lost instantly.
