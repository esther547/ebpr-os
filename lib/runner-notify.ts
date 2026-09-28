/**
 * Runner notifications (Esther, Sept 28 2026):
 *  - a runner is told (bell + email) when they are assigned to a pauta,
 *  - a runner is told exactly WHAT changed on a pauta they carry (date, time, place…),
 *  - every active runner is told when a new pauta has nobody on it.
 * Email goes out only when Gmail is configured; the in-app notice always does.
 */
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";

export const APP_URL = "https://os.ebpublicrelations.com";

export type AssignmentSnapshot = {
  id: string;
  runnerId: string | null;
  clientId: string | null;
  eventName: string;
  eventDate: Date;
  arrivalTime: Date | null;
  eventTime: Date | null;
  venueName: string | null;
  venueAddress: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  internalNotes: string | null;
};

export const snapshotSelect = {
  id: true, runnerId: true, clientId: true, eventName: true, eventDate: true, arrivalTime: true, eventTime: true,
  venueName: true, venueAddress: true, location: true, status: true, notes: true, internalNotes: true,
} as const;

const TZ = "America/New_York";
const fmtDay = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const fmtTime = (d: Date | null) => (d ? d.toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit", timeZone: TZ }) : "—");
const esc = (v: string | null | undefined) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sameDay = (a: Date, b: Date) => a.toLocaleDateString("en-CA", { timeZone: TZ }) === b.toLocaleDateString("en-CA", { timeZone: TZ });
const sameTime = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

const STATUS_ES: Record<string, string> = { SCHEDULED: "Programada", CONFIRMED: "Confirmada", COMPLETED: "Completada", CANCELLED: "Cancelada" };

export async function snapshotAssignment(id: string): Promise<AssignmentSnapshot | null> {
  return db.runnerAssignment.findUnique({ where: { id }, select: snapshotSelect });
}

/** Human-readable list of what changed between two snapshots (empty when nothing relevant changed). */
export function describeChanges(before: AssignmentSnapshot, after: AssignmentSnapshot): string[] {
  const out: string[] = [];
  if (before.eventName !== after.eventName) out.push(`Actividad: "${before.eventName}" → "${after.eventName}"`);
  if (!sameDay(before.eventDate, after.eventDate)) out.push(`Fecha: ${fmtDay(before.eventDate)} → ${fmtDay(after.eventDate)}`);
  if (!sameTime(before.eventTime, after.eventTime)) out.push(`Hora: ${fmtTime(before.eventTime)} → ${fmtTime(after.eventTime)}`);
  if (!sameTime(before.arrivalTime, after.arrivalTime)) out.push(`Llegada: ${fmtTime(before.arrivalTime)} → ${fmtTime(after.arrivalTime)}`);
  if ((before.venueName ?? "") !== (after.venueName ?? "")) out.push(`Lugar: ${before.venueName || "—"} → ${after.venueName || "—"}`);
  if ((before.venueAddress ?? "") !== (after.venueAddress ?? "")) out.push(`Dirección: ${before.venueAddress || "—"} → ${after.venueAddress || "—"}`);
  if ((before.location ?? "") !== (after.location ?? "") && (before.venueName ?? "") === (after.venueName ?? "")) out.push(`Ubicación: ${before.location || "—"} → ${after.location || "—"}`);
  if (before.status !== after.status) out.push(`Estado: ${STATUS_ES[before.status] ?? before.status} → ${STATUS_ES[after.status] ?? after.status}`);
  if ((before.internalNotes ?? "") !== (after.internalNotes ?? "")) out.push(`Notas internas: ${after.internalNotes || "—"}`);
  return out;
}

async function clientName(clientId: string | null): Promise<string> {
  if (!clientId) return "";
  const c = await db.client.findUnique({ where: { id: clientId }, select: { name: true } });
  return c?.name ?? "";
}

function detailsHtml(a: AssignmentSnapshot, client: string): string {
  const rows: [string, string][] = [
    ["Cliente", client],
    ["Actividad", a.eventName],
    ["Fecha", fmtDay(a.eventDate)],
    ["Hora", fmtTime(a.eventTime)],
    ["Llegada", fmtTime(a.arrivalTime)],
    ["Lugar", [a.venueName, a.venueAddress].filter(Boolean).join(" · ") || a.location || "—"],
    ...(a.internalNotes ? ([["Notas internas", a.internalNotes]] as [string, string][]) : []),
  ];
  return `<table cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#6b7280;vertical-align:top">${k}</td><td style="padding:5px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("")}</table>`;
}

function wrap(title: string, body: string, link: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#0a0a0a;color:#fff;padding:22px 28px"><div style="font-size:16px;font-weight:600;letter-spacing:2px">EB PUBLIC RELATIONS</div><div style="font-size:12px;color:#999;margin-top:4px">${esc(title)}</div></div>
  <div style="padding:26px 28px">${body}
    <p style="margin-top:22px"><a href="${link}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600">Ver mi agenda</a></p>
  </div>
</div></body></html>`;
}

async function sendToRunner(runnerId: string, subject: string, title: string, message: string, html: string, link: string) {
  const runner = await db.user.findUnique({ where: { id: runnerId }, select: { email: true, name: true, isActive: true } });
  if (!runner) return;
  await db.notification.create({ data: { userId: runnerId, type: "runner_agenda", title, message, link } }).catch(() => undefined);
  if (isEmailConfigured() && runner.isActive) {
    await sendEmail({ to: runner.email, subject, html, text: `${title}\n${message}\n${APP_URL}${link}` }).catch(() => undefined);
  }
}

/** "Te asignaron a…": the runner now carries this pauta. */
export async function notifyRunnerAssigned(assignmentId: string): Promise<void> {
  const a = await snapshotAssignment(assignmentId);
  if (!a || !a.runnerId || a.status === "CANCELLED") return;
  const client = await clientName(a.clientId);
  const link = `/runner-portal?assignment=${a.id}`;
  const title = `Nueva pauta: ${a.eventName}`;
  const message = `${client ? client + " · " : ""}${fmtDay(a.eventDate)}${a.eventTime ? ` · ${fmtTime(a.eventTime)}` : ""}`;
  const html = wrap("Te asignaron una pauta", `<p style="font-size:14px;margin:0 0 16px">Quedaste como runner de esta actividad:</p>${detailsHtml(a, client)}`, `${APP_URL}${link}`);
  await sendToRunner(a.runnerId, `Te asignaron: ${a.eventName}${client ? ` (${client})` : ""} · ${fmtDay(a.eventDate)}`, title, message, html, link);
}

/**
 * Compare the pauta before/after an edit and tell the assigned runner exactly what changed.
 * If the runner themself changed, the new runner gets the "assigned" notice instead.
 */
export async function notifyRunnerOfChanges(before: AssignmentSnapshot, actorName?: string): Promise<{ notified: boolean; changes: string[] }> {
  const after = await snapshotAssignment(before.id);
  if (!after) return { notified: false, changes: [] };
  if (after.runnerId && after.runnerId !== before.runnerId) {
    await notifyRunnerAssigned(after.id);
    return { notified: true, changes: ["runner"] };
  }
  if (!after.runnerId) return { notified: false, changes: [] };
  const changes = describeChanges(before, after);
  if (!changes.length) return { notified: false, changes };
  const client = await clientName(after.clientId);
  const link = `/runner-portal?assignment=${after.id}`;
  const cancelled = after.status === "CANCELLED";
  const title = cancelled ? `Pauta cancelada: ${after.eventName}` : `Cambio en tu pauta: ${after.eventName}`;
  const message = changes.join(" · ");
  const html = wrap(
    cancelled ? "Pauta cancelada" : "Cambio en una pauta tuya",
    `<p style="font-size:14px;margin:0 0 12px">${actorName ? `${esc(actorName)} actualizó` : "Se actualizó"} <strong>${esc(after.eventName)}</strong>${client ? ` (${esc(client)})` : ""}. Esto es lo que cambió:</p>
     <ul style="font-size:14px;margin:0 0 18px;padding-left:18px">${changes.map((c) => `<li style="margin-bottom:4px">${esc(c)}</li>`).join("")}</ul>
     <p style="font-size:13px;color:#6b7280;margin:0 0 10px">Cómo queda ahora:</p>${detailsHtml(after, client)}`,
    `${APP_URL}${link}`
  );
  await sendToRunner(after.runnerId, `${cancelled ? "Cancelada" : "Cambio"}: ${after.eventName}${client ? ` (${client})` : ""} · ${fmtDay(after.eventDate)}`, title, message, html, link);
  return { notified: true, changes };
}

/** A new pauta has nobody on it: every active runner hears about it (bell + email). */
export async function notifyRunnersOpenActivity(assignmentId: string): Promise<number> {
  const a = await snapshotAssignment(assignmentId);
  if (!a || a.runnerId || a.status === "CANCELLED") return 0;
  const runners = await db.user.findMany({ where: { role: "RUNNER", isActive: true }, select: { id: true, email: true } });
  if (!runners.length) return 0;
  const client = await clientName(a.clientId);
  const link = `/runner-portal?assignment=${a.id}`;
  const title = `Pauta sin runner: ${a.eventName}`;
  const message = `${client ? client + " · " : ""}${fmtDay(a.eventDate)}${a.eventTime ? ` · ${fmtTime(a.eventTime)}` : ""}. Si puedes tomarla, avisa al equipo.`;
  await db.notification.createMany({ data: runners.map((r) => ({ userId: r.id, type: "runner_open_activity", title, message, link })) }).catch(() => undefined);
  if (isEmailConfigured()) {
    const html = wrap("Nueva pauta que necesita runner", `<p style="font-size:14px;margin:0 0 16px">Entró una actividad y todavía no tiene runner. Si te queda bien, responde a este correo o avísale a Esther / al equipo.</p>${detailsHtml(a, client)}`, `${APP_URL}${link}`);
    await sendEmail({ to: runners.map((r) => r.email), subject: `Pauta sin runner: ${a.eventName}${client ? ` (${client})` : ""} · ${fmtDay(a.eventDate)}`, html, text: `${title}\n${message}\n${APP_URL}${link}` }).catch(() => undefined);
  }
  return runners.length;
}
