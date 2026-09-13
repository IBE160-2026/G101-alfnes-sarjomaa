# Produktidé — Toppsvar

> Status: **formalisert** i [[repo-konvensjoner|product-brief.md]] 2026-09-14. Produktnavn: **Toppsvar**.
> Dette notatet er bakgrunnen; briefen er leveransen.
> Kilde: `.idea/main_brief/task.md` (ikke i git — `.idea/` er gitignorert).

## Kjerneidé

En webapp som ligner **Family Feud**, men hvor brukerne kan **lage sitt eget spørreskjema**
og samle inn svarene selv. Spillet bygges altså på gruppens egne data, ikke på en
ferdig spørsmålsbank.

Løkka er tredelt:

1. **Lag skjema** — en vert lager spørsmål (f.eks. «Hva gjør X når han har fått for mye å drikke?»).
2. **Samle svar** — deltakerne svarer anonymt, gjerne flere svar i prioritert rekkefølge.
   Svarene aggregeres til en topp-liste per spørsmål (som «survey says» i Family Feud).
3. **Spill** — lagene tipper hvilke svar som ligger øverst, og får poeng etter hvor mange
   som svarte det samme.

## Hvor idéen kommer fra

En ekte hendelse: på en innflyttingsfest ble det laget et Google Forms-skjema
(«Leilighet til leilighet») med personlige spørsmål om gjengen. Svarene var anonyme.
Senere ble de aggregerte svarene brukt til en Family Feud-runde hvor hver gruppe
tippet toppsvarene. Det fungerte veldig bra sosialt — men hele flyten var manuell:
Google Forms → manuell opptelling → manuell poengregning.

**Smertepunktet vi løser:** i dag krever dette Google Forms + regneark + en vert som
teller opp og holder styr på poeng. Vi vil gjøre hele kjeden til ett produkt.

## Hva som skiller seg fra eksisterende løsninger

- Kahoot/Quizlet: ferdige spørsmål med ett riktig svar — ikke «flest svarte dette».
- Google Forms: samler inn, men aggregerer ikke til spillbare topp-lister og har ingen spillmodus.
- Family Feud-apper: bruker generiske, forhåndsinnsamlede spørsmål — ikke *din* gjeng.

Kombinasjonen **egendefinert innsamling + automatisk aggregering + spillmodus** er det
som er nytt.

## Åpne spørsmål — avklart 2026-09-14

- [x] **Primærbruker:** verten. Deltakeren er sekundærbruker — all den manuelle jobben ligger hos verten.
- [x] **Sanntid eller asynkront:** begge deler, i hver sin fase. Innsamling skjer asynkront i dagene før; spillingen er live og samlokalisert rundt én delt skjerm.
- [x] **Aggregering av fritekst:** KI grupperer, verten overstyrer (slå sammen, splitte, gi nytt navn) før spillet starter. Dette er prosjektets «Beslutningspunkt».
- [x] **Anonymitet:** ingen deltakerkontoer, ingen lagret kobling mellom person og svar, ingen innlogget identitet synlig i svarflyten. Behandles som et produktkrav, ikke en personvernfotnote.
- [x] **Utenfor første versjon:** deltakerkontoer, betaling, gruppering uten vertens bekreftelse, fjernspilling med én enhet per lag, offentlige spill med fremmede, ferdig spørsmålsbank, bilde- og lydsvar.

Begrunnelsene ligger i [[beslutninger]]. Dypere designdrøfting som ikke fikk plass i briefen
ligger i `addendum.md` ved siden av den.

## Merk om personvern

Opphavsskjemaet navngir privatpersoner og spøker om drikkingen deres. Repoet er offentlig.
Navnene er derfor erstattet med plassholdere i alt som spores i git; originalen blir liggende
i den gitignorerte `.idea/`-mappa.
