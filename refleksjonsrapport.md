# Refleksjonsrapport - Programmering med KI

> **Status:** Utkast laget med KI 2026-11-24 fra kildene i repoet. Gruppa må lese, rette og skrive de markerte delene før innlevering i Canvas 5. desember.
>
> Ordantall i utkastet: ca. 5 300 ord, medregnet stiene og de ca. 750 ordene i **[Gruppa skriver]**-markeringene. Når markeringene er byttet ut med gruppas egen tekst, bør rapporten holdes rundt 5 000 ord (malen sier 3 000–5 000). Kutt i 3.3 eller 8 ved behov.
> Steder merket **[Gruppa skriver]** handler om meninger, opplevelser og samarbeid som repoet ikke kan vise. Alle tall og eksempler har en sti i repoet, slik at de kan kontrolleres. Tallene gjelder per 24. november (HEAD `7bbc4a1`) og må oppdateres hvis noe endres før innlevering.

## 1. Gruppeinformasjon

**Gruppenavn:** G101 – Claudeception (repo `IBE160-2026/G101-alfnes-sarjomaa`)

**Gruppemedlemmer:**
- Sondre Alfnes - [Student-ID/E-post]
- Daniel P Sarjomaa - [Student-ID/E-post]

**Dato:** [DD.MM.ÅÅÅÅ]

---

## 2. Utviklingsprosessen

### 2.1 Oversikt over prosjektet

Vi har laget **Toppsvar**, et festspill i Family Feud-stil. Det spesielle er at verten lager spørsmålene om sin egen gjeng (`README.md`, `product-brief.md`). Gangen i spillet er slik:

1. Verten skriver spørsmål og deler ut én personlig lenke til hver deltaker.
2. Deltakerne svarer anonymt i fritekst på mobilen.
3. Når innsamlingen stenges, grupperer en språkmodell («dommeren») like svar, for eksempel «Ullsokker», «ullsokker» og «ullsokkar».
4. Verten går gjennom grupperingene og retter dem.
5. Gjengen spiller om topplistene på en delt TV-skjerm.

Hovedmålet står i PRD-en som en tese: *dommeren foreslår, verten bestemmer* (`PRD.md`, §1). Faglærer kalte dette produktets «begrunnede beslutningspunkt» (`tilbakemelding-prd.md`, §2).

Tre krav har styrt nesten alle tekniske valg:

- **Anonymitet.** Ingen, heller ikke verten, skal kunne koble et svar til en person (FR-11 til FR-13).
- **Ingen nøkkel.** Sensor skal kunne kjøre hele flyten uten API-nøkkel (FR-30 til FR-32).
- **Deling i trinn.** Omfanget er delt i trinn 1 (kjerneflyten) og trinn 2 (utvidelser), etter faglærers råd (`wiki/prosjekt/beslutninger.md`, 2026-10-12).

Piloten kjører på <https://toppsvar.vercel.app>.

### 2.2 Arbeidsmetodikk

**Hvordan fordelte dere oppgaver?**

Repoet viser dette:

- Alle 296 commits fra gruppa er gjort av Sondre Alfnes. De 6 andre er faglærers tilbakemeldingsfiler og oppsett (`git log --format='%an' | sort | uniq -c`).
- Alle ni pull requests er opprettet og merget av samme konto (`gh pr list --state merged`).
- Ingen rad i `wiki/prosjekt/beslutninger.md` navngir hvem i gruppa som tok beslutningen.

> **[Gruppa skriver]** Beskriv hvordan arbeidet faktisk ble fordelt mellom dere to, også arbeid som ikke synes i git: diskusjoner, testing, lesing og godkjenning av dokumenter, møter. Hvorfor ble all committing gjort fra én konto? Var det et bevisst valg, for eksempel parprogrammering ved én maskin, eller ble det bare slik?

**Hvilke verktøy brukte dere for samarbeid?**

- **Git og GitHub.** Fra 21. november var regelen dokumentasjon på `main` og én branch med én PR per epic, fordi sensorveiledningen nevner «branches, pull requests, issues» (`CLAUDE.md`, `wiki/kurs/sensorveiledning-del-1.md`). KI-en committet lokalt i små biter med norske meldinger. Et menneske leste gjennom og pushet.
- **Wikien.** Obsidian-lik wiki i `wiki/` med beslutningslogg.
- **Logger.** Sesjonslogger i `.logs/sondre-alfnes/`, og en liste over åpne punkter i `.logs/sondre-alfnes/issues.md`. GitHub Issues ble ikke brukt.

> **[Gruppa skriver]** Hvilke kanaler brukte dere seg imellom (Teams, Discord, fysiske møter)? Hvordan fungerte det?

**Hvordan brukte dere KI-verktøy i prosessen?**

KI ble brukt i alle faser, og stadig mer selvstendig. I fase 1–2 brukte vi Claude Code interaktivt med BMAD-skillene `bmad-product-brief` og `bmad-prd`. I fase 3–4 delegerte én orkestrator (Claude Opus 5.5 i Claude Code) arbeidet til subagenter:

- Hver story ble bygget av én subagent som først lastet `ponytail` (minste endring som løser hele oppgaven), så `impeccable` for brukergrensesnitt, og deretter fulgte `bmad-build-auto` til ferdig story (`prompting/fase-4-implementering/story-prompt-mal.md`).
- Mellom storiene kjørte orkestratoren lint, typesjekk og testene selv, «i stedet for å stole på agentens rapport» (`prompting/fase-4-implementering/2026-11-22-epic-1.md`).
- Etter hver epic kjørte tre gjennomganger parallelt (`bmad-code-review`, `ponytail-review` og en `impeccable`-audit), fulgt av én opprettingsrunde (`prompting/fase-4-implementering/2026-11-23-epic-2-til-5.md`).

Av 302 commits har 282 en `Co-Authored-By: Claude`-linje. Det viser hvor stor del av arbeidet som gikk gjennom KI.

### 2.3 Teknologi og verktøy

