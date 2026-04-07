import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canViewFinance, canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  clientId: z.string().min(1),
  contractId: z.string().optional(),
  invoiceNumber: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!canViewFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      contract: { select: { id: true, title: true } },
      payments: true,
    },
  });

  return NextResponse.json({ data: invoices });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!canManageFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { clientId, contractId, invoiceNumber, amount, dueDate, notes } = parsed.data;

  const invoice = await db.invoice.create({
    data: {
      clientId,
      contractId: contractId || undefined,
      invoiceNumber,
      amount,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes,
    },
  });

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId,
      action: "invoice_created",
      description: `Created invoice ${invoiceNumber} for $${amount}`,
    },
  });

  return NextResponse.json({ data: invoice }, { status: 201 });
}
