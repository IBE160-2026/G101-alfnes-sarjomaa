# Epic 7 impeccable audit (audit)

Branch `epic-7-demo-og-levering`, scope `git diff origin/main...epic-7-demo-og-levering`. Mode: Operate. Contract: `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`. The launcher was unavailable, so the bundled detector did not run. This is a source audit checked against fresh screenshots. The app was started with `npm run demo` in a separate worktree on the branch head, with no model key, so it ran on the seeded PGlite database and the replay judge. Playwright drove the demo flow as a sensor would: the landing page, the login page, "Fyll inn demobrukeren" (also after an empty submit), "Mine spill", the Game page while collecting, closing the collection, Review, marking and locking, Team setup, the play stage, and the 404 pages both logged out and logged in. Every page was captured at 1280×800 and 360 px. The demo login Notice was also measured at 300, 320, 340, 375, 414 and 768 px. The README diagram `docs-assets/diagrammer/oversikt.png` was scaled to 900 px and read. The PNGs are kept outside the repo. File names are cited below.

Files in scope: `src/app/page.tsx` (demo login Notice, per-request render), `src/app/logg-inn/page.tsx`, `src/components/AccountForm.tsx` (demo Notice and "Fyll inn demobrukeren"), `src/components/HostChrome.tsx` (the Demo mode band), `src/app/spill/layout.tsx` and `src/app/not-found.tsx` (passing `DEMO_MODE` to the band), `src/lib/demo.ts` (the shared demo login), and `docs-assets/diagrammer/oversikt.png`. One observation about `GroupCard.tsx` (Review, outside Epic 7) is answered under Nice, because the demo flow shows it at 360 px.

## Scores

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 3 | The band is plain text in the banner landmark, at 14.3:1, and adds no tab stops. After an empty submit, "Fyll inn demobrukeren" fills both fields but leaves them marked invalid with their old error text. |
| Performance | 4 | Three small server-rendered blocks and one client handler. `connection()` makes `/` render per request, which costs nothing at this size. |
| Theming | 4 | Only existing tokens and components: `notice-info` (`primary-soft`, `ink`), `text-body-sm`, the secondary Button. No new colours or arbitrary values. |
| Responsive | 3 | No horizontal scroll on any page at 360 px, and the band wraps to two lines (57 px). At 414 px the password splits as "demo-" / "passord." in both login Notices. |
| Implementation integrity | 4 | Contract-true and minimal. One shared constant feeds the landing page, the login page, the CLI and the README. The band is hidden on the stage by the existing `data-host-chrome` rule, with no new code. |
| **Total** | **18/20** | Excellent. No must-fix before the PR. |

Verdict on integrity: pass. Every Demo mode element in the contract is present and worded as `EXPERIENCE.md` asks. The landing page has a Notice with the demo login (route table, `/`). The login page has the same login and the button "Fyll inn demobrukeren". Every Host page has a thin `notice-info` band under the top bar with "Demomodus: alt innhold er oppdiktet, og dommeren bruker lagrede avgjørelser." Both login Notices and the CLI read the login from `DEMO_HOST` (AD-19). The login reaches the client only when `DEMO_MODE` is on, because the server page passes it as a prop. Nothing new was invented: no badge, no icon and no dismiss control.

## Must

None.

## Should

### S1. [P2] The demo password can break across lines and is not set apart from the sentence (`src/app/page.tsx:21-24`, `src/components/AccountForm.tsx:77-81`)

Both Notices put the login inside running text: "logg inn som demo@toppsvar.test med passordet demo-passord." At 414 px (a common phone width) the line breaks at the hyphen, and the login Notice reads "… med passordet demo-" / "passord." (`login-password-split-414.png`). Measured with a text range, the password is one line box at 300, 320, 340, 375 and 768 px, and two at 414 px, on both `/` and `/logg-inn`. A reader who copies it by eye can type "demopassord", which fails. The full stop is also attached to the password. On `/` there is no fill button, so the text is the only way to get the password right. The README already sets the login apart as code (`demo@toppsvar.test` and `demo-passord`), so the UI is the odd one out.

Fix: wrap each value in `<code className="font-mono whitespace-nowrap">` (system monospace, as the OnceLinkList in `DESIGN.md` uses), or at least `<span className="whitespace-nowrap">`, in both places. The text then reads "logg inn som `demo@toppsvar.test` med passordet `demo-passord`." and never breaks inside a value. The email is 18 characters and fits on a 300 px line.

## Nice