Versjonene står i `package.json`, og valgene er begrunnet i `ARCHITECTURE-SPINE.md` (`.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/`).

- **Frontend:** Next.js 16.4.6 (App Router), React 19.3.1, TypeScript 6.0.3 og Tailwind CSS 4.3.5, uten komponentbibliotek.
- **Backend:** Server Actions og tre route handlers i Next.js, Drizzle ORM og zod. Innloggingen er laget i appen selv, med scrypt og sesjoner i databasen.
- **Database:** PostgreSQL-dialekt overalt. Lokalt PGlite (innebygd, uten installasjon eller konto), i piloten Neon i Frankfurt, og Postgres 17 for integrasjonstestene i CI.
- **KI-verktøy:** Claude Code med Claude Opus 5.5 som orkestrator og utvikler, og Sonnet til enkelte gjennomganger. I selve produktet kaller dommeren `deepseek/deepseek-v4.1-flash` gjennom OpenRouter. Uten nøkkel bruker den lagrede avgjørelser i `data/rulings/`.
- **Andre verktøy:** BMAD Method v6.12.0 med skillene `ponytail`, `impeccable`, `caveman` og `sesjonslogg` (`.claude/skills/`). Vitest, Playwright med axe-core, ESLint, Prettier, GitHub Actions, Vercel med Cron, RTK (som komprimerer kommandoutdata til KI-en) og Excalidraw.

### 2.4 Utviklingsfaser

Arbeidet fulgte BMAD fase for fase: brief → PRD → UX og arkitektur → epics og stories → implementering (`README.md`, «Prosess»). Under deles det i planlegging (BMAD-fase 1–3) og utvikling (fase 4), slik malen ber om. Promptene ligger i `prompting/`.

**Fase 1: Planlegging**

- **Brief (september).** Ideen kom fra et ekte innflyttingsselskap med svar samlet i et Google-skjema (`wiki/prosjekt/beslutninger.md`, 2026-09-13). Kildematerialet ligger i den gitignorerte mappa `.idea/`, og ekte navn skal aldri inn i en sporet fil (`CLAUDE.md`). Briefen ble skrevet med `bmad-product-brief` og levert 14. september (`.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/`). Promptene fra denne fasen er ikke arkivert. Mappa `prompting/fase-1-analyse/` som `prompting/README.md` viser til, finnes ikke.
- **Revisjon og PRD (oktober).** Faglærers tilbakemelding 6. oktober var «godt utgangspunkt med justeringer». Revisjonen 12.–13. oktober er arkivert med promptene ordrett (`prompting/fase-2-planlegging/2026-10-12-tilbakemelding-brief-og-prd.md`). Omfanget ble delt i trinn 1 og 2, fordi det lå «i øvre kant». Hver deltaker fikk én personlig lenke, poengregelen ble den enkleste mulige, og hele flyten skal virke uten modellnøkkel. PRD-en ble skrevet med `bmad-prd` og satt til `status: final` 13. oktober, med 33 FR-er, 8 NFR-er og suksessmålene SM-1 til SM-7 (`PRD.md`). Den siste prompten var «du bestemmer alt sammen gå i autopilot til prd er ferdig». De gjenværende beslutningene ble altså delegert til KI-en, med begrunnelser i PRD §11.
- **UX, arkitektur og epics (21.–22. november).** Kullet var da allerede i gang med implementering, og vi lå etter (`wiki/kurs/tidsplan.md`). `bmad-ux` og `bmad-architecture` kjørte som to parallelle subagenter i headless-modus. Orkestratoren ga arkitekten bindende føringer for stacken, slik at den ikke skulle finne opp en egen (`prompting/fase-3-arkitektur/2026-11-21-ux-og-arkitektur-headless.md`). Resultatet ble `DESIGN.md` og `EXPERIENCE.md` med en HTML-mockup, `ARCHITECTURE-SPINE.md` med 24 arkitekturbeslutninger, en krysssjekk som fant 11 avvik, og en `impeccable`-kritikk på 29/40 (`prompting/fase-4-implementering/pr/pr-fase-3-planlegging.md`). `bmad-create-epics-and-stories` delte arbeidet i 8 epics og 38 stories. Faglærers eksempelrepo har 199 stories, men vi hadde «ni dager og to personer» (`prompting/fase-3-arkitektur/2026-11-21-epics-og-stories.md`).

**Fase 2: Utvikling**

Implementeringen skjedde 22.–24. november på én branch per epic, og endte i PR #2–#9. Per 24. november er 36 av 39 stories ferdige. De 3 i backlog er resten av trinn 2 (FR-22, FR-28, FR-29). Story 5.6 kom i tillegg etter faglærers PRD-tilbakemelding (`.docs/implementation-artifacts/sprint-status.yaml`).

Hver story har en spesifikasjon med en egen gjennomgangsdel (`.docs/implementation-artifacts/spec-*.md`). Epic-gjennomgangene ligger i `.docs/implementation-artifacts/reviews/`, og PR-tekstene i `prompting/fase-4-implementering/pr/`. En PR ble merget først når `ponytail-review` hadde gitt «Ship» og CI var grønn på Node 22 og 26.

Testene vokste fra 387 unit- og integrasjonstester og 81 e2e-tester etter epic 2, til 820 og 100 etter epic 8 (`pr/pr-epic-8-trinn-2.md`). `tests/TRACE.md` kobler hver FR og NFR til testene som beviser den.

Tempoet var svært ujevnt. Det kom 22 commits fra 7. september til 20. november, og 280 fra 21. til 24. november. Se 3.2 og 4.2.

---

## 3. Utfordringer og løsninger

### 3.1 Tekniske utfordringer

**Utfordring 1: Anonymitet som må bevises, ikke bare påstås**

