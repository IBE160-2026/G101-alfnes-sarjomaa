# Epic 2: Spørsmål og innsamling

**Basert på `epic-1-fundament`. Merge fase 3 og epic 1 først.**

Story 2.1–2.7: verten skriver spørsmål, lager invitasjonslenker og åpner innsamlingen. Deltakerne svarer anonymt fra telefonen, kan endre svarene på samme enhet, og verten kan erstatte en tapt lenke.

## Stories
| Story | Innhold | Review (funn / rettet / avvist) |
|-------|---------|----------------------------------|
| 2.1 | Spørsmålseditor i utkast: lagres når du går ut av feltet, flytt opp og ned, slett, maks 20 | 31 / 12 / 18 |
| 2.2 | Invitasjonslenker `/svar/<id>#<token>`. Bare `sha256(token)` lagres. Lenkene vises én gang, med «Kopier» som virker også uten Clipboard API. Innsamlingen åpnes i én transaksjon | 30 / 9 / 13 |
| 2.3 | Lenkesiden: generisk serverside uten spørsmål og uten referrer. Ukjente, tilbakekalte og avkuttede lenker ser like ut | 30 / 7 / 15 |
| 2.4 | Svarskjema på 360 px med anonymitetsvarsel på to setninger, og første innsending med lås og ny sjekk av tilstanden | 41 / 7+ / 27 |
| 2.5 | Tilbake på samme enhet: tidligere svar vises bare med enhetens redigeringsnøkkel. Kladder lagres bare i nettleseren | 23 / 6 / 15 |
| 2.6 | Fremdrift: «færre enn 3» til det finnes tre svarsett. Ingen animasjon, og tallet oppdateres bare hvert 30. sekund | 25 / 5 / 18 |
| 2.7 | Erstatte en tapt lenke: den gamle lenken og svarsettet dens slettes, uten at det avsløres om lenken var brukt | 29 / 7 / 15 |

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/epic-2-*.md`, med seksjonen «Epic 2 review fixes» nederst.

- **`bmad-code-review`** (fem lag): 1 høy, 1 medium og 6 lave.
  - **Høy, rettet:** `npm run dev` skrev tokens og redigeringsnøkler til terminalen, fordi Next 16 logger argumentene til server-funksjoner som standard. Verten kunne dermed se hvem som svarte og når, og lese svarene til en gjest. Nå er `logging.serverFunctions` og `browserToTerminal` slått av, og en test feiler hvis de slås på igjen. Testene fanget det ikke fordi e2e kjører `next start`.
  - **Medium, rettet:** lenkene som bare vises én gang, forsvant ved klikk på en lenke inne i appen. Nå spør nettleseren før du går videre.
  - **Funnet i orden:** at bare hashen av tokenet lagres, at tokenet bare finnes i fragmentet og i forespørselen, at det ikke finnes tidsstempler, at svarene er like uansett lenke, og at alle actions sjekker tilgang og låser radene.
- **`ponytail-review`:** dommen er «ship», uten «must».
  - Duplisert kode i actions og klientkall er samlet i `hostAction` og `callAction`.
  - Overflødige tester er slått sammen, og alle testene for anonymitet og logglekkasje er beholdt.
- **`impeccable` audit:**
  - **Must, rettet:** Enter i et svarfelt sendte inn skjemaet. Nå flytter Enter fokus til neste felt.
  - **Ellers rettet:** tydeligere knapper, «Prøv igjen» i editoren, titler per tilstand, og at dialogen viser antall spørsmål.

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 387 passerer. `npm run test:e2e`: 81 passerer.

## Kjente begrensninger
- Tilbake-knappen i nettleseren inne i appen advarer ikke om lenker som ikke er kopiert (`shortcut:`).
- Kappløpet mellom lukking og innsending har en test for vaktene, men lukking finnes først i story 3.1.
- Verten kan svare gjennom lenker hen har tatt vare på, og da overskrives gjestens svar. Det står i PRD §1.1 og kommer i README (story 7.4).
- Én e2e-test fra 1.4 (lasteskjelett) har feilet to ganger under parallell last og ellers passert. Den må stabiliseres.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
