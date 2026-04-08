import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canViewFinance, canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canViewFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      contract: { select: { id: true, title: true } },
      payments: true,
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: invoice });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canManageFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
  if (parsed.data.dueDate !== undefined) data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.sentAt !== undefined) data.sentAt = parsed.data.sentAt ? new Date(parsed.data.sentAt) : null;
  if (parsed.data.paidAt !== undefined) data.paidAt = parsed.data.paidAt ? new Date(parsed.data.paidAt) : null;
  if (parsed.data.issuedAt !== undefined) data.issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;

  // Auto-set status based on dates
  if (parsed.data.paidAt && parsed.data.paidAt !== null) {
    data.status = "PAID";
  } else if (parsed.data.sentAt && parsed.data.sentAt !== null && !parsed.data.paidAt) {
    data.status = "SENT";
  }

  const invoice = await db.invoice.update({ where: { id }, data });

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: invoice.clientId,
      action: "invoice_updated",
      description: `Updated invoice ${invoice.invoiceNumber}${parsed.data.status ? ` → ${parsed.data.status}` : ""}`,
    },
  });

  return NextResponse.json({ data: invoice });
}
