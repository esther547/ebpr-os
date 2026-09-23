import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { writeAgendaDoc } from "@/lib/google-docs-writer";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

/**
 * POST — regenerate this client's "Agenda 2026" Google Doc from the portal.
 * The portal is the source of truth; the doc's header block is preserved and
 * everything from the first "MES ..." paragraph down is rewritten.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageClients(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { clientId } = await params;
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, agendaDocUrl: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const result = await writeAgendaDoc(clientId);

  if (result.ok) {
    await db.activityLog
      .create({
        data: {
          clientId,
          userId: user.id,
          action: "agenda_doc_synced",
          description: `Regeneró el Google Doc de agenda de ${client.name} (${result.months} meses, ${result.rows} pautas)`,
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      months: result.months,
      rows: result.rows,
      message: `Google Doc actualizado: ${result.months} ${result.months === 1 ? "mes" : "meses"}, ${result.rows} ${result.rows === 1 ? "pauta" : "pautas"}`,
    });
  }

  const status =
    result.kind === "not_shared"
      ? 403
      : result.kind === "not_found"
        ? 404
        : result.kind === "not_configured"
          ? 503
          : result.kind === "bad_url"
            ? 400
            : 502;

  return NextResponse.json({ ok: false, kind: result.kind, error: result.error }, { status });
}
