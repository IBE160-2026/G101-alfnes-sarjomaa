# Epic 1 ponytail review

Scope: `git diff fase-3-planlegging..epic-1-fundament` (stories 1.1 to 1.5). Assumed load: a class pilot, tens of Hosts, one or two server processes.

What this change does: It builds the app base: Next.js skeleton, a database that runs as PGlite (an in-process Postgres) or real Postgres, the design tokens, Host accounts with scrypt passwords and DB sessions, the Games list with the state machine, and Game delete plus the retention purge. The auth, locking, purge and error code is tight and matches the architecture. The extra weight is in duplicated form glue, pass-through schemas and overlapping tests. No `shortcut:` comment is dishonest.

## Must fix

None. I found no bug, security hole or data loss at the assumed load. I traced login lockout (race-safe through `stillOpen` and `greatest()`), registration (unique index race), session extension, `lockForMutation`, `purgeExpired` and `/api/purge` (constant-time compare, off without a secret).

## Should fix

1. **Four schemas that only default a field to ""** (`src/app/spill/schema.ts`, `src/app/spill/[id]/schema.ts`, `src/app/logg-inn/schema.ts`, `src/app/registrer/schema.ts`)
   - **What this is:** Each Server Action first parses the form with a tiny zod schema, then the server function validates the real rules again.
   - **Problem:** The first parse adds nothing. The real schemas already reject a missing or non-string field. It is four files, four imports and a second validation pass for no result.
   - **Fix:** Delete the four files. Pass `Object.fromEntries(formData)` straight to `games.create`, `games.deleteOwned` (needs its own `gameId` check), `auth.logIn` and `auth.register`, which already take `unknown`. Only a hand-crafted POST with a missing field would see zod's default message instead of the Norwegian one.
   - **If we skip it:** Every new form in later epics copies the pattern.

2. **The same client-side submit wrapper is written three times** (`AccountForm.tsx:57-70`, `CreateGameForm.tsx:25-38`, `DeleteGame.tsx:22-36`)
   - **What this is:** Each form wraps its Server Action in `useActionState`, catches a failed request, calls `unstable_rethrow` for the redirect, and returns the "Fikk ikke kontakt" text. The "focus the first invalid field or the notice" effect is also copied in two files.
   - **Problem:** Three copies of the `NETWORK` string and the try/catch. A fix to one (for example a different message) will miss the others. Epics 2 to 6 add many more forms.
   - **Fix:** One small hook, for example `useServerAction(action)` in `src/components/`, returning `[state, submit, pending]`, plus the focus effect inside it. About -40 lines now, more later.
   - **If we skip it:** Each later form gets a fourth, fifth and sixth copy.

3. **Test overlap and over-coverage** (details below; roughly 150 lines)
   - **What this is:** The per-story agents each proved the same rule again.
   - **Problem:** These tests fail together and add reading cost, not safety:
     - `tests/unit/game-state.test.ts:39` ("all 49 pairs") and `tests/integration/game-state.test.ts:59` ("all 49 pairs") test the same truth table. `transition` calls `canTransition` first, so the DB version only needs one case (a legal edge, one illegal edge, one stale `from`, which already exist at line 79).
     - `tests/unit/game-state.test.ts:47` and the integration "walks the permitted-operations table" (line 154) both walk `PERMITTED`. Keep one.
     - `tests/unit/lint-zones.test.ts` has 28 import cases. About ten are enough (one per rule family). Several cases name folders that do not exist yet (`questions`, `collection`, `play`, `review`, `judge`) and test eslint's matcher, not our code.
     - `tests/unit/guards.test.ts:20` ("requests to localhost still work") tests Node's `http`, not the project.
     - `tests/integration/env.test.ts:27` reads `.gitignore` text. A `.gitignore` check is not a behavior test.
     - `tests/unit/errors.test.ts:6` loops over every `MESSAGES` entry only to check the entry exists.
   - **Fix:** Delete or merge these. Keep every test that guards anonymity-adjacent or security behavior: lockout, authz NOT_FOUND parity, the cookie flags, purge boundaries, the purge route auth, the axe and focus-ring e2e tests.
   - **If we skip it:** The examiner sees a large suite with visible duplication, and every later change has to update two places.

4. **A link can show any text as a green success message** (`src/app/spill/page.tsx:27-31`, `src/app/spill/[id]/actions.ts:24`)
   - **What this is:** After a delete, the app redirects to `/spill?slettet=<title>` and the page prints `«<title>» er slettet.`.
   - **Problem:** Anyone can send a Host the link `/spill?slettet=Kontoen din er hacket, ring 555...`. A signed-in Host sees that text in a trusted success box. React escapes it, so it is not script injection, but it is content spoofing.
   - **Fix:** Show a fixed sentence ("Spillet er slettet.") and drop the query value, or keep the title only if UX requires it and cap it to the title limit. The fixed sentence is the smaller change and removes the `encodeURIComponent` code.
   - **If we skip it:** Low risk for a class pilot, but it is a cheap hole to close.

