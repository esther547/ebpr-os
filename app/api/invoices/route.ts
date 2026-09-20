import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canViewFinance, canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";
import { parseDateInput } from "@/components/finance/invoice-status";

const createSchema = z.object({
  clientId: z.string().min(1),
  contractId: z.string().nullable().optional(),
  invoiceNumber: z.string().trim().min(1),
  amount: z.number().positive(),
  dueDate: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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

  const { clientId, contractId, invoiceNumber, amount, dueDate, sentAt, notes } = parsed.data;

  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const sentDate = parseDateInput(sentAt);

  let invoice;
  try {
    invoice = await db.invoice.create({
      data: {
        clientId,
        contractId: contractId || undefined,
        invoiceNumber,
        amount,
        dueDate: parseDateInput(dueDate),
        sentAt: sentDate,
        status: sentDate ? "SENT" : "DRAFT",
        notes: notes || undefined,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: `Invoice number "${invoiceNumber}" already exists.` },
          { status: 409 }
        );
      }
      if (err.code === "P2003") {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }
    }
    console.error("POST /api/invoices", err);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }

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
