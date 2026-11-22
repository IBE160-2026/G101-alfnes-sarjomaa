---
name: 'Toppsvar'
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: 'modular monolith, layered (routes -> server modules -> db) in one Next.js app'
scope: 'Toppsvar Stage 1, the whole system in one deployable Next.js app, with Stage 2 (FR-22, FR-28, FR-29, FR-33) kept possible'
status: final
created: '2026-11-21'
updated: '2026-11-22'
binds: [FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20, FR-21, FR-23, FR-24, FR-25, FR-26, FR-27, FR-30, FR-31, FR-32, NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7, NFR-8]
sources:
  - .docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md
  - .docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md
  - .docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/addendum.md
  - .docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/tilbakemelding-product-brief.md
  - .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md
  - .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md
  - proposal.md
  - wiki/kurs/sensorveiledning-del-1.md
companions:
  - delivery-notes.md
---

# Architecture Spine — Toppsvar

## Design Paradigm

**Modular monolith, layered.** One Next.js App Router app sits at the repo root. Each domain module under `src/server/` owns its tables and rules. Routes and UI only call the functions a module exports. UX behaviour and visuals come from `EXPERIENCE.md` and `DESIGN.md`. This spine fixes the contracts beneath them.

| Layer | Directory | Holds | May import |
| --- | --- | --- | --- |
| Routes and UI | `src/app/`, `src/components/` | pages (server components read data), client components, `actions.ts` Server Actions as thin adapters | module entry points (server code only), `src/lib` |
| Domain modules | `src/server/<module>/` | entry points, services, transactions; every file starts with `import 'server-only'` | `src/server/db`, `src/server/judge`, modules earlier in the order, `src/lib` |
| Data access | `src/server/db/` | Drizzle schema, client factory, migrator, `Tx` type | `src/lib` |
| Pure logic | `src/lib/` | normalisation, ranking, game-state table, zod schemas, errors, B-cubed, shuffle, token, limits; no I/O | nothing above |
| CLI | `src/cli/` | demo, Judge evaluation, ruling recording | module entry points, `src/lib` |

```mermaid
flowchart TD
  UI["src/app + src/components"] --> MOD
  CLI["src/cli"] --> MOD
  subgraph MOD["src/server modules (acyclic order)"]
    direction LR
    BASE["auth · games · questions"] --> GRP["grouping"] --> MID["collection · review"] --> PLAY["play"]
  end
  MOD --> DB["src/server/db"]
  MOD --> JUDGE["src/server/judge"]
  UI --> LIB["src/lib"]
  MOD --> LIB
  JUDGE --> LIB
  JUDGE --> SDK["fetch to OpenRouter (openrouter provider only)"]
  DB --> DRV["drizzle-orm/pglite | drizzle-orm/postgres-js (dynamic import)"]
```

## Invariants & Rules

### AD-1 — One app, layered modules, one owner per table, `tx` passed down [ADOPTED]

- **Binds:** all
- **Prevents:** a separate backend service; UI code that queries tables; two modules writing one table; nested transactions that deadlock PGlite.
- **Rule:** The app is one Next.js App Router + TypeScript + Tailwind CSS app. `src/app` and `src/components` never import `src/server/db` or a Judge provider. A module may call only the modules before it in the order shown in the diagram. Only the owning module writes a table, and other modules call the owner's exported writers.
  - **Entry points.** A function called by an action, a route or the CLI is an entry point. It opens the transaction and takes no `tx`.
  - **Exported writers.** A function exported for other modules takes `tx: Tx` as its first parameter. It runs only on that `tx` and never opens a transaction or touches the `db` singleton.
  - **Enforcement.** ESLint `no-restricted-imports` zones encode the layers and the module order.

| Module (`src/server/…`) | Owns | Writers exported to other modules | FRs |
| --- | --- | --- | --- |
| `auth` | `host`, `session` | `requireHost` (read) | FR-1 |
| `games` | `game`, `game_counter`; retention purge | `lockForMutation`, `transition`, `reserveInviteLinks`, `acquireGroupingLease`, `bumpCounters`, `find` (read, no owner check, for `/svar`) | FR-2, FR-3, FR-18 |
| `questions` | `question` | `setReviewed`, `count` (read), `ofGame` (read) | FR-4 |
| `grouping` | `answer`, `answer_group`, `grouping_result` | `insertAnswers`, `createGroup`, `moveAnswers`, `mergeGroups`, `setCustomLabel`, `setDiscarded`, `deleteIfEmpty`, `clearContributorData` | FR-13, FR-15 to FR-17, FR-20 |
| `collection` | `invite_link`, `submission`; close | — | FR-5 to FR-11 |
| `review` | `board_slot` | `getBoard` (read) | FR-19 to FR-21 |
| `play` | `team`, `play_state`, `reveal` | — | FR-23 to FR-27 |
| `judge` | no tables; reads `data/rulings/*.json` | `getJudge` | FR-15, FR-32 |

### AD-2 — Embedded Postgres locally, ordinary Postgres deployed, chosen by `DATABASE_URL` [ADOPTED]

- **Binds:** NFR-1, NFR-2, NFR-3, all modules
- **Prevents:** code that branches on environment; a Docker or hosted DB on the examiner path; two processes corrupting one PGlite directory; first-run failure on a fresh clone.
- **Rule:** `src/server/db/client.ts` is the only place that picks a driver. It parses `DATABASE_URL` with its own parser.
  - **Schemes.** `pglite://<relative-or-absolute-dir>` gives in-process PGlite on disk, and `pglite://:memory:` gives in-memory PGlite. `postgres://` or `postgresql://` gives postgres.js with `prepare: false`, so it works behind a pooler. Unset means `pglite://.data/local`.
  - **Driver loading.** Drivers are imported dynamically, so the deployed bundle never loads PGlite's WASM.
  - **Queries.** Every query is written once, against Drizzle's Postgres API.
  - **PGlite rules:**
    - `client.ts` creates the directory recursively before opening it.
    - One process opens a directory at a time.
    - The client is a singleton cached on `globalThis`.
    - `@electric-sql/pglite` is listed in `serverExternalPackages`.
    - Every DB-reading route calls `await connection()`, so `next build` never touches the DB.
  - **Fallback.** If in-process PGlite fails under Next in the first story, run `pglite-server --run` (pglite-socket) and use postgres.js everywhere. Only `client.ts` changes.

### AD-3 — Drizzle schema and committed SQL migrations

