---
title: Toppsvar Epics and Stories
status: final
created: 2026-11-21
updated: 2026-11-25
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - .docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md
  - .docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md
  - .docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/delivery-notes.md
  - .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md
  - .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md
stories: {stage1: 34, stage2: 4}
decisions: see "Decisions Made During Breakdown" at the end of this document
---

# Toppsvar - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Toppsvar, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

Condensed from PRD §4. The PRD's testable consequences are the binding detail; story acceptance criteria cite them by FR number.

**Stage 1**

- FR-1: Host account. Register with email and password, log in, log out. Passwords of at least 10 characters, stored only as a salted slow hash; one generic message for a wrong email or password; session expires after 14 days without use; a request for another Host's Game gets the same response as a missing Game; no Invite link page offers or requires a login.
- FR-2: Create and list Games. Title 1 to 80 characters; a new Game starts in *draft*; a Host never sees another Host's Games in a list or by URL.
- FR-3: Delete a Game. Possible in any state and removes every child row; its Invite links then respond as unknown; automatic deletion 30 days after *played* (the Host is told when play ends) and 90 days after the last change for a Game never played.
- FR-4: Write and edit Questions. Add, edit, reorder, remove in *draft* only; at most 20 Questions of 1 to 200 characters; any change after Collection opens is refused.
- FR-5: Create Invite links. In *draft* or *collecting*; the first batch opens Collection; refused with zero Questions; Tokens of at least 128 bits from a CSPRNG, unique across Games; full links displayed once only; at most 50 per Game including revoked ones.
- FR-6: Answer through an Invite link. Every Question shown; 1 to 5 ranked Answers per Question in separate fields; saved only when every Question has at least one Answer, otherwise the form names the missing Questions; empty fields ignored; Answers over 80 characters refused with a message; no identity on the form.
- FR-7: Change a submitted Answer set (amended 2026-11-21). On the submitting device only: the same link shows the earlier Answers and allows add, change, remove until close; one link never produces two Answer sets; without the device's edit secret the form is empty and a submit replaces the earlier set; the confirmation says Answers can be changed on this device until close.
- FR-8: Collection progress. A count of submitted Answer sets out of active links, never which links were used; reads "fewer than 3" below three.
- FR-9: Revoke and replace an Invite link. By pasting the link while Collection is open; one replacement link shown once; the revoked link responds as unknown; its Answer set is deleted; the Host is warned the same way whether or not a set existed.
- FR-10: Close Collection. Requires at least three Answer sets, otherwise refused with the reason; final; deletes every Token hash; starts Grouping; afterwards every link of the Game shows Collection closed, decided by the Game in the URL; a submission after close is refused even if the form was opened before.
- FR-11: No identity in the answering flow. No table holds a Participant's name, email, IP, device fingerprint or account ID; logs written while handling an Invite link hold neither Token nor Answer text.
- FR-12: Nothing linkable in the Host's view. No Host page, response or export links an Answer or Answer set to an Invite link; the Host reads no Answer before close (automated Host-session test during Collection); after close Review groups Answers by Group only; no setting disables §4.4.
- FR-13: Unlinkable storage after close. No Token, Token hash, Invite link reference or Answer set ID stored; each Answer carries only a per-Question random Contributor key; no submission time, insertion sequence or increasing ID; an automated schema and data inspection after close enforces it.
- FR-14: Honest anonymity notice. Two sentences or fewer, above the first Question, no stronger claim than PRD §1.1, and that Answers may be sent to an external AI service; README documents the pre-close database risk.
- FR-15: Judge Grouping at close. Runs exactly once per Game, never re-run by reopening Review; Count counts distinct Contributor keys; the sizing Game (30 sets, 15 Questions, up to 5 Answers) groups within two minutes; each Stored ruling records prompt version and model ID; tests and Demo mode make no network call.
- FR-16: Ranking and labels. Groups rank by Count; ties by number of rank-1 Answers, then alphabetically by label; default label is the most frequent normalised Answer text, ties by shortest.
- FR-17: Manual Grouping fallback. No key, Judge failure or more than 30 s on a Question gives one Group per distinct normalised text; with no key, close succeeds and Review opens with fallback Groups everywhere; on partial failure the Host is told which Questions fell back and the others keep the Judge's proposals.
- FR-18: Content-free usage counters. Judge-proposed Groups, Groups changed by merge, move, rename or discard, Judge calls, fallback per Question; exportable as a local report; deleted with the Game.
- FR-19: Review display. Every Group with label, Count and Answers in Board order; Groups below the Board limit listed separately and marked not shown in play; every Answer under exactly one Group; no confidence signal.
- FR-20: Correct the Grouping. Merge, move selected Answers to a new or existing Group, rename (1 to 40 characters), discard; Counts recalculated as distinct Contributor keys; merged Group keeps the label of the highest-Count source (ties by rank); discarded Groups stay visible in Review under a discarded heading and never reach play; any change clears the Question's reviewed mark.
- FR-21: Mark reviewed and confirm the Board. Board shows at most eight highest-ranked non-discarded Groups per Question; confirm needs every Question reviewed, moves the Game to *ready* and locks every Review operation.
- FR-23: Set up Teams. Two to four Teams; only from *ready*; every Team starts at zero; Game moves to *playing*.
- FR-24: Show the Board. One Question at a time, Groups hidden with their number visible, current Team and every Score; fills a 1920×1080 window with labels and Scores at 48 px or more (manual check); never raw Answers or discarded Groups.
- FR-25: Mark a match or a miss. A click on a Group makes a scored Reveal of label and Count and adds the Count to the current Team; Score always equals the sum of its scored Reveals' Counts; clicking an already revealed Group is refused.
- FR-26: Undo. The most recent Reveal on the current Question, scored or unscored; hides the Group and subtracts its Count from the Team that got it.
- FR-27: Turns and moving on. Manual next Team and next Question; unscored Reveals change no Score; after the last Question the final Scores show and the Game moves to *played*; play state survives a reload.
- FR-30: Full Stage 1 without a key. An automated end-to-end test with no key and no network to a model provider goes from creation through Collection, close, fallback Grouping, Review and play to a final Score.
- FR-31: Demo mode. Demo Host and a demo Game in *collecting* with invented Answer sets and Stored rulings; closing gives Judge-proposed Groups with no network call; nothing from a real group; the README gives the single command and the demo login.
- FR-32: Judge evaluation. One command scores the Judge against ProtoQA's crowdsourced clusters; replays Stored rulings by default, live regeneration is explicit; reports B-cubed precision, recall, F1, Judge calls per Question, prompt version and model ID; only the crowdsourced portion is committed, with CC-BY-4.0 attribution.

**Stage 2 (only after SM-1 passes)**

- FR-22: Reorder Groups. A manual order survives until confirmation and play uses it.
- FR-28: Assisted Guess matching. The Host types a Guess, the Judge proposes a Group, the Host confirms before any Reveal; without a key play works as FR-25; typed Guesses are deleted at *played*.
- FR-29: Additional scoring rules. Strikes and steals, switchable per Game; rules decided when Stage 2 starts.
- FR-33: Play a Question set. A Game created from a ProtoQA Question set starts in *ready*; Board equals the dataset clusters and Counts capped at eight; source credited on the play screen and in the README; Norwegian translation with Counts unchanged, credited as translated and adapted.

### NonFunctional Requirements

- NFR-1: Local runnability. A fresh clone runs from the README with no paid account, no group-owned hosted service and no model key, in at most three commands after the prerequisites.
- NFR-2: Deployability. The same build deploys to a public host for pilot use; local and deployed runs differ only in configuration; the examiner path never depends on it.
- NFR-3: Tests without network. The full suite passes offline; unit tests cover Score, ranking, Count recalculation and Token generation; Judge calls use Stored rulings or mocks by default, live calls are opt-in.
- NFR-4: Devices. Answer form at 360 px on a current mobile browser; Review on a laptop; play view on 1920×1080.
- NFR-5: Responsiveness. Every Host action in Review and play shows its result within one second, Grouping excluded.
- NFR-6: Accessibility. WCAG 2.1 AA contrast for text and controls; the answer form fully usable by keyboard and screen reader.
- NFR-7: Language. Interface in Norwegian bokmål.
- NFR-8: Secrets. Nothing secret committed; configuration from an untracked env file; a committed example file lists every variable.

### Additional Requirements

From `ARCHITECTURE-SPINE.md` (AD-n) and `delivery-notes.md`.

- **Starter (affects Story 1.1).** No third-party template: the Next.js 16.4.6 App Router starter (TypeScript, Tailwind CSS 4, ESLint) at the repo root, with the Stack table's pinned versions. Remove the starter's `@types/node ^20`, its `next/font/google` layout and `lang="en"`. Folder layout follows the Structural Seed.
- **AD-1 Layers.** `src/app` and `src/components` never import `src/server/db` or a Judge provider; modules call only earlier modules (auth · games · questions → grouping → collection · review → play); one owning module per table; entry points open the transaction, exported writers take `tx: Tx` first; every `src/server` file starts with `import 'server-only'`; ESLint `no-restricted-imports` zones enforce it.
- **AD-2 DB driver by `DATABASE_URL`.** `pglite://<dir>`, `pglite://:memory:`, `postgres(ql)://` (postgres.js, `prepare: false`), default `pglite://.data/local`; only `src/server/db/client.ts` picks the driver; dynamic driver import; directory created recursively; singleton on `globalThis`; `serverExternalPackages`; every DB-reading route calls `await connection()`. Fallback if in-process PGlite fails under Next: `pglite-server --run` with postgres.js, changing only `client.ts`.
- **AD-3 Schema and migrations.** Schema only in `src/server/db/schema.ts`; `npm run db:generate` writes committed SQL to `drizzle/`, never edited after merge; `npm run db:migrate`; automatic migration for `pglite://` in dev, demo and tests; CI runs `drizzle-kit check`; core Postgres only.
- **AD-4 State machine.** `game.state` ∈ draft, collecting, grouping, in_review, ready, playing, played; every state-dependent mutation starts with `games.lockForMutation(tx, { hostId?, gameId, states })`; transitions only via compare-and-set `games.transition`; permitted-operations table in `src/lib/game-state.ts`, walked by an integration test; deletion allowed in every state.
- **AD-5 Authorisation.** `auth.requireHost()` on every Host page and action; the Game via `lockForMutation` or `games.getOwned`, both `NOT_FOUND` for missing or foreign; every child ID and pasted link resolved inside the owned `gameId`, and one Review operation's IDs share one `question_id`; `NOT_FOUND` renders the bokmål 404, and under `/svar` its own unknown-link page.
- **AD-6 Auth.** Passwords 10 to 256 characters; `node:crypto` scrypt `N=2^17, r=8, p=1`, 16-byte salt, params in the hash string; at most 2 concurrent scrypt runs per process; dummy hash for unknown emails; lockout doubling after 5 failures; 32-byte session token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` when `APP_BASE_URL` is https), `Max-Age` 14 days, DB stores only `sha256(token)`, `expires_at` authoritative and extended at most hourly; `REGISTRATION_CODE` when set; no auth code under `/svar`.
- **AD-7 Invite links.** `<APP_BASE_URL>/svar/<gameId>#<token>`; 32-byte base64url Token, only `sha256` stored as `invite_link.token_hash` primary key; generic server shell (title "Toppsvar", `noindex`, no Open Graph, no Game title or Questions, `Referrer-Policy: no-referrer`, no session read) showing only unknown, closed or open; Questions and saved sets only via Server Action `openInviteLink(gameId, token, editSecret?)`; submits via `submitAnswerSet`; lookup by `(token_hash, game_id)` then lock and re-check `collecting`; nothing logs a token, hash, edit secret, Answer or `/svar` argument.
- **AD-8 Pre-close storage.** `submission` keyed by `invite_link.token_hash` with cascade, `answers jsonb` shaped `{ [questionId]: string[] }` validated by `src/lib/answer-set.ts` and again against stored Question IDs, `edit_secret_hash`; browser-generated 32-byte edit secret in `localStorage` key `toppsvar:<gameId>:<first 16 chars of token>` (also holds the draft, no browser hashing), cleared on closed or unknown; revoke refused with `LINK_CAP_REACHED` at 50 issued, inline `LINK_UNKNOWN` for an unmatched paste, same response whether a set existed; all link creation through `games.reserveInviteLinks`; `collection.progress` returns active links, `issued`, submissions ("fewer than 3" below three); no Host-visible value changes when a Participant submits.
- **AD-9 Close.** One transaction: lock `collecting`, require 3 submissions, fresh `crypto.randomUUID()` Contributor key per submission and Question, crypto Fisher-Yates shuffle of all the Game's Answer rows, one `grouping.insertAnswers` call, delete `submission` and `invite_link` rows, transition to `grouping` with a 180 s lease; best-effort `VACUUM FULL` afterwards (also after deleting a `collecting` Game); then Grouping via `after()`.
- **AD-10 Answer table.** Exactly `id`, `question_id`, `contributor_key`, `rank`, `text`, `normalized_text`, `group_id`; no serial, identity, uuidv7, ULID or timestamps on `answer` and `answer_group`; Host DTOs never select `contributor_key` or `rank`; Review gets `count` and `rank1_count` as aggregates and Answers sorted by `normalized_text`, `text`; `clearContributorData` at confirm; `tests/integration/anonymity.test.ts` after close and after confirm.
- **AD-11 Count, Score, ranking.** Count = SQL `count(distinct contributor_key)`; Score = SQL sum of `board_slot.count` over scored reveals; order and Board cut only via `rankGroups()` and `boardCut()` in `src/lib/ranking.ts` (Count, rank-1 count, `Intl.Collator('nb')` label, `groupId`); default label rule cut to 40 characters at a word boundary; effective label `custom_label ?? defaultLabel`; merge keeps the highest-ranked source's ID and freezes its label.
- **AD-12 Grouping.** `src/lib/normalize.ts` with `NORMALIZE_VERSION`; items = distinct normalised texts sorted by code unit; one `judge.partition` per Question under a 30 s `AbortSignal`, at most 5 concurrent, never inside a transaction; any throw falls back with `fallback_reason` ∈ NO_KEY, NO_STORED_RULING, TIMEOUT, ERROR, REFUSAL, INVALID_OUTPUT; one transaction per Question writes Groups (`origin` judge or fallback), `answer.group_id`, `grouping_result` (unique per Question) and counters, skipping done Questions; `after(() => grouping.run(gameId))` from the close action, `resumeIfStale` with a lease from Host page loads, `finishIfComplete` to `in_review`; quiet stop if the Game was deleted; `grouping.progress`.
- **AD-13 Judge.** `getJudge()`, `JudgeError(reason)` and the `Judge.partition` interface in `src/server/judge/index.ts`; `JUDGE_PROVIDER` (default openrouter with `OPENROUTER_API_KEY`, else replay); output validated and canonicalised, else `INVALID_OUTPUT`; replay by `normalize(question)` with uncovered items as own clusters, miss throws NO_KEY or NO_STORED_RULING; openrouter uses an exact stored ruling first, else built-in `fetch` to OpenRouter chat completions with `JUDGE_MODEL` (default `deepseek/deepseek-v4.1-flash`), strict JSON-schema `response_format`, `temperature: 0`, bounded `max_tokens`, `provider: { require_parameters: true, data_collection: "deny" }`, one retry inside the signal, TIMEOUT and REFUSAL mapped; mock for Vitest only; prompt and `PROMPT_VERSION` only in `prompt.ts`; nothing outside `src/server/judge` imports a provider or calls the model endpoint; no Stage 2 `match` stub.
- **AD-14 Ruling format.** `{ kind: "partition", promptVersion, normalizeVersion, model, question, items, assignments }`; fixtures `data/rulings/demo.json` and `data/rulings/protoqa-dev.json`, written only by `npm run judge:record`; per Game the materialised Groups plus `grouping_result`.
- **AD-15 Board snapshot.** Review edits only through `grouping` writers, each edit bumps `edit_count`, counters and clears reviewed; marking reviewed refused with `NO_GROUPS_ON_BOARD` when no non-discarded Group; `confirmBoard` writes `board_slot` from `boardCut(rankGroups())`, clears contributor data, moves to `ready`; play reads only `board_slot` via `review.getBoard`.
- **AD-16 Play log.** Dense `question.position`, renumbered on remove or reorder, frozen after draft; `team(name 1..14, position)`, `play_state`, `reveal(board_slot_id unique, team_id nullable, seq)`; reveal takes `{ boardSlotId, scored }`, Team from `play_state`, `WRONG_QUESTION` and `ALREADY_REVEALED`; undo deletes the highest-seq reveal on the current Question; next Question by position, `finish` sets `played_at` and returns `deleteAfter`; play view rendered from saved state.
- **AD-17 Actions and errors.** Reads in server components plus `revalidatePath`; mutations and token reads are Server Actions with sibling zod `schema.ts`, re-validated in module entry points; result `{ ok: true, data } | { ok: false, code, message, fieldErrors? }`; closed `ErrorCode` union with bokmål messages in `src/lib/errors.ts`; non-domain errors become `DomainError('INTERNAL')`; `src/server/log.ts` takes only `{ module, op, code, sqlstate }`; Route Handlers only `GET /api/health`, `GET /api/purge`, `GET /api/spill/[gameId]/rapport`; polling every 3 s in `grouping`, every 30 s in `collecting`.
- **AD-18 Counters.** `game_counter` columns as listed; only `games.bumpCounters`; the report returns counters, each Question's source and fallback, every Group's origin and edit count.
- **AD-19 Demo.** `npm run demo` → `src/cli/demo.ts` via `tsx`: recreate `.data/demo`, migrate, seed through module functions (demo credentials as one `src/lib` constant), start `next dev` with replay and `DEMO_MODE=1`; rulings in `data/rulings/demo.json`; no tracked text derived from `.idea/`.
- **AD-20 Evaluation.** `npm run judge:eval` over `data/protoqa/dev.crowdsourced.jsonl` (52 rows), replaying `data/rulings/protoqa-dev.json` with a version-mismatch warning, `--live`, respondent-weighted B-cubed via `src/lib/bcubed.ts`, `--file` for local aggregates only, `data/protoqa/ATTRIBUTION.md`.
- **AD-21 Configuration.** Only the nine variables of the AD-21 table, read through zod-validated `src/server/env.ts`; `.env.example` with a test that its keys equal `env.ts`; gitignore `.env*` (not the example), `.data/`, `.next/`, `node_modules/`; CLI via `tsx --conditions=react-server --env-file-if-exists=.env.local`.
- **AD-22 Tests and CI.** `tests/unit`, `tests/integration` (fresh `pglite://:memory:` per file, real migrations, the nine named files), `tests/e2e` (Playwright on `next build && next start`, temp PGlite, replay, own Host per spec, the named specs, axe pass, server-output capture), `tests/manual/checklist.md` and `anonymity-audit.md`, `tests/TRACE.md` with a completeness unit test; network guards in Vitest and Playwright; CI on PR and push to main, Node 22 and 26, no key, README scripts only, demo smoke test, Postgres-service integration job; `server-only` aliased in Vitest.
- **AD-23 Retention.** Cascade from `game`; `games.purgeExpired()` (30 days after `played_at`, 90 after `updated_at`), at most hourly per process from Host requests and `GET /api/purge` with `CRON_SECRET`; failures never fail the request.
- **AD-24 Environments.** Node runtime only; `next.config.ts` with `serverExternalPackages`, `outputFileTracingIncludes` for `data/rulings/**`, `agentRules: false`; close action and Game page `maxDuration = 300`; pilot on Vercel Hobby + Neon EU with explicit `db:migrate`, `REGISTRATION_CODE`, `CRON_SECRET`.
- **Conventions.** English code and DB names, bokmål UI and URL segments, `<html lang="nb">`, bokmål `not-found.tsx`, `error.tsx`, `global-error.tsx`, no i18n library; routes per EXPERIENCE.md; limits only in `src/lib/limits.ts`; UTC timestamps only on `host`, `session`, `game`; random UUID v4 IDs; logging only through `log.ts` (`no-console`); fonts self-hosted; the fourteen script names; ESLint flat config + Prettier with the listed ignores; no commented-out code.
- **Delivery notes.** README contract (what and for whom with a screenshot, prerequisites, three commands and demo login, env table, tests, structure and links, Stage 2 and cuts, the eight anonymity limits, deletion); `.github/pull_request_template.md` with three questions; `scripts/make-zip.sh` via `git archive HEAD`; cut order if time runs short, mirroring the PRD §6.5 slip list: pilot deployment, CI Postgres job and Cron first, then FR-32 live regeneration (`judge:eval --live`) and SM-4, then e2e breadth beyond the required specs; never cut AD-4, AD-7 to AD-10, the replay demo, network-free tests or the README.

