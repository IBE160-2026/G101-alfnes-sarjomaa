# `proposal.md` — leveransen vi trodde ikke fantes

> **Korreksjon 2026-09-14.** Vi konkluderte tidligere med at `proposal.md` ikke var en reell
> leveranse, fordi ingen av de 132 repoene i `IBE160-2026` hadde en. Den konklusjonen var feil.
> Forrige års kull ligger i en **egen organisasjon**, `github.com/IBE160`, og der har
> **omtrent 48 av 54 repo** en `proposal.md`. Se [[kullet]].
>
> Lærdommen: et kull som ikke har nådd en milepæl ennå beviser ingenting om den milepælen.

## Hvorfor dette er den viktigste siden i wikien

I `IBE160/SG-Gruppe-14-d2/docs/data/proposal-checklist.yaml` ligger en **eksplisitt
vurderingsrubrikk på 100 poeng** for proposal-en, med karakterskala. Det er den eneste
konkrete vurderingsrubrikken vi har funnet for noen leveranse i dette emnet — alt annet
kursmateriale sier bare at «vanskelighetsgraden vil være en viktig del av sensuren».

Rubrikken forklarer dessuten noe som virket vilkårlig: de sju dimensjonene emneansvarlig
bruker på alle åtte prosjektforslagene i `Prosjektforslag_ Programmering med KI.pdf`
(Sikkerhet/innlogging, Kjøp/salg over nettet, Data inn, Data ut, Beslutningspunkter) er
ikke tilfeldige — **de er vurderingskriteriene for proposal-en**. Se [[prosjektforslag]].

## Rubrikken

| Kategori | Kriterium | Poeng |
|----------|-----------|------:|
| **Omfang (30)** | Scope Clarity — tydelige, målbare mål og klare grenser | 15 |
| | Scope Appropriateness — riktig størrelse for ~6 uker med KI-assistert utvikling | 15 |
| **Teknisk arkitektur (35)** | Frontend Specification — teknologivalg, rammeverk, designtilnærming | 7 |
| | Backend Specification — teknologivalg, API-design, arkitektur | 7 |
| | Database Specification — SQL/NoSQL, skjema, datamodell | 7 |
| | AI Integration — modeller, API-er, teknikker og bruksområder | 7 |
| | Platform Type — web/mobil/begge, målenheter | 7 |
| **Funksjonalitet (20)** | User Authentication — spesifisert *eller bevisst utelatt* | 5 |
| | Payment System — spesifisert *eller bevisst utelatt* | 5 |
| | Core Features Definition — listet, prioritert MVP mot nice-to-have | 10 |
| **Gjennomførbarhet (15)** | Technical Feasibility — velprøvd teknologi, egnet for KI-assistert utvikling | 8 |
| | Timeline and Milestones — ukentlige milepæler | 7 |

Karakterskala: 90–100 A, 80–89 B, 60–79 C, 50–59 D, 40–49 E, 0–39 F.

Regler som står eksplisitt i rubrikken:

- «Consider AI-assisted development accelerates coding but not architectural complexity»
- «1.5 months = ~6 weeks of development time»
- «Projects scoring < 70 should be discussed with instructor before proceeding»
- «Balance ambition with deliverability — incomplete projects score poorly»
- «Clarity is valued over cleverness — specific details are essential»

> **To poengiveringer verdt å merke seg:** både *User Authentication* og *Payment System*
> gir full score for å være **bevisst utelatt** når prosjektet ikke trenger dem. Full pott
> krever altså at man tar eksplisitt stilling, ikke at man bygger dem. Toppsvar har ingen
> betaling og ingen deltakerinnlogging — det må stå, ikke bare mangle.

## Struktur — bruk malen, ikke beergame-eksempelet

**Malen** er `IBE160/beergame/.grading/case-description-template.md` (261 ord), og det er
den fjorårets kull faktisk fulgte:

```
## Case Title
## Background                     [2-3 setninger om hvorfor appen trengs]
## Purpose                        [hvilket problem løses]
## Target Users                   [vær spesifikk om brukertype]
## Core Functionality
### Must Have (MVP)
### Nice to Have (Optional Extensions)
## Data Requirements              [hvilke dataenheter lagres, med felter]
## User Stories (Optional)        [As a X, I want Y, so that Z]
## Technical Constraints
## Success Criteria
```

Hvor ofte hver overskrift faktisk forekommer, av 44 innleverte proposals i fjor:
Purpose 34, Background 34, Target Users 33, Success Criteria 33, Core Functionality 33,
Data Requirements 32, Technical Constraints 28, Case Title 21, User Flows 18,
User Stories 19, Timeline and Milestones 9, Technical Specifications 9, Risk Assessment 4.

(`Case Title` står lavt bare fordi omtrent halvparten erstattet den med en `#`-overskrift
med det faktiske prosjektnavnet. Det er ikke et reelt avvik.)

**De sterke gruppene la til tre seksjoner utover malen**, og de svarer direkte på rubrikken:

