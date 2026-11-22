const block = "rounded-md bg-surface-sunken";

// Skeleton rail + three skeleton cards (UX State Patterns). No <h1>: RouteFocus waits for
// the real page's heading.
export default function Loading() {
  return (
    <div data-wide="" aria-hidden="true" className="animate-appear">
      <div className={`h-6 w-64 max-w-full ${block}`} />
      <div className="mt-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[288px_minmax(0,1fr)]">
        <div className={`hidden h-96 lg:block ${block}`} />
        <div className="flex flex-col gap-2">
          <div className={`mb-6 h-14 w-2/3 ${block}`} />
          <div className={`h-24 ${block}`} />
          <div className={`h-24 ${block}`} />
          <div className={`h-24 ${block}`} />
        </div>
      </div>
    </div>
  );
}
