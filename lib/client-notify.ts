/**
 * Agenda emails to the CLIENT (the talent / their team), Esther Oct 6 2026: "cada vez que se
 * agende un deliverable, tal cual le llega a los runners, le llegue al cliente". Sent to the
 * client's contacts flagged `notifyAgenda`. Client-safe: real date, times, venue, the client-visible
 * notes and the runner's first name — never internal notes or contacts.
 */
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { clientSafeNotes } from "@/lib/client-safe-notes";
import { APP_URL, describeChanges, snapshotAssignment, type AssignmentSnapshot } from "@/lib/runner-notify";

const TZ = "America/New_York";
const fmtDay = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const fmtTime = (d: Date | null) => (d ? d.toLocaleTimeString("es-ES", { hour: "numeric", minute: "2-digit", timeZone: TZ }) : null);
const esc = (v: string | null | undefined) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

async function recipients(clientId: string | null): Promise<{ client: { name: string }; to: string[] } | null> {
  if (!clientId) return null;
  const client = await db.client.findUnique({ where: { id: clientId }, select: { name: true, contacts: { where: { notifyAgenda: true, email: { not: null } }, select: { email: true } } } });
  if (!client) return null;
  const to = [...new Set(client.contacts.map((c) => c.email!.trim()).filter(Boolean))];
  return { client: { name: client.name }, to };
}

async function runnerFirstName(runnerId: string | null): Promise<string | null> {
  if (!runnerId) return null;
  const r = await db.user.findUnique({ where: { id: runnerId }, select: { name: true } });
  return r?.name.split(" ")[0] ?? null;
}

function detailsHtml(a: AssignmentSnapshot, runner: string | null): string {
  const rows: [string, string | null][] = [
    ["Actividad", a.eventName],
    ["Fecha", fmtDay(a.eventDate)],
    ["Hora", fmtTime(a.eventTime)],
    ["Llegada", fmtTime(a.arrivalTime)],
    ["Lugar", [a.venueName, a.venueAddress].filter(Boolean).join(" · ") || a.location || null],
    ["Acompaña", runner],
    ["Notas", clientSafeNotes(a.notes)],
  ];
  return `<table cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:5px 14px 5px 0;color:#6b7280;vertical-align:top">${k}</td><td style="padding:5px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("")}</table>`;
}

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#0a0a0a;color:#fff;padding:22px 28px"><div style="font-size:16px;font-weight:600;letter-spacing:2px">EB PUBLIC RELATIONS</div><div style="font-size:12px;color:#999;margin-top:4px">${esc(title)}</div></div>
  <div style="padding:26px 28px">${body}
    <p style="margin-top:22px;font-size:12px;color:#6b7280">Tu agenda completa está en tu portal: <a href="${APP_URL}/portal/agenda" style="color:#0a0a0a">${APP_URL}/portal/agenda</a></p>
  </div>
</div></body></html>`;
}

/** "Agendamos: …" — the client hears about a new pauta the moment it is scheduled. */
export async function notifyClientNewPauta(assignmentId: string): Promise<number> {
  const a = await snapshotAssignment(assignmentId);
  if (!a || a.status === "CANCELLED") return 0;
  const r = await recipients(a.clientId);
  if (!r || !r.to.length || !isEmailConfigured()) return 0;
  const runner = await runnerFirstName(a.runnerId);
  const html = wrap("Nueva pauta en tu agenda", `<p style="font-size:14px;margin:0 0 16px">Hola ${esc(r.client.name.split(" ")[0])}, te agendamos una nueva pauta:</p>${detailsHtml(a, runner)}`);
  await sendEmail({ to: r.to, subject: `Nueva pauta: ${a.eventName} · ${fmtDay(a.eventDate)}`, html, text: `Nueva pauta: ${a.eventName}\n${fmtDay(a.eventDate)}${fmtTime(a.eventTime) ? ` · ${fmtTime(a.eventTime)}` : ""}\n${[a.venueName, a.venueAddress].filter(Boolean).join(" · ")}` }).catch((err) => console.error("notifyClientNewPauta:", err));
  return r.to.length;
}

/** Same diff the runner gets (date, hour, arrival, place, status) — internal notes never included. */
export async function notifyClientPautaChanges(before: AssignmentSnapshot): Promise<number> {
  const after = await snapshotAssignment(before.id);
  if (!after) return 0;
  const changes = describeChanges(before, after).filter((c) => !c.startsWith("Notas internas"));
  if (!changes.length) return 0;
  const r = await recipients(after.clientId);
  if (!r || !r.to.length || !isEmailConfigured()) return 0;
  const cancelled = after.status === "CANCELLED";
  const runner = await runnerFirstName(after.runnerId);
  const html = wrap(
    cancelled ? "Pauta cancelada" : "Cambio en tu agenda",
    `<p style="font-size:14px;margin:0 0 12px">${cancelled ? "Se canceló" : "Se actualizó"} <strong>${esc(after.eventName)}</strong>. ${cancelled ? "" : "Esto es lo que cambió:"}</p>
     ${cancelled ? "" : `<ul style="font-size:14px;margin:0 0 18px;padding-left:18px">${changes.map((c) => `<li style="margin-bottom:4px">${esc(c)}</li>`).join("")}</ul><p style="font-size:13px;color:#6b7280;margin:0 0 10px">Cómo queda ahora:</p>`}${detailsHtml(after, runner)}`
  );
  await sendEmail({ to: r.to, subject: `${cancelled ? "Cancelada" : "Cambio"}: ${after.eventName} · ${fmtDay(after.eventDate)}`, html, text: `${cancelled ? "Pauta cancelada" : "Cambio en tu pauta"}: ${after.eventName}\n${changes.join("\n")}` }).catch((err) => console.error("notifyClientPautaChanges:", err));
  return r.to.length;
}

/** The pauta was removed from the schedule. */
export async function notifyClientPautaRemoved(a: AssignmentSnapshot): Promise<number> {
  const r = await recipients(a.clientId);
  if (!r || !r.to.length || !isEmailConfigured() || a.status === "CANCELLED") return 0;
  const html = wrap("Pauta cancelada", `<p style="font-size:14px;margin:0 0 16px">Se canceló esta pauta de tu agenda:</p>${detailsHtml(a, null)}`);
  await sendEmail({ to: r.to, subject: `Cancelada: ${a.eventName} · ${fmtDay(a.eventDate)}`, html, text: `Pauta cancelada: ${a.eventName} · ${fmtDay(a.eventDate)}` }).catch((err) => console.error("notifyClientPautaRemoved:", err));
  return r.to.length;
}
