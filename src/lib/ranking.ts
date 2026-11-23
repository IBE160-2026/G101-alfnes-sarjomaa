// AD-11: the one place Groups are ordered and the Board is cut. Pure.
import { BOARD_SIZE, LABEL_MAX } from "@/lib/limits";

export type RankInput = {
  groupId: string;
  // Distinct Contributor keys (FR-15).
  count: number;
  rank1Count: number;
  // Each normalised text of the Group with its distinct Contributor keys, and the
  // written form the label shows (its most common raw text, FR-16).
  labelCandidates: { text: string; count: number; display?: string }[];
  customLabel?: string | null;
  discarded?: boolean;
};

const collator = new Intl.Collator("nb", { sensitivity: "base" });

// Most Contributor keys, then the shortest, then code-unit order, all on the normalised
// text; shown in its written form and cut at a word boundary.
export function defaultLabel(candidates: RankInput["labelCandidates"]): string {
  const [best] = [...candidates].sort(
    (a, b) =>
      b.count - a.count ||
      a.text.length - b.text.length ||
      (a.text < b.text ? -1 : a.text > b.text ? 1 : 0),
  );
  const text = best ? (best.display ?? best.text) : "";
  if (text.length <= LABEL_MAX) return text;
  // A space right after the 40th character still ends a whole word.
  const space = text.slice(0, LABEL_MAX + 1).lastIndexOf(" ");
  return space > 0 ? text.slice(0, space) : hardCut(text);
}

const graphemes = new Intl.Segmenter("nb", { granularity: "grapheme" });

// At most 40 code units (the rename schema's count), never inside a grapheme, so an
// emoji or a letter with a combining mark is never split.
function hardCut(text: string): string {
  let end = 0;
  for (const { index, segment } of graphemes.segment(text)) {
    if (index + segment.length > LABEL_MAX) break;
    end = index + segment.length;
  }
  return text.slice(0, end || LABEL_MAX);
}

export function rankGroups<T extends RankInput>(
  groups: T[],
): (T & { label: string })[] {
  return groups
    .map((g) => ({
      ...g,
      label: g.customLabel ?? defaultLabel(g.labelCandidates),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.rank1Count - a.rank1Count ||
        collator.compare(a.label, b.label) ||
        (a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0),
    );
}

// Takes rankGroups() output; each part keeps the ranked order.
export function boardCut<T extends { discarded?: boolean }>(ranked: T[]) {
  const kept = ranked.filter((g) => !g.discarded);
  return {
    board: kept.slice(0, BOARD_SIZE),
    below: kept.slice(BOARD_SIZE),
    discarded: ranked.filter((g) => g.discarded),
  };
}
