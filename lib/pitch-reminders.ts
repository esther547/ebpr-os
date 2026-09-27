/**
 * Pitch reminders for the strategists (Esther, Sept 27 2026).
 *
 * Two things the team must keep pitching without being asked:
 *   1. Industry events — the pitch window opens ~4 months out; under 2 months it is late.
 *   2. Client wish list — what each client asked for (StrategyItem.source = "CLIENT").
 *
 * Cadence (decided by the portal): every MONDAY the full list, every THURSDAY only what is
 * urgent (events under 60 days, wish-list items open for 14+ days). Sent by email when
 * GMAIL_USER/GMAIL_APP_PASSWORD are configured; always mirrored as an in-app notification.
 */
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { upcomingEvents } from "@/lib/industry-events";
import type { UpcomingEventItem } from "@/components/events/helpers";
import { dayKeyInTz, dayOfWeekForKey } from "@/components/runners/miami-time";

export const APP_URL = "https://os.ebpublicrelations.com";
export const EVENT_URGENT_DAYS = 60;
/** Under a week out there is nothing left to pitch; those events drop off the reminder. */
export const EVENT_MIN_DAYS = 7;
export const EVENT_WINDOW_DAYS = 120;
export const WISHLIST_STALE_DAYS = 14;

export type ReminderMode = "full" | "urgent";

export type WishlistLine = {
  clientId: string;
  clientName: string;
  itemId: string;
  title: string;
  category: string;
  status: string;
  ageDays: number;
};

export type PitchReminderData = {
  mode: ReminderMode;
  todayKey: string;
  eventsLate: UpcomingEventItem[];
  eventsSoon: UpcomingEventItem[];
  wishlist: { clientId: string; clientName: string; items: WishlistLine[] }[];
  wishlistStale: number;
};

