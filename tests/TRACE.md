# Test trace

Maps every Stage 1 FR, and the NFRs the stories so far touch, to the tests or manual checks that prove it. Test titles start with the ID they prove. `tests/unit/trace.test.ts` fails if a Stage 1 FR heading is missing.

Each story adds its rows here. "Pending" names the stories whose acceptance criteria will add coverage.

## FR-1

Host account.

- None yet.
- Pending: Stories 1.3, 1.4, 2.3.

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
- Pending: Stories 1.3, 2.3, 2.4, 3.2, 3.3, 6.5.

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

## NFR-8

Secrets.

- `tests/integration/env.test.ts`: `.env.example` keys equal `env.ts` keys; `.gitignore` covers `.env*` except `.env.example`; invalid values throw naming keys only.
- `tests/integration/db.test.ts`: a bad `DATABASE_URL` and a DB failure never echo the URL or the error message.
- Pending: Story 7.4.
