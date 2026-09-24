import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageContracts, canViewContracts } from "@/lib/permissions";
import { parseDateInput } from "@/lib/form-helpers";

const createContractSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewContracts(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contracts = await db.contract.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({ data: contracts });
}

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContracts(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { clientId, title, startDate, endDate, notes } = parsed.data;

  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  let contract;
  try {
    contract = await db.contract.create({
      data: {
        clientId,
        title,
        startDate: parseDateInput(startDate),
        endDate: parseDateInput(endDate),
        notes: notes || undefined,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    console.error("POST /api/contracts", err);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }

  await db.activityLog.create({
    data: {
      clientId,
      userId: user.id,
      action: "contract_created",
      description: `Created contract "${title}"`,
    },
  });

  return NextResponse.json({ data: contract }, { status: 201 });
}