- **Binds:** all modules, CI, Demo mode, environments (AD-24)
- **Prevents:** schema drift between PGlite and Postgres; hand-edited or pushed schemas; migrations that clash between epic branches.
- **Rule:** The schema lives only in `src/server/db/schema.ts`. `npm run db:generate` (drizzle-kit) writes SQL to `drizzle/`, which is committed and never edited after merge.
  - **Applying migrations.** The Drizzle migrator for the active driver applies them through `npm run db:migrate`. `dev`, `demo` and the test setups migrate automatically, but only for `pglite://` URLs.
  - **Parallel branches.** Before merging, a branch deletes its unmerged migrations, rebases onto `main` and regenerates. CI runs `drizzle-kit check`.
  - **Postgres features.** Only core Postgres is allowed (`gen_random_uuid()`, `jsonb`, a unique index on `lower(email)`), with no extensions.

### AD-4 — Game state machine with one lock-and-check path

- **Binds:** FR-2 to FR-27, §4.1
- **Prevents:** two features moving a Game through different paths; operations that run in the wrong state; races between close, revoke, submit and Grouping.
- **Rule:** `game.state` ∈ `draft | collecting | grouping | in_review | ready | playing | played`.
  - **Locking.** Every state-dependent mutation, Participant submits included, starts with `games.lockForMutation(tx, { hostId?, gameId, states })`. It does `SELECT … FOR UPDATE`, applies AD-5 when `hostId` is given, throws `WRONG_STATE` or `NOT_FOUND`, and touches `game.updated_at` only for Host calls. No other code locks `game`.
  - **Transitions.** State changes go only through `games.transition(tx, gameId, from, to)`, a compare-and-set. Only the transitions in the diagram exist. Stage 2 adds `games.createFromQuestionSet`, which inserts a Game directly in `ready` (FR-33).
  - **Permitted operations.** The table below lives in `src/lib/game-state.ts`, and an integration test walks the whole matrix.
  - **Deletion** locks the row and is allowed in any state.

```mermaid
stateDiagram-v2
  [*] --> draft: games.create (FR-2)
  draft --> collecting: collection.createInviteLinks, first batch, at least 1 Question (FR-5)
  collecting --> grouping: collection.close, at least 3 Answer sets (FR-10)
  grouping --> in_review: grouping.finishIfComplete (FR-15, FR-17)
  in_review --> ready: review.confirmBoard, every Question reviewed (FR-21)
  ready --> playing: play.start, 2 to 4 Teams (FR-23)
  playing --> played: play.finish after the last Question (FR-27)
  played --> [*]
```

| State | Permitted operations |
| --- | --- |
| `draft` | add, edit, reorder and remove Questions; create Invite links (refused with zero Questions) |
| `collecting` | create Invite links; revoke and replace one; open a link; submit or replace an Answer set; close |
| `grouping` | Grouping writes only |
| `in_review` | merge, move to an existing or new Group, rename, discard, undo discard, mark and unmark reviewed, confirm |
| `ready` | start play |
| `playing` | scored or unscored reveal, undo, next Team, next Question, finish |
| `played` | none |

### AD-5 — Authorisation: the owned Game first, then every child ID inside it

- **Binds:** FR-1, FR-2, FR-12
- **Prevents:** answering "not yours" and "does not exist" differently; one Host's request writing or reading another Host's Questions, Answers, Groups, slots or Teams.
- **Rule:**
  - **Session.** Host entry points take `hostId` from `auth.requireHost()`, which each Host page and action calls. No proxy makes an auth decision.
  - **The Game.** The Game is resolved through `lockForMutation` for mutations, or `games.getOwned` for reads. Both throw `NOT_FOUND` whether the Game is missing or belongs to someone else.
  - **Child IDs.** Every other input ID (`questionId`, `groupId`, `answerId`, `boardSlotId`, `teamId`) and every pasted link is resolved by a query constrained to the owned `gameId`. The IDs in one Review operation must also share one `question_id`. Any miss is `NOT_FOUND`, and the whole operation is refused.
  - **Rendering.** Pages turn `NOT_FOUND` into the bokmål 404. Under `/svar` the segment has its own `not-found.tsx`, which renders the Participant's "unknown link" page instead, with no Host chrome. A Game page behind `loading.tsx` streams, so its `NOT_FOUND` renders the bokmål not-found UI with status 200 and `noindex`, identical for missing and foreign Games; logged-out redirects happen in the spill layout before streaming.

### AD-6 — In-app auth: scrypt, hashed DB sessions, bounded cost [ADOPTED]

- **Binds:** FR-1, NFR-8
- **Prevents:** native-module installs; a third-party auth provider; session tokens that can be read from the DB; memory exhaustion or online guessing through login.
- **Rule:**
  - **Passwords** are 10 to 256 characters. They are hashed with `node:crypto` scrypt, `N=2^17, r=8, p=1`, with a 16-byte salt and `maxmem` raised to fit, and the parameters are stored in the hash string.
  - **Hashing limits.** At most 2 scrypt runs at a time per process. An unknown email is checked against a fixed dummy hash.
  - **Lockout.** `host.failed_logins` and `locked_until` double the lockout after 5 failures. Every failure gives one generic message.
  - **Sessions.** A session is a 32-byte random token in an `httpOnly`, `SameSite=Lax` cookie. The cookie is `Secure` when `APP_BASE_URL` is https, and its `Max-Age` is 14 days. The DB stores only `sha256(token)`. `session.expires_at` is authoritative, and `auth.getSession` extends it at most once an hour.
  - **Registration** requires `REGISTRATION_CODE` when that variable is set.
  - **`/svar`.** No auth code runs under `/svar`.

### AD-7 — Invite links: Token in the fragment, generic shell, Token-gated reads

- **Binds:** FR-5, FR-6, FR-7, FR-9, FR-10, FR-11, FR-14
- **Prevents:** Tokens in server, host or proxy logs or in `Referer`; Questions leaking to link previews; resolving a Token against the wrong Game; Host identity on the answer page.
- **Rule:** The link is `<APP_BASE_URL>/svar/<gameId>#<token>`.
  - **Token.** 32 bytes from `crypto.randomBytes`, base64url-encoded (`src/lib/token.ts`). Only `sha256(token)` is stored, in `invite_link.token_hash`, which is the primary key and unique across Games.
  - **Shell.** The server render of `/svar/[gameId]` is generic: `<title>Toppsvar</title>`, `noindex`, no Open Graph tags, no Game title and no Questions. It shows only the status: `unknown` (no such Game), `closed` (state is not `collecting`) or `open`. It sends `Referrer-Policy: no-referrer`, reads no session cookie and renders no Host chrome.
  - **Reads and writes.** The client reads the fragment. Questions and any saved Answer set come only from the Server Action `openInviteLink(gameId, token, editSecret?)`. Submits go through `submitAnswerSet`. No token ever appears in a GET URL or a query string.
  - **Lookup order.** The Game in the URL first: no Game means `LINK_UNKNOWN`, a state other than `collecting` means `COLLECTION_CLOSED` (close deletes every link, so closed must win over unknown). Then find `invite_link` by `(token_hash, game_id)` with no lock; no row means `LINK_UNKNOWN`. `openInviteLink` is a read and stops there. `submitAnswerSet` then does `lockForMutation` on the Game and re-checks the row and `collecting` under the lock, otherwise `COLLECTION_CLOSED`.
  - **Logging.** No code logs a token, hash, edit secret, Answer or `/svar` action argument (AD-17).