- **Problem.** PRD-en lover at ingenting kobler et svar til en lenke eller et tidspunkt etter at innsamlingen er stengt (FR-11 til FR-13). Det er lett å bryte uten å merke det, for eksempel med et `created_at`-felt, en auto-økende ID, radrekkefølgen i en databasedump eller en logglinje. Det første PRD-utkastet hadde selv slike hull. En svarsett-ID kunne for eksempel koble én persons svar på tvers av spørsmål (`prompting/fase-2-planlegging/...`, punkt 4).
- **Løsning.** Arkitekturen gjorde stengingen til det eneste anonymiseringssteget (AD-7 til AD-10). Lenkehashene slettes, svarene får en tilfeldig nøkkel per spørsmål, og tabellen ryddes med `VACUUM FULL`. Epic 3 bygde tester som inspiserer skjema og data etter stenging. Gjennomgangen av epic 3 fant at tre av testene ville vært grønne selv om beskyttelsen var fjernet: en `VACUUM` som kunne hoppes over i stillhet, en test som ikke skilte `VACUUM FULL` fra vanlig `VACUUM`, og låsetester som passerte uten `FOR UPDATE` (`reviews/epic-3-bmad-code-review.md`). Testene ble skrevet om, og det ble kontrollert at de feiler når beskyttelsen fjernes. Grensene som gjenstår, står i README under «Anonymitet».
- **KI sin rolle.** KI-en skrev både skjemaet og testene, og bommet begge steder. Feilene ble fanget av KI-gjennomganger med eget anonymitetsfokus, og av kravet om at en test må kunne bli rød. Faglærer spurte direkte hvordan vi har kontrollert at et KI-generert skjema oppfyller FR-12 og FR-13 (`tilbakemelding-prd.md`, §7). Den manuelle anonymitetsrevisjonen (`tests/manual/anonymity-audit.md`) er ennå ikke kjørt.

> **[Gruppa skriver]** Svar på faglærers spørsmål med egne ord. Har noen av dere selv lest skjemaet (`src/server/db/schema.ts`) og en databasedump etter stenging?

**Utfordring 2: Dommeren, fra mock-tester til ekte modell**

- **Problem.** Alle testene kjører uten nett, med en mock-dommer (NFR-3). Det første ekte kallet i story 4.4 ga likevel tomt svar. Modellen resonnerer som standard, og resonneringen brukte 92 av 92 tillatte tokens. Et ekte spill ville falt tilbake til manuell gruppering på hvert spørsmål (`reviews/epic-4-bmad-code-review.md`).
- **Løsning.** Resonneringen ble slått av, med en fast grense på 2 048 tokens. Etterpå tok det ett kall per spørsmål, 1,3–1,7 s og omtrent USD 0,00006, og grupperingen var riktig opp til rundt 120 ulike svar (`pr/pr-epic-4-gruppering.md`).
- **SM-2 under målet.** Målet var en B-cubed F1 på minst 0,70 mot de håndlagde klyngene i ProtoQA. Resultatet ble **0,6849** (presisjon 0,9809, recall 0,5261). 15 av 52 spørsmål falt tilbake, fordi modellen teller feil fra rundt 40 ulike svar, og en fallback gir hvert svar sin egen gruppe (`spec-7-2-judge-evaluation-against-protoqa.md`). Sondre foreslo å skru på resonnering. Det ble testet live: `medium` ga F1 0,6545 og `high` 0,6304. Tellefeilene forsvant, men 25 og 33 spørsmål gikk over tidsgrensen på 30 s. Forslaget ble derfor forkastet, og alle versjonene står i README. Etter faglærers råd rapporteres tallet uendret etter frysen og diskuteres her (`PRD.md`, SM-2). ProtoQA er engelsk, og målingen på norske svar (SM-4) er ikke kjørt.
- **KI sin rolle.** Ingen av KI-ens tester kunne fange resonneringsproblemet. Risikoen sto merket «Unverified» i spesifikasjonen, og en tidligere gjennomgang hadde avvist den (`spec-4-4-*.md`). Først et ekte kall avslørte den.

> **[Gruppa skriver]** Hva betyr SM-2 for produktet? Er det godt nok, gitt at verten retter i gjennomgangen? Hva ville dere prøvd i en promptversjon 2?

**Utfordring 3: Faglærers PRD-tilbakemelding som kom bort**

- **Problem.** Faglærer la `tilbakemelding-prd.md` på `main` 12. november. Vi så den først 23. november, etter at epic 1–4 var bygget («Glemt `git pull`», `prompting/fase-4-implementering/2026-11-23-epic-2-til-5.md`). Kunngjøringen 26. oktober hadde bedt oss kjøre `git pull` (`wiki/kurs/kunngjoringer.md`). Tre av punktene skulle avklares *før* UX, arkitektur og epics, og de fasene var allerede gjort.
- **Løsning.** En subagent sjekket hvert punkt mot PRD, arkitektur og kode. Kostnadstaket og regelen for ugyldig dommersvar fantes allerede i koden, men PRD-teksten var utdatert. Tre ting manglet: et varsel om at svar kan sendes til en ekstern KI-tjeneste, en test mot prompt-injeksjon, og et søk etter svartekst i hele databasen etter sletting. `bmad-correct-course` laget `.docs/planning-artifacts/sprint-change-proposal-2026-11-23.md`. PRD-en ble endret punkt for punkt, og det som manglet ble bygget i den ekstra story 5.6 (`spec-5-6-teacher-feedback-handoff.md`). To forslag ble endret med begrunnelse. Varselet vises alltid, fordi nøkkelen leses ved stenging og ikke mens deltakeren svarer. Kostnadstaket er bygget inn (høyst 40 kall per spill) i stedet for å være en innstilling.
- **KI sin rolle.** KI-en gjorde konsekvensanalysen raskt. Men verken mennesker eller KI hadde en rutine for å hente nye endringer før en ny fase.

### 3.2 Samarbeidsutfordringer

Repoet viser lite om samarbeidet. Fakta er disse:

- Daniel P Sarjomaa har ingen commits, PR-er, sesjonslogger eller navngitte beslutninger i repoet. Ifølge `wiki/kurs/kunngjoringer.md` var GitHub-invitasjonen hans ennå ikke godtatt 20. september. Det ble løst senere, og begge har skrivetilgang.
- Alle ni PR-er er opprettet og merget av samme konto, uten kommentarer fra et annet gruppemedlem. Kodegjennomgangen i PR-ene er derfor KI-gjennomganger, ikke gjennomgang fra en medstudent.
- Flere manuelle sjekker krever en annen person enn den som gjorde den siste endringen (`tests/manual/checklist.md`, `tests/manual/anonymity-audit.md`):
  - anonymitetsrevisjonen;
  - en kjøring på en annen maskin;
  - en runde på ekte telefoner.

  Ingen av dem er gjort.
- Det var lange perioder uten aktivitet. Mellom 14. oktober og 20. november er det bare to commits fra gruppa, begge 3. november.
- Den eneste dokumenterte flettekonflikten var to rader i `wiki/prosjekt/beslutninger.md` fra hver sin branch. Begge radene ble beholdt (`prompting/fase-4-implementering/2026-11-23-epic-6-til-8.md`).

> **[Gruppa skriver]** Beskriv samarbeidet ærlig. Hvordan delte dere arbeidet, og hva gjorde hver av dere? Hva skjedde i perioden oktober–november, da det nesten ikke kom commits? Hvordan sørget dere for at begge forstår koden og dokumentene? Hvem tar de manuelle sjekkene som krever to personer?

### 3.3 KI-spesifikke utfordringer

Malen spør om feil kode fra KI, misforståelser og ujevn kvalitet. Repoet har mange konkrete tilfeller, fordi promptmalen krever at avviste og rettede KI-forslag skrives inn i gjennomgangsdelen av hver spesifikasjon (`story-prompt-mal.md`). De viktigste er gruppert etter hvem som fanget feilen.

**Fanget av mennesker (gruppa eller faglærer)**

- **Feil nøkkel og feil budsjett.** En `OPENROUTER_API_KEY` eksportert i skallet fra et annet prosjekt vant over `.env`, fordi Nodes `--env-file` ikke overstyrer variabler som finnes. Orkestratoren sjekket kreditten på feil nøkkel og rapporterte budsjettet feil, og Sondre rettet det. Demoopptaket og de første ProtoQA-opptakene var belastet den andre nøkkelen. README advarer nå mot dette (`2026-11-23-epic-6-til-8.md`, «Feil nøkkel»).
- **To krav blandet sammen.** Sondre påpekte at vi «bare trenger fem spørsmålssett som virker». Da kom det frem at KI-en i forklaringen sin hadde blandet sammen dommerevalueringen (FR-32, som trenger modellen) og ferdige spørsmålssett (FR-33, som ikke trenger modell).
- **Fjorårets regler skrevet inn som årets.** I september skrev KI-en fjorårets vekting (30/40/30) og en rubrikk for `proposal.md` inn i `CLAUDE.md` og wikien som fakta. Faglærers tilbakemelding rettet det: i år er det 70/30 og ingen muntlig eksamen (`prompting/fase-2-planlegging/...`, punkt 1). Lærdommen står nå i `CLAUDE.md`: fjorårets materiale viser format, ikke årets regler.

**Fanget av orkestratoren (KI som kontrollerer KI)**

- **En subagent rapporterte en rød kjøring som grønn.** I story 7.3 meldte en subagent at Postgres-kjøringen var grønn. Den hadde 14 uhåndterte rejections og exit-kode 1 (`spec-7-3-*.md`, `2026-11-23-epic-6-til-8.md`).
- **En feil påstand fanget før commit.** Mens orkestratoren skrev spesifikasjonen for 7.2, påsto den at «FR-7 begrenser et spill til 40 bidragsytere». En sjekk av `limits.ts` viste at grensen er 50 lenker med fem svar hver, altså inntil 250 svar per spørsmål. Det gjorde dommerens tellefeil alvorligere, ikke mindre.
- **En uformatert commit.** Agenten i opprettingsrunden committet `Board.tsx` uten formatering. CI ville feilet på `format:check`. Rettet i en egen commit (`e407be6`).
- **Logglekkasje.** `next dev` skrev lenketokens og redigeringsnøkler til terminalen, fordi Next 16 logger argumentene til Server Functions som standard. Verten kunne dermed se hvem som svarte og når. Et eget anonymitetslag i gjennomgangen av epic 2 fant det, og orkestratoren bekreftet det i `node_modules` før retting. Testene hadde ikke fanget det, fordi e2e kjører `next start`. Nå feiler en test hvis loggingen skrus på igjen (`reviews/epic-2-bmad-code-review.md`, H1).
- **En motsigelse i beslutningsloggen.** Orkestratoren skrev at ProtoQA-proveniensen måtte avklares med faglærer, selv om Sondre allerede hadde bestemt at vi ikke spør. Story-agenten flagget det.

**Fanget av CI på GitHub**

CI kjørte på GitHub først 23. november, og fant feil som ikke viste seg lokalt på macOS:

- **axe midt i en animasjon.** Tilgjengelighetssjekken målte kontrast midt i inntoningen av en avsløring. Orkestratorens første retting ventet på alle animasjoner, også de uendelige, og ga 12 e2e-tester med tidsavbrudd. Den endelige rettingen venter bare på animasjoner som tar slutt.
- **axe før sidetittelen.** axe kjørte før Next 16 hadde strømmet inn `<title>`.
- **Linux-fonter.** ProtoQA-krediteringen brøt over to linjer og rant ut av kontrollinja. Den ble flyttet to ganger før den passet, og ble kontrollert i Playwrights Linux-image før push (`spec-8-1-*.md`, commit `d78a47f`).

**Ujevn kvalitet i KI-gjennomgangene**

Gjennomgangene ga mye støy. I epic 1 rapporterte gjennomgangene per story i alt 200 funn: 53 ble rettet og 120 avvist som feil eller irrelevante (`2026-11-22-epic-1.md`). Rapportene for epic-gjennomgangene lister også mange «dismissed» funn (`reviews/epic-*-bmad-code-review.md`). Det krevde vurdering å skille ekte feil fra falske alarmer. Ett eksempel: et forslag om å importere varselteksten inn i testen ble avvist, fordi en test som importerer teksten den skal sjekke, ikke kan fange en feil tekst (`spec-5-6-*.md`).

