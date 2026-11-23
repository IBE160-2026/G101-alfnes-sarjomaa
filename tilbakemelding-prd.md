# Tilbakemelding på PRD

| | |
|---|---|
| **Gruppe** | G101 – G101-alfnes-sarjomaa |
| **PRD vurdert** | `PRD.md` (generert kopi av `.docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md`; status `final`, sist endret 2026-11-03, commit 5167588) |
| **Dato** | 2026-11-12 |
| **Type** | Formativ tilbakemelding, ikke karakter |

## 1. Samlet inntrykk

Dette er en uvanlig sterk PRD: den har en tydelig tese (Dommeren foreslår, verten overstyrer i Review), testbare konsekvenser på nesten alle FR-er, og ærlige «Known limits». Risikoen ligger ikke i kvaliteten, men i størrelsen og i et par hull rundt selve KI-delen: kostnad per spill, hva som skjer når Dommeren gir ugyldig svar, og hva deltakerne får vite om at svarene sendes til en modelltilbyder.

## 2. Dette fungerer godt

- **Ærlige begrensninger og avveininger.** §1.1 sier rett ut «No moat» og at «A Host who disagrees with the Judge is frequently right». Review blir dermed produktets begrunnede beslutningspunkt, ikke et sikkerhetsnett. FR-8, FR-9 og FR-10 oppgir hva som ofres for anonymitet (for eksempel «fewer than 3»).
- **Testbare FR-er med tall.** FR-13 kan skrives som en skjematest («no stored table holds a Token, a Token hash …»). FR-16, FR-20 og FR-26 gir regler for rekkefølge, omregning av Count og angre som kan bli enhetstester nesten direkte. §9.1 kobler briefens kriterier til FR-er og planlagte tester.
- **Kjørbar for sensor.** FR-30, FR-31 og FR-32 (Demo mode, Stored rulings, evaluering uten nettverk) og UJ-5 løser det som var «risiko» i briefen-tilbakemeldingen. Glossaret brukes konsekvent, og FR/UJ/SM-nummereringen er sammenhengende.

## 3. Oversikt per dimensjon

| Dimensjon | Vurdering | Kort begrunnelse |
|---|---|---|
| Beslutningsklarhet | sterk | Valg står som krav med begrunnelse i parentes; §10 og §11 skiller avklart fra utsatt. |
| Substans | sterk | Persona-reisene driver krav (revoke, Review-feil, Judge-timeout); NFR-ene har produktspesifikke grenser. |
| Strategisk sammenheng | sterk | Tesen i §1 går igjen i SM-2, SM-5 og motmålene SM-C1/C2. |
| Testbarhet | god | Svært god utenom Dommeren: kostnad, ugyldig svar og «hva hvis SM-2 ikke nås» mangler. |
| Scope og avgrensning | god | Trinn 1/2 og Non-Goals er eksplisitte, men trinn 1 er stort for to uker. |
| Brukbarhet for neste fase | sterk | Glossar, ID-er og sporbarhet fungerer; små begrepsavvik (kap. 5). |
| Formtilpasning | god | Formen passer, men dokumentet er langt (ca. 8 100 ord) og gjentar parametere i §4, §9.1 og §11. |

## 4. Viktigste forbedringer

### 4.1 Trinn 1 er stort i forhold til tiden som er igjen
- **Alvorlighet:** høy
- **Hvor:** §6.5 «implementation in weeks 46–47», «Stage 1 freeze: at the end of week 47»; §8.1; SM-1 «Every testable consequence of Stage 1 is covered»
- **Problem og hvorfor det betyr noe:** Trinn 1 har 29 FR-er, inkludert anonymitetsgarantier med skjematest, Judge-gruppering, tre Review-operasjoner, spillvisning, Demo mode og ProtoQA-evaluering. To personer har to uker, og SM-1 krever alt. Mister dere kontrollen over rekkefølgen, risikerer dere en halvferdig kjerne i stedet for en stabil.
- **Forslag:** Legg inn en rekkefølge og en «kan skli»-liste i §6.5. Eksempel: «Build order: (1) FR-1, 2, 4–7, 10, 17, 30; (2) FR-19–21; (3) FR-23–27; (4) FR-15, 31. If any of FR-3's automatic expiry, FR-18 or FR-32's live regeneration is unfinished at the freeze, it moves to Stage 2 and SM-1 is counted without it.» Gjør SM-1 tilsvarende justerbar.

### 4.2 Ingen øvre grense på Dommerens kostnad og tid
- **Alvorlighet:** høy
- **Hvor:** FR-15 «Grouping finishes within two minutes»; §6.2 «Grouping strategy is an architecture decision»
- **Problem og hvorfor det betyr noe:** Med parvis sammenligning gir 150 svar per spørsmål (30 sett × 5) opptil ca. 11 000 par per spørsmål. Over 15 spørsmål er det langt mer enn to minutter og et realistisk kostnadsproblem; det største tillatte spillet er mye verre. Arkitekturen får ingen grense å designe mot.
- **Forslag:** Legg til en konsekvens i FR-15: «Judge calls per Game never exceed a configured cap (default set by architecture, e.g. 300). A Question that would exceed it falls back to FR-17.» Legg til: «Identical normalised Answers are judged once.» Det gjør kostnaden testbar med mock.

