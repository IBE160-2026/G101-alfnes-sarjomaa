---
title: 'Story 1.3: Host registration, login, logout and sessions'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'd6c210218fcc8008f545cd988a42624d737d1755'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Toppsvar has no accounts: `/registrer`, `/logg-inn` and `/spill` are 404s, "Logg ut" only redirects, and the Host chrome shows "Mine spill"/"Logg ut" to everyone. Every later story needs `auth.requireHost()`, the `ErrorCode`/action result shape, and the Button, TextField and Notice components.

**Approach:** Add the `host` and `session` tables and an `auth` module (scrypt passwords with a concurrency cap and dummy hash, lockout, hashed DB sessions in an `httpOnly` cookie, sliding 14-day expiry), the shared error boundary, the two forms and a minimal `/spill`, and resolve the two `shortcut:` comments Story 1.2 left. Story 1.3's six ACs in `epics.md` (repeated below) are the contract; AD-5, AD-6, AD-17 and AD-21 in the architecture spine govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes the `ponytail` skill (level `full`), then `impeccable` (its launcher is not installed: follow its "Launcher unavailable" path, and read `reference/craft-floor.md` right before any UI edit). DESIGN.md and EXPERIENCE.md win over the skills. Ponytail never cuts a requirement here: validation, error handling, security, accessibility and the tests below are all required.
- **Passwords:** 10 to 256 characters, never trimmed. `node:crypto` scrypt, `N=131072 (2^17), r=8, p=1`, 16-byte random salt, 32-byte key, `maxmem` raised to fit (≥ 256 MiB). Stored string carries the params, e.g. `scrypt$131072$8$1$<salt b64>$<key b64>`; verification reads the params from the string and compares with `timingSafeEqual`. At most 2 scrypt runs at a time per process (a small in-process semaphore; extra calls wait). An unknown email is verified against one fixed `DUMMY_HASH` constant (a real scrypt string with the same params, committed as a literal) so it costs the same.
- **Lockout:** `host.failed_logins` +1 per wrong password. From the 5th failure, `locked_until = now + 60 s × 2^(failed_logins − 5)`, capped at 24 h. While `locked_until > now`, every login is refused with the generic message (the password is still verified for equal timing, and the counter does not grow). A correct password after the lock resets `failed_logins = 0, locked_until = null`. All times come from JS `new Date()`, never SQL `now()`, so `vi.setSystemTime` controls them.
- **Sessions:** token = 32 random bytes, base64url, in cookie `toppsvar_session`: `httpOnly`, `sameSite: "lax"`, `path: "/"`, `maxAge` 1 209 600 s (14 days), `secure` exactly when `env.APP_BASE_URL` starts with `https:`. The `session` row stores only `sha256(token)` (hex) as primary key, `host_id`, `expires_at`. `getSession` rejects a row with `expires_at <= now`, and when `expires_at < now + 14 d − 1 h` (last extension over an hour ago) sets `expires_at = now + 14 d`. Logout deletes the row and the cookie.
- **Cookie sliding:** `src/proxy.ts` re-sets an existing `toppsvar_session` cookie with the same options on every GET it matches, so the browser copy also lives 14 days from last use. It makes no auth decision, never touches the DB, skips non-GET requests (so it never races the login/logout `Set-Cookie`), and its matcher excludes `/_next/`, `/api/`, `/svar` and static files.
- **Error shape (AD-17):** `src/lib/errors.ts` has a closed `ErrorCode` union with one bokmål message each: `INVALID_INPUT` "Sjekk feltene som er merket, og prøv igjen.", `INVALID_CREDENTIALS` "Feil e-post eller passord.", `EMAIL_TAKEN` "Det finnes allerede en konto med denne e-posten.", `REGISTRATION_CODE_WRONG` "Registreringskoden stemmer ikke.", `INTERNAL` "Noe gikk galt hos oss. Prøv igjen om litt." Add no other codes (later stories add theirs). `DomainError(code, fieldErrors?)`; `ActionResult<T> = { ok: true; data: T } | { ok: false; code; message; fieldErrors? }`. Entry points run inside a boundary that turns any non-`DomainError` into `DomainError("INTERNAL")` (no cause, no message) after `log({ module: "auth", op, code: "INTERNAL", sqlstate })`. Actions never throw to Next except Next's own `redirect()`.
- **Validation (zod 4, `src/lib/account.ts`):** register: email trimmed, valid email ("Skriv en gyldig e-postadresse."), at most 254 chars; password min 10 "Passordet må ha minst 10 tegn.", max 256 "Passordet kan ha maks 256 tegn."; `registrationCode` string. Login: email trimmed non-empty ("Skriv e-postadressen din."), password non-empty ("Skriv passordet ditt."); a login password over 256 chars returns `INVALID_CREDENTIALS` without hashing. Email is stored trimmed as typed; lookup and uniqueness use `lower(email)` (unique index). A duplicate (SQLSTATE 23505, also under a race) becomes `EMAIL_TAKEN` with `fieldErrors.email`. With `REGISTRATION_CODE` set, a missing or wrong code is `REGISTRATION_CODE_WRONG` with `fieldErrors.registrationCode`, checked before hashing, compared via `timingSafeEqual` on sha256 digests.
- **Layers:** limits only in `src/lib/limits.ts` (password 10/256, email 254, session 14 d, extend 1 h, lockout 5 / 60 s / 24 h, scrypt concurrency 2). Every `src/server` file starts with `import "server-only"`. `auth.register`/`auth.logIn` open their own transaction where they write more than one row; exported writers take `tx` first. Actions in `src/app/registrer/actions.ts` and `src/app/logg-inn/actions.ts` (`"use server"`), each with a sibling `schema.ts` holding the FormData shape (string fields); the entry point re-validates with `src/lib/account.ts`. Both redirect to `/spill` on success.
- **UI strings (literal):** `/registrer` h1 "Opprett konto", button "Opprett konto" / pending "Oppretter konto …"; `/logg-inn` h1 "Logg inn", button "Logg inn" / pending "Logger inn …"; labels "E-post", "Passord", "Registreringskode"; helper under the register password "Minst 10 tegn."; network failure "Fikk ikke kontakt. Sjekk nettet og prøv igjen."; expired notice (info) "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen."; `/spill` h1 "Mine spill". Cross-links: under the login form "Har du ikke konto? <Opprett konto>" → `/registrer`, under the register form "Har du allerede konto? <Logg inn>" → `/logg-inn`. Bokmål, "du", no exclamation marks or emoji.
- **Inputs:** `autocomplete` `email` on both email fields, `new-password` on register, `current-password` on login, `type="email"`/`"password"`, `inputMode` default. Forms use `noValidate` so our messages, not browser bubbles, show.
- **Components (DESIGN.md → Components, EXPERIENCE.md → Component Patterns):** `Button` — native `<button>`, variants `primary` and `ghost` only (others arrive with the stories that use them), min 44 px, padding 16 px horizontal, radius `md`, `text-title` on primary. Pending: `aria-busy="true"`, repeat clicks and Enter ignored while pending (no `disabled`, so focus stays); after 300 ms the label becomes the pending verb with a 16 px `aria-hidden` spinner left of it (static under `prefers-reduced-motion`), width locked so the button does not jump. `TextField` — visible `<label>` above (`text-label`), input 48 px min height, 16 px text, `surface` fill, 1 px `line-strong` border, radius `sm`; helper below in `text-body-sm ink-muted`; on error 2 px `danger` border, `aria-invalid="true"`, error text in `danger` below with a visually hidden "Feil: " prefix; `aria-describedby` lists helper and error ids. `Notice` — tones `info` (`primary-soft`/`ink`, `role="status"`) and `danger` (`danger-soft`/`danger`, `role="alert"`, only for errors from a user action); full width, padding 16 px, radius `md`; never auto-dismisses.
- **Form behavior:** one client component `src/components/AccountForm.tsx` serves both pages (`mode: "register" | "login"`, `askCode: boolean` from the server page). Uses `useActionState` with a wrapper that catches a failed action call and returns the network message, but rethrows Next's control-flow errors first (`unstable_rethrow` from `next/navigation`) — a redirecting action rejects on the client with a redirect error that must propagate. The typed email survives a failed submit; the password is cleared. After a failed submit, focus moves to the first invalid field, or to the danger Notice (`tabIndex={-1}`) when there are no field errors. Validation runs on submit only, never per keystroke.
- **Pages:** `/registrer` and `/logg-inn` are public (no Host top bar, no skip link): one `<main>` like the landing (max 560 px, same vertical rhythm), a "Toppsvar" wordmark link to `/` above the one `<h1>`, then the Notice slot, form and cross-link. `/logg-inn?utlopt=1` shows the info Notice above the form. `/spill` calls `auth.requireHost()` and renders `HostChrome` (signed in) with `<h1>Mine spill</h1>` only; Story 1.4 adds the list.
- **`auth.requireHost()`:** reads the cookie; no cookie or no row → `redirect("/logg-inn")`; expired row → delete it and `redirect("/logg-inn?utlopt=1")`; else returns `{ hostId }` (after the hourly extension). It runs no proxy logic and works in pages and actions.
- **Host chrome (resolves 1.2 shortcut):** `HostChrome` takes `signedIn: boolean`. Only when true does it render the `nav` with "Mine spill" and the "Logg ut" form (styled as the `ghost` Button). `/spill` passes `true`; root `not-found.tsx` passes `await auth.hasSessionCookie()` (cookie present, no DB read, so the 404 still renders with the DB down); `error.tsx` and `global-error.tsx` pass `false` (client components cannot read an httpOnly cookie). Wordmark and skip link stay in every case.
- **Logout (resolves 1.2 shortcut):** `logOut` in `src/app/actions.ts` calls `auth.logOut()` (delete row by hash, delete cookie; a DB failure is logged and the cookie is still deleted), then `redirect("/")`.
- **`sqlstateOf`** moves from `src/app/api/health/route.ts` to the shared boundary module; the health route imports it (same behavior, its tests stay green).
- Test titles start with the FR/NFR/UX ID they prove; `tests/TRACE.md` gets this story's rows (FR-1, FR-11, NFR-6, NFR-7, UX) and FR-1's "Pending" drops 1.3. Each e2e test registers its own Host with a unique email on `example.test`. Slow scrypt tests set an explicit timeout (e.g. 30 s), not weaker params.

