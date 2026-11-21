---
title: 'Story 1.2: Visual foundation, Host chrome and landing page'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_revision: 'f050ac46e4ad7dffe3a9b673ea9069fc292baa04'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
warnings: [oversized]
deferred:
  - summary: >-
      RouteFocus looks for the h1 once, right after the pathname changes, so a route that first shows loading.tsx or a Suspense skeleton without an h1 gets no focus move.
    evidence: |-
      Edge Case Hunter and Blind Hunter. Unreachable in Story 1.2 (no loading.tsx or Suspense exists); EXPERIENCE.md lists skeletons for the Game page and Review, so Story 1.4 is the first story that can hit it. Settle by adding the first loading.tsx and checking that focus lands on the page h1 once the page streams in.
    location: >-
      src/components/RouteFocus.tsx:11
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** The app has a bare `/` with an unstyled `<h1>`: no design tokens, no display font, no Host chrome, no bokmål 404/500 pages and no focus handling, so Stories 1.3 to 1.5 would each have to invent their own look and layout.

**Approach:** Declare every DESIGN.md color, type size and radius under Tailwind v4 `@theme` with the same names, self-host Bricolage Grotesque from the installed npm package, build one shared Host chrome component (skip link, top bar, landmarks), the landing page, bokmål `not-found.tsx` / `error.tsx` / `global-error.tsx`, and focus-to-`<h1>` on client route changes. Story 1.2's four ACs in `epics.md` are the contract.

## Boundaries & Constraints

**Always:**
- Token names equal DESIGN.md frontmatter names: `--color-<colors.key>` (all 28), `--text-<typography.key>` (all 14, with `--line-height` and `--font-weight` companions), `--radius-<rounded.key>` (4). Tailwind's default colors and text sizes are reset (`--color-*: initial`, `--text-*: initial`) so off-palette colors and sizes below 14 px (`text-xs`) cannot be used by accident.
- `--font-display` = `'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif` (the npm package registers the `Variable` family name); `--font-sans` = DESIGN.md body stack, which preflight applies to `body`.
- Font CSS imported from `@fontsource-variable/bricolage-grotesque` (served from `/_next/static/media`); never `next/font/google` or a CDN.
- Global `:focus-visible` ring = `components.focus` (3 px solid `focus-ring`, offset 2 px), never removed. `::selection` uses `primary-soft`/`ink`; link underline offset set.
- Literal strings: "Hopp til innhold", "Toppsvar", "Mine spill", "Logg ut", "Logg inn", "Opprett konto", "Siden finnes ikke.", "Noe gikk galt hos oss. Prøv igjen om litt.". Bokmål, no exclamation marks, no emoji, no name of the TV show.
- One `<h1>` per page. Host chrome: `header` > wordmark link to `/spill` + `nav` ("Mine spill" link to `/spill`, "Logg ut" submit button), `main#innhold`. Every control at least 44 px high.
- "Logg ut" is a real POST: a `<form>` bound to a `logOut` Server Action in `src/app/actions.ts` that redirects to `/`. Story 1.3 adds the session deletion inside it.
- Landing is not a Host page: no Host top bar, no skip link; one `<main>` with `<h1>Toppsvar</h1>`, one sentence, "Logg inn" (primary-looking link) → `/logg-inn`, "Opprett konto" (secondary-looking link) → `/registrer`.

**Never:**
- No Button, TextField, Notice, StatusBadge or ConfirmDialog components (Stories 1.3 to 1.5); the landing links are plain `<Link>`s with Tailwind classes.
- No `/spill`, `/logg-inn`, `/registrer` pages, no session logic, no Demo-mode notice (Story 7.1), no breadcrumb (Story 1.4), no dark mode.
- No test-only throwing route or env hook in production code to provoke a 500.
- No illustrations, gradients, shadows or eyebrow labels on these pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Landing | `GET /` | 200; `<h1>Toppsvar</h1>`, one sentence, two links | — |
| Unknown URL | `GET /finnes-ikke` | 404 status; Host top bar; `<h1>Siden finnes ikke.</h1>` | — |
| Render error under root layout | a route throws | `error.tsx` inside Host chrome: `<h1>Noe gikk galt hos oss. Prøv igjen om litt.</h1>` | logs nothing new (Next logs server-side) |
| Root layout throws | — | `global-error.tsx` with own `<html lang="nb">`, same sentence, Host chrome | — |
| Client navigation | click "Logg inn" on `/` | URL `/logg-inn` (404 page in this story); focus on its `<h1>` | first load does not steal focus |
| Font blocked | network outside localhost aborted | font still loads (same origin); no external request | fallback `system-ui` if the file fails |

