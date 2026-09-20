"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "xs" | "sm" | "default" | "lg" | "icon" | "icon-sm";

export const buttonVariants = ({
  variant = "primary",
  size = "default",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) =>
  cn(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary/25 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
      primary: "bg-ink-primary text-ink-inverted shadow-sm hover:bg-ink-primary/90",
      secondary: "border border-border bg-white text-ink-primary shadow-sm hover:bg-surface-2 hover:border-border-strong",
      outline: "border border-border bg-transparent text-ink-primary hover:bg-surface-2",
      ghost: "text-ink-secondary hover:bg-surface-2 hover:text-ink-primary",
      destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
      link: "h-auto px-0 text-ink-primary underline-offset-4 hover:underline",
    }[variant],
    {
      xs: "h-7 px-2.5 text-xs",
      sm: "h-8 px-3 text-xs",
      default: "h-9 px-4 text-sm",
      lg: "h-10 px-6 text-sm",
      icon: "h-9 w-9 p-0",
      "icon-sm": "h-8 w-8 p-0",
    }[size],
    className
  );

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant, size, className, loading, asChild, leftIcon, rightIcon, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </Comp>
    );
  }
);
Button.displayName = "Button";
