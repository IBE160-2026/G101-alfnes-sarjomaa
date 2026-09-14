# Refleksjonsrapport — 40 % av karakteren

> Den største enkeltposten i vurderingen. Større enn koden (30 %).
> Mal: `IBE160/beergame/.grading/reflection-report-template.md` (910 ord).
> Frist: **5. desember**, sammen med repoet som zip. Se [[tidsplan]].

## Hvorfor dette står her allerede i september

To ting i malen kan ikke rekonstrueres i desember hvis de ikke samles inn underveis:

> **«Husk å lagre promptene deres! Inkluder ALLE stegene dere gjorde.»**
> — mal, seksjon 2.4 Utviklingsfaser

Fjorårets sterkeste grupper hadde egne promptarkiv (`prompting/fase_1/`, `prompting/fase_2/`
med lagrede sesjoner som JSON). Rapporten skal også sammenligne «med og uten KI» og beskrive
konkrete tekniske utfordringer — begge deler er lett å skrive hvis man har loggen, og nesten
umulig å rekonstruere ærlig et kvartal senere.

Se [[beslutninger]] for hva vi gjør med dette.

## Malen — 8 nummererte seksjoner

Av 36 innleverte rapporter i fjor fulgte **31 alle åtte seksjonene ordrett**, og de fleste
gjenga også alle 23 underseksjonene med parentesene intakt. Dette er ikke et dokument å bli
kreativ med.

```
## 1. Gruppeinformasjon
## 2. Utviklingsprosessen
   ### 2.1 Oversikt over prosjektet
   ### 2.2 Arbeidsmetodikk
   ### 2.3 Teknologi og verktøy
   ### 2.4 Utviklingsfaser          ← «lagre promptene deres»
## 3. Utfordringer og løsninger
   ### 3.1 Tekniske utfordringer
   ### 3.2 Samarbeidsutfordringer
   ### 3.3 KI-spesifikke utfordringer
## 4. Kritisk vurdering av KI sin påvirkning
   ### 4.1 Fordeler med KI-assistanse
   ### 4.2 Begrensninger og ulemper
   ### 4.3 Sammenligning: Med og uten KI
   ### 4.4 Samlet vurdering
## 5. Etiske implikasjoner
   ### 5.1 Ansvar og eierskap
   ### 5.2 Transparens
   ### 5.3 Påvirkning på læring og kompetanse
   ### 5.4 Arbeidsmarkedet
   ### 5.5 Datasikkerhet og personvern
## 6. Teknologiske implikasjoner
   ### 6.1 Kodekvalitet og vedlikehold
   ### 6.2 Standarder og beste praksis
   ### 6.3 Fremtidig utvikling
## 7. Konklusjon og læring
   ### 7.1 Viktigste lærdommer
   ### 7.2 Hva ville dere gjort annerledes?
   ### 7.3 Anbefalinger
   ### 7.4 Personlig refleksjon (individuelt)
## 8. Vedlegg (valgfritt)
```

## Språk og lengde

**Norsk.** Alle 36 rapportene i fjorårets kull var på norsk, overskrifter og brødtekst.
Null unntak. Dette bryter med at våre BMAD-artefakter er på engelsk — og det er riktig:
rapporten følger malen, malen er norsk.

Lengde i praksis (36 rapporter): median **4 817 ord**, kvartiler 4 127 og 5 670, lengste 9 082.
Malen selv sier 3 000–5 000 ord.

## Merk

- Seksjon 7.4 er **individuell** — hver av oss skriver sin egen del.
- Emneansvarlig la fjorårets innleverte rapporter inn i gruppenes repo i etterkant som
  Canvas-eksport (`<4 siffer>_438085554_1.md`). Selve innleveringen skjedde altså i Canvas.
- `SG-Closed-Group` lagde en `REFLECTION_REPORT_GUIDE.md` som kobler hver malseksjon til en
  mekanisk datakilde (2.3 fra `package.json`, 3.1 fra `git log` filtrert på bugfix-commits)
  pluss et script som høster dataene. Verdt å se på i november.
- Fjorårets repo har et `.logging/`-oppsett fra emneansvarlig som fanget KI-trafikk via
  OpenTelemetry (47 av 54 repo har det). Vi har ikke fått noe tilsvarende i år.

## Personvern

Fjorårets rapporter og `.grading/part-3.md` inneholder ekte studentnavn, studentnummer og
`@himolde.no`-adresser. Ikke kopier innhold derfra inn i våre sporede filer. Se [[kullet]].
