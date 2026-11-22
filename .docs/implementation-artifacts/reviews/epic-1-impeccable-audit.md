# Epic 1 UI audit (impeccable `audit` + `harden`)

Branch `epic-1-fundament`, 2026-11-22. Mode: Operate. Contract: `DESIGN.md` and `EXPERIENCE.md` in `ux-Toppsvar-2026-11-21`.
Method: source audit of `src/app` and `src/components`, plus computed contrast for every token pair in use. The app was not run in a browser, so 360/1280 px layout is judged from classes only. The impeccable launcher was unavailable, so project context was read directly.

Verdict: the foundation is sound. Tokens are mapped 1:1 and the base focus ring is present. Targets are 44 px or more, the dialog is native, route focus works, forms are labelled with `aria-describedby`, and the skeletons are delayed 300 ms. The findings below are mostly gaps in titles, recovery paths and a few contract deviations.

Contrast (computed): danger on danger-soft 6.1, success on success-soft 5.6, warning on warning-soft 6.3, ink-muted on paper 6.9, primary on paper 8.3, line-strong on paper/surface 3.7/4.0 (UI 3:1 passes). All pass AA. The only weak pair is `::selection` (see S6).

## Must

**M1. Every page is titled "Toppsvar" (WCAG 2.4.2, level A).** `src/app/layout.tsx:7`, `src/app/global-error.tsx:12`.
Fix: in the layout, `metadata = { title: { default: "Toppsvar", template: "%s – Toppsvar" } }`. Then add `export const metadata = { title: "…" }` per route:

| Route | Title |
|---|---|
| `/` | Toppsvar (default) |
| `/registrer` | Opprett konto |
| `/logg-inn` | Logg inn |
| `/spill` | Mine spill |
| `/spill/[id]` | `generateMetadata` returns the game title, from the same owner-checked fetch. A foreign game must not leak its title; the not-found path returns "Vi finner ikke dette spillet". |
| `/spill/[id]` not-found | Vi finner ikke dette spillet |
| root 404 | Siden finnes ikke |
| `error.tsx` (client, no metadata export) | `<title>Noe gikk galt</title>` in the JSX, as `global-error.tsx` already does |

Page titles should match each page's `<h1>`.

## Should

**S1. The 500 page says "Prøv igjen om litt" but offers no action and no way out.** `src/app/error.tsx:5-12`.
Fix: take `{ reset }`, add `<Button variant="primary" onClick={reset}>Prøv igjen</Button>` and a link to the home page. Do the same in `global-error.tsx`. Keep the heading as the contract text.

**S2. The 500 page always renders the logged-out chrome.** `src/app/error.tsx:7` and `global-error.tsx:13` pass `signedIn={false}`. EXPERIENCE.md says both error pages keep the Host top bar. A signed-in host loses "Mine spill" and "Logg ut" exactly when they need a way out.
Fix: `error.tsx` is a client component, so it cannot call `hasSessionCookie`. Either move the error UI into a server-rendered segment layout, or show the wordmark plus "Mine spill" for everyone. A `/spill` link redirects to the login page when logged out, which is acceptable. `global-error.tsx` can stay logged-out.

**S3. The root 404 is a dead end.** `src/app/not-found.tsx:7`. Only a heading; the top bar helps only when it has links. Add a link in the body, "Til forsiden" (logged out) or "Mine spill" (signed in). `spill/[id]/not-found.tsx` already does this correctly.

**S4. The draft empty state gives an instruction the UI cannot fulfil.** `src/app/spill/[id]/page.tsx:33-36` says "Skriv det første …", but there is no editor until epic 2. A user is told to do something with no control to do it.
Fix: either hold the copy until the question editor lands, or show it alongside a visible "kommer" note. Leaving it is acceptable if the epic 2 story follows immediately. Record it as an open item.

**S5. The delete banner prints arbitrary text from the URL.** `src/app/spill/page.tsx:27-30`, `src/app/spill/[id]/actions.ts:24`. `/spill?slettet=<anything>` renders "«<anything>» er slettet." in a success Notice. React escapes it, so there is no XSS, but a crafted link can show a trusted-looking message (phishing, impersonation). The banner also reappears on reload.
Fix: send a short-lived flash cookie (read and delete in the page), or at minimum cap the length to 80 and verify the flag with a server-side marker. This is the same class of risk as echoing query text.

