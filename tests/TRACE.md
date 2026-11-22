# Test trace

Maps every Stage 1 FR, and the NFRs the stories so far touch, to the tests or manual checks that prove it. Test titles start with the ID they prove. `tests/unit/trace.test.ts` fails if a Stage 1 FR heading is missing.

Each story adds its rows here. "Pending" names the stories whose acceptance criteria will add coverage.

## FR-1

Host account.

- `tests/unit/password.test.ts`: the scrypt string carries `N=131072, r=8, p=1`, a 16-byte salt and a 32-byte key and never the password; verify accepts the right password and rejects a wrong or malformed string; `DUMMY_HASH` has the same parameters; at most two scrypt runs at a time (Story 1.3, AC1).
- `tests/unit/account-schema.test.ts`: 9/10/256/257-character passwords with the exact messages, passwords never trimmed, email trimmed and validated, login messages (Story 1.3, AC1).
- `tests/integration/auth.test.ts`, through the Server Actions and `requireHost`: only the scrypt string is stored; a too-short or too-long password creates no Host and runs no scrypt; unknown email and wrong password give one identical `INVALID_CREDENTIALS`, the unknown email running exactly one scrypt; an over-long login password runs none; lockout at the fifth failure for 60 s, doubling to 120 s, refusing the right password while locked and resetting on success (controlled clock); the lock stops at 24 h (the 16th failure); a wrong password while locked changes neither the count nor the lock; a lock set while a right-password login waits for scrypt refuses it and creates no session, and one set while a wrong-password login waits is neither counted on nor changed; the cookie is `httpOnly`, `SameSite=Lax`, 1 209 600 s, not `Secure` on http; the DB holds only `sha256(token)`; `expires_at` is untouched after 30 min and extended after 2 h; a session unused for 14 days redirects to `/logg-inn?utlopt=1` and is deleted; no or unknown cookie redirects to `/logg-inn`; the same email in another case is `EMAIL_TAKEN`; a code is ignored without `REGISTRATION_CODE`; logout deletes row and cookie (Story 1.3, AC1–AC4).
- `tests/integration/proxy.test.ts`: `src/proxy.ts` re-sets the session cookie on a GET with `Max-Age=1209600`, `HttpOnly` and `SameSite=Lax`, and sets nothing on a POST or a GET without the cookie (Story 1.3, AC3).
- `tests/integration/auth-secure-and-code.test.ts`: `APP_BASE_URL=https://…` makes the cookie `Secure`; with `REGISTRATION_CODE` set a missing or wrong code is `REGISTRATION_CODE_WRONG` before any scrypt run and creates no Host, the right code registers even with spaces around it, and `/registrer` renders a field labelled "Registreringskode" (Story 1.3, AC3, AC4). Not e2e, because the e2e server runs with the code unset.
- `tests/integration/purge.test.ts`: `purgeExpired` also deletes sessions expired more than 14 days ago and keeps newer expired and live ones, so the `?utlopt=1` notice still works for any cookie a browser can hold (Epic 1 review).
- `tests/e2e/auth.spec.ts`: register, log out and log in again each land on "Mine spill", and `/spill` after logout redirects to `/logg-inn`; a second registration with the same email shows the taken message; wrong password and unknown email both show "Feil e-post eller passord."; no "Registreringskode" field; `/logg-inn?utlopt=1` shows the expiry notice; the pages are titled "Opprett konto – Toppsvar", "Logg inn – Toppsvar" and "Mine spill – Toppsvar"; a GET with the session cookie re-sets it with `Max-Age=1209600`, `HttpOnly`, `SameSite=Lax` (Story 1.3, AC2–AC4).
- `tests/integration/authz.test.ts`: Host B's `getOwned`, `lockForMutation({ hostId: B })` and the `deleteGame` action on Host A's Game reject with the same `NOT_FOUND` as a random UUID and `"abc"`, and A's `updated_at` stays unchanged; the Game page component calls `notFound()` for all three; with the `game` table dropped the Game page rejects with `INTERNAL` (the 500 page), not `notFound()`; `createGame` logged out redirects to `/logg-inn` and creates no Game (Story 1.4, AC3; Story 1.5, AC2).
- `tests/integration/session-expiry.test.ts`: with a session past its 14 days, the spill layout and `/spill`, rendered in either order within one request, both redirect to `/logg-inn?utlopt=1`, because `requireHost` reads the session once per request through React `cache()`; that page then shows "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen." (Story 1.3, AC3).
- `tests/e2e/games.spec.ts`: Host B in a fresh context opening A's Game URL, a random UUID URL and `/spill/abc` sees the same `<h1>` "Vi finner ikke dette spillet.", the page title "Vi finner ikke dette spillet – Toppsvar" (never A's title), the same "Mine spill" link and the same HTTP status, and never A's title; logged out, `/spill` and a Game page answer with a 3xx to `/logg-inn` from the spill layout and end there (Story 1.4, AC3).
- `tests/e2e/invite-link-page.spec.ts`: opening an Invite link in the Host's own browser (session cookie present) shows the Game title but no "Logg ut", "Mine spill", "Hopp til innhold", `nav`, `a[href^="/spill"]` or `a[href="/"]`, and the document response carries no `set-cookie`; `/svar` and `/svar/<uuid>/x` show "Vi finner ikke denne lenken." from `/svar`'s own not-found page with no "Mine spill", "Logg ut" or `nav` (Story 2.3, AC2).
- `tests/unit/error-pages.test.ts`: `svar/error.tsx` has the 500 `<h1>`, title and "Prøv igjen", with the wordmark as plain text and no link, `nav`, skip link or "Logg ut" (Story 2.3, AC2).
- `tests/unit/lint-zones.test.ts`: `src/app/svar/**` and the three Participant components (`LinkStatus.tsx` checked) may not import `@/server/auth` and still may not import `@/server/db`; `src/app/spill/**` may import auth (Story 2.3, AC2).