### AD-8 — Before close: one opaque Answer set per link, readable only on the submitting device

- **Binds:** FR-5 to FR-9, FR-12
- **Prevents:** half-finished Answer sets on the server; the Host reading Answers or per-link state before close, through Host pages or by opening a link they hold; more than one Answer set per link.
- **Rule:**
  - **Storage.** `submission` has its primary key = foreign key `invite_link.token_hash`, with ON DELETE CASCADE. It stores `answers jsonb` and `edit_secret_hash`. The shape is `{ [questionId]: string[] }`: every Question present, 1 to 5 trimmed non-empty strings of at most 80 characters each, in field order, so `rank = index + 1`. The schema is in `src/lib/answer-set.ts` and is checked again inside `collection.submit` against the stored Question IDs.
  - **Edit secret.** On the first submit, the browser generates a 32-byte edit secret and keeps it in `localStorage` under the single key `toppsvar:<gameId>:<first 16 chars of token>`, which also holds the unsent draft (EXPERIENCE). No hashing happens in the browser, because `crypto.subtle` is undefined on plain `http://<LAN-IP>`. The whole key is cleared when the server answers `closed` or `unknown`. `openInviteLink` returns the saved set only when `sha256(editSecret)` matches. Without it, the form is empty, exactly like an unused link, and a submit replaces the set and its secret. This narrows FR-7 to the submitting device (see Deferred).
  - **Revoke** is refused with `LINK_CAP_REACHED` before anything changes if `game.invite_links_issued` is already 50. Otherwise it deletes the link by `(token_hash, game_id)`, which cascades to its submission, and returns one new link. A pasted link that matches no active link of the Game returns the inline `LINK_UNKNOWN`, not `NOT_FOUND`. The response is the same whether or not a set existed. Every link creation goes through `games.reserveInviteLinks`.
  - **Host reads.** `collection.progress(gameId)` returns the active-link count, `issued` (`game.invite_links_issued`, for "N av maks 50 lenker brukt") and the submission count, with the submission count shown as "fewer than 3" below three. No Host-visible value, timestamps included, changes when a Participant submits.

### AD-9 — Closing Collection is the single anonymisation step

- **Binds:** FR-10, FR-13, SM-3
- **Prevents:** Answers that keep a link to a Token, an Answer set or arrival order after close; a close that leaves Token hashes behind or is only partly done.
- **Rule:** `collection.close` runs one transaction:
  1. `lockForMutation(collecting)` and require at least 3 submissions.
  2. For each submission and each Question, draw a new `crypto.randomUUID()` Contributor key and build that Question's Answer rows.
  3. Shuffle every Answer row of the whole Game with a crypto Fisher-Yates shuffle (`src/lib/shuffle.ts`), then call `grouping.insertAnswers(tx, rows)` once.
  4. Delete the Game's `submission` and `invite_link` rows.
  5. `transition(collecting → grouping)`. This also sets `grouping_lease_until = now() + 180 s`.

  After commit, a best-effort `VACUUM FULL submission, invite_link` runs outside any transaction, with `lock_timeout = '2s'`. Its errors are swallowed and logged by SQLSTATE only, and it never fails the close. The same best-effort VACUUM runs after deleting a Game that was `collecting`. Then the action starts Grouping with `after()` (AD-12). Nothing else inserts into `answer`.

### AD-10 — Answers carry no order and no identity, and Host views never see the linking columns

- **Binds:** FR-11, FR-12, FR-13, SM-3
- **Prevents:** IDs, timestamps or physical order that show arrival; Answers joined across Questions; Review showing which Answers share a contributor or rank.
- **Rule:** `answer` has exactly these columns:
  - `id` (uuid v4, `gen_random_uuid()`)
  - `question_id`
  - `contributor_key` (uuid v4, random for each Question and Answer set, nullable)
  - `rank` (1 to 5, nullable)
  - `text`
  - `normalized_text`
  - `group_id` (nullable until Grouping)

  Banned on `answer` and `answer_group`: `serial`/`identity`, `uuidv7`, ULIDs, `created_at`/`updated_at` and any column that grows with each insert. No table stores a Participant's name, email, IP, user agent or device ID.

  Host-facing queries and DTOs never select `contributor_key` or `rank`. Review gets each Group's `count` and `rank1_count` as SQL aggregates, and Answers sorted by `normalized_text`, then `text`. When `review.confirmBoard` commits, `grouping.clearContributorData` sets `contributor_key` and `rank` to NULL for the Game.

  `tests/integration/anonymity.test.ts` checks the schema and data after close and after confirm. It also checks that no key appears under two Questions, and that no Token, hash or submission remains.

### AD-11 — Count, Score and ranking: SQL aggregates, one ranking module

- **Binds:** FR-15, FR-16, FR-20, FR-21, FR-25, FR-26
- **Prevents:** stored totals drifting from the data; Review and confirm ranking Groups differently; labels outside 1 to 40 characters.
- **Rule:**
  - **Count** is computed only in SQL, as `count(distinct contributor_key)` per Group. **Score** is the SQL sum of `board_slot.count` over a Team's scored reveals. Neither is stored, except that `board_slot.count` freezes at confirm (AD-15).
  - **Ranking module.** Order and the Board cut are decided only by `rankGroups()` and `boardCut()` in `src/lib/ranking.ts`, over rows of `{ groupId, count, rank1Count, labelCandidates }`. The ranking is Count, then rank-1 Answers, then the label under `Intl.Collator('nb', { sensitivity: 'base' })`, then `groupId`. Review display, the "not on the Board" split and `confirmBoard` all call these.
  - **Default label.** The `normalized_text` given by the most distinct Contributor keys, ties broken by the shortest. It is cut to 40 characters at a word boundary.
  - **Effective label.** `custom_label ?? defaultLabel`.
  - **Merge** keeps the ID of the highest-ranked source Group and freezes its effective label as `custom_label`.

