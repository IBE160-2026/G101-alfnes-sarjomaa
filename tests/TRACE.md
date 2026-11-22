# Test trace

Maps every Stage 1 FR, and the NFRs the stories so far touch, to the tests or manual checks that prove it. Test titles start with the ID they prove. `tests/unit/trace.test.ts` fails if a Stage 1 FR heading is missing.

Each story adds its rows here. "Pending" names the stories whose acceptance criteria will add coverage.

## FR-1

Host account.

- `tests/unit/password.test.ts`: the scrypt string carries `N=131072, r=8, p=1`, a 16-byte salt and a 32-byte key and never the password; verify accepts the right password and rejects a wrong or malformed string; `DUMMY_HASH` has the same parameters; at most two scrypt runs at a time (Story 1.3, AC1).
- `tests/unit/account-schema.test.ts`: 9/10/256/257-character passwords with the exact messages, passwords never trimmed, email trimmed and validated, login messages (Story 1.3, AC1).
- `tests/integration/auth.test.ts`, through the Server Actions and `requireHost`: only the scrypt string is stored; a too-short or too-long password creates no Host and runs no scrypt; unknown email and wrong password give one identical `INVALID_CREDENTIALS`, the unknown email running exactly one scrypt; an over-long login password runs none; lockout at the fifth failure for 60 s, doubling to 120 s, refusing the right password while locked and resetting on success (controlled clock); a wrong password while locked changes neither the count nor the lock; a lock set while a right-password login waits for scrypt refuses it and creates no session; the cookie is `httpOnly`, `SameSite=Lax`, 1 209 600 s, not `Secure` on http; the DB holds only `sha256(token)`; `expires_at` is untouched after 30 min and extended after 2 h; a session unused for 14 days redirects to `/logg-inn?utlopt=1` and is deleted; no or unknown cookie redirects to `/logg-inn`; the same email in another case is `EMAIL_TAKEN`; a code is ignored without `REGISTRATION_CODE`; logout deletes row and cookie (Story 1.3, AC1–AC4).
- `tests/integration/proxy.test.ts`: `src/proxy.ts` re-sets the session cookie on a GET with `Max-Age=1209600`, `HttpOnly` and `SameSite=Lax`, and sets nothing on a POST or a GET without the cookie (Story 1.3, AC3).
- `tests/integration/auth-secure-and-code.test.ts`: `APP_BASE_URL=https://…` makes the cookie `Secure`; with `REGISTRATION_CODE` set a missing or wrong code is `REGISTRATION_CODE_WRONG` before any scrypt run and creates no Host, the right code registers, and `/registrer` renders a field labelled "Registreringskode" (Story 1.3, AC3, AC4). Not e2e, because the e2e server runs with the code unset.
- `tests/e2e/auth.spec.ts`: register, log out and log in again each land on "Mine spill", and `/spill` after logout redirects to `/logg-inn`; a second registration with the same email shows the taken message; wrong password and unknown email both show "Feil e-post eller passord."; no "Registreringskode" field; `/logg-inn?utlopt=1` shows the expiry notice; a GET with the session cookie re-sets it with `Max-Age=1209600`, `HttpOnly`, `SameSite=Lax` (Story 1.3, AC2–AC4).
- Pending: Stories 1.4, 2.3.

## FR-2

Create and list Games.

- None yet.
- Pending: Story 1.4.

## FR-3

Delete a Game.

- None yet.
- Pending: Stories 1.5, 2.3, 4.3, 6.4.

## FR-4

Write and edit Questions.

- None yet.
- Pending: Stories 2.1, 2.2.

## FR-5

Create Invite links.

- None yet.
- Pending: Story 2.2.

## FR-6

Answer through an Invite link.

- None yet.
- Pending: Stories 2.3, 2.4, 2.5.

## FR-7

Change a submitted Answer set.

- None yet.
- Pending: Stories 2.4, 2.5.

## FR-8

Collection progress.

- None yet.
- Pending: Story 2.6.

## FR-9

Revoke and replace an Invite link.

- None yet.
- Pending: Stories 2.3, 2.7.

## FR-10

Close Collection.

- None yet.
- Pending: Stories 2.3, 3.1.

## FR-11

No identity in the answering flow.

- `tests/unit/log.test.ts`: `log.ts` writes only `module`, `op`, `code` and `sqlstate`, and drops every other field at runtime (Story 1.1, AD-17).
- `tests/unit/errors.test.ts`: every `ErrorCode` has a bokmål message; `toFailure` gives the AD-17 shape and turns any other error into `INTERNAL` without its message (Story 1.3, AC5).
- `tests/integration/auth-internal.test.ts`: with the `host` and `session` tables dropped, the login action returns `INTERNAL` and stderr holds one JSON line with only `module`, `op`, `code` and `sqlstate`, and neither the email nor the password; `register` returns `INTERNAL`, not `EMAIL_TAKEN`, with one `register` line; `requireHost` with a cookie rejects with `INTERNAL` and one `requireHost` line; logout still deletes the cookie (Story 1.3, AC5).
- Pending: Stories 2.3, 2.4, 3.2, 3.3, 6.5.

