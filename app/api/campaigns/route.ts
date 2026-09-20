import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

const createCampaignSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
  monthlyTarget: z.number().int().min(1).max(30).default(6),
});

export async function GET(req: NextRequest) {
  try {
    await requireUser();

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;

    const campaigns = await db.campaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { deliverables: true, tasks: true } },
      },
    });

    return NextResponse.json({ data: campaigns });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createCampaignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error), details: parsed.error.flatten() }, { status: 400 });
    }

    const { clientId, name, description, startDate, endDate, objectives, ownerId, monthlyTarget } = parsed.data;

    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const campaign = await db.campaign.create({
      data: {
        clientId,
        name,
        description,
        startDate: startDate ? parseDateInput(startDate) : undefined,
        endDate: endDate ? parseDateInput(endDate) : undefined,
        objectives: objectives ?? [],
        ownerId: ownerId || undefined,
        monthlyTarget,
      },
    });

    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "campaign_created",
        description: `Created campaign "${name}"`,
      },
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && (err.message === "Unauthorized" || err.message === "Forbidden")) {
      return NextResponse.json({ error: err.message }, { status: err.message === "Forbidden" ? 403 : 401 });
    }
    console.error("POST /api/campaigns failed:", err);
    return NextResponse.json({ error: "Could not create campaign" }, { status: 500 });
  }
}
