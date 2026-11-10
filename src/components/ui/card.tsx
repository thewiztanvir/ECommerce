import * as React from "react";
import { cn } from "@/lib/utils";

export type CardVariant =
  | "default"
  | "outline"
  | "elevated"
  | "subtle"
  | "interactive";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual presentation variant */
  variant?: CardVariant;
}

const cardVariantStyles: Record<CardVariant, string> = {
  default:
    "bg-white border border-slate-200 shadow-sm",
  outline:
    "bg-white border-2 border-slate-200 shadow-none",
  elevated:
    "bg-white border border-slate-100 shadow-md",
  subtle:
    "bg-slate-50 border border-slate-200 shadow-none",
  interactive:
    "bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", tabIndex, ...props }, ref) => {
    const isInteractive = variant === "interactive";

    return (
      <div
        ref={ref}
        tabIndex={isInteractive && tabIndex === undefined ? 0 : tabIndex}
        className={cn(
          // Responsive layout container
          "rounded-xl overflow-hidden text-slate-900",
          cardVariantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

export interface CardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-4 sm:p-6 pb-2 sm:pb-3", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading semantic HTML element */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "div";
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, as: Component = "h3", ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(
        "font-semibold leading-tight tracking-tight text-slate-900 text-lg sm:text-xl",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  CardDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm text-slate-500", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-4 sm:p-6 pt-0 sm:pt-0", className)}
      {...props}
    />
  )
);
CardContent.displayName = "CardContent";

export interface CardFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center p-4 sm:p-6 pt-0 sm:pt-0 border-t border-slate-100 mt-4",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";