### AD-12 — Grouping: one partition call per Question, run once, resumable without duplicates

- **Binds:** FR-15, FR-16, FR-17, FR-18, §6.2
- **Prevents:** re-running Grouping or running it twice at once; one slow Question blocking the rest; all-pairs cost; a Game stuck in `grouping`; a missing key treated as an error.
- **Rule:**
  - **Normalisation.** `src/lib/normalize.ts`, `NORMALIZE_VERSION`: Unicode NFC, locale-independent `toLowerCase()`, trim, collapse inner whitespace, strip trailing `.,!?;:…`. If nothing is left, use the trimmed lower-cased text.
  - **Items.** A Question's items are its distinct normalised texts, sorted by code-unit order.
  - **Judge call.** There is one `judge.partition` call per Question, under a 30 s `AbortSignal`. At most 5 Questions run at once. The Judge is never called inside a transaction.
  - **Fallback.** A `JudgeError` (or any other throw, which counts as `ERROR`) gives the Question one Group per item, with `fell_back = true` and `fallback_reason` ∈ `NO_KEY | NO_STORED_RULING | TIMEOUT | ERROR | REFUSAL | INVALID_OUTPUT`. Review presents `NO_KEY` and `NO_STORED_RULING` as the normal group-by-hand state. It lists the other reasons as Judge failures (FR-17).
  - **Writing results.** In one transaction per Question: `lockForMutation(grouping)`; insert the Groups (`origin` is `judge`, or `fallback` for fallback Groups and Groups made only of uncovered replay items); set `answer.group_id`; insert `grouping_result` (unique per `question_id`); call `bumpCounters`. A Question that already has a result is skipped.
  - **Running and resuming.**
    - The close action calls `after(() => grouping.run(gameId))`, which runs once. Module functions never call `after()`.
    - A Host page load in `grouping` calls `grouping.resumeIfStale(gameId)`. That function takes the lease with `acquireGroupingLease` (compare-and-set on `grouping_lease_until < now()`) and runs only if it won the lease. The runner extends the lease after each Question.
    - Both paths end in `finishIfComplete`, which locks, counts results and moves the Game to `in_review`.
    - If the Game has been deleted, the run stops quietly.
  - **Progress.** `grouping.progress(gameId)` returns Questions done out of the total, for the UX Grouping panel.
  - **Cost.** For the sizing Game: 15 calls, about USD 0.006, at most 90 s. For the largest Game: 20 calls, about USD 0.01, at most 120 s. The arithmetic is in `delivery-notes.md`. No pair is judged twice.

### AD-13 — One Judge boundary, three providers

- **Binds:** FR-15, FR-17, FR-28 (Stage 2), FR-30, FR-32, §6.4, NFR-3
- **Prevents:** callers tied to one vendor; network calls in tests or Demo mode; a second Judge for Guess matching; retry counts that make SM-C2 wrong.
- **Rule:** `src/server/judge/index.ts` exports `getJudge()`, `JudgeError` (with a `reason: FallbackReason`) and this interface:

```ts
interface Judge {
  readonly info: { provider: 'openrouter' | 'replay' | 'mock'; model: string; promptVersion: string };
  partition(
    input: { question: string; items: string[] },
    signal: AbortSignal,
  ): Promise<{ assignments: number[]; calls: number; uncovered: number; source: 'live' | 'stored' }>;
}
```

Stage 2 adds `match({ question, guess, labels }, signal)` to the same interface. No stub or comment for it ships in Stage 1.

- **Selection.** `JUDGE_PROVIDER` picks the provider. Unset means `openrouter` when `OPENROUTER_API_KEY` is set, otherwise `replay`.
- **Valid output.** `assignments.length === items.length`, every value an integer cluster number. Providers validate and canonicalise the output (numbering in first-occurrence order `0..k-1`). Invalid output throws `INVALID_OUTPUT`.
- **replay** finds rulings in `data/rulings/*.json` by `normalize(question)`. It applies the stored clusters to the items those rulings cover, and numbers each uncovered item as its own cluster after them. If nothing is covered, that is a miss. A miss throws `NO_KEY` when no key is configured, otherwise `NO_STORED_RULING`.
- **openrouter** uses a stored ruling only when its item set matches exactly (`source: 'stored'`). Otherwise it POSTs with the built-in `fetch` (no SDK) to `https://openrouter.ai/api/v1/chat/completions` with these settings:
  - model `JUDGE_MODEL` (default `deepseek/deepseek-v4.1-flash`, a pinned ID, never a `~…-latest` alias, so Stored rulings name the model that made them)
  - `response_format: { type: "json_schema", json_schema: { strict: true, schema } }` for `{ assignments: number[] }`, `temperature: 0` and a bounded `max_tokens`
  - `provider: { require_parameters: true, data_collection: "deny" }`, so the request is routed only to providers that honour the schema and do not store or train on the Answers
  - one retry on invalid output, 429 or 5xx, inside the signal
  - an aborted signal throws `TIMEOUT`, and `finish_reason: "content_filter"` throws `REFUSAL`

  Only the Question text and the items are sent.
- **mock** is deterministic. It uses a map the test supplies, or one cluster per item. It is used only by Vitest.
- **Prompt.** The prompt and `PROMPT_VERSION` live only in `src/server/judge/prompt.ts`, with no real-person text. Any change to the prompt bumps the version.
- **Quality bar.** SM-2 is B-cubed F1 of at least 0.70 on `judge:eval`. If it falls short, change `JUDGE_MODEL` (any OpenRouter model with `structured_outputs`) and re-record.
- **Imports.** Nothing outside `src/server/judge` imports a provider or calls the model endpoint.

### AD-14 — Stored ruling format

- **Binds:** FR-15, FR-31, FR-32
- **Prevents:** rulings that can't be replayed or compared; rulings that reveal arrival order; Demo and evaluation fixtures in different formats.
- **Rule:**
  - **Shape.** A ruling is `{ kind: "partition", promptVersion, normalizeVersion, model, question, items, assignments }`, where `items` are sorted distinct normalised texts.
  - **Fixtures.** Fixture files are JSON arrays: `data/rulings/demo.json` and `data/rulings/protoqa-dev.json`. They are written only by `npm run judge:record`, which needs a live key.
  - **In the DB.** A Game's stored ruling is its materialised Groups plus `grouping_result(question_id, source: judge | replay | fallback, prompt_version, normalize_version, model_id, judge_calls, uncovered_items, fell_back, fallback_reason)`.

