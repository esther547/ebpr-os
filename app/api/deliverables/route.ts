import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageDeliverables } from "@/lib/permissions";
import { cycleForDate, currentCycle } from "@/lib/cycles";
import { parseDateInput } from "./_lib/status-transition";
import { activityInstant, ensureAgendaItemForDeliverable } from "./_lib/agenda-sync";
import { checkClientDate } from "@/lib/client-availability";

const createDeliverableSchema = z.object({
  clientId: z.string().min(1),
  campaignId: z.string().optional(),
  title: z.string().min(1).max(200),
  type: z.enum([
    "PRESS_PLACEMENT",
    "INTERVIEW",
    "INFLUENCER_COLLAB",
    "EVENT_APPEARANCE",
    "BRAND_OPPORTUNITY",
    "INTRODUCTION",
    "SOCIAL_MEDIA",
    "PRESS_RELEASE",
    "OTHER",
  ]),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).optional(),
  notes: z.string().optional(),
  isClientVisible: z.boolean().default(true),
  status: z.enum(["IDEA", "OUTREACH", "CONFIRMED", "IN_PROGRESS"]).optional(),
  eventTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  venueName: z.string().max(200).nullable().optional(),
  venueAddress: z.string().max(300).nullable().optional(),
  needsRunner: z.boolean().optional(),
});

function zodMessage(err: z.ZodError) {
  return err.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
    .join("; ");
}

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageDeliverables(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createDeliverableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodMessage(parsed.error), details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { month: bodyMonth, year: bodyYear, dueDate: dueDateStr, eventTime: eventTimeStr, ...rest } = parsed.data;

    const client = await db.client.findUnique({
      where: { id: rest.clientId },
      select: { id: true, name: true, status: true, cycleDay: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    // Business rule: paused (and churned) clients get no new deliverables
    if (client.status === "PAUSED" || client.status === "CHURNED") {
      return NextResponse.json(
        { error: `${client.name} is ${client.status.toLowerCase()} — reactivate the client before adding deliverables.` },
        { status: 409 }
      );
    }

    // Month/year = the client's goal cycle (fecha de corte) that the due date falls in,
    // or the client's current cycle when there is no due date. Explicit body values win.
    const dueDate = dueDateStr ? parseDateInput(dueDateStr) : undefined;
    const cycle = dueDate ? cycleForDate(client.cycleDay, dueDate) : currentCycle(client.cycleDay);
    const fallback = { month: cycle.month, year: cycle.year };

    // Client availability: never book on a day the client is OFF; warn on TRAVEL.
    const availability = await checkClientDate(client.id, dueDate);
    if (availability.blocked) {
      return NextResponse.json({ error: availability.warning }, { status: 409 });
    }

    const deliverable = await db.deliverable.create({
      data: {
        ...rest,
        assigneeId: rest.assigneeId || undefined,
        campaignId: rest.campaignId || undefined,
        month: bodyMonth ?? fallback.month,
        year: bodyYear ?? fallback.year,
        dueDate,
        eventTime: dueDateStr ? activityInstant(dueDateStr.slice(0, 10), eventTimeStr) : null,
        venueName: rest.venueName?.trim() || null,
        venueAddress: rest.venueAddress?.trim() || null,
        needsRunner: rest.needsRunner ?? true,
      },
      include: {
        assignee: { select: { id: true, name: true, avatar: true } },
      },
    });

    // A goal created already confirmed goes straight onto the agenda with a runner.
    if (deliverable.status === "CONFIRMED" || deliverable.status === "IN_PROGRESS") {
      try {
        await ensureAgendaItemForDeliverable(deliverable.id, user.id);
      } catch (err) {
        console.error("Agenda item creation failed:", err);
      }
    }

    await db.activityLog.create({
      data: {
        clientId: parsed.data.clientId,
        deliverableId: deliverable.id,
        userId: user.id,
        action: "deliverable_created",
        description: `Created deliverable "${deliverable.title}"`,
      },
    });

    return NextResponse.json({ data: deliverable, warning: availability.warning }, { status: 201 });
  } catch (err) {
    console.error("POST /api/deliverables failed:", err);
    return NextResponse.json({ error: "Could not create deliverable" }, { status: 500 });
  }
}
