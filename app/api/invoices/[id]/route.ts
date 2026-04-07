import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canViewFinance, canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  issuedAt: z.string().optional(),
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
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.amount) data.amount = parsed.data.amount;
  if (parsed.data.dueDate) data.dueDate = new Date(parsed.data.dueDate);
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.issuedAt) data.issuedAt = new Date(parsed.data.issuedAt);

  // Auto-set dates on status changes
  if (parsed.data.status === "SENT" && !parsed.data.issuedAt) {
    data.issuedAt = new Date();
  }
  if (parsed.data.status === "PAID") {
    data.paidAt = new Date();
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
