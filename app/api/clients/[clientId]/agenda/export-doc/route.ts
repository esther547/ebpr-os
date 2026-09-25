import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { db } from "@/lib/db";
import { appendNewPautasToDoc } from "@/lib/agenda-doc-append";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

/**
 * POST — add to this client's agenda Google Doc the pautas it does not list yet.
 * Append-only: the doc is the agency's ledger and is never rewritten (Esther, Sept 25 2026).
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

  const result = await appendNewPautasToDoc(clientId);

  if (result.ok) {
    if (result.added > 0) {
      await db.activityLog
        .create({
          data: {
            clientId,
            userId: user.id,
            action: "agenda_doc_synced",
            description: `Agregó ${result.added} ${result.added === 1 ? "pauta nueva" : "pautas nuevas"} al Google Doc de agenda de ${client.name}`,
          },
        })
        .catch(() => {});
    }
    return NextResponse.json({
      ok: true,
      months: 0,
      rows: result.added,
      message:
        result.added === 0
          ? "El Google Doc ya tiene todas las pautas del portal; no se cambió nada."
          : `Google Doc actualizado: ${result.added} ${result.added === 1 ? "pauta nueva agregada" : "pautas nuevas agregadas"}${result.skipped ? ` (${result.skipped} más se agregan en la próxima corrida)` : ""}`,
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