### N1. [P3] "Fyll inn demobrukeren" leaves old field errors in place (`src/components/AccountForm.tsx:67-72`)

After an empty submit, both fields show "Skriv e-postadressen din." and "Skriv passordet ditt." with red borders. Pressing "Fyll inn demobrukeren" fills them, but both stay `aria-invalid="true"` with the old error text under a filled field (`login-errors-fill-focus-1280.png`, then `login-after-fill-1280.png`). This matches the app's rule that field errors clear on the next submit, and one press of "Logg inn" clears them. The weak part is that focus stays on the fill button, so a keyboard user needs three Tabs to reach "Logg inn", passing two fields that still say they are invalid. Fix: end `fillDemo` with a focus on the submit button (`formRef.current?.querySelector<HTMLButtonElement>("[type=submit]")?.focus()`). The next Enter then logs in and clears the errors. Do not submit automatically, because the contract says the Host fills, then logs in.

### N2. [P3] The static demo Notices are live regions (`src/components/Notice.tsx:4`, used at `src/app/page.tsx:21` and `src/components/AccountForm.tsx:77`)

`Notice` gives every `info` Notice `role="status"`. The demo login is static page content, not a status message, and the login Notice holds a button inside the live region. With `?utlopt=1` the login page has two status regions, while `EXPERIENCE.md` (Accessibility) asks for one polite region per page. Screen readers do not usually announce a region that is present at load, so nobody is harmed today. If the group touches `Notice` again, add an optional `role` prop (or `live={false}`) and pass it for the two demo Notices.

### N3. [P3] The README and the diagram say "lagrede kjennelser", the band says "lagrede avgjørelser" (`README.md:213`, `README.md:238`, `docs-assets/diagrammer/oversikt.png`)

The band uses the contract wording, "dommeren bruker lagrede avgjørelser". The README's demo section and the diagram's local-run bar say "lagrede kjennelser". The term map in `EXPERIENCE.md` does not list "ruling", so no rule is broken, but a sensor reads the README first and then sees a different word for the same thing in the app. Pick one word. "Avgjørelser" is the cheaper change, because the app copy, the contract and the fallback Notice already use it.

### N4. [P3] At 360 px Review breaks short Group labels letter by letter (`src/components/GroupCard.tsx:86-104`, outside Epic 7)

In `review-360.png`, "Kaffe" shows as "K / af / fe" and "Sjokolade" as "Sj / ok / ol / ad / e", with "5 svar" stacked the same way beside it. The header row holds the checkbox (44 px), the rank, the label, the raw form, "N personer" (`shrink-0 whitespace-nowrap`) and the 44 px menu in one flex row. The label (`min-w-0 break-words`) is the only part allowed to shrink, so it gets about 30 px. The contract accepts a cramped Review below 768 px and shows "Gjennomgangen er laget for større skjerm. Den virker her, men blir trang.", and the main target is a laptop. Stacked letters go further than cramped, though, and the demo makes this the first Review a phone user sees. Fix: let the header wrap (`flex-wrap`) and give the label a minimum basis (for example `basis-28 grow`), so "N personer" and the menu drop to a second line instead of crushing the label. Check it again at 360 px and at 1280 px.

## Checks that passed

