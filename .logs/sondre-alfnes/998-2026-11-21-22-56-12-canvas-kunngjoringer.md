# Canvas-kunngjøringer inn i wikien

## 2026-11-21 kl. 22:56 — Sondre Alfnes

### Oppgave
Åpne en Chrome-fane, lese wikien for kontekst, lese kunngjøringssiden i Canvas-emnet som Sondre hadde åpnet, og oppdatere wikien med alt i kunngjøringene som angår prosjektet.

### Plan
- Leste `wiki/index.md`, `ibe160`, `tidsplan`, `sensorveiledning-del-1`, `refleksjonsrapport` og `beslutninger`.
- Leste begge sidene med kunngjøringer (ca. 50, fra 15. aug. til 19. nov.) som tekst, pluss kursets side «Gjennomføringsplan», som kunngjøringen 19. sep. bare viste et skjermbilde av.
- Filtrerte bort støy (flyttede timer, studieteknikk, «video lastet opp») og alle personnavn og Teams-lenker, siden repoet er offentlig.

### Resultat
- Ny side: `wiki/kurs/kunngjoringer.md` med et kort sammendrag, en kronologisk tabell, faglærers planleggingsløp fra 16. nov., og Vercel/`gh`-oppsettet fra 29. okt.
- `wiki/kurs/tidsplan.md`: briefens frist er rettet til 27. sept. Nye seksjoner om kullets faktiske tempo (PRD 5. nov., design 12. nov., implementering 17. nov.) og om at **vi ligger etter**, pluss leseplanen for uke 35–47.
- `wiki/kurs/ibe160.md`: fristen ble flyttet, bare `product-brief.md` skulle leveres, kontakt går via Teams, og appen trenger ikke være publisert.
- `wiki/kurs/sensorveiledning-del-1.md`: hele veiledningen ligger under Moduler. README skal nevne API-nøkler, men kravet om at appen kjører uten nøkkel står fortsatt.
- `wiki/prosjekt/beslutninger.md`: deploy og `proposal.md` er flyttet til Avklart. Nytt åpent spørsmål om hvem som eier Vercel-prosjektet.
- `wiki/index.md` lenker til [[kunngjoringer]].
- Grep etter lærernavn, Teams-, Canvas- og Panopto-lenker i `wiki/` fant ingenting. Wiki-endringene er ikke committet.

### Åpne punkter
- Les hele sensorveiledningen for del 1 under Moduler i Canvas. Wikien bygger bare på sitatene i tilbakemeldingen.
- Gjennomføringsplanen sier at «rapporten leveres» i uke 45. Det stemmer ikke med 5. des. Avklar med faglærer om det har noen betydning.
- Bestem hvem i gruppa som eventuelt eier Vercel-prosjektet. Bare én kan opprette det.
- Kullet er i implementering, og det er to uker til 5. des. UX, arkitektur, epics og sprintplan må gå raskt, slik at implementeringen får mest tid.
