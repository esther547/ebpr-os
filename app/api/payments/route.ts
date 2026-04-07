import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CHECK", "WIRE", "ACH", "CREDIT_CARD", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().optional(),
});

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

  const { invoiceId, amount, method, reference, notes, paidAt } = parsed.data;

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const payment = await db.payment.create({
    data: {
      invoiceId,
      amount,
      method,
      reference,
      notes,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
    },
  });

  // Check if invoice is fully paid
  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0) + amount;
  if (totalPaid >= Number(invoice.amount)) {
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: invoice.clientId,
      action: "payment_recorded",
      description: `Recorded $${amount} payment for invoice ${invoice.invoiceNumber}`,
    },
  });

  return NextResponse.json({ data: payment }, { status: 201 });
}
