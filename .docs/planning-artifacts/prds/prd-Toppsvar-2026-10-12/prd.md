---
title: Toppsvar PRD
status: final
created: 2026-10-12
updated: 2026-10-13
---

# PRD: Toppsvar

## 0. Document Purpose

This PRD turns the Toppsvar product brief into requirements that the UX, architecture and epics-and-stories phases can build from without returning to the brief. It is written for the two-person project group, the course staff who assess it, and the BMAD workflows downstream. It builds on `brief.md` and `addendum.md` in `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/` and on the instructor's feedback in `tilbakemelding-product-brief.md` beside them, and does not repeat their argument.

Vocabulary is fixed in the Glossary (§3), and capitalised terms are used exactly as defined there. Features are grouped in §4 with globally numbered requirements (FR-n), each with testable consequences, and every requirement is tagged **Stage 1** or **Stage 2**. §9.1 traces the brief's success criteria to requirements and planned tests. Choices the group delegated on 2026-10-13 are stated as requirements, with their rationale in parentheses, and listed in §11. §10 lists what is deliberately deferred to UX and architecture, each with an owner.

## 1. Vision

Toppsvar is a party game in the shape of a TV survey show, where the Questions are about the people in the room. A Host writes Questions about a closed group, sends each Participant a personal Invite link, and collects anonymous free-text Answers in the days before a gathering. When the Host closes Collection, a language model acting as a Judge groups Answers that mean the same thing. The Host corrects that Grouping in Review, and the group plays live from one shared screen, guessing what most people said.

The game already works without software, as the housewarming party that inspired it proved. What fails is the assembly: a form tool that cannot collect ranked Answers or keep anonymity, an evening of merging answers by hand, and a board drawn on paper. Toppsvar replaces the assembly, not the game. Its bet is that the one step that needed a person, deciding which free-text Answers count as the same, can be done by a model well enough that a Host can correct the result in about twenty minutes instead of building it from scratch.

Stage 1 proves that loop end to end and keeps it stable: write, collect, group, review, play. Everything else waits until that loop holds.

### 1.1 Known limits

- **No moat.** Asking a language model whether two short Answers mean the same thing is a standard technique, and the Stage 2 Question set comes from a public dataset. The advantage is a continuous flow and careful execution, and both can be copied.
- **The Judge's call is contestable.** Merging too eagerly kills the distinction that made a Question funny; merging too timidly splits one answer across three rows. Whether two Answers are "the same" often depends on the group's humour, which no model knows. A Host who disagrees with the Judge is frequently right, applying knowledge of the group rather than correcting an error; that is the substantive reason for Review, not merely a safety net. Slang, nicknames and near-misses that must stay apart make this harder than the general case.
- **Anonymity has edges.** Nobody can see who wrote an Answer, but the Host reads every Answer as written, so writing style is not anonymised. Before Collection closes, someone with direct database access could correlate hashed Tokens with Answer sets. Duplicate Answer sets are prevented per Invite link, not per person: the Host decides who gets which link.
- **One origin.** All evidence for the problem comes from one party. Whether it generalises is what the pilot goals (SM-6, SM-7) test first.

### 1.2 Beyond Stage 2 (non-binding)

The next occasion is the student introduction week, where the group is closed and the date fixed, but the organiser does not know the participants. It needs Question shapes with the names left blank, between the shipped set and a blank form. Board authority must also move: a Game should become shareable without becoming unowned, so any member of a group can start one. In two to three years, turning a group's inside jokes into a played Game should take twenty minutes, and a group certain of its anonymity can be asked sharper Questions; that trust is built slowly and lost instantly. Downstream phases should avoid closing these doors, for example by hard-wiring into the data model that a Game can only ever have one Host.

## 2. Target User

### 2.1 Jobs To Be Done

- **Host, functional:** turn Questions about my group into a playable Board without counting Answers by hand or drawing anything.
- **Host, emotional:** trust that the Board is fair, so nobody argues about whether two Answers should have counted as one.
- **Participant, functional:** give several Answers quickly on my phone, and add more later when I think of a better one.
- **Participant, emotional:** answer boldly, knowing that nobody, including the Host, can trace an Answer back to me.

### 2.2 Non-Users (Stage 1)

- Gatherings of strangers. The Questions only work when the room knows the people named in them.
- Teachers or companies running scored quizzes with a correct answer. Kahoot-type tools already serve them.
- Remote groups playing on separate devices. Play happens in one room off one screen.

### 2.3 Key User Journeys

The protagonists are invented. The housewarming party is the origin story and test scenario, and nobody from it appears here.

- **UJ-1. Maren builds a Game for her friend group's cabin weekend.**
  - **Persona + context:** Maren, 24, organises a cabin trip for eleven friends in ten days and wants a Game for the Saturday.
  - **Entry state:** first visit on her laptop, no account.
  - **Path:** she creates a Host account, starts a Game and writes nine Questions, two of them about a named friend. She creates eleven Invite links, which are shown once in a list she can copy, and pastes each one into a private message.
  - **Climax:** over the week the progress count on her Game page rises to 10 of 11. On Friday she closes Collection, and a minute later every Question has proposed Groups.
  - **Resolution:** she opens Review.
  - **Edge case:** one friend has lost his Invite link. Maren pastes the old Invite link from her sent messages into the revoke field; the app tells her that anything submitted through it is deleted, and gives her one new Invite link to send.

