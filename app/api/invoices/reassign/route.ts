import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageFinance } from "@/lib/permissions";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  invoiceId: z.string(),
  newClientId: z.string(),
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

  const invoice = await db.invoice.update({
    where: { id: parsed.data.invoiceId },
    data: { clientId: parsed.data.newClientId },
  });

  await db.activityLog.create({
    data: {
      userId: user.id,
      clientId: parsed.data.newClientId,
      action: "invoice_reassigned",
      description: `Reassigned invoice ${invoice.invoiceNumber} to new client`,
    },
  });

  return NextResponse.json({ data: invoice });
}
