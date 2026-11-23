# Anonymity audit (SM-3)

SM-3 asks whether anyone with Host access, the Invite-link list and the database can tie an Answer to the link that sent it, or join Answers across Questions as coming from the same person. The automated tests prove each mechanism one at a time (FR-11 to FR-13 in `tests/TRACE.md`). This audit looks at them together, the way a curious Host or database operator would.

**Who runs it.** Someone who was not involved in the last change to the code that touches Answers, links or the database (`src/server/collection`, `src/server/grouping`, `src/server/review`, `src/server/db`, `drizzle/`). Note that change's commit in the table. The AI that builds the app does not run the audit.

**When.** Once before the Stage 1 freeze (1 December), and again if any of those paths change before hand-in.

## Ground truth

When two people are available, one sends the Answer sets and keeps the ground truth, and the other is the reviewer, who works only from the Host screens, the link list and the dump. With one person, the reviewer plays both Host and Participants, so they know who wrote what. Before closing the Collection, they write down, on paper or in a file outside the repository, which link sent which Answers under which Question. That note is the ground truth. It is never committed and is destroyed after the audit.

An Answer counts as **attributable** if, using only what the Host screens, the link list and the dump show, the reviewer can name the link that sent it, or name another Answer from the same Answer set under a different Question, and the guess is better than chance. The text of an Answer is not counted: the Host reads every Answer as written, which the README already states as a limit. That is why the Participants below give Answers that overlap and do not reveal who wrote them. What the audit looks for is linkage the system adds: order, keys, IDs, timestamps, counts or leftovers from the link tables.

## Procedure

1. Start the production build on a fresh database. The directory name is new, so nothing old is in it:

   ```bash
   npm run build
   DATABASE_URL=pglite://.data/audit JUDGE_PROVIDER=replay npm run start
   ```

   If `.data/audit` exists from an earlier audit, delete it first. `replay` with no Stored ruling makes every Question fall back to one Group per distinct Answer, and no model is called.

2. At `http://localhost:3000/registrer`, register a Host with an invented email (for example `revisor@toppsvar.test`), create a Game and add three Questions.
3. Create five Invite links and copy the list when it is shown. This is the Invite-link list.
4. Open links 1 to 4, each in its own private browser window, and send an Answer set from each. Use two or three Answers per Question, drawn from the same small pool for every link (for example "Kaffe", "Te", "Kakao", "Vann" for one Question). Write down the ground truth as you go. Leave link 5 unused.
5. As Host, revoke link 4 by pasting it and choosing "Trekk tilbake og lag ny". Its Answer set must not reach the Game, and the new link it gives stays unused.
6. Close the Collection. When Grouping is done, merge at least two Groups, mark every Question as reviewed and lock the Board.
7. Right after the Board is locked, before any play, stop the server (Ctrl+C), since PGlite allows one process at a time, and dump the database:

   ```bash
   DATABASE_URL=pglite://.data/audit npm run --silent db:dump > .data/audit-dump.json
   ```

   The dump is JSON: every table in `public`, rows in physical order with `ctid` (where the row lies on disk) and `xmin` (the transaction that last wrote it). It stays under `.data/`, which git ignores. `db:dump` refuses a directory that does not exist, so a mistyped path cannot give an empty dump.

8. Start the server again with the command from step 1. With Host access, look at every Host screen of the Game: the Game page, Review for each Question, the play view and "Sluttstilling" after a full round, and the usage report (`Last ned bruksrapport`). Try to attribute Answers as defined above.
9. Read the dump with the ground truth beside it. At least:
   - `invite_link` and `submission` are empty, and no table holds a link's Token or hash.
   - In `answer`, `contributor_key` and `rank` are empty after the Board lock, and no column holds a time or a link.
   - All `answer` rows share one `xmin`: the Board lock's transaction, since `confirmBoard` clears every Answer's key and rank and so rewrites every row. Check whether the physical order of the `answer` rows (`ctid`) correlates with the ground-truth sets or the order they were sent. It should not.
   - `answer_group`, `board_slot`, `grouping_result` and `game_counter` hold nothing that names a link or a set.
   - Link 4's revoked Answer set appears nowhere.

   Out of scope: the raw data files and the write-ahead log under `.data/audit`. Deleted rows can survive there for a while, which the README states as a known limit.

10. Record the result below, then delete `.data/audit`, `.data/audit-dump.json` and the ground-truth note.

## Record

Pass means no Answer was attributable to a link and none could be joined across Questions. A fail needs a fix and a new audit before SM-1 can pass.

| Date | Reviewer (initials only) | Commit audited (`git rev-parse --short HEAD`) | Last change to the paths above (commit, author's initials) | Result | Notes |
| ---- | ------------------------ | --------------------------------------------- | ---------------------------------------------------------- | ------ | ----- |
|      |                          |                                               |                                                            |        |       |
