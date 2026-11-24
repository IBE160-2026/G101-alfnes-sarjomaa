"use client";

// Opens the TV page in its own window, so it can be dragged to the TV; one window per
// browser, reused (not reloaded) on the next click. Without script it is an ordinary new-tab link.
export function OpenTvLink({
  gameId,
  className,
}: {
  gameId: string;
  className: string;
}) {
  const href = `/spill/${gameId}/tv`;
  return (
    <a
      href={href}
      target="toppsvar-tv"
      className={className}
      onClick={(event) => {
        // No URL first, so an open TV window keeps its page and fullscreen.
        const tv = window.open("", "toppsvar-tv", "popup");
        if (!tv) return;
        event.preventDefault();
        let there = false;
        try {
          there = tv.location.pathname === href;
        } catch {
          // The window is on another origin: send it to the TV page.
        }
        if (!there) tv.location.href = href;
        tv.focus();
      }}
    >
      Åpne TV-visning<span className="sr-only"> i et nytt vindu</span>
    </a>
  );
}
