# G101 — Claudeception

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Produkt

**Toppsvar** — et Family Feud-aktig festspill der verten lager sitt eget spørreskjema om sin
egen gjeng. Deltakerne svarer anonymt i fritekst, en språkmodell grupperer svar som betyr det
samme til rangerte topp-lister, verten retter opp grupperingen, og gjengen spiller live fra én
delt skjerm. I trinn 2 skal et ferdig spørsmålssett la en gjeng spille med én gang, uten å
vente på at et skjema fylles ut.

## Medlemmer

- Sondre Alfnes
- Daniel P Sarjomaa

## Leveranser

| Dokument | Fase | Hva det er |
|----------|------|------------|
| [`product-brief.md`](product-brief.md) | Fase 1, arbeidskrav | Produkthistorien: hva, hvorfor, hvem og hvordan — bevisst uten teknologi. Revidert etter faglærers tilbakemelding |
| [`proposal.md`](proposal.md) | Bakgrunn | Omfang, teknologivalg, datamodell, tidsplan og risiko i fjorårets proposal-format |
| [`PRD.md`](PRD.md) | Fase 2 | Krav: funksjonelle og ikke-funksjonelle, prioritert i trinn 1 og trinn 2 |
| [`DESIGN.md`](.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md) og [`EXPERIENCE.md`](.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md) | Fase 3 | UX: visuell identitet, flyter, tilstander og tilgjengelighet, med [mockup](.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/mockups/key-screens.html) av nøkkelskjermene |
| [`ARCHITECTURE-SPINE.md`](.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md) | Fase 3 | Arkitektur: stack, datamodell, anonymitet, dommeren, demomodus og tester (AD-1 til AD-24) |
| Refleksjonsrapport | Uke 48–49 | 30 % av karakteren (koden er 70 %). Leveres 5. desember |

`proposal.md` og `product-brief.md` overlapper med vilje ikke: forslaget spesifiserer stack,
datamodell, milepæler og risiko, mens briefen holder seg til opplevelsen og utfallet.
Se [`wiki/kurs/proposal.md`](wiki/kurs/proposal.md).

`product-brief.md` er **generert** fra den kanoniske BMAD-artefakten i
`.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/`, som også inneholder
`addendum.md` og beslutningsloggen `.memlog.md`. Rediger kjøremappa, ikke rotfila, og kjør
`./scripts/sync-brief.sh`.

## Prosess

Prosjektet følger **BMAD Method v6.12.0**: Product Brief → PRD → UX + Arkitektur →
Epics & Stories → Implementering. Rammeverket ligger i `_bmad/` med 39 skills under
`.claude/skills/`. Der ligger også `ponytail`-skillene, som alltid er på ved kodeoppgaver.
De holder KI-generert kode til den minste endringen som løser oppgaven helt, uten å kutte
krav, tester eller sikkerhet.

Prompter arkiveres underveis i [`prompting/`](prompting/README.md) — refleksjonsrapporten
krever eksplisitt at alle stegene dokumenteres, og det lar seg ikke rekonstruere i etterkant.

## Utvikling

Krever Node.js 22.13 eller nyere (testet på 22 og 26) og git. Ingen database å installere,
ingen nøkkel og ingen konto: appen bruker innebygd PGlite i `.data/local` som standard.

```bash
npm install
npm run dev                 # http://localhost:3000, helsesjekk på /api/health
```

Variablene står i [`.env.example`](.env.example). Kopier den til `.env.local` for å endre noe.

CI kjører de samme skriptene på Node 22 og 26, uten nøkkel:

```bash
npm run lint                # ESLint, inkludert lagreglene mellom src/app, src/server og src/lib
npm run format:check        # Prettier (npm run format retter)
npm run typecheck           # next typegen + tsc
npx drizzle-kit check       # migrasjonene i drizzle/ henger sammen
npm test                    # Vitest: enhets- og integrasjonstester, uten nettverk
npx playwright install chromium   # én gang
npm run test:e2e            # Playwright mot next build && next start
```

Databaseskjemaet ligger i `src/server/db/schema.ts`. `npm run db:generate` skriver SQL til
`drizzle/`, og `npm run db:migrate` kjører migrasjonene mot `DATABASE_URL`. PGlite-databaser
migreres automatisk første gang appen bruker databasen. Stopp `npm run dev` før
`npm run db:migrate` (én prosess per PGlite-mappe), start dev på nytt etter `db:generate`, og
slett `.data/` for å nullstille den lokale databasen.

## Dokumentasjon

All prosjektdokumentasjon ligger i [`wiki/`](wiki/index.md) — emnekrav og vurdering,
tidsplan, BMAD-faser, produktidé og beslutningslogg.

Nyttige skript:

```bash
./scripts/sync-brief.sh     # regenererer product-brief.md fra BMAD-kjøremappa
./scripts/scan-cohort.sh    # ser hva andre grupper i emnet har levert, og hvor
```