function daysBetween(fromKey: string, to: Date): number {
  const a = new Date(`${fromKey}T00:00:00Z`).getTime();
  const b = new Date(`${dayKeyInTz(to)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Miami weekday of `now`: 1 = Monday … 7 = Sunday. */
export function miamiWeekday(now: Date): number {
  const d = dayOfWeekForKey(dayKeyInTz(now)); // 0 = Sunday
  return d === 0 ? 7 : d;
}

/** Which reminder (if any) the daily cron should send today. */
export function reminderModeForToday(now: Date): ReminderMode | null {
  const wd = miamiWeekday(now);
  if (wd === 1) return "full";
  if (wd === 4) return "urgent";
  return null;
}

export async function buildPitchReminder(mode: ReminderMode, now: Date = new Date()): Promise<PitchReminderData> {
  const todayKey = dayKeyInTz(now);
  const events = await upcomingEvents(EVENT_WINDOW_DAYS, now);
  const eventsLate = events.filter((e) => e.daysUntil >= EVENT_MIN_DAYS && e.daysUntil <= EVENT_URGENT_DAYS);
  const eventsSoon = mode === "full" ? events.filter((e) => e.daysUntil > EVENT_URGENT_DAYS) : [];

  const items = await db.strategyItem.findMany({
    where: {
      source: "CLIENT",
      status: { notIn: ["COMPLETED", "REJECTED"] },
      client: { status: "ACTIVE" },
    },
    select: {
      id: true, title: true, category: true, status: true, requestedAt: true, createdAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: [{ client: { name: "asc" } }, { requestedAt: "asc" }, { createdAt: "asc" }],
  });
  const lines: WishlistLine[] = items.map((it) => ({
    clientId: it.client.id,
    clientName: it.client.name,
    itemId: it.id,
    title: it.title,
    category: it.category,
    status: it.status,
    ageDays: Math.max(0, daysBetween(dayKeyInTz(it.requestedAt ?? it.createdAt), now)),
  }));
  const kept = mode === "full" ? lines : lines.filter((l) => l.ageDays >= WISHLIST_STALE_DAYS);
  const byClient = new Map<string, { clientId: string; clientName: string; items: WishlistLine[] }>();
  for (const l of kept) {
    const g = byClient.get(l.clientId) ?? { clientId: l.clientId, clientName: l.clientName, items: [] };
    g.items.push(l);
    byClient.set(l.clientId, g);
  }
  return {
    mode,
    todayKey,
    eventsLate,
    eventsSoon,
    wishlist: [...byClient.values()],
    wishlistStale: lines.filter((l) => l.ageDays >= WISHLIST_STALE_DAYS).length,
  };
}

// ─── Email ───────────────────────────────────────────────

function esc(v: string | null | undefined): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtKey(key: string, approx: boolean): string {
  const [y, m, d] = key.split("-").map(Number);
  return approx ? `${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

const CATEGORY_ES: Record<string, string> = {
  MEDIA_TARGET: "Medio / prensa",
  INFLUENCER: "Creador / colaboración",
  EVENT: "Evento",
  BRAND_OPPORTUNITY: "Marca",
  POSITIONING: "Posicionamiento",
  OTHER: "General",
};

export function pitchReminderSubject(d: PitchReminderData): string {
  const n = d.eventsLate.length + d.eventsSoon.length;
  const w = d.wishlist.reduce((s, c) => s + c.items.length, 0);
  return d.mode === "full"
    ? `Pitch de la semana: ${n} ${n === 1 ? "evento" : "eventos"} y ${w} ${w === 1 ? "pedido" : "pedidos"} de wish list`
    : `Pendientes urgentes de pitch: ${d.eventsLate.length} ${d.eventsLate.length === 1 ? "evento" : "eventos"} y ${w} ${w === 1 ? "pedido" : "pedidos"} de wish list`;
}

export function pitchReminderHtml(d: PitchReminderData): string {
  const eventRow = (e: UpcomingEventItem, late: boolean) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">
        <strong>${esc(e.name)}</strong>${e.city ? ` <span style="color:#6b7280">· ${esc(e.city)}</span>` : ""}
        ${e.url ? `<br><a href="${esc(e.url)}" style="font-size:12px;color:#2563eb">${esc(e.url)}</a>` : ""}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;white-space:nowrap;">${fmtKey(e.occursKey, e.day == null)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap;color:${late ? "#b91c1c" : "#374151"};font-weight:${late ? 700 : 400}">
        ${e.daysUntil} días${late ? " · ya debería estar pitcheado" : ""}
      </td>
    </tr>`;

  const eventsTable = (rows: UpcomingEventItem[], late: boolean) =>
    rows.length
      ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px">${rows.map((e) => eventRow(e, late)).join("")}</table>`
      : `<p style="font-size:13px;color:#6b7280;margin:0 0 8px">Nada por ahora.</p>`;

  const wishlist = d.wishlist.length
    ? d.wishlist
        .map(
          (c) => `
      <div style="margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">
          <a href="${APP_URL}/clients/${c.clientId}/strategy" style="color:#111;text-decoration:none">${esc(c.clientName)}</a>
          <span style="color:#6b7280;font-weight:400">· ${c.items.length} ${c.items.length === 1 ? "pedido" : "pedidos"}</span>
        </div>
        <ul style="margin:0;padding-left:18px">
          ${c.items
            .map(
              (it) => `<li style="font-size:13px;margin-bottom:3px">${esc(it.title)}
                <span style="color:#6b7280;font-size:12px">· ${esc(CATEGORY_ES[it.category] ?? it.category)} · ${
                  it.ageDays >= WISHLIST_STALE_DAYS
                    ? `<span style="color:#b91c1c;font-weight:700">${it.ageDays} días sin cerrar</span>`
                    : `hace ${it.ageDays} ${it.ageDays === 1 ? "día" : "días"}`
                }</span></li>`
            )
            .join("")}
        </ul>
      </div>`
        )
        .join("")
    : `<p style="font-size:13px;color:#6b7280;margin:0">No hay pedidos abiertos en los wish lists. 🎉</p>`;

  const intro =
    d.mode === "full"
      ? "Arranque de semana: esto es lo que hay que estar pitcheando. Eventos con menos de 2 meses ya deberían tener pitch enviado; los de 2 a 4 meses se empiezan ahora."
      : "Recordatorio de mitad de semana: solo lo urgente. Eventos con menos de 2 meses y pedidos de clientes con más de 2 semanas sin cerrar.";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
<div style="max-width:640px;margin:0 auto;background:#fff">
  <div style="background:#0a0a0a;color:#fff;padding:22px 28px">
    <div style="font-size:16px;font-weight:600;letter-spacing:2px">EB PUBLIC RELATIONS</div>
    <div style="font-size:12px;color:#999;margin-top:4px">${d.mode === "full" ? "Pitch de la semana" : "Pendientes urgentes de pitch"} · ${fmtKey(d.todayKey, false)}</div>
  </div>
  <div style="padding:26px 28px">
    <p style="font-size:14px;color:#444;margin:0 0 20px">${intro}</p>

    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#888;border-bottom:1px solid #eee;padding-bottom:6px;margin-bottom:10px">
      Eventos · ya deberían estar pitcheados (menos de ${EVENT_URGENT_DAYS} días)
    </div>
    ${eventsTable(d.eventsLate, true)}

    ${
      d.mode === "full"
        ? `<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#888;border-bottom:1px solid #eee;padding-bottom:6px;margin:18px 0 10px">
      Eventos · empezar a pitchear ahora (${EVENT_URGENT_DAYS} a ${EVENT_WINDOW_DAYS} días)
    </div>
    ${eventsTable(d.eventsSoon, false)}`
        : ""
    }

    <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#888;border-bottom:1px solid #eee;padding-bottom:6px;margin:18px 0 10px">
      Wish list de los clientes${d.mode === "urgent" ? ` · abiertos ${WISHLIST_STALE_DAYS}+ días` : ""}
    </div>
    ${wishlist}

    <p style="margin-top:22px">
      <a href="${APP_URL}/events" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600;margin-right:8px">Calendario de eventos</a>
      <a href="${APP_URL}/priorities" style="display:inline-block;background:#fff;color:#0a0a0a;border:1px solid #0a0a0a;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600">Prioridades</a>
    </p>
  </div>
  <div style="background:#f9f9f9;padding:16px 28px;text-align:center;font-size:11px;color:#999">
    EBPR OS · recordatorio automático los lunes (completo) y jueves (urgente)
  </div>
</div></body></html>`;
}

export function pitchReminderText(d: PitchReminderData): string {
  const lines: string[] = [pitchReminderSubject(d), ""];
  lines.push(`EVENTOS (menos de ${EVENT_URGENT_DAYS} días, ya deberían estar pitcheados):`);
  for (const e of d.eventsLate) lines.push(`- ${e.name} · ${fmtKey(e.occursKey, e.day == null)} · ${e.daysUntil} días`);
  if (d.mode === "full") {
    lines.push("", `EVENTOS (empezar ahora, ${EVENT_URGENT_DAYS}-${EVENT_WINDOW_DAYS} días):`);
    for (const e of d.eventsSoon) lines.push(`- ${e.name} · ${fmtKey(e.occursKey, e.day == null)} · ${e.daysUntil} días`);
  }
  lines.push("", "WISH LIST:");
  for (const c of d.wishlist) {
    lines.push(`${c.clientName}:`);
    for (const it of c.items) lines.push(`  - ${it.title} (${it.ageDays} días)`);
  }
  lines.push("", `${APP_URL}/events · ${APP_URL}/priorities`);
  return lines.join("\n");
}

// ─── Sending ─────────────────────────────────────────────

export type PitchReminderResult = {
  mode: ReminderMode;
  recipients: string[];
  emailConfigured: boolean;
  emailSent: boolean;
  notifications: number;
  counts: { eventsLate: number; eventsSoon: number; wishlistClients: number; wishlistItems: number };
};

/** Emails every active strategist (and Esther) and drops the same reminder in their bell. */
export async function sendPitchReminders(mode: ReminderMode, now: Date = new Date()): Promise<PitchReminderResult> {
  const data = await buildPitchReminder(mode, now);
  const team = await db.user.findMany({
    where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } },
    select: { id: true, email: true },
  });
  const recipients = team.map((u) => u.email);
  const counts = {
    eventsLate: data.eventsLate.length,
    eventsSoon: data.eventsSoon.length,
    wishlistClients: data.wishlist.length,
    wishlistItems: data.wishlist.reduce((s, c) => s + c.items.length, 0),
  };
  const nothing = counts.eventsLate + counts.eventsSoon + counts.wishlistItems === 0;

  let emailSent = false;
  if (!nothing && isEmailConfigured() && recipients.length) {
    emailSent = await sendEmail({ to: recipients, subject: pitchReminderSubject(data), html: pitchReminderHtml(data), text: pitchReminderText(data) });
  }

  // In-app mirror, once per user per day/mode (the link doubles as the idempotency key).
  let notifications = 0;
  if (!nothing) {
    const link = `/events?pitch=${data.todayKey}-${mode}`;
    for (const u of team) {
      const exists = await db.notification.findFirst({ where: { userId: u.id, link }, select: { id: true } });
      if (exists) continue;
      await db.notification.create({
        data: {
          userId: u.id,
          type: "pitch_reminder",
          title: mode === "full" ? "Pitch de la semana" : "Pendientes urgentes de pitch",
          message: `${counts.eventsLate + counts.eventsSoon} eventos para pitchear · ${counts.wishlistItems} pedidos de wish list abiertos`,
          link,
        },
      });
      notifications++;
    }
  }

  return { mode, recipients, emailConfigured: isEmailConfigured(), emailSent, notifications, counts };
}