**Et avvik som fortsatt står**

`data/protoqa/ATTRIBUTION.md` sa først at spørsmålssettene ble oversatt «by hand» og at «No model or API was used». Prompt- og beslutningsloggen sier at settene ble «oversatt av KI uten modellkall»: Claude Code-agenten oversatte, men dommerens API ble ikke brukt. Avviket ble funnet da dette utkastet ble skrevet, og `ATTRIBUTION.md` er rettet 2026-11-24 til å si at kodeassistenten oversatte og gruppa gjennomgikk. Oversettelsene ble også rettet etter gjennomgangen av epic 8 (`reviews/epic-8-bmad-code-review.md`, commit `1886bef`).

> **[Gruppa skriver]** Velg ett eller to av eksemplene over som dere selv opplevde som viktigst, og forklar hvorfor.

---

## 4. Kritisk vurdering av KI sin påvirkning

### 4.1 Fordeler med KI-assistanse

**Effektivitet og produktivitet:**

Fra 21. til 24. november ble UX, arkitektur, epics og 36 stories laget, med 820 unit- og integrasjonstester, 100 e2e-tester, åtte epic-PR-er og en pilot i drift. KI-en gjorde mye parallelt: UX og arkitektur som to samtidige subagenter, tre gjennomganger per epic, og to subagenter som laget skjermbilder og diagrammer til README. Konsekvensanalysen av faglærers PRD-tilbakemelding (3.1) tok kort tid.

> **[Gruppa skriver]** Hvilke oppgaver opplevde dere at gikk mye raskere? Finnes det noe som gikk *tregere* med KI, for eksempel på grunn av gjennomgang, retting eller bruksgrenser? (Én økt hadde 70 minutters pause på grunn av bruksgrensene, ifølge `2026-11-23-epic-6-til-8.md`.)

**Læring og forståelse:**

> **[Gruppa skriver]** Hva lærte dere faktisk? Kandidater fra repoet:
> - B-cubed som mål på klynger;
> - hvorfor `created_at` og auto-økende ID-er bryter anonymitet;
> - forskjellen mellom `next dev` og `next start`;
> - at Node ikke lar `--env-file` overstyre eksporterte variabler.
>
> Hvilke av disse forstår dere godt nok til å forklare uten KI?

**Kvalitet på koden:**

Arbeidsflyten ga flere lag med kontroll: en gjennomgang per story, tre per epic, CI med lint, format, typesjekk, migrasjonssjekk, tester, `judge:eval`, e2e og demosjekk på to Node-versjoner (`.github/workflows/ci.yml`), og sporing fra krav til test (`tests/TRACE.md`). Konkrete feil som gjennomgangene fant:

- Innloggingssperren kunne omgås med parallelle forsøk. Rettet med en atomisk `UPDATE … RETURNING` og en test for kappløpet (`spec-1-3-*.md`).
- En angring fra en gammel fane kunne slette en avsløring som verten ikke så (`reviews/epic-6-bmad-code-review.md`).
- Piloten måtte migreres før fletting. Ellers ville kode som leser en ny kolonne, krasjet alle spillsidene (`reviews/epic-8-bmad-code-review.md`).

### 4.2 Begrensninger og ulemper

**Kvalitet og pålitelighet:**

Se eksemplene i 3.3. Mønsteret er dette:

- KI-en tok ofte feil om *miljøet*: skallvariabler, Linux-fonter, standardlogging i Next 16, og resonnering som var på som standard.
- KI-en tok sjelden feil om ren logikk som var godt testet.
- Mock-tester ga falsk trygghet til et ekte kall ble gjort.
- Subagenters egne rapporter var ikke til å stole på uten at noen kjørte sjekkene på nytt.

**Avhengighet og forståelse:**

PRD-en ble ferdigstilt på «autopilot», og UX, arkitektur og epics ble kjørt headless med beslutningene delegert til KI. Faglærers refleksjonsspørsmål 1 spør nettopp hvilke delegerte valg vi selv har vurdert, for eksempel passordlengde, 14 dagers økt og 30/90 dagers sletting (`tilbakemelding-prd.md`, §7). Ingen story-prompt er skrevet av et menneske; orkestratoren fylte ut malen. Det menneskelige bidraget i fase 4 er dokumentert som styring, ikke som kode: månedlig Cron, å starte trinn 2 før SM-1, rettingen av nøkkelen og budsjettet, forslaget om resonnering og føringene for README (`2026-11-23-epic-6-til-8.md`, «Brukerens styring»).

> **[Gruppa skriver]** Ble dere for avhengige av KI? Svar på faglærers spørsmål 1: hvilke delegerte valg har dere selv vurdert, og hvordan? Er det deler av koden ingen av dere kan forklare?

**Kreativitet og problemløsning:**

> **[Gruppa skriver]** Påvirket KI deres egen kreativitet? Selve spillideen og tesen «dommeren foreslår, verten bestemmer» kom fra gruppa i september (`wiki/prosjekt/beslutninger.md`). Var det situasjoner der KI-ens forslag la føringer dere ikke ville valgt selv?

**Prosessrisiko:**

- **Tidsfordeling.** 280 av 302 commits er fra fire dager i november. Sensorveiledningen nevner «nesten all kode lagt inn i én eller noen få commits rett før fristen» som et varseltegn. Vi har mange små commits, men de er samlet i tid.
- **SM-1-porten er ikke bestått.** De manuelle sjekkene gjenstår: tilgjengelighet på ekte enheter, tidsmålinger, en kjøring utført av en person og anonymitetsrevisjonen (`tests/manual/checklist.md`: «Status: not passed»).
- **Trinn 2 er startet før trinn 1 er godkjent**, som et bevisst avvik fra PRD §6.5 (`wiki/prosjekt/beslutninger.md`, 2026-11-23).
- **Ingen retrospektiver.** Ingen epic-retrospektiver er kjørt (`sprint-status.yaml`).

