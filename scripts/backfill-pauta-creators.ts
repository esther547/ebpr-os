/**
 * Fill RunnerAssignment.createdById / Deliverable.createdById for rows created before Oct 14 2026,
 * from the activity log ("Added "<event>" to <client>'s agenda" / "Assigned <runner> to "<event>" for <client>").
 *   npx tsx scripts/backfill-pauta-creators.ts [--apply]
 */
import { db } from "../lib/db";
(async () => {
  const apply = process.argv.includes("--apply");
  const logs = await db.activityLog.findMany({ where: { action: { in: ["agenda_item_created", "runner_assigned", "deliverable_created"] } }, select: { userId: true, clientId: true, description: true, deliverableId: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  const pautas = await db.runnerAssignment.findMany({ where: { createdById: null }, select: { id: true, clientId: true, eventName: true, deliverableId: true, createdAt: true } });
  let matched = 0;
  const pautaCreator = new Map<string, string>();
  for (const p of pautas) {
    const name = p.eventName.trim().toLowerCase();
    const hit = logs.find((l) => l.clientId === p.clientId && l.description.toLowerCase().includes(`"${name}"`));
    if (hit?.userId) { pautaCreator.set(p.id, hit.userId); matched++; }
  }
  console.log(`pautas sin creador: ${pautas.length} · con registro en el log: ${matched}`);
  // Goals: from their own log line, else from the pauta they are linked to.
  const goals = await db.deliverable.findMany({ where: { createdById: null }, select: { id: true, clientId: true, title: true } });
  const goalCreator = new Map<string, string>();
  for (const g of goals) {
    const hit = logs.find((l) => l.deliverableId === g.id) ?? logs.find((l) => l.clientId === g.clientId && l.description.toLowerCase().includes(`"${g.title.trim().toLowerCase()}"`));
    if (hit?.userId) goalCreator.set(g.id, hit.userId);
  }
  for (const p of pautas) if (p.deliverableId && !goalCreator.has(p.deliverableId) && pautaCreator.has(p.id)) goalCreator.set(p.deliverableId, pautaCreator.get(p.id)!);
  for (const p of pautas) if (!pautaCreator.has(p.id) && p.deliverableId && goalCreator.has(p.deliverableId)) pautaCreator.set(p.id, goalCreator.get(p.deliverableId)!);
  console.log(`metas sin creador: ${goals.length} · resueltas: ${goalCreator.size} · pautas resueltas en total: ${pautaCreator.size}`);
  if (!apply) { console.log("dry run"); await db.$disconnect(); return; }
  for (const [id, uid] of pautaCreator) await db.runnerAssignment.update({ where: { id }, data: { createdById: uid } });
  for (const [id, uid] of goalCreator) await db.deliverable.update({ where: { id }, data: { createdById: uid } });
  console.log("aplicado");
  await db.$disconnect();
})();
