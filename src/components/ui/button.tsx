import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Size variant controlling dimensions and padding */
  size?: ButtonSize;
  /** Displays loading spinner and disables user interaction */
  isLoading?: boolean;
  /** Custom text to display during loading state */
  loadingText?: string;
  /** Icon element rendered before button content */
  leftIcon?: React.ReactNode;
  /** Icon element rendered after button content */
  rightIcon?: React.ReactNode;
  /** Stretches the button to full width of parent container */
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-600",
  secondary:
    "bg-slate-100 text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400",
  outline:
    "border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 focus-visible:ring-brand-600",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 focus-visible:ring-brand-600",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-600",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 focus-visible:ring-emerald-600",
  link:
    "bg-transparent text-brand-600 underline-offset-4 hover:underline p-0 h-auto min-h-0 min-w-0 shadow-none focus-visible:ring-brand-600",
};

const sizeStyles: Record<ButtonSize, string> = {
  // Mobile: enforces 44x44px minimum touch target. Desktop: compact 36px height.
  sm: "h-9 px-3 text-xs sm:text-sm font-medium min-h-touch min-w-touch sm:min-h-[36px] sm:min-w-0",
  // Standard 44px height meets WCAG 2.2 AA target size across all viewports.
  md: "h-11 px-4 py-2 text-sm sm:text-base font-medium min-h-touch min-w-touch",
  // Prominent button: 48px height for primary purchase CTAs.
  lg: "h-12 px-6 py-3 text-base sm:text-lg font-semibold min-h-[48px] min-w-[48px]",
  // Square icon button: guarantees 44x44px touch target on mobile viewports.
  icon: "h-11 w-11 min-h-touch min-w-touch p-2.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled = false,
      type = "button",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled ? true : undefined}
        aria-busy={isLoading ? true : undefined}
        className={cn(
          // Base layout and typography
          "inline-flex items-center justify-center gap-2 rounded-lg font-sans transition-colors duration-150 select-none",
          // WCAG 2.2 AA Visible Focus Ring: 2px ring with 2px offset for high-contrast visibility
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          // Active state tactile compression
          "active:scale-[0.98]",
          // Disabled state
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100",
          // Variant & size styles
          variantStyles[variant],
          sizeStyles[size],
          // Full width layout
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            {loadingText ? (
              <span>{loadingText}</span>
            ) : (
              <>
                <span className="sr-only">Loading...</span>
                <span>{children}</span>
              </>
            )}
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            {children}
            {rightIcon && (
              <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
