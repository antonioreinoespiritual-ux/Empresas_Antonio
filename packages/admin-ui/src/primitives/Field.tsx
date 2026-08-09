import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label + control + un único mensaje debajo — nunca error e hint a la vez, para no competir por la misma línea. */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor={htmlFor}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
