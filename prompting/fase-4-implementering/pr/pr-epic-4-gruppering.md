# Epic 4: Dommeren og gruppering

**Basert på `epic-3-lukking`. Merge den først. Epic 3 og 4 bør merges tett, fordi spillet først kommer videre fra *grouping* med denne PR-en.**

Story 4.1–4.4: ett dommer-grensesnitt med tre leverandører, gruppering én gang ved lukking med fallback per spørsmål, brukstellere med bruksrapport, og live-dommer via OpenRouter.

## Stories
| Story | Innhold | Review (funn / rettet / avvist) |
|-------|---------|----------------------------------|
| 4.1 | `Judge.partition` bak én grense i `src/server/judge`, med leverandørene replay (lagrede dommer-svar) og mock. Output valideres og normaliseres. En ESLint-regel forbyr kall til modellen utenfor grensen | 35 / 13 / 22 |
| 4.2 | Grupperingen kjører én gang ved lukking: ett kall per spørsmål, 30 s tidsavbrudd, 5 om gangen, og kan fortsette etter krasj uten å vurdere på nytt. Feiler et spørsmål, får akkurat det manuell gruppering med en grunnkode. Fremdriften vises som «N av M spørsmål ferdig» | 33 / 7 / 17 |
| 4.3 | Brukstellere (SM-5, SM-C2) i `game_counter`, og bruksrapporten `/api/spill/[id]/rapport`, som bare inneholder tall | 27 / 4 / 23 |
| 4.4 | OpenRouter-leverandøren (`deepseek/deepseek-v4.1-flash`) med `fetch` og strict JSON-schema. Opptaker for dommer-svar (`judge:record`) og live-test (`judge:smoke`) | 46 / 11 / 33 |

## Live-test mot OpenRouter
Vi kjørte ekte kall med gruppas nøkkel, som aldri ble lest av KI-en eller logget.
- **Det første live-kallet avslørte en feil som mock-testene ikke kunne fange.** Modellen resonnerer som standard, og reasoning-tokens spiste hele `max_tokens`, så det første kallet ga ikke noe svar. Rettet med `reasoning: { effort: "none" }` og en fast grense på 2 048 tokens.
- **Etter rettingen** holder det med ett kall, med 0 reasoning-tokens, 1,3–1,7 s og rundt $0,00006 per spørsmål.
- **Grupperingen er riktig** opptil 120 ulike svar per spørsmål (30 av 30 grupper ved 120 svar). Ved 180 og 240 svar ga modellen ugyldig output og falt tilbake til manuell gruppering, som FR-17 tillater. Tid er aldri grensen: 240 svar tok 6,7 s. Målingene står i `delivery-notes.md`.

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/epic-4-*.md`, med seksjonen «Epic 4 review fixes» nederst.
- **`bmad-code-review`** (fire reviewere): 1 høy og 4 lave.
  - Den høye var reasoning-feilen over, og den er rettet.
  - De lave: logging av uventede feil fra dommeren, en test for at en avvist lukking ikke starter gruppering, og at README sier hva som skjer uten nøkkel.
  - Funnet i orden: dommeren får bare spørsmålsteksten og normaliserte svar, nøkkelen logges aldri, testene går aldri ut på nett, og uten nøkkel brukes replay.
- **`ponytail-review`:** dommen er «ship», uten «must». Overlappende fallback-tester er fjernet. Å slå sammen oppslagsreglene for OpenRouter og replay ble avvist, fordi det ville endret oppførselen AD-13 beskriver.
- **`impeccable` audit** (17/20):
  - Bruksrapporten hentes ved klikk, så feil vises som en melding i stedet for rå JSON.
  - Teksten om treg gruppering ber ikke lenger om å laste inn siden på nytt, når siden allerede sjekker status selv.
- **Jakt på ustabile tester:** hele e2e-suiten passerte 86/86 fem ganger på rad, og én gang til under CPU-last. En ustabil anonymitetstest fra 3.3 ble rettet før reviewen: testen leste klokka og satte den på pause i to separate kall.

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 567 passerer. `npm run test:e2e`: 86 passerer.

## Kjente begrensninger
- Over cirka 120–180 ulike svar per spørsmål havner dommeren i fallback (`shortcut:` i `delivery-notes.md`).
- `data/rulings/` er tom til story 7.1 og 7.2. Uten nøkkel blir alle spørsmål gruppert for hånd fram til da.
- «Gå til gjennomgangen» kommer i story 5.1.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
