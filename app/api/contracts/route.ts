import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageContracts, canViewContracts } from "@/lib/permissions";

const createContractSchema = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1).max(200),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  value: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
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
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageContracts(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { clientId, title, startDate, endDate, value, notes } = parsed.data;

    const contract = await db.contract.create({
      data: {
        clientId,
        title,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        value: value ?? undefined,
        notes,
      },
    });

    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "contract_created",
        description: `Created contract "${title}"`,
      },
    });

    return NextResponse.json({ data: contract }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