- **UJ-2. Jonas answers on the bus and adds a better Answer the next day.**
  - **Persona + context:** Jonas, one of Maren's eleven, receives his Invite link in a private message.
  - **Entry state:** phone, no account anywhere, coming from a messaging app.
  - **Path:** the Invite link opens the answer form directly, under a two-sentence notice about what is and is not anonymous. For each Question he types two Answers in priority order into separate fields and submits. The next morning a funnier answer occurs to him, so he opens the same Invite link, sees his earlier Answers, adds a third Answer to one Question and submits again.
  - **Climax:** the confirmation says his Answers are saved and can be changed until Collection closes. Nothing on screen shows a name, an email address or an account.
  - **Resolution:** after Maren closes Collection, the Invite link shows that Collection is closed and accepts nothing.
  - **Edge case:** if he opens the Invite link after Maren revoked it, the app treats it as unknown.

- **UJ-3. Maren fixes the Board before the cabin weekend.**
  - **Persona + context:** Maren, Friday evening, twenty minutes before leaving.
  - **Entry state:** logged in on her laptop, Collection closed, Groups proposed.
  - **Path:** Question by Question she reads the raw Answers under each Group. She merges "overslept" into "slept in", and splits "talks to the bouncer" from "talks to strangers", which the Judge had joined. She renames one Group so it reads well on a TV, discards a Group she does not want on a shared screen, and marks the Question as reviewed.
  - **Climax:** every Question is marked reviewed, and she confirms the Board.
  - **Resolution:** the Board is locked, and the Game is ready to play.
  - **Edge case:** the Judge times out on two Questions. Those two start with one Group per distinct Answer text, she merges them by hand, and the rest keep the Judge's proposals.

- **UJ-4. The cabin plays from the TV.**
  - **Persona + context:** eleven people in two Teams, Maren's laptop connected to the cabin TV.
  - **Entry state:** play opened from a confirmed Board.
  - **Path:** Maren names two Teams. The first Question appears with its Groups hidden and the number of Groups visible. The first Team shouts a Guess, and Maren clicks the Group it hits, or marks a miss.
  - **Climax:** the Group is revealed with its label and Count, and the Team's Score rises by that Count.
  - **Resolution:** after the last Question the screen shows each Team's final Score.
  - **Edge case:** Maren clicks the wrong Group. She undoes the Reveal and clicks the right one.

- **UJ-5. Siri, the examiner, runs the project without the group's keys.**
  - **Persona + context:** Siri assesses the project with a clone of the repository, the README and no API key.
  - **Entry state:** a fresh machine with the prerequisites the README lists.
  - **Path:** she follows the README, starts the application in Demo mode and logs in as the demo Host. The demo Game is in Collection with invented Answers already submitted. She closes Collection.
  - **Climax:** Judge-proposed Groups appear from Stored rulings, without any call to a model. She walks through Review and play end to end.
  - **Resolution:** she runs the test suite and the Judge evaluation, which both pass without network access.

- **UJ-6. Eirik starts a Game tonight with no Collection** *(Stage 2)*.
  - **Persona + context:** Eirik's friends drop by on short notice.
  - **Path:** he creates a Game from a Question set, names two Teams and plays at once, with Boards whose Counts come from a published survey dataset.

## 3. Glossary

- **Host** — The person who creates and runs a Game. Holds the only kind of account in the product. One Host owns many Games.
- **Participant** — A person who answers a Game's Questions through an Invite link. Has no account and no stored identity.
- **Game** — One Host's Questions, their Answers, the resulting Board and the play that follows. Its states are defined in §4.1.
- **Question** — An open free-text prompt the Host writes, usually about named members of the group.
- **Invite link** — A personal URL the Host creates for one Participant. It identifies the Game and carries a Token. One Invite link maps to exactly one Answer set.
- **Token** — The secret part of an Invite link. It is displayed once, when the Invite link is created, and is stored only as a one-way hash until Collection closes, when the hash is deleted.
- **Answer set** — Everything one Invite link has submitted to one Game. It is submitted once it holds at least one Answer to every Question.
- **Answer** — One free-text entry from one Answer set to one Question, with a rank (1 = given first).
- **Collection** — The period in which Invite links accept Answers. It opens when the first Invite links are created, ends when the Host closes it, and cannot reopen.
- **Judge** — The language-model component that decides whether two Answers, or a Guess and a Group, mean the same thing: the technique known as LLM-as-a-judge. One Judge serves Grouping and Guess matching.
- **Grouping** — The step that partitions each Question's Answers into Groups. It runs once, at Collection close, by the Judge or by the manual fallback.
- **Group** — A set of Answers to one Question that count as one answer on the Board. It has a label and a Count.
- **Count** — The number of distinct Contributor keys with at least one Answer in a Group. Groups rank by Count.
- **Contributor key** — A random value that tells Answers to one Question from the same Answer set apart from others, so that Count can be computed. It is scoped to a single Question and never shown.
- **Review** — The Host's step between Grouping and play, where Groups are merged, split, renamed and discarded, each Question is marked reviewed, and the Board is confirmed. Review is the product's decision point: where the human overrides the AI.
- **Board** — The confirmed, ranked list of Groups per Question that play uses. It is locked once confirmed.
- **Team** — A named side in play that accumulates a Score.
- **Guess** — A Team's spoken answer during play.
- **Reveal** — Showing a hidden Group on the shared screen. A scored Reveal follows a Guess that matched the Group; an unscored Reveal shows a remaining Group without awarding it.
- **Score** — The sum of the Counts of the Groups a Team has revealed through scored Reveals.
- **Demo mode** — A way of running the application with invented seed data and stored Judge rulings, so that it needs no model key and no external account.
- **Stored ruling** — A Judge decision saved with the prompt version and model identifier that produced it, replayable without a model.
- **Question set** *(Stage 2)* — A ready-made list of Questions whose Groups and Counts come from a public survey dataset, playable without Collection.
- **Stage 1 / Stage 2** — The two delivery stages. Stage 1 is the core flow, which must be finished and stable before any Stage 2 work starts.

