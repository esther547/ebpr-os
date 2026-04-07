"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

// ─── Label ──────────────────────────────────────────────

export function Label({
  children,
  htmlFor,
  required,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-sm font-medium text-ink-primary", className)}
    >
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  );
}

// ─── Input ──────────────────────────────────────────────

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(({ className, error, ...props }, ref) => (
  <div>
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-primary",
        "placeholder:text-ink-muted",
        "focus:outline-none focus:ring-2 focus:ring-ink-primary/20 focus:border-ink-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-red-400" : "border-border",
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Input.displayName = "Input";

// ─── Textarea ───────────────────────────────────────────

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }
>(({ className, error, ...props }, ref) => (
  <div>
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-primary",
        "placeholder:text-ink-muted resize-none",
        "focus:outline-none focus:ring-2 focus:ring-ink-primary/20 focus:border-ink-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-red-400" : "border-border",
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Textarea.displayName = "Textarea";

// ─── Select ─────────────────────────────────────────────

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }
>(({ className, error, children, ...props }, ref) => (
  <div>
    <select
      ref={ref}
      className={cn(
        "w-full rounded-md border bg-white px-3 py-2 text-sm text-ink-primary",
        "focus:outline-none focus:ring-2 focus:ring-ink-primary/20 focus:border-ink-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error ? "border-red-400" : "border-border",
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Select.displayName = "Select";

// ─── Button ─────────────────────────────────────────────

export function Button({
  children,
  variant = "primary",
  size = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-ink-primary/20",
        "disabled:pointer-events-none disabled:opacity-50",
        {
          primary: "bg-ink-primary text-ink-inverted hover:bg-ink-primary/90",
          secondary: "border border-border bg-white text-ink-primary hover:bg-surface-2",
          destructive: "bg-red-600 text-white hover:bg-red-700",
          ghost: "text-ink-secondary hover:bg-surface-2 hover:text-ink-primary",
        }[variant],
        {
          default: "h-9 px-4 text-sm",
          sm: "h-8 px-3 text-xs",
          lg: "h-10 px-6 text-sm",
        }[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Form Group ─────────────────────────────────────────

export function FormGroup({
  label,
  htmlFor,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
    </div>
  );
}
