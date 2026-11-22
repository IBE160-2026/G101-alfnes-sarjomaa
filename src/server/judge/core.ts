// Shared by index.ts and the providers, so no provider imports index.ts (AD-13).
export type FallbackReason =
  | "NO_KEY"
  | "NO_STORED_RULING"
  | "TIMEOUT"
  | "ERROR"
  | "REFUSAL"
  | "INVALID_OUTPUT";

// `calls` counts the requests a provider sent before failing, so a failed Question still reports its cost.
// `status` is the last non-2xx HTTP status, so judge:smoke can tell a wrong key (401) from a bad request.
export class JudgeError extends Error {
  constructor(
    readonly reason: FallbackReason,
    readonly calls = 0,
    readonly status?: number,
  ) {
    super(reason);
    this.name = "JudgeError";
  }
}

export type PartitionResult = {
  assignments: number[];
  calls: number;
  uncovered: number;
  source: "live" | "stored";
  // What produced this result: replay mixes rulings from different models and prompt versions.
  model: string;
  promptVersion: string;
};

export interface Judge {
  readonly info: {
    provider: "openrouter" | "replay" | "mock";
    model: string;
    promptVersion: string;
  };
  partition(
    input: { question: string; items: string[] },
    signal: AbortSignal,
  ): Promise<PartitionResult>;
}

// Valid output is one integer per item; it comes back numbered 0..k-1 in first-occurrence order.
export function canonicalise(raw: unknown, length: number): number[] {
  if (!Array.isArray(raw) || raw.length !== length)
    throw new JudgeError("INVALID_OUTPUT");
  // Array.from turns holes into undefined, which every() would otherwise skip.
  const values = Array.from(raw);
  if (!values.every((value) => Number.isInteger(value)))
    throw new JudgeError("INVALID_OUTPUT");
  const ids = new Map<number, number>();
  return values.map((value: number) => {
    if (!ids.has(value)) ids.set(value, ids.size);
    return ids.get(value)!;
  });
}