**Never:**
- No new dependency, no auth library, no `bcrypt`/`argon2` native module, no JWT, no client-readable session data, no password or token in any log, error message, URL or DB column other than the hash.
- No auth decision in `src/proxy.ts`; no auth code or proxy work under `/svar`.
- No Game list, `game` table, `NOT_FOUND` code, breadcrumb, ConfirmDialog or StatusBadge (Story 1.4/1.5); no Demo-mode login hint (Story 7.1); no password reset, email verification, "remember me", or redirect-back `next` parameter; no redirect of logged-in visitors away from `/`, `/registrer`, `/logg-inn`.
- No test-only route, env switch or weaker scrypt params in production code.
- Do not edit `.logs/`, `prompting/`, or the intent contract of this spec.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Register OK | new email, 10–256 char password | `host` row with scrypt string, session row + cookie, redirect `/spill` | — |
| Password too short / too long | 9 or 257 chars | no row; `INVALID_INPUT`, `fieldErrors.password` "Passordet må ha minst 10 tegn." / "Passordet kan ha maks 256 tegn." | field `aria-invalid`, focus moves there |
| Duplicate email | same email, other case/whitespace | `EMAIL_TAKEN`, "Det finnes allerede en konto med denne e-posten." on the email field | 23505 mapped, never `INTERNAL` |
| Code required | `REGISTRATION_CODE=x`, code missing or `y` | field "Registreringskode" shown; `REGISTRATION_CODE_WRONG` "Registreringskoden stemmer ikke.", no scrypt run | — |
| Code not set | `REGISTRATION_CODE` empty | no code field; any submitted code ignored | — |
| Login OK | right email (any case) + password | new session row + cookie, `failed_logins` reset, redirect `/spill` | — |
| Unknown email / wrong password | — | both `INVALID_CREDENTIALS` "Feil e-post eller passord."; unknown email runs exactly one scrypt (dummy hash) | — |
| Lockout | 5th wrong password | `locked_until = now + 60 s`; 6th failure after it passes → +120 s; right password while locked → `INVALID_CREDENTIALS`; right password after → OK and reset | — |
| Forced DB error during login | e.g. `host` table missing | `INTERNAL` with its message; stderr has one line with only `module`, `op`, `code`, `sqlstate`, no email/password | never throws to Next |
| Session use | `expires_at` extended < 1 h ago | row unchanged | — |
| Session use | last extension > 1 h ago | `expires_at = now + 14 d` | — |
| Session expired | 14 d unused | Host page → delete row, redirect `/logg-inn?utlopt=1`, info Notice shows | — |
| No / unknown cookie | Host page | redirect `/logg-inn` (no notice) | — |
| Logout | "Logg ut" | row deleted, cookie cleared, redirect `/`; `/spill` then redirects to `/logg-inn` | DB failure: still clears cookie |
| Proxy | GET with session cookie | response re-sets cookie, `Max-Age=1209600`, `HttpOnly`, `SameSite=Lax` | POST untouched |
| Network failure | submit while the action request fails | danger Notice "Fikk ikke kontakt. Sjekk nettet og prøv igjen.", form intact | redirect still works when online |
| Pending | slow submit, clicked twice | label "Logger inn …" (after 300 ms), `aria-busy="true"`, exactly one action request | — |
| 404 anonymous / signed in | unknown URL | header + wordmark; nav ("Mine spill", "Logg ut") only with a session cookie | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- empty (`export {}`); add `host` (`id uuid pk default gen_random_uuid()`, `email text not null`, `password_hash text not null`, `failed_logins integer not null default 0`, `locked_until timestamptz`, `created_at timestamptz not null default now()`, unique index on `lower(email)` via ``uniqueIndex(...).on(sql`lower(${t.email})`)``) and `session` (`token_hash text pk`, `host_id uuid not null references host(id) on delete cascade`, `expires_at timestamptz not null`). Use `timestamp(..., { withTimezone: true, mode: "date" })`.
- `drizzle/meta/_journal.json` -- zero entries; `npm run db:generate` writes `drizzle/0000_*.sql` + snapshot (commit both, never hand-edit). PGlite applies them on first `getDb()`.
- `src/server/db/client.ts` -- `getDb()`, `Db`, `Tx`; `db.transaction(async (tx) => …)`. Integration tests share one `pglite://:memory:` DB per file (`tests/setup.ts` closes it).
- `src/server/env.ts` -- `env.APP_BASE_URL` (always set, defaults to `http://localhost:${PORT}`), `env.REGISTRATION_CODE` (undefined when empty). Parsed once at import; a test needing other values uses `vi.stubEnv` + `vi.resetModules()` + dynamic `import()`.
- `src/server/log.ts` -- `log({ module, op, code, sqlstate })`; reuse, unchanged.
- `src/app/api/health/route.ts:5` -- `sqlstateOf` lives here; move it to `src/server/boundary.ts` and import it back.
- `src/app/actions.ts` -- `logOut()` with the 1.2 `shortcut:` comment; make it real, drop the comment.
- `src/components/HostChrome.tsx` -- `control` class, nav, `<form action={logOut}>`, 1.2 `shortcut:` comment; add `signedIn`, drop the comment. Used by `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx` (the last two are `"use client"`).
- `src/app/page.tsx` -- landing layout to mirror on the two form pages (`max-w-140 px-4 py-24 sm:py-32`, link button classes).
- `src/app/globals.css` -- tokens (`bg-surface`, `border-line-strong`, `text-danger`, `bg-danger-soft`, `bg-primary-soft`, `text-ink-muted`, `text-label`, `text-body-sm`, `text-title`, `rounded-sm`, `rounded-md`), global focus ring; no new tokens needed.
- `src/components/RouteFocus.tsx` -- moves focus to the `<h1>` on client route change; the redirect after login is a client route change, so `/spill`'s h1 gets focus.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` -- Next 16 `src/proxy.ts` convention (`export function proxy(request)`, `config.matcher`). Prefer importing the cookie name/options from `@/server/auth` (which reads `env`). If `next build` rejects `server-only` in the proxy, fall back to deriving `secure` from `request.nextUrl.protocol === "https:"` with the name/max-age from `src/lib/limits.ts`, and record the fallback in Design Notes.
- `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:237` -- a redirecting action rejects the client promise with a redirect error; hence `unstable_rethrow` in the form wrapper.
- `vitest.config.ts` -- sets all nine env keys (`REGISTRATION_CODE` empty, `APP_BASE_URL` empty); `server-only` aliased to empty. Integration tests calling actions or `requireHost` mock `next/headers` (`cookies()` → in-memory jar recording `set`/`delete` options) and `next/navigation` (`redirect` throws a recognizable error carrying the URL).
- `playwright.config.ts` -- one server on port 3100, `REGISTRATION_CODE=""`, `APP_BASE_URL=http://localhost:3100`. `tests/e2e/fixtures.ts` `test` blocks non-localhost; use it.
- `tests/e2e/visual-foundation.spec.ts` -- the 404 test asserts nav/"Logg ut" for an anonymous visitor, the "Logg ut submits" test runs anonymous on the 404, and the focus test uses `window.next.router.push`. All three change (see Tasks).
- `tests/unit/lint-zones.test.ts` -- already lists `src/proxy.ts` as banned from `@/server/db`; add a case that `src/server/auth/x.ts` may import `@/server/db` (layer stays enforced).
- `tests/unit/log.test.ts` -- `captureStderr` pattern to reuse for AC5.
- `tests/TRACE.md` -- FR-1 "None yet" / "Pending: Stories 1.3, 1.4, 2.3"; FR-11, NFR-6, NFR-7, UX sections exist.