</intent-contract>

## Code Map

- `src/app/layout.tsx` -- root layout from 1.1 (`lang="nb"`, metadata title "Toppsvar", imports `./globals.css`). Add font CSS import and `<RouteFocus />`; body gets token classes via `globals.css` base layer.
- `src/app/globals.css` -- only `@import "tailwindcss";`. Gets `@theme` + `@layer base`.
- `src/app/page.tsx` -- bare `<main><h1>Toppsvar</h1></main>`; becomes the landing page.
- `node_modules/@fontsource-variable/bricolage-grotesque/index.css` -- `@font-face` family `'Bricolage Grotesque Variable'`, weights 200–800, woff2 per unicode range (latin covers æ ø å). Pinned 5.3.0 in `package.json`.
- `tests/e2e/fixtures.ts` -- `test` aborts every non-localhost request (`blockedbyclient`). Reuse for all new e2e tests.
- `tests/e2e/smoke.spec.ts` -- asserts `/` has `lang="nb"` and title "Toppsvar"; must stay green.
- `@axe-core/playwright` 4.14.0 is installed (devDependency), unused so far.
- `vitest.config.ts` -- includes only `tests/{unit,integration}/**/*.test.ts`; aliases `@/` and `server-only`. A `.test.ts` file can render components via `react-dom/server` + `createElement` (no JSX in `.ts`).
- `eslint.config.mjs` -- `src/app/**` and `src/components/**` may import `@/components/*` and `@/app/*`; banned only from `@/server/(db|judge)`.
- `tests/TRACE.md` -- add NFR-6 rows and a UX section entry for this story's tests (FR headings unchanged; this story covers no FR).
- `README.md` -- nothing to change (no new scripts).

## Tasks & Acceptance

**Execution:**
- `src/app/globals.css` -- add `@theme` with every token (colors, text sizes with line-height/weight companions, radii, `--font-display`, `--font-sans`), defaults reset; `@layer base`: `body` bg `paper` / color `ink` / `text-body`, `h1,h2` in `font-display`, `:focus-visible` ring, `::selection`, link `text-underline-offset` -- AC1, AC4
- `src/app/layout.tsx` -- `import "@fontsource-variable/bricolage-grotesque";` and render `<RouteFocus />` before `children` -- AC1, AC3
- `src/components/RouteFocus.tsx` -- client component: on `usePathname()` change (not on first render) set `tabindex="-1"` on the first `h1` and focus it -- AC3
- `src/app/actions.ts` -- `"use server"`; `logOut()` → `redirect("/")` -- AC3 ("Logg ut" in chrome)
- `src/components/HostChrome.tsx` -- skip link (visually hidden until focused) → `#innhold`; `header` with wordmark `Link` `/spill` (`font-display`, `text-heading`) and `nav aria-label="Hovedmeny"` ("Mine spill" link, "Logg ut" `<form action={logOut}>` button); `main id="innhold" tabIndex={-1}` max 800 px, gutter 32 px, inside a 1280 px frame -- AC3
- `src/app/page.tsx` -- landing per Boundaries; content max 560 px, generous vertical space, links as 44 px button-shaped links (`primary` filled, secondary bordered `line-strong`) -- AC2
- `src/app/not-found.tsx` -- `HostChrome` + `<h1>Siden finnes ikke.</h1>` -- AC3
- `src/app/error.tsx` -- `"use client"`; `HostChrome` + `<h1>Noe gikk galt hos oss. Prøv igjen om litt.</h1>` -- AC3
- `src/app/global-error.tsx` -- `"use client"`; own `<html lang="nb"><body>`, imports `./globals.css` and the font, same content as `error.tsx` -- AC3
- `tests/e2e/visual-foundation.spec.ts` -- AC1: record every request on `/`, assert all are localhost and a `.woff2` came from `/_next/static/`, `document.fonts.check('700 32px "Bricolage Grotesque Variable"')`, body `font-family` starts with `system-ui`, no visible text element below 14 px; AC2: one `h1`, sentence, link hrefs; AC3: unknown URL → status 404, text, `header`/`nav`/`main` landmarks, skip link first in tab order and moves to `#innhold`, wordmark/"Mine spill" hrefs, "Logg ut" button; click "Logg inn" → focused element is the `h1`; AC4: axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on `/` and the 404 page has no serious/critical violations; Tab through every interactive element on both pages and assert computed outline `3px solid rgb(30, 26, 34)` -- AC1–AC4
- `tests/unit/error-pages.test.ts` -- render `error.tsx` and `global-error.tsx` with `renderToStaticMarkup`: one `<h1>` with the 500 sentence, `lang="nb"` on global error, top bar strings present -- AC3 (500 page; see Design Notes)
- `tests/unit/design-tokens.test.ts` -- parse DESIGN.md frontmatter keys (simple line scan, no new dependency) and assert `globals.css` declares `--color-*`, `--text-*`, `--radius-*` for every one, with equal values -- AC1 (token parity guard)
- `tests/TRACE.md` -- add rows for the tests above under a story/NFR section -- epic rule

