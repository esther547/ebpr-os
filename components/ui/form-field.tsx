"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export { Button, buttonVariants } from "./button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./button";

// ─── Label ──────────────────────────────────────────────

export function Label({
  children,
  htmlFor,
  required,
  className,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  hint?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("flex items-baseline justify-between text-sm font-medium text-ink-primary", className)}
    >
      <span>
        {children}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {hint && <span className="text-xs font-normal text-ink-muted">{hint}</span>}
    </label>
  );
}

const controlBase = cn(
  "w-full rounded-lg border bg-white px-3 text-sm text-ink-primary shadow-inset transition-colors",
  "placeholder:text-ink-muted",
  "hover:border-border-strong",
  "focus:outline-none focus:border-ink-primary focus:ring-2 focus:ring-ink-primary/15",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60"
);

// ─── Input ──────────────────────────────────────────────

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: string }
>(({ className, error, ...props }, ref) => (
  <div>
    <input
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(controlBase, "h-9", error ? "border-red-400 focus:border-red-500 focus:ring-red-500/15" : "border-border", className)}
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
      aria-invalid={error ? true : undefined}
      className={cn(controlBase, "min-h-[88px] resize-y py-2 leading-relaxed", error ? "border-red-400" : "border-border", className)}
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
      aria-invalid={error ? true : undefined}
      className={cn(controlBase, "h-9 cursor-pointer", error ? "border-red-400" : "border-border", className)}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
));
Select.displayName = "Select";

// ─── Form Group ─────────────────────────────────────────

export function FormGroup({
  label,
  htmlFor,
  required,
  children,
  className,
  hint,
  description,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  hint?: string;
  description?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required} hint={hint}>
        {label}
      </Label>
      {children}
      {description && <p className="text-xs text-ink-muted">{description}</p>}
    </div>
  );
}

// ─── Form actions row ───────────────────────────────────

export function FormActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-2 border-t border-border pt-4", className)}>
      {children}
    </div>
  );
}
