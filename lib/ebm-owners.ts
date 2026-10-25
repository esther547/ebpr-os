import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ITEM_CATEGORIES, ITEM_STATUSES, OWNER_EMAILS, type OwnerItemRow, type TeamLeadSummary } from "@/lib/ebm-owners-shared";
import { OPEN_STATUSES } from "@/lib/ebm-shared";
export * from "@/lib/ebm-owners-shared";

/** Esther and Benjy only, whatever the role. Nobody else on EBM sees this section. */
export const isEbmOwner = (u: SessionUser) => OWNER_EMAILS.includes((u.email ?? "").toLowerCase());

export const itemSelect = {
  id: true, title: true, category: true, status: true, waitingOn: true, nextStep: true, dueAt: true, notes: true, forWeekly: true, resolvedAt: true, createdAt: true, updatedAt: true,
  handler: { select: { id: true, name: true } },
  lead: { select: { id: true, brand: true, status: true, owner: { select: { name: true } } } },
  createdBy: { select: { name: true } },
  updates: { select: { id: true, text: true, status: true, createdAt: true, author: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" as const } },
};

type Raw = { id: string; title: string; category: string; status: string; waitingOn: string | null; nextStep: string | null; dueAt: Date | null; notes: string | null; forWeekly: boolean; resolvedAt: Date | null; createdAt: Date; updatedAt: Date; handler: { id: string; name: string } | null; lead: { id: string; brand: string; status: string; owner: { name: string } } | null; createdBy: { name: string }; updates: { id: string; text: string; status: string | null; createdAt: Date; author: { id: string; name: string } }[] };
export const serializeItem = (r: Raw): OwnerItemRow => ({ ...r, dueAt: r.dueAt?.toISOString() ?? null, resolvedAt: r.resolvedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), updates: r.updates.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })) });

/** The team's brand leads at a glance: per seller, what is open, overdue or has gone quiet. */
export async function teamLeadSummary(now = new Date()): Promise<TeamLeadSummary[]> {
  const leads = await db.brandLead.findMany({ select: { ownerId: true, owner: { select: { name: true } }, status: true, nextFollowUpAt: true, updatedAt: true, updates: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } });
  const by = new Map<string, TeamLeadSummary>();
  for (const l of leads) {
    const s = by.get(l.ownerId) ?? { ownerId: l.ownerId, ownerName: l.owner.name, open: 0, overdue: 0, stale: 0, won: 0, lastUpdate: null };
    const last = l.updates[0]?.createdAt ?? l.updatedAt;
    if (!s.lastUpdate || last.toISOString() > s.lastUpdate) s.lastUpdate = last.toISOString();
    if (l.status === "WON") s.won++;
    if ((OPEN_STATUSES as string[]).includes(l.status)) {
      s.open++;
      if (l.nextFollowUpAt && l.nextFollowUpAt < now) s.overdue++;
      if (now.getTime() - last.getTime() > 14 * 86_400_000) s.stale++;
    }
    by.set(l.ownerId, s);
  }
  return [...by.values()].sort((a, b) => b.open - a.open || a.ownerName.localeCompare(b.ownerName));
}

export const itemSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(300),
  category: z.enum(ITEM_CATEGORIES).optional(),
  status: z.enum(ITEM_STATUSES).optional(),
  waitingOn: z.string().trim().max(300).nullable().optional(),
  handlerId: z.string().min(1).nullable().optional(),
  leadId: z.string().min(1).nullable().optional(),
  nextStep: z.string().trim().max(1000).nullable().optional(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().trim().max(8000).nullable().optional(),
  forWeekly: z.boolean().optional(),
});

export async function authorizeOwner() {
  try {
    const user = await requireUser();
    if (!isEbmOwner(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

