---
title: 'Reviewer Gate — anonymity, security and data-integrity lens'
target: ARCHITECTURE-SPINE.md (status draft, 2026-11-21)
spec: .docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md (§1.1, §4.3, §4.4, §6.1, SM-3)
created: '2026-11-21'
---

# Review — anonymity, security and data integrity

## Verdict

**Not ready to build as written.** The post-close storage design (AD-9, AD-10) is sound against a logical dump. But the cheapest attacker, the Host, can read every Answer set during Collection by opening the links they hold. That is AD-8's "known gap", parked under Deferred. Four high findings let the spine's rules, followed literally, still leak attribution, timing or another Host's data. All of them can be fixed in the AD text before the first story.

| Tier | Count |
| --- | ---: |
| Critical | 1 |
| High | 5 |
| Medium | 6 |
| Low | 10 |

Threat actors used below: **T1** Host, **T2** SM-3 reviewer (Host access + link list + logical dump after close), **T3** DB access during Collection (accepted risk), **T4** network observers and platform logs, **T5** malicious Participant, **T6** another Host (IDOR), **T7** CSRF or session theft against the Host.

---

## Critical

### C1 — The Host reads any Answer set before close by opening a link they hold

- **Actor:** T1 (no skill needed, just a browser).
- **Attack:** The Host saved the plaintext link list at creation (FR-5). They open Kari's link `…/svar/<gameId>#<token>`. `collection.loadOwnAnswerSet` returns Kari's full Answer set (FR-7 reopen). Attribution is complete, and it happens during Collection, when FR-12 says "the Host cannot read any Answer before Collection closes". Reopening also tells the Host whether each link was used (form prefilled or empty), which FR-8 forbids showing: "never which Invite links have been used".
- **AD that fails:** AD-8 "Known gap" and Deferred item 1. The spine admits the conflict but leaves it unresolved. FR-12 and FR-8 cannot both hold under AD-8 as written, and FR-14's notice ("nobody can see who wrote an Answer") becomes false.
- **Fix (AD-8, replace "Known gap"):**
  > **Reopen needs a device secret.** On a successful submit, the server draws a 32-byte edit secret, stores `sha256(secret)` in `submission.edit_secret_hash` and returns the secret once. The client keeps it in `localStorage` under `toppsvar:edit:<first 16 hex of sha256(token)>`. `collection.loadOwnAnswerSet(gameId, token, secret)` returns the Answer set only when the secret matches. Otherwise it returns exactly what a link with no Answer set returns: an empty form, the same status and the same message. A submit without a matching secret replaces the Answer set and issues a new secret, and its response is identical to a first submit. No response, status, message or code path tells a caller without the secret whether the link was answered. The secret is minted only on submit, never on page load, so link-preview bots that run JavaScript cannot claim it.
  - Residual risk, accept and document: the Host can still *destroy* an Answer set without reading it, by submitting through a held link or by revoking. That is the same power FR-9 already grants. Watching the progress count after such a submit reveals participation (PRD-accepted for revoke, FR-9).
  - PRD follow-up: FR-7 becomes "on the same device". A Participant on a new device sees an empty form, and submitting from it overwrites their earlier set. Remove the item from Deferred.
- **Test:** `collection.test.ts`: reopening without the secret returns a response byte-identical to an unused link, for both answered and unanswered links. `host-anonymity.spec.ts`: as the Host, open a used link in a fresh browser context and assert no Answer text appears.

---

## High

### H1 — Child-ID IDOR: AD-5 checks the Game but not the IDs nested under it

