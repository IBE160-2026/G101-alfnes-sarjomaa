# Tilbakemelding på product brief

| | |
|---|---|
| **Gruppe** | G101 – G101-alfnes-sarjomaa |
| **Product brief** | `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md` (commit `f45bfce`) |
| **Tilbakemelding fra** | Faglærer i IBE160 (utarbeidet med KI-støtte) |
| **Dato** | 2026-10-06 |

## Samlet vurdering

- **Godt utgangspunkt med justeringer.** Gruppen kan gå videre og innarbeide punktene under.

Vi har vurdert den kanoniske briefen i `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md` sammen med `addendum.md`. Kopien `product-brief.md` i roten genereres fra denne med `scripts/sync-brief.sh`, og `proposal.md` er vurdert som bakgrunn. Det er en ryddig og godt dokumentert løsning.

En merknad: `CLAUDE.md` oppgir vektene 30 % kode, 40 % refleksjonsrapport og 30 % muntlig eksamen, trolig hentet fra fjorårets emne. For høsten 2026 gjelder 70 % for prosjektkode og funksjonalitet (del 1) og 30 % for refleksjonsrapporten (del 2), og det er ingen muntlig eksamen. Rett dette, slik at verken dere eller Claude Code prioriterer ut fra feil vekting.

**Det som er bra:**

1. Briefen bygger på en ekte og konkret situasjon: et Google-skjema fra en innflyttingsfest, rangerte svar som måtte skrives i ett tekstfelt, anonymitet som ble lovet mens innlogget konto sto synlig, og et brett som ble tegnet for hånd. Det gir en tydelig kjerneflyt (samle inn → gruppere → gjennomgå → spille) og en tydelig primærbruker (verten).
2. KI-delen er svært gjennomtenkt. Språkmodellen er «dommer» med verten som siste instans, det finnes manuell gruppering som reserve, og kvaliteten skal måles mot ProtoQA-klynger laget av mennesker («at least seven of every ten answers»). Addendum drøfter ikke-determinisme, promptsensitivitet og kostnad ved parvise sammenligninger. Det er nettopp den typen kritisk KI-styring emnet etterspør. Redigeringen av personopplysninger i addendum er også godt håndtert.

**De viktigste endringene:**

1. Omfanget i v1 er i øvre kant. Vertskonto, ferdig spørsmålssett fra ProtoQA, anonym innsamling med token, KI-gruppering, gjennomgangsflate med fem operasjoner (merge, split, rename, reorder, discard), spillvisning med assistert gjettematching og poeng for flere lag og sletting er 5–6 store funksjonsområder. Prioriter innenfor dem, slik at kjerneflyten blir ferdig og stabil først.
2. To av suksesskriteriene, «Host autonomy» med tre eksterne verter og «Repeat pull» innen fire uker, er vanskelige å nå og måle innenfor semesteret. Behold dem som pilotmål, men legg til funksjonelle kriterier som kan bli automatiske tester.
3. Avklar de åpne punktene som påvirker testbarheten: poengreglene («Not settled» i addendum), hvordan dobbeltinnsending skal hindres uten kontoer, og når grupperingen kjøres. Addendum omtaler også prosjektet som «five-week». Planlegg etter semesterets faktiske lengde.

## Vanskelighetsgrad og gjennomførbarhet

### Vurdert vanskelighetsgrad

- **Middels**

**Sammenlignbart med:** 7) Kurs-FAQ-chatbot (middels). Begge stiller store krav til kvaliteten i KI-svarene, med evaluering mot et referansesett. Toppsvar har i tillegg flere sammenhengende flater (innsamling, gjennomgang og spill), og ligger derfor i øvre del av middels. Vi er enige i deres egen vurdering («Medium»).

**Begrunnelse:**

| Faktor | Nivå (lav / middels / høy) | Kommentar |
|---|---|---|
| Domenelogikk – hvor mange og hvor kompliserte regler og beregninger må stemme? | middels | Rangering etter antall deltakere per gruppe, poengberegning, lukking av innsamling og regler for token og gjenåpning. Poengreglene er ikke bestemt. |
| Datamodell – antall entiteter og relasjoner mellom dem | middels | Vert, spill, spørsmål, deltaker-token, svar (rangert), gruppe, lag og runde/poeng, pluss ferdige spørsmålssett. |
| Brukere, roller og innlogging | middels | Bare verten logger inn. Deltakere bruker token i lenken. Anonymitet er et designkrav i seg selv. |
| KI-funksjonalitet i appen, f.eks. kall til språkmodell, prompts i koden og håndtering av usikre svar | høy | Parvis vurdering av om to svar betyr det samme, både ved gruppering og ved gjettematching i spillet, med kontroll av verten og måling mot ProtoQA. |
| Integrasjoner og eksterne tjenester, f.eks. API-er, betaling og e-post | middels | Språkmodell-API og import av ProtoQA (CC-BY-4.0). Ingen betaling. |
| Sanntid, samtidighet eller flere brukere som påvirker hverandre | lav | Innsamlingen er asynkron, og spillet kjøres fra én delt skjerm. Det er et klokt valg som unngår sanntid. |
| Filhåndtering, f.eks. opplasting, PDF-lesing og eksport | lav | Bare engangsimport av datasettet. |
| Sikkerhet og personvern | høy | Anonymitet er et kjernekrav («a reviewer with host access … cannot attribute any answer»), og svarene kan handle om navngitte personer og sensitive temaer. |

