# Produktidé — Family Feud med egne spørreskjema

> Status: **arbeidsidé**, skal formaliseres i product brief-leveransen (uke 43, se [[fase-1-product-brief]]).
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

## Åpne spørsmål før product-brief

- [ ] Hvem er primærbrukeren — verten som lager spillet, eller deltakeren som spiller?
- [ ] Sanntidsspill (alle i samme rom, én skjerm) eller asynkront?
- [ ] Hvordan aggregeres fritekstsvar til grupper? (manuell gruppering av verten vs. KI-klynging)
- [ ] Anonymitet: hvor hardt garanteres den?
- [ ] Hva er eksplisitt utenfor scope i v1?

Se [[beslutninger]] for hva som blir bestemt.
