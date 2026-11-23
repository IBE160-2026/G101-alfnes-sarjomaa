import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";
import { createGameSchema } from "@/lib/game";
import {
  canTransition,
  GAME_STATES,
  INITIAL_STATE,
  PERMITTED,
  TRANSITIONS,
} from "@/lib/game-state";

const CHAIN = [
  ["draft", "collecting"],
  ["collecting", "grouping"],
  ["grouping", "in_review"],
  ["in_review", "ready"],
  ["ready", "playing"],
  ["playing", "played"],
];

describe("game-state", () => {
  it("AD-4: has the seven states in chain order and starts in draft", () => {
    expect(GAME_STATES).toEqual([
      "draft",
      "collecting",
      "grouping",
      "in_review",
      "ready",
      "playing",
      "played",
    ]);
    expect(INITIAL_STATE).toBe("draft");
  });

  it("AD-4: TRANSITIONS is exactly the six forward edges", () => {
    expect(TRANSITIONS).toEqual(CHAIN);
  });

  it("AD-4: canTransition allows only the six edges among all 49 pairs", () => {
    for (const from of GAME_STATES)
      for (const to of GAME_STATES)
        expect(canTransition(from, to), `${from}→${to}`).toBe(
          CHAIN.some(([f, t]) => f === from && t === to),
        );
  });

  // The integration test walks the table through lockForMutation; this pins its content.
  it("AD-4: every state permits deleteGame, played nothing else", () => {
    expect([...PERMITTED.deleteGame]).toEqual([...GAME_STATES]);
    const playedOps = Object.entries(PERMITTED)
      .filter(([, states]) => states.includes("played"))
      .map(([op]) => op);
    expect(playedOps).toEqual(["deleteGame"]);
  });
});

describe("createGameSchema", () => {
  const MESSAGE = "Navnet må ha 1–80 tegn.";

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["81 characters", "a".repeat(81)],
  ])("FR-2: refuses a %s title with the exact message", (_, title) => {
    const result = createGameSchema.safeParse({ title });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.message)).toEqual([MESSAGE]);
  });

  it.each([1, 80])("FR-2: accepts a %i-character title", (length) => {
    expect(createGameSchema.parse({ title: "a".repeat(length) })).toEqual({
      title: "a".repeat(length),
    });
  });

  it("FR-2: trims the title before counting", () => {
    expect(createGameSchema.parse({ title: "  Hyttetur 2026 " })).toEqual({
      title: "Hyttetur 2026",
    });
    expect(
      createGameSchema.safeParse({ title: ` ${"a".repeat(80)} ` }).success,
    ).toBe(true);
  });
});

it("FR-2, NFR-7: formatDate gives the Norwegian date in Oslo time", () => {
  expect(formatDate(new Date("2026-11-21T23:30:00Z"))).toBe(
    "22. november 2026",
  );
});