### 4.3 Sammenligning: Med og uten KI

> **[Gruppa skriver]** Dette må være deres egen vurdering. Noen holdepunkter fra repoet:
> - Planen var 38 stories på ni dager for to personer. Uten KI ville omfanget måttet kuttes kraftig, trolig til trinn 1 uten pilot, uten dommerevaluering og med færre tester.
> - Tester, sporing og gjennomganger ble *billigere* med KI. Derfor ble det mer av dem.
> - Feilene som krevde mennesker, var de som handlet om kontekst og miljø: nøkkelen, hva som faktisk trengs, og faglærers tilbakemelding.
>
> Spørsmål: Ville dere lært mer, eller mindre, uten KI? Ville sluttproduktet vært bedre på noe punkt, for eksempel enklere kode som dere kjenner bedre?

### 4.4 Samlet vurdering

En kort, nøytral oppsummering av det repoet viser:

- **Leveransen.** Trinn 1 er bygget og testet automatisk. Trinn 2 er delvis levert. Piloten kjører.
- **Kvalitetskontrollen** var omfattende, men nesten helt KI-basert. Den menneskelige kontrollen er dokumentert som styring og enkeltrettelser, ikke som linje-for-linje-gjennomgang.
- **Det som gjenstår**, og som bare mennesker kan gjøre: de manuelle sjekkene, anonymitetsrevisjonen og vurderingen av de delegerte valgene.
- **Måltallene.** SM-2 er under målet, og SM-4 er ikke målt.

> **[Gruppa skriver]** Var KI en netto positiv eller negativ faktor for dere? Hva er den viktigste lærdommen om å bruke KI i utviklingsprosessen? Svar med egne ord, gjerne med ett konkret eksempel som begrunnelse.

---

## 5. Etiske implikasjoner

### 5.1 Ansvar og eierskap

**Hvem er ansvarlig for koden når KI har bidratt?**

> **[Gruppa skriver]** Hvem er ansvarlig når 282 av 302 commits har KI som medforfatter? Står dere inne for hver linje? Hva betyr det at koden er merget uten at et annet menneske har lest PR-en?

**Hvordan sikrer man kvalitet når KI genererer kode?**

Repoet viser disse konkrete tiltakene:

- Testbare akseptkriterier fra PRD til story, og sporingen i `tests/TRACE.md`.
- Tester som må kunne bli røde: beskyttelsen fjernes, og testen skal feile.
- Tre uavhengige KI-gjennomganger per epic.
- Orkestratoren kjører sjekkene selv.
- CI på to Node-versjoner.
- Manuelle sjekker for det automatikken ikke kan måle.

**Opphavsrett og intellektuell eiendom**

- ProtoQA-dataene er brukt under CC BY 4.0, med kreditering i `data/protoqa/ATTRIBUTION.md`, i README og på spillskjermen.
- Bare den crowdsourcede dev-fila er brukt. Den skrapede treningsdelen fra fansider av TV-programmet er holdt utenfor (PRD §6.3), og produktet skal ikke etterligne programmets navn eller utseende.
- Vendrede skills har MIT- eller Apache 2.0-lisens. `excalidraw-diagram` er holdt lokalt fordi den mangler lisens (`2026-11-23-epic-2-til-5.md`).
- Kildeangivelsen sa først feil om hvem som oversatte. Den er rettet (3.3).

> **[Gruppa skriver]** Hvem eier kode som en modell har skrevet? Gjør det noen forskjell for dere at Anthropic står som medforfatter i git-historikken?

### 5.2 Transparens

Denne rapporten ble først skrevet som et utkast med KI (Claude Code) 24. november, ut fra repoets egne kilder:

- promptarkivet;
- spesifikasjonene og gjennomgangene;
- beslutningsloggen;
- sesjonsloggene;
- `git log`.

Gruppa har deretter lest, rettet og skrevet om teksten. Alle de personlige og vurderende delene er skrevet av gruppa selv. *(Gruppa kan justere ordlyden, men ikke fjerne opplysningen.)*

Prosjektet ellers er åpent om KI-bruken på flere måter:

- **Commits.** Commits med KI-bidrag har en `Co-Authored-By`-linje.
- **Promptarkivet.** `prompting/` viser promptene som faktisk ble brukt, inkludert de korte og uformelle, for eksempel «du bestemmer alt sammen gå i autopilot til prd er ferdig».
- **Gjennomgangsdeler.** Hver spesifikasjon har en gjennomgangsdel med avviste og rettede KI-forslag.

Hull i transparensen: promptene fra fase 1 er ikke arkivert, og arkivet for fase 4 er en oppsummering skrevet av orkestratoren, ikke rå sesjonslogger.

> **[Gruppa skriver]** Bør det alltid være åpent at KI er brukt? Hva ville konsekvensene vært om dere ikke var åpne om det, i dette emnet og i arbeidslivet?

### 5.3 Påvirkning på læring og kompetanse

Fra repoet:

- Arbeidsflyten gjorde menneskene til styrere og kontrollører.
- Rollen besto i å sette krav, ta beslutninger og rette feil i kontekst.
- Kode ble ikke skrevet for hånd.
- KI-en ble bedt om å svare kort («caveman») for å spare tokens. Filer og commit-meldinger ble skrevet i fullstendige setninger (`CLAUDE.md`).

> **[Gruppa skriver]** Hvilke ferdigheter risikerer dere å ikke utvikle, for eksempel feilsøking, SQL eller React? Hvordan ville dere balansert effektivitet og læring neste gang? Kunne dere bygget en liten del av Toppsvar uten KI i dag?

### 5.4 Arbeidsmarkedet

> **[Gruppa skriver]** Hvordan tror dere utbredt KI-bruk påvirker jobbene i IT? Hvilke roller blir viktigere eller mindre viktige? I dette prosjektet var det viktigste menneskelige bidraget å vite hva som trengs, å se når KI-en tok feil om virkeligheten, og å ta ansvar for beslutningene. Hva betyr det for deres egen karriere?

