import {
  canonicalise,
  JudgeError,
  type FallbackReason,
  type Judge,
} from "@/server/judge/core";
import { PROMPT_VERSION } from "@/server/judge/prompt";

// A raw assignment list, a reason to throw as a JudgeError, or an Error thrown as is.
export type MockRuling = number[] | FallbackReason | Error;

// Vitest only: no I/O. The map is keyed by the exact Question text; unknown Questions get
// one cluster per item. "TIMEOUT" waits for the signal to abort, as the live provider will.
export function createMockJudge(map: Record<string, MockRuling> = {}): Judge {
  const info = {
    provider: "mock",
    model: "mock",
    promptVersion: PROMPT_VERSION,
  } as const;
  return {
    info,
    async partition({ question, items }, signal) {
      const raw = Object.hasOwn(map, question)
        ? map[question]
        : items.map((_, i) => i);
      if (raw instanceof Error) throw raw;
      if (raw === "TIMEOUT" && !signal.aborted)
        await new Promise((resolve) =>
          signal.addEventListener("abort", resolve, { once: true }),
        );
      if (typeof raw === "string") throw new JudgeError(raw);
      return {
        assignments: canonicalise(raw, items.length),
        calls: 1,
        uncovered: 0,
        source: "live",
        model: info.model,
        promptVersion: info.promptVersion,
      };
    },
  };
}
