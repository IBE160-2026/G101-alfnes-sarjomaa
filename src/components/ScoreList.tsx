// Each Team and its Score, on the Game page and the Host view's final standing.
export function ScoreList({
  teams,
}: {
  teams: { id: string; name: string; score: number }[];
}) {
  return (
    <dl className="mt-4 max-w-md border-t border-line">
      {teams.map((team) => (
        <div
          key={team.id}
          className="flex items-baseline justify-between gap-4 border-b border-line py-3"
        >
          <dt className="min-w-0 break-words">{team.name}</dt>
          <dd className="text-title tabular-nums">
            {team.score}
            <span className="sr-only"> poeng</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