**Hva vanskelighetsgraden betyr for dere:**

- _Middels:_ Et godt balansert valg. Pass på at kjerneflyten blir ferdig og stabil før dere legger til mer.

### Gjennomførbarhet med BMAD og Claude Code

Dere skal planlegge med BMAD (product brief → PRD → arkitektur → epics og stories) og implementere med Claude Code. Vurderingen under tar hensyn til at det må være tid til hele denne flyten, og til testing, retting og README til slutt.

| Spørsmål | Vurdering (OK / risiko / stor risiko) | Kommentar |
|---|---|---|
| **Tid og omfang** – kan v1 realistisk bli ferdig og stabil i løpet av semesteret, med tid til flere iterasjoner? | risiko | Realistisk med prioritering. Alle 5–6 områdene fullt ut, i tillegg til evaluering mot ProtoQA, er mye for to personer. |
| **BMAD-flyten** – er briefen konkret nok til at PRD, arkitektur og stories kan lages uten store hull, og blir det overkommelig mange stories? | OK | Svært konkret. Addendum har allerede lagt ut åpne spørsmål til arkitekturfasen. |
| **Egnet for Claude Code** – bruker løsningen en vanlig, godt dokumentert teknologistakk som Claude Code håndterer godt, eller krever den nisjeteknologi, spesialmaskinvare eller mye manuell konfigurasjon? | OK | En webapp med skjemaer, database, LLM-kall og en presentasjonsvisning er godt egnet. |
| **Kontroll på KI-ens arbeid** – kan gruppen selv avgjøre om koden gjør det riktige? Krever domenet kunnskap gruppen ikke har, f.eks. avanserte beregninger eller fagregler, så er det vanskelig å kvalitetssikre. | OK | ProtoQA-klyngene gir en ekstern fasit, og dere kjenner selv humoren i testgruppen. Det er et sterkt grunnlag for kvalitetssikring. |
| **Testbarhet** – finnes det tydelige regler og forventede resultater som tester kan skrives mot? | OK | Gruppering kan måles mot ProtoQA, anonymitet kan testes på databasenivå, og poeng og rangering kan enhetstestes når reglene er bestemt. |
| **Kjørbar for sensor** – kan appen kjøres lokalt etter README, uten gruppens nøkler, betalte kontoer eller egen infrastruktur? | risiko | Manuell gruppering som reserve er et godt utgangspunkt. Sørg for at hele flyten, inkludert gjettematching, også virker uten nøkkel, og at ferdig spørsmålssett og demodata følger med. |
| **Avhengigheter og kostnader** – krever løsningen betalte API-er, f.eks. språkmodeller, og finnes det en plan for kostnad, testmodus eller mock-data? | risiko | Dere har pekt på kvadratisk vekst i antall parvise kall. Velg strategi i arkitekturen, og bruk lagrede svar (hurtigbuffer) eller mock-svar i tester og evaluering. |

**Konklusjon om gjennomførbarhet:**

- **Gjennomførbart med justert omfang.** Se forslagene under.

**Forslag til justering av omfang eller vanskelighetsgrad:**

1. Prioriter i trinn. Trinn 1 er vertskonto, egne spørsmål, anonym innsamling, KI-gruppering med gjennomgang (merge, split, rename) og spillvisning med enkel poengberegning. Trinn 2 er ferdig spørsmålssett fra ProtoQA, assistert gjettematching, reorder/discard og flere poengregler.
2. Velg de enkleste poengreglene for v1 (poeng proporsjonalt med antall svar i gruppen, uten strikes og steals), og en enkel løsning mot dobbeltinnsending, for eksempel én kode per deltaker. Mer kan legges til senere.

## Hvorfor product brief er viktig for mappen

Product brief er utgangspunktet for PRD, arkitektur, stories og til slutt koden. Del 1 av mappen vurderes blant annet på om sensor kan følge en sporbar vei fra plan til ferdig app. Den vurderes også på om appen gjør det dere har beskrevet, om den er testet, om den er godt designet, og om den kan kjøres etter README. Et uklart, for stort eller for lite brief gjør alt dette vanskeligere senere. Det er mye enklere å rette nå enn sent i semesteret.

## 1. Gjennomgang av briefens deler

