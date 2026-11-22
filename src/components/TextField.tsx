import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string;
  label: string;
  helper?: string;
  error?: string;
  counter?: ReactNode;
};

export function TextField({
  label,
  helper,
  error,
  counter,
  className = "",
  "aria-describedby": describedByExtra,
  "aria-invalid": invalidExtra,
  ...rest
}: Props) {
  const id = useId();
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  // A caller's description (an error shown outside the field) comes first.
  const describedBy = [describedByExtra, helperId, errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-label">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : invalidExtra}
        aria-describedby={describedBy || undefined}
        className={`mt-1 block min-h-12 w-full rounded-sm bg-surface text-body text-ink ${
          error
            ? "border-2 border-danger px-2.75"
            : "border border-line-strong px-3"
        }`}
      />
      {(helper || counter) && (
        <div className="mt-1 flex gap-4 text-body-sm text-ink-muted">
          {helper && <p id={helperId}>{helper}</p>}
          {counter && <div className="ml-auto">{counter}</div>}
        </div>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-body-sm text-danger">
          <span className="sr-only">Feil: </span>
          {error}
        </p>
      )}
    </div>
  );
}