## FR-2

Create and list Games.

- `tests/unit/game-state.test.ts`: `createGameSchema` refuses an empty, whitespace-only and 81-character title with "Navnet må ha 1–80 tegn.", accepts 1 and 80 characters and trims; `formatDate` of `2026-11-21T23:30Z` is "22. november 2026" (Story 1.4, AC1, AC2).
- `tests/integration/authz.test.ts`: `createGame` creates a trimmed _draft_ with `updated_at = created_at` and redirects to `/spill/{id}`; an empty or 81-character title returns `INVALID_INPUT` with the field error and creates no Game; `listOwned(B)` excludes A's Game and `listOwned(A)` is newest first by `created_at`, not `updated_at`, with only `id`, `title`, `state`, `updatedAt` (Story 1.4, AC1–AC3).
- `tests/e2e/games.spec.ts`: a new Host sees the empty-state sentence, creates "Hyttetur 2026" and lands on its Game page with breadcrumb `Mine spill › Hyttetur 2026`, the title as focused `<h1>` and page title "{title} – Toppsvar", and "Utkast"; an empty or 81-character title shows the error on the field with focus there and the title kept; the counter is absent at 59 characters and reads "60 av 80 tegn" at 60, and an 80-character title with a space on each side is announced as "80 av 80 tegn"; two Games are listed newest first with title link, "Utkast" and "Sist endret {dato}" (Story 1.4, AC1, AC2, AC5).

## FR-3

Delete a Game.

- `tests/integration/delete.test.ts`: `deleteGame` deletes Host A's Game in each of the seven states, sets the title in the `toppsvar_slettet` cookie (`httpOnly`, `SameSite=Lax`, path `/spill`, 60 s) and redirects to `/spill`; afterwards no column of any foreign key referencing `game` (read from `pg_constraint`) holds the ID; every foreign key under `game`, direct or through another table (a recursive walk of `pg_constraint`), is `ON DELETE CASCADE`; the walk reaches a temporary table that references `game` only through another one, and the same query for `host` finds `session` and `game` cascading, proving it sees real keys; logged out redirects to `/logg-inn` and deletes nothing; `/spill` shows "«{title}» er slettet." only when the cookie is set; the Game page renders "Slett spillet" in all seven states (Story 1.5, AC1, AC2). Host B's delete attempt is in `authz.test.ts`.
- `tests/integration/proxy.test.ts`: a page load and a client navigation clear the `toppsvar_slettet` cookie; the render that a delete's redirect streams back (`x-action-redirect`) keeps it, and a POST never touches it (Story 1.5, AC1).
- `tests/integration/purge.test.ts` (fake `Date`): `purgeExpired` deletes a Game played 30 d + 1 s ago and a never-played one updated 90 d + 1 s ago, keeps one played 29 d ago and one updated 89 d ago, and a second run deletes 0; `purgeIfDue` runs at t and t + 60 min but not t + 59 min; `transition(playing→played)` sets `played_at` to now and `draft→collecting` leaves it null; with the `game` table renamed, `purgeIfDue` resolves with exactly one `games`/`purgeExpired`/`INTERNAL` log line, and `SpillLayout` still renders its children while the `after` purge it schedules fails and resolves (Story 1.5, AC3).
- `tests/integration/purge-route.test.ts`: `GET /api/purge` is 404 `disabled` without `CRON_SECRET`, 401 `refused` with no header, `Bearer wrong` or the bare secret, and 200 `{ status: "ok", deleted: 1 }` with `Bearer {secret}`; the expired Game survives every non-200 call, the young Game survives all, and no call moves the hourly marker (Story 1.5, AC4, AD-17).
- `tests/e2e/delete.spec.ts`: "Slett spillet" has a 1 px danger border, danger text and a white fill; it opens a dialog named "Slette «{title}»?" described by the consequence sentence with "Avbryt" focused; Esc and "Avbryt" both close it and return focus to the trigger; "Slett for godt" (danger fill, white text) lands on `/spill` with "«{title}» er slettet.", the title gone from the list, no notice after a reload and its old URL showing "Vi finner ikke dette spillet."; a crafted `/spill?slettet=…` link shows no notice; an aborted POST keeps the dialog open with the focused "Fikk ikke kontakt. Sjekk nettet og prøv igjen." and the Game still listed; confirming in a stale dialog after the Game was deleted from a second tab keeps the dialog open with a focused alert "Vi finner ikke dette spillet." (Story 1.5, AC1, UX-DR8).
- `tests/integration/collection.test.ts`: a deleted Game's link is `LINK_UNKNOWN` through `openInviteLink` and `unknown` from `linkStatus`, so the shell calls `notFound()` (Story 2.3, AC3).
- `tests/e2e/invite-link-page.spec.ts`: the link of a Game deleted through "Slett for godt" shows "Vi finner ikke denne lenken." with its body, and its pre-seeded `localStorage` key is removed (Story 2.3, AC3).
- Pending: Stories 4.3, 6.4.

## FR-4

Write and edit Questions.

