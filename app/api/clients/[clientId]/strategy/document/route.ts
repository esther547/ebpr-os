import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { canManageClients } from "@/lib/permissions";

/** Accepts "YYYY-MM-DD" (date input) or a full ISO datetime. */
const dateField = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(new Date(v).getTime()), {
    message: "Invalid date",
  });

/** "YYYY-MM-DD" -> noon UTC so the calendar day is stable in every timezone. */
function parseDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  return new Date(value);
}

async function authorize() {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageClients(user)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

const documentSchema = z.object({
  purpose: z.string().optional(),
  objective: z.string().optional(),
  strategicPath: z.string().optional(),
  messagingFramework: z.string().optional(),
  keyMessages: z.array(z.string()).optional(),
  clientPersona: z.string().optional(),
  targetAudience: z.string().optional(),
  executionNotes: z.string().optional(),
  servicesProvided: z.array(z.string()).optional(),
  phase1Name: z.string().optional(),
  phase1Start: dateField.optional().nullable(),
  phase1End: dateField.optional().nullable(),
  phase2Name: z.string().optional(),
  phase2Start: dateField.optional().nullable(),
  phase2End: dateField.optional().nullable(),
  externalCollaborators: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        organization: z.string().optional(),
      })
    )
    .optional(),
  prepMonthStart: dateField.optional().nullable(),
  prepMonthEnd: dateField.optional().nullable(),
  campaignStart: dateField.optional().nullable(),
  location: z.string().optional(),
  year: z.number().int().optional(),
});

// GET — fetch the strategy document for a client
export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const doc = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
  });

  if (!doc) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  return NextResponse.json({ data: doc });
}

// POST — create strategy document
export async function POST(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = documentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
          .join("; "),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  // Ensure client exists
  const client = await db.client.findUnique({
    where: { id: params.clientId },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const data = parsed.data;

  const doc = await db.strategyDocument.upsert({
    where: { clientId: params.clientId },
    create: {
      clientId: params.clientId,
      ...buildDocumentFields(data),
    },
    update: buildDocumentFields(data),
  });

  return NextResponse.json({ data: doc }, { status: 201 });
}

// PUT — update strategy document
export async function PUT(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const body = await req.json();
  const parsed = documentSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues
          .map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message)
          .join("; "),
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const existing = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Strategy document not found" }, { status: 404 });
  }

  const doc = await db.strategyDocument.update({
    where: { clientId: params.clientId },
    data: buildDocumentFields(parsed.data),
  });

  return NextResponse.json({ data: doc });
}

// DELETE — remove strategy document
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const existing = await db.strategyDocument.findUnique({
    where: { clientId: params.clientId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Strategy document not found" }, { status: 404 });
  }

  await db.strategyDocument.delete({
    where: { clientId: params.clientId },
  });

  return NextResponse.json({ success: true });
}

function buildDocumentFields(data: z.infer<typeof documentSchema>) {
  return {
    ...(data.purpose !== undefined && { purpose: data.purpose }),
    ...(data.objective !== undefined && { objective: data.objective }),
    ...(data.strategicPath !== undefined && { strategicPath: data.strategicPath }),
    ...(data.messagingFramework !== undefined && { messagingFramework: data.messagingFramework }),
    ...(data.keyMessages !== undefined && { keyMessages: data.keyMessages }),
    ...(data.clientPersona !== undefined && { clientPersona: data.clientPersona }),
    ...(data.targetAudience !== undefined && { targetAudience: data.targetAudience }),
    ...(data.executionNotes !== undefined && { executionNotes: data.executionNotes }),
    ...(data.servicesProvided !== undefined && { servicesProvided: data.servicesProvided }),
    ...(data.phase1Name !== undefined && { phase1Name: data.phase1Name }),
    ...(data.phase1Start !== undefined && { phase1Start: data.phase1Start ? parseDateInput(data.phase1Start) : null }),
    ...(data.phase1End !== undefined && { phase1End: data.phase1End ? parseDateInput(data.phase1End) : null }),
    ...(data.phase2Name !== undefined && { phase2Name: data.phase2Name }),
    ...(data.phase2Start !== undefined && { phase2Start: data.phase2Start ? parseDateInput(data.phase2Start) : null }),
    ...(data.phase2End !== undefined && { phase2End: data.phase2End ? parseDateInput(data.phase2End) : null }),
    ...(data.externalCollaborators !== undefined && { externalCollaborators: data.externalCollaborators }),
    ...(data.prepMonthStart !== undefined && { prepMonthStart: data.prepMonthStart ? parseDateInput(data.prepMonthStart) : null }),
    ...(data.prepMonthEnd !== undefined && { prepMonthEnd: data.prepMonthEnd ? parseDateInput(data.prepMonthEnd) : null }),
    ...(data.campaignStart !== undefined && { campaignStart: data.campaignStart ? parseDateInput(data.campaignStart) : null }),
    ...(data.location !== undefined && { location: data.location }),
    ...(data.year !== undefined && { year: data.year }),
  };
}
