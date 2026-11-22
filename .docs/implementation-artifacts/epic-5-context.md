# Epic 5 Context: Host reviews the Grouping and locks the Board

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The Host reads each Question's Groups ranked in Board order with Counts and raw Answers, corrects them (merge, move Answers to an existing or new Group, rename, discard, restore), marks each Question reviewed and locks the Board. Locking freezes a Board snapshot, clears all contributor data and moves the Game to *ready*, so play never sees data that is still changing. This is the decision point of the product: the Host must be able to judge whether the Grouping is fair, and keep a hurtful Group off the shared screen, without ever learning who wrote what.

## Stories

- Story 5.1: Review screen with ranked Groups, Counts and raw Answers
- Story 5.2: Merge Groups
- Story 5.3: Move Answers to another Group or a new Group
- Story 5.4: Rename, discard and restore Groups
- Story 5.5: Mark Questions reviewed and lock the Board

## Requirements & Constraints

- **Display:** every Answer sits under exactly one Group, shown with label, Count and Answers in Board order. Groups below the Board limit are listed separately and marked as not shown in play; discarded Groups stay visible under their own heading. No confidence signal appears anywhere.
- **Ranking and labels:** Groups order by Count (distinct Contributor keys), then rank-1 count, then label under `Intl.Collator('nb', { sensitivity: 'base' })`, then `groupId`. Default label is the normalised text given by the most distinct Contributor keys, ties by shortest, cut to 40 characters at a word boundary; effective label is `custom_label ?? defaultLabel`.
- **Corrections:** merge, move selected Answers to a new or existing Group, rename (1 to 40 characters, else `INVALID_INPUT`), discard and restore. Counts are recomputed after every change, emptied Groups are deleted, and any change clears that Question's reviewed mark. No general undo.
- **Board limit 8:** the Board is the top eight non-discarded Groups per Question; discarding one of them promotes the ninth. A Question with no non-discarded Group cannot be marked reviewed (`NO_GROUPS_ON_BOARD`). Locking needs every Question reviewed.
- **Anonymity:** Host views and DTOs never select `contributor_key` or `rank`; Review gets `count` and `rank1_count` as SQL aggregates and Answers sorted by `normalized_text`, then `text`. After lock every `contributor_key` and `rank` is NULL (checked by `anonymity.test.ts`). Nothing is logged that holds Answer text.
- **Fallback Notice:** a warning Notice names the Questions that fell back, copy chosen by `fallback_reason`, and is absent when none fell back. `NO_KEY`: no key set up, all Questions start with one Group per distinct text. `NO_STORED_RULING`: no stored ruling for Question N. `TIMEOUT`, `ERROR`, `REFUSAL`, `INVALID_OUTPUT`: "the Judge did not group Question N". Demo mode uses the `NO_STORED_RULING` wording, never the key sentence. Fallback Questions get the rail word "Manuell".
- **Counters (FR-18):** every edit bumps its counter (`groups_merged`, `answers_moved`, `groups_created`, `groups_renamed`, `groups_discarded`, `groups_restored`) and the affected Groups' `edit_count`. Host-made Groups never use `origin = judge`.
- **Quality bars:** NFR-5 (each action shows its result within one second), NFR-6 (WCAG 2.1 AA, axe clean of serious or critical), NFR-4 (Review on a laptop), all UI in bokmål. Every state-dependent operation has a `WRONG_STATE` case and a foreign-Host `NOT_FOUND` case; FR IDs in test titles and rows in `tests/TRACE.md`.

## Technical Decisions