- **Actor:** T6.
- **Attack:** Host A calls the Review "move Answers" action with *their own* `gameId` (which passes `getOwned`) and `answerId`s taken from Host B's Game. The answer IDs could come from B's Review if A was ever a co-viewer, from a shared screen, or from a leaked RSC payload. A literal implementation runs `UPDATE answer SET group_id = $targetGroup WHERE id = ANY($answerIds)`. B's Answers move into A's Group, and A now reads them in A's Review. The same pattern works for merge and rename (`groupId`), reorder and edit (`questionId`), reveal (`boardSlotId`) and Teams (`teamId`). **Revoke** is the sharpest case. A Host who also took part in B's Game holds a B link. Pasting it into their own Game makes a literal `DELETE FROM invite_link WHERE token_hash = $h` (it is the primary key) delete B's link and cascade-delete that Participant's Answer set.
- **AD that fails:** AD-5 says only "loads the Game through `games.getOwned`". AD-8 "Revoke" does not scope the delete to the Game.
- **Fix (AD-5, add):**
  > Every input ID other than `gameId` (`questionId`, `groupId`, `answerId`, `boardSlotId`, `teamId`), and every pasted Token, is resolved by a query constrained to the owned Game, for example `… JOIN question q ON q.id = x.question_id WHERE q.game_id = $ownedGameId`, or `invite_link.game_id = $ownedGameId`. A missing or foreign child ID throws `NotFound`, the same as AD-5's Game case. Multi-ID operations (merge, move) also require every ID to belong to the same Question. Revoke deletes `WHERE token_hash = $h AND game_id = $ownedGameId`. `authz.test.ts` exercises every Host action with a child ID from another Host's Game and expects `NOT_FOUND` with no rows changed.

### H2 — Driver and framework error paths log Token hashes and Answer text despite AD-7's logging rule

- **Actor:** T4 (platform log readers, which includes the operators), and whoever sees the dev overlay.
- **Attack:** AD-7 and the Logging convention forbid *our code* from logging tokens or Answers. The leaks come from code we don't own:
  - Drizzle (0.44 and later) wraps driver errors in `DrizzleQueryError`, whose message contains the SQL **and the bound parameters**.
  - A failed submit upsert therefore puts `token_hash` plus the whole Answer-set `jsonb` into the error message. Failures include a lock timeout, an FK violation when racing revoke or close, or a connection drop.
  - A failed `grouping.insertAnswers` at close puts every Answer of the Game, with its Contributor key, into the message.
  - A failed Grouping write after the Host deleted the Game mid-run (FK failure inside `after()`) does the same with Group labels and Answer IDs.
  - An error thrown out of a Server Action reaches Next's own error logger: the server console, and Vercel runtime logs in production. Under `next dev`, it also reaches the browser error overlay. `npm run demo` runs `next dev` (AD-19).
  - Result: FR-11 ("logs written while handling an Invite link contain neither the Token nor Answer text") fails on the first DB error.
- **AD that fails:** AD-7 "Logging", the Logging convention, and AD-17 (modules throw, adapters return, but nothing stops a non-domain error escaping).
- **Fix (AD-17, add):**
  > Every module function in `collection`, `grouping` and `review`, and the body of every `after()` task, catches any error that is not a `DomainError` at the module boundary. It rethrows `DomainError('INTERNAL')` with no `cause` and no message from the original. `log.ts` receives only `{ module, op, sqlstate }`, never `error.message`, `error.query`, `error.params` or a stack that embeds them. Server Actions never throw to Next; they always return the AD-17 error shape. No dev option that forwards browser console output to the server terminal is turned on.
  - **Test:** a test forces a constraint error in submit and in close, captures server stdout and stderr, and fails on any Token, token hash or Answer text. Add it to `collection.test.ts` (module level) and to the e2e harness (stdout of `next start`).

### H3 — `game.updated_at` timestamps every submission and edit, undoing FR-8's "fewer than 3"

- **Actor:** T1.
- **Attack:** AD-8 says "each edit replaces the row and touches `game.updated_at`". The submit itself also changes the Game. Nothing in the spine forbids Host pages from showing it: a Game list with "last changed", or sorting by `updated_at`. The Host messages one person and refreshes the list. If "last changed" jumps, that person just submitted or edited. That is exactly the attack FR-8's "fewer than 3" exists to stop, and it works at every count, including below 3. It also leaks *edit* activity, which the count never shows. `host-anonymity.spec.ts` scans only for Answer text and per-link state, so it would not catch this.
- **AD that fails:** AD-8 "Storage"; AD-23 relies on the same column.
- **Fix (AD-8, replace the last sentence of "Storage"):**
  > Submits and edits do not touch `game.updated_at` or any other Host-visible column. During Collection the only Host-visible effect of a Participant action is `collection.progress`. Retention for an unplayed Game (AD-23) counts from the last Host action.
  - **Test (AD-22, `host-anonymity.spec.ts`):** add a *differential* check. Record every Host page and response, have a Participant submit and then edit, and record again. The two must be byte-identical except the submission count, and except it only once the count is 3 or more.

