import { randomInt } from "node:crypto";

// Fisher-Yates over crypto randomness (AD-9). Returns a new array; the input is untouched.
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
