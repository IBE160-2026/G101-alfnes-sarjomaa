import { FEWER_THAN_3 } from "@/lib/limits";

// Static on purpose: no bar, live region or motion. The floor hides arrivals below three;
// from three the count is exact on any reload, which FR-8 accepts (UX-DR6).
export function ProgressCount({
  active,
  submissions,
}: {
  active: number;
  submissions: number | typeof FEWER_THAN_3;
}) {
  const figure = submissions === FEWER_THAN_3 ? "færre enn 3" : submissions;
  return (
    <>
      <p className="mt-4 text-body">
        <span className="font-display text-display tabular-nums">{figure}</span>
        {` av ${active} svar mottatt`}
      </p>
      <p className="mt-2 text-body-sm text-ink-muted">
        Du ser bare antallet, aldri hvem som har svart.
      </p>
    </>
  );
}