**Acceptance Criteria:**
- Given the landing page in Playwright with external requests blocked, when it loads, then Bricolage Grotesque is served from `/_next/static/`, no request leaves localhost, body uses the system UI stack, and nothing renders below 14 px.
- Given a visitor not logged in, when they open `/`, then they see one `<h1>`, one sentence, and "Logg inn" → `/logg-inn`, "Opprett konto" → `/registrer`.
- Given an unknown URL, when opened, then the response is 404 and the page reads "Siden finnes ikke." inside the Host chrome (skip link, `header`, `nav`, `main`); the 500 page reads "Noe gikk galt hos oss. Prøv igjen om litt."; after a client route change focus is on the `<h1>`.
- Given `/` and the 404 page, when axe scans them, then no serious or critical violations, and every interactive element shows the `focus` ring when focused by keyboard.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 32 findings — high 0, medium 3, low 15, false 9, maybe-false 5
- findings:
  - `[medium]` `[patch]` Verification gap: "Logg ut" form and `logOut` never submitted by a test — added an e2e test that clicks "Logg ut" on the 404 page and expects `/` with h1 "Toppsvar".
  - `[medium]` `[patch]` Verification gap: landing links' 44 px height unguarded (axe `target-size` is off by default) — height test now runs on `/` (`main a`) and the 404 page (`header a, header button`), and asserts it found controls.
  - `[low]` `[reject]` Verification gap (other): I/O matrix row "click Logg inn → focus on h1" cannot happen, since Next does a full page load for a link answered with a 404 — true, but the fix is a spec edit inside the read-only intent contract. The behavior the AC names (focus after a client route change) is tested with Next's client router from the 404 page; Story 1.3 can switch to a real link click once `/logg-inn` returns 200.
  - `[low]` `[patch]` Verification gap (other): `trace.test.ts` does not guard the new NFR-6 heading — `NFR-6` and `NFR-7` added to `STORY_NFRS`.
  - `[low]` `[reject]` Intent audit: 500 page proven by `renderToStaticMarkup`, not e2e — no production route can throw on demand, and a throwing route or env switch would ship test code (Design Notes). Unlikely to bite; the fix adds production surface.
  - `[false]` `[reject]` Intent audit: "shared Host layout" is a component, not a route `layout.tsx` — no Host route exists until Story 1.4; every page that exists and needs the chrome uses it.
  - `[low]` `[patch]` Intent audit: an anonymous visitor's 404 shows "Logg ut" — the literal AC3 asks for the Host top bar on the 404 page; clicking it only redirects to `/`. Recorded as a `shortcut:` comment in `HostChrome.tsx` for Story 1.3 to make it session-aware.
  - `[low]` `[reject]` Intent audit: focus test calls `window.next.router.push` instead of clicking a Link — no link between two 200 pages exists in this story (every link targets a 404, which is a full page load); the test fails loudly if Next removes the global.
  - `[low]` `[patch]` Intent audit: axe narrowed to WCAG tags, dropping its default rules — `.withTags` removed; the default run finds no serious or critical violations on either page.
  - `[false]` `[reject]` Intent audit: focus ring checked by computed outline, not visibility — DESIGN.md verifies `ink` on `paper`/`surface` at 16.0/17.1:1, and both pages use only those backgrounds.
  - `[false]` `[reject]` Intent audit: tokens checked by a unit test, not in the browser — AC1's Given is about `globals.css` declarations; the browser half (font, network, stack, 14 px) is e2e.
  - `[false]` `[reject]` Intent audit: commits, sprint status and triage log missing — the audit ran mid-workflow; all three are done at finalize.
  - `[maybe-false]` `[defer]` Edge Case Hunter: h1 mounts after the effect when a route streams behind `loading.tsx`/Suspense — none exists yet; if true it is medium (a11y). Deferred to Story 1.4 (see frontmatter).
  - `[false]` `[reject]` Edge Case Hunter: a search-param-only change does not move focus — a query change is not a new page; moving focus on every query change would yank keyboard users mid-task.
  - `[false]` `[reject]` Edge Case Hunter: more than one h1 lands focus on the wrong heading — one h1 per page is a rule, and both pages assert `h1` count 1.
  - `[low]` `[reject]` Edge Case Hunter: `error.tsx` ignores `reset` — EXPERIENCE.md fixes the 500 page at one sentence; a retry button would add copy and UI the spines do not have. The top bar gives a way on.
  - `[low]` `[patch]` Edge Case Hunter: 500 sentence interpolated unescaped into a RegExp — replaced with `toContain`.
  - `[maybe-false]` `[reject]` Edge Case Hunter: `fontFamily` per type token not asserted, so `text-tv-*` on a div renders in system-ui — Tailwind v4 has no font-family companion for `--text-*`; Design Notes say family is the separate `font-display` utility. If true only low; the play view story applies `font-display`.
  - `[maybe-false]` `[reject]` Edge Case Hunter (claim): focus after a real "Logg inn" click never exercised — same as the matrix row above; rejected for the same reason.
  - `[low]` `[patch]` Blind Hunter: Host chrome shown to every visitor on 404/500 — same patch as the intent-audit row (`shortcut:` comment).
  - `[low]` `[patch]` Blind Hunter: known limits lack `shortcut:` comments (CLAUDE.md) — added in `HostChrome.tsx` and `actions.ts`.
  - `[medium]` `[patch]` Blind Hunter: no test covers "Logg ut" — same patch as the first verification-gap row.
  - `[low]` `[reject]` Blind Hunter: spec row contradicts the code; `window.next.router` may disappear — spec edit rejected (read-only intent contract); the test fails loudly on a Next upgrade that removes it.
  - `[maybe-false]` `[defer]` Blind Hunter: `RouteFocus` loses focus on streaming pages — grouped with the Edge Case Hunter row; deferred to Story 1.4.
  - `[maybe-false]` `[reject]` Blind Hunter: token test skips `fontFamily` — grouped with the Edge Case Hunter row; rejected.
  - `[false]` `[reject]` Blind Hunter: named spacing tokens (`host-max`, `form-max`, `control-min`, gutters) not in `@theme` — AC1 names only colors, type sizes and radii, and DESIGN.md says "Spacing needs no entry"; the code uses the equal Tailwind steps.
  - `[low]` `[patch]` Blind Hunter: TRACE cites NFR-7 without a section — added `## NFR-7` (bokmål interface) with the tests that check the strings.
  - `[low]` `[patch]` Blind Hunter: unescaped RegExp — same patch as the Edge Case Hunter row.
  - `[low]` `[patch]` Blind Hunter: 14 px floor only checked on `/` — the check is now a helper and also runs on the 404 page.
  - `[false]` `[reject]` Blind Hunter: focus ring on `main#innhold` and the route-focused h1 was "never decided" — DESIGN.md and EXPERIENCE.md say the ring is never removed; the spec's Always list repeats it.
  - `[low]` `[reject]` Blind Hunter: `error.tsx` ignores `reset` — grouped with the Edge Case Hunter row; the spines fix the copy.
  - `[false]` `[reject]` Blind Hunter: secondary link hover `primary-soft` not defined in DESIGN.md — `primary-soft` is DESIGN.md's token for selected and soft berry states; hover is not a new color, and Story 1.3's Button settles the variant.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the implementer** with 8 review patches: the "Logg ut" action and the landing tap targets had no test, axe was narrowed to fewer rules than AC4 asks for, a test regex matched any character, NFR-6/NFR-7 trace headings were unguarded or missing, and two known shortcuts lacked the project's `shortcut:` comment.
