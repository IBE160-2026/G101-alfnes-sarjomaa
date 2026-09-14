## Case Title

Toppsvar — a party game built from a group's own survey answers

## Background

A Family Feud round is funny in proportion to how well the room knows the people being named. The questions that land are about somebody sitting three seats away, and there is no product that helps a host make those. Existing tools each cover one third of the job: form tools collect free-text answers but never aggregate them, quiz tools score against a predetermined correct answer rather than the most common one, and Family Feud apps ship fixed questions about the general public.

The result is that hosts assemble the game by hand. Before one housewarming party a host built a fifteen-question form about a named friend group, then read every free-text response and merged duplicates manually, then drew the board on paper and tracked the score by hand. It worked for one evening and was never repeated. The form tool could not ask for several ranked answers, so the instruction "give at least two answers in priority order, in the same text box, and do not submit again" had to be written into the questions themselves. It promised anonymity while displaying each respondent's signed-in account above the questions.

## Purpose

Toppsvar turns collection, aggregation and play into one application, so that running the game costs minutes rather than an evening and can therefore happen more than once.

The application solves three problems the host currently solves manually: it collects several ranked free-text answers per question without duplicate submissions, it groups answers that mean the same thing into ranked top-lists using a language model with the host confirming the result, and it presents a playable board with scoring. A set of ready-made questions with known answer distributions ships with the product, so a group can play immediately without waiting days for a form to fill.

## Target Users

**Primary: the host.** The person who creates and runs the game — someone organising a party, a team social, a class introduction week, or a family gathering. This is the only user with a real problem today: writing the form, chasing responses, tallying free text, building the board and keeping score all fall on them. The host is assumed to be comfortable with ordinary web applications but is not technical.

**Secondary: the participants.** Eight to thirty people in a closed group who already know each other. They answer anonymously in the days before the event and then play in teams on the night. Their current experience is adequate; what changes for them is the ability to give properly ranked answers, to reopen and extend a submission, and to trust the anonymity.

The groups are closed by definition. Toppsvar is not intended for games between strangers, because the questions only work when the subjects are in the room.

## Core Functionality

### Must Have (MVP)

- **Host account and game creation:** register, log in, create a game, give it a name
- **Question authoring:** write free-text questions about named people in the group; set the number of ranked answers requested per question
- **Ready-made question sets:** open a shipped set of general questions with known answer distributions and play without any collection round
- **Participant invitation:** share a link or code; no participant account required
- **Answer collection:** several ranked answers per question as separate fields; an unfinished submission can be reopened and extended through the same link
- **Anonymous storage:** answers stored without any identifying field, shuffled, without submission timestamps
- **Collection close:** the host closes the form, freezing the answer set
- **Automatic grouping:** a language model judges which answers mean the same thing; groups are ranked by how many participants gave each
- **Host review:** merge, split, rename, reorder and discard groups before play; manual grouping available as a fallback
- **Play view:** a shared-screen board showing one question at a time with hidden answer slots, reveal on correct guess, and scoring for two or more teams
- **Assisted guess matching:** the host types in a spoken guess and the system proposes which group it matches; the host confirms before the reveal
- **Game deletion:** delete a game and all its answers at any time

### Nice to Have (Optional Extensions)

- Strikes, steal rounds and a final double-points round, as in the televised format
- Export of a finished board and scores as a PDF or image
- A second host who can co-manage the same game
- Question suggestions generated for a named person from a short description
- Reminder to participants who have not yet submitted
- A dark presentation theme for projectors

## Data Requirements

- **Host** — id, email, password hash, created_at
- **Game** — id, host_id, title, status (draft, collecting, grouping, playing, closed), created_at, closed_at
- **Question** — id, game_id, text, position, answers_requested, source (custom or preset)
- **Answer** — id, question_id, text, rank, submission_token_hash. Deliberately contains no participant identity
- **SubmissionToken** — hash, game_id, created_at. Lets a participant reopen their own submission; deleted when collection closes
- **AnswerGroup** — id, question_id, label, member_count, position, confirmed_by_host
- **AnswerGroupMember** — answer_id, group_id
- **Team** — id, game_id, name, score
- **PresetQuestion** — id, text, category
- **PresetAnswerGroup** — id, preset_question_id, label, share