## Tasks & Acceptance

**Execution:**
- `src/lib/limits.ts` -- create with the auth limits listed in Boundaries -- single home for limits
- `src/lib/errors.ts` -- `ErrorCode`, `MESSAGES`, `DomainError`, `ActionResult`, `toFailure(error)` (DomainError → its result; anything else → `INTERNAL`) -- AC5
- `src/lib/account.ts` -- `registrationSchema`, `loginSchema` with the literal messages -- AC1
- `src/server/boundary.ts` -- `sqlstateOf` (moved) and a wrapper `withBoundary(module, op, fn)` that logs and converts non-domain errors -- AC5
- `src/app/api/health/route.ts` -- import `sqlstateOf` from `@/server/boundary` -- reuse
- `src/server/db/schema.ts` + `npm run db:generate` -- `host`, `session` tables and committed migration -- AC1–AC3
- `src/server/auth/password.ts` -- `hashPassword`, `verifyPassword`, `DUMMY_HASH`, semaphore (max 2) -- AC1, AC2
- `src/server/auth/session.ts` -- token, `sha256`, cookie name/options, create/get(+hourly extend)/delete -- AC3
- `src/server/auth/index.ts` -- entry points `register`, `logIn`, `logOut`, `requireHost`, `hasSessionCookie`, plus the cookie name/options the proxy needs -- AC1–AC5
- `src/proxy.ts` -- GET-only cookie re-set, matcher per Boundaries -- AC3 (sliding 14-day cookie)
- `src/components/Button.tsx`, `src/components/TextField.tsx`, `src/components/Notice.tsx` -- per Boundaries -- AC6
- `src/components/AccountForm.tsx` -- shared client form (useActionState wrapper, focus on error, email kept) -- AC4, AC6
- `src/app/registrer/{page.tsx,actions.ts,schema.ts}`, `src/app/logg-inn/{page.tsx,actions.ts,schema.ts}` -- pages and actions; login page reads `searchParams` (a Promise in Next 16) for `utlopt` -- AC3, AC4
- `src/app/spill/page.tsx` -- `requireHost()`, HostChrome signed in, h1 "Mine spill" -- AC4
- `src/app/actions.ts`, `src/components/HostChrome.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx` -- real logout; `signedIn` prop -- 1.2 shortcuts
- `tests/unit/password.test.ts` -- hash string format and params, 16-byte salt, never contains the password, verify true/false, malformed string false, `DUMMY_HASH` parses with the same params, at most 2 concurrent runs when 5 hashes start at once (wrap `node:crypto` scrypt via `vi.mock` partial and count in-flight) -- AC1
- `tests/unit/account-schema.test.ts` -- 9/10/256/257-char boundaries with the exact messages; email trimmed and validated; login schema messages -- AC1
- `tests/unit/errors.test.ts` -- every `ErrorCode` has a non-empty message and `toFailure` gives the AD-17 shape; an unknown error becomes `INTERNAL` with no original message -- AC5
- `tests/integration/auth.test.ts` -- through the Server Actions (FormData) and `requireHost` with mocked `next/headers`/`next/navigation`: stored hash only (AC1); unknown email vs wrong password identical result, one scrypt run for unknown email (AC2); lockout with `vi.useFakeTimers({ toFake: ["Date"] })` + `setSystemTime`: 5th failure sets `locked_until` 60 s ahead, lock refuses the right password, 6th failure after expiry gives 120 s, success resets (AC2); cookie options incl. `maxAge` 1209600, `httpOnly`, `sameSite` lax, `secure` false on http; DB holds `sha256(token)` and not the token (AC3); hourly extension (30 min: unchanged; 2 h: now + 14 d) and expiry redirect to `/logg-inn?utlopt=1` with the row deleted (AC3); duplicate email in other case → `EMAIL_TAKEN` (AC4); logout deletes row and cookie -- AC1–AC4
- `tests/integration/auth-secure-and-code.test.ts` -- with `vi.stubEnv` + `vi.resetModules()`: `APP_BASE_URL=https://…` sets `secure: true`; `REGISTRATION_CODE=x`: wrong/missing code → `REGISTRATION_CODE_WRONG` with no host row, right code registers, and the `/registrer` page output (render the async page's element with `react-dom/server`) contains a field labelled "Registreringskode" -- AC3, AC4
- `tests/integration/auth-internal.test.ts` -- drop the `session` and `host` tables, call the login action: `INTERNAL` result with its message; captured stderr is exactly one JSON line with keys ⊆ `module, op, code, sqlstate` and contains neither the email nor the password -- AC5
- `tests/e2e/auth.spec.ts` -- register → lands on `/spill` with h1 "Mine spill"; "Logg ut" → `/`, then `/spill` → `/logg-inn`; log in → `/spill`; second registration with the same email shows the message; wrong password and unknown email both show "Feil e-post eller passord."; labels and `autocomplete` values; no "Registreringskode" field; too-short password → field `aria-invalid="true"` with `aria-describedby` pointing at the error text and focused; pending (delay the POST with `page.route`): button text "Logger inn …", `aria-busy="true"`, second click adds no request; network failure (`route.abort()` on the POST) shows the network message; `/logg-inn?utlopt=1` shows the info Notice; a GET with the session cookie returns `Set-Cookie` with `Max-Age=1209600`; axe has no serious/critical violations on `/registrer`, `/logg-inn` (also with errors shown) and `/spill`; every interactive element on both form pages shows the focus ring and is ≥ 44 px high -- AC2, AC3, AC4, AC6
- `tests/e2e/visual-foundation.spec.ts` -- anonymous 404: header + wordmark, no nav; signed-in 404 (register first): nav with "Mine spill" and "Logg ut"; "Logg ut" test runs signed in; focus test clicks the real "Logg inn" link on `/` and expects focus on `/logg-inn`'s h1 (remove the `window.next.router` workaround) -- 1.2 follow-ups
- `tests/unit/lint-zones.test.ts` -- add the auth→db allowed case -- AD-1
- `tests/TRACE.md` -- rows for every new test under FR-1, FR-11, NFR-6, NFR-7, UX; FR-1 pending becomes "Stories 1.4, 2.3" -- epic rule

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-1): Given a registration with a password shorter than 10 or longer than 256 characters, when it is submitted, then it is refused with "Passordet må ha minst 10 tegn." (or the upper-bound message), and an accepted password is stored only as a scrypt string carrying `N=2^17, r=8, p=1` and a 16-byte salt, never in plain text, with at most two scrypt runs at a time per process.
- AC2 (FR-1): Given a registered Host, when someone logs in with an unknown email, or with the right email and a wrong password, then both return the same code and "Feil e-post eller passord.", the unknown email is checked against the fixed dummy hash, and after five failures `locked_until` is set and doubles on further failures (controlled clock).
- AC3 (FR-1): Given a successful login, when the session is created, then the cookie is `httpOnly`, `SameSite=Lax`, `Max-Age` 14 days, `Secure` when `APP_BASE_URL` is https; the DB holds only `sha256(token)`; a session unused for 14 days is rejected with a redirect to `/logg-inn` showing "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen."; `expires_at` is extended at most once an hour.
- AC4 (FR-1, UX-DR28): Given `/registrer` and `/logg-inn` with visible labels and `autocomplete` `email`, `new-password`, `current-password`, when a visitor registers, logs out and logs in again, then they land on `/spill` (heading "Mine spill") each time, "Logg ut" ends the session, a second registration with the same email shows "Det finnes allerede en konto med denne e-posten."; with `REGISTRATION_CODE` set `/registrer` shows "Registreringskode" and a wrong code shows "Registreringskoden stemmer ikke."; without it the field is absent.
- AC5 (AD-17, FR-11): Given `src/lib/errors.ts` with a closed `ErrorCode` union and bokmål messages, and actions returning the AD-17 shape, when a forced DB error occurs during login, then the action returns `INTERNAL` and the log holds only `{ module, op, code, sqlstate }`, with no email or password.
- AC6 (NFR-6, UX-DR2–4): Given Button, TextField and Notice, when a login is pending and when a field is invalid, then the button shows "Logger inn …" with `aria-busy` and ignores repeat clicks, the invalid field has `aria-invalid` with its error linked through `aria-describedby`, and axe reports no serious or critical violations on both pages.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 41 findings — high 3, medium 2, low 33, false 3, maybe-false 0
- findings:
  - `[high]` `[patch]` Blind Hunter: parallel logins bypass the lockout because `logIn` checks a row read before the queued scrypt run — confirmed: the row is read once at the top of `logIn` and never re-read, so every request in a burst sees an unlocked row and a right password in the burst logs in. Fix: failure increment and success reset are both `UPDATE … WHERE locked_until IS NULL OR locked_until <= now RETURNING`; no row back means locked, refuse. Race test added.
  - `[low]` `[patch]` Blind Hunter: "timing reveals nothing" comment overstates — a known email with a wrong password does DB writes after scrypt, an unknown one does not. Comment reworded (scrypt cost equal, DB work not).
  - `[low]` `[patch]` Blind Hunter: scrypt wait queue unbounded, no rate limit — real, but a cap or limiter is unrequested surface; memory stays bounded at two runs. Added a `shortcut:` comment naming the limit and when to upgrade.
  - `[low]` `[reject]` Blind Hunter: a dead cookie is never cleared and the proxy keeps renewing it, so a 404 shows the nav to an expired Host — only reachable after 14 idle days, until the next login or logout, and both visible controls behave correctly; clearing it needs a route handler or action on the redirect path, which is more than a direct correction.
  - `[low]` `[reject]` Blind Hunter: expired session rows pile up; login with an existing cookie leaves the old row; no index on `session.host_id` — rows are tiny and the old token is overwritten in the only browser that held it; nothing deletes Hosts yet. Fix would add a cleanup job or index nobody asked for.
  - `[low]` `[patch]` Blind Hunter: login compares Postgres `lower(email)` with JS `toLowerCase()` — can disagree for non-ASCII. Both sides now use `lower()` in SQL.
  - `[low]` `[patch]` Blind Hunter: wordmark links to `/spill` when signed out — anonymous 404/500 visitors are bounced to `/logg-inn`. `href` is now `/` when `signedIn` is false; tests updated.
  - `[low]` `[reject]` Blind Hunter: signed-in Hosts are not redirected away from `/logg-inn` and `/registrer` — logging in again or making a second account is harmless; the redirect is new behavior no AC asks for.
  - `[low]` `[reject]` Blind Hunter: copy hard-codes 10/256/14 instead of reading `limits.ts` — the strings are literal UX-spec text; changing a limit is a spec change that rewrites the copy too.
  - `[false]` `[reject]` Blind Hunter: a field error on a field the form does not render leaves nothing visible — unreachable: `registrationCode` errors need `REGISTRATION_CODE` set, which is exactly when `askCode` renders the field, and the FormData shape schema always parses an object, so no root (`""`) issue occurs.
  - `[low]` `[patch]` Blind Hunter: TRACE.md stale (FR-11 still pending 1.3, no row for `proxy.test.ts`); matcher `svar` prefix has no boundary — TRACE rows fixed; matcher now `svar(?:/|$)`. Testing every matcher exclusion rejected: config, low.
  - `[low]` `[patch]` Blind Hunter: the logout test in `auth-internal.test.ts` depends on the previous test dropping the tables — tables now dropped in `beforeAll`.
  - `[low]` `[patch]` Blind Hunter: lockout tests skip wrong-password-while-locked, concurrency and the 24 h cap — first two added; cap test rejected (a dozen clock jumps for a guard against date overflow).
  - `[low]` `[reject]` Blind Hunter: anyone who knows an email can lock its Host out for up to 24 h — inherent to the lockout AD-6 and AC2 require; the one generic message is also mandated.
  - `[low]` `[patch]` Verification gap: `register`'s 23505-only branch never checked against another DB failure — test added: dropped tables give `INTERNAL` and one `op:"register"` log line, not `EMAIL_TAKEN`.
  - `[low]` `[patch]` Verification gap: `requireHost`'s DB-failure path untested — test added: rejects with `DomainError` `INTERNAL` and one `op:"requireHost"` log line.
  - `[low]` `[reject]` Verification gap (other): expired cookie never cleared — same as the Blind Hunter row; rejected for the same reason.
  - `[low]` `[patch]` Verification gap (other): order-dependent logout test — same patch as the Blind Hunter row.
  - `[low]` `[reject]` Intent audit: the 404 nav follows cookie presence (A2), not a validated session (A1) — the spec chose cookie presence so the 404 renders with the DB down; the cases where they differ are the rejected stale-cookie rows above.
  - `[low]` `[reject]` Intent audit: the wrong-code message is never shown rendered in a browser — the action's field error is integration-tested and the same `TextField` error rendering is e2e-tested on the password field; a second server just for this was rejected in Design Notes.
  - `[low]` `[reject]` Intent audit: expiry is tested in two halves (integration redirect, e2e notice), never joined — joining needs server-side clock control in e2e, which is test code in production; AC3 is tagged integration.
  - `[low]` `[reject]` Intent audit: the login response's own `Set-Cookie` header is never asserted, only the options passed to `cookies().set` — options to header is Next's code; the real header shape is asserted on the proxy response.
  - `[low]` `[patch]` Intent audit: wrong passwords while locked untested — same patch as the Blind Hunter lockout-tests row.
  - `[low]` `[reject]` Intent audit: the proxy imports `@/server/auth`, which pulls in the DB client indirectly past the direct-import lint ban — the client opens lazily and the proxy never calls it (Design Notes); importing a module internal instead would break the index-as-surface convention.
  - `[false]` `[reject]` Intent audit: unrequested surface (smoke project ordering, `sqlstateOf` move, 300 ms pending delay) — the smoke ordering keeps an existing test valid, the `sqlstateOf` move is named in epic-1-context, and the 300 ms delay is EXPERIENCE.md's loading rule.
  - `[high]` `[patch]` Edge Case Hunter: parallel wrong-password requests read the row before `locked_until` is set, so the lockout is bypassed — same patch as the first Blind Hunter row.
  - `[medium]` `[patch]` Edge Case Hunter: failures at counts 5 and 6 can finish their `locked_until` writes out of order, so a 60 s lock overwrites 120 s — confirmed (two separate writes); now `locked_until = greatest(locked_until, until)`.
  - `[low]` `[reject]` Edge Case Hunter: `requireHost` leaves the browser cookie on missing/expired — same as the stale-cookie row; a server component cannot delete cookies.
  - `[low]` `[reject]` Edge Case Hunter: the 404 shows the nav for a stale cookie — same as above.
  - `[low]` `[reject]` Edge Case Hunter: a GET or prefetch with an old token answering after the login POST overwrites the new cookie — needs a stale cookie and a GET started before the login response but answered after it, while prefetches fire on mount, seconds before a submit; fix adds header branches to the proxy.
  - `[low]` `[reject]` Edge Case Hunter: the session can expire up to 1 h before 14 idle days — inherent to "extended at most once an hour" (AD-6, AC3); any grace shifts the error to the other side.
  - `[medium]` `[patch]` Edge Case Hunter: `/registrer` reads `REGISTRATION_CODE` in a page Next may prerender — dynamic today only because `not-found.tsx` reads cookies; a build-time snapshot would hide the field while the action requires it. Added `await connection()`.
  - `[false]` `[reject]` Edge Case Hunter: field errors on a field not rendered are silent — same refutation as the Blind Hunter row.
  - `[low]` `[patch]` Edge Case Hunter: wordmark still links to `/spill` when signed out — same patch as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: login or registration with a valid session cookie leaves the old row valid — the browser's cookie is replaced, so no one holds the old token.
  - `[low]` `[reject]` Edge Case Hunter: expired session rows pile up — same as the Blind Hunter row.
  - `[low]` `[patch]` Edge Case Hunter: matcher `svar` has no boundary — same patch as the Blind Hunter TRACE/matcher row.
  - `[low]` `[patch]` Edge Case Hunter: order-dependent logout test — same patch as the Blind Hunter row.
  - `[low]` `[patch]` Edge Case Hunter (deletion): removing the anonymous 404 nav assertions left the ghost "Logg ut" button and "Mine spill" link with no focus-ring coverage — signed-in focus-ring test on `/spill` added.
  - `[low]` `[reject]` Edge Case Hunter (claim): Hosts logged out before 14 idle days — same as the 1 h row; inherent to hourly extension.
  - `[high]` `[patch]` Edge Case Hunter (claim): concurrent guesses ignore the lock — same patch as the first Blind Hunter row.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the implementer** after review: the lockout read a stale row, so parallel guesses bypassed it (the implementer's "atomic counter" fixed only lost increments); `locked_until` writes could overwrite a longer lock; `/registrer` read env in a page that could be prerendered; the logout DB-failure test depended on test order; no tests covered `register`/`requireHost` with the DB down, the proxy's POST skip, or a wrong code running no scrypt (the last three the orchestrator added itself before review).
- **Implementer corrected the spec:** the smoke spec had to run first (it asserts an unopened DB), and `Tx` needed Drizzle's relations type parameter once tables existed. Both accepted and recorded in Design Notes.
- **Reviewer suggestions rejected:** clearing stale cookies through a route handler, a session cleanup job and `host_id` index, redirecting signed-in Hosts away from the forms, reading copy numbers from `limits.ts` (literal UX strings), a second e2e server for `REGISTRATION_CODE`, joining the expiry test end to end, prefetch-header checks in the proxy, and a grace period on expiry. Each adds code or surface for a case that is rare, harmless or excluded by AD-6 (reasons above).

## Design Notes

- **Why a proxy at all.** `Max-Age` 14 days is fixed at login, so without a refresh an active Host would still be logged out 14 days after logging in, which contradicts "dies after 14 days unused". A server component cannot set cookies, so the only per-request place is `src/proxy.ts` (the pattern Next's own auth guide uses for "updating sessions"). The DB `expires_at` stays the authority; the proxy only keeps the browser copy alive and never decides access. The browser cookie can outlive the DB row by at most an hour, in which case the Host sees the expiry notice, which is correct.
- **`REGISTRATION_CODE` present is proven by integration, not e2e.** The e2e server runs once with the code unset, and a second server would need a second build or a non-portable shell background job. The code-present branch (field shown, wrong code refused) is tested at the action and page-render level with a stubbed env; the code-absent branch is e2e. Same reasoning as Story 1.2's 500 page.
- **Expired versus unknown session.** Only a row that still exists but has passed `expires_at` gives the notice; `requireHost` deletes it, so a reload afterwards is a plain redirect. A cookie with no row (logged out elsewhere, deleted) gives no notice, because it is indistinguishable from never having logged in.
- **Error focus without a summary.** EXPERIENCE.md's error-summary variant is built for the answer form (Story 2.4). These forms have two or three fields, so focus goes to the first invalid field or to the danger Notice; both are announced.
- **Proxy imports `@/server/auth` directly.** `next build` accepted `server-only` in `src/proxy.ts`, so the fallback (secure from `request.nextUrl.protocol`) was not needed. The proxy only reads `SESSION_COOKIE` and `sessionCookieOptions`; the DB client opens lazily and is never called.
- **Smoke spec runs first.** `smoke.spec.ts` asserts the PGlite directory does not exist before `/api/health`, and Playwright runs files in parallel workers, so a spec that registers a Host could open the DB first. `playwright.config.ts` now has a `smoke` project that the `chromium` project depends on.
- **Lockout counter.** The failed-login increment is one atomic `failed_logins + 1 … returning`, so two concurrent wrong passwords cannot both write the same count.
- **Lockout timing.** While locked, the password is still verified so a locked account answers as slowly as an open one, and the counter does not grow, so an attacker cannot push a lock out indefinitely from one burst. The 24 h cap only prevents a date overflow after many failures.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline (existing 149 plus the new tests)
- `npm run test:e2e` -- expected: smoke, visual-foundation and auth specs pass
- `npx drizzle-kit check` and a second `npm run db:generate` -- expected: no new migration, `git status drizzle/` clean after the first commit of it

**Manual checks:**
- `npm run dev`: register, see "Mine spill", log out, log in; screenshots of `/registrer` and `/logg-inn` at 1280 and 375 px, with and without errors, look like DESIGN.md (paper background, surface inputs, berry primary button, no gradients or shadows).

## Auto Run Result

Status: done

**Summary.** Hosts can register at `/registrer`, log in at `/logg-inn`, log out from the top bar, and land on a minimal `/spill` ("Mine spill"). Passwords are hashed with `node:crypto` scrypt (`N=2^17, r=8, p=1`, 16-byte salt, params in the string), with at most two runs per process and a fixed dummy hash for unknown emails. Lockout starts at the fifth failure, doubles from there (capped at 24 h), and holds under parallel attempts. Sessions are 32-byte tokens in an `httpOnly`, `SameSite=Lax` cookie (14 days, `Secure` on https). The DB stores only `sha256(token)`, extends `expires_at` at most hourly, and an expired session redirects to `/logg-inn?utlopt=1` with the notice. `src/proxy.ts` keeps the browser cookie alive 14 days from last use without deciding access. `src/lib/errors.ts` holds the closed `ErrorCode` union and the AD-17 result shape, and a shared boundary turns unexpected errors into `INTERNAL` with a four-field log line. Button, TextField, Notice and one `AccountForm` serve both pages. Both Story 1.2 shortcuts are resolved: real logout, and the nav shows only with a session cookie. The 1.2 focus test now clicks the real "Logg inn" link.

**Files.**
- `src/lib/errors.ts`, `src/lib/limits.ts`, `src/lib/account.ts`: error codes and result shape, auth limits, zod schemas with the literal messages.
- `src/server/boundary.ts`: `sqlstateOf` (moved from the health route) and `withBoundary`.
- `src/server/db/schema.ts`, `drizzle/0000_stiff_the_executioner.sql` + meta: `host` and `session` tables; `src/server/db/client.ts`: `Tx` type fixed for real tables.
- `src/server/auth/{index,password,session}.ts`: entry points, scrypt with semaphore and dummy hash, sessions.
- `src/proxy.ts`: GET-only cookie refresh.
- `src/components/{Button,TextField,Notice,AccountForm}.tsx`, `src/components/HostChrome.tsx`: shared components; chrome takes `signedIn`.
- `src/app/registrer/*`, `src/app/logg-inn/*`, `src/app/spill/page.tsx`, `src/app/actions.ts`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/api/health/route.ts`: pages, actions, real logout, session-aware chrome.
- `playwright.config.ts`: smoke project runs first.
- Tests: `tests/unit/{password,account-schema,errors}.test.ts`, `tests/integration/{auth,auth-internal,auth-secure-and-code,proxy}.test.ts`, `tests/integration/next-mocks.ts`, `tests/e2e/auth.spec.ts`, updates to `visual-foundation.spec.ts`, `fixtures.ts`, `error-pages.test.ts`, `lint-zones.test.ts`, `tests/TRACE.md`.

**Review.** 41 findings (high 3, medium 2, low 33, false 3). Patched: 11 fixes covering 20 rows (entry verdicts: high 1, medium 2, low 8). Deferred: none. Rejected: 21, each with its reason in the triage log.

**Follow-up review recommended: true.** Patched entries by verdict: high 1, medium 2, low 8. The specific unverified risk: the lockout rewrite (conditional `UPDATE … RETURNING` and `greatest()`) was added after review. It is proven by one deterministic race test and the sequential lockout test, but no independent reviewer has read it.

**Verification (after patches, local Node):** `npm run lint` clean; `format:check` clean; `typecheck` clean; `npm test` 206/206 in 16 files; `npm run test:e2e` 31/31; `drizzle-kit check` clean and a second `db:generate` produced no migration. The implementer looked at screenshots of `/registrer` and `/logg-inn` at 1280 and 375 px, with and without errors, and of `/spill`.

**Residual risks.**
- `not-found.tsx` reads cookies, which makes every route render per request, including `/`. Fine at this scale.
- A stale cookie after 14-day expiry stays in the browser (a server page cannot delete it), and the 404 shows the nav until the next login or logout.
- The scrypt wait queue is unbounded with no rate limit (`shortcut:` comment in `password.ts`).
- `REGISTRATION_CODE` set is proven by integration and render tests, not e2e (Design Notes).
- impeccable `critique`/`audit`/`harden`, `ponytail-review` and `bmad-code-review` are due on the epic branch before the PR (CLAUDE.md), not run here.
