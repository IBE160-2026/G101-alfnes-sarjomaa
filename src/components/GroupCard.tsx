import type { ReactNode } from "react";
import { people } from "@/lib/format";

type Chip = { text: string; n: number; ids: string[] };

const LOOKS = {
  board: "border border-line bg-surface",
  below: "border border-dashed border-line-strong bg-surface-sunken",
  discarded: "border border-line bg-surface-sunken",
};

// group-card-selected: the inset ring makes the 2 px primary edge without moving the layout.
const SELECTED =
  "border border-solid border-primary bg-primary-soft inset-ring inset-ring-primary";

// answer-chip-selected: an inset ring, so the 2 px edge never moves the layout.
const CHIP_SELECTED = "bg-primary-soft inset-ring-2 inset-ring-primary";

// Presentational (FR-19). With onToggle it gets the selection checkbox, with onToggleChip
// a checkbox per chip (FR-20, UX-DR11); `rename` replaces the heading, `notice` sits at
// the card's top, `actions` (the Group menu or "Angre forkasting") right of the Count, and
// onLabelClick makes the label start a rename (UX-DR10). Answers stay in the order given,
// which is alphabetical (FR-13).
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
  chipSelected,
  onToggleChip,
  rename,
  notice,
  actions,
  onLabelClick,
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
  chipSelected?: (chip: Chip) => boolean;
  onToggleChip?: (chip: Chip) => void;
  rename?: ReactNode;
  notice?: ReactNode;
  actions?: ReactNode;
  onLabelClick?: () => void;
}) {
  const compact = look !== "discarded" && chips.length === 1;
  // A raw form and its Answer count, without the label again when it is the only raw form.
  const raw = (chip: Chip) =>
    [
      !(chips.length === 1 && chip.text === label) && chip.text,
      chip.n > 1 && `${chip.n} svar`,
    ]
      .filter(Boolean)
      .join(" · ");
  const header = (
    <>
      {onToggle && (
        // 44 px target; the negative margins keep the row at its own height.
        <label className="-my-2.5 -ml-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center self-center">
          <input
            type="checkbox"
            id={`velg-${id}`}
            aria-label={`Velg gruppen «${label}», ${people(count)}`}
            checked={selected}
            onChange={onToggle}
            className="size-5 cursor-pointer accent-primary"
          />
        </label>
      )}
      {rank !== undefined && (
        <span className="w-7 shrink-0 text-title tabular-nums">{rank}.</span>
      )}
      {rename ?? (
        // The Group menu is the keyboard path to rename; the click is a pointer shortcut.
        <h4
          id={`gruppe-${id}`}
          onClick={onLabelClick}
          className={`min-w-0 text-title break-words max-sm:basis-40 max-sm:grow ${look === "discarded" ? "line-through" : ""} ${onLabelClick ? "cursor-pointer hover:underline" : ""}`}
        >
          {label}
        </h4>
      )}
      {/* The raw form when the label differs (a custom or merged label), so the Host sees what was written (FR-19). */}
      {compact && raw(chips[0]) && (
        <span className="min-w-0 text-body-sm break-words text-ink-muted">
          {raw(chips[0])}
        </span>
      )}
      <span className="ml-auto shrink-0 pl-4 whitespace-nowrap">
        {people(count)}
      </span>
      {/* 44 px target; the negative margins keep the row at its own height. */}
      {actions && <div className="-my-2.5 shrink-0 self-center">{actions}</div>}
    </>
  );
  const box = `rounded-md ${selected ? SELECTED : LOOKS[look]} ${busy ? "opacity-60" : ""}`;

  if (compact)
    return (
      <li
        aria-busy={busy || undefined}
        className={`flex min-h-13 flex-col justify-center px-4 py-2 ${box}`}
      >
        {notice}
        <div className="flex items-center gap-3 max-sm:flex-wrap">{header}</div>
      </li>
    );

  // Chips line up under the label: rank (28 px + 12 px gap), plus the checkbox (32 px + 12 px).
  const indent = rank === undefined ? "" : onToggle ? "pl-21" : "pl-10";
  return (
    <li aria-busy={busy || undefined} className={`px-4 py-3 ${box}`}>
      {notice}
      {/* Below sm the count and menu drop to a second line, so the label keeps at least 10rem. */}
      <div className="flex items-baseline gap-3 max-sm:flex-wrap">{header}</div>
      {look === "discarded" ? (
        chips.some(raw) && (
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
            {chips.filter(raw).map((chip) => (
              <li key={chip.text} className="break-words">
                {raw(chip)}
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className={`mt-2 flex flex-wrap gap-2 ${indent}`}>
          {chips.map((chip) => {
            const text = (
              <span className="min-w-0">
                {chip.text}
                {chip.n > 1 && (
                  <span className="text-ink-muted"> · {chip.n} svar</span>
                )}
              </span>
            );
            const fill = look === "below" ? "bg-surface" : "bg-surface-sunken";
            const chipBox =
              "inline-flex min-h-11 max-w-full items-center rounded-sm px-3 py-2 break-words";
            if (!onToggleChip)
              return (
                <li key={chip.text} className={`${chipBox} ${fill}`}>
                  {text}
                </li>
              );
            const on = chipSelected?.(chip) ?? false;
            // The whole chip is the checkbox's label: its name is the text plus "· N svar".
            return (
              <li key={chip.text} className="max-w-full">
                <label
                  className={`${chipBox} cursor-pointer gap-2 ${on ? CHIP_SELECTED : fill}`}
                >
                  <input
                    type="checkbox"
                    id={`velg-svar-${chip.ids[0]}`}
                    checked={on}
                    onChange={() => onToggleChip(chip)}
                    className="size-5 shrink-0 cursor-pointer accent-primary"
                  />
                  {text}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