### H4 — The answer-count and rank fingerprint joins one person's Answers across Questions, so SM-3 fails as worded

- **Actor:** T2. T1 too, if Review exposes `rank`.
- **Attack:** A dump taken in `in_review`, `ready` or `played` keeps `contributor_key` and `rank`.
  - `GROUP BY question_id, contributor_key` gives each key's answer count (1 to 5) on each Question. `max(rank)` gives the same number even without the key.
  - Across 10 to 20 Questions, people answer in stable ways: someone gives 5, 5, 5, 4, 5, someone else gives 1, 1, 2, 1.
  - Where a count is unique on two Questions (say, the only 4-answer contributor on Q3 and on Q7), the reviewer links them. Linking chains: once one pair is joined, the remaining candidates shrink.
  - With 3 to 10 Answer sets, which is a normal small party, a large share of contributors can be joined across Questions. SM-3 requires the opposite: the reviewer "cannot … join one person's Answers across Questions".
  - The README's "per-Question answer-count pattern" note documents the leak but does not make SM-3 pass.
  - The Host gets the same fingerprint if any Review DTO carries `rank` per Answer: "only one rank-5 Answer on Q1 and on Q2" links them.
- **AD that fails:** AD-10 (keeps `rank` and `contributor_key` forever), AD-15 (confirm freezes counts but keeps the linking columns), SM-3.
- **Fix (AD-10 and AD-15, add):**
  > Host-facing DTOs never select `rank`. Review receives only each Group's count of rank-1 Answers, which is what ranking needs. When `review.confirmBoard` commits, it also runs `UPDATE answer SET contributor_key = NULL, rank = NULL WHERE question_id IN (<this Game>)`. Board counts are already frozen in `board_slot`, and Review is closed. Optionally, as data minimisation (§6.1), it deletes the Game's `answer` rows outright, since play reads only `board_slot`.
  - Optionally go further and store `is_top boolean` instead of `rank`. That removes the rank-only fingerprint but needs a PRD note against FR-6 ("saved with their rank").
  - **Accept and document** the remaining window from close to confirm. SM-3's audit (`tests/manual/anonymity-audit.md`) states that it covers dumps after confirm. For dumps between close and confirm it measures, on the demo Game, the share of contributors that can be uniquely joined by count vector, and the README reports that number.

### H5 — A Host who answers through links of their own defeats the minimum-of-three rule (accept + document)

- **Actor:** T1.
- **Attack:** The Host creates 3 links, keeps 2 and gives 1 to Kari. They submit both kept links themselves, so progress shows "fewer than 3" until Kari answers. When it flips to 3, Kari has submitted. The Host closes, and every Answer in Review that is not theirs is Kari's. More generally, every link a Host answers themselves removes one person from the anonymity set. PRD §1.1 hints at this ("the Host decides who gets which link"), but the spine and README contract never state the consequence. FR-14's notice overclaims against such a Host.
- **AD that fails:** none technically. The product has no Participant identity by design, so this cannot be fixed in code. The gap is in the README contract and the FR-14 wording.
- **Fix:** accept and document. Add to the Consistency Conventions "README contract":
  > The anonymity-limits section states that the minimum of three Answer sets protects against a curious Host, not one who answers through links they keep or hands out only a few links. Anonymity is as strong as the number of real Participants.
  - Raise with the PM whether FR-14's two sentences should say "nobody *using the product* can see who wrote an Answer" or similar.

---

## Medium

### M1 — `/svar/<gameId>` without the fragment may expose Questions to link-preview crawlers and anyone holding the bare URL

- **Actor:** T4. Messaging apps (Messenger, Slack, Teams, iMessage) fetch the URL to build a preview. The fragment is never sent, but the path is. Platform access logs and browser history sync also hold the bare path.
- **Attack:** AD-7 decides status from `gameId` alone. If the page server-renders the Game title or the Questions for an `open` Game before the Token is checked, the preview service gets them, and Questions name people by design. So does anyone the link is forwarded to, and anyone who reads a log line. Preview services cache and sometimes index these pages. Open Graph tags derived from the title make it worse.
- **AD that fails:** AD-7 "Status" and "Layout" (silent on what the token-less render contains).
- **Fix (AD-7, add to "Layout"):**
  > The server render of `/svar/[gameId]` is a generic shell: `<title>Toppsvar</title>`, `<meta name="robots" content="noindex, nofollow">`, no Open Graph or Twitter tags, no Game title, no Questions. The shell carries only the status (`unknown`, `closed`, `open`). The Questions, and any saved Answers, come only from a Server Action that has validated the Token.

