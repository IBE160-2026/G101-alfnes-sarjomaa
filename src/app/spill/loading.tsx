const block = "rounded-md bg-surface-sunken";

// No <h1> here: RouteFocus waits for the real page's heading.
export default function Loading() {
  return (
    <div aria-hidden="true" className="animate-appear">
      <div className={`h-10 w-56 ${block}`} />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className={`h-12 sm:flex-1 ${block}`} />
        <div className={`h-12 w-32 ${block}`} />
      </div>
      <div className="mt-10 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-14 ${block}`} />
        ))}
      </div>
    </div>
  );
}
