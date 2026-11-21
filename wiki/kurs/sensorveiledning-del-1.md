# Sensorveiledning del 1 — hvordan koden vurderes (70 %)

> Kilde: **«Sensorveiledning – Del 1. Applikasjon og prosess (70 %)», høst 2026**, 7 sider,
> under Moduler → Prosjektoppgaven i Canvas (lagt ut 2026-10-06). Lest i sin helhet 2026-11-21.
> Før det bygde notatet på sitatene i faglærers tilbakemelding på briefen. Se [[ibe160]] og
> [[kunngjoringer]].
>
> Veiledningen kaller seg *«et støtteverktøy for faglig skjønn, ikke en mekanisk sjekkliste»*.
> Kravene vurderes mot ambisjonsnivået gruppa har valgt.

## Kriteriene

| # | Kriterium | Vekt i del 1 | ≈ av total | Kort beskrivelse (fra veiledningen) |
|---|-----------|-------------:|-----------:|-------------------------------------|
| 1 | **Prosess og KI-styring** | 30 % | 21 % | Sporbar vei fra plan til kode: commits, prompts, iterasjoner og beslutninger |
| 2 | **Funksjonalitet og omfang** | 20 % | 14 % | Hva appen gjør, sett mot proposal og valgt oppgave |
| 3 | **Kvalitetssikring og testing** | 15 % | 10,5 % | Tester, kodegjennomgang og retting av KI-generert kode |
| 4 | **Design og brukeropplevelse** | 10 % | 7 % | Visuelt uttrykk, konsistens, brukervennlighet og tilgjengelighet |
| 5 | **Kodekvalitet og arkitektur** | 10 % | 7 % | Lesbar, strukturert og sammenhengende kode |
| 6 | **README og kjørbarhet** | 10 % | 7 % | Tydelig beskrivelse av hvordan appen installeres og kjøres |
| 7 | **Ryddighet i repoet** | 5 % | 3,5 % | Struktur, riktige filer, ingen hemmeligheter eller byggeartefakter |

Kriterium 1, 6 og 7 (prosess og etterprøvbarhet) er til sammen **45 %**. Kriterium 2–5
(produktet) er 55 %.

**Karakteren beregnes slik:** hvert kriterium får en bokstav som regnes om til tall (A = 5 …
F = 0). Tallene vektes og summeres. Terskler: A ≥ 4,5, B ≥ 3,5, C ≥ 2,5, D ≥ 1,5, E ≥ 0,5.
Sensor kan avvike fra summen, men må begrunne det.

## Slik går sensor fram

1. Leser den godkjente **proposal og product brief**, for å vite hva gruppa lovet. For oss er
   det briefen (og PRD-en).
2. **Kloner repoet og sjekker ut siste commit før fristen.** Senere endringer telles ikke.
3. **Installerer og starter appen på en ren maskin, bare etter README.** Hvert steg som mangler
   eller feiler, noteres. Sensor bruker **15–20 minutter**. Det en vanlig bruker ikke kan løse
   ved hjelp av README, regnes som feil ved README. Kjører ikke appen, vurderes funksjonaliteten
   fra kode, tester, skjermbilder og video, men det trekker tydelig ned på kriterium 6 og setter
   et tak på kriterium 2.
4. Tester kjerneflytene, også **feil input og uventet bruk**.
5. Vurderer designet, gjerne på flere skjermstørrelser.
6. Leser historikken med `git log` og GitHub Insights: fordeling over tid, commit-meldinger,
   **branches, pull requests og issues**.
7. Leser BMAD-dokumentene, prompts, beslutninger og QA-dokumentasjon, og **sjekker at de
   henger sammen med koden**.
8. **Kjører testene slik README beskriver**, og vurderer hva de faktisk tester.
9. Stikkprøver koden.

## Hva sensor ser etter, per kriterium

**1. Prosess og KI-styring.** BMAD-dokumenter som faktisk er *brukt og oppdatert*, ikke
generert én gang. Kode som kan spores til krav og stories, og forklarte avvik fra planen. Jevn
historikk med små commits og beskrivende meldinger. **Arbeidsflyt med branches, pull requests,
issues eller tilsvarende.** Lagrede prompts og KI-økter, med eksempler på at gruppa har
presisert, avvist eller rettet KI-forslag. Begrunnede beslutninger. Ujevn commit-fordeling gir
ikke trekk alene, siden parprogrammering er vanlig.
*A–B: «flere tydelige eksempler på at gruppen har vurdert, korrigert og styrt KI kritisk».*

**2. Funksjonalitet og omfang.** Kjerneflytene i proposal og README virker fra start til slutt.
Omfang og kompleksitet som datalagring, flere roller og regler som ikke er trivielle. Appen
tåler feil input og gjentatte handlinger. **Det som er utelatt eller endret, er beskrevet og
begrunnet.**

**3. Kvalitetssikring og testing.** Automatiserte tester som kan kjøres etter README og tester
meningsfull logikk. Manuelle testplaner der automatikk ikke passer. **Spor av kodegjennomgang**,
som PR-kommentarer eller beskrivelser av feil funnet i KI-kode og hvordan de ble rettet.
Feilhåndtering, validering av input, og ingen hemmeligheter i koden.

