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

const updateOnboardingSchema = z.object({
  status: z.enum([
    "NOT_STARTED", "KICKOFF_SCHEDULED", "KICKOFF_COMPLETE",
    "QUESTIONNAIRE_SENT", "QUESTIONNAIRE_RECEIVED",
    "STRATEGY_IN_PROGRESS", "COMPLETE",
  ]).optional(),
  kickoffDate: z.string().nullable().optional(),
  kickoffNotes: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
  brandPositioning: z.string().nullable().optional(),
  goals: z.array(z.string()).optional(),
  vision: z.string().nullable().optional(),
  targetAudience: z.string().nullable().optional(),
  questionnaireResponses: z.record(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    await requireUser();
    const { clientId } = await params;

    const onboarding = await db.onboarding.findUnique({
      where: { clientId },
      include: {
        checklistItems: { orderBy: { order: "asc" } },
        client: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: onboarding });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await requireUser();
    if (!canManageClients(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { clientId } = await params;
    const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const body = await req.json();
    const parsed = updateOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: zodMessage(parsed.error), details: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    const d = parsed.data;
    if (d.status !== undefined) data.status = d.status;
    if (d.kickoffDate !== undefined) data.kickoffDate = d.kickoffDate ? parseDateInput(d.kickoffDate) : null;
    if (d.kickoffNotes !== undefined) data.kickoffNotes = d.kickoffNotes;
    if (d.narrative !== undefined) data.narrative = d.narrative;
    if (d.brandPositioning !== undefined) data.brandPositioning = d.brandPositioning;
    if (d.goals !== undefined) data.goals = d.goals;
    if (d.vision !== undefined) data.vision = d.vision;
    if (d.targetAudience !== undefined) data.targetAudience = d.targetAudience;
    if (d.questionnaireResponses !== undefined) data.questionnaireResponses = d.questionnaireResponses;

    // Set timestamps based on status
    if (d.status === "QUESTIONNAIRE_SENT") data.questionnaireSentAt = new Date();
    if (d.status === "QUESTIONNAIRE_RECEIVED") data.questionnaireCompletedAt = new Date();

    const onboarding = await db.onboarding.upsert({
      where: { clientId },
      create: { clientId, ...data },
      update: data,
    });

    await db.activityLog.create({
      data: {
        clientId,
        userId: user.id,
        action: "onboarding_updated",
        description: `Updated onboarding${d.status ? ` — status: ${d.status}` : ""}`,
      },
    });

    return NextResponse.json({ data: onboarding });
  } catch (err) {
    if (err instanceof Error && (err.message === "Unauthorized" || err.message === "Forbidden")) {
      return NextResponse.json({ error: err.message }, { status: err.message === "Forbidden" ? 403 : 401 });
    }
    console.error("PUT /api/onboarding/[clientId] failed:", err);
    return NextResponse.json({ error: "Could not update onboarding" }, { status: 500 });
  }
}