- `tests/unit/question.test.ts`: `saveQuestionSchema` refuses empty, whitespace-only and 201-character text with "Spørsmålet må ha 1–200 tegn.", accepts 1 and 200 characters and trims; a `questionId` that is not a UUID is refused (Story 2.1, AC1).
- `tests/integration/questions.test.ts`: through `saveQuestion`, `moveQuestion` and `removeQuestion` as one Host, adding three, editing, moving up and down (first up and last down are no-ops) and removing the middle keep positions exactly `1..n` with texts in the expected order after every operation; removing position 2 of 4 leaves 1, 2, 3; a retried save with the same id edits instead of duplicating; the 21st Question is `QUESTION_CAP_REACHED` "Du har nådd maks 20 spørsmål." and the count stays 20; empty, whitespace-only and 201-character text are `INVALID_INPUT` with the field error and write nothing, 200 characters are saved; a successful save (new and existing), move and remove each move `game.updated_at` forward from a fixed past value (the FR-3 retention clock); move and remove with a malformed `questionId` (`"abc"`) in the Host's own Game are `NOT_FOUND` and change neither the Questions nor `updated_at`; logged out every action redirects to `/logg-inn` and writes nothing; `list` returns `{ id, text }` in position order (Story 2.1, AC1).
- `tests/integration/game-state.test.ts`: in each of the six non-_draft_ states, `save` (new and existing id), `move` and `remove` are `WRONG_STATE` and the Question rows are unchanged (Story 2.1, AC2).
- `tests/integration/authz.test.ts`: Host B's save, move and remove on A's Game, a random UUID and `"abc"` give one identical `NOT_FOUND`, leaving A's Questions and `updated_at`; A saving, moving or removing B's `questionId` inside A's own Game is `NOT_FOUND` and changes neither Game (Story 2.1, AD-5).
- `tests/e2e/questions.spec.ts`: a new Game shows the full empty-state sentence, "Legg til spørsmål" and "0 av 20 spørsmål"; the click focuses "Spørsmål 1", typing and Tab show "Lagret" in `success`, and a reload keeps the text without the sentence; the counter is absent at 159 characters and reads "160 av 200 tegn" at 160; 201 characters show "Spørsmålet må ha 1–200 tegn." with `aria-invalid`; with three Questions, "Flytt ned" and "Flytt opp" reorder (checked after reload) with focus on the moved Question's button, or its other move button at the top; the first row has no "Flytt opp" and the last no "Flytt ned"; "Slett" removes (checked after reload) and focuses the textarea now at that index; an empty draft blurred is not saved; an aborted save POST shows "Fikk ikke lagret. Prøv igjen." and keeps the text; with the first save POST held, a second edit and Tab sends nothing until it settles, then the newer text is saved (checked after reload); after the Game is deleted from a second tab, a save refreshes the page to "Vi finner ikke dette spillet."; at 20 Questions "Legg til spørsmål" is gone and "Du har nådd maks 20 spørsmål." shows (Story 2.1, AC3).
- `tests/integration/invite-links.test.ts`: the _collecting_ Game page rendered with `renderToStaticMarkup` lists the Question texts under "Spørsmål (låst)" and has no `textarea`, "Flytt opp", "Flytt ned" or "Legg til spørsmål" (Story 2.2, AC5).
- `tests/e2e/invite-links.spec.ts`: after opening Collection the page shows "Spørsmål (låst)" with the Question and no textarea or buttons; a Question edited and blurred in tab A after tab B opened Collection refreshes tab A to "Samler inn" with the locked list holding the old text (Story 2.2, AC5; the Story 2.1 `WRONG_STATE` deferral).

## FR-5

Create Invite links.

- `tests/unit/token.test.ts`: a Token matches `^[A-Za-z0-9_-]{43}$` and decodes to 32 bytes; 10 000 Tokens have no duplicate; `sha256("abc")` is the known hex vector (Story 2.2, AC1).
- `tests/unit/errors.test.ts`: `QUESTIONS_REQUIRED` "Skriv minst ett spørsmål først." and `LINK_CAP_REACHED` "Spillet har nådd maks 50 lenker." (Story 2.2, AC2, AC3).
- `tests/integration/invite-links.test.ts`, through the `createInviteLinks` action: the first batch of 3 in _draft_ returns 3 links `http://localhost:3000/svar/<gameId>#<43 chars>`, stores 3 rows whose `token_hash` is `sha256` of each returned Token, moves the Game to _collecting_, sets `invite_links_issued` to 3 and moves `updated_at` forward; `invite_link` has only `token_hash` and `game_id`; 2 more in _collecting_ give issued 5 without a transition; zero Questions is `QUESTIONS_REQUIRED` and nothing changes; at 48 issued, 3 more is `LINK_CAP_REACHED` with nothing created, 2 reach 50, then 1 more is `LINK_CAP_REACHED`; with 50 issued and every row deleted it is still `LINK_CAP_REACHED` (revoked links stay counted); count 0, 51, 1.5, `"3"` and missing are `INVALID_INPUT` with "Skriv et tall fra 1 til 50." and write nothing; a trigger that refuses the state update rolls back rows, issued, state and `updated_at` and returns `INTERNAL`; logged out it redirects to `/logg-inn` and writes nothing (Story 2.2, AC2, AC3).
- `tests/integration/game-state.test.ts`: `createInviteLinks` is `WRONG_STATE` in each state after _collecting_, leaving state, issued, `updated_at` and rows unchanged (Story 2.2, AD-4).
- `tests/integration/authz.test.ts`: Host B's `createInviteLinks` on A's Game, a random UUID and `"abc"` give one identical `NOT_FOUND`, leaving A's state, issued count, rows and `updated_at` (Story 2.2, AD-5).
- `tests/e2e/invite-links.spec.ts`: with zero Questions "Lag lenker" is `aria-disabled` with "Skriv minst ett spørsmål først." as its description and a click opens nothing; with one Question and count 3 the dialog "Åpne innsamlingen?" carries the exact body, focuses "Avbryt", and Esc keeps "Utkast"; confirming focuses "Kopier lenkene nå", shows the notice and 3 links of the right shape next to the "Samler inn" badge and the heading "Flere lenker"; "Kopier" on link 2 reads "Kopiert" with "Lenke kopiert." and the link in the clipboard, and "Kopier" again after 2 s; "Kopier alle" puts the links joined by newlines in the clipboard; closing the page before "Jeg har kopiert lenkene" raises a `beforeunload` dialog; after it, focus returns to "Antall lenker", and a reload shows no link, Token or `/svar/` and "3 av maks 50 lenker brukt."; 2 more in _collecting_ need no dialog and give "5 av maks 50 lenker brukt."; count 0 is a field error with `aria-invalid`, focus on the field and no POST; 50 in one batch end at "Spillet har nådd maks 50 lenker." with no field and focus on that sentence; with `navigator.clipboard` undefined "Kopier" shows "Marker og kopier lenken selv." and selects exactly the link, and "Kopier alle" shows the same and selects every link without any "Kopier" button text; with 3 issued, 48 is a field error "Skriv et tall fra 1 til 47." with `aria-invalid`, focus on the field and no POST; when a second tab has meanwhile created 45 more, the stale tab asking for 5 gets the focused alert "Spillet har nådd maks 50 lenker." and refreshes to "48 av maks 50 lenker brukt."; an aborted create POST shows the focused network message in the dialog and no links (Story 2.2, AC4).