- **The band on every Host page:** present under the top bar on "Mine spill", the Game page while collecting and in review, Review, Team setup, the Game 404 (`spill/[id]/not-found.tsx`) and the root 404 both logged in and logged out (`mine-spill-*.png`, `game-collecting-*.png`, `game-to-review-*.png`, `review-*.png`, `team-setup-*.png`, `game-not-found-*.png`, `not-found-logged-*-*.png`). It sits inside `<header>`, so landmark navigation reaches it, as the code comment says. It is 36 px tall at 1280 px and 57 px (two lines) at 360 px. It uses the same `max-w-320` and gutters as the top bar, so its text lines up with the wordmark.
- **The band is hidden on the play stage:** with the stage mounted, no `[data-host-chrome]` element is visible and the band's height is 0 at 1280 px and 360 px (`stage-1280.png`, `stage-360.png`). The first Tab on the stage goes to a stage control, not to the hidden chrome. No new CSS was needed.
- **The root error page:** `src/app/error.tsx` is a client component and cannot read `DEMO_MODE`, so the 500 page outside `/spill` has no band. Errors inside `/spill` use `spill/error.tsx` under the layout, which shows the band. Outside `/spill` the 500 page is reached from the landing, login and answer pages, which are not Host pages. Accepted.
- **Contrast:** band and Notice text, `ink` on `primary-soft`, 14.3:1. The fill button text, `primary` on `surface`, 8.8:1, and 7.5:1 on hover (`surface-sunken`). Its `line-strong` border on `primary-soft` is 3.3:1, above the 3:1 needed for UI. The focus ring, `ink` 3 px with a 2 px offset, stays fully visible on the `primary-soft` Notice (`login-errors-fill-focus-1280.png`).
- **Keyboard:** the band adds no tab stops. On "Mine spill" the order is still "Hopp til innhold", "Toppsvar", "Mine spill", "Logg ut", then the page. "Fyll inn demobrukeren" is a real `<button type="button">`, so it never submits the form, and it has a 44 px target.
- **The fill button works:** it sets the email through React state, so the value survives a failed submit, and the password through the DOM. The demo login then reaches `/spill`.
- **360 px:** no horizontal scroll on any page, logged in or out. The landing Notice wraps the email onto its own line without breaking it (`landing-360.png`). The top bar still fits "Toppsvar", "Mine spill" and "Logg ut" on one row with the band below it (`mine-spill-360.png`).
- **The login reaches the client only in Demo mode:** `logg-inn/page.tsx` passes `DEMO_HOST` to the client component only when `env.DEMO_MODE` is set, and `/` renders per request (`connection()`), so `DEMO_MODE` is read at run time and a server without Demo mode never sends the login to the browser.
- **Reduced motion:** Epic 7 adds no motion. The stage keeps the Epic 6 rules.
- **Copy:** "Demomodus" matches the term map. There are no exclamation marks, no em dashes and no words from the ban list. The 404 keeps "Siden finnes ikke." and the top bar, as `EXPERIENCE.md` (error table) asks, with the link "Mine spill" when logged in and "Til forsiden" when logged out.
- **README diagram:** `oversikt.png` (1344×874) scaled to 900 px is readable (`readme-oversikt-900.png`). The local bar now says "npm run demo · PGlite på disk · lagrede kjennelser · uten nøkkel", and the box was widened (910.8 to 924 px) so the longer text still fits with margin. The smallest labels ("spill", "svar", "rydding", "LOKALT, FOR SENSOR") are still legible at that size. See N3 for the word "kjennelser".

## Recommended order

1. S1: `<code className="font-mono whitespace-nowrap">` around the email and the password in both demo Notices.
2. N1: focus the submit button at the end of `fillDemo`.
3. N3: one word for stored rulings in the README and the diagram, or in the app copy and the contract.
4. N2 and N4 if time allows. N4 is outside Epic 7 and can go to the backlog.

## Epic 7 review fixes

Fixed on 2026-11-23 on `epic-7-demo-og-levering`, in commit `e57fb3e` unless noted. Checked against fresh screenshots of the demo server at 414, 360 and 1280 px, and by the extended `tests/e2e/demo.spec.ts`. `npm run test:e2e` passed in full (99 tests).

| # | Finding | Outcome |
|---|---|---|
| S1 | The demo password can break across lines | **Fixed.** The email and the password are in `<code className="font-mono whitespace-nowrap">` on `/` and `/logg-inn`, as `OnceLinkList` uses `font-mono`. The full stop sits outside the code. The e2e test checks that each value is one line box at 414 px. |
| N1 | "Fyll inn demobrukeren" leaves old field errors | **Fixed.** After filling, the last submit's field errors and danger Notice are hidden until the next submit, so no field stays `aria-invalid`, and focus moves to "Logg inn". The form is not sent automatically. The e2e test covers the empty submit, the fill, the focus and Enter. |
| N2 | Static demo Notices are live regions | **Fixed.** `Notice` has `live={false}`, which drops the role, and both demo Notices use it. The e2e test checks that no status region holds "Demomodus". |
| N3 | "kjennelser" against "avgjørelser" | **Fixed in commit `63927c7`.** The README and the `oversikt` diagram (re-rendered, PNG and `.excalidraw`) now say "avgjørelser", as the band and `EXPERIENCE.md` do. |
| N4 | Review breaks short Group labels letter by letter at 360 px | **Fixed.** Below `sm`, the header rows wrap and the label gets `basis-40 grow`, so "N personer" and the menu drop to a second line, right-aligned. Desktop is unchanged (compared at 1280 px). The e2e test requires every visible Group label to be at least 100 px wide at 360 px, and it failed at 19 px without the fix. |

Nothing was rejected or deferred. Epic 7 stays `in-progress`, because the manual SM-1 gate is still open.
