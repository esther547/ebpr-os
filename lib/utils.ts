import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { DeliverableStatus, DeliverableType, InvoiceStatus, PaymentMethod } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function monthLabel(month: number, year: number): string {
  return format(new Date(year, month - 1, 1), "MMMM yyyy");
}

// ─── Deliverable helpers ─────────────────────────────────

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  IDEA: "Idea",
  OUTREACH: "Outreach",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const DELIVERABLE_STATUS_COLORS: Record<
  DeliverableStatus,
  { bg: string; text: string; dot: string }
> = {
  IDEA: { bg: "bg-surface-2", text: "text-ink-secondary", dot: "bg-ink-muted" },
  OUTREACH: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  CONFIRMED: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  IN_PROGRESS: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500" },
  COMPLETED: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  CANCELLED: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
};

export const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  PRESS_PLACEMENT: "Press Placement",
  INTERVIEW: "Interview",
  INFLUENCER_COLLAB: "Influencer Collab",
  EVENT_APPEARANCE: "Event Appearance",
  BRAND_OPPORTUNITY: "Brand Opportunity",
  INTRODUCTION: "Introduction",
  SOCIAL_MEDIA: "Social Media",
  PRESS_RELEASE: "Press Release",
  OTHER: "Other",
};

// ─── Pacing ──────────────────────────────────────────────

export function getPacingStatus(completed: number, target: number) {
  const pct = target > 0 ? (completed / target) * 100 : 0;
  if (pct >= 100) return { label: "On Target", color: "text-green-700" };
  if (pct >= 60) return { label: "On Track", color: "text-amber-700" };
  return { label: "Behind", color: "text-red-600" };
}

// ─── Currency ───────────────────────────────────────────

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(amount));
}

// ─── Invoice helpers ────────────────────────────────────

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-surface-2 text-ink-secondary",
  SENT: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-green-700",
  OVERDUE: "bg-red-50 text-red-600",
  CANCELLED: "bg-surface-2 text-ink-muted",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CHECK: "Check",
  WIRE: "Wire Transfer",
  ACH: "ACH",
  CREDIT_CARD: "Credit Card",
  OTHER: "Other",
};

// ─── File helpers ────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(mimeType: string | null | undefined): string {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "file-text";
  if (mimeType.includes("word")) return "file-text";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "table";
  if (mimeType.includes("video")) return "video";
  return "file";
}