## FR-6

Answer through an Invite link.

- `tests/integration/collection.test.ts`, through the `openInviteLink` action: every valid link of a _collecting_ Game returns `{ title, questions: { id, text }[] }` in position order, also after two "Flytt opp" reorders; `linkStatus` is `open` (Story 2.3, AC5).
- `tests/e2e/invite-link-page.spec.ts`: opening a valid link in a fresh browser shows the Game title as `<h1>`, the document title "{title} – Toppsvar" and the Question's fieldset (Story 2.3, AC1, AC5).
- `tests/unit/answer-set.test.ts`: `parseAnswerSet` trims, drops empty fields and keeps field order; 80 trimmed characters pass and 81 fail under `qid.1` with "Svaret kan ha maks 80 tegn."; six entries, a value that is not an array, an unknown Question ID and a non-object set fail; a missing key and an all-blank Question fail with "Skriv minst ett svar." (Story 2.4, AC3, AC4).
- `tests/integration/collection.test.ts`, through the `submitAnswerSet` action: a first submit stores exactly one `submission` row with `token_hash = sha256(token)`, trimmed non-empty Answers in field order and `sha256` of the secret; a missing key or all-blank Question returns `INVALID_INPUT` with "Skriv minst ett svar." under the Question ID; 81 trimmed characters at field 1 return "Svaret kan ha maks 80 tegn." under `qid.1` while 80 are stored; six Answers, an unknown Question ID, a non-object set, a non-array value and a missing, 42-character or non-string secret are `INVALID_INPUT`; none of these writes a row (Story 2.4, AC3–AC5).
- `tests/e2e/answer-form.spec.ts`: at 360 px each Question is a fieldset "Spørsmål N av 2: …" with "Svar 1" and "Svar 2 (valgfritt)"; inputs carry `maxlength="80"`, `autocomplete="off"`, `autocapitalize="sentences"` and `enterkeyhint="next"`; three "Legg til svar" clicks give five fields, focus each new one and remove the button; "Fjern svar 4" focuses Svar 3; no counter at 59 characters and "60/80" at 60; "0 av 2" becomes "1 av 2 spørsmål har svar"; the instruction and helper lines show; a submit with Question 2 empty sends no `next-action` POST, focuses the summary "1 spørsmål mangler svar" with one link "Spørsmål 2: …", marks Question 2's Svar 1 `aria-invalid` with "Skriv minst ett svar." as its description, and the link focuses that field without changing `location.hash`; an 81-character Answer past a removed `maxlength` shows "Svaret kan ha maks 80 tegn." under its field; a complete submit with an empty Svar 2 and a filled Svar 3 focuses "Svarene dine er lagret." with the body and "Se eller endre svarene" (Story 2.4, AC2, AC3, AC5).
- `tests/unit/answer-set.test.ts`: `toFields` caps a tampered draft at five string fields, pads to two, drops non-strings and unknown Question IDs, and turns a non-object or non-array into `["", ""]` without throwing (Story 2.5, AC4).
- `tests/e2e/answer-form.spec.ts`: a typed draft lands in the link's `localStorage` value about 500 ms later, a reload restores it with "Du har endringer som ikke er sendt inn.", "Forkast endringene" and the helper line, and no request URL or body carries its text before "Send inn svar"; after a successful submit the value is `{ token, editSecret }` with no draft; an aborted submit leaves `{ token, editSecret, draft }` (Story 2.5, AC4).
- `tests/e2e/invite-link-page.spec.ts`: a closed link clears the whole key with an unsent draft in it (Story 2.5, AC4).

## FR-7

Change a submitted Answer set.

