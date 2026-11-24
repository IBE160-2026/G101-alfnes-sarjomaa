# Hardening before the freeze: ponytail review

Scope: `git diff origin/main...herding-for-frysen` (nine commits, the cheap findings from the whole-repo audit of 2026-11-24). Context read: `spec-herding-for-frysen.md` and `reviews/ponytail-audit-2026-11-24.md`. Assumed load: the pilot, a handful of Hosts at a time on Vercel, plus one examiner running the app and the test suites on one machine, and CI. Nothing was changed.

What this change does: It adds three indexes so that deleting a Game no longer scans every Answer once per Group, builds new Question ids from `crypto.getRandomValues` so "Legg til spørsmål" works on plain http, and caps the login queue at eight waiters so a flood is refused instead of piling up. It also starts the CLI tests through `node` instead of the `.bin/tsx` shell script, adds a test for Token uniqueness, turns three static Notices into plain text, and rewrites four documentation and `shortcut:` texts to match the code.

I traced the login and register paths through `limited`, `derive`, `verifyPassword`, `logIn`, `register`, `createHost` and `withBoundary`; the `Notice` component and every Notice the diff touches; the new indexes against the existing constraints in `schema.ts`; the three spawned CLIs and `package.json`; and the Playwright config, since the e2e suite is the heaviest user of the login queue.

Checked and found clean:

- **Each fix is the smallest one for its finding.** The indexes are three `index(...)` lines plus a generated migration. `newQuestionId` is 9 lines of code, and the version and variant bits are needed because `saveQuestionSchema` uses `z.uuid()`, which checks them. The queue cap is two lines in `limited` and one rethrow in `verifyPassword`. The Notice change uses the existing `live={false}` prop, as `src/app/page.tsx` and `AccountForm.tsx` already do. The CLI change swaps one path per file.
- **No duplicate index.** No existing index on `answer` or `answer_group` starts with `question_id` or `group_id`, so none of the three is redundant. The indexes add no column, so the anonymity guards (FR-11 to FR-13, AD-10) are untouched, and the Answer rows are still inserted shuffled, so index order shows nothing about arrival.
- **The rethrow is right.** The only `DomainError` that `derive` can throw is the queue refusal, so a malformed stored string still verifies as false. A refused login never reaches the lockout code, and an unknown email refused by the queue gets the same answer as a known one.
- **Test sizes match what they prove.** Each new test is one `it` of 15 to 22 lines, each guards a behaviour that nothing else guards, and the spec records that the index test and the queue test were seen to fail without the fix. The negative `role="status"` check in `play.test.ts` cannot pass by accident, because the line above it asserts the notice text is on the page.
- **No hidden shortcut.** The three reworded `shortcut:` comments (`password.ts`, `purgeExpired`, `TEAM_NAME_MAX`) each name the limit that remains and when to act. The diff adds no `TODO`, `.only`, `.skip`, debug output or commented-out code. The one unproven claim, that the CLI tests now run on Windows, is stated openly in the spec. The tsx entry path is an internal file, but `tsx` is pinned to an exact version.
- **Docs match the code.** `npm run dev` and `npm start` are plain `next dev` and `next start`, and only `npm run demo` passes `--env-file-if-exists=.env.local`, as the README and `.env.example` now say.

## Should fix

1. **The e2e suite can fail on a machine with 22 or more logical CPUs** (`src/lib/limits.ts:L16-17`, `playwright.config.ts`)
   - **What this is:** The new cap lets two scrypt runs work and eight wait in one server process. One more is refused with "Noe gikk galt hos oss. Prøv igjen om litt." Scrypt is the slow password hash run on every register and login, about 190 ms each on this laptop.
   - **Problem:** `playwright.config.ts` sets no `workers`, so Playwright uses half the logical CPUs. Every e2e worker talks to the same `next start` process, and 14 of the 19 spec files call `registerHost` themselves, besides the shared fixture that does it for others. On a 24-thread machine that is 12 workers starting at once, so 12 scrypt runs can be in flight together, and the 11th and 12th fail their test. The pilot needs nothing like ten logins at once, but the examiner's test run can, and the examiner's tests are a requirement. The spec's e2e run had 7 workers, so it could not see this.
   - **Fix:** Raise `SCRYPT_QUEUE_MAX` from 8 to 32. A waiter costs one closure and no memory for scrypt, and 32 waiters at two runs of 190 ms each still means about three seconds of worst-case wait. The unit test reads the constant, so it needs no change. Pinning `workers` in the Playwright config would also work, but it slows every run and leaves the same trap for anyone who changes it.
   - **If we skip it:** On a big workstation the examiner may see one or two e2e tests fail with "Noe gikk galt hos oss" at registration, which looks like a bug in the app.

## Nice to have

2. **A refused login is the only `INTERNAL` that is never logged** (`src/server/auth/password.ts:L24-26`)
   - **What this is:** `withBoundary` logs every unexpected error as `INTERNAL` before it reaches the user. The queue refusal is thrown as a `DomainError("INTERNAL")`, which `withBoundary` passes through without a log line, by design for domain errors.
   - **Problem:** The `shortcut:` says to add a per-IP limit if Hosts report "Prøv igjen om litt" at login. When that happens, the server log has nothing, so the group cannot tell a login flood from any other fault.
   - **Fix:** One `log({ module: "auth", op: "scrypt", code: "INTERNAL" })` line before the `throw`, with the import from `@/server/log`. No new error code is needed.
   - **If we skip it:** The upgrade trigger in the `shortcut:` depends on a Host noticing and describing the error, with no trace on the server to confirm it.

Verdict: Ship. Finding 1 is a one-number change worth making before the PR, because it protects the examiner's test run. Finding 2 is optional.

Lean: no cuts found. The diff is about 130 hand-written lines plus the generated drizzle snapshot, and every line serves a finding from the audit.

Not checked: the full Vitest and Playwright runs (another reviewer shares this working copy), the e2e suite with 11 or more workers, the CLI tests on Windows, and the migration on the hosted Postgres database.
