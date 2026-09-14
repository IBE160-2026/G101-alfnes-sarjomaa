# Beslutningslogg

Kort logg over valg som er tatt, hvorfor, og hva alternativet var.
Nyeste øverst. Én rad = én beslutning som er vanskelig å utlede fra koden alene.

| Dato | Beslutning | Begrunnelse | Alternativ som ble valgt bort |
|------|------------|-------------|-------------------------------|
| 2026-09-14 | Stack: Next.js 15 + TypeScript + Tailwind på Vercel, route handlers som backend, PostgreSQL på Supabase, Claude Haiku 4.5 bak byttbart grensesnitt | Rubrikken krever navngitte valg for 35 av 100 poeng. Valgt ut fra kursets `.gitignore` (som allerede antar Next.js), emneansvarliges beergame-stack og fjorårets praksis | Python/FastAPI-backend som egen tjeneste; annen modellleverandør. **Ikke bekreftet av gruppa ennå** |
| 2026-09-14 | Autentisering og betaling **eksplisitt utelukket** i proposal, ikke forbigått | Rubrikken gir 5 + 5 poeng for bevisst utelatelse, men 0 for taushet | Å bare la være å nevne dem |
| 2026-09-14 | Oppretter `prompting/` og arkiverer prompter fra nå | Refleksjonsrapporten er 40 % av karakteren og krever eksplisitt «ALLE stegene dere gjorde». Fjorårets beste gruppe på dokumentasjon hadde et slikt arkiv. Kan ikke rekonstrueres ærlig i desember | Skrive rapporten fra hukommelse og git-historikk alene |
| 2026-09-14 | **Omgjort:** `proposal.md` skal lages likevel | Fjorårets kull (`github.com/IBE160`) har en i ~48 av 54 repo, emneansvarlig har sin egen i `beergame/.grading/`, og det finnes en 100-poengs vurderingsrubrikk for den. Den krever teknologistack, datamodell, tidsplan og risiko — som briefen bevisst utelater, så briefen erstatter den ikke. Se [[proposal]] | Den opprinnelige beslutningen under, som bygde på for tynt grunnlag |
| 2026-09-14 | ~~Lager **ikke** `proposal.md`~~ *(omgjort samme dag)* | Bygde på at ingen av de 132 repoene i årets kull har en. Feilen var å lese fravær hos et kull som ikke hadde nådd milepælen som bevis for at milepælen ikke fantes — fjoråret ble aldri sjekket | — |
| 2026-09-14 | `status: final` på `brief.md` og `addendum.md` | Fase 1 er levert. Samme vokabular (`draft` → `final`) skal brukes på `PRD.md`. G23 lot frontmatteren si `draft` i commiten som het «ferdigstille» — den feilen kopierer vi ikke | `done`, `complete`, `ready` (brukes om hverandre i kullet, ingen håndheving) |
| 2026-09-14 | Rot-fila `product-brief.md` leveres **uten** frontmatter | GitHub rendrer YAML-frontmatter som en tabell øverst på sida. Emneansvarliges eget eksempel har heller ingen frontmatter. Kjøremappa beholder den, siden BMAD-skillen krever den | Byte-identisk kopi (gir metadatatabell på leveransefila); droppe frontmatter overalt (bryter BMAD-skillen) |
| 2026-09-14 | Briefen ligger både i BMAD-kjøremappa og som `product-brief.md` i rota | Oppgaveteksten navngir `product-brief.md`; BMAD hardkoder `brief.md`. Kjøremappa er kanonisk, rotfila er en `cp`-kopi | Kun rotfil (signaliserer at rammeverket ikke er brukt), kun kjøremappe (feil filnavn), symlink (overlever ikke zip) |
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
| Har vi bedt emneansvarlig om tilbakemelding på den egendefinerte idéen? | Staben tilbyr dette eksplisitt for egne prosjekter, og det er fortsatt ikke gjort. Se [[ibe160]] |
| Hvordan leveres uke 43 konkret — Canvas-opplasting, push til repoet, eller begge? | Ikke utledbart av noe materiale vi har. Begge-plasser-løsningen i [[repo-konvensjoner]] er trygg uansett, men spør |
| Finnes det en språkpolicy for leveransene? | Ingen i kursmaterialet. Vi valgte engelsk på BMAD-artefaktene, men det er en vurdering, ikke en instruks |
| Hvilke Family Feud-regler overlever til første versjon (strikes, steal, doblet runde)? | PRD-spørsmål. Minimum er poeng etter hvor mange som ga svaret |
| Hvordan hindres dobbeltsvar uten deltakerkontoer? | Opphavsskjemaet ba folk la være å sende inn på nytt — altså allerede et reelt problem. Engangskode eller throttling per enhet |

## Mal for nye rader

```
| ÅÅÅÅ-MM-DD | <hva ble bestemt> | <hvorfor> | <hva ble valgt bort> |
```