- `tests/unit/token.test.ts`: the link store writes `{ token, editSecret }` under `storageKey` and reads it back only for exactly that Token; `newEditSecret()` is 32 bytes in `TOKEN_PATTERN`'s shape and two calls differ (Story 2.4, AC5).
- `tests/integration/collection.test.ts`: a second submit on the same link keeps one row and replaces both the Answers and the secret hash (Story 2.4, AD-8).
- `tests/e2e/answer-form.spec.ts`: after a complete submit the `localStorage` value at `storageKey` is `{ token: <link Token>, editSecret: <43 base64url characters> }`; "Se eller endre svarene" focuses the `<h1>` and shows the form with the submitted values and "Lagre endringer", and pressing it keeps the same `editSecret`; after an aborted submit the key already holds `{ token, editSecret }` (Story 2.4, AC5).
- `tests/unit/token.test.ts`: the link store round-trips `{ token, editSecret, draft }` (Story 2.5, AC4).
- `tests/integration/collection.test.ts`, through `openInviteLink`: only the matching edit secret returns `answers`; a wrong, missing, `"abc"`, numeric or Token-as-secret call `toEqual`s an unused sibling link, and so does another link's secret; a same-device resubmit keeps one row with the same hash and reopens with the edited set; a submit with a new secret replaces the row and hash, after which the old secret gets no `answers` and the new one the new set; an edit that leaves a Question blank is `INVALID_INPUT` "Skriv minst ett svar." with the row unchanged (Story 2.5, AC1, AC2).
- `tests/e2e/answer-form.spec.ts`: after a submit, a reload in the same context is pre-filled with "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer».", an added Svar 3 saved through "Lagre endringer" is there after the next reload, and a fresh browser context shows two empty fields, no returning notice, "Send inn svar" and the helper line; a draft over a saved set wins with the draft notice and not the returning one, axe finds nothing serious, and "Forkast endringene" restores the saved value, shows the returning notice, focuses Question 1's Svar 1 and leaves `{ token, editSecret }` with the same secret (Story 2.5, AC3, AC4).

## FR-8

Collection progress.

- None yet.
- Pending: Story 2.6.

## FR-9

Revoke and replace an Invite link.

- `tests/unit/errors.test.ts`: `LINK_UNKNOWN` "Vi finner ikke denne lenken." (Story 2.3).
- `tests/unit/token.test.ts`: `TOKEN_PATTERN` accepts 100 `newToken()`s and rejects 42 and 44 characters, `+`, `/`, `=` and an empty string; `storageKey` is `toppsvar:<gameId>:<first 16 Token characters>` (Story 2.3).
- `tests/integration/collection.test.ts`: a Token of another Game is `LINK_UNKNOWN` (lookup by `(token_hash, game_id)`); a random 43-character Token, `"abc"`, `""`, 42 characters, a number and no Token are `LINK_UNKNOWN`; a revoked link (row deleted) is identical to an unknown one while its sibling still opens; a random UUID, `"abc"`, a non-string and a deleted Game are `LINK_UNKNOWN` and `linkStatus` `unknown`; the shell throws `notFound()` for a random UUID and `"abc"` (Story 2.3, AC3, AC5).
- `tests/e2e/invite-link-page.spec.ts`: a random UUID, an `"abc"` gameId, a malformed Token, an unknown Token and a deleted Game's link each show "Vi finner ikke denne lenken." with "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny.", and the pre-seeded `storageKey` is removed; setting `location.hash` to a valid Token on the unknown page (a pasted replacement link) reloads and shows the Game title (Story 2.3, AC3).
- `tests/unit/token.test.ts`: `clearLinkStore` removes the key when its stored Token equals the current one, and keeps it for a Token sharing only the first 16 characters and for an unparseable value; read, write and clear never throw when storage throws (Story 2.4, 2.3 deferred item).
- `tests/integration/collection.test.ts`, through `submitAnswerSet`: a number, `"abc"`, an unknown, another Game's and a revoked Token, and a random UUID, `"abc"` or non-string Game are `LINK_UNKNOWN` with no row; deleting the `invite_link` row removes its `submission` by cascade (Story 2.4, AD-8).
- `tests/e2e/invite-link-page.spec.ts`: with the real link's key seeded `{ token: <real> }`, opening `/svar/<gameId>#<first 16 characters>x` shows the unknown page and leaves the value unchanged; the seeded values of the other key tests are now `{ token }` (Story 2.4, 2.3 deferred item).
- Pending: Story 2.7.

## FR-10

Close Collection.

- `tests/unit/errors.test.ts`: `COLLECTION_CLOSED` "Innsamlingen er stengt." (Story 2.3).
- `tests/integration/collection.test.ts`: in each of the six states other than _collecting_, a real, an unknown, a revoked and a malformed Token are all `COLLECTION_CLOSED` (the state is decided before the Token) and `linkStatus` is `closed`; the shell for a _grouping_ Game renders the closed heading and body and not the Game title (Story 2.3, AC4).
- `tests/e2e/invite-link-page.spec.ts`: a _draft_ Game's ID with a made-up Token shows "Innsamlingen er stengt." with "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres.", no Game title, and the pre-seeded `storageKey` is removed (Story 2.3, AC4).
- `tests/e2e/invite-link-page.spec.ts`: a real `LINK_UNKNOWN` action response rewritten to `COLLECTION_CLOSED` shows the closed heading and body with no alert and removes the seeded key (the client branch, Story 2.3, AC4).
- `tests/integration/collection.test.ts`: in each of the six states other than _collecting_ a submit is `COLLECTION_CLOSED` and writes no row (Story 2.4).
- `tests/e2e/answer-form.spec.ts`: a real submit response rewritten to `COLLECTION_CLOSED` replaces the form with the focused "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret." and removes the key; rewritten to `LINK_UNKNOWN` it shows the focused unknown heading; to `INTERNAL` the alert with the values kept; to `INVALID_INPUT` with a `qid.0` field error that error under Question 1's Svar 1 (Story 2.4).
- Pending: Story 3.1.

## FR-11

No identity in the answering flow.

