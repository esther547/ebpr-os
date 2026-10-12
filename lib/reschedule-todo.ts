/**
 * A cancelled deliverable (or a cancelled/removed pauta) is not lost: it becomes a "Reagendar" line on the
 * strategist's board (Prioridades / Mis to dos) so they reschedule it (Esther, Oct 12 2026).
 * Client last-minute cancellations are excluded by the callers (they still count, nothing to redo).
 */
import { db } from "@/lib/db";
import { resolveWeekKey, weekOfInstant } from "@/lib/priorities";
import { dayKeyInTz } from "@/components/runners/miami-time";

export async function queueRescheduleTodo(opts: { deliverableId?: string | null; pautaId?: string | null; pautaName?: string | null; clientId?: string | null; byUserId: string; byUserName?: string | null }): Promise<string | null> {
  try {
    let title = opts.pautaName ?? null;
    let clientId = opts.clientId ?? null;
    let assigneeId: string | null = null;
    if (opts.deliverableId) {
      const d = await db.deliverable.findUnique({ where: { id: opts.deliverableId }, select: { title: true, clientId: true, assigneeId: true } });
      if (d) { title = d.title; clientId = d.clientId; assigneeId = d.assigneeId; }
    }
    if (!title && opts.pautaId) {
      const p = await db.runnerAssignment.findUnique({ where: { id: opts.pautaId }, select: { eventName: true, clientId: true, deliverableId: true } });
      if (p) {
        title = p.eventName; clientId = p.clientId;
        if (p.deliverableId) assigneeId = (await db.deliverable.findUnique({ where: { id: p.deliverableId }, select: { assigneeId: true } }))?.assigneeId ?? null;
      }
    }
    if (!title) return null;
    // The strategist who owns the goal; otherwise the strategist who cancelled it; otherwise the client's team line.
    if (!assigneeId) {
      const by = await db.user.findUnique({ where: { id: opts.byUserId }, select: { role: true } });
      if (by?.role === "STRATEGIST") assigneeId = opts.byUserId;
    }
    const line = `Reagendar: ${title}`;
    const open = await db.weeklyPriority.findFirst({ where: { title: line, clientId, isDone: false }, select: { id: true } });
    if (open) return open.id;
    const when = dayKeyInTz(new Date());
    const created = await db.weeklyPriority.create({
      data: {
        weekOf: weekOfInstant(resolveWeekKey()),
        clientId,
        title: line,
        notes: `Cancelada el ${when}${opts.byUserName ? ` por ${opts.byUserName}` : ""}. Pendiente de reagendar con el cliente.`,
        assigneeId,
        list: "TEAM",
        createdById: opts.byUserId,
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    console.error("queueRescheduleTodo:", err);
    return null;
  }
}