### AD-15 — Review closes with a Board snapshot, and play reads only the snapshot

- **Binds:** FR-19 to FR-21, FR-23 to FR-27, FR-33 (Stage 2)
- **Prevents:** play reading Review data that is still changing; a Question reaching play with no Groups; a separate play path for Question-set Games.
- **Rule:**
  - **Review writes.** Review edits Groups only through `grouping`'s writers (AD-1). Every edit increments the affected Groups' `edit_count`, bumps counters and calls `questions.setReviewed(tx, id, false)`. That is the only `question` write allowed outside `draft`.
  - **Marking reviewed** is refused with `NO_GROUPS_ON_BOARD` while a Question has no non-discarded Group.
  - **`review.confirmBoard`** requires every Question to be reviewed. It writes `board_slot(id, question_id, position 1..8, label, count, group_id nullable)` from `boardCut(rankGroups(...))`, calls `grouping.clearContributorData`, and moves the Game to `ready`.
  - **Play** reads only `board_slot`, through `review.getBoard`.

### AD-16 — Play state is saved as a reveal log

- **Binds:** FR-3, FR-23 to FR-27, NFR-5
- **Prevents:** play state held only in the browser; Scores out of step with reveals; reveals credited to the wrong Team or Question; ambiguous "next Question".
- **Rule:**
  - **Question order.** `question.position` is dense `1..n` and unique per Game. It is renumbered in the same transaction on every remove or reorder, and frozen after `draft`.
  - **Tables.**
    - `team(id, game_id, name 1..14, position)`
    - `play_state(game_id, current_question_id, current_team_id)`
    - `reveal(id, game_id, board_slot_id unique, team_id nullable, seq)`, where a null `team_id` means an unscored reveal
  - **Reveal** takes only `{ boardSlotId, scored }`. The Team comes from `play_state` under the Game lock. A slot that is not on the current Question is refused with `WRONG_QUESTION`, and a slot that is already revealed with `ALREADY_REVEALED`.
  - **Undo** deletes the highest-`seq` reveal on the current Question.
  - **Next Question** is the one with the smallest greater position. When there is none, `finish` moves the Game to `played`, sets `played_at` and returns `deleteAfter = played_at + 30 days`.
  - **Reload.** The play view renders from this saved state on the server.

### AD-17 — Mutations, reads and the error boundary

- **Binds:** all FRs that mutate, FR-11
- **Prevents:** a mix of REST endpoints and actions; unvalidated input; error shapes that differ between features; driver errors carrying Tokens or Answers into logs or the dev overlay.
- **Rule:**
  - **Reads.** Pages read data in server components. After a mutation, the action calls `revalidatePath`. There is no client data library.
  - **Mutations and token reads** are Server Actions in `src/app/**/actions.ts`, with their zod shape schemas in a sibling `schema.ts`. A module entry point enforces every invariant again, using the shared schemas from `src/lib`, so the CLI and tests get the same checks.
  - **Result shape.** Actions return `{ ok: true, data } | { ok: false, code, message, fieldErrors? }`. The only exception is `redirect()` flows (login, create Game, delete Game).
  - **Error codes.** `ErrorCode` is a closed union, with bokmål messages, in `src/lib/errors.ts`. A zod failure gives `INVALID_INPUT` with `fieldErrors`.
  - **Error boundary.** Entry points and `after()` tasks convert any error that is not a `DomainError` into `DomainError('INTERNAL')`, with no cause and no original message. `src/server/log.ts` receives only `{ module, op, code, sqlstate }`. Actions never throw to Next.
  - **Route Handlers** are limited to `GET /api/health` (no side effects), `GET /api/purge` (requires `CRON_SECRET`, AD-23) and `GET /api/spill/[gameId]/rapport` (the AD-18 export).
  - **Polling.** Host pages poll with `router.refresh()` every 3 s while the Game is `grouping`, and every 30 s while it is `collecting` (ProgressCount). There are no websockets.

### AD-18 — Usage counters are content-free and written through one function

- **Binds:** FR-18, SM-5, SM-C1
- **Prevents:** counters holding Answer text; modules bumping counters in different ways; SM-5 being impossible to compute.
- **Rule:**
  - **`game_counter`** (one row per Game): `judge_groups_proposed`, `groups_merged`, `answers_moved`, `groups_created`, `groups_renamed`, `groups_discarded`, `groups_restored`, `judge_calls`, `questions_fell_back`.
  - **Writers.** Only `games.bumpCounters(tx, gameId, delta)` changes these counters, called by `grouping` and `review`.
  - **Export.** `rapport` returns these counters, each Question's `source` and `fell_back`, and the `origin` and `edit_count` of every Group.
  - **SM-5** is the share of `origin = judge` Groups that reach the Board with `edit_count = 0`, plus the median `edit_count` of the changed ones.

### AD-19 — Demo mode: invented fixtures, replay, one cross-platform command

- **Binds:** FR-30, FR-31, NFR-1, UJ-5, §6.1
- **Prevents:** a demo that needs a key or network; real people's data in the repository; a demo that differs from the real flow; shell syntax that fails on Windows.
- **Rule:** `npm run demo` runs `src/cli/demo.ts` through `tsx`, with no shell syntax:
  1. Recreate `.data/demo`.
  2. Migrate.
  3. Seed through module functions: an invented demo Host, whose credentials are one constant in `src/lib` (printed and listed in the README, and read by the login page and the Demo band when `DEMO_MODE=1`), and one demo Game in `collecting` with invented Norwegian Questions and Answer sets.
  4. Start `next dev` on `PORT` with `DATABASE_URL=pglite://.data/demo`, `JUDGE_PROVIDER=replay`, `DEMO_MODE=1` and a matching `APP_BASE_URL`.

  The rulings for the demo Answers are in `data/rulings/demo.json`, so close takes the normal Grouping path. Answers added before close become their own Groups. No tracked file holds text derived from `.idea/`, including fixtures, few-shot examples, tests, rulings and `prompting/`.

### AD-20 — Judge evaluation command and ProtoQA data

