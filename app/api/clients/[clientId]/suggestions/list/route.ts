import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anthropicConfigured, authorizeSuggestions, jsonError, listSuggestions } from "@/lib/client-suggestions";

export const dynamic = "force-dynamic";

/** GET /api/clients/:clientId/suggestions/list — the client's suggestions grouped by status. */
export async function GET(_req: Request, { params }: { params: { clientId: string } }) {
  const auth = await authorizeSuggestions();
  if (auth.error) return auth.error;

  const client = await db.client.findUnique({ where: { id: params.clientId }, select: { id: true } });
  if (!client) return jsonError("Cliente no encontrado", 404);

  const data = await listSuggestions(client.id);
  return NextResponse.json({
    data,
    counts: {
      NEW: data.NEW.length,
      IN_PROGRESS: data.IN_PROGRESS.length,
      DONE: data.DONE.length,
      DISMISSED: data.DISMISSED.length,
    },
    configured: anthropicConfigured(),
  });
}
