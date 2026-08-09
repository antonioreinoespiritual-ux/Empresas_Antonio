import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn("h-4 w-4 rounded border-border-strong accent-accent disabled:opacity-40", className)}
      {...props}
    />
  );
});