## Nice to have

5. **`tests/TRACE.md` is 293 lines of prose that repeat test titles** (`tests/TRACE.md`, `tests/unit/trace.test.ts`)
   - **What this is:** A map from each FR/NFR to its tests. The test only checks that each FR heading exists.
   - **Problem:** Each bullet describes the test body in a full paragraph. It will drift from the tests the first time one changes.
   - **Fix:** Keep the headings and the SM-1 test. Reduce each bullet to the file path and the story. Test titles already start with the ID, so `grep` finds them.
   - **If we skip it:** Stale prose in a graded document.

6. **Expired sessions are only deleted when someone presents them** (`src/server/auth/session.ts:46-50`)
   - **What this is:** An expired session row is deleted when its own cookie comes back.
   - **Problem:** A Host who logs in on a device and never returns leaves the row forever. The table only grows. At pilot scale this is a few hundred rows.
   - **Fix:** In `purgeExpired`, also `delete from session where expires_at < now`. Two lines. Add a `shortcut:` comment instead if you decide to leave it.
   - **If we skip it:** Slow growth, no user-visible effect.

7. **`requireHost` reads the session twice per page** (`src/app/spill/layout.tsx:14`, then each page)
   - **What this is:** The layout and the page both call `requireHost`, each doing a DB read (AD-5 asks for the call in the page).
   - **Problem:** Two identical queries per request.
   - **Fix:** Wrap `readSession` (or `requireHost`) in React's `cache()` so one request reads once. One line.
   - **If we skip it:** One extra indexed lookup per request. Harmless at this scale.

8. **Delete writes `updated_at` and then deletes the row** (`src/server/games/index.ts:79-86` and `:125-130`)
   - **What this is:** `deleteOwned` goes through `lockForMutation`, which also touches `updated_at` for Host calls.
   - **Problem:** One wasted UPDATE per delete. The row is gone a statement later.
   - **Fix:** Accept it for the AD-4 rule "no other code locks `game`", or skip it. It is a comment-worthy known cost, not a bug.
   - **If we skip it:** Nothing visible.

9. **`proxy.ts` imports the whole auth module for two constants** (`src/proxy.ts:2`, `src/server/auth/index.ts:34`)
   - **What this is:** `auth/index.ts` re-exports `SESSION_COOKIE` and `sessionCookieOptions` only so the proxy can use them.
   - **Problem:** The proxy bundle pulls in the DB client, scrypt and drizzle for two constants. The lint rule even forbids `proxy -> db` directly, so this goes around it.
   - **Fix:** Import from `@/server/auth/session` (and allow it in the lint zone), and delete the re-export.
   - **If we skip it:** Heavier proxy bundle, no functional effect.

10. **Small leftovers**
    - **What this is:** Several one-line cleanups.
    - **Problem:** `INITIAL_STATE` in `src/lib/game-state.ts:16` is never used (the schema default is the real source). The title message `"Navnet må ha 1–80 tegn."` in `src/lib/game.ts:4` hard-codes 80 next to `GAME_TITLE_MAX`. `OPENROUTER_API_KEY`, `JUDGE_*` and `DEMO_MODE` in `src/server/env.ts` are read by nothing yet. The last one is fine because the architecture and `env.test.ts` define the env contract, so I leave it.
    - **Fix:** Delete `INITIAL_STATE`. Build the title message from `GAME_TITLE_MAX`.
    - **If we skip it:** Drift risk only.

## Checked and fine (kept on purpose)

- `shortcut:` comments (`password.ts:17`, `games/index.ts:139`) name a real limit and an upgrade trigger. Both are honest. The password one correctly says the lockout is per account, so a flood of unknown emails still queues scrypt.
- Two DB drivers, the on-demand imports, the proxy cookie refresh, the scrypt limiter, the lockout, `lockForMutation` and `transition`: all required by AD-1, AD-4, AD-6, AD-23 and NFR-1/3. Unused so far (`transition`, `lockForMutation` without `hostId`) but specified for Epic 2+.
- Comments: about 78 comment lines in `src`, almost all "why" comments. No cuts needed.

Verdict: Ship. No must-fix findings; do 1, 2 and 4 before the PR, and 3 if you want the smaller suite.
Lean: -70 lines possible in `src`, about -150 in `tests`.
Not checked: UI rendering and axe results (did not run the app or the e2e suite), and whether the 24 h lockout ceiling is acceptable for account-lockout abuse (it is what AD-6 specifies).
