# 2026-10-12 — Faglærers tilbakemelding, korrigering av vekting, revidert brief og PRD

Verktøy: Claude Code (Claude Opus 5.5) i repoet, med BMAD-skillsene `bmad-product-brief`
(update) og `bmad-prd` (create, Fast path). Subagenter (Sonnet) gjorde polish og gjennomgang.

## Promptene, ordrett

1. > les wiki for å forstå hvilken situasjon du er i. Gjerne les alt inni der

2. > les siste commit nå av claude bipa and claude

   («bipa» er faglærers brukernavn. Commiten var faglærers tilbakemelding på briefen, generert med KI.)

3. > Ja start med først å oppdatere wiki. Her er hva infosiden sier:
   > *[Infosiden for emnet i Canvas ble limt inn. Den gjengis ikke her, fordi den inneholder
   > navn og e-postadresser til ansatte. Det relevante er oppsummert i `wiki/kurs/ibe160.md`.]*
   > Men bare ta med det som er relevant til prosjectet. Har allerede kjørt git pull.
   > Nå rett alt inkl claude.md wiki og alt, så revider bmad og alt annet nødvendig også gå videre til PRD

4. > Når du er ferdig kan du comitte

   (Sendt underveis. Endringene ble delt i flere commits, siden faglærer påpekte at
   commit-historikken vurderes.)

## Hva KI-en gjorde

- Leste hele wikien (16 notater) og oppsummerte status, avvik og åpne punkter.
- Leste faglærers commit og fant at **vektingen vi hadde skrevet inn var feil**.
- Rettet `CLAUDE.md`, åtte wiki-notater, `README.md`, `prompting/README.md` og KI-ens eget minne.
  Skrev det nye notatet [[sensorveiledning-del-1]].
- Reviderte briefen etter tilbakemeldingen med `bmad-product-brief` i update-modus, og logget
  hver beslutning i `.memlog.md`.
- Skrev PRD-utkastet med `bmad-prd`. Antakelser er merket `[ASSUMPTION]` for gruppa å bekrefte.

## Der KI-en tok feil, og hvordan det ble oppdaget (råmateriale til rapportens 3.3 og 4.2)

1. **Fjorårets regler ble skrevet inn som årets.** 2026-09-14 fant KI-en vektingen 30/40/30 og en
   100-poengs rubrikk for `proposal.md` i fjorårets repo (`IBE160/beergame/.grading/`). Den skrev
   begge inn i `CLAUDE.md` og wikien som fakta. Faglærer måtte rette det: i år er det 70/30 og
   ingen muntlig, og arbeidskravet er selve briefen. Det er samme feiltype som da vi først
   konkluderte at `proposal.md` ikke fantes, bare speilvendt: begge ganger ble et tilgjengelig,
   men feil kildeår lest som fasit. Lærdom: fjorårets repo viser *format*, ikke *årets regler*.
2. **En skjult feil i et script KI-en selv hadde skrevet.** `sync-brief.sh` sluttet stille å
   skrive brødtekst etter første `---`-linje i dokumentet. Verifiseringen sammenlignet
   pipelinen med seg selv, så den kunne aldri slå ut. Feilen ble oppdaget da scriptet skulle
   utvides til PRD-en. Den er rettet, og scriptet sjekker nå mot en uavhengig beregning.
3. **En subagent fulgte ikke en eksplisitt instruks.** Polish-agenten ble bedt om å beholde
   fem funksjonelle suksesskriterier, men slo sammen to av dem. Meningen var bevart, så
   endringen ble beholdt, men PRD-en viste fortsatt til «five». Det ble fanget ved å
   etterkontrollere agentens rapport mot fila, i stedet for å stole på oppsummeringen.

4. **Det første PRD-utkastet hadde hull i anonymiteten, som KI-en selv ikke så.** To
   uavhengige gjennomganger (avstemming mot kildene og BMADs rubrikk) fant blant annet at
   verten kunne lese svar før lukking, at en svarsett-ID kunne koble én persons svar på tvers av
   spørsmål, og at suksessmålet for gruppering kunne «vinnes» ved å ikke gruppere i det hele tatt.
   Lærdom: samme modell som skriver, ser ikke sine egne blindsoner. Separate gjennomganger med
   egne roller fant det.

## Beslutninger tatt i økta

Se `wiki/prosjekt/beslutninger.md`, rader datert 2026-10-12, og memloggene i brief- og PRD-mappa.