### M2 — Participant actions must resolve the Game from the Token, and validate before locking

- **Actor:** T5.
- **Attack:** A submit carries the URL's `gameId` and a Token from the fragment. A literal AD-4 implementation locks `game WHERE id = $gameId`, checks `collecting`, then upserts `submission` keyed by the token hash. A Participant can pair their real Token (Game X) with the `gameId` of any other open Game Y they know.
  1. The lock is then taken on Y, not X, so the submit no longer serialises with X's close. A submit that commits between close's read of submissions and its delete is silently lost.
  2. Every unauthenticated request with a random Token takes `SELECT … FOR UPDATE` on a Game row before the Token is checked. Anyone who has the bare URL (M1, logs) can flood submits and stall the real Participants and the Host's close, which AD-4 serialises on the same lock.
- **AD that fails:** AD-4 ("first locks the Game row") and AD-7 (Token and Game consistency not stated).
- **Fix (AD-7, add "Order"):**
  > Participant actions first look up `invite_link` by `sha256(token)` with no lock. No row means `unknown`. They then lock the Game named by `invite_link.game_id`. If it differs from the URL's `gameId`, they return `unknown`. Under the lock they re-check that the link row still exists and that the state is `collecting`.

### M3 — scrypt at 128 MiB per hash with no rate limiting: unauthenticated DoS and online guessing

- **Actor:** T7 and anonymous attackers.
- **Attack:** `N=2^17, r=8` uses about 128 MiB and a few hundred ms of CPU per hash, on both login and register. Node runs scrypt on the libuv pool (4 threads by default), so a burst of parallel login POSTs pins about 512 MiB and queues everything else that uses that pool. On a free serverless instance, which has limited memory and one vCPU, this is an easy outage, and the close action shares that instance. With rate limiting deferred, passwords can also be guessed online without limit. Unknown emails skip scrypt, so response time reveals which emails have accounts. Registration also reveals existing emails.
- **AD that fails:** AD-6 (cost parameters with no concurrency bound); Deferred "Login rate limiting".
- **Fix (AD-6, add):**
  > At most 2 scrypt computations run at once per process (a semaphore in `auth`). Excess requests fail fast with the generic login message. Login for an unknown email verifies against a fixed dummy hash. `host` gets `failed_logins` and `locked_until`, with backoff doubling after 5 failures. Passwords over 256 characters are refused.
  - Move "login rate limiting" out of Deferred for any pilot deployment.
  - Accept and document that registration reveals whether an email is taken (there is no email verification in Stage 1).

### M4 — The opportunistic purge never runs on an idle pilot, so §6.1 retention silently fails

- **Actor:** none needed; this is a data-integrity and §6.1 failure.
- **Attack:** AD-23 purges only when a request arrives. After the course the pilot gets no traffic, so Answers about named people stay in the hosted Postgres indefinitely, past the 30/90 days that FR-3 promises and the final screen states.
- **AD that fails:** AD-23.
- **Fix (AD-23, add):**
  > The pilot deployment adds one daily cron request to `/api/health` (Vercel Cron on Hobby). The README states that the pilot database is deleted when the course ends. A purge failure is caught and never fails the request that started it.

### M5 — `VACUUM FULL` after close is best-effort and can fail or block the close

- **Actor:** T3 after close (physical access); availability for everyone.
- **Attack and limits:**
  - On server Postgres, `VACUUM FULL` copies any deleted rows that some older open snapshot can still see into the rewritten file. That snapshot can be another Game's transaction, a pooler session, or provider-side activity. So a "vacuumed" `submission` table can still hold the rows.
  - It takes an `ACCESS EXCLUSIVE` lock on `submission` and `invite_link`, tables shared by **every** Game. While it waits behind any open transaction, every new submit for every Game queues behind it.
  - It needs table ownership, which some providers do not grant to the app role.
  - If it throws after the close has committed and the error reaches the Host as a failure, the Host retries close and gets `WRONG_STATE`.
  - Provider point-in-time history (branch or PITR restore) can recreate the state before close in full. That goes beyond "write-ahead logs and host backups".
  - A logical dump (SM-3) is not affected, because `pg_dump` reads only live rows.
