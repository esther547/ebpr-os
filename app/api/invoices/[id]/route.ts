import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canViewFinance, canManageFinance, canViewFollowUp } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseDateInput, startOfTodayUTC } from "@/components/finance/invoice-status";

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  issuedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type Params = { params: { id: string } };

// Fields the follow-up roles (ASSISTANT, LEGAL) may touch: notes + "mark paid".
const FOLLOW_UP_FIELDS = new Set(["notes", "status", "paidAt"]);

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!canViewFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = await db.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { id: true, name: true } },
      contract: { select: { id: true, title: true } },
      payments: true,
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: invoice });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireUser();
  const fullAccess = canManageFinance(user);
  if (!fullAccess && !canViewFollowUp(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  // Follow-up roles may only add notes and mark an invoice paid — never amounts/dates.
  if (!fullAccess) {
    const disallowed = Object.keys(d).filter((k) => !FOLLOW_UP_FIELDS.has(k));
    if (disallowed.length > 0 || (d.status !== undefined && d.status !== "PAID")) {
      return NextResponse.json(
        { error: "You can only add notes or mark this invoice as paid." },
        { status: 403 }
      );
    }
  }

  const existing = await db.invoice.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Prisma.InvoiceUncheckedUpdateInput = {};
  if (d.amount !== undefined) data.amount = d.amount;
  if (d.dueDate !== undefined) data.dueDate = parseDateInput(d.dueDate);
  if (d.sentAt !== undefined) data.sentAt = parseDateInput(d.sentAt);
  if (d.paidAt !== undefined) data.paidAt = parseDateInput(d.paidAt);
  if (d.issuedAt !== undefined) data.issuedAt = parseDateInput(d.issuedAt);
  if (d.notes !== undefined) data.notes = d.notes;

  // ── Keep status and dates consistent ──────────────────
  let status = d.status ?? existing.status;
  const paidAtProvided = d.paidAt !== undefined;
  const nextPaidAt = paidAtProvided ? parseDateInput(d.paidAt) : existing.paidAt;

  if (paidAtProvided && nextPaidAt) {
    // A payment date always means PAID.
    status = "PAID";
  } else if (paidAtProvided && !nextPaidAt && d.status === undefined && existing.status === "PAID") {
    // Payment date cleared: fall back to SENT (or DRAFT if it was never sent).
    status = existing.sentAt ? "SENT" : "DRAFT";
  }

  if (d.status !== undefined) {
    if (d.status === "PAID") {
      if (!nextPaidAt) data.paidAt = startOfTodayUTC();
    } else if (!paidAtProvided || !nextPaidAt) {
      // Explicitly moving away from PAID clears the payment date so the UI agrees.
      data.paidAt = null;
      status = d.status;
    }
    if (d.status === "SENT" && !existing.sentAt && d.sentAt === undefined) {
      data.sentAt = startOfTodayUTC();
    }
  } else if (d.sentAt && existing.status === "DRAFT" && status === "DRAFT") {
    // Filling in the sent date on a draft marks it as sent.
    status = "SENT";
  }

  if (status !== existing.status) data.status = status;

  let invoice;
  try {
    invoice = await db.invoice.update({ where: { id: params.id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PUT /api/invoices/[id]", err);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: invoice.clientId,
      action: "invoice_updated",
      description: `Updated invoice ${invoice.invoiceNumber}${data.status ? ` → ${data.status}` : ""}`,
    },
  });

  if (!canViewFinance(user)) {
    // Follow-up-only roles never receive amounts.
    const { amount: _amount, ...safe } = invoice;
    return NextResponse.json({ data: safe });
  }
  return NextResponse.json({ data: invoice });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await requireUser();
  if (!canManageFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let invoice;
  try {
    // Payments cascade on delete (schema), so a single delete is enough.
    invoice = await db.invoice.delete({ where: { id: params.id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/invoices/[id]", err);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: invoice.clientId,
      action: "invoice_deleted",
      description: `Deleted invoice ${invoice.invoiceNumber}`,
    },
  });

  return NextResponse.json({ success: true });
}
