// The Game state machine (AD-4). Pure: no server imports.

export const GAME_STATES = [
  "draft",
  "collecting",
  "grouping",
  "in_review",
  "ready",
  "playing",
  "played",
] as const;

export type GameState = (typeof GAME_STATES)[number];

// Entered only by games.create; the six edges below are the other PRD §4.1 transitions.
export const INITIAL_STATE: GameState = "draft";

export const TRANSITIONS: readonly (readonly [GameState, GameState])[] = [
  ["draft", "collecting"],
  ["collecting", "grouping"],
  ["grouping", "in_review"],
  ["in_review", "ready"],
  ["ready", "playing"],
  ["playing", "played"],
];

export function canTransition(from: GameState, to: GameState): boolean {
  return TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export type Operation =
  | "editQuestions"
  | "createInviteLinks"
  | "revokeInviteLink"
  | "openInviteLink"
  | "submitAnswers"
  | "closeCollection"
  | "writeGrouping"
  | "editReview"
  | "confirmBoard"
  | "startPlay"
  | "playMove"
  | "finishPlay"
  | "deleteGame";

// AD-4's permitted-operations table, one operation per row.
export const PERMITTED: Record<Operation, readonly GameState[]> = {
  editQuestions: ["draft"],
  createInviteLinks: ["draft", "collecting"],
  revokeInviteLink: ["collecting"],
  openInviteLink: ["collecting"],
  submitAnswers: ["collecting"],
  closeCollection: ["collecting"],
  writeGrouping: ["grouping"],
  editReview: ["in_review"],
  confirmBoard: ["in_review"],
  startPlay: ["ready"],
  playMove: ["playing"],
  finishPlay: ["playing"],
  deleteGame: GAME_STATES,
};

// Where the usage report can be read (AD-18). A read, not a mutation, so outside PERMITTED.
export const REPORT_STATES: readonly GameState[] = [
  "in_review",
  "ready",
  "playing",
  "played",
];
