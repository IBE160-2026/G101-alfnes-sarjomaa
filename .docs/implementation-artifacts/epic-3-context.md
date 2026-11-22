# Epic 3 Context: Host closes Collection and the Answers become unlinkable

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The Host closes Collection once at least three Answer sets exist. The close is the one and only anonymisation step: in a single transaction every Answer set becomes unlinkable Answer rows, every Token hash and Answer set is deleted, every former Invite link says Collection is closed, and the Game moves to *grouping*. Dedicated tests then prove the anonymity guarantees, before and after close, on every run. Anonymity is the product: after this epic nothing stored, shown to the Host or logged can tie an Answer to an Invite link, to the same person's Answers under other Questions, or to arrival order. The Grouping runner itself is Epic 4; here the Game ends in *grouping* behind a status panel.

## Stories

- Story 3.1: Close Collection as the single anonymisation step
- Story 3.2: Anonymity test: schema and data after close
- Story 3.3: Anonymity tests: the Host's view during Collection, and log hygiene

## Requirements & Constraints

- **Close floor:** allowed only in *collecting* with at least 3 submitted Answer sets (`SUBMISSIONS_MIN` already in `src/lib/limits.ts`; the 180 s lease also belongs there). Below three, close is refused with a dedicated reason code (the planning docs give it no name), and the Game, links and submissions stay unchanged. The Host is told why and may create more links, wait or delete the Game. Neither the refusal nor any Host-visible value may reveal an exact count below three.
- **Final and complete:** nothing partial exists at close, because an unfinished form is never stored (only submitted sets are grouped). Closing cannot be undone.
- **After close:** every former link shows the closed page, decided from the Game in the URL before any Token lookup (close deletes every link, so closed must win over unknown). A submit arriving later is refused with `COLLECTION_CLOSED`, even from a form opened before close. A submit racing close is either included in the close or refused, never partial; both orders are tested.
- **FR-11:** no table holds a Participant's name, email, IP, user agent, device ID or account ID. No log or action result holds a Token, hash, edit secret, Answer text or `/svar` action argument.
- **FR-12:** while *collecting*, no Host page, response or export contains Answer text, a Token, a hash or per-link state, and no Host-visible value changes when a Participant submits. No setting, env variable, option or flag may weaken any of this.
- **FR-13, after close:**
  - No table holds a Token, Token hash, Invite link reference or Answer set identifier.
  - The Contributor key is random per Answer set and per Question, so Answers cannot be joined across Questions.
  - No timestamp, insertion sequence or increasing ID exists on Answers. Insertion order is shuffled across the whole Game.
  - Timestamp columns exist only on `host`, `session` and `game`.
- **Normalisation (FR-17 rule, stored at close as `normalized_text`):** Unicode NFC, locale-independent `toLowerCase()`, trim, collapse inner whitespace, strip trailing `.,!?;:…`. If nothing is left, use the trimmed lower-cased text. `src/lib/normalize.ts` exports `NORMALIZE_VERSION`.
- **Conventions:** new `ErrorCode` with bokmål message in `src/lib/errors.ts`; a foreign-ID case for close in `authz.test.ts`; a `WRONG_STATE` case for `closeCollection` in `game-state.test.ts` (the permitted-operations row already exists); test titles carry FR IDs and each story adds `tests/TRACE.md` rows; offline, no key.

## Technical Decisions

- **Entry point:** `collection.close` is a Host call. `lockForMutation` is taken with `hostId` and *collecting*, so foreign Games give `NOT_FOUND`, other states `WRONG_STATE`, and `updated_at` is touched. The Server Action and the Game page both export `maxDuration = 300` (Node runtime only).
- **Close transaction (AD-9), in order:**
  1. Lock and require at least 3 submissions.
  2. For each submission and each Question, draw a fresh `crypto.randomUUID()` Contributor key and build that Question's rows. `rank` is field index + 1; `text` as submitted; `normalized_text` from `normalize.ts`.
  3. Shuffle all the Game's rows together with a crypto Fisher-Yates (`src/lib/shuffle.ts`), then call `grouping.insertAnswers(tx, rows)` exactly once. Nothing else ever inserts into `answer`.
  4. Delete the Game's `submission` and `invite_link` rows.
  5. `games.transition(collecting → grouping)`, which also sets the new `game.grouping_lease_until` to now + 180 s.
