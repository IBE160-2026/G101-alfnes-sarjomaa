import { canonicalise, type Judge } from "@/server/judge/core";
import { PROMPT_VERSION } from "@/server/judge/prompt";

// Vitest only: no I/O. The map is keyed by the exact Question text; unknown Questions get
// one cluster per item.
export function createMockJudge(map: Record<string, number[]> = {}): Judge {
  return {
    info: { provider: "mock", model: "mock", promptVersion: PROMPT_VERSION },
    async partition({ question, items }) {
      const raw = Object.hasOwn(map, question)
        ? map[question]
        : items.map((_, i) => i);
      return {
        assignments: canonicalise(raw, items.length),
        calls: 1,
        uncovered: 0,
        source: "live",
      };
    },
  };
}
