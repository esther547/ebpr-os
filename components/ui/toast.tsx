"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error";
type ToastInput = { title: string; description?: string; variant?: ToastVariant; duration?: number };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((t: ToastInput) => {
    setItems((prev) => [...prev.slice(-4), { ...t, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.duration}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((i) => i.id !== t.id));
            }}
            className={cn(
              "group pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-white p-4 shadow-pop",
              "data-[state=open]:animate-slide-in-right data-[swipe=end]:animate-fade-in",
              t.variant === "success" && "border-emerald-200",
              t.variant === "error" && "border-red-200",
              (!t.variant || t.variant === "default") && "border-border"
            )}
          >
            <span className="mt-0.5 shrink-0">
              {t.variant === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {t.variant === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
              {(!t.variant || t.variant === "default") && <Info className="h-4 w-4 text-ink-muted" />}
            </span>
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-ink-primary">{t.title}</ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-ink-secondary">{t.description}</ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink-primary group-hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

/**
 * const { toast } = useToast();
 * toast({ title: "Saved", variant: "success" });
 * toast({ title: "Could not save", description: err.message, variant: "error" });
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback so components work even if rendered outside the provider.
    return { toast: (t: ToastInput) => { if (typeof window !== "undefined") console.warn("[toast]", t.title); } };
  }
  return ctx;
}
