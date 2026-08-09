import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../utils/cn";
import { CONTROL_CLASSES } from "./Input";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(CONTROL_CLASSES, "pr-8", invalid && "border-danger focus-visible:ring-danger", className)}
      {...props}
    />
  );
});
