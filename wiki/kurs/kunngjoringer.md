# Kunngjøringer i Canvas — det som angår oss

> Kilde: kunngjøringssiden i Canvas-emnet *IBE160 26H*, gjennomgått 2026-11-21. Den har ca. 50
> kunngjøringer fra 15. aug. til 19. nov. Her står bare det som påvirker prosjektet. Flyttede
> forelesninger, studieteknikk-kvelder og «video lastet opp» er utelatt.
> Kunngjøringene nevner studenter med navn, og har Teams-lenker. Ingenting av det skal hit,
> siden repoet er offentlig.

## Det viktigste, kort

1. **Det er ikke et krav at appen er publisert** (19. nov.). Det holder at den kan kjøres
   lokalt, men `README.md` må beskrive hvordan den kjøres og **hvilke API-nøkler den trenger**.
   Se [[sensorveiledning-del-1]].
2. **Kullet er allerede i implementering.** Faglærer gikk gjennom implementasjonssteget
   17. nov., og satte sin egen beergame i gang med `/goal` 17. nov. kl. 14. Neste kveld var 3 av
   12 epics ferdige. Vi har ikke begynt på UX og arkitektur ennå. Se [[tidsplan]].
3. **Vercel er koblet til alle grupperepoene** (29. okt.). Det er gratis, og det eneste
   publiseringsalternativet emnet støtter. Det passer med stacken i [[beslutninger]].
4. **Bare `product-brief.md` skulle leveres, ikke `proposal.md`** (17. sep.). Fristen ble
   flyttet til **27. sept.** (19. sep.). Se [[ibe160]] og [[proposal]].
5. **All kontakt går via Teams.** Det er slått av å kommentere kunngjøringer (9. sep.).

## Kronologisk

| Dato | Kunngjøring | Hva det betyr for oss |
|------|-------------|-----------------------|
| 2026-08-24 | Gruppene registreres i et skjema, frist 6. sept. Grupper på 1–4 medlemmer | Gjort. Uten registrering blir det ingen Teams-kanal eller repo |
| 2026-08-25 | Installer programvare etter Appendiks A i læreboka. Tips: installer Claude Code først, og la den installere resten | — |
| 2026-09-04 | Alle skal ha GitHub-konto med HiMolde-adressen, også om de har en privat konto fra før | Invitasjonen til repoet sendes dit |
| 2026-09-09 | Briefen skal **genereres i repoet og pushes**, ikke lastes opp noe sted. GitHub tillater bare 50 invitasjoner i døgnet, så fristen ble satt til 20. sept. Kommentarer i Canvas er slått av, og kontakt går via Teams | — |
| 2026-09-17 | **Bare `product-brief.md` skal leveres.** `proposal.md` var fjorårets innlevering. Misforståelsen kom av en slide som ikke skulle vært der | Bekrefter at vår `proposal.md` er ekstra. Se [[proposal]] |
| 2026-09-19 | **Ny frist for briefen: søndag 27. sept. kl. 23:59.** Gjennomføringsplanen er lagt ut | Vi leverte 14. sept. Planen er en leseplan, se [[tidsplan]] |
| 2026-09-20 | Utløpte GitHub-invitasjoner er sendt på nytt. Daniel sto på lista over invitasjoner som fortsatt ikke var godtatt | Løst, siden begge har skrivetilgang |
| 2026-09-28 | Fristen er ute. Faglærer går gjennom repoene og lister grupper uten ferdig brief | G101 sto ikke på lista |
| 2026-10-05 | Tilbakemeldingen på briefen legges **direkte i repoet**. Den hentes med `git pull` | Kom 2026-10-06. Se [[2026-10-12-tilbakemelding-og-prd]] |
| 2026-10-06 | **Sensorveiledningen for del 1 ligger under Moduler** | Lest i sin helhet 2026-11-21. Se [[sensorveiledning-del-1]] |
| 2026-10-26 | Kjør `git pull` før dere fortsetter å jobbe | Faglærer skriver i repoet vårt, så det er lett å få konflikter |
| 2026-10-26 | Forbered research til PRD-en før torsdag | Vi var ferdige med PRD-en 13. okt. |
| 2026-10-29 | **Vercel er installert på hele `IBE160-2026`.** Se under | Relevant for arkitekturen |
| 2026-11-02 | Prøv å bli ferdige med PRD-en innen torsdag 5. nov. | Vi var ferdige |
| 2026-11-09 | Prøv å bli ferdige med **designdelen** innen torsdag 12. nov. | Her ligger vi etter |
| 2026-11-13 | Planleggingsfasen er nesten gjennomgått. En siste video kommer, og så skal Claude Code jobbe over helgen med `/goal` | — |
| 2026-11-16 | Implementasjonssteget gjennomgås 17. nov. kl. 12:15–16. Se lista under | Viser hva faglærer regner som ferdig planlegging |
| 2026-11-18 | Faglærers beergame kjører autonomt med `/goal`, og 3 av 12 epics er ferdige | Et konkret mønster for fase 4 |
| 2026-11-19 | **Det er ikke et krav at appen er publisert.** Lokal kjøring holder, men README må forklare hvordan, og hvilke API-nøkler som trengs | Se [[sensorveiledning-del-1]] og [[beslutninger]] |

## Faglærers løp, slik det ble oppsummert 16. nov.

Det kullet skal ha gjort før implementering:

- Product brief, brainstorming, research
- PRD: funksjonelle og ikke-funksjonelle krav, brukerreiser, omfang (MVP)
- Design og UX
- Arkitektur: teknologivalg, database, struktur
- Epics og brukerhistorier
- Sprintplanlegging, altså rekkefølgen

Deretter kommer implementeringen, med `/goal` for lange oppgaver. Merk at brainstorming og
research står som egne steg. Vi har ikke kjørt dem som egne BMAD-økter, men de er dekket i
`.memlog.md` for briefen og PRD-en.

Vår vei videre er dermed `bmad-ux` → `bmad-architecture` → `bmad-create-epics-and-stories` →
`bmad-sprint-planning` → implementering. Se [[bmad-rammeverket]].

## Vercel og GitHub CLI (29. okt.)

- Repoene er **allerede koblet til Vercel**. **Bare én i gruppa** oppretter prosjektet, og det
  havner på den personens Hobby-konto (gratis). Bli enige om hvem først.
- Oppsett: logg inn med GitHub på vercel.com, velg *Add New → Project*, så `IBE160-2026`, og
  importer repoet. Sjekk *Root Directory* hvis appen ligger i en undermappe.
- Alt som kommer inn i `main` publiseres automatisk. Pull requests får en egen
  forhåndsvisning.
- **Hemmeligheter** legges i Vercel under *Settings → Environment Variables*, og lokalt i en
  `.env` som står i `.gitignore`. Variabler med `NEXT_PUBLIC_`- eller `VITE_`-prefiks blir
  synlige i nettleseren.
- **Repoet må være offentlig.** På gratisplanen er det ellers bare eieren som kan publisere.
- Ikke opprett mer enn ett Vercel-prosjekt per repo. GitHub Pages er slått av.
- Alle bør installere GitHub CLI (`gh`), så Claude kan jobbe med PR-er, issues og Actions.
- Legg publiseringsadressen i README når den finnes.

Vercel er altså frivillig (se 19. nov.), men det er gratis og allerede koblet til. Stacken i
[[beslutninger]] (Next.js på Vercel) passer.