- `tests/unit/log.test.ts`: `log.ts` writes only `module`, `op`, `code` and `sqlstate`, and drops every other field at runtime (Story 1.1, AD-17).
- `tests/unit/errors.test.ts`: `toFailure` gives the AD-17 shape and turns any other error into `INTERNAL` without its message (Story 1.3, AC5).
- `tests/integration/auth-internal.test.ts`: with the `host` and `session` tables dropped, the login action returns `INTERNAL` and stderr holds one JSON line with only `module`, `op`, `code` and `sqlstate`, and neither the email nor the password; `register` returns `INTERNAL`, not `EMAIL_TAKEN`, with one `register` line; `requireHost` with a cookie rejects with `INTERNAL` and one `requireHost` line; logout still deletes the cookie (Story 1.3, AC5).
- `tests/integration/collection.test.ts`: with `invite_link` renamed, `openInviteLink` returns `INTERNAL` and stderr holds one line `{ module: "collection", op: "openInviteLink", code: "INTERNAL", sqlstate: "42P01" }` with no Token, hash or gameId; opening (a valid and an unknown Token) changes neither the `game` row, `updated_at` included, nor any `invite_link` row; the shell's server HTML for an open Game holds no Game title, Question text, Token or link, only the wordmark and "Henter spørsmålene …" (Story 2.3, AC1, AC6).
- `tests/e2e/invite-link-page.spec.ts`: `GET /svar/<gameId>` answers with `Referrer-Policy: no-referrer`, `<title>Toppsvar</title>`, `noindex, nofollow`, no `og:` tag, and neither the Game title nor the Question; no request the browser sends while opening the link has the Token in its URL (Story 2.3, AC1).
- `tests/e2e/invite-link-page.spec.ts`: a real action response rewritten to `INTERNAL` shows only the danger alert "Noe gikk galt hos oss. Prøv igjen om litt." with "Prøv igjen", no unknown or closed copy, and keeps the seeded `storageKey` (Story 2.3).
- `tests/integration/collection.test.ts`: a first submit leaves the `game` row, `updated_at` included, unchanged; with `submission` renamed it returns `INTERNAL` and stderr holds one line `{ module: "collection", op: "submit", code: "INTERNAL", sqlstate: "42P01" }` with no Token, hash, edit secret, its hash, Answer or gameId (Story 2.4, AD-8, AD-17).
- `tests/e2e/answer-form.spec.ts`: opened in the Host's own browser, the answer form shows no "Logg ut", "Mine spill" or `@` (Story 2.4, AC6).
- `tests/unit/lint-zones.test.ts`: `AnswerForm.tsx` may not import `@/server/auth` (Story 2.4, AD-6).
- Pending: Stories 3.2, 3.3, 6.5.

## FR-12

Nothing linkable in the Host's view.

- `tests/integration/invite-links.test.ts`: after creating links, no column of any public table (a `row_to_json` scan of every row) contains a returned Token, `invite_link` holds only `token_hash` and `game_id`, and the _collecting_ Game page contains no Token and no `/svar/` (Story 2.2, AC5).
- `tests/e2e/invite-links.spec.ts`: after "Jeg har kopiert lenkene" and a reload the page holds no link, Token or `/svar/` (Story 2.2, AC4, AC5).
- `tests/integration/collection.test.ts`: `openInviteLink` with a wrong, missing, malformed or another link's edit secret returns exactly the unused-link response, so a link's holder cannot tell whether it was used (Story 2.5, AC1).
- Pending: Stories 2.6, 3.3, 4.3, 5.1.

## FR-13

Unlinkable storage after close.

- None yet.
- Pending: Stories 3.1, 3.2, 5.5.

## FR-14

Honest anonymity notice.

- `tests/e2e/answer-form.spec.ts`: above the first Question the info Notice reads exactly "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet.", with the instruction line as a separate paragraph (Story 2.4, AC1).
- `tests/manual/checklist.md`: A3, the notice is read by VoiceOver or TalkBack (Story 2.4, AC6).
- Pending: Story 7.4.

## FR-15

Judge Grouping at close.

- None yet.
- Pending: Stories 4.1, 4.2, 4.4, 7.1.

## FR-16

Ranking and labels.

- None yet.
- Pending: Stories 5.1, 5.3.

## FR-17

Manual Grouping fallback.

- None yet.
- Pending: Stories 3.1, 4.1, 4.2, 5.1.

## FR-18

Content-free usage counters.

- None yet.
- Pending: Story 4.3.

## FR-19

Review display.

- None yet.
- Pending: Story 5.1.

## FR-20

Correct the Grouping.

- None yet.
- Pending: Stories 5.2, 5.3, 5.4.

## FR-21

Mark reviewed and confirm the Board.

- None yet.
- Pending: Stories 5.4, 5.5.

## FR-23

Set up Teams.

- None yet.
- Pending: Story 6.1.

## FR-24

Show the Board.

- None yet.
- Pending: Story 6.2.

## FR-25

Mark a match or a miss.

- None yet.
- Pending: Stories 6.2, 6.3.

## FR-26

Undo.

- None yet.
- Pending: Story 6.3.

## FR-27

Turns and moving on.

- None yet.
- Pending: Stories 6.2, 6.3, 6.4.

## FR-30

Full Stage 1 without a key.

- None yet.
- Pending: Story 6.5.

## FR-31

Demo mode.

- None yet.
- Pending: Stories 7.1, 7.4.

## FR-32

Judge evaluation.

- None yet.
- Pending: Story 7.2.

## NFR-1

Local runnability.

- `tests/e2e/smoke.spec.ts`: `/` renders with `<html lang="nb">` and `GET /api/health` returns 200 on `next build && next start` with a temporary PGlite directory and no key.
- `tests/integration/env.test.ts`: an empty environment gives the no-key defaults.
- `tests/integration/db.test.ts`: `DATABASE_URL` parsing, PGlite directory creation and migration on open, the health route.
- CI (`.github/workflows/ci.yml`) runs the README scripts on Node 22 and 26 with no key.
- Pending: Stories 7.1, 7.4 (demo and README).

## NFR-2

Deployability.