- **AD that fails:** AD-9 (final paragraph).
- **Fix (AD-9, replace the VACUUM sentence):**
  > After commit, run `VACUUM FULL submission, invite_link` best-effort, outside any transaction, with `SET lock_timeout = '2s'`. Errors are caught, logged by SQLSTATE only, and never shown to the Host. It reduces leftover data but does not guarantee physical erasure on server Postgres. The README's limits section names WAL, freed disk pages and provider point-in-time history. The pilot sets provider history retention to its minimum.

### M6 — The anonymity tests check content but not timing, child-ID authorisation or server output

- **Actor:** applies to every finding above. The tests are where AD-22 turns these rules into evidence (30 % of the grade is process, 15 % testing).
- **Gap:** `host-anonymity.spec.ts` scans only for Answer text and per-link state, so it would miss H3. `authz.test.ts` is defined only by "AD-5", so it would miss H1. Nothing captures server stdout or stderr, so nothing would catch H2. `anonymity.test.ts` does not explicitly assert that keys are per Question.
- **Fix (AD-22, extend the required tests):**
  - `host-anonymity.spec.ts`: the differential check from H3, plus reopening a used link from a fresh context (C1).
  - `authz.test.ts`: a child ID from a foreign Game on every Host action, and revoke with a foreign link (H1).
  - The e2e harness: capture `next start` output and fail on any Token, token hash or Answer text (H2).
  - `anonymity.test.ts`: no `contributor_key` appears under two `question_id`s, every `answer.id` and `contributor_key` has the UUID v4 version nibble, and after confirm `contributor_key` and `rank` are null (H4).

---

## Low

