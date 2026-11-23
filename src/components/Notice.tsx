import type { ReactNode, Ref } from "react";

const TONES = {
  info: { role: "status", className: "bg-primary-soft text-ink" },
  success: { role: "status", className: "bg-success-soft text-success" },
  warning: { role: "status", className: "bg-warning-soft text-warning" },
  danger: { role: "alert", className: "bg-danger-soft text-danger" },
} as const;

// `danger` is only for errors from a user action. Never auto-dismisses.
export function Notice({
  tone,
  children,
  className = "",
  ref,
  tabIndex,
  live = true,
}: {
  tone: keyof typeof TONES;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  tabIndex?: number;
  // false for static page content, which is not a status message.
  live?: boolean;
}) {
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      role={live ? TONES[tone].role : undefined}
      className={`w-full rounded-md p-4 ${TONES[tone].className} ${className}`}
    >
      {children}
    </div>
  );
}
