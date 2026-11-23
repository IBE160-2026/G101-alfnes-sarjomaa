import "server-only";
import { env } from "@/server/env";
import type { Judge } from "@/server/judge/core";
import { createMockJudge } from "@/server/judge/providers/mock";
import { createOpenRouterJudge } from "@/server/judge/providers/openrouter";
import { createReplayJudge } from "@/server/judge/providers/replay";

export { JudgeError } from "@/server/judge/core";
export type {
  FallbackReason,
  Judge,
  PartitionResult,
} from "@/server/judge/core";

export function getJudge(): Judge {
  switch (env.JUDGE_PROVIDER) {
    case "mock":
      return createMockJudge();
    case "replay":
      return createReplayJudge();
    case "openrouter":
      return createOpenRouterJudge();
  }
}

// For src/cli: always a live call, never a stored ruling.
export function getLiveJudge(onUsage?: (usage: unknown) => void): Judge {
  return createOpenRouterJudge({ dir: null, onUsage });
}