- **Binds:** FR-32, SM-2, SM-4, SM-C2, §6.1, §6.3
- **Prevents:** evaluation that needs the network by default; scraped ProtoQA data or real Answers in the repository; a missing CC-BY-4.0 credit.
- **Rule:** `npm run judge:eval` runs `src/cli/judge-eval.ts`.
  - **Input.** It reads `data/protoqa/dev.crowdsourced.jsonl`: the crowdsourced dev questions with hand-made clusters, from `iesl/protoqa-data`, CC-BY-4.0. The file has 52 rows; the dataset README says 51.
  - **Default and live.** By default it replays `data/rulings/protoqa-dev.json` and warns when the ruling's versions differ from the current ones. `--live` regenerates the rulings and needs a key.
  - **Scoring.** Raw answers are normalised. Each item's weight is the sum of its respondents, and its gold cluster is the cluster holding most of that weight.
  - **Output.** B-cubed precision, recall and F1 (`src/lib/bcubed.ts`), Judge calls per Question, the prompt version and the model ID.
  - **Local data.** `--file <path>` scores a local labelled set (SM-4) and prints aggregates only. `judge:record --out` writes only under `.data/`, except for the `data/protoqa` and demo sources.
  - **Licensing.** `data/protoqa/ATTRIBUTION.md` gives the credit and license, states the changes made, and covers `protoqa-dev.json`. Scraped and train files are never committed.

### AD-21 — Configuration through environment variables only

- **Binds:** NFR-1, NFR-2, NFR-8
- **Prevents:** builds that differ in code between environments; committed secrets; README and code disagreeing about variables.
- **Rule:**
  - **Reading.** The app reads only the variables below, through `src/server/env.ts` (zod-validated).
  - **Template.** `.env.example` lists every variable with a safe default or an empty value. A test checks that its keys equal those in `env.ts`.
  - **Git.** `.env*` files (except `.env.example`), `.data/`, `.next/` and `node_modules/` are gitignored.
  - **CLI.** `src/cli` runs as `tsx --conditions=react-server --env-file-if-exists=.env.local`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `pglite://.data/local` | DB driver and location (AD-2) |
| `PORT` | `3000` | local dev and demo port |
| `APP_BASE_URL` | `http://localhost:${PORT}` | origin for Invite links; https enables `Secure` cookies |
| `OPENROUTER_API_KEY` | empty | turns on the live Judge; optional |
| `JUDGE_PROVIDER` | derived (AD-13) | `openrouter`, `replay` or `mock` |
| `JUDGE_MODEL` | `deepseek/deepseek-v4.1-flash` | OpenRouter model ID for the live provider |
| `DEMO_MODE` | empty | `1` shows the demo login hint and band, from the `src/lib` demo credentials constant (AD-19) |
| `REGISTRATION_CODE` | empty | if set, registration requires it (pilot) |
| `CRON_SECRET` | empty | if set, enables `/api/purge` (pilot) |

### AD-22 — Test layout, guards and CI [ADOPTED]

- **Binds:** NFR-3, SM-1, SM-3, FR-11, FR-12, FR-13, FR-30, §9.1
- **Prevents:** tests that pass only online or on the live Judge path; shared test DBs; CI checking something other than what the README runs; FR consequences without a test.
- **Rule:**
  - **`tests/unit/`** tests `src/lib`: Score over reveals, ranking and labels over aggregates, normalisation, Token generation, shuffle, B-cubed and the game-state table.
  - **`tests/integration/`** runs module entry points against a fresh `pglite://:memory:` DB per file, with the real migrations. Required files:
    - `anonymity.test.ts`
    - `host-view.test.ts`
    - `collection.test.ts`: reopen and extend on the same device, an empty form without the secret, one set per link, revoke, foreign tokens, refusal after close, submit racing close, and server output free of Tokens and Answers on a forced DB error
    - `review.test.ts`: recount on merge and move
    - `authz.test.ts`: a foreign child ID for every Host action
    - `game-state.test.ts`
    - `demo-replay.test.ts`: `source = replay`, `uncovered_items = 0`, no fallback
    - `judge-eval.test.ts`: replayed F1 at least 0.70
    - `env.test.ts`
  - **`tests/e2e/`** runs Playwright against `next build && next start`, with a fresh temporary PGlite directory and `JUDGE_PROVIDER=replay`. Each spec registers its own Host, and only `demo.spec.ts` uses the demo Game. Required specs:
    - `no-key.spec.ts` (FR-30)
    - `host-anonymity.spec.ts`: every Host page and response during Collection, before and after a Participant submits; reopening a used link from a fresh browser context shows an empty form
    - `participant.spec.ts`
    - an `@axe-core/playwright` pass over the answer form, Review and play
    - capture of the server's output, which fails on any Token or Answer text
  - **`tests/manual/`** holds `checklist.md` (FR-24 legibility, the rest of NFR-6, NFR-5 timing) and `anonymity-audit.md`, the SM-3 procedure for a dump after confirm.
  - **`tests/TRACE.md`** maps every Stage 1 FR consequence to a test or a manual item. Test titles carry FR IDs, and a unit test checks that every Stage 1 FR appears.
  - **Guards.** Vitest sets `JUDGE_PROVIDER=mock`, clears `OPENROUTER_API_KEY` and rejects requests to any host but localhost. Playwright sets `replay` and blocks requests to any host but localhost in the browser. The Next server is guarded by having no key.
  - **CI.** `.github/workflows/ci.yml` runs on `pull_request` and on push to `main`, on Node 22 and 26, with no key and `NEXT_TELEMETRY_DISABLED=1`. It runs only README scripts:
    - `npm ci`
    - lint, format check, typecheck
    - `drizzle-kit check`
    - `npm test`
    - Playwright install, then `npm run test:e2e`
    - a demo smoke test: start `npm run demo` in the background, poll `/api/health`, then stop it
  - **CI Postgres job.** A second job runs `tests/integration` against a Postgres service container.
  - **`server-only`** is aliased to an empty module in Vitest.

### AD-23 — Retention purge

- **Binds:** FR-3, §6.1
- **Prevents:** orphan rows after deletion; retention that depends only on someone visiting the app.
- **Rule:**
  - **Cascade.** Every child table references `game` with `ON DELETE CASCADE`.
  - **What is purged.** `games.purgeExpired()` deletes Games 30 days after `played_at`, and Games never played 90 days after `updated_at`. `updated_at` reflects Host activity (AD-4).
  - **When it runs.** At most once an hour per process (the marker is in memory on `globalThis`, and the delete is idempotent). It is triggered from Host requests and from `GET /api/purge`. On the pilot, a daily Vercel Cron calls `/api/purge` with `CRON_SECRET`.
  - **Failure.** A purge failure is caught and never fails the request that triggered it.
  - **Timestamps.** Game-level timestamps (`created_at`, `updated_at`, `played_at`, `grouping_lease_until`) are allowed. Answer-level timestamps are not (AD-10).

