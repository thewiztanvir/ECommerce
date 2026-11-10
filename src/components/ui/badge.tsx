import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "info";

export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual theme variant indicating state */
  variant?: BadgeVariant;
  /** Size scale */
  size?: BadgeSize;
  /** Shows a colored status dot before the content */
  dot?: boolean;
  /** Optional icon displayed before the content */
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral:
    "bg-slate-100 text-slate-700 border-slate-200",
  brand:
    "bg-brand-50 text-brand-700 border-brand-200",
  success:
    "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning:
    "bg-amber-50 text-amber-800 border-amber-200",
  error:
    "bg-rose-50 text-rose-800 border-rose-200",
  info:
    "bg-blue-50 text-blue-800 border-blue-200",
};

const dotColors: Record<BadgeVariant, string> = {
  neutral: "bg-slate-500",
  brand: "bg-brand-600",
  success: "bg-emerald-600",
  warning: "bg-amber-600",
  error: "bg-rose-600",
  info: "bg-blue-600",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = "neutral",
      size = "md",
      dot = false,
      icon,
      role = "status",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        role={role}
        className={cn(
          // Layout & typography
          "inline-flex items-center justify-center font-medium rounded-full border tracking-wide select-none",
          // Variant & size tokens
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColors[variant])}
            aria-hidden="true"
          />
        )}
        {icon && (
          <span className="inline-flex shrink-0 items-center" aria-hidden="true">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = "Badge";
