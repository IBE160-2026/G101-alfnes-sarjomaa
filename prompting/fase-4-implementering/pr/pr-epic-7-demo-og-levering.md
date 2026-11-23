# Epic 7: Demo og levering

Story 7.1–7.5: alt sensor trenger for å kjøre, måle og vurdere appen. `npm run demo` starter et oppdiktet spill uten nøkkel, `npm run judge:eval` måler dommeren mot ProtoQA uten nett, sporingen og de manuelle sjekkene er klare til SM-1-porten, README og zip-fila er ferdige, og piloten er dokumentert.

## Stories
| Story | Innhold | Review (funn: høy / medium / lav / falske) |
|-------|---------|--------------------------------------------|
| 7.1 | `npm run demo`: lager `.data/demo` på nytt, legger inn demoverten og «Hyttetur med gjengen» med 6 av 8 svarsett, og starter appen med lagrede avgjørelser. Demokjennelsen er tatt opp live med dommeren | 0 / 3 / 19 / 4 |
| 7.2 | `npm run judge:eval`: B-cubed mot ProtoQAs crowdsourcede utviklingssett (CC BY 4.0, med kildeangivelse). Et spørsmål dommeren feiler på, telles som én gruppe per svar, slik appen gjør | 0 / 2 / 31 / 3 |
| 7.3 | Sporingstesten feiler hvis et krav i trinn 1 mangler en test. Alle 23 operasjoner testes i alle 7 tilstander. Ny CI-jobb kjører integrasjonstestene mot Postgres. Manuelle sjekker og anonymitetsrevisjon er klare | 0 / 12 / 20 / 4 |
| 7.4 | README med tre kommandoer, miljøtabell, anonymitet og status. `scripts/make-zip.sh` lager innleveringen. Testet på en fersk klone: `npm install` og `npm run demo` virket, og innloggingen gikk gjennom | 1 / 6 / 20 / 7 |
| 7.5 | Piloten er sjekket uten endringer i produksjon og beskrevet i sjekklista (P1–P3) | 0 / 3 / 20 / 7 |

Hver spec har en review-seksjon med KI-forslag vi rettet eller avviste, og hvorfor.

## Dommeren mot ProtoQA (SM-2)
B-cubed F1 **0,6849** (presisjon 0,9809, gjenkalling 0,5261, 1,40 kall per spørsmål), prompt versjon 1 med `deepseek/deepseek-v4.1-flash`. Det er under målet på 0,70, men det feiler ikke SM-1. 15 av 52 spørsmål falt tilbake fordi modellen ga feil antall svar, alle med 40 eller flere ulike svar. Resonnering på `medium` og `high` ble prøvd: tellefeilene forsvant, men store spørsmål gikk over grensen på 30 s, og F1 ble 0,6545 og 0,6304. Ingen av dem er beholdt. Alle versjonene står i README og i spesifikasjonen for 7.2.

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/epic-7-*.md`, med «Epic 7 review fixes» nederst.
- **`bmad-code-review`:** 0 høy, 1 medium og 13 lave, alle rettet. Medium: `judge:eval --file` stoppet ved første feil i stedet for å falle tilbake per spørsmål.
- **`ponytail-review`:** «Ship», uten «must». Demo- og størrelsesspillet bruker nå én felles funksjon, en zip-test uten akseptansekrav er fjernet, og README-blokken om CI er kortet ned.
- **`impeccable` audit:** 18/20. Demopassordet ble delt over to linjer på mobil, demovarslene var feilaktig live-regioner, og etiketter i gjennomgangen brøt bokstav for bokstav på 360 px. Alt er rettet med e2e-sjekker.

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 810 passerer (1 hoppet over, den kjører bare i Postgres-jobben). `npm run test:e2e`: 99 passerer. `npm run judge:eval`: F1 0,6849.

## Ingen migrasjoner

## Gjenstår (krever mennesker)
- SM-1-porten er ikke bestått. Manuelle sjekker A1–A10, T1–T8, D1, F1 på en annen maskin og anonymitetsrevisjonen (SM-3) ligger i `tests/manual/`.
- Piloten: Vercel Cron og `CRON_SECRET` er ikke satt opp, så automatisk sletting kjører bare ved besøk. Runden på ekte mobiler (P2) gjenstår.
- Postgres-jobben i CI har bare kjørt lokalt før denne PR-en.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
