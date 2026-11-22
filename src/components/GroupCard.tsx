type Chip = { text: string; n: number };

const LOOKS = {
  board: "border border-line bg-surface",
  below: "border border-dashed border-line-strong bg-surface-sunken",
  discarded: "border border-line bg-surface-sunken",
};

const people = (n: number) => (n === 1 ? "1 person" : `${n} personer`);

// Presentational only (FR-19): no checkbox, menu or rename until Stories 5.2 to 5.4.
// Answers stay in the order given, which is alphabetical (FR-13).
export function GroupCard({
  rank,
  label,
  count,
  chips,
  look,
}: {
  rank?: number;
  label: string;
  count: number;
  chips: Chip[];
  look: keyof typeof LOOKS;
}) {
  const compact = look !== "discarded" && chips.length === 1;
  const header = (
    <>
      {rank !== undefined && (
        <span className="w-7 shrink-0 text-title tabular-nums">{rank}.</span>
      )}
      <h4
        className={`min-w-0 text-title break-words ${look === "discarded" ? "line-through" : ""}`}
      >
        {label}
      </h4>
      {/* Raw strings on purpose: the default label is normalised, and the Host must see the written form (FR-19). */}
      {compact && (chips[0].text !== label || chips[0].n > 1) && (
        <span className="min-w-0 text-body-sm break-words text-ink-muted">
          {chips[0].text}
          {chips[0].n > 1 && ` · ${chips[0].n} svar`}
        </span>
      )}
      <span className="ml-auto shrink-0 pl-4 whitespace-nowrap">
        {people(count)}
      </span>
    </>
  );

  if (compact)
    return (
      <li
        className={`flex min-h-13 items-center gap-3 rounded-md px-4 py-2 ${LOOKS[look]}`}
      >
        {header}
      </li>
    );

  return (
    <li className={`rounded-md px-4 py-3 ${LOOKS[look]}`}>
      <div className="flex items-baseline gap-3">{header}</div>
      {look === "discarded" ? (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
          {chips.map((chip) => (
            <li key={chip.text} className="break-words">
              {chip.text}
              {chip.n > 1 && ` · ${chip.n} svar`}
            </li>
          ))}
        </ul>
      ) : (
        <ul
          className={`mt-2 flex flex-wrap gap-2 ${rank !== undefined ? "pl-10" : ""}`}
        >
          {chips.map((chip) => (
            <li
              key={chip.text}
              className={`inline-flex min-h-11 max-w-full items-center rounded-sm px-3 py-2 break-words ${look === "below" ? "bg-surface" : "bg-surface-sunken"}`}
            >
              <span className="min-w-0">
                {chip.text}
                {chip.n > 1 && (
                  <span className="text-ink-muted"> · {chip.n} svar</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