The preset tables are seeded from ProtoQA, a public dataset of Family Feud survey questions whose answers were collected from about a hundred people each and clustered by hand, released under CC-BY-4.0.

## User Stories

1. As a host, I want to write questions about my own friends, so that the game is about the people in the room rather than strangers.
2. As a host, I want answers that mean the same thing merged automatically, so that I do not spend an evening tallying free text by hand.
3. As a host, I want to correct a grouping before we play, so that a wrong merge does not surface in front of the group.
4. As a host, I want to start from ready-made questions, so that we can play tonight without waiting for a form to fill.
5. As a participant, I want to give several answers in priority order, so that I am not forced to cram them into one text box.
6. As a participant, I want my answers to be genuinely anonymous, so that I can give the funny answer instead of the safe one.
7. As a participant, I want to add to my submission later, so that I do not have to fill the whole form in one sitting.

## User Flows

### Flow 1: Host creates and runs a custom game

The host registers, creates a game, and writes eight to fifteen questions naming people in the group. The application generates a share link. The host sends the link to the group and watches a submitted-count rise over the following days. When enough answers are in, the host closes collection. The application groups the answers and presents each question with its proposed groups and counts. The host merges two groups that mean the same thing, splits one that does not, renames a third, and confirms. On the night, the host opens the play view on a television, creates two teams, and runs the board.

### Flow 2: Participant answers anonymously

A participant opens the link on their phone. No login is requested. Each question shows several ranked answer fields. They fill in six of fifteen questions and close the tab. Two days later they reopen the same link on the same device and their previous answers are still there; they complete the rest and submit. Nothing on screen shows an account or an identity.

### Flow 3: Playing from a ready-made set

A host with no time to collect opens a ready-made question set, picks six questions, creates two teams and starts immediately. The board shows the answer distribution already collected in the source dataset.

## Technical Constraints

- Must be responsive: participants answer on phones, the host reviews on a laptop, the board is shown on a television or projector
- Must work as a plain web application with no installation for participants
- Must not store any field linking a participant to an answer
- Must remain usable when the language model is unavailable, by falling back to manual grouping
- Grouping must complete in under a minute for thirty participants across fifteen questions
- Built and delivered by two students within the course timeframe, alongside the documentation the course requires

## Success Criteria

- **Host autonomy:** three test hosts recruited outside the project group each build a form of eight to fifteen questions and collect answers from ten to thirty participants, with no developer help. At least one runs a full round to a final score at a real gathering
- **Grouping quality:** the judge reproduces ProtoQA's hand-built clusters for at least seven of every ten answers; in live use the host accepts at least seven of every ten proposed groups without modification
- **Anonymity:** a reviewer holding host access and the invite list cannot attribute any answer to a person — no stored field, timestamp or ordering supports it
- **Performance:** grouping completes within one minute for a thirty-participant, fifteen-question game; the play view advances between questions without a visible delay
- **Repeat use:** at least two of the three test groups ask for a second game within four weeks

## Technical Specifications

### Frontend

Next.js 15 with React and TypeScript, styled with Tailwind CSS and shadcn/ui components. Three distinct surfaces share one codebase: a mobile-first answering form, a laptop-oriented review screen with drag-and-drop regrouping, and a large-type play board intended for a television. Server components are used for data loading and client components for the interactive review and play views. Deployed on Vercel.

### Backend

Next.js route handlers on the same deployment, giving a single TypeScript codebase rather than a separate service. Endpoints are REST-shaped and grouped by resource: games, questions, answers, groups and teams. Grouping is triggered by an explicit close-collection call rather than running continuously, which keeps model usage bounded and predictable. Server-side validation guards every write, since participants are unauthenticated by design.

### Database

PostgreSQL, hosted on Supabase. Relational rather than document-oriented, because the data is highly relational — answers belong to questions belong to games, and grouping is a many-to-one relation over answers that is edited repeatedly. The schema is the entity list given under Data Requirements. Row-level security restricts every game to its owning host. The `answer` table intentionally carries no participant foreign key; the submission token is stored only as a hash and its row is deleted at collection close.