**S6. `::selection` is nearly invisible.** `src/app/globals.css:117-120`. `primary-soft` on paper/surface is 1.12/1.20:1, so selected text, which people use for copying invite links later, has no visible highlight.
Fix: `background-color: color-mix(in oklab, var(--color-primary) 30%, var(--color-surface)); color: var(--color-ink);` Check ink text on it stays above 4.5.

**S7. Required fields are not announced.** `src/components/TextField.tsx` and `AccountForm.tsx`. Forms use `noValidate`, which is fine, but none of the inputs carry `required` or `aria-required`, so screen readers do not say "required" (WCAG 3.3.2). Add `aria-required="true"` for e-post, passord and spillnavn. Registreringskode is required whenever it is shown.

**S8. An unmapped field error is silent.** `src/lib/errors.ts` (`validate`) keys by `issue.path[0] ?? ""`; `AccountForm.tsx:83` and `CreateGameForm.tsx:52` show the banner only when `fieldErrors` is absent. If a failure arrives with a key no field renders (for example `""` or a renamed key), nothing is shown and no input is marked invalid. After submit, focus goes nowhere.
Fix: in the `useEffect`, if no `[aria-invalid="true"]` exists, fall back to `noticeRef`, and render the Notice when none of the keys match a field. Cheapest: always render the banner with `state.message` when `fieldErrors` has no key among the form's fields.

**S9. Raw values outside the theme.** DESIGN.md says tokens only.
- `src/components/ConfirmDialog.tsx:46` has `backdrop:bg-[rgb(30_26_34/0.55)]`. Use `backdrop:bg-ink/55`, since ink is the same colour.
- Same line: `max-w-[480px]`. Use `max-w-120` (480 px on the default scale).
- `src/components/TextField.tsx:36` has `px-[11px]`, a 1 px compensation for the 2 px error border. Use `px-2.75` (11 px on the 4 px scale, no raw px). Cosmetic.
- `src/app/page.tsx:3` and `AccountForm.tsx:42` redefine the `link`/`button` class strings that `Button` and a future `LinkButton` should own. Landing links are not `Button`, so they miss `cursor-pointer` parity and drift from the variants. Extract once when a second use appears (ponytail: not now).

## Nice

**N1. Notice lacks the contract's bold lead phrase and has no icon, which is permitted.** `src/components/Notice.tsx`. The error text still names problem and recovery; leave as is.

**N2. Loading skeletons are fully `aria-hidden`.** `src/app/spill/loading.tsx:6`, `[id]/loading.tsx:6`. Screen-reader users get no cue during slow loads. Add one `<p role="status" className="sr-only">Henter …</p>` inside, still delayed by `animate-appear`.

**N3. Current page not marked in the top bar.** `HostChrome.tsx:34`. Add `aria-current="page"` on "Mine spill" when on `/spill` (needs a client `usePathname` wrapper or a prop).

**N4. Landing and auth pages have no skip link and no `<header>`.** `page.tsx`, `registrer/page.tsx`, `logg-inn/page.tsx`. They are single-column pages, so the skip link is not needed by the contract (Host pages only). The wordmark on the auth pages is repeated by hand and sits at `py-24/32`, while error pages use `HostChrome` with `py-12`. Consistency only.

**N5. `CreateGameForm.tsx:83` aligns the button to the input with `sm:mt-6 sm:min-h-12`.** This depends on label height (14 px x 1.4 + 4 px = 23.6 px, about 24). Fragile if the label wraps or the text scale changes. Fine for now; if it moves, use `items-end` with the error text placed outside the row.

**N6. The Notice `info` text colour is `ink` on `primary-soft`.** Contrast is fine (above 7). No change.

## Checked and fine