- `tests/integration/db.test.ts`: `postgres://` and `postgresql://` select postgres.js with `prepare: false`, and opening one does not throw with the network guard on, so the same build targets hosted Postgres by configuration alone.
- Pending: Story 7.5 (optional pilot).

## NFR-3

Tests without network.

- `tests/unit/guards.test.ts`: Vitest rejects non-local sockets; the environment selects the `mock` Judge provider with no key and an in-memory database (no Judge runs yet).
- `tests/e2e/smoke.spec.ts`: the browser aborts requests to any host but localhost.
- `tests/integration/db.test.ts`: each integration file gets a fresh `pglite://:memory:` database.
- Pending: every story with unit or integration proof.

## NFR-4

Devices.

- `tests/e2e/invite-link-page.spec.ts`: at 360 px the open, closed and unknown link pages have no horizontal scroll (Story 2.3).
- `tests/e2e/answer-form.spec.ts`: the answer form with four fields in Question 1 and a visible counter has no horizontal scroll at 360 px and at 320 px (Story 2.4, AC2).
- `tests/manual/checklist.md`: A4, 360 px, 320 px and 200 % zoom on a real phone (Story 2.4, AC6).

## NFR-6

Accessibility (WCAG 2.1 AA).

- `tests/e2e/visual-foundation.spec.ts`: axe with its default rules finds no serious or critical violations on `/` and the 404 page; Tab reaches every interactive element on both and each shows the `focus` ring (3 px `focus-ring`); the landing links and Host chrome controls are at least 44 px high (Story 1.2); on `/spill` "Mine spill" in the top bar carries `aria-current="page"`.
- `tests/e2e/auth.spec.ts`: axe finds no serious or critical violations on `/registrer` and `/logg-inn`, before and with field errors shown, and on `/spill`; Tab reaches every interactive element on both form pages, each shows the focus ring and is at least 44 px high; "E-post" carries `aria-required="true"`; a too-short password sets `aria-invalid="true"`, links helper and error through `aria-describedby` and moves focus to the field (Story 1.3, AC6).
- `tests/e2e/games.spec.ts`: axe finds no serious or critical violations on `/spill` empty, with Games and with a field error, on the Game page and on the Game not-found page; Tab reaches every interactive element on `/spill` with Games and on the Game page, each shows the focus ring, and every control in the header and main is at least 44 px high; "Navn på spillet" carries `aria-required="true"`; an invalid title sets `aria-invalid="true"` with the error as accessible description (Story 1.4).
- `tests/e2e/delete.spec.ts`: axe finds no serious or critical violations with the delete dialog open and on `/spill` with the success notice; reached by keyboard, "Slett spillet", "Avbryt" and "Slett for godt" each show the focus ring and are at least 44 px high (Story 1.5).
- `tests/e2e/questions.spec.ts`: three Questions are added with Enter on "Legg til spørsmål", typing and Tab, and one is moved with Space on "Flytt ned", focus following it; on the _draft_ Game page Tab then reaches every interactive element in DOM (reading) order, each shows the focus ring, every editor button is at least 44 px high and each textarea has a visible label "Spørsmål N"; axe finds no serious or critical violations with Questions present and with a field error shown (Story 2.1, AC4).
- `tests/e2e/invite-links.spec.ts`: axe finds no serious or critical violations on the _draft_ Invite link panel, with the "Åpne innsamlingen?" dialog open, with the OnceLinkList shown and on the _collecting_ page; from the focused "Kopier lenkene nå", Tab reaches "Kopier alle", each "Kopier" and "Jeg har kopiert lenkene" in order, each with the focus ring and at least 44 px high (Story 2.2, NFR-6).
- `tests/e2e/invite-link-page.spec.ts`: axe finds no serious or critical violations at 360 px on the open, closed and both unknown link pages (client `LINK_UNKNOWN` and the server `not-found.tsx`); an aborted `openInviteLink` POST shows the danger alert "Fikk ikke kontakt. Sjekk nettet og prøv igjen." with "Prøv igjen", which, pressed with Enter once the route is released, loads the Questions and moves focus to the new `<h1>`; the `INTERNAL` failure shows the same alert and "Prøv igjen" (Story 2.3, UX-DR23).
- `tests/e2e/answer-form.spec.ts`: axe finds no serious or critical violations on the answer form at 360 px; the error summary takes focus and its links move focus to the field; an aborted submit POST shows the danger alert "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten." and keeps every typed value (Story 2.4, AC3, AC6).
- `tests/manual/checklist.md`: A2 keyboard only, A3 screen reader, A4 reflow and zoom (Story 2.4, AC6).
- Pending: every story that builds a screen.

## NFR-7

Norwegian bokmål interface.

- `tests/e2e/visual-foundation.spec.ts`: the landing page reads "Toppsvar", "Logg inn" and "Opprett konto"; an unknown URL reads "Siden finnes ikke." with "Hopp til innhold" in the Host chrome (Story 1.2), plus "Mine spill" and "Logg ut" when signed in (Story 1.3).
- `tests/unit/error-pages.test.ts`: `error.tsx` and `global-error.tsx` read "Noe gikk galt hos oss. Prøv igjen om litt." (Story 1.2).
- `tests/e2e/auth.spec.ts`: "Opprett konto", "Logg inn", "Mine spill", the labels "E-post" and "Passord", the helper "Minst 10 tegn.", the cross-links and every error and notice sentence are the literal bokmål strings (Story 1.3).
- `tests/e2e/games.spec.ts` and `tests/integration/authz.test.ts`: "Navn på spillet", "Lag spill", the empty states, "Utkast", "Sist endret {dato}" in nb-NO, "Brødsmulesti", "Vi finner ikke dette spillet." and "Fikk ikke hentet spillene dine. Last inn siden på nytt." are the literal bokmål strings (Story 1.4).
- `tests/unit/errors.test.ts`: `NOT_FOUND` and `WRONG_STATE` have their bokmål messages (Story 1.4).
- `tests/e2e/delete.spec.ts`: the delete flow uses the literal bokmål strings "Slett spillet", "Slette «{title}»?", "Spørsmål, lenker, svar, brett og poeng slettes for godt.", "Avbryt", "Slett for godt", "«{title}» er slettet.", "Fikk ikke kontakt. Sjekk nettet og prøv igjen." and, for a stale delete, "Vi finner ikke dette spillet." (Story 1.5).
- Pending: every story that builds a screen.

