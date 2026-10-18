import { sendEmail, isEmailConfigured } from "@/lib/email";
import { APP_URL } from "@/lib/pitch-reminders";
import type { Suggestion } from "@/lib/campaign-suggester";
import { CAMPAIGN_APPROVER_EMAILS } from "@/lib/talents";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ROLE_ES: Record<string, string> = { lead: "Lead", support: "Apoyo", reach: "Alcance" };

export function suggestionHtml(s: Suggestion, meta: { brand: string; brief?: string | null; byName: string; id: string }) {
  const li = (arr: string[]) => arr.map((x) => `<li style="margin:0 0 6px">${esc(x)}</li>`).join("");
  const rows = s.shortlist.map((t) => `
    <tr>
      <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top"><strong>${esc(t.name)}</strong><br><span style="font-size:12px;color:#6b7280">${ROLE_ES[t.role] ?? t.role} · ${esc(t.reachSummary)}</span></td>
      <td style="padding:10px 8px;border-top:1px solid #e5e7eb;vertical-align:top;font-size:13px">${esc(t.whyThisOne)}${t.flag ? `<div style="margin-top:6px;padding:6px 8px;background:#fff7ed;border-left:3px solid #f97316;font-size:12px;color:#9a3412">⚑ ${esc(t.flag)}</div>` : ""}</td>
    </tr>`).join("");
  const url = `${APP_URL}/talentos/campanas/${meta.id}`;
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;color:#111;font-size:14px;line-height:1.5">
    <p style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin:0 0 4px">Propuesta de campaña · para aprobación</p>
    <h1 style="font-size:22px;margin:0 0 4px">${esc(meta.brand)}</h1>
    <p style="margin:0 0 18px;color:#6b7280;font-size:13px">Preparada por ${esc(meta.byName)} con el roster de EBM.${meta.brief ? ` Lo que sabemos: ${esc(meta.brief)}` : ""}</p>
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:18px 0 6px">La marca</h3><p style="margin:0">${esc(s.brandRead)}</p>
    <p style="margin:8px 0 0;padding:8px 10px;background:#f3f4f6;border-radius:6px;font-size:13px"><strong>Mercado asumido:</strong> ${esc(s.marketAssumption)}</p>
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:18px 0 6px">Shortlist (${s.shortlist.length})</h3>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:18px 0 6px">Concepto</h3><p style="margin:0">${esc(s.concept)}</p>
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:18px 0 6px">Paquete por creador</h3><p style="margin:0">${esc(s.packagePerCreator)}</p>
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:18px 0 6px">Preguntas abiertas</h3><ul style="margin:0;padding-left:18px">${li(s.openQuestions)}</ul>
    <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:18px 0 6px">Riesgos</h3><ul style="margin:0;padding-left:18px">${li(s.risks)}</ul>
    <p style="margin:24px 0 0"><a href="${url}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600">Aprobar o rechazar en EBPR OS</a></p>
    <p style="margin:14px 0 0;font-size:11px;color:#9ca3af">Los números de seguidores vienen del roster y deben verificarse en el perfil antes de citarse a una marca. Esta propuesta no indica disponibilidad ni tarifas; eso lo definen Esther y Benjy.</p>
  </div>`;
}

export async function sendCampaignForApproval(args: { id: string; brand: string; brief?: string | null; suggestion: Suggestion; byName: string; byEmail: string }): Promise<{ ok: boolean; to: string[] }> {
  const to = CAMPAIGN_APPROVER_EMAILS.filter((e) => e !== args.byEmail.toLowerCase());
  const recipients = to.length ? to : CAMPAIGN_APPROVER_EMAILS;
  if (!isEmailConfigured()) return { ok: false, to: recipients };
  const html = suggestionHtml(args.suggestion, { brand: args.brand, brief: args.brief, byName: args.byName, id: args.id });
  const ok = await sendEmail({ to: recipients, cc: to.length && !CAMPAIGN_APPROVER_EMAILS.includes(args.byEmail.toLowerCase()) ? [args.byEmail] : undefined, replyTo: args.byEmail, subject: `Propuesta de campaña: ${args.brand} (para aprobación)`, html, fromName: "EBPR OS" });
  return { ok, to: recipients };
}