### AD-24 — Environments and deployment

- **Binds:** NFR-1, NFR-2, NFR-5, FR-15
- **Prevents:** a preview or dev run migrating shared data; code that works only on serverless or only on a long-running server; the examiner path depending on a host.
- **Rule:** The app runs on the Node.js runtime only (no Edge). `next.config.ts` sets:
  - `serverExternalPackages: ['@electric-sql/pglite']`
  - `outputFileTracingIncludes` for `data/rulings/**`
  - `agentRules: false`

  The close action and the Game page export `maxDuration = 300`.

| Environment | `DATABASE_URL` | Migrations | Live Judge |
| --- | --- | --- | --- |
| Local dev (`npm run dev`) | `pglite://.data/local` | automatic (PGlite only) | if a key is in `.env.local` |
| Demo (`npm run demo`) | `pglite://.data/demo`, recreated | automatic | never (`replay`) |
| Test and CI | `pglite://:memory:`, temp directory, Postgres service | automatic in setup | never |
| Pilot | Neon free tier, EU region, pooled URL | explicit `npm run db:migrate` deploy step | yes, the key has a console spend limit |

The pilot is Vercel Hobby (300 s per function with fluid compute), production from `main` only, with previews disabled. `REGISTRATION_CODE` and `CRON_SECRET` are set there. There are no backups beyond Neon's short history, and the pilot database is deleted when the course ends. Any Node host running `next start` with a Postgres URL is equivalent. The README's local path never mentions a host.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Language | Code, file names, DB names and comments in English. User-facing text and URL segments in bokmål ASCII. `<html lang="nb">`, with bokmål `not-found.tsx`, `error.tsx` and `global-error.tsx`. No i18n library (NFR-7). |
| Routes | As in `EXPERIENCE.md`: `/`, `/registrer`, `/logg-inn`, `/spill`, `/spill/[id]`, `/spill/[id]/gjennomgang`, `/spill/[id]/skjerm`, plus `/svar/[gameId]` (AD-7) and the AD-17 API routes. |
| Domain names | PRD glossary terms used as written: `game`, `question`, `inviteLink`, `answerSet`, `answer`, `contributorKey`, `group` (table `answer_group`), `boardSlot`, `team`, `reveal`, `score`, `count`. |
| DB naming | `snake_case`, singular. Primary key `id uuid default gen_random_uuid()`. Exceptions: `invite_link`, `session` and `submission` (keyed by `token_hash`); `game_counter` and `play_state` (keyed by `game_id`). Foreign keys are `<entity>_id`, `ON DELETE CASCADE` toward `game`. |
| Files | Components are `PascalCase.tsx`, everything else `kebab-case.ts`. Each module is one folder, with `index.ts` as its public surface. |
| Limits | Only in `src/lib/limits.ts`, with the values from PRD §11 plus: minimum 3 Answer sets, retention 30/90 days, Judge 30 s and concurrency 5, grouping lease 180 s, poll 3 s, collecting refresh 30 s, Team name 14, password at most 256. |
| Time and IDs | UTC `timestamptz`, only on `host`, `session` and `game`. IDs are random UUID v4, never time-ordered. |
| Logging | Only through `src/server/log.ts` (ESLint `no-console` elsewhere). It accepts `{ module, op, code, sqlstate }`, never request objects, arguments or `error.message`. |
| Transactions | A multi-row change is one transaction, opened by the entry point. The Judge is never called inside one. |
| Assets | Fonts come from npm packages or `next/font/local`, never `next/font/google` or a CDN, so builds and tests work offline. Nothing names or imitates the TV show (PRD §6.3). |
| Scripts | `dev`, `demo`, `build`, `start`, `lint`, `format`, `format:check`, `typecheck`, `test`, `test:e2e`, `db:generate`, `db:migrate`, `judge:eval`, `judge:record`. README, CI and Playwright use these names only. |
| Style | ESLint flat config (`eslint-config-next`, `typescript-eslint`, `eslint-config-prettier`) and Prettier defaults, over `src`, `tests` and the root config files. Ignored: `_bmad .claude wiki .docs prompting scripts drizzle .idea .next .data .logs`. No commented-out code. |
| Delivery | The README states the anonymity limits that AD-7 to AD-10, AD-13 and AD-24 name. One PR per epic. A departure from this spine amends it in the same PR. Details are in `delivery-notes.md`. |

## Stack

Do not keep the Next starter's `@types/node ^20` (vitest 5 rejects it), its `next/font/google` layout or its `lang="en"`. ESLint stays on 9 until the `eslint-config-next` plugins support 10.

| Name | Version |
| --- | --- |
| Node.js (prerequisite; CI matrix) | ≥ 22.13, tested on 22 and 26 LTS |
| Next.js (App Router) | 16.4.6 |
| React / React DOM | 19.3.1 |
| TypeScript | 6.0.3 |
| `@types/node` / `@types/react` / `@types/react-dom` | 22.20.5 / 19.3.0 / 19.3.0 |
| Tailwind CSS + `@tailwindcss/postcss` | 4.3.5 |
| `@electric-sql/pglite` (local, test) | 0.5.17 |
| `postgres` (postgres.js, deployed) | 4.1.1 |
| `drizzle-orm` / `drizzle-kit` | 0.45.4 / 0.31.11 |
| `zod` | 4.6.7 |
| Judge model | `deepseek/deepseek-v4.1-flash` via OpenRouter (USD 0.05 / 0.20 per million input / output tokens, `structured_outputs` supported; checked 2026-11-22) |
| `vitest` | 5.1.1 |
| `@playwright/test` / `@axe-core/playwright` | 1.65.1 / 4.14.0 |
| `eslint` / `eslint-config-next` / `typescript-eslint` | 9.39.5 / 16.4.6 / 8.73.0 |
| `prettier` / `eslint-config-prettier` | 3.10.1 / 10.1.8 |
| `tsx` / `server-only` | 4.23.15 / 0.0.1 |
| `@fontsource-variable/bricolage-grotesque` (self-hosted display font) | 5.3.0 |
| Pilot hosting | Vercel Hobby (Node runtime) + Neon free tier (EU) |

## Structural Seed

```mermaid
erDiagram
  host ||--o{ session : has
  host ||--o{ game : owns
  game ||--o{ question : has
  game ||--o{ invite_link : "until close"
  invite_link ||--o| submission : "until close"
  game ||--|| game_counter : has
  question ||--o{ answer : "from close"
  question ||--o{ answer_group : has
  answer_group ||--o{ answer : contains
  question ||--o| grouping_result : has
  question ||--o{ board_slot : "from confirm"
  answer_group ||--o| board_slot : "snapshotted as"
  game ||--o{ team : has
  game ||--o| play_state : has
  game ||--o{ reveal : logs
  board_slot ||--o| reveal : "revealed by"
  team ||--o{ reveal : scores
```

