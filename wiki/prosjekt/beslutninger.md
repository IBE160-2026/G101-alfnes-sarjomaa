# Beslutningslogg

Kort logg over valg som er tatt, hvorfor, og hva alternativet var.
Nyeste øverst. Én rad = én beslutning som er vanskelig å utlede fra koden alene.

| Dato | Beslutning | Begrunnelse | Alternativ som ble valgt bort |
|------|------------|-------------|-------------------------------|
| 2026-10-12 | PRD-en ligger som briefen: kanonisk `prd.md` i BMAD-kjøremappa, og `PRD.md` i rota generert av `sync-brief.sh` | Tidsplanen navngir `PRD.md`, men BMAD skriver `prd.md` i en datert mappe. Samme løsning som for briefen, med samme script | Eget script per dokument; bare rotfil |
| 2026-10-12 | **Hele flyten skal virke uten modellnøkkel**: manuell gruppering, verten velger selv hvilken gruppe en gjetning treffer, og en demomodus med ferdige data og lagrede dommer-svar | Sensor har ikke vår nøkkel, og «README og kjørbarhet» er 10 % av del 1. Faglærer ba eksplisitt om dette | Kreve nøkkel for å kjøre appen; mocke bare i tester |
| 2026-10-12 | Grupperingen kjøres **én gang, når verten lukker innsamlingen**, og resultatet lagres | Dommeren er ikke-deterministisk, og brettet skal ikke endre seg under spillet. Addendum sa dette allerede i én seksjon og lot det stå åpent i en annen | Gruppering fortløpende ved hver innsending |
| 2026-10-12 | Dobbeltsvar hindres med **én personlig invitasjonslenke per deltaker**. Tokenet i lenken er koden, og det finnes ingen felles lenke | Faglærers forslag («én kode per deltaker»), og det gjenbruker tokenet briefen allerede hadde. Verten ser aldri hvilket svar som hører til hvilken lenke, og koblingen slettes ved lukking | Felles lenke med throttling per enhet (lett å omgå); deltakerkontoer (bryter anonymiteten) |
| 2026-10-12 | Poeng i v1: **antall deltakere som ga et svar i gruppen**, uten strikes, steal eller doblede runder | Faglærer anbefalte de enkleste reglene. Poengberegningen er enkel å enhetsteste | Full Family Feud-regelsett i v1 |
| 2026-10-12 | Scope delt i **trinn 1** (kjerneflyt) og **trinn 2** (ProtoQA-sett, assistert gjettematching, reorder/discard, flere poengregler) | Faglærer vurderte omfanget som «i øvre kant» og risikabelt for to personer. «Funksjonalitet og omfang» belønner en stabil kjerneflyt | Alt i v1 som likestilt |
| 2026-10-12 | Vektingen er rettet til **kode 70 %, rapport 30 %, ingen muntlig** | Infosiden i Canvas og faglærers tilbakemelding. 30/40/30 var fjorårets tall fra `beergame/.grading/` | — |
| 2026-09-14 | Stack: Next.js 15 + TypeScript + Tailwind på Vercel, route handlers som backend, PostgreSQL på Supabase, Claude Haiku 4.5 bak byttbart grensesnitt | Rubrikken krever navngitte valg for 35 av 100 poeng. Valgt ut fra kursets `.gitignore` (som allerede antar Next.js), emneansvarliges beergame-stack og fjorårets praksis | Python/FastAPI-backend som egen tjeneste; annen modellleverandør. **Ikke bekreftet av gruppa ennå** |
| 2026-09-14 | Autentisering og betaling **eksplisitt utelukket** i proposal, ikke forbigått | Rubrikken gir 5 + 5 poeng for bevisst utelatelse, men 0 for taushet | Å bare la være å nevne dem |
| 2026-09-14 | Oppretter `prompting/` og arkiverer prompter fra nå | Refleksjonsrapporten krever (40 % var fjorårets vekt, se 2026-10-12) eksplisitt «ALLE stegene dere gjorde». Fjorårets beste gruppe på dokumentasjon hadde et slikt arkiv. Kan ikke rekonstrueres ærlig i desember | Skrive rapporten fra hukommelse og git-historikk alene |
| 2026-09-14 | **Omgjort:** `proposal.md` skal lages likevel | Fjorårets kull (`github.com/IBE160`) har en i ~48 av 54 repo, emneansvarlig har sin egen i `beergame/.grading/`, og det finnes en 100-poengs vurderingsrubrikk for den. Den krever teknologistack, datamodell, tidsplan og risiko — som briefen bevisst utelater, så briefen erstatter den ikke. Se [[proposal]] | Den opprinnelige beslutningen under, som bygde på for tynt grunnlag |
| 2026-09-14 | ~~Lager **ikke** `proposal.md`~~ *(omgjort samme dag)* | Bygde på at ingen av de 132 repoene i årets kull har en. Feilen var å lese fravær hos et kull som ikke hadde nådd milepælen som bevis for at milepælen ikke fantes — fjoråret ble aldri sjekket | — |
| 2026-09-14 | `status: final` på `brief.md` og `addendum.md` | Fase 1 er levert. Samme vokabular (`draft` → `final`) skal brukes på `PRD.md`. G23 lot frontmatteren si `draft` i commiten som het «ferdigstille» — den feilen kopierer vi ikke | `done`, `complete`, `ready` (brukes om hverandre i kullet, ingen håndheving) |
| 2026-09-14 | Rot-fila `product-brief.md` leveres **uten** frontmatter | GitHub rendrer YAML-frontmatter som en tabell øverst på sida. Emneansvarliges eget eksempel har heller ingen frontmatter. Kjøremappa beholder den, siden BMAD-skillen krever den | Byte-identisk kopi (gir metadatatabell på leveransefila); droppe frontmatter overalt (bryter BMAD-skillen) |
| 2026-09-14 | Briefen ligger både i BMAD-kjøremappa og som `product-brief.md` i rota | Oppgaveteksten navngir `product-brief.md`; BMAD hardkoder `brief.md`. Kjøremappa er kanonisk, rotfila genereres av `sync-brief.sh` (uten frontmatter, se raden over) | Kun rotfil (signaliserer at rammeverket ikke er brukt), kun kjøremappe (feil filnavn), symlink (overlever ikke zip) |
| 2026-09-14 | Produktnavn: **Toppsvar** | ASCII uten mellomrom, så kjøremappenavn og shell-stier holder seg rene. G23 fikk `brief-COSI - MRP-…` og måtte URL-enkode overalt | Vennefeud, Gjengen, Lettis |
| 2026-09-14 | Primærbruker er **verten**, ikke deltakeren | All manuell smerte (skjema, purring, opptelling, brett, poeng) ligger hos verten. Deltakerens opplevelse i dag er allerede grei, så «The Problem» ville blitt tynn | Deltakeren som primærbruker; begge likestilt (BMAD advarer mot brede målgrupper) |
| 2026-09-14 | KI grupperer fritekstsvar, **verten overstyrer** før spill | Dette er emnets påkrevde «Beslutningspunkt». En feilgruppering blir ellers først synlig midt i spillet, foran gjengen, hvor den ikke kan reddes | Manuell gruppering (løser ikke hovedproblemet); full automatikk uten overstyring |
| 2026-09-14 | BMAD-artefakter skrives på **engelsk**, resten av repoet på norsk | Matcher emneansvarliges eget eksempel `product-brief-beergame.md` | Engelske overskrifter + norsk brødtekst (G23-formen); alt på norsk |
| 2026-09-14 | Innsamling er asynkron, spilling er live og samlokalisert | Følger av hvordan opphavsfesten faktisk foregikk, og sparer oss for live multiplayer-transport i et femukersprosjekt | Alt sanntid; alt asynkront |
| 2026-09-14 | Reelle navn fra kildeskjemaet anonymiseres i alt som spores | Repoet er offentlig på kursorganisasjonen, og skjemaet spøker om navngitte privatpersoners drikking uten deres samtykke | Ta med skjemaet ordrett |
| 2026-09-13 | Jobber kun på `main` — ingen feature branches | Liten gruppe, dokumenttunge leveranser; enklere historikk | Per-person feature branches (som referansegruppe G23 bruker) |
| 2026-09-13 | Produktidé: Family Feud med egne spørreskjema | Bygger på en reell, testet brukeropplevelse (innflyttingsfest); tydelig smertepunkt i dagens manuelle Google Forms-flyt | — |
| 2026-09-13 | Dokumentasjon i `./wiki` som Obsidian-lik vault | Lett å finne fram i, `[[wikilenker]]` binder notatene sammen, ingen verktøy-lås | Alt i README, eller `docs/`-mappe uten intern lenking |

