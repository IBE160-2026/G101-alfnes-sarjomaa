# Epic 1: Fundament

**Basert på `fase-3-planlegging`. Merge den PR-en først.**

Story 1.1–1.5: kjørende skjelett med database og CI, visuelt grunnlag, innlogging for verter, spill med tilstandsmaskin, og sletting og automatisk opprydding.

## Stories
| Story | Innhold | Review (funn / rettet / avvist) |
|-------|---------|----------------------------------|
| 1.1 | Next.js 16, PGlite/Drizzle med migrasjoner, ESLint-lagregler, Vitest + Playwright med nettverksvakt, CI på Node 22 og 26 | 53 / 21 / 30 |
| 1.2 | Design-tokens fra `DESIGN.md` i Tailwind (en test passer på at de er like), lokal font, toppmeny, 404/500, forside | 32 / 8 / 16 |
| 1.3 | Registrering, innlogging og utlogging. scrypt, hashede sesjoner i httpOnly-cookie, kontolåsing (også ved samtidige forsøk) | 41 / 11 / 21 |
| 1.4 | Opprette og liste spill, spillside, tilstandsmaskin med lås og compare-and-set | 39 / 7 / 27 |
| 1.5 | Slette spill med bekreftelsesdialog, og automatisk sletting av utløpte spill | 35 / 6 / 26 |

Hver story ble laget med `ponytail` og `bmad-build-auto`, og storiene med UI også med `impeccable`. Hver story har en spec i `.docs/implementation-artifacts/`, der review-seksjonen viser hvilke KI-forslag som ble rettet eller avvist, og hvorfor.

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/`. Seksjonen «Epic 1 review fixes» nederst i hver rapport viser hvordan hvert funn ble håndtert.

- **`bmad-code-review`** (fire uavhengige reviewere): 0 høye, 1 medium og 13 lave.
  - Medium: varselet om utløpt sesjon kunne forsvinne fordi sesjonen ble lest to ganger. Rettet med `cache()` og en test som feiler uten.
  - Tilgang til andres spill, CSRF, cookie-flagg, låsing, lagreglene og sensors kjørevei (`npm test` uten `.git` og uten nett) er funnet i orden.
- **`ponytail-review`:** dommen er «ship», uten «must»-funn.
  - Overflødige skjemafiler er fjernet, og en gjentatt skjemalogikk er samlet i én hook.
  - Overlappende tester er fjernet, men hvert akseptkriterium har minst én test.
- **`impeccable` audit:**
  - Must: alle sider het «Toppsvar». Nå har hver side sin egen tittel (WCAG 2.4.2).
  - Ellers: «Prøv igjen» på 500-siden, lenker på 404-siden, synlig markert tekst, `aria-required` og theme-verdier i stedet for rå verdier.
- **Funnet av to reviewere uavhengig av hverandre:** slettevarselet kunne forfalskes med en lenke (`/spill?slettet=...`). Det er flyttet til en kortlivet httpOnly-cookie.

## Sjekker (lokalt, uten nett og uten nøkler)
`npm run lint`, `format:check` og `typecheck` er rene. `npm test`: 255 passerer. `npm run test:e2e`: 45 passerer, inkludert axe-sjekk av tilgjengelighet.

## Kjente begrensninger (merket `shortcut:`)
- Køen for passord-hashing har ingen øvre grense, og det finnes ingen rate limit. Må fikses før en offentlig pilot.
- Utkastsiden sier «Ingen spørsmål ennå.» til spørsmålseditoren kommer i epic 2.
- Den daglige cron-jobben for opprydding trenger `CRON_SECRET` ved deploy (story 7.5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
