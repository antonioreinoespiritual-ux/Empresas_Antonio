import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../utils/cn";

export interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Campo de checkout/formulario — reemplaza el label+input+error repetido a
 * mano en cada form. forwardRef es obligatorio acá: react-hook-form's
 * register() entrega un `ref` que debe llegar al <input> real para que el
 * form registre el campo correctamente (foco en error, lectura de valor) —
 * sin forwardRef, React ni siquiera pasa el ref a un componente función.
 */
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(function FormField(
  { label, error, id, className, ...props },
  ref
) {
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        className={cn(
          "rounded-base border border-border bg-surface px-3.5 py-2.5 text-[15px] text-foreground",
          "transition-colors duration-fast placeholder:text-foreground-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
          error && "border-destructive",
          className
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${fieldId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});
