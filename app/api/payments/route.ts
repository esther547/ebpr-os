import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseDateInput, startOfTodayUTC } from "@/components/finance/invoice-status";

const createSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CHECK", "WIRE", "ACH", "CREDIT_CARD", "OTHER"]),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
});

const cents = (n: number | string | { toString(): string }) => Math.round(Number(n) * 100);

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
  if (invoice.status === "CANCELLED") {
    return NextResponse.json({ error: "Cannot record a payment on a cancelled invoice" }, { status: 400 });
  }

  // Date the money arrived (date-only). Defaults to today.
  const paidDate = parseDateInput(paidAt) ?? startOfTodayUTC();

  const totalPaidCents = invoice.payments.reduce((sum, p) => sum + cents(p.amount), 0) + cents(amount);
  const fullyPaid = totalPaidCents >= cents(invoice.amount);

  const [payment] = await db.$transaction([
    db.payment.create({
      data: {
        invoiceId,
        amount,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
        paidAt: paidDate,
      },
    }),
    ...(fullyPaid
      ? [db.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: paidDate } })]
      : []),
  ]);

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: invoice.clientId,
      action: "payment_recorded",
      description: `Recorded $${amount} payment for invoice ${invoice.invoiceNumber}${fullyPaid ? " (paid in full)" : ""}`,
    },
  });

  return NextResponse.json({ data: payment, fullyPaid }, { status: 201 });
}
