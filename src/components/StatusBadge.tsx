import type { GameState } from "@/lib/game-state";

// Fixed word and colors per state (DESIGN.md): the word carries the state, not the color.
const BADGES: Record<GameState, { word: string; className: string }> = {
  draft: { word: "Utkast", className: "bg-surface-sunken text-ink" },
  collecting: { word: "Samler inn", className: "bg-primary-soft text-primary" },
  grouping: { word: "Grupperer", className: "bg-warning-soft text-warning" },
  in_review: {
    word: "Til gjennomgang",
    className: "bg-warning-soft text-warning",
  },
  ready: { word: "Klar", className: "bg-success-soft text-success" },
  playing: { word: "Spilles", className: "bg-primary-soft text-primary" },
  played: { word: "Ferdig", className: "bg-surface-sunken text-ink-muted" },
};

export function StatusBadge({ state }: { state: GameState }) {
  const { word, className } = BADGES[state];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-label ${className}`}
    >
      {word}
    </span>
  );
}
