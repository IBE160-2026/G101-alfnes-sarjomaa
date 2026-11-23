import { describe, expect, it } from "vitest";
import { bcubed } from "@/lib/bcubed";

// Gold X = {a, b}, Y = {c}; Groups 1 = {a, c}, 2 = {b}; weights 1, 2, 3 (total 6).
// Precision: a 1/4 × 1, b 2/2 × 2, c 3/4 × 3 = 9/2 → 3/4.
// Recall: a 1/3 × 1, b 2/3 × 2, c 3/3 × 3 = 14/3 → 7/9. F1 = 2·(3/4)(7/9)/(3/4 + 7/9) = 42/55.
const handComputed = [
  { weight: 1, gold: "X", group: "1" },
  { weight: 2, gold: "X", group: "2" },
  { weight: 3, gold: "Y", group: "1" },
];

// Three gold clusters of unequal weight; `group` is overwritten per partition.
const gold = [
  { weight: 5, gold: "A" },
  { weight: 1, gold: "A" },
  { weight: 3, gold: "B" },
  { weight: 2, gold: "B" },
  { weight: 2, gold: "C" },
  { weight: 2, gold: "C" },
];

describe("bcubed", () => {
  it("FR-32: matches the hand-computed weighted example (P 3/4, R 7/9, F1 42/55)", () => {
    const { precision, recall, f1 } = bcubed(handComputed);
    expect(precision).toBeCloseTo(3 / 4, 12);
    expect(recall).toBeCloseTo(7 / 9, 12);
    expect(f1).toBeCloseTo(42 / 55, 12);
  });

  it("FR-32: the correct partition scores 1, and all-in-one and all-alone score clearly below it", () => {
    const correct = bcubed(gold.map((item) => ({ ...item, group: item.gold })));
    const allInOne = bcubed(gold.map((item) => ({ ...item, group: "one" })));
    const allAlone = bcubed(
      gold.map((item, i) => ({ ...item, group: `${i}` })),
    );
    expect(correct).toEqual({ precision: 1, recall: 1, f1: 1 });
    expect(allInOne.recall).toBe(1);
    expect(allAlone.precision).toBe(1);
    expect(allInOne.f1).toBeLessThan(0.8);
    expect(allAlone.f1).toBeLessThan(0.8);
  });

  it("FR-32: refuses an empty list and a non-positive weight", () => {
    expect(() => bcubed([])).toThrow();
    expect(() => bcubed([{ weight: 0, gold: "A", group: "1" }])).toThrow();
  });
});