- **Writers (AD-15):** Review edits Groups only through `grouping` writers, in one transaction each: edit, `edit_count`, counter bump (`games.bumpCounters`, the only counter writer) and `questions.setReviewed(tx, id, false)`, the only `question` write allowed outside *draft*. Every operation starts with `games.lockForMutation` for *in review*; a Game in *ready* or any other state gets `WRONG_STATE`.
- **Authorisation (AD-5):** resolve the owned Game first, then every `groupId` and `answerId` inside it; all IDs in one operation must share one `question_id`. Any miss (missing, foreign, another Question, a discarded target) is `NOT_FOUND` and nothing changes.
- **Ranking (AD-11):** order and cut only through `rankGroups()` and `boardCut()` in `src/lib/ranking.ts`. Merge keeps the ID of the highest-ranked source and freezes its effective label as `custom_label`.
- **Locking the Board:** `review.confirmBoard` writes `board_slot` (position 1 to 8, label, frozen Count, nullable `group_id`) from `boardCut(rankGroups())`, calls `grouping.clearContributorData`, and transitions to `ready`. Play reads only `board_slot`, through `review.getBoard`. It must also add an on-Board flag per Group (from `board_slot.group_id`) to the usage report, so SM-5 can tell a Board Group from a discarded or cut one.
- **Result shape and refresh (AD-17):** mutations are Server Actions in `src/app/**/actions.ts` with zod schemas in a sibling `schema.ts`, returning `{ ok: true, data } | { ok: false, code, message, fieldErrors? }`. Each calls `revalidatePath`; there is no client data library. The module entry point re-validates with shared `src/lib` schemas. New `ErrorCode`s (such as `NO_GROUPS_ON_BOARD`) get bokmål messages in `src/lib/errors.ts`. Non-`DomainError`s become `INTERNAL` with no cause; actions never throw to Next. `/spill/[id]/gjennomgang` is a server component; no new Route Handlers.
- **Schema:** `answer_group` has `origin` and `edit_count` from epic 4; this epic adds `custom_label`, a discarded marker, `question.reviewed` and `board_slot`. Migrations are generated and committed with `ON DELETE CASCADE` toward `game`. Review reads `grouping_result.fallback_reason`.

## UX & Interaction Patterns

- **Layout:** laptop, content max 1280 px. A 288 px Question rail beside a flexible main pane. Rail: "K av N gjennomgått", one row per Question (number, truncated text, full text in `title` and accessible name), visible status words only "✓ Gjennomgått" and "Manuell", `aria-current` on the current one, and "Lås brettet" at its foot, `aria-disabled` with "Gjennomgå alle spørsmålene først (N igjen)." until all are reviewed, then a ConfirmDialog. Below 1280 px the rail is 240 px, below 1024 px a `<select>` above the pane, below 768 px a notice that Review is made for larger screens.
- **Main pane:** header "Spørsmål N av M" with "Marker som gjennomgått" at the right (after review: "✓ Gjennomgått" and "Neste spørsmål"). Sections with `<h3>` in `title` type: "På brettet (8 grupper)" with ranks 1 to 8; a 2 px `line-strong` divider "Alt under streken vises ikke i spillet", shown only above eight; "Ikke på brettet" on `surface-sunken` with a dashed border and the sentence that they do not show in play and must be merged up to count; read-only "Forkastet" with struck label and one "Angre forkasting". Empty sections are omitted.
- **Cards and chips:** GroupCard with checkbox, rank, label, "1 person" / "N personer" and an always-visible menu ("Gi nytt navn", "Forkast fra brettet"); label click starts rename ("N/40", Enter saves, Esc cancels). Equal normalised texts collapse into one chip "{text} · N svar", chips sorted alphabetically, never by arrival or rank. A Group with one chip equal to its label renders as a compact 52 px row (presentation only, still an ordinary Group). Group selection and chip selection are mutually exclusive.
- **SelectionBar:** sticky at the bottom of the main pane, only with a selection: merge for two or more Groups ("Velg minst to grupper for å slå sammen." for one), "Flytt til gruppe" (native `<select>` of non-discarded Groups as "label (N)") and "Ny gruppe" for Answers; "Fjern valg" or Esc and a Question change clear it.
- **Operations are pessimistic:** wait for the server, affected cards `aria-busy` and dimmed, focus to the affected Group heading, polite live-region announcements with the literal strings from the UX contract. Failure reads "Endringen ble ikke lagret. Prøv igjen." where the Host is looking (inside the SelectionBar, at the top of the card, or under the mark button) and leaves screen and selection unchanged. A stale tab after lock shows "Brettet er allerede låst." with a link to the Game page.
- **Game page:** in *in review* it gains "Gå til gjennomgangen"; Review for a Game not in *in review* redirects to the Game page. Locking lands there with "Brettet er låst. N spørsmål er klare."
- **Voice:** literal bokmål, "du", no exclamation marks, 44 px targets, visible focus (inverse focus ring on the dark SelectionBar). UI work uses `impeccable` with `ponytail`.

## Cross-Story Dependencies

- 5.1 first: it builds `src/lib/ranking.ts` and the screen that 5.2 to 5.4 attach to; 5.2 to 5.4 share the writer pattern and SelectionBar; 5.5 needs all of them and reads `boardCut()` and `edit_count`.
- Builds on epic 4: `grouping_result` (`fallback_reason`, source), Group `origin` and `edit_count`, `bumpCounters`, and the report route that 5.5 extends.
- Feeds epic 6: play reads only `board_slot` via `review.getBoard`, and the Game page's "Start spillet" appears in *ready*.
- Epic 7's Demo mode relies on the same Review path and the `NO_STORED_RULING` Notice wording.
