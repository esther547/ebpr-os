/**
 * A strategy item (target, event, brand deal, client wish) with someone "a cargo" shows up on that
 * strategist's board as "Estrategia: <title>" (Esther, Oct 12 2026). Reassigning moves the open line;
 * clearing the assignee (or closing the item) removes it while it is still open.
 */
import { db } from "@/lib/db";
import { resolveWeekKey, weekOfInstant } from "@/lib/priorities";

const CLOSED = new Set(["COMPLETED", "REJECTED"]);

export async function syncStrategyTodo(itemId: string, byUserId: string): Promise<void> {
  const item = await db.strategyItem.findUnique({ where: { id: itemId }, select: { title: true, targetName: true, clientId: true, assigneeId: true, status: true, category: true, notes: true } });
  if (!item) return;
  const title = `Estrategia: ${item.targetName ?? item.title}`;
  const open = await db.weeklyPriority.findFirst({ where: { title, clientId: item.clientId, isDone: false }, select: { id: true, assigneeId: true } });
  const wanted = !!item.assigneeId && !CLOSED.has(item.status);
  if (!wanted) { if (open) await db.weeklyPriority.delete({ where: { id: open.id } }); return; }
  if (open) { if (open.assigneeId !== item.assigneeId) await db.weeklyPriority.update({ where: { id: open.id }, data: { assigneeId: item.assigneeId } }); return; }
  await db.weeklyPriority.create({ data: { weekOf: weekOfInstant(resolveWeekKey()), clientId: item.clientId, title, notes: item.notes ?? null, assigneeId: item.assigneeId, list: "TEAM", createdById: byUserId } });
}
