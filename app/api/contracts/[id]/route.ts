import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageContracts, canViewFollowUp } from "@/lib/permissions";
import { parseDateInput } from "@/lib/form-helpers";

const updateContractSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["DRAFT", "SENT", "SIGNED", "EXPIRED", "TERMINATED"]).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  value: z.number().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
  billingReady: z.boolean().optional(),
  fileUrl: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
});

type Params = { params: { id: string } };

// Follow-up roles (ASSISTANT, FINANCE) may only add notes or mark a contract signed.
const FOLLOW_UP_FIELDS = new Set(["notes", "status"]);

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fullAccess = canManageContracts(user);
  if (!fullAccess && !canViewFollowUp(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  if (!fullAccess) {
    const disallowed = Object.keys(d).filter((k) => !FOLLOW_UP_FIELDS.has(k));
    if (disallowed.length > 0 || (d.status !== undefined && d.status !== "SIGNED")) {
      return NextResponse.json(
        { error: "You can only add notes or mark this contract as signed." },
        { status: 403 }
      );
    }
  }

  const existing = await db.contract.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Prisma.ContractUncheckedUpdateInput = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.status !== undefined) {
    data.status = d.status;
    if (d.status === "SENT" && !existing.sentAt) data.sentAt = new Date();
    if (d.status === "SIGNED") data.signedAt = existing.signedAt ?? new Date();
    if (d.status !== "SIGNED" && existing.status === "SIGNED") data.signedAt = null;
  }
  if (d.startDate !== undefined) data.startDate = parseDateInput(d.startDate);
  if (d.endDate !== undefined) data.endDate = parseDateInput(d.endDate);
  if (d.value !== undefined) data.value = d.value;
  if (d.notes !== undefined) data.notes = d.notes;
  if (d.billingReady !== undefined) data.billingReady = d.billingReady;
  if (d.fileUrl !== undefined) data.fileUrl = d.fileUrl;
  if (d.fileName !== undefined) data.fileName = d.fileName;

  let contract;
  try {
    contract = await db.contract.update({ where: { id: params.id }, data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PUT /api/contracts/[id]", err);
    return NextResponse.json({ error: "Failed to update contract" }, { status: 500 });
  }

  await db.activityLog.create({
    data: {
      clientId: contract.clientId,
      userId: user.id,
      action: "contract_updated",
      description: `Updated contract "${contract.title}"${d.status ? ` — status: ${d.status}` : ""}`,
    },
  });

  if (!canManageContracts(user)) {
    // Follow-up-only roles never receive contract value.
    const { value: _value, ...safe } = contract;
    return NextResponse.json({ data: safe });
  }
  return NextResponse.json({ data: contract });
}