## Åpne spørsmål

| Spørsmål | Hvorfor det haster |
|----------|--------------------|
| Bekrefter begge gruppemedlemmer stacken, og hvilken Claude-modell skal dommeren bruke? | Proposal-en sier Claude Haiku 4.5, men Claude 5-familien er ute. Stacken må også kunne kjøres lokalt uten Supabase-konto eller nøkkel. Avgjøres i arkitekturfasen |
| Forventes CI/CD og deploy? | Pensum del 5 dekker GitHub Actions og produksjonssetting, men verken sensorveiledningen eller tilbakemeldingen krever det. CI med tester styrker likevel kvalitetssikring og kjørbarhet |
| Finnes det en språkpolicy for leveransene? | Ingen i kursmaterialet. Vi valgte engelsk på BMAD-artefaktene, og faglærer kommenterte det ikke |

### Avklart

| Spørsmål | Svar |
|----------|------|
| ~~Har vi bedt om tilbakemelding på den egendefinerte idéen?~~ | Kom uoppfordret 2026-10-06: «Godt utgangspunkt med justeringer», Middels |
| ~~Hvordan leveres uke 43 konkret?~~ | Arbeidskravet er briefen i GitHub-repoet, frist 20. sept. Se [[ibe160]] |
| ~~Hvilke Family Feud-regler overlever til første versjon?~~ | Bare poeng etter antall svar. Se raden fra 2026-10-12 |
| ~~Hvordan hindres dobbeltsvar uten deltakerkontoer?~~ | Én personlig lenke per deltaker. Se raden fra 2026-10-12 |

## Mal for nye rader

```
| ÅÅÅÅ-MM-DD | <hva ble bestemt> | <hvorfor> | <hva ble valgt bort> |
```
