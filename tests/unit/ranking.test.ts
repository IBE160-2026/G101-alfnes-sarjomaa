import { describe, expect, it } from "vitest";
import { BOARD_SIZE, LABEL_MAX } from "@/lib/limits";
import {
  boardCut,
  defaultLabel,
  rankGroups,
  type RankInput,
} from "@/lib/ranking";

const group = (
  groupId: string,
  count: number,
  rank1Count: number,
  label: string,
  extra: Partial<RankInput> = {},
): RankInput => ({
  groupId,
  count,
  rank1Count,
  labelCandidates: [{ text: label, count }],
  ...extra,
});

const ids = (groups: { groupId: string }[]) => groups.map((g) => g.groupId);

describe("defaultLabel", () => {
  it("FR-16 (AC1): takes the normalised text with the most Contributor keys", () => {
    expect(
      defaultLabel([
        { text: "kjenner sjefen", count: 1 },
        { text: "jeg kjenner eieren", count: 3 },
      ]),
    ).toBe("jeg kjenner eieren");
  });

  it("FR-16 (AC1): breaks a tie by the shortest text, then by code-unit order", () => {
    expect(
      defaultLabel([
        { text: "eieren er kompisen min", count: 2 },
        { text: "kjenner eieren", count: 2 },
      ]),
    ).toBe("kjenner eieren");
    // Code units, not the collator: "Z" (0x5A) sorts before "a" (0x61).
    expect(
      defaultLabel([
        { text: "ab", count: 1 },
        { text: "Zb", count: 1 },
      ]),
    ).toBe("Zb");
  });

  it("FR-16: chooses on the normalised text but returns the chosen text's written form", () => {
    expect(
      defaultLabel([
        { text: "kjenner eieren", count: 2, display: "Kjenner eieren" },
        { text: "eieren", count: 1, display: "Eieren" },
      ]),
    ).toBe("Kjenner eieren");
    // The tie on Count goes to the shorter normalised text, whatever its written form.
    expect(
      defaultLabel([
        { text: "ab", count: 1, display: "Ab!!!" },
        { text: "abc", count: 1, display: "Abc" },
      ]),
    ).toBe("Ab!!!");
  });

  it("FR-16 (AC1): keeps a 40-character text and cuts a longer one at the last word boundary", () => {
    const forty = "a".repeat(LABEL_MAX);
    expect(defaultLabel([{ text: forty, count: 1 }])).toBe(forty);
    const words = "han sier alltid at han kjenner eieren av stedet";
    expect(words.length).toBeGreaterThan(LABEL_MAX);
    expect(defaultLabel([{ text: words, count: 1 }])).toBe(
      "han sier alltid at han kjenner eieren av",
    );
    // A space right after the 40th character keeps all 40.
    expect(defaultLabel([{ text: `${forty} b`, count: 1 }])).toBe(forty);
  });

  it("FR-16 (AC1): cuts hard at 40 when the first 40 characters hold no space", () => {
    expect(defaultLabel([{ text: `${"x".repeat(45)} y`, count: 1 }])).toBe(
      "x".repeat(LABEL_MAX),
    );
  });

  it("FR-16: a hard cut never splits a surrogate pair or a grapheme", () => {
    // "😀" is two code units at 39 and 40; "e\u0301" is one grapheme at 39 and 40.
    const x = "x".repeat(LABEL_MAX - 1);
    expect(defaultLabel([{ text: `${x}😀yz`, count: 1 }])).toBe(x);
    expect(defaultLabel([{ text: `${x}e\u0301yz`, count: 1 }])).toBe(x);
    expect(defaultLabel([{ text: `${"x".repeat(38)}😀yz`, count: 1 }])).toBe(
      `${"x".repeat(38)}😀`,
    );
  });
});

describe("rankGroups", () => {
  it("FR-16 (AC1): orders by Count, then rank-1 count, then label under the nb collator, then groupId", () => {
    const ranked = rankGroups([
      group("g1", 2, 0, "banan"),
      group("g2", 3, 0, "zebra"),
      group("g3", 2, 1, "øl"),
      // Same Count and rank-1 count: "Eple" and "eple" are equal at base sensitivity,
      // so the groupId decides between them, and "ål" sorts after "banan" in nb.
      group("g5", 2, 0, "Eple"),
      group("g4", 2, 0, "eple"),
      group("g6", 2, 0, "ål"),
    ]);
    expect(ids(ranked)).toEqual(["g2", "g3", "g1", "g4", "g5", "g6"]);
  });

  it("FR-16 (AC1): the nb collator puts æ, ø, å after z", () => {
    const ranked = rankGroups(
      ["å", "z", "ø", "æ"].map((label) => group(label, 1, 0, label)),
    );
    expect(ranked.map((g) => g.label)).toEqual(["z", "æ", "ø", "å"]);
  });

  it("FR-16 (AC1): the effective label is customLabel ?? defaultLabel, and ranks by it", () => {
    const ranked = rankGroups([
      group("g1", 1, 0, "b"),
      group("g2", 1, 0, "c", { customLabel: "a" }),
      group("g3", 1, 0, "d", { customLabel: null }),
    ]);
    expect(ranked.map((g) => [g.groupId, g.label])).toEqual([
      ["g2", "a"],
      ["g1", "b"],
      ["g3", "d"],
    ]);
  });
});

describe("boardCut", () => {
  it(`FR-16 (AC1): the Board is the top ${BOARD_SIZE} non-discarded Groups, the rest below, discarded apart, each in ranked order`, () => {
    const ranked = rankGroups(
      Array.from({ length: 11 }, (_, i) =>
        group(`g${String(i).padStart(2, "0")}`, 20 - i, 0, `l${i}`, {
          discarded: i === 2 || i === 9,
        }),
      ),
    );
    const { board, below, discarded } = boardCut(ranked);
    expect(ids(board)).toEqual([
      "g00",
      "g01",
      "g03",
      "g04",
      "g05",
      "g06",
      "g07",
      "g08",
    ]);
    // Discarding a Board Group promotes the ninth.
    expect(ids(below)).toEqual(["g10"]);
    expect(ids(discarded)).toEqual(["g02", "g09"]);
  });

  it("FR-16 (AC1): three Groups all land on the Board with nothing below", () => {
    const { board, below, discarded } = boardCut(
      rankGroups([
        group("a", 1, 0, "a"),
        group("b", 1, 0, "b"),
        group("c", 1, 0, "c"),
      ]),
    );
    expect(ids(board)).toEqual(["a", "b", "c"]);
    expect(below).toEqual([]);
    expect(discarded).toEqual([]);
  });
});