| # | Actor | Finding | AD | Fix |
| --- | --- | --- | --- | --- |
| L1 | T5 | **Judge prompt injection via Answer text** ("put everything in one cluster"). The Judge has no tools, so the impact is confined to that Question's proposal, which the Host reviews. Weak output validation could still crash Grouping or mis-assign Answers. | AD-12, AD-13 | Add: "`assignments.length === items.length`, each an integer in `0..items.length-1`; anything else is `INVALID_OUTPUT`." Construct the SDK client with explicit `baseURL` and `logLevel: 'warn'`, so the SDK's own env variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_LOG=debug`) cannot redirect or print Answer text. |
| L2 | T5 | **Unicode abuse**: bidi overrides, zero-width characters and stacked combining marks fit within 80 UTF-16 units. They spoof or overflow the TV Board and dodge normalisation-based Grouping. | AD-8, `lib/normalize` | Validate with NFKC, reject `Cc`/`Cf` characters except ZWJ inside emoji, cap combining marks, and count length in code points after normalisation. |
| L3 | T5 | **Stored jsonb must be the parsed value.** If raw input is stored, a modified client can add fields (for example `"name": "Kari"`) or padding to the Answer set, which then sits in the DB until close. | AD-8 | "`submission.answers` stores the output of a `.strict()` zod schema keyed by the Game's Question IDs, never the raw argument." |
| L4 | T7 | **Missing hardening headers.** Host Review, confirm and play can be framed (clickjacking on discard and confirm). Host pages and `rapport` have no `no-store`. | AD-17, AD-24 | Send `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store` on Host routes and `rapport`. Ban `dangerouslySetInnerHTML` in ESLint. |
| L5 | T7 | **Cookie details.** "Secure except on localhost" is undefined if it keys off `NODE_ENV`; the demo runs `next dev` and could be reached by LAN IP. | AD-6 | Name the cookie `__Host-session`, decide `Secure` from the `APP_BASE_URL` scheme, and have logout delete the session row. Login always issues a fresh token, so session fixation is already ruled out (a DB-hashed, server-minted token). Keep it that way. |
| L6 | T1 | **Plaintext links must never travel through a URL.** A natural implementation redirects after "create links" with the links in a query string or flash cookie. That puts every Token in access logs and history. | AD-7 | "Plaintext Invite links appear only in the create or revoke Server Action's response body: never in a URL, query string, cookie, redirect or cached page." |
| L7 | T4 | **The fragment stays on the device.** It sits in the URL bar, in history and in synced history, and a service worker or analytics script could read it. Drafts and (after C1) the edit secret keyed by `gameId` alone collide when two Participants share a phone or tablet: B sees A's unsent draft. | AD-7, Deferred "Unsent drafts" | No service worker and no analytics script on `/svar`. After reading the fragment, `history.replaceState` removes it and the Token moves to `sessionStorage`. Key drafts and the edit secret by a sha256(token) prefix. Clear the draft after a successful submit. |
| L8 | T1/T4 | **Participants who are also Hosts send their session cookie to `/svar`.** If a `middleware`/`proxy` matcher touches sessions on every request (sliding expiry), the session's last-use time records the submit moment and survives close. | AD-6, AD-7 | "No middleware or proxy runs session logic on `/svar/**` or its Server Action POSTs. Sliding expiry is written at most once per hour per session." |
| L9 | T3 | **Pre-close DB reader sees plaintext Answer sets** (accepted, §1.1). A cheap hardening lets a DB-only reader (without the Host's link list) see only ciphertext: encrypt `submission.answers` with a key derived from the Token, `HKDF(token, "toppsvar-submission")`. | AD-8 | Optional. Otherwise accept and document as the spine already does. |
| L10 | T1/T4 | **Participation leaks the PRD accepts but the README contract doesn't list**: count changes at 3 or more after messaging someone, the count dropping after a revoke (FR-9), spending a held link and watching the count (after C1), and platform logs (IP, time and request size of each `/svar` POST). Also `DEMO_MODE=1` against a `postgres://` URL would advertise public demo credentials on a real deployment. | README contract, AD-21 | List these participation leaks in the README limits section. `env.ts` refuses `DEMO_MODE=1` unless `DATABASE_URL` is `pglite://`. |

---

## Checked and found to hold

These were tested against the threat model and need no change. They are recorded so the gate can see coverage.

- **Physical order, `ctid`, `xmin` after close.** One batch `INSERT` of a crypto Fisher-Yates-shuffled list gives every row the same `xmin`, and physical (`ctid`, `pg_dump` COPY) order equals the shuffle. Later Grouping and Review `UPDATE`s write new versions in Question, Group or Host-action order. That reveals Host activity, never contributor or arrival order.
- **Randomness.** `crypto.randomUUID()` for Contributor keys and `gen_random_uuid()` (`pg_strong_random`, also in the PGlite WASM build) for `answer.id` carry no time component. The 256-bit Token and its SHA-256 primary key make guessing impossible, so the missing rate limit on `/svar` doesn't matter for guessing (it does for locking; see M2).
- **Judge input.** Distinct, sorted, normalised items per Question, with no keys or IDs. It carries no order or multiplicity, so the model provider learns content but not linkage (already in the README contract).
- **`grouping_result`, `game_counters`, `answer_group.origin` and `edit_count`, `rapport`.** Content-free and per Game or per Question, with nothing per contributor. `rapport` is a GET behind the session and AD-5, and JSON is not readable cross-origin.
- **Close/submit/revoke races.** `SELECT … FOR UPDATE` on the Game row plus the compare-and-set transition serialise them correctly, provided M2's Token-to-Game resolution is added. A submission replayed after close is refused because the state is no longer `collecting`.
- **Closed status by `gameId`.** No Token lookup after close, and revoked and unknown links answer the same. Revoke's response does not depend on whether an Answer set existed.
- **CSRF.** Server Actions check Origin against Host, and the cookie is `SameSite=Lax`. Keep `serverActions.allowedOrigins` unset, and make logout an action rather than a GET.
- **Session storage.** A 32-byte token with only its SHA-256 stored, sliding expiry, and no session secret to leak.
- **SM-3 against a logical dump.** Apart from H4's fingerprint, the live rows after close hold no Token, Token hash, submission, timestamp or sequence that ties an Answer to a link or to arrival.

## Requested spine changes, in order

1. **C1**: decide FR-7 against FR-12 now, with the device-secret text in AD-8, and remove the item from Deferred.
2. **H1, H2, H3**: add the AD-5 child-ID rule, the AD-17 error-boundary rule, and drop the `updated_at` touch from AD-8.
3. **H4**: Host DTOs without `rank`, and null `contributor_key` and `rank` at confirm (AD-10, AD-15). Reword the SM-3 audit's scope.
4. **H5, M5, L10**: README-contract additions.
5. **M1 to M4, M6**: add the AD text above to AD-7, AD-6, AD-23 and AD-22.