### UX Design Requirements

From `DESIGN.md` (tokens, components) and `EXPERIENCE.md` (behaviour). Copy strings are the literal bokmål to ship.

- UX-DR1: Design tokens. Every `colors.*`, `typography.*` size and `rounded.*` token from DESIGN.md declared under Tailwind v4 `@theme` in `globals.css` with the same names; Bricolage Grotesque self-hosted from `@fontsource-variable/bricolage-grotesque`; system UI stack for body; nothing below 14 px on laptop or phone; inputs 16 px.
- UX-DR2: Button. Variants primary, secondary, secondary-danger, ghost, danger; `secondary-danger` (danger text, 1 px danger border) is "Slett spillet" on the Game page, and filled `danger` appears only inside a ConfirmDialog ("Slett for godt"); min 44 px; not-yet-allowed actions use `aria-disabled="true"` plus visible reason text below (60 % opacity); pending state shows the in-progress verb, a spinner, `aria-busy`, ignores repeat clicks.
- UX-DR3: TextField. Visible `<label>`; helper and error tied via `aria-describedby`; `aria-invalid` on error with a visually hidden "Feil:" prefix; 2 px danger border; validates on submit or blur only; counter right-aligned, appearing from a threshold and announced only at the limit.
- UX-DR4: Notice. info, success, warning, danger variants; `role="status"` for info and success, `role="alert"` only for errors from a user action; never auto-dismisses; error-summary variant with in-page links that move focus to the failing fieldset.
- UX-DR5: StatusBadge. Fixed state words and colors: Utkast, Samler inn, Grupperer, Til gjennomgang, Klar, Spilles, Ferdig; never interactive.
- UX-DR6: ProgressCount. "færre enn 3 av N svar mottatt" below three, then "K av N svar mottatt"; fixed sentence "Du ser bare antallet, aldri hvem som har svart."; no progress bar, no animation, no live announcement.
- UX-DR7: OnceLinkList. Heading "Kopier lenkene nå", warning text about links not being stored, monospace links with "Kopier" and "Kopier alle"; Clipboard API, label "Kopiert" for 2 s and live "Lenke kopiert."; on clipboard failure the link is selected with "Marker og kopier lenken selv."; closed with "Jeg har kopiert lenkene"; leave-page warning before that; never re-fetched.
- UX-DR8: ConfirmDialog. Native `<dialog>` via `showModal()`, max 480 px; focus starts on cancel; Esc cancels; focus returns to the trigger; never stacked; used only for open Collection, revoke, close Collection, confirm Board, delete Game.
- UX-DR9: AnswerFieldset. `<fieldset>` with legend "Spørsmål N av M: {text}"; "Svar 1" and "Svar 2 (valgfritt)"; "Legg til svar" up to five (focus to the new field), "Fjern" on fields 3 to 5 with `aria-label="Fjern svar N"` (focus to the previous field); error state with error text first and `aria-invalid` on the first field.
- UX-DR10: GroupCard. Checkbox labelled "Velg gruppen «{label}», N personer"; rank, label, Count "1 person" / "N personer"; always-visible overflow menu "Gi nytt navn", "Forkast fra brettet"; label click starts rename; selected style.
- UX-DR11: AnswerChip. Checkbox with the Answer text; same normalised text in one Group collapses into one chip with the most common written form plus "· N svar"; chips sorted alphabetically, never by arrival or rank; chip selection and Group selection are mutually exclusive.
- UX-DR12: SelectionBar. Sticky to the Review main pane, visible only with a selection; ≥2 Groups → "Slå sammen N grupper"; 1 Group → "Velg minst to grupper for å slå sammen."; ≥1 Answer → "Flytt til gruppe" (native `<select>` of non-discarded Groups sorted by Count as "label (N)" + "Flytt") and "Ny gruppe"; "Fjern valg" or Esc clears; selection clears on Question change.
- UX-DR13: BoardTile. Hidden `<button>` "Avslør plass N" showing only the rank (rank slot 56 px); while "Vis resten uten poeng" is on, hidden tiles get a `2px dashed stage-line` border, and while a click waits for the server the border is `2px solid stage-ink` (pending); revealed static label and Count in `stage-ink` digits on a `count-badge` (forest) pill, `min-width` 96 px, no berry anywhere on the stage; unscored dashed with "uten poeng" in its accessible name; a revealed label is never truncated: it wraps to two lines (line-height 1.05) and the row grows to 112 px; row height `clamp(80px, (696px − 8px × (n − 1)) / n, 104px)`.
- UX-DR14: TeamScore. Team name 48 px (1 to 14 characters), Score 80 px tabular figures; the active Team is a card filled `stage-accent` (mint) with all text in `stage-on-accent` and the words "Svarer nå" at 48 px above the name, no badge and no side border; on "Sluttstilling" the winner takes the same look with "Vinner" replacing "Svarer nå" and every Score is 120 px (`tv-score-final`); Score counts up over 400 ms with digits in `stage-accent`, instant with reduced motion.
- UX-DR15: Host chrome. Top bar (wordmark linking `/spill`, "Mine spill", "Logg ut"), breadcrumb `Mine spill › {Game title}`, no sidebar; skip link "Hopp til innhold"; landmarks; one `<h1>`; focus to `<h1>` after route change; Participant pages have no navigation; play view has no top bar.
- UX-DR16: Game page as a state-driven hub. One primary action per state per the EXPERIENCE.md table; "Slett spillet" at the bottom in every state as a `secondary-danger` button; usage report button from *in review* onward.
- UX-DR17: Review layout. 288 px Question rail ("K av N gjennomgått", visible status words only "✓ Gjennomgått" and "Manuell", no status line meaning not reviewed with "Ikke gjennomgått" kept in the accessible name only, `aria-current`), "Lås brettet" with `aria-disabled` reason "Gjennomgå alle spørsmålene først (N igjen)."; "Marker som gjennomgått" at the right of the Question header (replacing the status pill); sections with `<h3>` headings in `title` type, "På brettet (8 grupper)", "Ikke på brettet (1 gruppe)" (with its sentence, cards on `surface-sunken` with a `1px dashed line-strong` border) and "Forkastet (1 gruppe)" (read-only, struck label, "Angre forkasting"); a 2 px `line-strong` divider "Alt under streken vises ikke i spillet" (only above eight); a Group with one chip equal to its label renders as a compact 52 px row (presentation only, still an ordinary Group); fallback Notice copy by `fallback_reason` (failures: "Dommeren fikk ikke gruppert spørsmål {N}. Det starter med én gruppe per ulikt svar."), Demo mode using the NO_STORED_RULING wording; rail 240 px below 1280 px, a `<select>` below 1024 px, a "Gjennomgangen er laget for større skjerm." notice below 768 px.
- UX-DR18: Review operations. Pessimistic: wait for the server, affected cards `aria-busy` and dimmed; polite live-region announcements with the literal strings in EXPERIENCE.md; focus to the affected Group heading; failure shows "Endringen ble ikke lagret. Prøv igjen." where the Host is looking (selection operations inside the SelectionBar above its actions in `danger-soft`/`danger`, card operations inline at the top of the affected GroupCard, mark reviewed under its button) with the screen and selection otherwise unchanged; "Brettet er allerede låst." on a stale tab; no general undo.
- UX-DR19: Answer form. Header wordmark and Game title, no identity anywhere; client sets the title "{Game title} – Toppsvar"; the exact notice "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet, og svarene kan bli sendt til en ekstern KI-tjeneste for gruppering." followed by the instruction line "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1."; inputs `maxlength="80"`, `autocomplete="off"`, `autocapitalize="sentences"`, `enterkeyhint="next"`, counter from 60; non-sticky progress line "N av M spørsmål har svar"; "Send inn svar" or "Lagre endringer"; validation on submit only with error summary taking focus and inline "Skriv minst ett svar."; confirmation "Svarene dine er lagret." with the device sentence and "Se eller endre svarene"; returning notice "Du har allerede sendt inn. …"; one helper line under the submit button in both visits, "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene."; closed, unknown and network-error pages with their exact copy.
- UX-DR20: Unsent draft. Saved to the per-link `localStorage` key, debounced about 500 ms, never sent before submit; status shown by the single helper line under the submit button, "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene."; a local draft wins over the server copy with "Du har endringer som ikke er sendt inn." and "Forkast endringene"; cleared on successful submit; whole key cleared on closed or unknown.
- UX-DR21: Play view. Fixed 1920×1080 canvas scaled to the window with `transform: scale()`, letterboxed; stage colors; vertical budget per DESIGN.md; Questions up to 80 characters at 56 px and over 80 characters at 48 px, budgeted at four lines (vertical budget 48 px top gutter, 221 px Question block, 696 px list, 64 px control bar = 1077 px); "Spørsmål N av M" at the top of the Team column in `tv-team` / `stage-muted`; control bar "Bom [M]", "Angre [Z]", "Neste lag [T]", "Vis resten uten poeng [U]", "Neste spørsmål [N]" ("Vis sluttstilling" on the last), "?" overlay; shortcuts `1`–`8`, `M`, `Z`, `T`, `U`, `N`/`→`, `F`, `?`, `Esc`, ignored in text fields; "Bom" as a centred 80 px panel (`stage-raised`, 2 px `stage-line` border) with 150 ms in, 1.2 s hold, 150 ms out and no state change; unscored toggle with `aria-pressed`, the item reading "Avslører uten poeng [U]" in `stage-ink` weight 700 and hidden tiles dashed, off on the next Question; "Alle svarene er avslørt." hint; save-failure banner "Fikk ikke lagret trekket. Prøv igjen." / "Mistet forbindelsen." with no red, replacing the control-bar row (`control-bar-error`, 64 px) and never overlaying the list; staged CSS-only Reveal of about 700 ms (tile fill 180 ms, label fade with 12 px slide from 120 ms, Count badge scaling 0.9 → 1 from 300 ms, Score count-up from 460 ms), all instant under reduced motion with the colour change kept; no sound; final Scores "Sluttstilling" with Teams centred vertically and Scores at 120 px, the winner styled as the active card with "Vinner" (or "Uavgjort"), the deletion date line and "Tilbake til spillet".
- UX-DR22: Team setup. "Hvem spiller?", fields prefilled "Lag 1" and "Lag 2", "Legg til lag" up to four, "Fjern" down to two, names 1 to 14 characters ("Navnet kan ha maks 14 tegn.", "Laget trenger et navn."), "Start spillet" with the hint "Trykk F for fullskjerm."
- UX-DR23: State patterns. Loading shown only after 300 ms; skeletons where listed; every empty and error string from the EXPERIENCE.md State Patterns table; "Vi finner ikke dette spillet." for unknown or foreign Games; stale-view codes refresh from the server; bokmål 404 "Siden finnes ikke." and 500 "Noe gikk galt hos oss. Prøv igjen om litt.".
- UX-DR24: Accessibility floor. WCAG 2.1 AA; 44×44 px targets; visible focus ring (`focus` on light surfaces, `focus-inverse` on the SelectionBar and the stage) never removed; state never by color alone; answer form at 320 px and 200 % zoom without horizontal scroll; Host pages at 200 % on 1280 px; decorative icons `aria-hidden`.
- UX-DR25: Voice and term map. Bokmål "du" form, no exclamation marks or emoji on Host and Participant pages, errors say what happened then what to do; Glossary terms mapped to the EXPERIENCE.md UI words with no synonyms.
- UX-DR26: Manual checklist A1–A10 from EXPERIENCE.md, committed in `tests/manual/checklist.md`.
- UX-DR27: Anonymity in the interface, rules 1–8 of EXPERIENCE.md (no identity on Participant pages, no per-link state, links shown once, no Answer text before close, alphabetical Group-only display, unknown and revoked identical, no nudging, drafts on device).
- UX-DR28: Landing and account pages. `/` with one sentence and "Logg inn" / "Opprett konto" (demo login Notice in Demo mode); `/registrer` with "Registreringskode" only when required, "Minst 10 tegn." helper, real autocomplete values; the exact error strings; expired-session redirect notice.