- **Implementer corrected the spec:** the spec told the test to click "Logg inn" and expect focus on the 404 page's h1. The implementer showed (in Next's router source and a browser) that a link answered with a 404 is a full page load, so the test uses Next's client router from the 404 page instead. Accepted; the read-only matrix row stays as written and this note records why.
- **Reviewer suggestions rejected:** a "Prøv igjen" retry button on the 500 page, moving focus on search-param changes, a MutationObserver in `RouteFocus` before any streaming route exists (deferred instead), declaring spacing tokens AC1 does not name, and a test-only throwing route to e2e the 500 page. Each either adds UI the spines do not have or code for a case nobody can reach yet (reasons above).

## Design Notes

- **Host chrome is a component, not yet a route layout.** No Host route exists until Story 1.4 (`/spill`). Root `not-found.tsx` and `error.tsx` render inside the root layout only, so they must include the chrome themselves; `global-error.tsx` replaces the root layout. One `HostChrome` component serves all three now, and Story 1.4 wraps `src/app/spill/layout.tsx` in it. The landing page stays outside it: a visitor who is not logged in should not see "Logg ut".
- **500 page tested by rendering, not by e2e.** AC3 is tagged e2e, but no production route can throw on demand, and adding one (or an env switch) ships test code. `error.tsx` and `global-error.tsx` are rendered with `react-dom/server` in Vitest instead; the 404 half of AC3 stays e2e.
- **Typography companions.** Tailwind v4 reads `--text-<name>--line-height` and `--text-<name>--font-weight`, so `text-display` gives size, line height and weight from one token, matching DESIGN.md. Family stays a separate utility (`font-display`), because Tailwind has no font-family companion.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline
- `npm run test:e2e` -- expected: smoke + visual-foundation specs pass