- Tokens: `globals.css` `@theme` clears default colours and sizes, and a unit test pins it to DESIGN.md. No raw hex in components.
- Type scale uses only named steps. Body inputs are 16 px (no iOS zoom). Headings use the display face.
- Focus: global 3 px `focus-ring` with 2 px offset. Never removed. RouteFocus moves focus to `<h1>` after navigation and waits for it behind a skeleton.
- Forms: visible labels, `aria-invalid`, `aria-describedby` for helper and error, a sr-only "Feil:" prefix, email kept after a failed submit, password cleared.
- Keyboard path: skip link, then nav, then main. The dialog starts on Avbryt, Esc cancels, focus returns to the trigger. Pending buttons stay focusable (`aria-busy`, no `disabled`).
- Pending: label swapped after 300 ms with width locked; spinner stops under `prefers-reduced-motion`.
- Microcopy: all Norwegian, sentence case, errors name problem and recovery, no AI tells found against `copy-tells.md` (no em-dash sprinkling, no "sømløs/oppdag" style filler, no exclamation marks).
- Empty state of the game list matches the contract text. List load failure shows the contract `danger` Notice.
- Dialog `aria-labelledby` and `aria-describedby` are wired. The delete error appears inside the dialog and receives focus.
- Date formatting is fixed to nb-NO and Europe/Oslo.

## Open question for the group

The palette and display face are marked `[ASSUMPTION]` in DESIGN.md; nothing in epic 1 contradicts them, but the group has not confirmed them.

## Epic 1 review fixes (2026-11-22)

Commits on `epic-1-fundament`: `3a889ba` (titles and UI states), `caf2930` (delete notice), `531dff0` (form hook).

| ID | Status | Note |
|---|---|---|
| M1 | fixed (`3a889ba`) | The template is `%s – Toppsvar`, and each route has its title from the table. `/spill/[id]` gets the Game title through `generateMetadata`, from the same `cache()`d owner-checked read the page uses. A missing or foreign Game gets "Vi finner ikke dette spillet", so a foreign title never leaks. The 500 pages set `<title>Noe gikk galt – Toppsvar</title>`. There is one e2e title assertion per page, and the error pages are checked in `error-pages.test.ts`. |
| S1 | fixed (`3a889ba`) | `ServerError` adds a primary "Prøv igjen" button that calls Next 16's `retry()`, which is `reset()` plus a router refresh, so server errors are actually fetched again. The wordmark already links home, so no separate link was added. |
| S2 | fixed (`3a889ba`) | `src/app/spill/error.tsx` catches errors in the /spill pages inside the signed-in spill layout, so the Host keeps "Mine spill" and "Logg ut". The root `error.tsx` and `global-error.tsx` stay signed out, because a client component cannot read the httpOnly cookie. |
| S3 | fixed (`3a889ba`) | The 404 body links to "Til forsiden" when signed out and "Mine spill" when signed in. |
| S4 | fixed (`3a889ba`) | The draft panel says only "Ingen spørsmål ennå." until the editor exists. A `shortcut:` comment says to restore the EXPERIENCE.md sentence with the editor in Epic 2. |
| S5 | fixed (`caf2930`) | The `?slettet=` parameter is replaced by a short-lived httpOnly flash cookie, which the proxy clears after one showing. See ponytail item 4. |
| S6 | fixed (`3a889ba`) | `::selection` is `color-mix(in oklab, primary 40%, surface)`. Ink on it is 8.1:1, and against paper it is 2.0:1 (the old value was 1.1:1). |
| S7 | fixed (`3a889ba`) | `aria-required` is set on E-post, Passord, Registreringskode and Navn på spillet. `noValidate` and server validation are unchanged. |
| S8 | fixed (`531dff0`) | `useFormAction` shows the notice whenever no rendered field has an error, and focus falls back to it. |
| S9 | fixed in part (`3a889ba`) | `backdrop:bg-ink/55`, `max-w-120` and `px-2.75`. Skipped: the shared link and button class strings, which the audit itself marked "not now". |
| N1 | skipped | The audit says to leave it. |
| N2 | skipped | It is one line per skeleton, but a second `role="status"` on /spill during streaming would collide with the success notice and needs its own test. |
| N3 | fixed (`3a889ba`) | `NavLink` sets `aria-current="page"` on "Mine spill" on `/spill`. It needs `usePathname`, so it is a 10-line client component, not one line. |
| N4 | skipped | Consistency only, and the contract does not require it. |
| N5 | skipped | Fine for now, according to the audit. |
| N6 | no change | Contrast passes. |

Checks: `lint`, `format:check` and `typecheck` are clean, `npm test` passes 255 tests and `npm run test:e2e` passes 45, all offline with no keys. The app was verified through the e2e suite only, not by looking at it at 360 and 1280 px.