| Del av brief | Status | Kommentar |
|---|---|---|
| Executive Summary – er det klart hva appen er, og hvilket problem den løser? | OK | Klart: et Family Feud-inspirert festspill om personene i rommet, der KI-gruppering erstatter en kveld med manuell opptelling. |
| The Problem – er problemet konkret, med reelle situasjoner og brukere? | OK | Svært konkret, med eksempler fra det faktiske skjemaet og ærlighet om at én gruppe ikke er nok til å generalisere. |
| The Solution – beskriver løsningen brukeropplevelsen, ikke bare teknologi? | OK | De fire delene (Starting, Collecting, Grouping, Playing) beskriver brukeropplevelsen tydelig. |
| What Makes This Different – er vurderingen ærlig og realistisk? | OK | Ærlig («There is no proprietary algorithm here»), med konkrete sammenligninger med Kahoot, Google Forms og eksisterende Family Feud-apper. |
| Who This Serves – er primærbrukerne tydelige, og vet vi hva de trenger? | OK | Verten er tydelig primærbruker, og deltakernes behov er beskrevet presist. |
| Success Criteria – kan kriteriene faktisk sjekkes eller testes? | Juster | «Grouping quality» og «Anonymity» er gode og målbare. «Host autonomy» og «Repeat pull» er pilotmål som kan bli vanskelige å nå innen fristen. Legg til funksjonelle kriterier som «en deltaker kan gjenåpne og utvide sitt svar via samme lenke», «etter at innsamlingen er lukket, avvises nye svar», «ingen tabell lagrer tidspunkt eller rekkefølge som kobler svar til token» og «uten LLM-nøkkel kan verten gruppere manuelt og spille hele runden». |
| Scope – er det klart hva som er med i første versjon, og hva som ikke er det? | Juster | Tydelig inn og ut, med gode begrunnelser. Prioriter innenfor «In for the first version», som foreslått over. |
| Vision – henger visjonen sammen med resten uten å blåse opp omfanget? | OK | Fadderuke og delt eierskap er tydelig fremtid, og målet på kort sikt er formulert smalt. |

## 2. Utgangspunkt for del 1 av mappen

Punktene følger kriteriene i sensorveiledningen for del 1. Vektene i parentes viser hvor mye hvert kriterium teller i del 1.

| Kriterium i del 1 | Hva briefen bør legge til rette for | Status | Kommentar |
|---|---|---|---|
| **1. Prosess og KI-styring** (30 %) | Brief som er presis nok til at PRD og stories kan bygges direkte på den, slik at krav kan spores fra brief til kode. | OK | Svært presis brief, med wiki, prompting-mappe og logg. Fortsett slik, og la commit-historikken vise jevn utvikling over tid. Hittil skjedde nesten alt 13.–14. september. |
| **2. Funksjonalitet og omfang** (20 %) | Realistisk omfang for gruppen og semesteret: en tydelig kjerneflyt som kan bli ferdig og stabil, og nok innhold til å vise reell funksjonalitet. | Juster | Rikelig funksjonalitet. Prioriter slik at kjerneflyten blir stabil før trinn 2. |
| **3. Kvalitetssikring og testing** (15 %) | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller. | OK | Evaluering mot ProtoQA og test av anonymitet er et svært godt grunnlag. Supplér med enhetstester for poeng, rangering og token. |
| **4. Design og brukeropplevelse** (10 %) | Tydelige brukere og brukssituasjoner som designet kan bygges rundt, gjerne med de viktigste skjermbildene eller flytene skissert. | OK | Tydelige flater: deltakerskjema på mobil, gjennomgangsflate for verten og spillbrett for TV eller projektor. Skisser særlig gjennomgangsflaten, som er den mest krevende. |
| **5. Kodekvalitet og arkitektur** (10 %) | Teknologivalg som er begrunnet og ikke mer komplekse enn appen trenger. | OK | Å unngå sanntid og deltakerkontoer er gode forenklinger. Hold «dommeren» som én modul som brukes både til gruppering og gjettematching. |
| **6. README og kjørbarhet** (10 %) | Løsning som andre kan kjøre lokalt uten betalte kontoer, og uten tilgang til gruppens egne tjenester og nøkler. | Juster | Manuell gruppering gir et godt utgangspunkt. Beskriv i arkitekturen en demomodus med ferdige data og hurtigbufrede dommer-svar, slik at sensor kan se KI-flyten uten nøkkel. |
| **7. Ryddighet i repoet** (5 %) | En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge. | Juster | Det er bra at uredigert skjema ligger i en gitignorert mappe. Bestem hvor ProtoQA-data og merkede testdata skal ligge, og sørg for at ingen svar om ekte personer committes. |

## 3. Neste steg for gruppen

1. Del «In for the first version» i trinn 1 og trinn 2, og legg til funksjonelle, testbare suksesskriterier ved siden av pilotmålene.
2. Avklar poengregler, tiltak mot dobbeltinnsending og når grupperingen kjøres, og rett «five-week» i addendum til semesterets faktiske ramme.
3. Gå videre til PRD, og beskriv i arkitekturen hvordan sensor kan kjøre hele flyten uten deres nøkkel.

Oppdater product brief i repoet når dere har gjort endringene, slik at historikken viser hvordan planen utviklet seg. Det er en del av prosessen sensor ser etter.
