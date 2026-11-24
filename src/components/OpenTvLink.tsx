"use client";

// Opens the TV page in its own window, so it can be dragged to the TV; one window per
// browser, reused on the next click. Without script it is an ordinary new-tab link.
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
        if (window.open(href, "toppsvar-tv", "popup")) event.preventDefault();
      }}
    >
      Åpne TV-visning<span className="sr-only"> i et nytt vindu</span>
    </a>
  );
}
