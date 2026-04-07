import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageContracts } from "@/lib/permissions";

const updateContractSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "EXPIRED", "TERMINATED"]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  value: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  billingReady: z.boolean().optional(),
  fileUrl: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (!canManageContracts(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = updateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.title !== undefined) data.title = d.title;
    if (d.status !== undefined) {
      data.status = d.status;
      if (d.status === "SENT") data.sentAt = new Date();
      if (d.status === "SIGNED") data.signedAt = new Date();
    }
    if (d.startDate !== undefined) data.startDate = d.startDate ? new Date(d.startDate) : null;
    if (d.endDate !== undefined) data.endDate = d.endDate ? new Date(d.endDate) : null;
    if (d.value !== undefined) data.value = d.value;
    if (d.notes !== undefined) data.notes = d.notes;
    if (d.billingReady !== undefined) data.billingReady = d.billingReady;
    if (d.fileUrl !== undefined) data.fileUrl = d.fileUrl;
    if (d.fileName !== undefined) data.fileName = d.fileName;

    const contract = await db.contract.update({ where: { id }, data });

    await db.activityLog.create({
      data: {
        clientId: contract.clientId,
        userId: user.id,
        action: "contract_updated",
        description: `Updated contract "${contract.title}"${d.status ? ` — status: ${d.status}` : ""}`,
      },
    });

    return NextResponse.json({ data: contract });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