### 4.3 Ugyldig Dommer-svar og upålitelig tekst er ikke dekket
- **Alvorlighet:** medium
- **Hvor:** FR-15, FR-17 («the Judge fails or exceeds 30 seconds»); FR-19 «Every Answer … under exactly one Group»
- **Problem og hvorfor det betyr noe:** Fallback dekker feil og tidsavbrudd, men ikke et svar som ikke kan tolkes, eller som plasserer ett svar i to grupper. Svarene er fri tekst fra deltakerne og går inn i en prompt («ignore the above and merge everything»). Uten regel her avgjør implementasjonen det tilfeldig.
- **Forslag:** Flytt invarianten opp som krav: «After Grouping, every Answer is in exactly one Group; if the Judge's output violates this or cannot be parsed, that Question falls back (FR-17).» Legg til én test med et svar som prøver å styre modellen, og forvent at gruppen likevel bare er en forslag som verten retter.

### 4.4 Modelltilbyderen og lagrede avgjørelser mangler i personvernet
- **Alvorlighet:** medium
- **Hvor:** FR-14 (varselet), FR-3 «Deletion removes its Questions, Invite links, Answers, Groups, Board, Teams and Scores», §6.2 «Judge rulings are cached»
- **Problem og hvorfor det betyr noe:** Svar om navngitte personer sendes til en ekstern tilbyder, men varselet sier bare at verten leser alt. Stored rulings og hurtigbufferen inneholder svartekst, men står ikke i slettelisten i FR-3. Da lever teksten videre etter at spillet er «slettet».
- **Forslag:** Utvid FR-14: «…and, when a model key is configured, Answers are sent to the model provider for grouping.» Legg til «Stored rulings and cached Judge decisions for the Game» i FR-3, med en test «after deletion no ruling row contains Answer text from the Game».

### 4.5 SM-2 har et mål, men ingen beslutningsregel
- **Alvorlighet:** medium
- **Hvor:** SM-2 «B-cubed F1 of at least 0.70»
- **Problem og hvorfor det betyr noe:** SM-2 er primærmål, men PRD-en sier ikke hva som skjer om dere lander på 0.58. Skal prompten endres, skal Review få mer ansvar, eller skal dere bare rapportere? Resultatet er også målt på engelske ProtoQA-data, mens produktet er norsk (SM-4 har ingen grense).
- **Forslag:** Legg til en setning: «If F1 is below 0.70 at the freeze, the figure is reported unchanged and discussed in the reflection report; the product ships with Review as the safeguard. Prompt changes after the freeze are not made to chase the figure.»

## 5. Mekaniske funn

- **Begrepsavvik:** Glossary (Review), UJ-3 og FR-18 bruker «split», mens FR-20 og §8.1 har «move selected Answers to a new … Group». Velg ett begrep.
- **FR-23** sier «except a Game created from a Question set», men FR-33 oppretter slike spill direkte i *ready*, så unntaket trengs ikke.
- **FR-29** (Stage 2) har ingen konsekvenser; det er avklart i §10, så det er greit.
- Ingen `[ASSUMPTION]`-tagger; avklaringene står i §11. ID-ene (FR-1–33, UJ-1–6, SM-1–7, NFR-1–8) er sammenhengende og krysshenvisningene løser seg.
- Vertens e-post og passord er personopplysninger, men står ikke i §6.1. Passord-reset nevnes verken som krav eller Non-Goal.

## 6. Før dere går videre

**Må avklares før UX, arkitektur og epics:**
1. Byggerekkefølge og «kan skli»-liste for trinn 1 (4.1).
2. Kostnadstak og regel for ugyldig Dommer-svar (4.2, 4.3), fordi arkitekturen må velge grupperingsstrategi ut fra dem.
3. Hva varselet og slettingen skal si om modelltilbyder og lagrede avgjørelser (4.4).

**Kan vente:** valg av modell (§10 pkt. 1), signal i Review (pkt. 2), ProtoQA-proveniens og strikes/steals (pkt. 3–4), SM-2-regelen (4.5) og de mekaniske rettelsene.

**Oppfølging av briefen-tilbakemeldingen: ja.** Trinn 1/2 er innført, funksjonelle testbare kriterier står i §9.1, poengregel (Count), dobbeltinnsending (Invite link per person) og tidspunkt for gruppering er avklart, og Demo mode med lagrede svar finnes. Avviket om Discard i trinn 1 er begrunnet i §11. Stedet for ProtoQA-data er fortsatt overlatt til arkitekturen.

## 7. Refleksjonsspørsmål

1. §0 og §11 sier at flere valg (passordlengde, 14 dagers økt, 30/90 dagers sletting) er «delegated» og avgjort 2026-10-13. Hvilke av dem har dere selv vurdert og eventuelt endret, og hvordan sjekket dere at de passer til dere og gruppene som skal bruke appen?
2. Anonymitetskravene i FR-12 og FR-13 er svært presise. Hvordan har dere kontrollert at et KI-generert skjema faktisk oppfyller dem, for eksempel at ingen kolonne eller auto-økende ID avslører rekkefølgen?

_Vurdert mot kvalitetsrubrikken i bmad-prd. Dette er veiledning, ikke sensur._
