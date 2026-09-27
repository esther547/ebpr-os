/**
 * "Michel, necesitamos un comunicado": a strategist's brief to the writer.
 * Cliente · noticia · fecha (+ fotos e info opcionales). The writer (role WRITER)
 * is notified in-app and by email (when Gmail is configured) the moment it is created.
 */
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";

export const APP_URL = "https://os.ebpublicrelations.com";

export {
  REQUEST_STATUS_LABELS,
  requestSelect,
  type PressReleaseRequestItem,
  type RequestStatus,
} from "@/lib/press-release-requests-shared";
import { REQUEST_STATUS_LABELS, requestSelect, type RequestStatus } from "@/lib/press-release-requests-shared";

function esc(v: string | null | undefined): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fmtDueDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York" });
}

/** Tell every active writer about a new request (in-app + email). Never throws. */
export async function notifyWritersOfRequest(requestId: string): Promise<{ notified: number; emailed: boolean }> {
  const r = await db.pressReleaseRequest.findUnique({ where: { id: requestId }, select: requestSelect });
  if (!r) return { notified: 0, emailed: false };
  const writers = await db.user.findMany({ where: { role: "WRITER", isActive: true }, select: { id: true, email: true, name: true } });
  const link = `/press-releases?request=${r.id}`;
  let notified = 0;
  for (const w of writers) {
    await db.notification
      .create({
        data: {
          userId: w.id,
          type: "press_release_request",
          title: `Comunicado para ${r.client.name}`,
          message: `${r.news.slice(0, 140)} · para el ${fmtDueDate(r.dueDate)}`,
          link,
        },
      })
      .then(() => notified++)
      .catch(() => undefined);
  }
  let emailed = false;
  if (writers.length && isEmailConfigured()) {
    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:600px;margin:0 auto;background:#fff">
  <div style="background:#0a0a0a;color:#fff;padding:22px 28px"><div style="font-size:16px;font-weight:600;letter-spacing:2px">EB PUBLIC RELATIONS</div><div style="font-size:12px;color:#999;margin-top:4px">Solicitud de comunicado</div></div>
  <div style="padding:26px 28px">
    <p style="font-size:14px;margin:0 0 18px">Hola ${esc(writers[0].name.split(" ")[0])}, ${esc(r.requestedBy.name)} necesita un comunicado.</p>
    <table cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
      <tr><td style="padding:6px 14px 6px 0;color:#6b7280;vertical-align:top">Cliente</td><td style="padding:6px 0"><strong>${esc(r.client.name)}</strong></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#6b7280;vertical-align:top">Noticia</td><td style="padding:6px 0;white-space:pre-line">${esc(r.news)}</td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#6b7280;vertical-align:top">Fecha</td><td style="padding:6px 0"><strong>${esc(fmtDueDate(r.dueDate))}</strong></td></tr>
      ${r.photosUrl ? `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;vertical-align:top">Fotos</td><td style="padding:6px 0"><a href="${esc(r.photosUrl)}" style="color:#2563eb">${esc(r.photosUrl)}</a></td></tr>` : ""}
      ${r.info ? `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;vertical-align:top">Info</td><td style="padding:6px 0;white-space:pre-line">${esc(r.info)}</td></tr>` : ""}
    </table>
    <p style="margin-top:22px"><a href="${APP_URL}${link}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600">Abrir en el portal</a></p>
    <p style="font-size:12px;color:#6b7280">Cuando lo tengas, márcalo como entregado en el portal y pega el link del documento. ${esc(r.requestedBy.name)} recibe el aviso.</p>
  </div>
</div></body></html>`;
    const text = [
      `Comunicado para ${r.client.name}`,
      `Noticia: ${r.news}`,
      `Fecha: ${fmtDueDate(r.dueDate)}`,
      r.photosUrl ? `Fotos: ${r.photosUrl}` : "",
      r.info ? `Info: ${r.info}` : "",
      `${APP_URL}${link}`,
    ].filter(Boolean).join("\n");
    emailed = await sendEmail({
      to: writers.map((w) => w.email),
      subject: `Comunicado para ${r.client.name} · para el ${r.dueDate.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "America/New_York" })}`,
      html,
      text,
    });
  }
  return { notified, emailed };
}

/** Tell the requester the writer delivered (or changed status). Never throws. */
export async function notifyRequesterOfStatus(requestId: string): Promise<void> {
  const r = await db.pressReleaseRequest.findUnique({ where: { id: requestId }, select: requestSelect });
  if (!r) return;
  const label = REQUEST_STATUS_LABELS[r.status as RequestStatus] ?? r.status;
  const link = `/press-releases?request=${r.id}`;
  await db.notification
    .create({
      data: {
        userId: r.requestedBy.id,
        type: "press_release_request_status",
        title: `Comunicado ${r.client.name}: ${label.toLowerCase()}`,
        message: r.status === "DONE" && r.draftUrl ? `Listo: ${r.draftUrl}` : r.news.slice(0, 140),
        link,
      },
    })
    .catch(() => undefined);
  if (r.status === "DONE" && isEmailConfigured()) {
    await sendEmail({
      to: r.requestedBy.email,
      subject: `Comunicado entregado: ${r.client.name}`,
      html: `<p>Michel entregó el comunicado de <strong>${esc(r.client.name)}</strong> (${esc(r.news.slice(0, 120))}).</p>${r.draftUrl ? `<p><a href="${esc(r.draftUrl)}">${esc(r.draftUrl)}</a></p>` : ""}${r.writerNotes ? `<p>${esc(r.writerNotes)}</p>` : ""}<p><a href="${APP_URL}${link}">Abrir en el portal</a></p>`,
      text: `Comunicado entregado: ${r.client.name}. ${r.draftUrl ?? ""} ${APP_URL}${link}`,
    }).catch(() => undefined);
  }
}