**4. Design og brukeropplevelse.** Konsistente farger, typografi og komponenter. Tydelig
navigasjon. Forståelige feilmeldinger og **tomtilstander**. **Universell utforming**: kontrast,
tastaturnavigasjon, alt-tekst og skjemaetiketter. Tilpasning til skjermstørrelser. Spor av
designarbeid som skisser, wireframes og UX-dokumenter.

**5. Kodekvalitet og arkitektur.** Mappestruktur som samsvarer med den beskrevne arkitekturen.
Lite duplisering og død kode, og **ingen utkommenterte rester etter KI-forsøk**. Konsekvent
stil, gjerne med **linter eller formatterer**.

**6. README og kjørbarhet.** Sjekkliste fra veiledningen:
- hva appen gjør og for hvem, gjerne med skjermbilde
- forutsetninger **med versjoner**, som Node.js og database
- installasjon og oppstart steg for steg, med kommandoer som kan kopieres
- miljøvariabler, med en **`.env.example` uten ekte hemmeligheter**
- testdata eller testbrukere, og **hvordan testene kjøres**
- oversikt over mappestrukturen og lenker til planleggings- og prosessdokumentasjonen
- tilpasset og oppdatert, ikke en uendret mal

**7. Ryddighet i repoet.** Tydelig skille mellom kode og dokumentasjon. En `.gitignore` som
holder ute `node_modules`, build og lokale filer. Ingen hemmeligheter i repoet eller
historikken. Ingen løse testfiler eller backuper i rota.

## Varseltegn sensor skal undersøke

- Nesten all kode lagt inn i én eller noen få commits rett før fristen
- Planleggingsdokumenter som beskriver en annen app, eller som tydelig er laget i etterkant
- Kommandoer i README som ikke virker
- Committede nøkler eller `.env`-filer, eller `node_modules` og build-mapper i repoet
- Tester som feiler eller tester trivielle ting
- Død kode og rester fra forkastede KI-forsøk
- Generell dokumentasjon av KI-bruk som ikke kan knyttes til konkrete endringer

## Hva dette betyr for Toppsvar

**1. Arbeidsflyt med branches og PR-er teller.** Det kolliderer med regelen vår om bare å
jobbe på `main` (se [[beslutninger]], 2026-09-13). Veiledningen sier «eller tilsvarende», så
`main` gir ikke automatisk trekk. Men PR-er gir også spor av kodegjennomgang (kriterium 3).
**Avgjort 2026-11-21:** én branch og én PR per epic. Se [[beslutninger]].

**2. Commit oftere.** Faglærer påpekte at «nesten alt skjedde 13.–14. september». Sensor leser
commit-historikken som bevis på prosess. Implementeringen bør komme som mange små commits over
de siste to ukene, ikke som én stor.

**3. Trinn 1 først.** Kjerneflyten skal være stabil før trinn 2 påbegynnes. Det som utelates,
må stå begrunnet i README. Inndelingen står i den reviderte briefen og i PRD-en.

**4. Hver funksjon trenger et testbart kriterium.** Faglærer foreslo selv fire, og de står nå i
briefen:
- en deltaker kan gjenåpne og utvide svaret sitt via samme lenke
- etter at innsamlingen er lukket, avvises nye svar
- ingen tabell lagrer tidspunkt eller rekkefølge som kobler svar til token
- uten LLM-nøkkel kan verten gruppere manuelt og spille hele runden

Supplér med enhetstester for poeng, rangering og token. Test også feil input, siden sensor
prøver det.

**5. Skisser gjennomgangsflaten.** Den er den mest krevende flaten. Den hører hjemme i
UX-fasen. Tilgjengelighet og tomtilstander må være med.

**6. Én dommer-modul**, som brukes både til gruppering og til gjettematching.

**7. Demomodus uten nøkkel.** Sensor har ikke vår API-nøkkel og bruker bare 15–20 minutter.
Hele flyten må virke uten nøkkel, også gjettematching. Det krever demodata og hurtigbufrede
dommer-svar. Kunngjøringen 2026-11-19 sier at README skal nevne hvilke API-nøkler som trengs.
README bør derfor si begge deler: at appen kjører uten nøkkel, og hvilken nøkkel som slår på
KI-dommeren, med `.env.example` som mal.

**8. Bestem hvor data ligger.** ProtoQA-data og merkede testdata trenger en fast plass.
**Ingen svar om ekte personer committes**, så housewarming-svarene blir i `.idea/`.

**9. Lagre KI-korreksjoner underveis.** Når vi avviser eller retter et KI-forslag, skal det
noteres i `prompting/` eller i commit-meldingen. Det er dette A–B på kriterium 1 krever.

## Knyttet til fasene

| Kriterium | Hvor det avgjøres |
|-----------|-------------------|
| 1 Prosess | Hele veien: wiki, `prompting/`, `.memlog.md`, commits, eventuelt PR-er |
| 2 Omfang | Brief (trinn) → PRD (FR-prioritet) → epics |
| 3 Testing | PRD (akseptkriterier) → stories → kode + CI |
| 4 Design | UX-dokumentene (`DESIGN.md`, `EXPERIENCE.md`) |
| 5 Arkitektur | Arkitekturdokumentet, pluss linter og formatterer |
| 6 Kjørbarhet | Arkitektur (demomodus) → README |
| 7 Ryddighet | Arkitektur (mappestruktur, `.env.example`, `.gitignore`) |