## NFR-8

Secrets.

- `tests/integration/env.test.ts`: `.env.example` keys equal `env.ts` keys; invalid values throw naming keys only.
- `tests/integration/db.test.ts`: a bad `DATABASE_URL` and a DB failure never echo the URL or the error message.
- Pending: Story 7.4.

## UX

Design and experience rules from `DESIGN.md` and `EXPERIENCE.md` that no FR covers.

- `tests/unit/design-tokens.test.ts`: `globals.css` declares every DESIGN.md color, type size (with line-height, weight and letter-spacing companions) and radius under the same name and value, and resets Tailwind's default colors and sizes (Story 1.2, UX-DR1).
- `tests/e2e/visual-foundation.spec.ts`: Bricolage Grotesque is served from `/_next/static/`, no request leaves localhost, body uses the system UI stack and no visible text is below 14 px (UX-DR1); the landing page has one `<h1>`, one sentence and the two links (UX-DR28, NFR-7); an unknown URL returns 404 with "Siden finnes ikke.", the page title "Siden finnes ikke – Toppsvar" and a "Til forsiden" link, inside the Host chrome with a working skip link (UX-DR15, UX-DR23); a client route change moves focus to the `<h1>`, and "Logg ut" submits to `/` (UX-DR15); no visible text below 14 px on the 404 page either (UX-DR1).
- `tests/unit/error-pages.test.ts`: `error.tsx`, `global-error.tsx` and `spill/error.tsx` render one `<h1>` with "Noe gikk galt hos oss. Prøv igjen om litt.", the `<title>` "Noe gikk galt – Toppsvar" and a "Prøv igjen" button; the first two sit inside the Host chrome, `spill/error.tsx` brings no chrome because the signed-in spill layout supplies it, and `global-error.tsx` has its own `<html lang="nb">` (UX-DR23). Rendered, not e2e, because no production route can throw on demand.
- `tests/unit/error-pages.test.ts`: `error.tsx` and `global-error.tsx` show no nav, "Mine spill" or "Logg ut", because a client component cannot read the session cookie (Story 1.3, UX-DR15).
- `tests/e2e/visual-foundation.spec.ts`: the 404 page shows the nav with "Mine spill" and "Logg ut", and a "Mine spill" link in the body, only with a session cookie, and the wordmark links to `/` when signed out and `/spill` when signed in; every stop in the signed-in Host chrome shows the focus ring (NFR-6); "Logg ut" runs signed in; the focus test follows the real "Logg inn" link from `/` (Story 1.3, UX-DR15).
- `tests/e2e/auth.spec.ts`: both forms use `autocomplete` `email` and `new-password`/`current-password` with visible labels (UX-DR28); a pending login shows "Logger inn …" with `aria-busy="true"` and sends exactly one request despite a second click and Enter (UX-DR2); a failed request shows "Fikk ikke kontakt. Sjekk nettet og prøv igjen." and keeps the email; after a failed login the email stays, the password is cleared and focus moves to the error notice (Story 1.3, AC6).
- `tests/unit/game-state.test.ts`: the seven states in chain order, `INITIAL_STATE` _draft_, `TRANSITIONS` exactly the six forward edges, `canTransition` over all 49 pairs, every state permits `deleteGame` and _played_ permits nothing else (Story 1.4, AC4, AD-4).
- `tests/integration/game-state.test.ts`: `transition` succeeds on a chain edge, and a skipped or backward edge is `WRONG_STATE` with the state unchanged (the 49 pairs are covered by the unit test on `canTransition`, which `transition` checks first); a stale `from` is `WRONG_STATE`; `transition` never touches `updated_at`; `lockForMutation` is `NOT_FOUND` for a missing or malformed ID and `WRONG_STATE` outside `states` without touching `updated_at`; with `hostId` it sets `updated_at` to now, without it or with `touch: false` (the delete path) it leaves it (fake `Date`); the row's `xmax` turns non-zero after the lock, proving `FOR UPDATE` on PGlite; walking `PERMITTED`, every operation locks exactly in its permitted states (Story 1.4, AC4, AD-4, AD-23).
- `tests/integration/authz.test.ts`: with the `game` table dropped, `/spill` still renders the create form and the danger notice "Fikk ikke hentet spillene dine. Last inn siden på nytt.", and the boundary logs one `games`/`listOwned` line with only `module`, `op`, `code` and `sqlstate` (Story 1.4, UX-DR23, AD-17).
- `tests/e2e/games.spec.ts`: with the Game page's RSC request held 1.5 s, the `loading.tsx` skeleton (no `<h1>`) appears after 300 ms, without a fade, and the streamed `<h1>` takes focus once it arrives, resolving Story 1.2's deferred `RouteFocus` gap (Story 1.4, UX-DR15, UX-DR23).
- `tests/e2e/games.spec.ts`: an aborted create request shows "Fikk ikke kontakt. Sjekk nettet og prøv igjen.", focuses that notice, keeps the typed title and stays on `/spill` (Story 1.4, UX-DR23).
