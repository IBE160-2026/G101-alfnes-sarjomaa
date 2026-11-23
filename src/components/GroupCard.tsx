import { people } from "@/lib/format";

type Chip = { text: string; n: number };

const LOOKS = {
  board: "border border-line bg-surface",
  below: "border border-dashed border-line-strong bg-surface-sunken",
  discarded: "border border-line bg-surface-sunken",
};

// group-card-selected: the inset ring makes the 2 px primary edge without moving the layout.
const SELECTED =
  "border border-solid border-primary bg-primary-soft inset-ring inset-ring-primary";

// Presentational (FR-19). With onToggle it gets the selection checkbox (FR-20); no menu
// or rename until Story 5.4. Answers stay in the order given, which is alphabetical (FR-13).
export function GroupCard({
  id,
  rank,
  label,
  count,
  chips,
  look,
  selected = false,
  busy = false,
  onToggle,
}: {
  id: string;
  rank?: number;
  label: string;
  count: number;
  chips: Chip[];
  look: keyof typeof LOOKS;
  selected?: boolean;
  busy?: boolean;
  onToggle?: () => void;
}) {
  const compact = look !== "discarded" && chips.length === 1;
  const header = (
    <>
      {onToggle && (
        // 44 px target; the negative margins keep the row at its own height.
        <label className="-my-2.5 -ml-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center self-center">
          <input
            type="checkbox"
            id={`velg-${id}`}
            aria-label={`Velg «${label}»`}
            checked={selected}
            onChange={onToggle}
            className="size-5 cursor-pointer accent-primary"
          />
        </label>
      )}
      {rank !== undefined && (
        <span className="w-7 shrink-0 text-title tabular-nums">{rank}.</span>
      )}
      <h4
        id={`gruppe-${id}`}
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
  const box = `rounded-md ${selected ? SELECTED : LOOKS[look]} ${busy ? "opacity-60" : ""}`;

  if (compact)
    return (
      <li
        aria-busy={busy || undefined}
        className={`flex min-h-13 items-center gap-3 px-4 py-2 ${box}`}
      >
        {header}
      </li>
    );

  // Chips line up under the label: rank (28 px + 12 px gap), plus the checkbox (32 px + 12 px).
  const indent = rank === undefined ? "" : onToggle ? "pl-21" : "pl-10";
  return (
    <li aria-busy={busy || undefined} className={`px-4 py-3 ${box}`}>
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
        <ul className={`mt-2 flex flex-wrap gap-2 ${indent}`}>
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