### AI Integration

The grouping step uses a large language model as a judge. Given a question and a set of candidate answers, the model decides which answers mean the same thing, and the resulting rulings form the groups. The same mechanism supports play-time guess matching, where the model proposes which existing group a team's spoken guess belongs to.

A small, fast model is appropriate — Claude Haiku 4.5 is the intended default, accessed through the Anthropic API, with the call isolated behind a single interface so another provider can be substituted. Grouping runs once, at collection close, and the result is stored, because a language model is not deterministic and a board must not change between rounds.

Quality is measured against ProtoQA, whose answer clusters were built by hand from roughly a hundred human answers per question, giving a genuine ground truth rather than self-assessment. The host confirms every grouping before play, which is a design decision rather than a safety net: whether two answers are "the same" often depends on a group's own humour, which the model cannot know.

### Platform Type

A responsive web application, no native app. Target browsers are current Chrome, Safari, Firefox and Edge. Three viewport classes are supported explicitly: phone from 360px for answering, laptop from 1024px for review, and television or projector at 1920px for the board. Phone support for the play board is out of scope, since the board is designed to be seen by a room.

### User Authentication

Authentication exists for hosts only, via Supabase Auth with email and password. **Participants deliberately have no accounts and no login.** This is a product requirement, not an omission: requiring an identity to answer would undermine the anonymity the answers depend on, and it was the specific failure of the form tool that inspired the project. Access to a game is by unguessable link or code, and a participant's ability to reopen their own submission is carried by an opaque token held in their browser, never shown to the host, and deleted when collection closes.

### Payment System

**No payment system, and none is planned.** Nothing is sold, there are no tiers and no subscriptions. The product is a party game for closed groups, and introducing billing would add account management, a payment provider integration and compliance obligations without serving any user need within the project scope.

## Timeline and Milestones

The course runs the BMAD method in four phases. Week numbers follow the course schedule.

- **Week 43 — Analysis and planning.** Product brief completed (done) and PRD written. Product decisions settled: primary user, grouping approach, anonymity model, scope boundaries.
- **Week 44 — Solution architecture.** Data model finalised, API surface defined, judge interface and prompt strategy designed, ProtoQA import written and the preset tables seeded.
- **Week 45 — UX specification.** The three surfaces designed: answering form, grouping review, play board. Component inventory and states documented. Project scaffolded and deployed to Vercel with the database live.
- **Week 46 — Implementation, first half.** Host accounts, game and question authoring, the answering form with ranked fields and the reopen token, anonymous storage, collection close.
- **Week 47 — Implementation, second half.** Grouping through the judge, the host review screen, the play board with scoring and assisted guess matching. Grouping quality measured against ProtoQA. Feature-complete application.
- **Week 48 — Testing and reflection report.** Three external test hosts run real games; results feed the success criteria. Reflection report drafted from the prompt archive kept throughout.
- **Week 49 — Delivery.** Reflection report finished. Repository delivered as a zip with the report on 5 December.

## Risk Assessment

- **Grouping quality is the core technical risk.** Slang, nicknames and near-misses that must stay apart are harder than the general clustering problem, and there is no ground truth for a group's own humour. Mitigated by measuring against ProtoQA, by making host review mandatory rather than optional, and by shipping manual grouping so the product works even if the judge disappoints.
- **The review screen is the largest interface risk.** Merging, splitting and renaming groups across fifteen questions is the most complex interaction in the product and the easiest to underestimate. Mitigated by designing it in week 45 rather than during implementation, and by accepting a plain list-based interaction if drag-and-drop proves too costly.
- **Testing depends on other people.** The success criteria require three external hosts running real games, which cannot be scheduled entirely by the project group. Mitigated by recruiting test hosts in week 46, before the application is finished, and by the ready-made question sets, which allow a test session without a week of lead time.
- **Scope growth toward the televised format.** Strikes, steals and double rounds are tempting and are deliberately in the optional list. The first version proves that a group can go from an empty form to a finished board; game-show mechanics are additions, not prerequisites.
- **Model cost and latency** are bounded by grouping once at collection close rather than continuously, and by using a small model. A thirty-participant game is a few hundred short comparisons, not a sustained workload.
