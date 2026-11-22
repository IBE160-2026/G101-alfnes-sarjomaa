import type { ReactNode, Ref } from "react";

const TONES = {
  info: { role: "status", className: "bg-primary-soft text-ink" },
  danger: { role: "alert", className: "bg-danger-soft text-danger" },
} as const;

// `danger` is only for errors from a user action. Never auto-dismisses.
export function Notice({
  tone,
  children,
  className = "",
  ref,
  tabIndex,
}: {
  tone: keyof typeof TONES;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  tabIndex?: number;
}) {
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      role={TONES[tone].role}
      className={`w-full rounded-md p-4 ${TONES[tone].className} ${className}`}
    >
      {children}
    </div>
  );
}