**Manual checks:**
- `npm run dev`: `/` shows the landing in Bricolage + system UI on paper; `/x` shows the top bar and "Siden finnes ikke."; Tab shows the ink ring on every control.

## Auto Run Result

Status: done

**Summary.** Every DESIGN.md color (28), type size (14, with line-height, weight and letter-spacing companions) and radius (4) is declared under Tailwind v4 `@theme` with the same name, and Tailwind's default colors and sizes are reset. Bricolage Grotesque is self-hosted from `@fontsource-variable/bricolage-grotesque` and body text uses the system UI stack. A global 3 px ink `:focus-visible` ring, `::selection` and link underline offset are set. One `HostChrome` component (skip link "Hopp til innhold", `header` with wordmark → `/spill`, `nav` with "Mine spill" and a "Logg ut" POST form, `main#innhold`) wraps the bokmål `not-found.tsx`, `error.tsx` and `global-error.tsx`. The landing page has one `<h1>`, one sentence and "Logg inn"/"Opprett konto". `RouteFocus` moves focus to the `<h1>` after a client route change.

**Files.**
- `src/app/globals.css`: tokens under `@theme`, base layer (body, headings, focus ring, selection, underline offset).
- `src/app/layout.tsx`: font import and `<RouteFocus />`.
- `src/app/page.tsx`: landing page.
- `src/app/not-found.tsx`, `error.tsx`, `global-error.tsx`: bokmål 404 and 500 pages inside the Host chrome.
- `src/app/actions.ts`: `logOut()` Server Action (redirects to `/`; Story 1.3 adds the session deletion).
- `src/components/HostChrome.tsx`, `src/components/RouteFocus.tsx`: Host chrome and route focus.
- `tests/e2e/visual-foundation.spec.ts`: AC1–AC4 in the browser, offline.
- `tests/unit/design-tokens.test.ts`: `globals.css` matches DESIGN.md frontmatter, name and value.
- `tests/unit/error-pages.test.ts`: 500 pages rendered with `react-dom/server`.
- `tests/unit/trace.test.ts`, `tests/TRACE.md`: NFR-6, NFR-7 and UX sections, guarded.

**Review.** 32 findings (high 0, medium 3, low 15, false 9, maybe-false 5). Patched: 8 fixes covering 15 rows (medium 2 entries, low 6 entries). Deferred: 1 (route focus on streaming pages, medium unverified, Story 1.4). Rejected: 16, each with its reason in the triage log.

**Follow-up review recommended: true.** Patched entries by verdict: medium 2, low 6. The specific unverified risk: the new "Logg ut" e2e test and the unscoped axe run were added after review and have been seen green only in this run; the "Logg ut" form will change shape in Story 1.3.

**Verification (after patches, local Node):** `npm run lint` clean; `format:check` clean; `typecheck` clean; `npm test` 149/149 in 9 files; `npm run test:e2e` 15/15 (3 smoke + 12 story). The implementer also looked at screenshots of `/` and the 404 page at 1280 and 375 px and checked `npm run dev` serves `/` (200) and `/x` (404).

**Residual risks.**
- The focus test depends on `window.next.router`, which Next sets for the App Router but does not document as API.
- The landing sentence ("Lag spørsmål om gjengen, samle inn anonyme svar og spill topplista sammen på én skjerm.") is not in EXPERIENCE.md; the group should confirm it.
- Host chrome uses the 16 px mobile gutter below `sm` and 32 px above, per DESIGN.md's gutter tokens (the spec said 32 px only).
- impeccable `critique`/`audit`/`harden`, `ponytail-review` and `bmad-code-review` are due on the epic branch before the PR (CLAUDE.md), not run here.
