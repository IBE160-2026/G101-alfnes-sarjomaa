import { describe, expect, it, vi } from "vitest";
import { shuffle } from "@/lib/shuffle";

const pick = vi.hoisted(() => ({
  fixed: null as null | number,
  maxes: [] as number[],
}));
vi.mock("node:crypto", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:crypto")>();
  return {
    ...real,
    randomInt: (max: number) => {
      pick.maxes.push(max);
      return pick.fixed ?? real.randomInt(max);
    },
  };
});

describe("shuffle", () => {
  it("FR-13, FR-17, AD-9: always returns a permutation of its input and leaves the input unmutated", () => {
    const input = Array.from({ length: 45 }, (_, i) => i);
    const copy = [...input];
    for (let run = 0; run < 50; run++) {
      const out = shuffle(input);
      expect(out).not.toBe(input);
      expect([...out].sort((a, b) => a - b)).toEqual(copy);
    }
    expect(input).toEqual(copy);
    expect(shuffle([])).toEqual([]);
    expect(shuffle(["a"])).toEqual(["a"]);
  });

  it("FR-13, FR-17, AD-9: the swaps come from crypto randomInt, as a Fisher-Yates from the end", () => {
    pick.fixed = 0;
    pick.maxes = [];
    try {
      expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
      // randomInt(i + 1), so j may equal i; randomInt(i) would be Sattolo's cycle.
      expect(pick.maxes).toEqual([4, 3, 2]);
    } finally {
      pick.fixed = null;
    }
  });
});