- `## Technical Specifications` med underseksjonene `### Frontend`, `### Backend`,
  `### Database`, `### AI Integration`, `### Platform Type`, `### User Authentication` —
  **én til én med rubrikkens 35 arkitekturpoeng pluss autentiseringspoengene**
- `## User Flows` med nummererte `### Flow N: …`
- `## Timeline and Milestones` med ukentlige milepæler — 7 poeng i rubrikken

> **Ikke kopier beergame-proposalen.** `IBE160/beergame/proposal.md` er på **12 719 ord** og
> er emneansvarliges egen produktspesifikasjon, ikke oppgaveformatet. Bare to grupper fulgte
> den fullt ut. Malen er det som gjelder.

## Lengde — mye kortere enn eksempelet antyder

Fordelingen over 44 innleverte proposals i fjor:

| | Ord |
|---|---:|
| Korteste | 358 |
| 25-persentil | 766 |
| **Median** | **1 314** |
| 75-persentil | 2 321 |
| Lengste | 8 718 |

Emneansvarliges eget eksempel på 12 719 ord er nesten ti ganger medianen, og ingen kom i
nærheten. **Lengde forutsier ikke karakter:** gruppa med nest best muntlig-snitt i hele kullet
skrev en proposal på **494 ord**. Gruppa med den lengste, 8 718 ord, havnet under middels.

**Fornuftig mål for oss: 1 500–3 000 ord** — der de sterke gruppene klumper seg.

## Dette er ikke det samme dokumentet som briefen

| | `proposal.md` | `product-brief.md` |
|---|---|---|
| Formål | Få prosjektet godkjent | Fortelle produkthistorien |
| Teknologi | **Kreves** — stack, skjema, modeller | Bevisst utelatt |
| Tidsplan | **Kreves** — ukentlige milepæler | Nei |
| Risiko | **Kreves** | Nei |
| Lengde | 1 500–3 000 ord | 1–2 sider |
| Vurdering | 100-poengs rubrikk | BMADs kvalitetssjekkliste |

Briefen erstatter altså ikke proposal-en. De svarer på ulike spørsmål, og proposal-en er
den som har en tallkarakter knyttet til seg.

## Flere rubrikker finnes

`IBE160/beergame-frontend-only/planning/checklists/` inneholder fire rubrikker til, alle
100 poeng: `requirements-checklist.yaml`, `features-checklist.yaml`, `design-checklist.yaml`
og `architecture-checklist.yaml`. De hører til en alternativ, ikke-BMAD-pipeline
emneansvarlig også har dokumentert.

Arkitekturrubrikken er svært ambisiøs (trusselmodell, SBOM, RTO/RPO, canary-utrulling) og
ingen studentrepo viser tegn til å ha blitt vurdert mot den. Behandle dem som referanse for
hva som regnes som kvalitet, ikke som krav.

## Vår egen

`proposal.md` i rota, skrevet 2026-09-14, **2626 ord** — innenfor spennet der fjorårets sterke
grupper klumper seg (1500–3000).

Den følger `case-description-template.md` og legger til de tre seksjonene de sterke gruppene
la til: `## Technical Specifications` med én underseksjon per rubrikkpunkt, `## User Flows`
og `## Timeline and Milestones`. I tillegg `## Risk Assessment`.

To ting er gjort bevisst for rubrikkens skyld:

- **Autentisering og betaling er eksplisitt utelukket, ikke forbigått i stillhet.** Rubrikken
  gir full score (5 + 5) for bevisst utelatelse når prosjektet ikke trenger dem, men null for
  taushet. Teksten sier derfor rett ut at deltakere ikke har kontoer, og at det ikke finnes
  noe betalingssystem.
- **Teknologivalgene er konkrete, ikke vage.** Rubrikken sier «Clarity is valued over
  cleverness — specific details are essential», og 35 av 100 poeng henger på at frontend,
  backend, database, KI-integrasjon og plattform er navngitt hver for seg.

**Åpent punkt:** stacken (Next.js 15 + TypeScript + Tailwind på Vercel, route handlers som
backend, PostgreSQL på Supabase, Claude Haiku 4.5 bak et byttbart grensesnitt) er valgt ut fra
kursets `.gitignore`, emneansvarliges beergame-stack og hva fjoråret brukte. Den bør bekreftes
av begge gruppemedlemmer før fase 3.

## Forbehold

- Rubrikken og eksempelet er fra **forrige studieår**, funnet i et studentrepo. Sannsynligvis
  utdelt av emneansvarlig, men det er ikke bekreftet for årets kull.
- Ukenumrene i fjorårets eksempel (uke 44–48) er forskjøvet mot årets slide (uke 43–47).
  Strukturen er lik, tallene er det ikke.
- **Dette bør avklares med emneansvarlig**, sammen med tilbakemeldingen på den egendefinerte
  idéen som vi fortsatt ikke har bedt om. Se [[ibe160]].