## 4. Features

### 4.1 Host accounts and Games

**Description:** The Host is the only user who logs in. A Host creates Games, sees each Game's state, and can delete any Game with all its data. A Game moves through these states, and only these transitions exist:

| State | Entered when | Leaves to |
|-------|--------------|-----------|
| *draft* | the Game is created | *collecting* |
| *collecting* | the first Invite links are created (FR-5) | *grouping* |
| *grouping* | the Host closes Collection (FR-10) | *in review* |
| *in review* | Grouping finishes or falls back (FR-15, FR-17) | *ready* |
| *ready* | the Host confirms the Board (FR-21) | *playing* |
| *playing* | the Host starts play (FR-23) | *played* |
| *played* | the last Question is finished (FR-27) | none |

Deletion (FR-3) is possible from every state. In Stage 2, a Game created from a Question set (FR-33) is created directly in *ready* and skips the states before it. Realises UJ-1 and UJ-5.

#### FR-1: Host account — Stage 1
A person can create a Host account with an email address and a password, log in and log out. Participants never see a login.

**Consequences (testable):**
- Passwords shorter than 10 characters are refused, and passwords are stored only as a salted slow hash.
- A wrong email or password gives one message that does not reveal which of the two was wrong.
- A session expires after 14 days without use.
- A request to see or change a Game by anyone other than its logged-in Host is refused with the same response as for a Game that does not exist.
- No page reached through an Invite link offers or requires a login.

#### FR-2: Create and list Games — Stage 1
A logged-in Host can create a Game with a title of 1 to 80 characters and see a list of their own Games with each Game's state.

**Consequences (testable):**
- A new Game starts in *draft*.
- A Host never sees another Host's Games in any list or by URL.

#### FR-3: Delete a Game — Stage 1
A Host can delete a Game in any state. Deletion removes its Questions, Invite links, Answers, Groups, Board, Teams and Scores.

**Consequences (testable):**
- After deletion, no stored row references the Game.
- The Game's Invite links respond as unknown.
- A Game is deleted automatically 30 days after it reaches *played*, and the Host is told so when play ends. A Game that never reaches *played* is deleted 90 days after its last change. (Answers are about people who did not consent, and the product keeps nothing it does not need.)

### 4.2 Questions

**Description:** The Host writes the Questions a Game asks. Questions are free text and usually name a member of the group. Realises UJ-1.

#### FR-4: Write and edit Questions — Stage 1
A Host can add, edit, reorder and remove Questions while the Game is in *draft*. Questions lock when Collection opens. (Locking is simpler and fairer than allowing edits after Participants have answered.)

**Consequences (testable):**
- A Game holds at most 20 Questions, each 1 to 200 characters. (The brief expects 8 to 15; 20 gives headroom.)
- An attempt to edit, add or remove a Question after Collection has opened is refused.

### 4.3 Invite links and Collection

**Description:** The Host creates one Invite link per Participant and distributes them personally, outside the product: the product sends no invitations and stores no names, labels or contact details against Invite links. Each Invite link opens the answer form directly on any phone. A Participant can come back through the same Invite link to change their Answer set until the Host closes Collection. Realises UJ-1 and UJ-2.

#### FR-5: Create Invite links — Stage 1
A Host can create a chosen number of Invite links for a Game in *draft* or *collecting*. Creating the first Invite links opens Collection.

**Consequences (testable):**
- Creating Invite links for a Game with zero Questions is refused.
- Each Token holds at least 128 bits from a cryptographically secure random source, and Tokens are unique across all Games.
- The full Invite links are displayed once, at creation, in a list the Host can copy. They cannot be displayed again, because only a hash of each Token is stored.
- A Game holds at most 50 Invite links, including revoked ones. (The brief expects 10 to 30 Participants.)