### FR Coverage Map

Every FR maps to at least one epic. The story-level table is in "FR Coverage by Story" at the end of this document.

| FR | Stage | Epic | What the epic delivers for it |
|----|-------|------|-------------------------------|
| FR-1 | 1 | Epic 1 (Epic 2 for the no-login rule on Invite link pages) | Host register, log in, log out, sessions |
| FR-2 | 1 | Epic 1 | Create and list Games |
| FR-3 | 1 | Epic 1 (Epic 6 for the "deleted on" notice at *played*) | Delete in any state, retention purge |
| FR-4 | 1 | Epic 2 | Question editor in *draft* |
| FR-5 | 1 | Epic 2 | Invite links shown once, Collection opens |
| FR-6 | 1 | Epic 2 | Answer form and submit |
| FR-7 | 1 | Epic 2 | Return and change on the submitting device |
| FR-8 | 1 | Epic 2 | Progress count |
| FR-9 | 1 | Epic 2 | Revoke and replace |
| FR-10 | 1 | Epic 3 (Epic 2 for the closed page) | Close with the three-set minimum |
| FR-11 | 1 | Epic 2, Epic 3 | No identity stored or logged; verified by tests |
| FR-12 | 1 | Epic 2, Epic 3, Epic 5 | Nothing linkable in Host views; Host-session tests |
| FR-13 | 1 | Epic 3, Epic 5 | Anonymising close; schema and data inspection |
| FR-14 | 1 | Epic 2 (Epic 7 for the README part) | Notice on the answer form |
| FR-15 | 1 | Epic 4 | Judge Grouping once, Stored rulings |
| FR-16 | 1 | Epic 5 | Ranking and default labels |
| FR-17 | 1 | Epic 3 (normalisation), Epic 4, Epic 5 (notice) | Fallback Grouping |
| FR-18 | 1 | Epic 4 (Epic 5 bumps the Review counters) | Counters and report |
| FR-19 | 1 | Epic 5 | Review display |
| FR-20 | 1 | Epic 5 | Merge, move, rename, discard |
| FR-21 | 1 | Epic 5 | Mark reviewed, confirm Board |
| FR-22 | 2 | Epic 8 | Reorder Groups |
| FR-23 | 1 | Epic 6 | Team setup |
| FR-24 | 1 | Epic 6 | Play view |
| FR-25 | 1 | Epic 6 | Scored Reveal, miss |
| FR-26 | 1 | Epic 6 | Undo |
| FR-27 | 1 | Epic 6 | Turns, next Question, final Scores |
| FR-28 | 2 | Epic 8 | Assisted Guess matching |
| FR-29 | 2 | Epic 8 | Strikes and steals |
| FR-30 | 1 | Epic 6 | End-to-end round without a key |
| FR-31 | 1 | Epic 7 | Demo mode |
| FR-32 | 1 | Epic 7 | Judge evaluation |
| FR-33 | 2 | Epic 8 | Question sets |

NFRs: NFR-1, NFR-3 and NFR-8 start in Epic 1 and are proved in Epic 7; NFR-2 is configuration from Epic 1 and the optional pilot in Epic 7; NFR-4, NFR-6 and NFR-7 are acceptance criteria of every story that builds a screen; NFR-5 is an acceptance criterion of the Review and play stories and a manual timing check in Epic 7.

## Epic List

### Epic 1: Host accounts and Games on a running, tested foundation
A Host can register, log in, create Games, see them listed with their state, open a Game page that follows the state machine, and delete a Game. Underneath sits the whole skeleton every later story only adds to: the Next.js app per the Structural Seed, PGlite and Postgres through one client, committed migrations, the visual tokens, lint, format, typecheck, unit, integration and e2e harnesses, and CI.
**FRs covered:** FR-1, FR-2, FR-3. **Also:** NFR-1, NFR-2 (configuration), NFR-3, NFR-7, NFR-8; AD-1 to AD-6, AD-17, AD-21 to AD-24; UX-DR1 to UX-DR5, UX-DR8, UX-DR15, UX-DR16, UX-DR23 to UX-DR25, UX-DR28.

### Epic 2: Host writes Questions and Participants answer anonymously
The Host writes Questions, creates personal Invite links shown once, watches a count-only progress figure and replaces a lost link. A Participant opens the link on a phone, answers under an honest notice, keeps a draft on the device, and returns on the same device to change the Answer set. Increment: a real Collection can run end to end.
**FRs covered:** FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-11, FR-12, FR-14 (and the closed and no-login parts of FR-10 and FR-1). **Also:** NFR-4, NFR-6; AD-7, AD-8, AD-16 (Question positions); UX-DR6, UX-DR7, UX-DR9, UX-DR19, UX-DR20, UX-DR27.

