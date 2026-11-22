// Static on purpose: no bar, live region or motion, so an arrival cannot be timed
// against a message the Host sent (FR-8, UX-DR6).
export function ProgressCount({
  active,
  submissions,
}: {
  active: number;
  submissions: number | "fewer-than-3";
}) {
  const figure = typeof submissions === "number" ? submissions : "færre enn 3";
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
