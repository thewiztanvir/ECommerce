import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Form field label */
  label?: React.ReactNode;
  /** Error message or boolean flag indicating error state */
  error?: React.ReactNode;
  /** Explanatory hint or helper text */
  hint?: React.ReactNode;
  /** Success message or boolean flag */
  success?: React.ReactNode;
  /** Icon rendered inside input at the start */
  leftIcon?: React.ReactNode;
  /** Icon rendered inside input at the end */
  rightIcon?: React.ReactNode;
  /** Size variant */
  inputSize?: "sm" | "md" | "lg";
  /** Optional class name for the outer field wrapper */
  wrapperClassName?: string;
  /** Optional class name for the label */
  labelClassName?: string;
  /** Optional class name for the error message */
  errorClassName?: string;
  /** Optional class name for the hint message */
  hintClassName?: string;
  /** Shows required indicator (*) next to the label */
  showRequiredIndicator?: boolean;
}

const inputSizeStyles = {
  // sm: mobile 44px touch target, desktop 36px
  sm: "h-9 min-h-touch sm:min-h-[36px] py-1.5 px-3 text-sm",
  // md: 44px min touch target on all screens
  md: "h-11 min-h-touch py-2.5 px-3.5 text-base sm:text-sm",
  // lg: 48px height
  lg: "h-12 min-h-[48px] py-3 px-4 text-base",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      wrapperClassName,
      labelClassName,
      errorClassName,
      hintClassName,
      label,
      error,
      hint,
      success,
      leftIcon,
      rightIcon,
      inputSize = "md",
      id: explicitId,
      required,
      showRequiredIndicator,
      disabled,
      readOnly,
      type = "text",
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = explicitId || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const successId = `${inputId}-success`;

    const hasError = Boolean(error);
    const hasSuccess = Boolean(success) && !hasError;
    const hasHint = Boolean(hint);

    // Build describedby IDs for screen readers
    const describedByIds = [
      ariaDescribedBy,
      hasError ? errorId : undefined,
      hasSuccess ? successId : undefined,
      hasHint ? hintId : undefined,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={cn("w-full space-y-1.5", wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-sm font-medium text-slate-700 select-none",
              disabled && "text-slate-400 cursor-not-allowed",
              labelClassName
            )}
          >
            {label}
            {(required || showRequiredIndicator) && (
              <span
                className="ml-1 text-rose-500 font-bold"
                aria-hidden="true"
              >
                *
              </span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-required={required ? true : undefined}
            aria-invalid={hasError ? true : undefined}
            aria-describedby={describedByIds || undefined}
            className={cn(
              // Layout & typography
              "w-full rounded-lg border bg-white text-slate-900 transition-colors duration-150",
              "placeholder:text-slate-400",
              // Mobile touch target & iOS font size prevention (16px base prevents zoom on iOS)
              inputSizeStyles[inputSize],
              // WCAG 2.2 AA Focus indicator (visible 2px ring with brand color)
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              // Default state
              !hasError &&
                !hasSuccess &&
                "border-slate-300 hover:border-slate-400 focus-visible:border-brand-600 focus-visible:ring-brand-600",
              // Error state
              hasError &&
                "border-rose-500 text-rose-950 placeholder:text-rose-300 focus-visible:border-rose-600 focus-visible:ring-rose-600",
              // Success state
              hasSuccess &&
                "border-emerald-500 text-emerald-950 placeholder:text-emerald-300 focus-visible:border-emerald-600 focus-visible:ring-emerald-600",
              // Disabled & Read-only states
              "disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed",
              "read-only:bg-slate-50 read-only:cursor-default read-only:hover:border-slate-300",
              // Dynamic padding when icons are present
              leftIcon && "pl-10",
              (rightIcon || hasError || hasSuccess) && "pr-10",
              className
            )}
            {...props}
          />

          {/* End adornment / status icon */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            {hasError ? (
              <AlertCircle
                className="h-5 w-5 text-rose-500"
                aria-hidden="true"
              />
            ) : hasSuccess ? (
              <CheckCircle2
                className="h-5 w-5 text-emerald-500"
                aria-hidden="true"
              />
            ) : (
              rightIcon && (
                <span className="text-slate-400" aria-hidden="true">
                  {rightIcon}
                </span>
              )
            )}
          </div>
        </div>

        {/* Validation error message */}
        {hasError && typeof error === "string" && (
          <p
            id={errorId}
            role="alert"
            className={cn("text-xs font-medium text-rose-600", errorClassName)}
          >
            {error}
          </p>
        )}
        {hasError && typeof error !== "string" && typeof error !== "boolean" && (
          <div id={errorId} role="alert" className={errorClassName}>
            {error}
          </div>
        )}

        {/* Success message */}
        {hasSuccess && typeof success === "string" && (
          <p
            id={successId}
            className="text-xs font-medium text-emerald-600"
          >
            {success}
          </p>
        )}

        {/* Helpful hint description */}
        {hasHint && (
          <p
            id={hintId}
            className={cn("text-xs text-slate-500", hintClassName)}
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
