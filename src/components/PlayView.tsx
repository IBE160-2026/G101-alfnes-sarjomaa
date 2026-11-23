import { FullscreenKey } from "@/components/FullscreenKey";
import type { PlayView as Data } from "@/server/play";

// 56 px up to this many characters, 48 px above (EXPERIENCE.md, play view rules).
const SHORT_QUESTION = 80;

// FR-23: the shared screen from saved state. Fixed over the Host page, whose chrome
// globals.css hides while a [data-stage] element is on the page.
// shortcut: a fluid two-column shell, no Board; the 1920×1080 scaled canvas, Board tiles and control bar arrive in Stories 6.2 and 6.3.
export function PlayView({ question, total, teams }: Data) {
  return (
    <div
      data-stage=""
      className="fixed inset-0 overflow-y-auto bg-stage font-display text-stage-ink [&_:focus-visible]:outline-focus-inverse"
    >
      <div className="grid min-h-full gap-x-8 gap-y-12 px-8 py-12 lg:grid-cols-[minmax(0,1fr)_448px] lg:grid-rows-[1fr_auto] lg:px-16">
        <h1
          className={`self-start break-words text-balance ${
            question.text.length > SHORT_QUESTION
              ? "text-tv-question-long"
              : "text-tv-question"
          }`}
        >
          {question.text}
        </h1>
        <div className="lg:row-span-2">
          <p className="text-tv-team text-stage-muted">
            Spørsmål {question.position} av {total}
          </p>
          <ol aria-label="Lag" className="mt-6 flex flex-col gap-4">
            {teams.map((team) => (
              <li
                key={team.id}
                aria-current={team.current || undefined}
                className={`rounded-md p-6 ${
                  team.current
                    ? "bg-stage-accent text-stage-on-accent"
                    : "bg-stage-raised"
                }`}
              >
                {team.current && <p className="text-tv-team">Svarer nå</p>}
                <p className="text-tv-team break-words">{team.name}</p>
                <p className="mt-2 text-tv-score tabular-nums">
                  {team.score}
                  <span className="sr-only"> poeng</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
        <FullscreenKey className="self-end font-sans text-tv-control text-stage-muted" />
      </div>
    </div>
  );
}