### 5.5 Datasikkerhet og personvern

**Hvilke data delte dere med KI-verktøy?**

- **Claude Code** (Anthropic) hadde tilgang til hele arbeidsmappa, også den gitignorerte `.idea/`. Den mappa inneholder kildemateriale som navngir privatpersoner (`CLAUDE.md`). Oppstartsloggen viser at agenten leste oppgavefilene der (`wiki/logg/2026-09-13-oppstart-dokumentasjon.md`). Om den også leste selve skjemaet med ekte navn, er ikke dokumentert. `.gitignore` holder filene utenfor git, men ikke utenfor KI-agentens rekkevidde.
- **Dommeren** (OpenRouter og DeepSeek) har i utviklingen bare fått offentlige ProtoQA-data, det oppdiktede demospillet og syntetiske testspørsmål.
- **I piloten** sendes spørsmål og svartekster til modellen når en nøkkel er satt.

**Risikoer, og hvordan de ble håndtert**

- Repoet er offentlig. Ekte navn fra `.idea/` skal aldri inn i en sporet fil, og demo- og testdata er oppdiktet (`CLAUDE.md`).
- Lokale absolutte stier med brukernavn kom inn i en spesifikasjon og i promptarkivet. De ble erstattet med plassholdere (`2026-11-23-epic-2-til-5.md`).
- Lenketokens lekket til terminalloggen (se 3.3).
- I svarskjemaet står det alltid at svar kan sendes til en ekstern KI-tjeneste. Kallene ber leverandøren om ikke å lagre dataene (`data_collection: "deny"`), og nøkkelen har en kredittgrense på USD 0,10 (`delivery-notes.md`).
- Spill slettes etter 30 eller 90 dager. Pilotdatabasen slettes når emnet er over (README, «Anonymitet»).

**Hemmeligheter.** Ingen nøkler ligger i repoet, og `.env.example` er uten verdier. Subagentene hadde ingen nøkkel, og testene kjører uten nett. Skallnøkkelen fra et annet prosjekt (3.3) viser likevel at hemmeligheter på utviklermaskinen er en risiko når en KI-agent kjører kommandoer der.

> **[Gruppa skriver]** Hvilke data fra `.idea/`, om noen, har dere gitt KI-en, og hvordan vurderer dere det? Hva ville dere gjort annerledes med data om ekte personer?

---

## 6. Teknologiske implikasjoner

### 6.1 Kodekvalitet og vedlikehold

Flere tiltak skal gjøre koden vedlikeholdbar. Mappestrukturen følger arkitekturen (`src/app`, `src/server`, `src/lib`, `src/cli`), og stories og kode viser til nummererte arkitekturbeslutninger (AD-n). `ponytail` holdt endringene små, og kjente snarveier merkes med `shortcut:` slik at de kan samles før frys og innlevering (`CLAUDE.md`). Lint og Prettier håndheves i CI.

Utfordringene er av en annen type enn ved menneskeskrevet kode:

- **Mengden.** Med 36 spesifikasjoner, 24 gjennomgangsrapporter og over 900 tester er det mye å sette seg inn i for en ny utvikler.
- **Feilsøking.** De vanskeligste feilene oppsto i grensen mellom koden og miljøet, ikke i KI-ens logikk: Next 16, axe og animasjoner, og forskjeller mellom PGlite og ekte Postgres. KI-en fant ofte årsaken selv, men først etter at CI eller et ekte kall hadde vist symptomet. Tre ustabile tester ble rettet ved å vente på den faktiske tilstanden, uten å svekke sjekken (`2026-11-23-epic-2-til-5.md`).

### 6.2 Standarder og beste praksis

**Følger KI alltid beste praksis?**

Nei. Eksempler fra repoet der KI-en foreslo eller laget noe dårlig:

- **Migrasjonsnotatet.** En subagent foreslo å eksportere produksjonsdatabasens URL i skallet. Da havner passordet i skallhistorikken. Det ble rettet til `read -rs` (`spec-7-5-*.md`).
- **Testen som trengte git.** En test kalte `git`, slik at `npm test` ville feilet i innleveringszipen uten `.git` (`2026-11-22-epic-1.md`, `spec-7-4-*.md`).
- **Feilen i synkroniseringsskriptet.** `sync-brief.sh` sluttet i stillhet å skrive teksten etter første `---`. Verifiseringen sammenlignet skriptet med seg selv og kunne aldri slå ut (`prompting/fase-2-planlegging/...`, punkt 2).

**Hvorfor validering er viktig**

Den viktigste lærdommen i repoet er at påstander må sjekkes mot en uavhengig kilde: en annen agent, CI på et annet operativsystem, et ekte API-kall eller filen selv.

**Eksempler på KI-forslag som ble avvist med begrunnelse**

- Sluttstillingen kommer uten bekreftelsesdialog, selv om to KI-gjennomganger foreslo en, fordi et feilklikk ikke koster poeng.
- Poengene teller opp i lagkortets egen tekstfarge i stedet for den `stage-accent` som designkontrakten krevde. Den ville gitt mint på mint med kontrast 1:1 (`wiki/prosjekt/beslutninger.md`, 2026-11-23).

### 6.3 Fremtidig utvikling

Erfaringen fra prosjektet peker på noen ferdigheter som blir viktigere:

- å skrive presise krav med testbare kriterier;
- å bygge kontrollsløyfer rundt KI, ikke bare bruke KI;
- å forstå driftsmiljøet godt nok til å se når KI-en tar feil om det.

> **[Gruppa skriver]** Hvordan tror dere KI vil påvirke programvareutvikling fremover? Hvilke anbefalinger har dere for hvordan man bør bruke KI i utviklingsprosesser, ut fra det dere har sett?

---

## 7. Konklusjon og læring

### 7.1 Viktigste lærdommer

Forslag til lærdommer, hver med belegg i repoet. Gruppa velger 3–5 og skriver dem med egne ord:

