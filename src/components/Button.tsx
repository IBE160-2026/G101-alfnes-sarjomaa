"use client";

import {
  useEffect,
  useState,
  type ComponentProps,
  type MouseEvent,
} from "react";

const VARIANTS = {
  primary:
    "bg-primary text-on-primary text-title hover:not-aria-disabled:bg-primary-hover",
  secondary:
    "border border-line-strong bg-surface text-primary hover:not-aria-disabled:bg-surface-sunken",
  "secondary-danger":
    "border border-danger bg-surface text-danger hover:not-aria-disabled:bg-danger-soft",
  // Only inside a ConfirmDialog. White on danger/90 stays above 4.5:1.
  danger:
    "bg-danger text-on-primary text-title hover:not-aria-disabled:bg-danger/90",
  ghost: "text-ink hover:not-aria-disabled:bg-surface-sunken",
};

// ComponentProps, not ButtonHTMLAttributes, so `ref` passes through (React 19).
type Props = ComponentProps<"button"> & {
  variant: keyof typeof VARIANTS;
  pending?: boolean;
  pendingLabel?: string;
};

const PENDING_DELAY_MS = 300;

export function Button({
  variant,
  pending = false,
  pendingLabel,
  className = "",
  children,
  onClick,
  ...rest
}: Props) {
  const [delayed, setDelayed] = useState(false);
  const showPending = pending && delayed;

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setDelayed(true), PENDING_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setDelayed(false);
    };
  }, [pending]);

  // Not `disabled`, so focus stays on the button; Enter in a field clicks it too.
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (pending) return event.preventDefault();
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      aria-busy={pending || undefined}
      onClick={handleClick}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {/* Both labels share one grid cell, so the button keeps the wider one's width. */}
      <span className="grid">
        <span
          className={`col-start-1 row-start-1 ${showPending ? "invisible" : ""}`}
        >
          {children}
        </span>
        {pendingLabel && (
          <span
            className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${showPending ? "" : "invisible"}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
            >
              <circle
                cx="8"
                cy="8"
                r="6.5"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeWidth="2"
              />
              <path
                d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {pendingLabel}
          </span>
        )}
      </span>
    </button>
  );
}
