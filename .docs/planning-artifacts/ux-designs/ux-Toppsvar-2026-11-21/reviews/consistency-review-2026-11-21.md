# Consistency review: UX × Architecture × PRD — 2026-11-21

Run by the orchestrator as a separate subagent (Claude Sonnet, read-only) after UX and
architecture were produced in parallel without seeing each other, and after PRD FR-7 was
amended (AD-8). It stands in for the UX reviewer gate that the headless UX run skipped.

**Result: no blockers for epics.** 11 fix-during-story items (F), 3 cosmetic (C).
Resolutions are recorded in the UX and architecture `.memlog.md` files.

| # | Sev | Conflict | Resolution |
|---|-----|----------|------------|
| 1 | F | EXPERIENCE answer-form confirmation/returning copy and UJ-2 promise editing "via the same link"; FR-7/AD-8 limit it to the submitting device | EXPERIENCE: copy says "på denne enheten og i denne nettleseren"; explain that an empty form replaces the old set |
| 2 | F | EXPERIENCE hashes the Token with Web Crypto for draft keys; `crypto.subtle` is undefined on plain `http://<LAN-IP>` | Orchestrator decision: no hashing in the browser. One localStorage key per link, `toppsvar:<gameId>:<first 16 chars of token>`, holds both draft and edit secret; both cleared on `closed`/`unknown`. AD-8 and EXPERIENCE updated. Clipboard copy falls back to select-and-copy text |
| 3 | F | "Ingen KI-nøkkel er satt opp" shown in Demo mode (replay rulings exist) and for `NO_STORED_RULING` | EXPERIENCE: reason-specific copy (`NO_KEY`, `NO_STORED_RULING`, timeout/error) driven by the fallback reason code |
| 4 | F | Review rail status "Endret – marker på nytt" has no data (AD-15 stores a boolean) | EXPERIENCE: drop it; changed Questions show "Ikke gjennomgått" |
| 5 | F | Grouping crash copy says manual grouping; AD-12 resumes the Judge after the lease | EXPERIENCE: "Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt."; progress "N av M" via `grouping.progress` |
| 6 | F | FR-18 export has no UI | EXPERIENCE: "Last ned bruksrapport" on the Game page from *in review* onward |
| 7 | F | Demo credentials/band have no source | AD-19/AD-21: demo credentials in one `src/lib` constant, read by login page and band when `DEMO_MODE=1` |
| 8 | F | `REGISTRATION_CODE` has no field | EXPERIENCE: conditional "Registreringskode" field on `/registrer` |
| 9 | F | "11 av maks 50 lenker brukt" needs `issued`; no copy for `LINK_CAP_REACHED` | AD-8: `progress` also returns `issued`; EXPERIENCE: cap copy |
| 10 | F | Revoke with a bad link maps to `NOT_FOUND` (404) | AD-5/AD-8: revoke returns inline `LINK_UNKNOWN` |
| 11 | F | Stale multi-tab errors retried forever | EXPERIENCE: refresh the view on `NOT_FOUND`, `ALREADY_REVEALED`, `WRONG_QUESTION` |
| 12 | C | Answer page title and "server-rendered" form vs AD-7 generic shell | EXPERIENCE: client sets title after `openInviteLink` |
| 13 | C | Team name 1–20 (UX) vs 1–40 (AD-16/24) | Align to 20 |
| 14 | C | Small items: `NO_GROUPS_ON_BOARD` decides UX open question 2; 30 s collecting refresh missing from AD-17; "Vis resten uten poeng" toggle not persisted (accepted); `/skjerm` for *played*; revoked link after close shows "closed"; font package missing from Stack table; segment not-found under `/svar` | Applied as one-line fixes |

Checked and consistent: Norwegian route names, Board limit 8, Review operation set (AD-4),
reveal log and undo (AD-16), self-hosted fonts.
