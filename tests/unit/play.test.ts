import { describe, expect, it } from "vitest";
import { revealSchema } from "@/lib/play";

describe("revealSchema", () => {
  it("FR-25 (AC3), AD-16: accepts gameId, boardSlotId and a boolean scored, and refuses a missing or non-boolean scored", () => {
    for (const scored of [true, false])
      expect(
        revealSchema.safeParse({ gameId: "g", boardSlotId: "s", scored })
          .success,
      ).toBe(true);
    for (const input of [
      { gameId: "g", boardSlotId: "s" },
      { gameId: "g", boardSlotId: "s", scored: "true" },
      { gameId: "g", boardSlotId: "s", scored: 1 },
      { gameId: "g", scored: true },
    ])
      expect(revealSchema.safeParse(input).success).toBe(false);
  });
});