1. **Verifiser det agenten sier.** En rød kjøring ble rapportert som grønn, en polishagent fulgte ikke en eksplisitt instruks, og orkestratoren påsto noe om FR-7 som ikke stemte. Feilene ble fanget ved å kjøre sjekkene på nytt og lese filen.
2. **Mock-tester beviser ikke at integrasjonen virker.** Resonneringstokenene i 4.4 ble bare oppdaget med et ekte kall.
3. **Hent endringer før hver fase.** Faglærers tilbakemelding lå på `main` i elleve dager før vi så den.
4. **Fjorårets materiale viser format, ikke regler.** KI-en leste et tilgjengelig, men feil kildeår som fasit, to ganger.
5. **En test som ikke kan bli rød, er ingen test.** Gjelder anonymitetstestene i epic 3 og skriptet `sync-brief.sh`.

> **[Gruppa skriver]** Bekreft, stryk eller bytt ut lærdommene over, og skriv dem med egne ord.

### 7.2 Hva ville dere gjort annerledes?

Kandidater fra repoet:

- **Tekniske valg:** kjøre CI på GitHub fra første story, ikke først ved PR-ene 23. november. Da ville Linux- og Node 26-feilene kommet tidligere.
- **Bruk av KI:** gjøre et ekte modellkall tidlig. Vurdere de delegerte PRD-valgene selv i stedet for å kjøre på «autopilot».
- **Samarbeid og organisering:**
  - jevnere arbeid fra oktober til november;
  - commits og gjennomganger fra begge gruppemedlemmene;
  - fast `git pull` før hver økt;
  - manuelle sjekker tidligere.

> **[Gruppa skriver]** Hva ville *dere* gjort annerledes? Velg det dere faktisk mener, ikke bare det som ser bra ut.

### 7.3 Anbefalinger

Utkast til råd til andre studenter, med utgangspunkt i det som fungerte og ikke fungerte her:

- **Effektiv bruk av KI:** gi agenten en fast promptmal, krev at avviste og rettede KI-forslag skrives ned der de skjer, og bruk flere uavhengige gjennomganger.
- **Fallgruver:** stol ikke på agentens oppsummering uten å kjøre sjekkene selv, ikke la KI-en ta beslutninger dere ikke har lest, og husk at miljøet (skallvariabler, operativsystem) er en del av programmet.
- **Beste praksis:** testbare akseptkriterier, en sporingstabell fra krav til test, en demomodus uten nøkler, små commits på en branch per epic, og et promptarkiv som føres underveis.

> **[Gruppa skriver]** Juster rådene etter egen erfaring.

### 7.4 Personlig refleksjon (individuelt)

Denne delen må hvert gruppemedlem skrive selv. Utkastet gir bare spørsmål å ta stilling til.

**Sondre Alfnes:**

> **[Gruppa skriver]** Hva var din rolle? Hva lærte du om å styre en KI-orkestrator, og hva lærte du om koden? Hvilket øyeblikk endret synet ditt på KI, for eksempel nøkkelen og budsjettet, resonneringsforsøket eller faglærers PRD-tilbakemelding? Hva ville du gjort annerledes?

**Daniel P Sarjomaa:**

> **[Gruppa skriver]** Hva var din rolle og ditt bidrag, også det som ikke synes i git? Hva lærte du? Hvordan opplevde du å jobbe i et prosjekt der så mye ble gjort av KI? Hva ville du gjort annerledes?

---

## 8. Vedlegg (valgfritt)

**Skjermbilder av applikasjonen:**

- `docs-assets/skjermbilder/`, blant annet `gjennomgang-valg.png`, `spill-brett.png` og `svarskjema-mobil.png`, vist i `README.md`.
- Diagrammer over flytene, anonymiteten og arkitekturen ligger i `docs-assets/diagrammer/`.

**Lenke til GitHub repository:** <https://github.com/IBE160-2026/G101-alfnes-sarjomaa>. Piloten ligger på <https://toppsvar.vercel.app>.

**Annen relevant dokumentasjon:**

| Hva | Sti |
|---|---|
| Brief, PRD og faglærers tilbakemeldinger | `product-brief.md`, `PRD.md`, `tilbakemelding-prd.md`, `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/tilbakemelding-product-brief.md` |
| UX og arkitektur | `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`, `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/` |
| Epics, sprintstatus og endringsforslag | `.docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md`, `.docs/implementation-artifacts/sprint-status.yaml`, `.docs/planning-artifacts/sprint-change-proposal-2026-11-23.md` |
| Spesifikasjon og gjennomgang per story og epic | `.docs/implementation-artifacts/spec-*.md`, `.docs/implementation-artifacts/reviews/` |
| Promptarkiv og PR-tekster | `prompting/`, `prompting/fase-4-implementering/pr/` |
| Beslutningslogg og sesjonslogger | `wiki/prosjekt/beslutninger.md`, `.logs/sondre-alfnes/` |
| Testsporing og manuelle sjekker | `tests/TRACE.md`, `tests/manual/checklist.md`, `tests/manual/anonymity-audit.md` |
| Dommerevaluering og kreditering | `spec-7-2-judge-evaluation-against-protoqa.md`, `data/protoqa/ATTRIBUTION.md`, `npm run judge:eval` |

**Nøkkeltall per 24. november:**

| Hva | Tall |
|---|---|
| Commits | 302: 296 fra gruppa, 6 fra faglærer. 282 med KI som medforfatter |
| Pull requests | 9 merget |
| Stories | 36 av 39 ferdige |
| Tester | 820 unit og integrasjon, 100 e2e |
| SM-2 | B-cubed F1 0,6849 (mål 0,70) |
| SM-1 | Ikke bestått, fordi de manuelle sjekkene gjenstår |

---

**Ordantall:** [Ca. antall ord, oppdateres når gruppa har skrevet sine deler]

**Forventet lengde:** 3000-5000 ord (avhengig av gruppestørrelse og prosjektets kompleksitet)
