import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export const CONTROL_CLASSES =
  "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-faint " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:bg-surface-sunken";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(CONTROL_CLASSES, invalid && "border-danger focus-visible:ring-danger", className)}
      {...props}
    />
  );
});
