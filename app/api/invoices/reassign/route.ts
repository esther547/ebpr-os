import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  invoiceId: z.string().min(1),
  newClientId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!canManageFinance(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const [existing, newClient] = await Promise.all([
    db.invoice.findUnique({ where: { id: parsed.data.invoiceId }, select: { id: true, clientId: true, contractId: true } }),
    db.client.findUnique({ where: { id: parsed.data.newClientId }, select: { id: true, name: true } }),
  ]);
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (!newClient) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (existing.clientId === newClient.id) {
    return NextResponse.json({ error: "Invoice already belongs to that client" }, { status: 400 });
  }

  let invoice;
  try {
    invoice = await db.invoice.update({
      where: { id: parsed.data.invoiceId },
      // A contract belongs to one client, so an old contract link would now be wrong.
      data: { clientId: newClient.id, contractId: null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    console.error("POST /api/invoices/reassign", err);
    return NextResponse.json({ error: "Failed to move invoice" }, { status: 500 });
  }

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: newClient.id,
      action: "invoice_reassigned",
      description: `Moved invoice ${invoice.invoiceNumber} to ${newClient.name}`,
    },
  });

  return NextResponse.json({ data: invoice });
}
