const block = "rounded-md bg-surface-sunken";

// No <h1> here: RouteFocus waits for the real page's heading.
export default function Loading() {
  return (
    <div aria-hidden="true" className="animate-appear">
      <div className={`h-6 w-48 ${block}`} />
      <div className={`mt-4 h-10 w-80 max-w-full ${block}`} />
      <div className={`mt-10 h-40 ${block}`} />
    </div>
  );
}