## FR-12

Nothing linkable in the Host's view.

- None yet.
- Pending: Stories 2.2, 2.5, 2.6, 3.3, 4.3, 5.1.

## FR-13

Unlinkable storage after close.

- None yet.
- Pending: Stories 3.1, 3.2, 5.5.

## FR-14

Honest anonymity notice.

- None yet.
- Pending: Stories 2.4, 7.4.

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

- `tests/unit/guards.test.ts`: Vitest rejects non-local sockets, keeps localhost, runs the mock Judge with no key.
- `tests/e2e/smoke.spec.ts`: the browser aborts requests to any host but localhost.
- `tests/integration/db.test.ts`: each integration file gets a fresh `pglite://:memory:` database.
- Pending: every story with unit or integration proof.

## NFR-6

Accessibility (WCAG 2.1 AA).

- `tests/e2e/visual-foundation.spec.ts`: axe with its default rules finds no serious or critical violations on `/` and the 404 page; Tab reaches every interactive element on both and each shows the `focus` ring (3 px `focus-ring`); the landing links and Host chrome controls are at least 44 px high (Story 1.2).
- `tests/e2e/auth.spec.ts`: axe finds no serious or critical violations on `/registrer` and `/logg-inn`, before and with field errors shown, and on `/spill`; Tab reaches every interactive element on both form pages, each shows the focus ring and is at least 44 px high; a too-short password sets `aria-invalid="true"`, links helper and error through `aria-describedby` and moves focus to the field (Story 1.3, AC6).
- Pending: every story that builds a screen.

## NFR-7

Norwegian bokmål interface.

- `tests/e2e/visual-foundation.spec.ts`: the landing page reads "Toppsvar", "Logg inn" and "Opprett konto"; an unknown URL reads "Siden finnes ikke." with "Hopp til innhold" in the Host chrome (Story 1.2), plus "Mine spill" and "Logg ut" when signed in (Story 1.3).
- `tests/unit/error-pages.test.ts`: `error.tsx` and `global-error.tsx` read "Noe gikk galt hos oss. Prøv igjen om litt." (Story 1.2).
- `tests/e2e/auth.spec.ts`: "Opprett konto", "Logg inn", "Mine spill", the labels "E-post" and "Passord", the helper "Minst 10 tegn.", the cross-links and every error and notice sentence are the literal bokmål strings (Story 1.3).
- Pending: every story that builds a screen.

## NFR-8

Secrets.

- `tests/integration/env.test.ts`: `.env.example` keys equal `env.ts` keys; `.gitignore` covers `.env*` except `.env.example`; invalid values throw naming keys only.
- `tests/integration/db.test.ts`: a bad `DATABASE_URL` and a DB failure never echo the URL or the error message.
- Pending: Story 7.4.

## UX

Design and experience rules from `DESIGN.md` and `EXPERIENCE.md` that no FR covers.

- `tests/unit/design-tokens.test.ts`: `globals.css` declares every DESIGN.md color, type size (with line-height, weight and letter-spacing companions) and radius under the same name and value, and resets Tailwind's default colors and sizes (Story 1.2, UX-DR1).
- `tests/e2e/visual-foundation.spec.ts`: Bricolage Grotesque is served from `/_next/static/`, no request leaves localhost, body uses the system UI stack and no visible text is below 14 px (UX-DR1); the landing page has one `<h1>`, one sentence and the two links (UX-DR28, NFR-7); an unknown URL returns 404 with "Siden finnes ikke." inside the Host chrome with a working skip link (UX-DR15, UX-DR23); a client route change moves focus to the `<h1>`, and "Logg ut" submits to `/` (UX-DR15); no visible text below 14 px on the 404 page either (UX-DR1).
- `tests/unit/error-pages.test.ts`: `error.tsx` and `global-error.tsx` render one `<h1>` with "Noe gikk galt hos oss. Prøv igjen om litt." inside the Host chrome, and `global-error.tsx` has its own `<html lang="nb">` (UX-DR23). Rendered, not e2e, because no production route can throw on demand.
- `tests/unit/error-pages.test.ts`: `error.tsx` and `global-error.tsx` show no nav, "Mine spill" or "Logg ut", because a client component cannot read the session cookie (Story 1.3, UX-DR15).
- `tests/e2e/visual-foundation.spec.ts`: the 404 page shows the nav with "Mine spill" and "Logg ut" only with a session cookie, and the wordmark links to `/` when signed out and `/spill` when signed in; every stop in the signed-in Host chrome shows the focus ring (NFR-6); "Logg ut" runs signed in; the focus test follows the real "Logg inn" link from `/` (Story 1.3, UX-DR15).
- `tests/e2e/auth.spec.ts`: both forms use `autocomplete` `email` and `new-password`/`current-password` with visible labels (UX-DR28); a pending login shows "Logger inn …" with `aria-busy="true"` and sends exactly one request despite a second click and Enter (UX-DR2); a failed request shows "Fikk ikke kontakt. Sjekk nettet og prøv igjen." and keeps the email; after a failed login the email stays, the password is cleared and focus moves to the error notice (Story 1.3, AC6).