### Epic 3: Host closes Collection and the Answers become unlinkable
The Host closes Collection once three Answer sets exist. The close is the single anonymisation step: Answers get per-Question random Contributor keys, are shuffled, and every Token hash and Answer set is deleted. Explicit test stories prove the anonymity guarantees before and after close. Increment: a closed Game whose links say Collection is closed and whose storage passes the anonymity inspection.
**FRs covered:** FR-10, FR-11, FR-12, FR-13 (and FR-17's normalisation rule). **Also:** SM-3; AD-9, AD-10, AD-12 (normalisation), AD-17, AD-22.

### Epic 4: The Judge groups the Answers, or the fallback does
After close, Grouping runs once in the background: the Judge proposes Groups per Question, or each Question falls back to one Group per distinct normalised Answer. The Game reaches *in review* with or without a key, and its content-free usage counters can be exported. Increment: close leads to *in review* with Groups, on replay, mock or the live model.
**FRs covered:** FR-15, FR-17, FR-18. **Also:** NFR-3, §6.2 cost; AD-12, AD-13, AD-14, AD-18, AD-24 (`maxDuration`).

### Epic 5: Host reviews the Grouping and locks the Board
The Host sees each Question's Groups ranked with Counts and raw Answers, merges, moves Answers to existing or new Groups, renames, discards and restores, marks each Question reviewed and locks the Board. Increment: a Game in *ready* with a frozen Board snapshot and contributor data cleared.
**FRs covered:** FR-12, FR-13, FR-16, FR-17 (notice), FR-18 (Review counters), FR-19, FR-20, FR-21. **Also:** NFR-4, NFR-5, NFR-6; AD-10, AD-11, AD-15; UX-DR10 to UX-DR12, UX-DR17, UX-DR18.

### Epic 6: The group plays the Board from one shared screen
The Host names two to four Teams and runs the round from the TV: scored Reveals, misses, undo, turns, unscored Reveals, next Question and final Scores, all surviving a reload. Increment: the complete Stage 1 loop, proved by the no-key end-to-end test and an automated accessibility pass.
**FRs covered:** FR-3 (deletion notice), FR-23, FR-24, FR-25, FR-26, FR-27, FR-30. **Also:** NFR-4, NFR-5, NFR-6; AD-15, AD-16; UX-DR13, UX-DR14, UX-DR21, UX-DR22.

### Epic 7: The examiner runs it without keys: Demo mode, Judge evaluation and hand-in
The examiner clones the repository, runs three commands, logs in as the demo Host, closes the demo Game and sees Judge Groups from Stored rulings; runs the tests and the Judge evaluation offline; and finds a README, a traceability map and manual checklists that show every Stage 1 consequence is covered. Increment: the Stage 1 freeze candidate.
**FRs covered:** FR-14 (README), FR-31, FR-32. **Also:** SM-1, SM-2, SM-3, NFR-1, NFR-2 (pilot, first to cut), NFR-3, NFR-5 (manual timing), NFR-6 (manual), NFR-8; AD-19, AD-20, AD-22, AD-24; UX-DR26.

### Epic 8: Stage 2 - only after SM-1 passes
Do not start any story here until SM-1 passes in full on `main` (PRD §6.5). FR-33 comes first. Stories carry acceptance criteria only; design detail is decided when Stage 2 starts, inside AD-4, AD-13, AD-15 and AD-16. *Amended 2026-11-24:* Story 8.5 started before SM-1 passed, by the group's decision after the pilot test. *Amended 2026-11-25:* so did Story 8.6, by the group's decision after testing Story 8.5.
**FRs covered:** FR-33, FR-22, FR-28, FR-29, and (Story 8.5) a second surface for FR-23 to FR-27, which (Story 8.6) becomes the only one.

## Story Conventions

These apply to every story and are not repeated in each one. They are part of every story's definition of done.

- **Proof labels.** Each acceptance criterion is headed by the requirement it proves and the kind of test that proves it: **unit** (`tests/unit`, pure `src/lib` logic), **integration** (`tests/integration`, module entry points on a fresh `pglite://:memory:` DB with the real migrations), **e2e** (`tests/e2e`, Playwright against `next build && next start`), or **manual** (an item in `tests/manual/checklist.md` or `anonymity-audit.md`). The Stack has no React component-test library, so component behaviour is proven by e2e and axe, and logic by unit tests.
- **Green and offline.** Lint, format check, typecheck, `npm test` and `npm run test:e2e` pass with no network and no model key (NFR-3). `npm run dev` still works at the end of the story.
- **Traceability.** Test titles carry the FR IDs they prove, and the story adds its rows to `tests/TRACE.md` (AD-22).
- **Guards grow with the code.** Every new Host action gets a foreign-ID case in `tests/integration/authz.test.ts` (AD-5). Every new state-dependent operation gets its row in `src/lib/game-state.ts` and a `WRONG_STATE` case in `tests/integration/game-state.test.ts` (AD-4).
- **Schema.** A story creates only the tables and columns it needs, in `src/server/db/schema.ts`, with a generated, committed migration (AD-3). Every table with `game_id` cascades on delete (AD-23).
- **Screens are finished when built.** User-facing text is the literal bokmål from EXPERIENCE.md, with new `ErrorCode`s and their messages in `src/lib/errors.ts` (NFR-7, AD-17). A story that builds a screen also builds its loading, empty and error states (UX-DR23), its accessibility floor (UX-DR24) and its voice (UX-DR25). There are no separate polish stories.
- **Anonymity and privacy.** Nothing logs a Token, hash, edit secret or Answer text (FR-11, AD-17). No tracked file holds a real person's name or text from `.idea/`.
- **Spine discipline.** A departure from `ARCHITECTURE-SPINE.md` amends it in the same change. No Stage 2 stubs or comments ship in Stage 1 (AD-13).
- **Size.** One story is one focused session: one coherent change with its tests, committable on its own.

## Epic 1: Host accounts and Games on a running, tested foundation

A Host can register, log in, create and list Games, open a Game page that follows the state machine, and delete a Game, on a skeleton that already lints, tests and runs CI.

### Story 1.1: Running skeleton with database, test harnesses and CI

As a developer of Toppsvar,
I want a running, linted and tested Next.js skeleton with the database client and CI in place,
So that every later story only adds behaviour.

**Architecture:** Starter, Stack, Structural Seed, AD-1, AD-2, AD-3, AD-21, AD-22, AD-24, Conventions.

**Acceptance Criteria:**

**AC1 (NFR-1 · e2e + CI)**
**Given** a fresh clone and Node 22.13 or newer
**When** a developer runs `npm install` and `npm run dev`
**Then** `/` renders with `<html lang="nb">` and `GET /api/health` returns 200 with no side effects
**And** `package.json` pins the Stack versions, `.nvmrc` exists, and the starter's `@types/node ^20`, `next/font/google` layout and `lang="en"` are gone

**AC2 (AD-2 · integration)**
**Given** `DATABASE_URL` unset, `pglite://<dir>`, `pglite://:memory:` or `postgres://…`
**When** `src/server/db/client.ts` resolves it
**Then** it opens PGlite at `.data/local`, PGlite at the given directory (created recursively), in-memory PGlite, or postgres.js with `prepare: false`, importing the driver dynamically and caching one client on `globalThis`
**And** `next build` completes without opening the database, because the health route reads it only after `await connection()`; if in-process PGlite fails under Next, the AD-2 fallback is applied in `client.ts` alone and the spine amended

**AC3 (AD-3 · CI)**
**Given** `src/server/db/schema.ts`, `drizzle.config.ts` and the `db:generate` and `db:migrate` scripts
**When** dev or the test setup starts on a `pglite://` URL
**Then** pending migrations from `drizzle/` are applied automatically (zero migrations is a valid state)
**And** `drizzle-kit check` passes in CI

**AC4 (AD-21, NFR-8 · integration)**
**Given** `src/server/env.ts` validating the nine AD-21 variables with their defaults
**When** `tests/integration/env.test.ts` runs
**Then** the keys of `.env.example` equal the keys of `env.ts`
**And** `.gitignore` covers `.env*` except `.env.example`, `.data/`, `.next/` and `node_modules/`

**AC5 (AD-1, AD-17, NFR-3 · unit + e2e + CI)**
**Given** the ESLint flat config with `no-restricted-imports` zones for the layers and module order, `no-console` outside `src/server/log.ts`, Prettier and the Conventions ignore list
**When** a file under `src/app` imports `src/server/db`
**Then** lint fails
**And** Vitest (fresh in-memory PGlite per integration file, `JUDGE_PROVIDER=mock`, no key, non-localhost requests rejected, `server-only` aliased) and Playwright (`next build && next start`, temporary PGlite directory, `JUDGE_PROVIDER=replay`, non-localhost requests blocked) each run at least one passing smoke test; `src/server/log.ts` accepts only `{ module, op, code, sqlstate }`

**AC6 (AD-22 · CI)**
**Given** `.github/workflows/ci.yml`
**When** a pull request is opened or `main` is pushed
**Then** on Node 22 and 26, with no key and `NEXT_TELEMETRY_DISABLED=1`, it runs `npm ci`, lint, `format:check`, `typecheck`, `drizzle-kit check`, `npm test`, Playwright install and `npm run test:e2e`, and the run is green
**And** `next.config.ts` sets `serverExternalPackages: ['@electric-sql/pglite']` and `agentRules: false`; `.github/pull_request_template.md` asks the three delivery-note questions; `tests/TRACE.md` exists with one heading per Stage 1 FR

### Story 1.2: Visual foundation, Host chrome and landing page

As a visitor,
I want a Norwegian landing page in Toppsvar's own look,
So that I understand what the product is and where to log in or register.

**Architecture:** Conventions (language, assets); DESIGN.md tokens; EXPERIENCE.md Information Architecture.

**Acceptance Criteria:**

**AC1 (UX-DR1 · e2e)**
**Given** `globals.css` declaring every DESIGN.md `colors.*`, `typography.*` size and `rounded.*` token under Tailwind `@theme` with the same names
**When** the landing page loads in Playwright with external requests blocked
**Then** Bricolage Grotesque is served from the self-hosted npm package and no request leaves localhost
**And** body text uses the system UI stack and nothing renders below 14 px

**AC2 (UX-DR28, NFR-7 · e2e)**
**Given** a visitor who is not logged in
**When** they open `/`
**Then** they see one `<h1>`, one sentence on what Toppsvar is, and "Logg inn" and "Opprett konto" linking to `/logg-inn` and `/registrer`

**AC3 (UX-DR15, UX-DR23 · e2e)**
**Given** the shared Host layout (top bar with wordmark linking `/spill`, "Mine spill", "Logg ut", skip link "Hopp til innhold", `header`, `nav`, `main` landmarks) and bokmål `not-found.tsx`, `error.tsx` and `global-error.tsx`
**When** a visitor opens an unknown URL
**Then** the page reads "Siden finnes ikke." with a 404 status, and the 500 page reads "Noe gikk galt hos oss. Prøv igjen om litt."
**And** after a client route change, focus moves to the page `<h1>`

**AC4 (NFR-6 · e2e)**
**Given** the landing page and the 404 page
**When** `@axe-core/playwright` scans them
**Then** it reports no serious or critical violations, and the focus ring (`focus` token) is visible on every interactive element

### Story 1.3: Host registration, login, logout and sessions

As a Host,
I want to create an account and log in with email and password,
So that my Games are mine alone and Participants never need an account.

**Architecture:** AD-5, AD-6, AD-17, AD-21 (`REGISTRATION_CODE`). **Tables:** `host`, `session`.

**Acceptance Criteria:**

**AC1 (FR-1 · unit + integration)**
**Given** a registration with a password shorter than 10 or longer than 256 characters
**When** it is submitted
**Then** it is refused with "Passordet må ha minst 10 tegn." (or the length message for the upper bound)
**And** an accepted password is stored only as a scrypt string carrying `N=2^17, r=8, p=1` and a 16-byte salt, never in plain text, with at most two scrypt runs at a time per process

**AC2 (FR-1 · integration + e2e)**
**Given** a registered Host
**When** someone logs in with an unknown email, or with the right email and a wrong password
**Then** both attempts return the same code and the one message "Feil e-post eller passord.", and the unknown email is checked against the fixed dummy hash
**And** after five failures `locked_until` is set, and the lockout doubles on further failures (integration test with a controlled clock)

**AC3 (FR-1 · integration)**
**Given** a successful login
**When** the session is created
**Then** the cookie is `httpOnly`, `SameSite=Lax`, `Max-Age` 14 days, and `Secure` when `APP_BASE_URL` is https; the DB holds only `sha256(token)`
**And** a session unused for 14 days is rejected and the Host is redirected to `/logg-inn` with "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen."; `expires_at` is extended at most once an hour

**AC4 (FR-1, UX-DR28 · e2e)**
**Given** the `/registrer` and `/logg-inn` pages with visible labels and `autocomplete` values `email`, `new-password` and `current-password`
**When** a visitor registers, logs out and logs in again
**Then** they land on `/spill` (heading "Mine spill") each time they are logged in, "Logg ut" ends the session, and a second registration with the same email shows "Det finnes allerede en konto med denne e-posten."
**And** with `REGISTRATION_CODE` set, `/registrer` shows "Registreringskode", and a wrong code shows "Registreringskoden stemmer ikke."; without it the field is absent

**AC5 (AD-17, FR-11 · unit + integration)**
**Given** `src/lib/errors.ts` with a closed `ErrorCode` union and bokmål messages, and actions returning `{ ok, data } | { ok: false, code, message, fieldErrors? }`
**When** a forced DB error occurs during login
**Then** the action returns `INTERNAL`, and the log output holds only `{ module, op, code, sqlstate }`, with no email or password

**AC6 (NFR-6, UX-DR2, UX-DR3, UX-DR4 · e2e)**
**Given** the Button, TextField and Notice components built for these pages
**When** a login is pending and when a field is invalid
**Then** the button shows "Logger inn …" with `aria-busy` and ignores repeat clicks, and the invalid field has `aria-invalid`, its error linked through `aria-describedby`
**And** axe reports no serious or critical violations on both pages

### Story 1.4: Create and list Games, with a state-driven Game page

As a Host,
I want to create Games and see each one's state,
So that I can prepare several gatherings without mixing them up.

**Architecture:** AD-4, AD-5, AD-17, AD-23 (`updated_at`). **Tables:** `game`.

**Acceptance Criteria:**

**AC1 (FR-2 · integration + e2e)**
**Given** a logged-in Host on `/spill`
**When** they enter a title of 1 to 80 characters in "Navn på spillet" and click "Lag spill"
**Then** a Game is created in *draft* and the Host is taken to its Game page
**And** an empty or longer title is refused with "Navnet må ha 1–80 tegn.", and the counter appears from 60 characters

**AC2 (FR-2, UX-DR5 · e2e)**
**Given** a Host with Games
**When** they open `/spill`
**Then** their Games are listed newest first with title link, StatusBadge state word and "Sist endret {dato}"
**And** a Host with no Games sees "Du har ingen spill ennå. Gi det første et navn over, for eksempel «Hyttetur 2026»."

**AC3 (FR-1, FR-2, AD-5 · integration + e2e)**
**Given** Host A's Game and a logged-in Host B
**When** B opens A's Game URL or calls any Game action with A's Game ID
**Then** B gets exactly the response given for a Game ID that does not exist ("Vi finner ikke dette spillet." with a link to Mine spill), and A's Game never appears in B's list
**And** `tests/integration/authz.test.ts` exists with this case; logged-out requests to `/spill` and Game pages redirect to `/logg-inn`

**AC4 (AD-4 · unit + integration)**
**Given** `src/lib/game-state.ts` with the seven states, the seven transitions and the permitted-operations table
**When** `games.transition(tx, gameId, from, to)` is called for every pair of states
**Then** only the seven PRD §4.1 transitions succeed (compare-and-set), every other pair is refused
**And** `games.lockForMutation` takes `SELECT … FOR UPDATE`, throws `NOT_FOUND` or `WRONG_STATE`, and touches `game.updated_at` only on Host calls

**AC5 (UX-DR16, UX-DR15 · e2e)**
**Given** a Game in *draft*
**When** its Host opens the Game page
**Then** it shows the breadcrumb `Mine spill › {title}`, the title as `<h1>`, and the StatusBadge "Utkast"; the page chooses its main panel by Game state, so later stories add panels without new routes

### Story 1.5: Delete a Game and purge expired Games

As a Host,
I want to delete a Game with everything in it, and have old Games deleted automatically,
So that nothing about my friends is kept longer than needed.

**Architecture:** AD-4 (deletion), AD-17 (`/api/purge`), AD-21 (`CRON_SECRET`), AD-23.

**Acceptance Criteria:**

**AC1 (FR-3, UX-DR8 · e2e)**
**Given** a Game page in any state
**When** the Host clicks "Slett spillet" (a `secondary-danger` button, not filled red)
**Then** a native ConfirmDialog asks "Slette «{title}»? Spørsmål, lenker, svar, brett og poeng slettes for godt." with focus on cancel; Esc cancels and returns focus to the trigger
**And** "Slett for godt" (the filled `danger` button, which appears only in this dialog) deletes the Game and lands on `/spill` with "«{title}» er slettet."

**AC2 (FR-3 · integration)**
**Given** Games in each of the seven states
**When** each is deleted
**Then** no row anywhere references the deleted Game
**And** a schema test asserts that every foreign key to `game` is `ON DELETE CASCADE`, so tables added by later stories are covered by the same test

**AC3 (FR-3 · integration)**
**Given** a Game 30 days past `played_at`, a never-played Game 90 days past `updated_at`, and younger Games of both kinds
**When** `games.purgeExpired()` runs
**Then** only the two expired Games are deleted, a second run changes nothing, and a purge triggered from a Host request runs at most once an hour per process
**And** a purge failure is caught and the Host request that triggered it still succeeds

**AC4 (FR-3, AD-17 · integration)**
**Given** `GET /api/purge`
**When** it is called without `CRON_SECRET` configured, with a wrong secret, or with the right one
**Then** it is disabled, refused, or runs the purge, respectively, and never has another side effect

## Epic 2: Host writes Questions and Participants answer anonymously

The Host writes Questions, creates personal Invite links shown once, follows a count-only progress figure and replaces a lost link; Participants answer on their phones and can return on the same device.

### Story 2.1: Write, reorder and remove Questions while in draft

As a Host,
I want to write, edit, reorder and remove my Questions before anyone answers,
So that the Game asks exactly what I want about my group.

**Architecture:** AD-4, AD-16 (dense positions). **Tables:** `question`.

**Acceptance Criteria:**

**AC1 (FR-4 · integration)**
**Given** a Game in *draft*
**When** the Host adds, edits, moves and removes Questions
**Then** each Question holds 1 to 200 characters, positions stay dense `1..n` and are renumbered in the same transaction on every remove or reorder
**And** a 21st Question is refused with "Du har nådd maks 20 spørsmål."

**AC2 (FR-4 · integration)**
**Given** a Game in any state other than *draft*
**When** any add, edit, reorder or remove is attempted
**Then** it is refused with `WRONG_STATE` and nothing changes

**AC3 (FR-4 · e2e)**
**Given** the Question editor on the *draft* Game page
**When** the Host types a Question and tabs away
**Then** it autosaves on blur and shows "Lagret" (or "Fikk ikke lagret. Prøv igjen." on failure), with a counter from 160 characters
**And** "Flytt opp", "Flytt ned" and "Slett" are buttons (no drag), "Legg til spørsmål" shows "N av 20 spørsmål" and disappears at 20, empty Questions are not saved, and an empty Game shows the EXPERIENCE.md empty-state sentence

**AC4 (NFR-6 · e2e)**
**Given** the Question editor
**When** it is used by keyboard only and scanned by axe
**Then** every action is reachable in reading order, every textarea has a visible label, and axe reports no serious or critical violations

### Story 2.2: Create Invite links and open Collection

As a Host,
I want to create one personal Invite link per Participant, shown to me once,
So that I can send each person their own link and start collecting.

**Architecture:** AD-4, AD-7 (Token, link shape), AD-8 (`games.reserveInviteLinks`, `invite_links_issued`). **Tables:** `invite_link`; column `game.invite_links_issued`.

**Acceptance Criteria:**

**AC1 (FR-5, NFR-3 · unit)**
**Given** `src/lib/token.ts`
**When** Tokens are generated
**Then** each is 32 bytes from `crypto.randomBytes`, base64url-encoded (at least 128 bits), and a large generated sample has no duplicates
**And** the stored form is `sha256(token)`

**AC2 (FR-5 · integration)**
**Given** a *draft* Game with at least one Question
**When** the Host creates N links
**Then** N `invite_link` rows hold only `token_hash`, the response returns N full links `<APP_BASE_URL>/svar/<gameId>#<token>`, and the Game moves from *draft* to *collecting* in the same transaction
**And** with zero Questions the request is refused ("Skriv minst ett spørsmål først."), and in *collecting* more links are added without a transition

**AC3 (FR-5 · integration)**
**Given** a Game whose `invite_links_issued` plus the requested number would exceed 50
**When** the Host creates links
**Then** the request is refused with `LINK_CAP_REACHED` and nothing is created; `invite_links_issued` counts every link ever created, revoked ones included

**AC4 (FR-5, UX-DR7, UX-DR8 · e2e)**
**Given** the "Lag invitasjonslenker" panel
**When** the Host creates the first links in *draft*
**Then** a ConfirmDialog asks "Åpne innsamlingen? Spørsmålene låses når du lager de første lenkene, og kan ikke endres etterpå."; after confirming, the OnceLinkList "Kopier lenkene nå" shows the links with "Kopier" and "Kopier alle" ("Kopiert" for 2 s and a live "Lenke kopiert."), and leaving before "Jeg har kopiert lenkene" triggers the leave-page warning
**And** after a reload the links are not shown again anywhere, and the panel reads "{issued} av maks 50 lenker brukt."

**AC5 (FR-4, FR-12 · e2e + integration)**
**Given** a Game that has moved to *collecting*
**When** the Host views the Game page
**Then** the Questions are listed read-only with no edit controls
**And** no Host page, response after creation, or DB column holds a raw Token

### Story 2.3: Invite link page: open, closed and unknown

As a Participant,
I want my link to open straight to the Game with no login, and to be told plainly when a link is closed or not valid,
So that I can answer from any phone without an account.

**Architecture:** AD-5 (`/svar` not-found), AD-6 (no auth under `/svar`), AD-7.

**Acceptance Criteria:**

**AC1 (FR-11, AD-7 · e2e)**
**Given** a valid Invite link
**When** the browser requests `/svar/<gameId>`
**Then** the server HTML has `<title>Toppsvar</title>`, `noindex`, no Open Graph tags, no Game title and no Questions, the response carries `Referrer-Policy: no-referrer`, and no request URL the server receives contains the Token

**AC2 (FR-1, UX-DR27 · e2e)**
**Given** a browser that also holds a Host session cookie
**When** it opens an Invite link
**Then** the page shows no login, account indicator, Host chrome or link to any Host page, and no session is read

**AC3 (FR-9, FR-3, UX-DR19 · e2e)**
**Given** a non-existent `gameId`, a malformed Token, an unknown Token, or a deleted Game
**When** the link is opened
**Then** each shows the same page, "Vi finner ikke denne lenken." with "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny.", and the link's `localStorage` key is removed

**AC4 (FR-10 · integration + e2e)**
**Given** a Game whose state is not *collecting*
**When** any of its links is opened
**Then** the page shows "Innsamlingen er stengt." with "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres.", decided from the Game in the URL before any Token lookup, and the `localStorage` key is removed

**AC5 (FR-6 · integration)**
**Given** a valid link of a *collecting* Game
**When** the client calls `openInviteLink(gameId, token)`
**Then** it returns the Game title and the Questions in position order, and the client sets the title "{Game title} – Toppsvar"
**And** a Token that belongs to another Game returns `LINK_UNKNOWN`, because lookup is by `(token_hash, game_id)`

**AC6 (FR-11 · integration)**
**Given** a forced DB error inside `openInviteLink`
**When** the action fails
**Then** it returns `INTERNAL`, and the log output holds only `{ module, op, code, sqlstate }`, with no Token or hash

### Story 2.4: Answer form and first submission

As a Participant,
I want to give one to five Answers per Question on my phone and submit them,
So that my Answers count without anyone knowing they are mine.

**Architecture:** AD-7 (`submitAnswerSet`), AD-8 (submission, answer-set schema, edit secret). **Tables:** `submission`.

**Acceptance Criteria:**

**AC1 (FR-14 · e2e)**
**Given** an open Invite link
**When** the answer form renders
**Then** above the first Question it shows, as an info Notice, exactly "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet, og svarene kan bli sendt til en ekstern KI-tjeneste for gruppering."

**AC2 (FR-6, NFR-4, UX-DR9, UX-DR19 · e2e)**
**Given** the answer form on a 360 px viewport
**When** the Participant fills it in
**Then** each Question is a fieldset with "Svar 1" and "Svar 2 (valgfritt)", "Legg til svar" adds fields up to five and then disappears, fields 3 to 5 have "Fjern" (`aria-label="Fjern svar N"`) with the focus rules of UX-DR9, inputs carry `maxlength="80"`, `autocomplete="off"`, `autocapitalize="sentences"` and `enterkeyhint="next"`, a counter appears from 60 characters, "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1." sits under the notice, and "N av M spørsmål har svar" sits above "Send inn svar" with the one helper line "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene." below it
**And** there is no horizontal scroll

**AC3 (FR-6 · integration + e2e)**
**Given** a form where some Questions have no Answer
**When** the Participant submits
**Then** nothing is stored on the server, an error summary listing the missing Questions takes focus with a link to each fieldset, and each affected fieldset shows "Skriv minst ett svar."
**And** on a complete submit, empty fields are ignored and each Answer is stored with rank = field order

**AC4 (FR-6 · integration)**
**Given** a submit that bypasses the browser limits
**When** it carries an Answer over 80 characters, more than five Answers, a missing Question or an unknown Question ID
**Then** `collection.submit` refuses it against `src/lib/answer-set.ts` and the stored Question IDs, and an over-long Answer shows "Svaret kan ha maks 80 tegn." under its field

**AC5 (FR-6, FR-7, AD-8 · integration + e2e)**
**Given** a first complete submit
**When** it succeeds
**Then** exactly one `submission` row keyed by the link's `token_hash` holds the Answer set and `sha256` of a 32-byte edit secret generated in the browser and kept under `toppsvar:<gameId>:<first 16 chars of token>`
**And** the form is replaced by "Svarene dine er lagret." with "Du kan endre dem på denne enheten og i denne nettleseren helt til verten stenger innsamlingen." and the button "Se eller endre svarene"

**AC6 (FR-6, FR-11, NFR-6 · e2e + manual)**
**Given** the answer form
**When** it is inspected and scanned
**Then** it shows no name, email, account indicator or other identity, a network failure shows "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten.", and axe reports no serious or critical violations
**And** checklist items A2 (keyboard only), A3 (screen reader) and A4 (360 px, 320 px, 200 % zoom) are added to `tests/manual/checklist.md`

### Story 2.5: Return on the same device, change Answers, and keep unsent drafts

As a Participant,
I want to come back through my link on my phone to add a better Answer, and not lose a half-typed form,
So that I can improve my Answers until Collection closes.

**Architecture:** AD-8 (edit secret, one `localStorage` key). EXPERIENCE.md PRD §10 item 5.

**Acceptance Criteria:**

**AC1 (FR-7, FR-12 · integration)**
**Given** a link with a saved Answer set
**When** `openInviteLink` is called with the matching edit secret, with a wrong one, and with none
**Then** only the matching call returns the saved Answers; the other two return a response identical to an unused link

**AC2 (FR-7 · integration)**
**Given** a link with a saved Answer set
**When** a new complete set is submitted from the same device, and later from a device without the secret
**Then** each submit replaces the link's single `submission` row (the second also replaces the secret hash), so the link never holds two Answer sets
**And** an edit that leaves a Question with no Answer is refused as in FR-6

**AC3 (FR-7 · e2e)**
**Given** a Participant who has submitted
**When** they reopen the link in the same browser context
**Then** the form is pre-filled, shows "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer».", and adding a third Answer and pressing "Lagre endringer" saves it
**And** the same link in a fresh browser context shows an empty form with the same helper line under the submit button, "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene."

**AC4 (UX-DR20, FR-6 · e2e)**
**Given** a Participant typing into the form
**When** they reload the tab before submitting
**Then** the draft is restored from the per-link `localStorage` key (saved about 500 ms after typing stops), and the network log shows no request carrying Answer text before submit
**And** a local draft wins over the server copy with "Du har endringer som ikke er sendt inn." and "Forkast endringene", the helper line "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene." is shown under the submit button, and the draft is cleared after a successful submit

### Story 2.6: Collection progress on the Game page

As a Host,
I want to see how many Answer sets have come in, and nothing more,
So that I know when to close without learning who has answered.

**Architecture:** AD-8 (`collection.progress`), AD-17 (30 s refresh).

**Acceptance Criteria:**

**AC1 (FR-8 · integration)**
**Given** a *collecting* Game with active links and submissions
**When** `collection.progress(gameId)` is called
**Then** it returns the active-link count, `issued`, and the submission count, where any count below three is returned only as "fewer than 3" and never as an exact number

**AC2 (FR-8, UX-DR6 · e2e)**
**Given** the *collecting* Game page
**When** submissions go from zero to four
**Then** ProgressCount reads "færre enn 3 av N svar mottatt" and then "4 av N svar mottatt", with "Du ser bare antallet, aldri hvem som har svart." below it, no progress bar, no animation and no live-region announcement; it refreshes on load and every 30 s
**And** the page also shows the locked Question list and the "Flere lenker" panel

**AC3 (FR-12 · integration)**
**Given** a Host-facing read of the Game page and the Game list
**When** a Participant submits or changes an Answer set
**Then** no Host-visible value changes, including `game.updated_at` and "Sist endret", except the progress count once it is three or more

### Story 2.7: Revoke and replace a lost Invite link

As a Host,
I want to revoke a link someone lost and get one new link,
So that the person can still answer without ending up with two Answer sets.

**Architecture:** AD-8 (revoke), AD-5 (pasted links).

**Acceptance Criteria:**

**AC1 (FR-9 · integration)**
**Given** a *collecting* Game and one of its active links, with or without a saved Answer set
**When** the Host pastes the full link and confirms
**Then** the link's row is deleted by `(token_hash, game_id)`, its submission goes with it by cascade, and one new link is created through `games.reserveInviteLinks`
**And** the response is identical whether or not an Answer set existed

**AC2 (FR-9 · integration)**
**Given** a revoked link
**When** it is opened or used to submit
**Then** it returns `LINK_UNKNOWN`, the same as a link that never existed

**AC3 (FR-9 · integration)**
**Given** a pasted link that is malformed, belongs to another Game, or was already revoked, and separately a Game that has issued 50 links
**When** the Host tries to revoke
**Then** the first case returns the inline `LINK_UNKNOWN` "Denne lenken er ikke en aktiv lenke i dette spillet." (never the 404 page), and the second returns `LINK_CAP_REACHED` "Spillet har nådd maks 50 lenker." before anything changes, leaving the old link active

**AC4 (FR-9, UX-DR8 · e2e)**
**Given** the "Erstatt en tapt lenke" panel
**When** the Host pastes a link and clicks "Trekk tilbake og lag ny"
**Then** a ConfirmDialog always says "Trekke tilbake lenken? Alt som er sendt inn via den, slettes. Du får én ny lenke, som vises bare én gang.", and confirming shows the OnceLinkList with exactly one link

## Epic 3: Host closes Collection and the Answers become unlinkable

The Host closes Collection once three Answer sets exist; the close turns Answer sets into unlinkable Answers, and dedicated tests prove the anonymity guarantees before and after close.

### Story 3.1: Close Collection as the single anonymisation step

As a Host,
I want to close Collection when enough people have answered,
So that the Answers are locked in and nobody can link them back to a link.

**Architecture:** AD-4, AD-9, AD-10, AD-12 (normalisation), AD-24 (`maxDuration = 300` on the close action and Game page). **Tables:** `answer` (owned by `grouping`, written only through `grouping.insertAnswers`); `answer.group_id` arrives with `answer_group` in Story 4.2.

**Acceptance Criteria:**

**AC1 (FR-17, NFR-3 · unit)**
**Given** `src/lib/normalize.ts` and `src/lib/shuffle.ts`
**When** their unit tests run
**Then** normalisation applies NFC, locale-independent lower case, trim, inner-whitespace collapse and removal of trailing `.,!?;:…`, falling back to the trimmed lower-cased text when nothing is left, and exports `NORMALIZE_VERSION`
**And** the shuffle is a Fisher-Yates over `crypto` randomness that always returns a permutation of its input

**AC2 (FR-10 · integration)**
**Given** a *collecting* Game with fewer than three Answer sets
**When** the Host closes Collection
**Then** it is refused with the reason code, and the Game, links and submissions are unchanged

**AC3 (FR-10, FR-13 · integration)**
**Given** a *collecting* Game with at least three Answer sets
**When** the Host closes Collection
**Then** in one transaction every Answer becomes one `answer` row with `rank`, `text` and `normalized_text`, a fresh `crypto.randomUUID()` Contributor key per Answer set and Question, all rows shuffled and inserted by a single `grouping.insertAnswers` call; every `submission` and `invite_link` row of the Game is deleted; and the Game moves to *grouping* with `grouping_lease_until` set 180 s ahead
**And** a best-effort `VACUUM FULL submission, invite_link` runs after commit, outside the transaction, and a forced failure of it does not fail the close; the same happens after deleting a *collecting* Game

**AC4 (FR-10 · integration)**
**Given** a closed Game
**When** any former link is opened, or a submit arrives from a form opened before close, or a submit races the close
**Then** opening shows the closed page, the late submit is refused with `COLLECTION_CLOSED`, and the race ends either with the set included in the close or with the submit refused, never with a partial set (both orders tested in `collection.test.ts`)

**AC5 (FR-10, UX-DR8 · e2e)**
**Given** the *collecting* Game page
**When** fewer than three Answer sets exist, and then three
**Then** "Steng innsamlingen" is first `aria-disabled` with "Du trenger minst 3 innsendte svar før du kan stenge. Det beskytter anonymiteten. Lag flere lenker, vent litt, eller slett spillet.", and then opens a ConfirmDialog "Stenge innsamlingen? Dette kan ikke angres. Lenkene slutter å virke, og svarene grupperes." with the extra no-key sentence when no key is configured
**And** after confirming, the StatusBadge reads "Grupperer" and the panel says "Dommeren, en KI-modell, grupperer svarene … Det tar vanligvis under to minutter."; a Participant who submits after the close sees "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret." and their `localStorage` key is removed

### Story 3.2: Anonymity test: schema and data after close

As the group, and the SM-3 reviewer,
I want an automated inspection of the stored schema and data after close,
So that unlinkable storage is proven on every run, not assumed.

**Architecture:** AD-10, AD-22 (`tests/integration/anonymity.test.ts`).

**Acceptance Criteria:**

**AC1 (FR-13 · integration)**
**Given** a Game closed with at least three Answer sets
**When** `anonymity.test.ts` inspects `information_schema` for every table
**Then** no table outside `host`, `session` and `game` has a timestamp column, `answer` has exactly the seven AD-10 columns, no column on `answer` uses `serial`, `identity` or a sequence default, and no table has a column holding a Token, Token hash, Invite link reference or Answer set ID once `invite_link` and `submission` are empty

**AC2 (FR-13 · integration)**
**Given** the Token hashes captured before close
**When** every text and uuid column of every table is searched after close
**Then** none of those hashes appears, and `invite_link` and `submission` hold no row for the Game

**AC3 (FR-13 · integration)**
**Given** the closed Game's Answers
**When** Contributor keys are compared across Questions
**Then** no key appears under two Questions, and every `answer.id` is a version-4 UUID

**AC4 (FR-11 · integration)**
**Given** the full schema
**When** column names are inspected outside `host` and `session`
**Then** no table holds a name, email, IP address, user agent, device ID or account ID for a Participant

### Story 3.3: Anonymity tests: the Host's view during Collection, and log hygiene

As the group,
I want automated proof that a logged-in Host sees no Answer and no per-link state during Collection, and that no log holds a Token or an Answer,
So that FR-11 and FR-12 hold on every run.

**Architecture:** AD-7, AD-8, AD-17, AD-22 (`host-view.test.ts`, `host-anonymity.spec.ts`, server-output capture).

**Acceptance Criteria:**

**AC1 (FR-12 · integration)**
**Given** every Host read and action available while a Game is *collecting*
**When** `tests/integration/host-view.test.ts` calls each one before and after a Participant submits
**Then** no output contains Answer text, a Token, a hash or per-link state, and outputs differ only in the progress count once it reaches three

**AC2 (FR-12 · e2e)**
**Given** a Host logged in during Collection
**When** `tests/e2e/host-anonymity.spec.ts` visits every Host page and records every response body before and after a Participant submits
**Then** none contains a submitted Answer text or a Token
**And** reopening a used link from a fresh browser context shows an empty form

**AC3 (FR-11 · e2e)**
**Given** the Playwright setup capturing the Next server's stdout and stderr for the whole e2e run
**When** any spec finishes
**Then** the run fails if the captured output contains any Token or Answer text used in the run

**AC4 (FR-11 · integration)**
**Given** a forced DB error during `openInviteLink` and during `submitAnswerSet`
**When** each action fails
**Then** the action result and the log output contain no Token, edit secret or Answer text

**AC5 (FR-12 · integration)**
**Given** the `env.ts` key set and the `game` column set
**When** the test compares them with fixed expected lists
**Then** no variable, column, option or flag exists that could weaken §4.4, and adding one fails the test

## Epic 4: The Judge groups the Answers, or the fallback does

After close, Grouping runs once in the background; each Question gets Judge-proposed Groups or falls back to one Group per distinct normalised Answer, and the Game reaches *in review* with or without a key.

### Story 4.1: Judge boundary with replay and mock providers

As the group,
I want one Judge interface with a replay provider and a test mock,
So that Grouping can run without a key or network and the live model can be added behind the same boundary.

**Architecture:** AD-12 (items), AD-13, AD-14, AD-24 (`outputFileTracingIncludes` for `data/rulings/**`).

**Acceptance Criteria:**

**AC1 (FR-15, §6.4 · unit)**
**Given** `src/server/judge/index.ts` exporting `getJudge()`, `JudgeError` and the AD-13 `Judge.partition` interface
**When** `JUDGE_PROVIDER` is `mock`, `replay`, or unset
**Then** `getJudge()` returns the mock, the replay provider, or the replay provider respectively (the key-based default arrives with the live provider in Story 4.4)
**And** an ESLint zone forbids importing a provider or the SDK from outside `src/server/judge`

**AC2 (AD-13 · unit)**
**Given** provider output
**When** `assignments` has the wrong length or a non-integer value
**Then** the call throws `JudgeError('INVALID_OUTPUT')`; valid output is renumbered in first-occurrence order `0..k-1`

**AC3 (FR-15, FR-17 · unit)**
**Given** invented ruling fixtures under `tests/` and the replay provider pointed at them
**When** `partition` is called for a Question whose `normalize(question)` matches a ruling
**Then** covered items get the stored clusters, each uncovered item becomes its own cluster after them, and the result reports `source: 'stored'`, `calls: 0` and the uncovered count
**And** a Question with no covered item throws `NO_KEY` when no key is configured and `NO_STORED_RULING` otherwise

**AC4 (AD-14 · unit)**
**Given** ruling files in `data/rulings/*.json`
**When** the replay provider loads them
**Then** each record is validated as `{ kind: "partition", promptVersion, normalizeVersion, model, question, items, assignments }` with sorted distinct items, and a malformed file fails with a clear error

**AC5 (NFR-3 · unit)**
**Given** the mock provider
**When** a test supplies a map, or none
**Then** it returns the mapped clusters, or one cluster per item, deterministically and with no I/O

### Story 4.2: Grouping runs once at close, with per-Question fallback

As a Host,
I want my Answers grouped automatically right after I close Collection, even when the Judge is unavailable,
So that I can start Review within a couple of minutes.

**Architecture:** AD-4, AD-11 (Count in SQL), AD-12, AD-17 (3 s polling). **Tables:** `answer_group`, `grouping_result`; column `answer.group_id`.

**Acceptance Criteria:**

**AC1 (FR-15 · integration)**
**Given** a Game just closed
**When** the close action's `after(() => grouping.run(gameId))` runs with the mock Judge
**Then** each Question gets exactly one `partition` call over its sorted distinct normalised texts, and in one transaction per Question its Groups (`origin = judge`), every `answer.group_id` and one `grouping_result` row (source, prompt version, normalize version, model ID, Judge calls, uncovered items, `fell_back`, `fallback_reason`) are written
**And** when every Question has a result, `finishIfComplete` moves the Game to *in review*

**AC2 (FR-15 · integration)**
**Given** a Game whose Grouping has started or finished
**When** `grouping.run` is called again, `resumeIfStale` runs from two page loads at once, or Review data is read repeatedly
**Then** no Question with a `grouping_result` is partitioned again, only the lease winner runs, and the Groups are unchanged

**AC3 (FR-17 · integration)**
**Given** a mock Judge that throws `TIMEOUT` (the 30 s `AbortSignal`, with fake timers), `ERROR`, `REFUSAL` or `INVALID_OUTPUT` for chosen Questions
**When** Grouping runs
**Then** exactly those Questions get one Group per distinct normalised text with `origin = fallback`, `fell_back = true` and the matching reason, and the other Questions keep their Judge Groups
**And** with no key and no stored ruling, every Question falls back with `NO_KEY`, and the Game still reaches *in review*

**AC4 (FR-15 · integration)**
**Given** a Group holding two Answers with the same Contributor key and one with another
**When** its Count is read
**Then** the Count is 2, computed as `count(distinct contributor_key)` in SQL

**AC5 (FR-15 · integration)**
**Given** the sizing Game (30 Answer sets, 15 Questions, up to 5 Answers each) and a mock Judge
**When** Grouping runs
**Then** it completes well within two minutes, never runs more than five Questions at once, and never calls the Judge inside a transaction (asserted with a spy)
**And** if the Game is deleted mid-run, the run stops quietly

**AC6 (UX-DR16, UX-DR23 · e2e)**
**Given** the Game page in *grouping*
**When** Grouping progresses
**Then** the panel shows "N av M spørsmål ferdig", polls every 3 s, and switches to the *in review* summary (StatusBadge "Til gjennomgang", Question count, Groups proposed, number of fallback Questions) when done
**And** a run past its lease shows "Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt.", and the next page load resumes it

### Story 4.3: Usage counters and the usage report

As a Host,
I want a content-free report of how much the Judge proposed and how much I changed,
So that the group can measure whether the Judge helps (SM-5) without storing any Answer.

**Architecture:** AD-17 (report route), AD-18. **Tables:** `game_counter`.

**Acceptance Criteria:**

**AC1 (FR-18 · integration)**
**Given** `games.bumpCounters(tx, gameId, delta)` as the only writer of `game_counter`
**When** Grouping writes a Question's result
**Then** `judge_groups_proposed`, `judge_calls` and `questions_fell_back` increase by that Question's figures in the same transaction

**AC2 (FR-18, FR-12 · integration)**
**Given** a Game in *in review* or later
**When** its Host calls `GET /api/spill/[gameId]/rapport`
**Then** the response holds the counters, each Question's `source` and `fell_back`, and each Group's `origin` and `edit_count`, and contains no Answer text and no Group label
**And** another Host gets the same response as for a Game that does not exist

**AC3 (FR-18, FR-3 · integration)**
**Given** a Game with counters
**When** the Game is deleted
**Then** its `game_counter` row is gone

**AC4 (UX-DR16 · e2e)**
**Given** the Game page from *in review* onward
**When** the Host clicks "Last ned bruksrapport"
**Then** the report downloads; the button is absent in earlier states

### Story 4.4: Live Judge through the OpenRouter provider, prompt and ruling recorder

As the group,
I want the live Judge behind the same boundary, and a command that records its rulings,
So that real Games get meaning-based Groups and Demo mode and evaluation can replay them.

**Architecture:** AD-13, AD-14, AD-21 (`OPENROUTER_API_KEY`, `JUDGE_MODEL`), PRD §6.2, delivery-notes cost table.

**Acceptance Criteria:**

**AC1 (FR-15, NFR-3 · unit)**
**Given** the openrouter provider with a mocked `fetch`
**When** `partition` is called
**Then** the request holds only the Question text and the items, to `https://openrouter.ai/api/v1/chat/completions` with model `JUDGE_MODEL` (default `deepseek/deepseek-v4.1-flash`), a strict JSON-schema `response_format` for `{ assignments: number[] }`, `temperature: 0`, a bounded `max_tokens` and `provider: { require_parameters: true, data_collection: "deny" }`
**And** invalid output, 429 or 5xx is retried once inside the signal, an aborted signal throws `TIMEOUT`, `finish_reason: "content_filter"` throws `REFUSAL`, and `calls` counts the retry

**AC2 (FR-15 · unit)**
**Given** a stored ruling whose item set matches exactly
**When** the openrouter provider is asked to partition those items
**Then** it returns `source: 'stored'` without calling `fetch`

**AC3 (AD-13 · unit)**
**Given** `JUDGE_PROVIDER` unset
**When** `OPENROUTER_API_KEY` is set, or not
**Then** `getJudge()` returns the openrouter provider, or the replay provider

**AC4 (FR-15 · integration)**
**Given** `src/server/judge/prompt.ts` holding the prompt and `PROMPT_VERSION`, with no real person's text
**When** Grouping runs on the mock or replay provider
**Then** every `grouping_result` records the prompt version and model ID of the provider used

**AC5 (AD-14, FR-15 · manual, opt-in with a key)**
**Given** a live key in `.env.local`
**When** a developer runs `npm run judge:record` on an input file
**Then** it writes rulings in the AD-14 format, only under `.data/` unless writing the designated demo or ProtoQA ruling sources, and without a key it refuses with a clear message
**And** one live run times a synthetic 250-item Question, and the measured tokens and latency replace the estimates in `delivery-notes.md`

## Epic 5: Host reviews the Grouping and locks the Board

The Host reads each Question's ranked Groups with their raw Answers, corrects them, marks each Question reviewed and locks the Board.

### Story 5.1: Review screen with ranked Groups, Counts and raw Answers

As a Host,
I want to see each Question's Groups in Board order with their Counts and raw Answers,
So that I can judge whether the Grouping is fair before anyone plays.

**Architecture:** AD-5, AD-10 (Host DTOs), AD-11 (`src/lib/ranking.ts`). **Columns:** `question.reviewed` (displayed here, written from Story 5.2 on via `questions.setReviewed`).

**Acceptance Criteria:**

**AC1 (FR-16, NFR-3 · unit)**
**Given** `rankGroups()` and `boardCut()` over `{ groupId, count, rank1Count, labelCandidates }`
**When** their unit tests run
**Then** Groups order by Count, then rank-1 count, then label under `Intl.Collator('nb', { sensitivity: 'base' })`, then `groupId`; the Board cut is the top eight non-discarded Groups
**And** the default label is the normalised text given by the most distinct Contributor keys, ties broken by the shortest, cut to 40 characters at a word boundary, and the effective label is `custom_label ?? defaultLabel`

**AC2 (FR-19, FR-12 · integration)**
**Given** a Game in *in review*
**When** `review` returns a Question's data
**Then** every Answer of the Question appears under exactly one Group, Counts and rank-1 counts come from SQL aggregates, Answers are sorted by `normalized_text` then `text`, and the DTO contains no `contributor_key` and no `rank`

**AC3 (FR-19, UX-DR10, UX-DR11, UX-DR17 · e2e)**
**Given** `/spill/[id]/gjennomgang`
**When** the Host opens a Question with more than eight Groups
**Then** the rail shows "K av N gjennomgått" and only the status words "✓ Gjennomgått" and "Manuell" (fallback Questions), with no status line for a Question not yet reviewed ("Ikke gjennomgått" stays in its accessible name) and `aria-current` on the current one; the main pane shows "Spørsmål N av M" with "Marker som gjennomgått" at the right of the header, the `<h3>` heading "På brettet (8 grupper)" over ranks 1 to 8 with "1 person" / "N personer", the divider "Alt under streken vises ikke i spillet", and the `<h3>` "Ikke på brettet (1 gruppe)" with dashed-border cards and "Vises ikke i spillet. Slå dem sammen med en gruppe over for at de skal telle."
**And** chips collapse equal normalised texts into "{text} · N svar", sorted alphabetically, a Group with one chip equal to its label shows as a compact 52 px row (presentation only; it remains an ordinary Group), and no confidence signal appears anywhere

**AC4 (FR-17 · e2e)**
**Given** Games whose Questions fell back with `NO_KEY`, with `NO_STORED_RULING`, and with a Judge failure reason
**When** Review opens
**Then** the warning Notice uses the matching EXPERIENCE.md sentence, naming the affected Questions for failures ("Dommeren fikk ikke gruppert spørsmål {N}. …"), and is absent when no Question fell back

**AC5 (UX-DR17, NFR-4, NFR-6 · e2e)**
**Given** the Review screen
**When** it is shown at 1280, 1100, 900 and 700 px wide and scanned by axe
**Then** the rail is 288 px, 240 px, a `<select>` above the main pane, and finally accompanied by "Gjennomgangen er laget for større skjerm. Den virker her, men blir trang."; "Lås brettet" is `aria-disabled` with "Gjennomgå alle spørsmålene først (N igjen)."; axe reports no serious or critical violations
**And** the *in review* Game page gains "Gå til gjennomgangen", and opening Review for a Game not in *in review* redirects to the Game page

### Story 5.2: Merge Groups

As a Host,
I want to merge Groups that mean the same thing,
So that one answer is not split across several rows on the Board.

**Architecture:** AD-5 (one `question_id` per operation), AD-11 (merge rule), AD-15 (writers, `edit_count`, reviewed cleared), AD-18.

**Acceptance Criteria:**

**AC1 (FR-20 · integration)**
**Given** two or more Groups of one Question whose Answers share a Contributor key
**When** the Host merges them
**Then** the surviving Group keeps the ID of the highest-ranked source and freezes its effective label as `custom_label`, all Answers move to it, its Count is recomputed as distinct Contributor keys (less than the sum of the source Counts in the fixture), and the emptied Groups are deleted
**And** the Question's reviewed mark is cleared, `edit_count` increases, and `groups_merged` is bumped, all in one transaction

**AC2 (FR-20, AD-5 · integration)**
**Given** Group IDs from two different Questions, or from another Host's Game
**When** a merge is requested
**Then** it is refused with `NOT_FOUND` and nothing changes; outside *in review* it is refused with `WRONG_STATE`

**AC3 (FR-20, UX-DR12, UX-DR18 · e2e)**
**Given** the Review screen
**When** the Host ticks one Group, then two, and clicks "Slå sammen 2 grupper"
**Then** the SelectionBar first shows "Velg minst to grupper for å slå sammen." and then the merge action; the affected cards are `aria-busy` while pending; the list re-sorts, focus moves to the merged Group's heading, and the live region announces "Slått sammen til «{label}», nå N personer, plass P."
**And** a failed request shows "Endringen ble ikke lagret. Prøv igjen." inside the SelectionBar above its actions, with the Groups and the selection unchanged

**AC4 (NFR-5 · manual)**
**Given** the sizing Game in Review
**When** a merge is made
**Then** the result shows within one second; the timing item is added to `tests/manual/checklist.md`

### Story 5.3: Move Answers to another Group or a new Group

As a Host,
I want to move selected Answers to another Group or to a new one,
So that Answers the Judge joined wrongly can stand apart.

**Architecture:** AD-5, AD-11, AD-15, AD-18.

**Acceptance Criteria:**

**AC1 (FR-20 · integration)**
**Given** Answers selected from one or several Groups of one Question
**When** the Host moves them to another non-discarded Group of that Question
**Then** both Groups' Counts are recomputed as distinct Contributor keys, emptied source Groups are deleted, every Answer still sits under exactly one Group (FR-19), the reviewed mark is cleared, and `answers_moved` is bumped

**AC2 (FR-20, FR-16 · integration)**
**Given** selected Answers
**When** the Host moves them to a new Group
**Then** a Group is created with the FR-16 default label from its Answers, both Groups are recounted, `groups_created` is bumped, and the new Group is not counted as Judge-proposed

**AC3 (AD-5 · integration)**
**Given** Answer IDs from another Question or another Game, or a target Group that is discarded or belongs to another Question
**When** a move is requested
**Then** it is refused with `NOT_FOUND` and nothing changes

**AC4 (FR-20, UX-DR11, UX-DR12, UX-DR18 · e2e)**
**Given** the Review screen
**When** the Host ticks Answer chips
**Then** any Group selection is cleared; the SelectionBar offers "Flytt til gruppe" (a native `<select>` of the Question's non-discarded Groups sorted by Count as "label (N)" plus "Flytt") and "Ny gruppe"; a move to a Group moves focus there and announces "N svar flyttet til «{label}».", and "Ny gruppe" opens the new Group's rename field with focus and announces "Ny gruppe «{label}» laget. Skriv et nytt navn eller trykk Enter."
**And** "Fjern valg" or Esc clears the selection, and changing Question clears it too

### Story 5.4: Rename, discard and restore Groups

As a Host,
I want to rename a Group so it reads well on a TV, and keep a hurtful Group off the shared screen,
So that the Board is both legible and kind.

**Architecture:** AD-11 (effective label), AD-15, AD-18.

**Acceptance Criteria:**

**AC1 (FR-20 · integration)**
**Given** a Group in *in review*
**When** the Host renames it
**Then** a label of 1 to 40 characters is saved as `custom_label`, anything else is refused with `INVALID_INPUT`, the reviewed mark is cleared, and `groups_renamed` is bumped

**AC2 (FR-20, FR-21 · integration)**
**Given** a Question with nine non-discarded Groups
**When** the Host discards one of the eight on the Board, and later restores it
**Then** on discard the ninth Group enters the Board cut, the discarded Group's Answers remain readable under the discarded section, and it will never reach play; on restore it returns to its ranked place
**And** each action clears the reviewed mark and bumps `groups_discarded` or `groups_restored`

**AC3 (FR-20, UX-DR10, UX-DR18 · e2e)**
**Given** the Review screen
**When** the Host picks "Gi nytt navn" from a Group's menu, or clicks its label
**Then** an inline field with "N/40" opens, Enter saves and announces "Navnet er endret.", Esc cancels
**And** "Forkast fra brettet" moves the card to *Forkastet* (label struck through, Answers as plain text, no checkboxes, one "Angre forkasting" button) and announces "«{label}» er forkastet og vises ikke i spillet."; "Angre forkasting" announces "«{label}» er tilbake."

### Story 5.5: Mark Questions reviewed and lock the Board

As a Host,
I want to mark each Question reviewed and then lock the Board,
So that the Game is ready to play and the Board can no longer change.

**Architecture:** AD-4, AD-10 (`clearContributorData`), AD-15 (`board_slot`, `NO_GROUPS_ON_BOARD`). **Tables:** `board_slot`.

**Acceptance Criteria:**

**AC1 (FR-21 · integration)**
**Given** a Question in *in review*
**When** the Host marks it reviewed, unmarks it, and marks a Question whose Groups are all discarded
**Then** the first two succeed, and the third is refused with `NO_GROUPS_ON_BOARD` ("Minst én gruppe må være på brettet før du kan markere spørsmålet.", shown under the "Marker som gjennomgått" button)

**AC2 (FR-21 · integration)**
**Given** a Game where every Question is reviewed
**When** the Host confirms the Board
**Then** `board_slot` rows (position 1 to 8, label, frozen Count, `group_id`) are written per Question from `boardCut(rankGroups())`, never more than eight and never a discarded Group, and the Game moves to *ready*
**And** with any Question unreviewed, confirming is refused and nothing changes

**AC3 (FR-21 · integration + e2e)**
**Given** a Game in *ready*
**When** any merge, move, rename, discard, restore, mark or confirm is attempted
**Then** it is refused with `WRONG_STATE`; Review redirects to the Game page, and a stale Review tab shows "Brettet er allerede låst." with a link to the Game page

**AC4 (FR-13, SM-3 · integration)**
**Given** a confirmed Board
**When** `anonymity.test.ts` inspects the Game's Answers
**Then** every `contributor_key` and every `rank` is NULL

**AC5 (FR-21, UX-DR17, UX-DR18, UX-DR8 · e2e + manual)**
**Given** the Review screen
**When** the Host clicks "Marker som gjennomgått" (in the Question header) on each Question and then "Lås brettet"
**Then** each mark updates the rail, opens the next unreviewed Question and announces "Spørsmål N er gjennomgått. Viser spørsmål M."; a reviewed Question shows "✓ Gjennomgått" and "Neste spørsmål"; "Lås brettet" opens a ConfirmDialog and confirming lands on the Game page with "Brettet er låst. N spørsmål er klare."
**And** checklist item A6 (Review end to end by keyboard only) is added to `tests/manual/checklist.md`

## Epic 6: The group plays the Board from one shared screen

The Host names the Teams and runs the round from the TV, with scored and unscored Reveals, misses, undo, turns, next Question and final Scores, all saved on the server.

### Story 6.1: Name the Teams and start play

As a Host,
I want to name two to four Teams and start the round,
So that the room can play as teams on the TV.

**Architecture:** AD-4, AD-16. **Tables:** `team`, `play_state`.

**Acceptance Criteria:**

**AC1 (FR-23 · integration)**
**Given** a Game in *ready*
**When** the Host starts play with two to four Team names of 1 to 14 characters
**Then** the Teams are stored in order, `play_state` points at the first Question and the first Team, every Team's Score is zero, and the Game moves to *playing*
**And** one or five Teams, an empty name or a name over 14 characters is refused, and a Game not in *ready* is refused with `WRONG_STATE`

**AC2 (FR-23, UX-DR22 · e2e)**
**Given** the *ready* Game page with "Start spillet"
**When** the Host follows it to `/spill/[id]/skjerm`
**Then** Team setup shows "Hvem spiller?" with "Lag 1" and "Lag 2" prefilled, "Legg til lag" up to four, "Fjern" down to two, the errors "Laget trenger et navn." and "Navnet kan ha maks 14 tegn.", and "Start spillet" opens the play view with "Trykk F for fullskjerm."
**And** for a *playing* Game the Game page offers "Fortsett spillet", which resumes the play view; Games in other states redirect to the Game page

### Story 6.2: Show the Board on the shared screen and make scored Reveals

As a Host,
I want the current Question shown on the TV with hidden Groups, and to reveal the Group a Team guesses,
So that the room sees the answer and the Team gets its points.

**Architecture:** AD-11 (Score), AD-15 (`review.getBoard`), AD-16. **Tables:** `reveal`.

**Acceptance Criteria:**

**AC1 (FR-24, UX-DR13, UX-DR14, UX-DR21 · e2e)**
**Given** a *playing* Game
**When** the play view renders
**Then** a fixed 1920×1080 canvas scaled to the window shows "Spørsmål N av M" at the top of the Team column, the Question (56 px up to 80 characters, 48 px above), one hidden tile per Board slot showing only its rank, the current Team as a mint card with "Svarer nå", and every Team's Score, with no Host top bar
**And** at 1920×1080 the computed font size of Question, labels, Counts, Team names and Scores is at least 48 px, and a 200-character Question with eight Groups leaves the control bar inside 1080 px

**AC2 (FR-24 · integration + e2e)**
**Given** a fixture with discarded Groups, Groups below the Board limit and known raw Answers
**When** the play view is read and rendered through a full Question
**Then** its data comes only from `board_slot`, and none of those Groups or Answer texts appears in the DOM

**AC3 (FR-25, NFR-3 · unit + integration)**
**Given** a Board slot on the current Question
**When** the Host reveals it as scored
**Then** the reveal is credited to the `play_state` Team under the Game lock, and the Team's Score equals the SQL sum of the Counts of its scored reveals
**And** a slot on another Question is refused with `WRONG_QUESTION`, an already revealed slot with `ALREADY_REVEALED`

**AC4 (FR-25 · e2e)**
**Given** the play view
**When** the Host clicks a hidden tile or presses its rank key `1`–`8`
**Then** the tile border is `stage-ink` until the server acknowledges, then the label and Count appear in a staged reveal of about 700 ms and the Team's Score counts up (all instant under reduced motion), the live region announces "«{label}», N poeng til {Team}.", and the tile is no longer a button

**AC5 (FR-27 · e2e)**
**Given** a round in progress with reveals
**When** the play view is reloaded
**Then** the current Question, current Team, revealed tiles and Scores are restored from the server

**AC6 (FR-24, NFR-5 · manual)**
**Given** a real TV or projector
**When** checklist items A1 (legible from 3 m), A7 (no raw Answer, discarded or below-limit Group at any point of a full round), A8 (200-character Question with eight Groups fits 1080 px), A9 (a 40-character wide label is never truncated) and the play timing item are run
**Then** they pass and are recorded in `tests/manual/checklist.md`

### Story 6.3: Misses, undo, turns and unscored Reveals

As a Host,
I want to mark a miss, undo a misclick, pass the turn and reveal the rest without points,
So that a round runs smoothly the way the room plays it.

**Architecture:** AD-16 (undo, unscored reveal, next Team).

**Acceptance Criteria:**

**AC1 (FR-25 · e2e)**
**Given** the play view
**When** the Host presses "Bom [M]"
**Then** "Bom" shows as an 80 px panel centred over the list (150 ms in, 1.2 s hold, 150 ms out), with no sound, no red and no icon, and the saved play state is unchanged, so the turn does not pass

**AC2 (FR-26 · integration)**
**Given** scored and unscored reveals on the current Question and reveals on an earlier Question
**When** the Host undoes repeatedly
**Then** each undo deletes the highest-`seq` reveal on the current Question, subtracting its Count from the Team that received it when it was scored; earlier Questions' reveals are never undone, and undo with nothing to undo is refused

**AC3 (FR-27, FR-25 · integration + unit)**
**Given** a round
**When** the Host passes the turn past the last Team, and makes unscored reveals
**Then** the turn wraps to the first Team, unscored reveals store a null Team and change no Score
**And** a unit test over arbitrary sequences of reveals and undos shows each Score always equals the sum of its scored reveals' Counts

**AC4 (FR-26, FR-27, UX-DR21 · e2e)**
**Given** the play view control bar
**When** the Host uses "Angre [Z]", "Neste lag [T]" and "Vis resten uten poeng [U]"
**Then** Angre is hidden when there is nothing to undo and announces "Angret. «{label}» er skjult igjen, N poeng trukket fra {Team}." after a scored undo; "Svarer nå" moves to the next Team; the unscored toggle has `aria-pressed`, reads "Avslører uten poeng [U]" in `stage-ink` weight 700 with hidden tiles dashed, makes tiles reveal with "uten poeng", and switches off on the next Question
**And** shortcuts are ignored while focus is in a text field, `?` opens and `Esc` closes the shortcut overlay, `F` toggles fullscreen, "Alle svarene er avslørt." appears when every tile is revealed, and a failed save shows "Fikk ikke lagret trekket. Prøv igjen." in a banner replacing the control-bar row, with the state unchanged

### Story 6.4: Next Question, final Scores and the played Game

As a Host,
I want to move through the Questions and end with the final Scores,
So that the room knows who won and the Game is cleaned up afterwards.

**Architecture:** AD-16 (next Question, `finish`), AD-23 (retention from `played_at`).

**Acceptance Criteria:**

**AC1 (FR-27 · integration)**
**Given** a *playing* Game
**When** the Host moves to the next Question, and then past the last one
**Then** the next Question is the one with the smallest greater position and unrevealed Groups stay hidden; past the last, `finish` moves the Game to *played*, sets `played_at` and returns `deleteAfter` = `played_at` + 30 days
**And** every play operation on a *played* Game is refused with `WRONG_STATE`

**AC2 (FR-27, UX-DR21 · e2e)**
**Given** the play view
**When** the Host presses "Neste spørsmål [N]" or `→`, and on the last Question "Vis sluttstilling"
**Then** the next Question appears with its tiles hidden, and finally "Sluttstilling" shows every Team sorted by Score at 120 px, the winner styled as the active card with "Vinner" (or "Uavgjort" on every tied Team), the line "Spillet slettes automatisk {dato}." and "Tilbake til spillet"

**AC3 (FR-3, FR-27 · e2e)**
**Given** a *played* Game
**When** the Host opens its Game page and its play URL
**Then** the Game page shows the final Scores, "Vis sluttstilling" and "Spillet og alle svarene slettes automatisk {dato}." with the date 30 days after `played_at`, and the play URL shows the final Scores

### Story 6.5: A full round without a model key, end to end

As the examiner,
I want proof that the whole Stage 1 loop runs with no model key and no network,
So that I can trust the app works without the group's keys.

**Architecture:** AD-13 (replay miss gives `NO_KEY`), AD-22 (`no-key.spec.ts`, axe pass).

**Acceptance Criteria:**

**AC1 (FR-30 · e2e)**
**Given** the app built with no key and every non-localhost request blocked
**When** `tests/e2e/no-key.spec.ts` registers a Host, creates a Game, writes Questions, creates links, submits three Answer sets from three browser contexts, closes Collection, waits for fallback Grouping, merges one pair in Review, marks every Question reviewed, locks the Board, names two Teams, makes scored and unscored reveals, undoes one, and plays to "Sluttstilling"
**Then** every step succeeds, Review shows the `NO_KEY` notice, and each final Score equals the sum of that Team's scored Counts

**AC2 (NFR-6 · e2e)**
**Given** the answer form, Review and the play view reached in that spec
**When** `@axe-core/playwright` scans each
**Then** it reports no serious or critical violations

**AC3 (FR-11 · e2e)**
**Given** the server-output capture from Story 3.3
**When** this spec runs
**Then** no Token or Answer text used in it appears in the server output

## Epic 7: The examiner runs it without keys: Demo mode, Judge evaluation and hand-in

The examiner clones the repository, starts Demo mode in three commands, sees Judge Groups from Stored rulings, runs the tests and the Judge evaluation offline, and finds every Stage 1 consequence traced to a test or a checklist.

### Story 7.1: Demo mode with one command

As the examiner,
I want one command that starts the app with a demo Host and a demo Game ready to close,
So that I can see what the Judge does without any key.

**Architecture:** AD-14 (`data/rulings/demo.json`), AD-19, AD-21 (`DEMO_MODE`), AD-22 (demo smoke in CI).

**Acceptance Criteria:**

**AC1 (FR-31, NFR-1 · CI)**
**Given** a fresh clone after `npm install`
**When** `npm run demo` runs (`src/cli/demo.ts` through `tsx`, no shell syntax)
**Then** it recreates `.data/demo`, migrates, seeds through module functions an invented demo Host (credentials from one `src/lib` constant, printed on start) and one demo Game in *collecting* with invented Norwegian Questions and Answer sets, and starts `next dev` with `JUDGE_PROVIDER=replay`, `DEMO_MODE=1` and a matching `APP_BASE_URL`
**And** the CI job starts it in the background, polls `/api/health` until 200, and stops it

**AC2 (FR-31, FR-15 · integration)**
**Given** the demo seed and `data/rulings/demo.json` recorded with `npm run judge:record`
**When** `tests/integration/demo-replay.test.ts` closes the demo Game
**Then** every Question's `grouping_result` has `source = replay`, `uncovered_items = 0` and no fallback, with no network call

**AC3 (FR-31, UX-DR28 · e2e)**
**Given** the app in Demo mode
**When** `tests/e2e/demo.spec.ts` opens `/` and `/logg-inn`, clicks "Fyll inn demobrukeren", logs in, closes the demo Game and opens Review
**Then** the landing and login pages show the demo login, every Host page shows "Demomodus: alt innhold er oppdiktet, og dommeren bruker lagrede avgjørelser.", and Review shows Judge Groups with no fallback Notice

**AC4 (FR-31, §6.1 · manual)**
**Given** the demo seed, demo rulings and demo credentials
**When** they are reviewed before merge
**Then** every Question, Answer and name is invented and none derives from `.idea/`; this is an item in `tests/manual/checklist.md`

### Story 7.2: Judge evaluation against ProtoQA

As the group, and the examiner,
I want one offline command that scores the Judge against human clusters,
So that Grouping quality is measured, not claimed (SM-2).

**Architecture:** AD-13 (quality bar), AD-14, AD-20.

**Acceptance Criteria:**

**AC1 (FR-32, NFR-3 · unit)**
**Given** `src/lib/bcubed.ts` with respondent weights
**When** its unit tests run
**Then** a hand-computed example matches, and both "everything in one Group" and "every item alone" score clearly below a correct partition

**AC2 (FR-32, SM-2 · integration)**
**Given** `data/protoqa/dev.crowdsourced.jsonl` and `data/rulings/protoqa-dev.json`
**When** `npm run judge:eval` runs with no key and no network (`tests/integration/judge-eval.test.ts`)
**Then** it prints B-cubed precision, recall and F1, Judge calls per Question, the prompt version and the model ID, warns if the rulings' versions differ from the current ones, and the figures equal the pinned values for the committed rulings, and it states whether F1 reaches 0.70
**And** before the freeze a shortfall may be tuned (prompt, effort or `JUDGE_MODEL`, with `PROMPT_VERSION` bumped and rulings re-recorded and re-pinned), and every version tried is recorded for the README; after the freeze nothing is changed to chase the figure (PRD SM-2)

**AC3 (FR-32, SM-4 · manual, opt-in)**
**Given** a live key, and separately a local labelled file
**When** a developer runs `npm run judge:eval -- --live`, and `npm run judge:eval -- --file <path>`
**Then** the first regenerates the rulings, and the second prints aggregate figures only, never items

**AC4 (FR-32, §6.1, §6.3 · manual)**
**Given** the committed `data/protoqa/` folder
**When** it is reviewed
**Then** it holds only the crowdsourced dev questions, and `ATTRIBUTION.md` gives the CC-BY-4.0 credit, states the changes made and covers `protoqa-dev.json`; no scraped or training file is committed

### Story 7.3: Traceability, manual checklists and the SM-1 gate

As the group,
I want every Stage 1 consequence traced to a test or a manual check, and the remaining manual checks run,
So that SM-1 can be declared passed and Stage 2 can be considered.

**Architecture:** AD-4 (full matrix), AD-22 (`TRACE.md`, manual files, CI Postgres job).

**Acceptance Criteria:**

**AC1 (SM-1 · unit)**
**Given** `tests/TRACE.md` filled in by every earlier story
**When** the completeness unit test runs
**Then** it fails if any Stage 1 FR (FR-1 to FR-21, FR-23 to FR-27, FR-30 to FR-32) is missing from `TRACE.md`

**AC2 (AD-4 · integration)**
**Given** `src/lib/game-state.ts`
**When** `game-state.test.ts` runs
**Then** it walks every operation against every state and asserts that exactly the permitted-operations table is allowed

**AC3 (SM-1, UX-DR26, NFR-5, NFR-6 · manual)**
**Given** `tests/manual/checklist.md` holding A1 to A10, the NFR-5 timing items for Review and play on the sizing Game, and the demo-content item
**When** the group runs it once before the Stage 1 freeze
**Then** every item has a recorded result and date, and any failure has a fix or, only for an item on the PRD §6.5 slip list, a stated slip in the README; the SM-1 gate counts every Stage 1 consequence except slipped items the README names (PRD SM-1, §6.5)

**AC4 (SM-3 · manual)**
**Given** `tests/manual/anonymity-audit.md` describing the SM-3 procedure (Host access, the list of Invite links and a database dump taken after the Board is confirmed)
**When** a group member not involved in the last change runs it
**Then** no Answer can be attributed to an Invite link or joined across Questions, and the result is recorded

**AC5 (AD-22 · CI, cuttable)**
**Given** a second CI job with a Postgres service container
**When** CI runs
**Then** `tests/integration` passes against Postgres as well as PGlite; if cut, the README says so (delivery-notes cut order item 1)

### Story 7.4: README, hand-in zip and fresh-clone check

As the examiner,
I want a README that gets me from a clean machine to a running demo and passing tests, and states the product's limits honestly,
So that I can assess the project without the group's help.

**Architecture:** delivery-notes README contract, AD-21, Conventions (scripts).

**Acceptance Criteria:**

**AC1 (NFR-1, FR-31 · manual + CI)**
**Given** a clean machine with only Node 22.13 or newer and git
**When** a group member follows only the README
**Then** `git clone`, `npm install` and `npm run demo` start Demo mode, the printed demo login works, and the README's test commands (`npm test`, `npx playwright install chromium` then `npm run test:e2e`, `npm run judge:eval`) pass; the run is recorded in the checklist, and CI uses the same script names

**AC2 (FR-14 · manual)**
**Given** the README's anonymity section
**When** it is checked against the delivery notes and EXPERIENCE.md
**Then** it states that nobody can see who wrote an Answer and that Answers may be sent to an external AI service for grouping (the FR-14 notice), and lists all eight limits from the delivery notes plus the unsent draft kept on the Participant's device, pointing to the sprint change proposal of 2026-11-23

**AC3 (NFR-8 · integration + manual)**
**Given** the README's environment table and `.env.example`
**When** they are compared with `env.ts`
**Then** all three list the same variables, the README says the app runs without any key, and no key or password exists in any tracked file

**AC4 (NFR-1 · manual)**
**Given** `scripts/make-zip.sh`
**When** it builds the hand-in from `git archive HEAD`
**Then** the zip contains no `.env.local`, `.idea/`, `.data/` or `node_modules/`

**AC5 (NFR-1 · manual)**
**Given** the finished README
**When** it is reviewed against the delivery-notes contract
**Then** it covers what and for whom with a screenshot in `docs-assets/`, prerequisites, structure with links to `.docs/`, `wiki/` and `prompting/`, what Stage 2 left out and why, every item of the PRD §6.5 slip list that slipped (or that none did), the SM-2 figure with every prompt version and model tried, and that retention runs only while the app is running

### Story 7.5: Pilot deployment (first to cut)

As the group,
I want the same build running on a public host,
So that pilot Hosts' Participants can open Invite links on their phones (SM-6, SM-7).

**Architecture:** AD-2 (postgres.js), AD-21, AD-23 (Cron), AD-24. First item in the delivery-notes cut order.

**Acceptance Criteria:**

**AC1 (NFR-2 · manual)**
**Given** Vercel Hobby with Node runtime, Neon free tier in the EU with a pooled `DATABASE_URL`, `REGISTRATION_CODE`, `CRON_SECRET`, production from `main` only and previews disabled
**When** the build is deployed and `npm run db:migrate` runs as an explicit deploy step
**Then** the app works with no code difference from the local build, and a daily Cron calls `/api/purge` with the secret

**AC2 (NFR-2 · manual)**
**Given** the pilot deployment
**When** a group member runs a Game with Invite links opened on real phones through to final Scores
**Then** every step works, and Grouping finishes within the 300 s function limit

**AC3 (NFR-1 · manual)**
**Given** the README
**When** the pilot is live, or has been cut
**Then** the local path still never mentions a host, and a cut is stated with its reason

## Epic 8: Stage 2 - only after SM-1 passes

Do not start any story in this epic until SM-1 passes in full on `main` (PRD §6.5). FR-33 comes first. These stories carry acceptance criteria only; design detail is decided when Stage 2 starts, inside AD-4, AD-13, AD-15 and AD-16, and the spine is amended then.

### Story 8.1: Play a ready-made Question set

As a Host,
I want to start a Game tonight from a ready-made Question set,
So that we can play without a Collection.

**Precondition:** PRD §10 item 3 (ProtoQA provenance and trademark) is settled with the course staff.

*Amended 2026-11-24, recording the group's decision of 2026-11-23 (`wiki/prosjekt/beslutninger.md`):* the group settled the precondition itself, without asking the course staff: only the crowdsourced part of ProtoQA (CC BY 4.0) is used. Story 8.1 started before SM-1 passed, by the same decision; the SM-1 gate still applies to Stories 8.2 to 8.4. The entry point is `review.createFromQuestionSet`, which composes the owners' writers (AD-1, AD-15).

**Acceptance Criteria:**

**AC1 (FR-33)**
**Given** a Host choosing a Question set
**When** the Game is created
**Then** it starts in *ready*, skipping Collection, Grouping and Review, and play can start on it

**AC2 (FR-33)**
**Given** a Game from a Question set
**When** its Board is read
**Then** it equals the dataset's clusters and Counts for those Questions, capped at eight Groups as in FR-21

**AC3 (FR-33)**
**Given** the play screen and the README
**When** a Question-set Game is played
**Then** the source dataset is credited on the play screen and in the README, Questions and labels are in Norwegian with Counts unchanged, and the credit says the material is translated and adapted

### Story 8.2: Reorder Groups in Review

As a Host,
I want to override the order of Groups on the Board,
So that the Board reads the way I want.

**Acceptance Criteria:**

**AC1 (FR-22)**
**Given** a Question in Review
**When** the Host sets a manual order
**Then** the order survives until the Board is confirmed, and play uses it

### Story 8.3: Assisted Guess matching

As a Host,
I want to type a Guess and have the Judge propose the Group it matches,
So that I do not have to decide every match myself.

**Acceptance Criteria:**

**AC1 (FR-28, §6.4)**
**Given** a typed Guess
**When** the Judge proposes a Group through the same Judge boundary
**Then** nothing is revealed until the Host accepts or overrides the proposal

**AC2 (FR-28)**
**Given** no model key
**When** the Host plays
**Then** play works exactly as in FR-25

**AC3 (FR-28)**
**Given** a Game with typed Guesses
**When** it reaches *played*
**Then** the typed Guesses are deleted

### Story 8.4: Strikes and steals

As a Host,
I want to switch on strikes and steals for a Game,
So that play can follow fuller game-show rules when the group wants them.

**Precondition:** the rules are decided by the group when Stage 2 starts (PRD §10 item 4).

**Acceptance Criteria:**

**AC1 (FR-29)**
**Given** a Game with strikes and steals switched on
**When** it is played
**Then** the rules decided at Stage 2 start apply, and a Game without them switched on plays exactly as in Stage 1

### Story 8.5: Separate TV view and host view with answer key

As a Host,
I want a clean TV page for the room and a Host page with the answer key and the controls,
So that the room does not see my controls and I can see every Group's label and Count while I play.

*Amended 2026-11-24, recording the group's decision of 2026-11-24 after testing the pilot:* Story 8.5 started before SM-1 passed, by that decision, as Story 8.1 did by the decision of 2026-11-23. It builds the extended-display idea of EXPERIENCE.md Open Question 4 as two owner-only routes beside the unchanged `/spill/[id]/skjerm`: `/spill/[id]/tv`, the stage canvas with a controls-free Board, and `/spill/[id]/vert`, a light Host page with the answer key and the same actions and shortcuts. The two follow each other through a same-origin `BroadcastChannel` and a 2 s poll on the TV page. PRD §4.7 (FR-24 to FR-27), EXPERIENCE.md, DESIGN.md and the spine (AD-15, AD-16, AD-17, Conventions) are amended in the same change. The spec is `.docs/implementation-artifacts/spec-8-5-separate-tv-view-and-host-view-with-answer-key.md`.

**Architecture:** AD-5, AD-15 (`play.answerKey` reads `board_slot` through `review.getBoard`, never Answers), AD-16 (a message or a poll only triggers a re-read), AD-17 (`TV_POLL_MS`, `BroadcastChannel`; no websockets, no Route Handler). **Tables:** none, and no migration.

**Acceptance Criteria:**

**AC1 (FR-24 · integration)**
**Given** a *playing* Game with one revealed slot
**When** `/spill/[id]/tv` is rendered
**Then** it shows the Question, the revealed label and Count, the Teams and Scores, and rank-only hidden tiles, with no control text
**And** no hidden slot's label or Count appears anywhere in the markup

**AC2 (FR-24, FR-25 · integration)**
**Given** the same Game
**When** `play.answerKey` runs, or `/spill/[id]/vert` is rendered
**Then** every slot's label and Count is present with its revealed or hidden state, together with the Teams, the Scores and "Spørsmål N av M"

**AC3 (FR-23, FR-27 · integration)**
**Given** another Host's Game or a missing Game
**When** `/tv` or `/vert` loads, or `answerKey` runs
**Then** the result is not-found
**And** a *ready* Game shows Team setup, a *draft* Game redirects to the Game page, and a *played* Game shows "Sluttstilling" on `/tv` (no deletion line and no link back) and the final standing on `/vert`

**AC4 (FR-25, FR-26, FR-27 · e2e)**
**Given** `/vert` and `/tv` open in one browser context
**When** the Host reveals (by button and by key), makes a Bom, undoes, passes the turn and moves to the next Question through "Vis sluttstilling"
**Then** `/tv` shows each result within 1.5 s, including the Bom panel and "Sluttstilling"

**AC5 (FR-24 · e2e)**
**Given** `/tv`
**When** `1`, `m`, `z`, `t`, `u`, `n`, `→` and `?` are pressed
**Then** nothing changes and the page has no button
**And** `F` toggles fullscreen

**AC6 (FR-24, NFR-6 · e2e)**
**Given** `/tv` at 1920×1080 and `/vert` at 1280×800
**When** they are rendered and checked with axe
**Then** the canvas fills the window with labels and Scores of at least 48 px, and axe finds no serious violation on either page

**AC7 (FR-27 · integration)**
**Given** a *playing* Game page
**When** it renders
**Then** it links "Fortsett spillet", "Åpne TV-visning" and "Vertsvisning med fasit"

### Story 8.6: Play needs two views: host view and TV view

As a Host,
I want play to always run as the Host view on my laptop and the TV view on the TV,
So that I always have the answer key and the room never sees my controls.

*Amended 2026-11-25, recording the group's decision of 2026-11-25 after testing Story 8.5 on the pilot:* the one-screen stage at `/spill/[id]/skjerm` does not help, because the Host cannot see the answer key there, and "Start spillet" went straight into it. Story 8.6 removes the stage and "Fortsett spillet". Team setup moves to its own Host page, `/spill/[id]/lag`; after the start the Host lands on the Game page, which links the Host view and the TV page. `/skjerm` only redirects to the Game page. PRD §4.7 (FR-23 to FR-27), EXPERIENCE.md, DESIGN.md and the spine (AD-15, AD-16, AD-17, Conventions) are amended in the same change. The spec is `.docs/implementation-artifacts/spec-8-6-play-needs-two-views-host-view-and-tv-view.md`.

**Architecture:** AD-5 (every play page owner-only), AD-16 (no change to `play`), AD-17 (the waiting TV page uses the existing channel and poll). **Tables:** none, and no migration.

**Acceptance Criteria:**

**AC1 (FR-23 · integration)**
**Given** a *ready* Game
**When** `/spill/[id]/lag` is rendered
**Then** it shows Team setup ("Hvem spiller?") on a Host page
**And** a Game in any other state redirects to `/spill/[id]`, another Host's or a missing Game is not-found, and `/spill/[id]/vert` in *ready* redirects to `/spill/[id]/lag`

**AC2 (FR-23, FR-24 · integration)**
**Given** a *ready* Game
**When** `/spill/[id]/tv` is rendered
**Then** it shows the Game title and "Spillet starter snart" on the stage canvas, with no form, field or button

**AC3 (FR-23, FR-24 · e2e)**
**Given** `/spill/[id]/tv` open on its waiting screen in the same browser
**When** the Host names the Teams on `/spill/[id]/lag` and clicks "Start spillet"
**Then** the Host lands on `/spill/[id]` with "Spillet er i gang", and the TV page shows the first Question within 1.5 s

**AC4 (FR-23, FR-27 · integration)**
**Given** a Game page
**When** it renders in *ready*, *playing* and *played*
**Then** "Start spillet" links to `/spill/[id]/lag`; in *playing* "Vertsvisning med fasit" is the primary link and "Åpne TV-visning" the secondary one, with the two-window line and the mirroring warning, and no "Fortsett spillet"; in *played* "Åpne TV-visning" shows the final Scores on the TV page

**AC5 (FR-24 · integration)**
**Given** any Game id
**When** `/spill/[id]/skjerm` is requested
**Then** it redirects to `/spill/[id]` and renders no stage

**AC6 (FR-24 to FR-27, NFR-6 · e2e)**
**Given** the end-to-end tests that ran through the one-screen stage
**When** they run through `/spill/[id]/vert` and `/spill/[id]/tv` instead
**Then** every FR-24 to FR-27 criterion still has a passing test, and axe finds no serious violation on `/lag`, the waiting TV page and the *playing* Game page

## FR Coverage by Story

Every Stage 1 FR maps to at least one Stage 1 story; every Stage 2 FR maps to one story in Epic 8. Story numbers below are the stories whose acceptance criteria cite the requirement.

| FR | Stories | FR | Stories |
|----|---------|----|---------|
| FR-1 | 1.3, 1.4, 2.3 | FR-17 | 3.1, 4.1, 4.2, 5.1 |
| FR-2 | 1.4 | FR-18 | 4.3 (Review counters in 5.2 to 5.4) |
| FR-3 | 1.5, 2.3, 4.3, 6.4 | FR-19 | 5.1 |
| FR-4 | 2.1, 2.2 | FR-20 | 5.2, 5.3, 5.4 |
| FR-5 | 2.2 | FR-21 | 5.4, 5.5 |
| FR-6 | 2.3, 2.4, 2.5 | FR-23 | 6.1, 8.5, 8.6 |
| FR-7 | 2.4, 2.5 | FR-24 | 6.2, 8.5, 8.6 |
| FR-8 | 2.6 | FR-25 | 6.2, 6.3, 8.5, 8.6 |
| FR-9 | 2.3, 2.7 | FR-26 | 6.3, 8.5, 8.6 |
| FR-10 | 2.3, 3.1 | FR-27 | 6.2, 6.3, 6.4, 8.5, 8.6 |
| FR-11 | 1.3, 2.3, 2.4, 3.2, 3.3, 6.5 | FR-30 | 6.5 |
| FR-12 | 2.2, 2.5, 2.6, 3.3, 4.3, 5.1 | FR-31 | 7.1, 7.4 |
| FR-13 | 3.1, 3.2, 5.5 | FR-32 | 7.2 |
| FR-14 | 2.4, 7.4 | FR-22 *(Stage 2)* | 8.2 |
| FR-15 | 4.1, 4.2, 4.4, 7.1 | FR-28 *(Stage 2)* | 8.3 |
| FR-16 | 5.1, 5.3 | FR-29, FR-33 *(Stage 2)* | 8.4, 8.1 |

**NFRs:** NFR-1 in 1.1, 7.1, 7.4; NFR-2 in 1.1 (configuration only) and 7.5; NFR-3 in 1.1 and every story with unit or integration proof; NFR-4 in 2.4, 5.1, 6.2; NFR-5 in 5.2, 6.2, 7.3 (manual); NFR-6 in 1.2, 1.3, 2.1, 2.4, 5.1, 5.5, 6.5, 7.3, 8.5, 8.6; NFR-7 in 1.2 and every screen story; NFR-8 in 1.1, 7.4.

**Anonymity guarantees (FR-11 to FR-13, SM-3):** schema and data inspection after close (3.2) and after confirm (5.5 AC4); Host-session tests during Collection at integration and e2e level (3.3 AC1, AC2); server-output capture (3.3 AC3, 6.5 AC3); manual SM-3 audit (7.3 AC4).

**UX Design Requirements:** every UX-DR maps to a story (see the AC headers); UX-DR23 (states), UX-DR24 (accessibility floor) and UX-DR25 (voice and term map) are bound to every screen story through Story Conventions rather than one story.

## Decisions Made During Breakdown

The group delegated product decisions for this run, as it did for the PRD on 2026-10-13. No interactive user was present; each menu or confirmation point was resolved as below. No scope was added beyond the PRD, the architecture and the UX spines.

1. **Workflow menus.** Step 1 to 4 confirmations were taken as Continue; Advanced Elicitation and Party Mode were not run. No further input documents were added; the brief, `proposal.md` and the review files were left out because the PRD and architecture already reconcile them.
2. **Output location.** `epics/epics-Toppsvar-2026-11-21/epics.md`, following the instructor's dated-folder convention, instead of the skill's default flat `planning-artifacts/epics.md`.
3. **Status `final`.** Matches the vocabulary used for the brief, PRD, UX and architecture (`draft` → `final`).
4. **Epic order as briefed.** Foundation → Collection → close and anonymity → Grouping → Review → Play → Demo and hand-in → Stage 2. Close (Epic 3) comes before the Grouping runner (Epic 4), so Epic 3's increment ends with the Game in *grouping* behind a status panel; `answer` is created in 3.1 by the `grouping` module, as AD-1's module order requires.
5. **Database client in Story 1.1.** AD-2 expects the PGlite-under-Next risk to surface in the first story, so the skeleton includes it.
6. **No component-test library.** The Stack lists none, so component behaviour is proven by Playwright e2e and axe, and logic by unit tests on `src/lib`.
7. **Placement by first consumer.** Normalisation and shuffle in 3.1; ranking and default labels in 5.1; `question.reviewed` in 5.1 so 5.2 to 5.4 can clear it; `game_counter` in 4.3; `board_slot` in 5.5.
8. **No dead buttons.** "Steng innsamlingen" arrives in 3.1, "Gå til gjennomgangen" in 5.1, "Start spillet" in 6.1, so no story ships a control whose target does not exist yet.
9. **Replay before live Judge.** 4.1 builds replay and mock (unset `JUDGE_PROVIDER` means replay); 4.4 adds the openrouter provider and the key-based default from AD-13.
10. **Host-created Groups.** A Group made by "Ny gruppe" is not counted as Judge-proposed, so SM-5 stays correct. AD-12 names only `judge` and `fallback` origins; if a third value is needed, 5.3 amends the spine.
11. **TRACE.md from day one.** Created in 1.1 and filled by every story; its completeness test lands in 7.3, because it would fail earlier.
12. **NFR-5 by manual timing.** Measured on the sizing Game in the checklist, not asserted in CI, to avoid flaky timing tests.
13. **FR-12 "no setting weakens §4.4".** Proven by fixed-set tests on the `env.ts` keys and `game` columns (3.3 AC5).
14. **Cuttable work at the end.** The CI Postgres job (7.3 AC5), the pilot deployment (7.5), FR-32 live regeneration and SM-4 (7.2 AC3) follow the delivery-notes cut order, which mirrors the PRD §6.5 slip list (amended 2026-11-23); the pilot is its own story because NFR-2 and SM-6 need it.
15. **Stage 2.** One epic, acceptance criteria only, taken from the PRD consequences, FR-33 first. FR-29 "switch on" is read as off by default.
16. **Left out on purpose.** EXPERIENCE.md Open Question 3 (Host preview of the answer form) and 4 (extended display) are not in the PRD, so no story builds them. Open Question 1 (palette) is built as specified. *Amended 2026-11-24:* Open Question 4 is now built as Story 8.5, by the group's decision after the pilot test, and the PRD §4.7 is amended with it; Open Question 3 stays out. *Amended 2026-11-25:* Story 8.6 makes the two pages the only way to play.
17. **Demo and evaluation rulings need a live key once (resolved 2026-11-22).** AD-14 allows rulings only from `npm run judge:record`. The group has an OpenRouter key: a group member runs the recording for Stories 7.1 and 7.2 with the key in an untracked `.env`; the AI developer never handles the key.
18. 2026-11-21: synchronised with the impeccable critique (commit fc91eaf).
