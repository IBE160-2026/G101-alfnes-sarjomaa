import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { normalize, NORMALIZE_VERSION } from "@/lib/normalize";
import { env } from "@/server/env";
import {
  canonicalise,
  JudgeError,
  type FallbackReason,
  type Judge,
} from "@/server/judge/core";
import {
  ASSIGNMENTS_SCHEMA,
  maxTokens,
  messages,
  PROMPT_VERSION,
} from "@/server/judge/prompt";
import { loadRulings, type Ruling } from "@/server/judge/providers/replay";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type Completion = {
  choices?: { finish_reason?: string; message?: { content?: string } }[];
  usage?: unknown;
};

// `dir: null` skips stored rulings, so the recorder and the smoke test always call the model.
export function createOpenRouterJudge({
  apiKey = env.OPENROUTER_API_KEY ?? "",
  model = env.JUDGE_MODEL,
  dir = join(process.cwd(), "data/rulings"),
  onUsage,
}: {
  apiKey?: string;
  model?: string;
  dir?: string | null;
  onUsage?: (usage: unknown) => void;
} = {}): Judge {
  const info = {
    provider: "openrouter",
    model,
    promptVersion: PROMPT_VERSION,
  } as const;
  let rulings: Promise<Ruling[]> | undefined;

  return {
    info,
    async partition({ question, items }, signal) {
      if (dir !== null) {
        const key = normalize(question);
        const stored = (await (rulings ??= loadRulings(dir))).find(
          (r) =>
            r.normalizeVersion === NORMALIZE_VERSION &&
            normalize(r.question) === key &&
            isDeepStrictEqual(r.items, items),
        );
        if (stored)
          return {
            assignments: canonicalise(stored.assignments, items.length),
            calls: 0,
            uncovered: 0,
            source: "stored",
            model: stored.model,
            promptVersion: stored.promptVersion,
          };
      }
      if (!apiKey) throw new JudgeError("NO_KEY");

      const body = JSON.stringify({
        model,
        messages: messages({ question, items }),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "partition",
            strict: true,
            schema: ASSIGNMENTS_SCHEMA,
          },
        },
        temperature: 0,
        max_tokens: maxTokens(items.length),
        provider: { require_parameters: true, data_collection: "deny" },
      });

      // Assignments, or the reason a retry is allowed for.
      const attempt = async (): Promise<number[] | FallbackReason> => {
        const response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body,
          signal,
        });
        if (response.status === 429 || response.status >= 500) {
          await response.body?.cancel();
          // shortcut: retries at once and ignores Retry-After, so a 429 usually repeats; wait for Retry-After inside the signal if 429s show up in the pilot.
          return "ERROR";
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw new JudgeError("ERROR");
        }
        const text = await response.text();
        let completion: Completion | null;
        try {
          completion = JSON.parse(text);
        } catch {
          return "INVALID_OUTPUT";
        }
        if (completion?.usage !== undefined) onUsage?.(completion.usage);
        const choice = completion?.choices?.[0];
        if (choice?.finish_reason === "content_filter")
          throw new JudgeError("REFUSAL");
        try {
          return canonicalise(
            JSON.parse(choice?.message?.content ?? "").assignments,
            items.length,
          );
        } catch {
          return "INVALID_OUTPUT";
        }
      };

      for (let calls = 1; ; calls++) {
        if (signal.aborted) throw new JudgeError("TIMEOUT", calls - 1);
        const outcome = await attempt().catch((error: unknown) => {
          throw new JudgeError(
            signal.aborted
              ? "TIMEOUT"
              : error instanceof JudgeError
                ? error.reason
                : "ERROR",
            calls,
          );
        });
        if (Array.isArray(outcome))
          return {
            assignments: outcome,
            calls,
            uncovered: 0,
            source: "live",
            model: info.model,
            promptVersion: info.promptVersion,
          };
        if (calls === 2) throw new JudgeError(outcome, calls);
      }
    },
  };
}
