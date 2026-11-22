import "server-only";
import { env } from "@/server/env";
import type { Judge } from "@/server/judge/core";
import { createMockJudge } from "@/server/judge/providers/mock";
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
      // shortcut: the key-derived default replays stored rulings, replace with the live provider in Story 4.4.
      return createReplayJudge();
  }
}