#### FR-6: Answer through an Invite link — Stage 1
A Participant who opens a valid Invite link sees every Question and can give one to five Answers per Question, as separate ranked fields. (The form used at the housewarming party asked for "at least two", which is left to the Host's wording.)

**Consequences (testable):**
- Submitting saves the Answer set only when every Question has at least one Answer; otherwise the form shows which Questions are missing.
- Answers are saved with their rank, and empty fields are ignored.
- An Answer longer than 80 characters is refused with a message.
- The answer form shows no name, email address, account indicator or other identity.

#### FR-7: Change a submitted Answer set — Stage 1
A Participant who opens the same Invite link again sees their earlier Answers and can add, change or remove Answers until Collection closes, keeping at least one Answer per Question.

**Consequences (testable):**
- Opening an Invite link a second time edits its one Answer set. No Invite link can produce two Answer sets.
- After submitting, the Participant is told that their Answers are saved and can be changed until Collection closes.

#### FR-8: Collection progress — Stage 1
While Collection is open, the Host sees how many Answer sets have been submitted out of the number of active Invite links.

**Consequences (testable):**
- The Host sees a count only, never which Invite links have been used. (Showing which Invite links were used reveals who has answered, and with few Answer sets that is close to revealing what they answered.)
- Until three Answer sets are submitted, the count reads "fewer than 3" instead of an exact number, so a Host cannot learn who answered by watching it change right after messaging one person.

#### FR-9: Revoke and replace an Invite link — Stage 1
While Collection is open, a Host can revoke an Invite link by pasting it into the Game, and receives one replacement Invite link, displayed once.

**Consequences (testable):**
- A revoked Invite link responds as unknown.
- Revoking deletes the revoked Invite link's Answer set, if it has one, so that one person cannot hold two Answer sets. The Host is told this before confirming, whether or not an Answer set existed. (Deleting avoids duplicates at the cost of losing a submission; the drop in the progress count can reveal that the person had answered, which reveals participation but not content.)

#### FR-10: Close Collection — Stage 1
A Host can close Collection once at least three Answer sets are submitted. Closing is final, deletes every Token hash, and starts Grouping.

**Consequences (testable):**
- With fewer than three submitted Answer sets, closing is refused and the Host is told why; the Host can create more Invite links, wait, or delete the Game. (Below three, anonymity collapses because the Host can infer who wrote what.)
- Answer sets that were started but not submitted are deleted at close.
- After close, every Invite link of the Game shows that Collection is closed and accepts nothing. Closed status is determined by the Game identified in the URL, not by looking up the Token.
- A submission that arrives after close is refused, even if the form was opened before.

### 4.4 Anonymity

**Description:** Anonymity is a product requirement, not a privacy footnote. The Host necessarily knows which Invite link went to whom, so the product must make sure nothing links an Invite link to its Answers: during Collection, in anything the Host can see, and after Collection, in storage. There is no setting that weakens this. Realises UJ-2.

#### FR-11: No identity in the answering flow — Stage 1
The answering flow stores no identity about a Participant.

**Consequences (testable):**
- No stored table holds a name, email address, IP address, device fingerprint or account identifier for a Participant.
- Logs written while handling an Invite link contain neither the Token nor Answer text.

#### FR-12: Nothing linkable in the Host's view — Stage 1
At no time does any page, response or export available to the Host associate an Answer or Answer set with an Invite link, and the Host cannot read any Answer before Collection closes.

**Consequences (testable):**
- An automated test, logged in as the Host during Collection, finds no Answer text and no per-Invite-link state in any Host page or response.
- After close, Review shows Answers grouped by Group only, never by Answer set or Contributor key.
- No Game setting, Host option or flag disables any part of §4.4.

#### FR-13: Unlinkable storage after close — Stage 1
Once Collection closes, no stored data can link an Answer to an Invite link, to other Questions' Answers from the same Answer set, or to its order of arrival.

**Consequences (testable):**
- After close, no stored table holds a Token, a Token hash, an Invite link reference or an Answer set identifier.
- Each Answer carries only a Contributor key, drawn at random separately for each Question, so Answers to two Questions cannot be joined.
- No stored table holds a submission time, an insertion sequence or an identifier that increases with insertion for Answers.
- An automated test inspects the stored schema and data after close and fails if any of the above appears.

#### FR-14: Honest anonymity notice — Stage 1
The answer form tells Participants, in two sentences or fewer, what is anonymous and what is not: nobody can see who wrote an Answer, but the Host reads every Answer as written.

**Consequences (testable):**
- The notice appears on the answer form above the first Question.
- The notice makes no stronger claim than §1.1 supports. The README documents the pre-close database risk in §1.1.

### 4.5 Grouping

**Description:** When Collection closes, each Question's Answers are partitioned into Groups. The Judge proposes Groups. Without a model key, or for any Question where the Judge fails, the manual fallback applies and the Host groups by hand in Review. Grouping runs once, and its result is stored, so the Board never changes because the model is non-deterministic. Realises UJ-1 and UJ-3.

#### FR-15: Judge Grouping at close — Stage 1
At Collection close, the Judge groups each Question's Answers by meaning, and the result is stored as Stored rulings.

**Consequences (testable):**
- Grouping runs exactly once per Game. Reopening Review never re-runs it.
- Answers with the same Contributor key in one Group raise its Count by one, not two.
- For the sizing Game of 30 Answer sets, 15 Questions and up to 5 Answers per Question, Grouping finishes within two minutes.
- Each Stored ruling records the prompt version and model identifier.
- In tests and in Demo mode, Grouping uses Stored rulings or mocks and makes no network call.

#### FR-16: Ranking and labels — Stage 1
Groups within a Question rank by Count, highest first.

**Consequences (testable):**
- Ties in Count are broken by the number of rank-1 Answers in the Group, then alphabetically by label.
- A Group's default label is its most frequent normalised Answer text, ties broken by the shortest text.

#### FR-17: Manual Grouping fallback — Stage 1
If no model key is configured, or the Judge fails or exceeds 30 seconds on a Question, that Question starts with one Group per distinct normalised Answer text. Normalised means compared case-insensitively, with surrounding whitespace trimmed, inner whitespace collapsed and trailing punctuation removed. (The 30-second limit keeps one slow Question from holding up the rest.)

**Consequences (testable):**
- With no model key, closing Collection succeeds and Review opens with the fallback Groups for every Question.
- If the Judge fails partway, the Host is told which Questions fell back, and Questions already grouped keep their Judge proposals.

#### FR-18: Content-free usage counters — Stage 1
Each Game keeps counters that hold no Answer text and no identity: Groups proposed by the Judge, Groups changed by merge, split, rename or discard, Judge calls made, and whether each Question fell back.

**Consequences (testable):**
- The counters can be exported as a local report for the Game, and they are deleted with the Game.

### 4.6 Review

**Description:** Review is the product's decision point, where the Host's knowledge of the group overrides the Judge. For each Question the Host sees the Groups, their Counts and the raw Answers in each, corrects the result, and marks the Question reviewed. This is the most demanding screen in the product, and UX should sketch it first. Realises UJ-3.

#### FR-19: Review display — Stage 1
For each Question, a Host in Review sees every Group with its label, Count and Answers, in Board order, with the Groups that fall below the Board limit (FR-21) shown separately as not on the Board.

**Consequences (testable):**
- Every Answer of the Question appears under exactly one Group.
- Groups below the Board limit are listed and marked as not shown in play.
- Stage 1 shows no confidence signal per Group. (The Host reads the raw Answers under each Group, which is the stronger signal; single-Answer Groups beyond the Board limit appear in the not-on-Board list.)

#### FR-20: Correct the Grouping — Stage 1
A Host can merge two or more Groups in one Question, move selected Answers to a new or another existing Group, rename a Group, and discard a Group from the Board.

**Consequences (testable):**
- After a merge or move, each affected Group's Count is recalculated as distinct Contributor keys, not by adding Counts.
- A merged Group keeps the label of the merged Group with the highest Count, ties broken by position in the ranking; the Host can rename it.
- Labels are 1 to 40 characters. (Short enough to read on a TV from across a room.)
- A discarded Group does not appear in play, and its Answers stay visible in Review under a discarded heading. (Discard is Stage 1 so that a hurtful Group never has to reach a shared screen; see §6.3.)
- Any change to a Question clears its reviewed mark.

#### FR-21: Mark reviewed and confirm the Board — Stage 1
A Host can mark each Question reviewed, and confirm the Board once every Question is marked. A confirmed Board is locked.

**Consequences (testable):**
- The Board shows at most eight Groups per Question: the highest-ranked Groups that are not discarded. (A TV-show board holds about eight.)
- Confirming moves the Game to *ready*. After confirmation, every Review operation is refused.

#### FR-22: Reorder Groups — Stage 2
A Host can override the order of Groups on the Board.

**Consequences (testable):**
- A manual order survives until the Board is confirmed, and play uses it.

### 4.7 Play

**Description:** Play runs from one shared screen, such as a TV or projector connected to the Host's laptop. Teams answer out loud, and the Host clicks the Group each Guess hits, or marks a miss. No Participant device is involved. Play state is saved, so a reloaded or reopened play view continues where it left off. Realises UJ-4.

#### FR-23: Set up Teams — Stage 1
A Host can start play on a Game in *ready* by naming two to four Teams. (Two to four covers a party; more makes the shared screen hard to read.)

**Consequences (testable):**
- Play cannot start on a Game that is not *ready*, except a Game created from a Question set (FR-33).
- Every Team starts with a Score of zero, and the Game moves to *playing*.

#### FR-24: Show the Board — Stage 1
The shared screen shows one Question at a time, with its Groups hidden and the number of Groups visible, the current Team and every Team's Score.

**Consequences (testable):**
- The play view fills a 1920×1080 browser window, and Group labels and Scores render at no less than 48 px. (Legible from about 3 metres; checked manually against this bound.)
- The play view never shows raw Answers or discarded Groups.

#### FR-25: Mark a match or a miss — Stage 1
For the current Team, the Host clicks the Group a Guess matches, which makes a scored Reveal, or marks a miss. The Guess itself is not typed in Stage 1.

**Consequences (testable):**
- A scored Reveal shows the Group's label and Count and adds the Count to the current Team's Score.
- A Team's Score always equals the sum of the Counts of its scored Reveals.
- Clicking a Group that is already revealed is refused.

#### FR-26: Undo — Stage 1
The Host can undo the most recent Reveal, scored or unscored. (A misclick should not ruin a round.)

**Consequences (testable):**
- Undo hides the Group again and, for a scored Reveal, subtracts its Count from the Team that received it.
- Undo is available only for the most recent Reveal on the current Question.

#### FR-27: Turns and moving on — Stage 1
The Host passes the turn to the next Team and moves to the next Question manually, and can make unscored Reveals of the remaining Groups before moving on. (Manual turns, and a Question ending when the Host moves on, replace strikes, steals and round-end rules until Stage 2.)

**Consequences (testable):**
- An unscored Reveal changes no Score.
- After the last Question the screen shows the final Score of every Team, and the Game moves to *played*.
- Play state (current Question, current Team, Reveals and Scores) survives a reload of the play view.

#### FR-28: Assisted Guess matching — Stage 2
The Host types a Guess, the Judge proposes which Group it matches, and the Host accepts or overrides the proposal before the Reveal.

**Consequences (testable):**
- Nothing is revealed until the Host confirms.
- Without a model key, play works exactly as in FR-25.
- Typed Guesses are deleted when the Game reaches *played*.

#### FR-29: Additional scoring rules — Stage 2
A Host can switch on strikes and steals for a Game. (The rules are decided when Stage 2 starts; see §10, item 4.)

### 4.8 Running without a model key, and evaluating the Judge

**Description:** The examiner runs the application from the README, without the group's keys, paid accounts or infrastructure. Stage 1 must therefore play end to end without a model key, Demo mode must show what the Judge does without calling it, and the Judge's quality must be measurable the same way. In Stage 1 the demo Game stands in for the ready-made Question set; if FR-33 ships, its Question sets are added to Demo mode. Realises UJ-5.

#### FR-30: Full Stage 1 without a key — Stage 1
With no model key configured, every Stage 1 requirement works, using the manual fallback (FR-17) and manual matching (FR-25).

**Consequences (testable):**
- An automated end-to-end test, run with no key and no network access to a model provider, takes a Game from creation through Collection, close, fallback Grouping, Review and play to a final Score.

#### FR-31: Demo mode — Stage 1
The application can start in Demo mode with a demo Host account and a demo Game in *collecting*, with invented Answer sets already submitted and Stored rulings for their Answers.

**Consequences (testable):**
- Closing Collection on the demo Game produces Judge-proposed Groups from the Stored rulings, with no network call.
- No demo Answer, Question or name is taken from any real group.
- The README gives the single command that starts Demo mode and the demo Host's login.

#### FR-32: Judge evaluation — Stage 1
A single command scores the Judge against the hand-made clusters in ProtoQA's crowdsourced evaluation questions and reports the figures in SM-2.

**Consequences (testable):**
- By default it replays Stored rulings and makes no network call; regenerating the rulings with a live model is an explicit option.
- The report states precision, recall and F1 (as defined in SM-2), Judge calls per Question, and the prompt version and model identifier.
- The committed evaluation data is the crowdsourced portion only, with CC-BY-4.0 attribution beside it.

### 4.9 Ready-made Question sets — Stage 2

**Description:** A Host can play at once from a Question set whose Groups and Counts come from the crowdsourced part of the ProtoQA dataset, with no Collection. Realises UJ-6.

#### FR-33: Play a Question set — Stage 2
A Host can create a Game from a Question set. The Game skips Collection, Grouping and Review and starts in *ready*.

**Consequences (testable):**
- The Game's Board equals the dataset's clusters and Counts for those Questions, capped as in FR-21.
- The source dataset is credited on the play screen and in the README.
- Questions and Group labels are translated into Norwegian with Counts unchanged, and the credit states that the material is translated and adapted, as CC-BY-4.0 requires.

## 5. Cross-Cutting Non-Functional Requirements

- **NFR-1 Local runnability.** A fresh clone runs locally by following the README, with no paid account, no hosted service owned by the group and no model key. Setup takes at most three commands after the listed prerequisites. Any technology recorded earlier, such as the stack proposed in `proposal.md`, must satisfy this; where it relies on a hosted service, architecture must provide a local substitute.
- **NFR-2 Deployability.** The same build can also be deployed to a publicly reachable host, so that Participants' phones can reach Invite links during pilot use (SM-6, SM-7). Local and deployed runs differ only in configuration. The deployment target is an architecture decision, and the examiner path never depends on it.
- **NFR-3 Tests without network.** The full automated test suite passes with no network access. Unit tests cover Score, ranking, Count recalculation and Token generation. Judge calls use Stored rulings or mocks by default, and live calls are opt-in.
- **NFR-4 Devices.** The answer form works on a current mobile browser at 360 px width. Review targets a laptop screen. The play view targets a 1920×1080 screen.
- **NFR-5 Responsiveness.** Every Host action in Review and play shows its result within one second, excluding Grouping itself.
- **NFR-6 Accessibility.** Text and controls meet WCAG 2.1 AA contrast. The answer form is fully usable by keyboard and screen reader.
- **NFR-7 Language.** The interface is in Norwegian (bokmål). (The target groups are Norwegian. The Stage 2 Question set is translated; see FR-33.)
- **NFR-8 Secrets.** No key or password is committed. Configuration is read from an untracked environment file, and a committed example file lists every variable.

## 6. Constraints and Guardrails

### 6.1 Privacy and repository data

- Answers are often about named people who did not consent to being asked about. The product keeps nothing it does not need: no Participant identity (FR-11), nothing linkable in the Host's view (FR-12) or in storage after close (FR-13), and full deletion on request (FR-3).
- A Game and its data live at most 30 days after play, or 90 days if never played, and the Host can delete them earlier (FR-3).
- Real Answers from the housewarming party never enter the repository, including test fixtures. They stay in the gitignored `.idea/` folder; evaluation on them runs locally, and only aggregate scores are reported.
- Committed test fixtures and demo data are invented. Committed ProtoQA data is the crowdsourced portion only, with attribution. Paths are an architecture decision.
- The product must not raise response rates by showing the Host who has not answered (see FR-8). That would trade anonymity for participation.

### 6.2 Cost

- Grouping compares Answers pairwise, which grows quadratically with the Answers per Question. Grouping strategy is an architecture decision; architecture must state the Judge calls and cost for the sizing Game (FR-15) and for the largest permitted Game (50 Invite links, 20 Questions, 5 Answers per Question).
- Judge rulings are cached, so the same pair is never judged twice within a Game.

### 6.3 Content

- The product does not moderate Questions or Answers. The Host is responsible for what they ask about their own group, and can keep any Group off the shared screen by discarding it (FR-20).
- Only the crowdsourced portion of ProtoQA is shown to users. Its large training portion was scraped from fan sites of the television show and is not used.
- The product name, interface and branding must not imitate the television show the format resembles.

### 6.4 Judge

- There is one Judge, used by Grouping and by Guess matching alike, behind a boundary that lets the model or provider change without changing either caller.

### 6.5 Delivery

- Two developers, one semester, following the course schedule: UX and architecture in weeks 44–45, implementation in weeks 46–47, the reflection report in weeks 48–49, and hand-in of the repository and report on 5 December. (The group may start implementation earlier, since planning is a week ahead.)
- **Stage 1 freeze:** at the end of week 47, only fixes, tests and the README change. Time for test, fixes and README is reserved inside week 47, not after it.
- **Stage 2 go/no-go:** Stage 2 work starts only once SM-1 passes in full on the main branch. Within Stage 2, FR-33 comes first (see §8.2).

## 7. Non-Goals (Explicit)

- Participant accounts or login of any kind. Joining by Invite link is the point of the product.
- A non-anonymous mode, or any setting that weakens §4.4.
- Invitations sent by the product, or names, labels or contact details stored against Invite links.
- Duplicate prevention by device or IP address. It is trivially bypassed and would store identity.
- Payments, subscriptions or ads. Nothing is sold.
- Grouping applied to the Board without the Host's confirmation.
- Questions generated on demand for a particular group.
- Hosts publishing their own Questions or Question sets to other groups.
- Remote play, or one device per Team.
- Public Games with strangers.
- Image or audio Answers.
- Real-time updates pushed to Participants' devices.

## 8. MVP Scope

### 8.1 In Scope: Stage 1

- Host accounts, Games and their states, deletion (FR-1 to FR-3)
- Questions written by the Host (FR-4)
- Personal Invite links, ranked Answers, changing an Answer set, progress count, revoke and close (FR-5 to FR-10)
- Anonymity guarantees and an honest notice (FR-11 to FR-14)
- Judge Grouping at close, ranking, manual fallback, usage counters (FR-15 to FR-18)
- Review with display, merge, move, rename, discard, mark and confirm (FR-19 to FR-21)
- Play with Teams, matches and misses, Reveal, Score, undo and turns (FR-23 to FR-27)
- Running without a key, Demo mode and Judge evaluation (FR-30, FR-31, FR-32)

### 8.2 Stage 2: only after SM-1 passes

- Ready-made Question sets from ProtoQA (FR-33). (This was the brief's original promise of "play tonight". It is deferred because the host-written mode is the core value, and it is the first Stage 2 item to take.)
- Reorder in Review (FR-22)
- Assisted Guess matching by the Judge (FR-28)
- Strikes and steals (FR-29)

## 9. Success Metrics

**Primary**

- **SM-1: Stage 1 acceptance.** Every testable consequence of Stage 1 is covered by an automated test, or, where it cannot be automated (FR-24 legibility, parts of NFR-6), by a manual checklist committed with the code. The suite passes without network access. Validates all Stage 1 FRs.
- **SM-2: Grouping agrees with human clusters.** On ProtoQA's crowdsourced evaluation questions, the Judge's Grouping reaches a B-cubed F1 of at least 0.70 against the hand-made clusters, with precision and recall reported separately. B-cubed scores each Answer by the share of its Group that shares its cluster (precision) and the share of its cluster that shares its Group (recall), so neither grouping everything nor grouping nothing scores well. This operationalises the brief's "seven of every ten answers". Results are only comparable at the same prompt version and model. Validates FR-15 and FR-32.
- **SM-3: Anonymity audit.** A reviewer given Host access, the list of Invite links and a database dump taken after close cannot attribute any Answer to an Invite link, or join one person's Answers across Questions. Validates FR-11 to FR-13. The pre-close window is out of scope for this audit and documented instead (§1.1).

**Secondary**

- **SM-4: Grouping on real Answers.** The same F1 measured locally on the labelled housewarming Answers, which are in Norwegian and full of inside jokes. Only the aggregate score is reported, never the data. No target; it shows how far the ProtoQA result transfers. Validates FR-15.
- **SM-5: Hosts accept the Judge's proposals.** In live use, at least 70 % of proposed Groups are confirmed unchanged, and the median changed Group needs one edit, read from the usage counters (FR-18). Validates FR-15 and FR-20.
- **SM-6: Pilot goal, Host autonomy.** Three test Hosts from outside the project group, with no guidance beyond the product, each build a Game of 8 to 15 Questions and collect from 10 to 30 Participants. At least one runs a full round to a final Score at a real gathering, with no developer help, paper board or spreadsheet. This may not resolve within the semester.
- **SM-7: Pilot goal, repeat pull.** At least two of the three groups ask for a second Game within four weeks, unprompted. This may not resolve within the semester.

**Counter-metrics (do not optimise)**

- **SM-C1: Fewer Groups per Question.** Merging more eagerly raises SM-5 by giving the Host less to split, but it kills the distinctions that make a Question funny. Counterbalances SM-5.
- **SM-C2: Judge calls per Question.** More calls can raise SM-2 but cost money and time. Always report them alongside SM-2. Counterbalances SM-2.

### 9.1 Traceability

| Brief criterion or scope item | Requirements | Planned test |
|-------------------------------|--------------|--------------|
| Reopen and extend through the personal Invite link; refused after close | FR-6, FR-7, FR-10 | End-to-end: submit, reopen, extend, close, refuse |
| No stored time, order or Token links an Answer to an Invite link after close | FR-12, FR-13 | Schema and data inspection after close; Host-session test during Collection |
| Groups rank by Count; Score is the sum of the Counts of revealed Groups | FR-15, FR-16, FR-20, FR-25 | Unit tests: Count by Contributor key, ranking, merge recount, Score |
| Full round without a model key | FR-17, FR-30 | End-to-end without key or network |
| Grouping quality against ProtoQA | FR-32 | Evaluation command on Stored rulings (SM-2) |
| Anonymity: no attribution with Host access and the list of Invite links | FR-11 to FR-14 | Anonymity audit (SM-3) |
| Personal Invite link against duplicate Answer sets | FR-5, FR-7, FR-9 | Unit test: one Answer set per link; revoke deletes |
| Runs from the README without the group's keys | FR-31, NFR-1, NFR-3 | Fresh-clone run following the README, in CI where possible |
| Host review with merge, split and rename before play | FR-19 to FR-21 | Component and end-to-end tests of Review |
| Pilot goals | Whole Stage 1 | Pilot with outside Hosts (SM-6, SM-7) |

## 10. Deferred Items

Every Open Question of the draft was decided on 2026-10-13 except these, which belong to a later phase or to someone outside the group. Until they are settled, the requirements as written bind.

1. **Judge model and provider.** Owner: architecture phase. Decide before Stage 1 implementation, against cost (§6.2), Norwegian slang (SM-4) and the single-Judge boundary (§6.4).
2. **How Review surfaces Answers near the Judge's threshold.** Owner: UX phase, as part of the Review sketch. Stage 1 needs no signal beyond FR-19.
3. **ProtoQA provenance and trademark.** Owner: the group, by asking the course staff. Settle before Stage 2 starts. Stage 1 uses ProtoQA only for the offline evaluation (FR-32), with the crowdsourced portion and attribution.
4. **Strikes and steals (FR-29).** Owner: the group. Decide when Stage 2 starts.

## 11. Decisions Index

The draft's assumptions were decided on 2026-10-13, by delegation from the group, and are stated in the requirements above. This index lets downstream phases trace them.

**Behaviour**

- §4.2 FR-4 — Questions lock when Collection opens.
- §4.3 FR-6 — One to five Answers per Question, at least one required.
- §4.3 FR-8 — The Host sees a count of Answer sets, never which Invite links were used, and only "fewer than 3" until three are submitted.
- §4.3 FR-9 — Revoking deletes the old Invite link's Answer set.
- §4.3 FR-10 — Closing requires at least three submitted Answer sets.
- §4.1 FR-3, §6.1 — Games are deleted 30 days after play, or 90 days after their last change if never played.
- §4.4 FR-11 — Logs contain neither the Token nor Answer text.
- §4.6 FR-19 — No confidence signal in Stage 1 Review.
- §4.7 FR-26 — The Host can undo the most recent Reveal.
- §4.7 FR-27 — Turns and the end of each Question are manual in Stage 1.
- §4.7 FR-28 — Typed Guesses are deleted when the Game is played (Stage 2).
- §5 NFR-7, §4.9 FR-33 — The interface is in Norwegian (bokmål), and the Stage 2 Question set is translated.
- §6.3 — No moderation; discard is the Host's tool.
- §6.5 — Implementation may start before week 46.
- §9 SM-2 — B-cubed F1 is the measure of the brief's "seven of every ten".

**Numeric parameters**

- §4.1 FR-1 — Passwords of at least 10 characters; sessions expire after 14 days.
- §4.2 FR-4 — At most 20 Questions, each at most 200 characters.
- §4.3 FR-5 — At most 50 Invite links per Game.
- §4.3 FR-6 — Answers are at most 80 characters.
- §4.5 FR-15 — Grouping of the sizing Game finishes within two minutes.
- §4.5 FR-16 — Ties break by rank-1 Answers, then alphabetically; the default label rule.
- §4.5 FR-17 — The Judge times out after 30 seconds per Question.
- §4.6 FR-20 — Group labels are 1 to 40 characters.
- §4.6 FR-21 — At most eight Groups per Question on the Board.
- §4.7 FR-23 — Two to four Teams.
- §4.7 FR-24 — Labels and Scores at no less than 48 px on a 1920×1080 play view.
- §5 NFR-1 — At most three setup commands after prerequisites.