```mermaid
flowchart LR
  subgraph Local["Examiner / developer machine"]
    N["next dev / next start (Node 22.13+)"] --> PG["PGlite in-process (.data/local, .data/demo)"]
    N --> FX["data/rulings/*.json (replay)"]
  end
  subgraph Pilot["Pilot (optional, main only)"]
    V["Vercel function, Node runtime"] --> HP["Neon Postgres, EU, pooled"]
    V --> FX2["data/rulings (traced into bundle)"]
    C["Vercel Cron daily"] --> V
    V -. "only if OPENROUTER_API_KEY" .-> A["OpenRouter chat completions, deepseek/deepseek-v4.1-flash"]
  end
  P["Participant phone"] -->|"/svar/gameId#token"| V
  H["Host laptop / TV"] --> V
```

```text
./                          # repo root = app root; docs and BMAD sit beside the code, excluded from lint
  src/
    app/                    # routes per EXPERIENCE.md, layouts, actions.ts + schema.ts per route
      svar/[gameId]/        # Participant shell + client form
      spill/ registrer/ logg-inn/
      api/                  # health, purge, spill/[gameId]/rapport
      fonts/                # self-hosted font files if not from npm
    components/
    server/
      env.ts  log.ts
      db/                   # schema.ts, client.ts, migrate.ts
      auth/ games/ questions/ grouping/ collection/ review/ play/
      judge/                # index.ts, prompt.ts, providers/{openrouter,replay,mock}.ts
    lib/                    # normalize, ranking, game-state, answer-set, errors, bcubed, shuffle, token, limits
    cli/                    # demo.ts, judge-eval.ts, judge-record.ts
  drizzle/                  # generated SQL migrations (committed)
  data/
    protoqa/                # dev.crowdsourced.jsonl, ATTRIBUTION.md
    rulings/                # demo.json, protoqa-dev.json
  tests/
    unit/ integration/ e2e/ manual/  TRACE.md
  docs-assets/              # README screenshots
  .github/workflows/ci.yml  .github/pull_request_template.md
  package.json  package-lock.json  tsconfig.json  next.config.ts  postcss.config.mjs
  drizzle.config.ts  vitest.config.ts  playwright.config.ts  eslint.config.mjs
  .prettierrc  .prettierignore  .env.example  .nvmrc  .gitignore (+ .data/)
  scripts/make-zip.sh       # beside the existing doc tooling
  README.md  CLAUDE.md  proposal.md  product-brief.md  PRD.md
  wiki/ .docs/ prompting/ _bmad/ .claude/ .logs/   # existing, unchanged
```

**Examiner path (NFR-1):** with Node ≥ 22.13 and git installed, run `git clone …`, then `npm install`, then `npm run demo`.

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
| --- | --- | --- |
| FR-1 Host account | `server/auth`, `app/registrer`, `app/logg-inn` | AD-5, AD-6 |
| FR-2, FR-3 Games, deletion, retention | `server/games` | AD-4, AD-5, AD-16, AD-23 |
| FR-4 Questions | `server/questions` | AD-4, AD-16 (positions) |
| FR-5 to FR-9 Invite links, answering, progress, revoke | `server/collection`, `app/svar` | AD-7, AD-8 |
| FR-10 Close | `server/collection` → `grouping.insertAnswers` | AD-9 |
| FR-11 to FR-13 Anonymity | `collection`, `grouping`, `review`, `log.ts`, tests | AD-7 to AD-10, AD-17, AD-22 |
| FR-14 Notice | `app/svar` | `EXPERIENCE.md`; README limits (delivery notes) |
| FR-15 to FR-17 Grouping, ranking, fallback | `server/grouping`, `server/judge`, `lib` | AD-11 to AD-14 |
| FR-18 Usage counters | `server/games`, `api/spill/[gameId]/rapport` | AD-18 |
| FR-19 to FR-21 Review, confirm | `server/review` via `grouping` writers | AD-10, AD-11, AD-15 |
| FR-23 to FR-27 Play | `server/play` | AD-15, AD-16 |
| FR-30, FR-31 No key, Demo mode | `judge` replay, `cli/demo.ts` | AD-13, AD-19 |
| FR-32 Judge evaluation | `cli/judge-eval.ts`, `data/protoqa` | AD-14, AD-20 |
| NFR-1 to NFR-3, NFR-8 | `db/client.ts`, `env.ts`, CI | AD-2, AD-3, AD-21, AD-22, AD-24 |
| NFR-4 to NFR-7 Devices, speed, accessibility, language | `app`, `components` | `DESIGN.md`, `EXPERIENCE.md`; Conventions; AD-22 axe pass |
| Stage 2: FR-22, FR-28, FR-29, FR-33 | `review`, `judge.match`, `play`, `games.createFromQuestionSet` | AD-4, AD-13, AD-15, AD-16 (doors kept open) |

## Deferred

- **Cross-device editing of an Answer set** (FR-7 narrowed by AD-8). Confirmed by the group 2026-11-21: the PRD's FR-7 is amended to the submitting device, so AD-8 binds without reservation.
- **Visual system, Review interaction, near-threshold display and unsent drafts.** These were decided in `DESIGN.md` and `EXPERIENCE.md`. Architecture constraints: no per-Group confidence signal in Stage 1, single-Answer Groups are ordinary Groups, and drafts stay in `localStorage`, under the one per-link key `toppsvar:<gameId>:<first 16 chars of token>` (no hashing in the browser), and are never sent before submit.
- **Judge prompt wording and the measured token and latency figures.** Tuned in the Judge story against `judge:eval`. The format, versions and the 0.70 bar are fixed in AD-13 and AD-14.
- **Account recovery and email verification.** Not required by the PRD. Registration reveals whether an email is already taken, and that is accepted.
- **Stage 2 data.** The Question-set import format and `game.kind` (FR-33), a manual Group order column on `answer_group` (FR-22), typed Guess storage and its deletion (FR-28), and strike and steal state (FR-29). These are decided when Stage 2 starts, inside AD-4, AD-13, AD-15 and AD-16.
- **Several Hosts per Game** (PRD §1.2). The schema uses `game.host_id`, and Stage 1 adds no other single-Host assumption.
- **Observability beyond `log.ts`.** Not needed for a course pilot.
