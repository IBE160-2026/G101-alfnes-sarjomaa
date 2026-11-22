# Promptmal for én story (fase 4)

Orkestratoren (Claude Opus 5.5 i Claude Code) kjører hver story som én subagent med
`bmad-build-auto`, på epicens branch. Malen under ble brukt fra og med story 1.1
(2026-11-22). Fra story 2.5 kom linjene om RTK og caveman i tillegg, for å spare tokens. `{…}` fylles inn per story. Avvik fra malen og alt orkestratoren måtte rette
etterpå, noteres i `prompting/fase-4-implementering/<dato>-epic-N.md`.

```
Implement {Story N.M: tittel} for Toppsvar, unattended.

1. First invoke the Skill tool with skill "ponytail" (argument "full"): smallest complete
   change, but never cut a PRD requirement, anonymity, validation, error handling, security,
   accessibility or tests. {For stories with UI: also invoke "impeccable" and read its
   reference/craft-floor.md before UI edits; DESIGN.md/EXPERIENCE.md win on conflict.
   impeccable's launcher is not installed: use its "Launcher unavailable" path.}
2. Then invoke the Skill tool with skill "bmad-build-auto" and follow it to the end. Intent:
   implement {Story N.M} exactly as written in
   .docs/planning-artifacts/epics/epics-Toppsvar-2026-11-21/epics.md (its acceptance criteria
   are the contract), following ARCHITECTURE-SPINE.md (AD-n cited in the story) and the UX
   spines. Keep the story spec in .docs/implementation-artifacts/ and set the story to done in
   .docs/implementation-artifacts/sprint-status.yaml when it is complete.

Project root: <prosjektrot>
Branch: {epic-N-…} (already checked out, clean tree). Do not switch branches.
Rules:
- Commit messages in Norwegian (bokmål), short imperative subject, ending with the line
  "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Never push. Never commit .env.
- No API keys exist in this environment; tests must pass without network (NFR-3).
- Run checks as `npm run test` (not `npm test`), `npm run test:e2e`, `npm run lint`,
  `npm run typecheck`, so the RTK hook compresses their output. Use `rtk proxy <cmd>` only if
  the output is unusable.
- Invoke the Skill tool with skill "caveman" (argument "full") before writing your final
  report, and write that report in caveman style. Files and commit messages stay in normal
  full sentences.
- No real names (public repo).
- If you reject or correct an AI suggestion during review, say so in the story spec's
  review section (this is grading evidence).
Return: final status, commit hashes, test/lint/typecheck results, and anything deferred.
```