- **Post-commit VACUUM:** after commit and outside any transaction, run `VACUUM FULL submission, invite_link` with `lock_timeout = '2s'`. Errors are swallowed and logged through `src/server/log.ts` by SQLSTATE only, and never fail the close. A forced failure is tested. The same best-effort step runs after deleting a *collecting* Game (extend `games.deleteOwned`).
- **Modules:** a new `grouping` module owns `answer` and exports writers taking `tx` first. `collection` may call it because it comes later in the module order (update the ESLint zones). Only the owner writes a table, so `collection` deletes only its own two. `answer.group_id` is nullable until Grouping.
- **`answer` columns (AD-10), exactly:** `id` (uuid v4, `gen_random_uuid()`), `question_id`, `contributor_key` (v4, nullable), `rank` (1 to 5, nullable), `text`, `normalized_text`, `group_id` (nullable). Banned on `answer`: serial, identity, sequence defaults, uuidv7, ULIDs, `created_at`/`updated_at`, anything that grows per insert. Host-facing queries never select `contributor_key` or `rank`.
- **Grouping handoff:** the close action ends with `after(() => grouping.run(gameId))`, and module functions never call `after()`. The runner arrives in Story 4.2, as do `acquireGroupingLease`, `resumeIfStale` and `answer_group`. Epic 3 only creates the lease column and its initial value.
- **Errors and logging:** the too-few reason is a new `ErrorCode`. `COLLECTION_CLOSED` already exists. Any non-`DomainError` becomes `INTERNAL`, so a DB failure never carries Answer text, a Token or an edit secret into a result or log. `log.ts` takes only `{ module, op, code, sqlstate }`.
- **Required test files (AD-22):**
  - `tests/integration/anonymity.test.ts` inspects `information_schema` and the data after close.
  - `tests/integration/host-view.test.ts` covers every Host read and action while *collecting*.
  - `tests/integration/collection.test.ts` gets the close, late-submit and both race orders, plus a forced DB error in `openInviteLink` and `submitAnswerSet`.
  - `tests/e2e/host-anonymity.spec.ts` plus a Playwright capture of the Next server's stdout and stderr that fails the run if a Token or Answer text used in it appears.
  - `tests/unit` gets normalisation and shuffle tests.
  - `env.test.ts` also gets the fixed-list check below.
- **What the anonymity tests assert:**
  - No timestamp column outside `host`, `session` and `game`.
  - `answer` has exactly the seven columns and none is serial, identity or sequence-defaulted.
  - No column holds a Token, hash, link reference or set ID once `invite_link` and `submission` are empty.
  - Token hashes captured before close appear in no text or uuid column of any table afterwards.
  - No Contributor key repeats across Questions, and every `answer.id` is a v4 UUID.
  - No Participant name, email, IP, user agent, device ID or account ID column exists outside `host` and `session`.
  - Host outputs before and after a submit differ only in the progress count once it reaches three.
  - Fixed expected lists for the `env.ts` keys and the `game` columns, so adding anything that could weaken the anonymity rules fails.

## UX & Interaction Patterns

- **Collecting panel:** the primary action "Steng innsamlingen" sits under ProgressCount, which shows "færre enn 3 av N svar mottatt" below three. Below three it is `aria-disabled` with visible text: "Du trenger minst 3 innsendte svar før du kan stenge. Det beskytter anonymiteten. Lag flere lenker, vent litt, eller slett spillet." Enablement follows `progress.submissions` (the literal `"fewer-than-3"` or a number), and the server re-checks under the lock.
- **ConfirmDialog (from three):** "Stenge innsamlingen? Dette kan ikke angres. Lenkene slutter å virke, og svarene grupperes." With no model key configured it adds: "Ingen KI-nøkkel er satt opp, så du grupperer for hånd i gjennomgangen." Native `<dialog>` with `showModal()`, focus starts on cancel, Esc cancels, focus returns to the trigger, never stacked. The button follows the pending pattern: in-progress verb, spinner, `aria-busy`, repeat clicks ignored.
- **After confirming:** StatusBadge "Grupperer" and the panel text "Dommeren, en KI-modell, grupperer svarene … Det tar vanligvis under to minutter." This is the only place the Judge is explained. The "N av M spørsmål ferdig" line and 3 s polling come in Epic 4.
- **Participant closed page:** "Innsamlingen er stengt." with "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres." and no form. A revoked link shows the same once closed.
- **Late submit** (form opened before close): "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret." The `localStorage` key is removed, but only if its stored Token equals the current Token exactly.
- **Voice and a11y:** bokmål "du", no exclamation marks, errors say what happened and then what to do, 44 px targets, visible focus, WCAG 2.1 AA.

## Cross-Story Dependencies

- 3.1 creates the `grouping` module, the `answer` table, `game.grouping_lease_until`, the new `ErrorCode` and the close action and panel. 3.2 needs a real close to inspect. 3.3 needs only Epic 2 plus the 3.1 `game` column, since its fixed `game` column list must include `invite_links_issued` and `grouping_lease_until`.
- Planning inconsistency to settle in 3.1: its text says `answer.group_id` arrives with Story 4.2, but 3.2 expects `answer` to have all seven AD-10 columns after close.
- Uses Epic 1 and 2: `lockForMutation`, `transition`, the state table, `collection.progress` and `linkStatus`, `openInviteLink` and `submit`, ConfirmDialog, Button, Notice, StatusBadge, ProgressCount, the `log.ts` boundary and the existing authz, game-state and collection tests. Keep Host pages free of per-link state and Answer text so the host-view tests pass.
- Epic 4 builds on this: `grouping.run`, the lease acquire and extend, `answer_group` and the grouping progress panel. Epic 5 extends `anonymity.test.ts` with the after-confirm checks (`clearContributorData`). Epic 7's traceability map needs the TRACE rows from all three stories.
