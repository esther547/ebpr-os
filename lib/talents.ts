/**
 * Talents: the roster EB Management exports (EBM_Roster_*.json) plus Esther's own list, kept as one table.
 * Dedupe when importing: ebmId → Instagram handle → normalized name. Nothing is invented: follower numbers
 * come from the source and carry a "last verified" date.
 */
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

import { TIERS } from "@/lib/talent-tiers";
export { TIERS, TIER_LABELS, type Tier } from "@/lib/talent-tiers";

/** Who sees Talentos: the agency team plus the EBM people who sell brand deals. */
export const TALENT_EXTRA_EMAILS = ["benjy@ebmanagement.io", "clara@ebmanagement.io", "aevans@ebmanagement.io", "ayax@ebmanagement.io", "carolina@ebmanagement.io"];
export const CAMPAIGN_APPROVER_EMAILS = ["esther@ebmanagement.io", "benjy@ebmanagement.io"];
export const canUseTalents = (u: SessionUser) => ["SUPER_ADMIN", "STRATEGIST", "SELLER"].includes(u.role) || TALENT_EXTRA_EMAILS.includes((u.email ?? "").toLowerCase());
export const canApproveCampaigns = (u: SessionUser) => CAMPAIGN_APPROVER_EMAILS.includes((u.email ?? "").toLowerCase());

export const nameKey = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export const handleKey = (h: string | null | undefined) => (h ?? "").toLowerCase().replace(/^@/, "").replace(/\s+/g, "").trim() || null;

export type TalentInput = {
  ebmId?: string | null; name: string; tier?: string | null; source?: string | null; type?: string | null; country?: string | null; location?: string | null; age?: number | null;
  languages?: string[]; verticals?: string[]; instagramHandle?: string | null; instagramUrl?: string | null; instagramFollowers?: number | null;
  tiktokHandle?: string | null; tiktokUrl?: string | null; tiktokFollowers?: number | null; youtubeHandle?: string | null; youtubeFollowers?: number | null;
  totalReach?: number | null; pastBrands?: string[]; notes?: string | null; lastVerifiedAt?: Date | null;
};

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

/** Normalize one roster record (EBM JSON shape or our own) into TalentInput. */
export function talentFromRecord(r: Record<string, unknown>): TalentInput | null {
  const name = clean(r.name); if (!name) return null;
  return {
    ebmId: clean(r.ebmId), name, tier: clean(r.tier), source: clean(r.source), type: clean(r.type), country: clean(r.country), location: clean(r.location), age: num(r.age),
    languages: list(r.languages), verticals: list(r.verticals),
    instagramHandle: clean(r.instagramHandle), instagramUrl: clean(r.instagramUrl), instagramFollowers: num(r.instagramFollowers),
    tiktokHandle: clean(r.tiktokHandle), tiktokUrl: clean(r.tiktokUrl), tiktokFollowers: num(r.tiktokFollowers),
    youtubeHandle: clean(r.youtubeHandle), youtubeFollowers: num(r.youtubeFollowers),
    totalReach: num(r.totalReach), pastBrands: list(r.pastBrands), notes: clean(r.notes),
  };
}

/** Find the existing talent a record refers to (same EBM id, same Instagram handle, or same name). */
export async function findDuplicate(t: TalentInput): Promise<{ id: string; name: string; how: string } | null> {
  if (t.ebmId) { const x = await db.talent.findUnique({ where: { ebmId: t.ebmId }, select: { id: true, name: true } }); if (x) return { ...x, how: "ebmId" }; }
  const h = handleKey(t.instagramHandle);
  if (h) { const all = await db.talent.findMany({ where: { instagramHandle: { not: null } }, select: { id: true, name: true, instagramHandle: true } }); const x = all.find((a) => handleKey(a.instagramHandle) === h); if (x) return { id: x.id, name: x.name, how: "instagram" }; }
  const x = await db.talent.findUnique({ where: { nameKey: nameKey(t.name) }, select: { id: true, name: true } });
  return x ? { ...x, how: "name" } : null;
}

/** Upsert a batch: new talents are created; duplicates only gain missing fields (never overwrite a filled one). */
export async function importTalents(records: TalentInput[], opts: { source: string; verifiedAt?: Date | null }): Promise<{ created: number; merged: number; mergedNames: string[] }> {
  let created = 0, merged = 0; const mergedNames: string[] = [];
  for (const t of records) {
    const dup = await findDuplicate(t);
    const fill = <T,>(cur: T | null | undefined, next: T | null | undefined) => (cur === null || cur === undefined || (Array.isArray(cur) && cur.length === 0) || cur === "" ? next ?? cur ?? null : cur);
    if (dup) {
      const cur = await db.talent.findUnique({ where: { id: dup.id } });
      if (!cur) continue;
      await db.talent.update({ where: { id: dup.id }, data: {
        ebmId: cur.ebmId ?? t.ebmId ?? null, type: fill(cur.type, t.type), country: fill(cur.country, t.country), location: fill(cur.location, t.location), age: fill(cur.age, t.age),
        languages: cur.languages.length ? cur.languages : t.languages ?? [], verticals: cur.verticals.length ? cur.verticals : t.verticals ?? [],
        instagramHandle: fill(cur.instagramHandle, t.instagramHandle), instagramUrl: fill(cur.instagramUrl, t.instagramUrl), instagramFollowers: fill(cur.instagramFollowers, t.instagramFollowers),
        tiktokHandle: fill(cur.tiktokHandle, t.tiktokHandle), tiktokUrl: fill(cur.tiktokUrl, t.tiktokUrl), tiktokFollowers: fill(cur.tiktokFollowers, t.tiktokFollowers),
        youtubeHandle: fill(cur.youtubeHandle, t.youtubeHandle), youtubeFollowers: fill(cur.youtubeFollowers, t.youtubeFollowers), totalReach: fill(cur.totalReach, t.totalReach),
        pastBrands: Array.from(new Set([...cur.pastBrands, ...(t.pastBrands ?? [])])), notes: cur.notes && t.notes && cur.notes !== t.notes ? `${cur.notes}\n\n[${opts.source}] ${t.notes}` : fill(cur.notes, t.notes),
        tier: cur.tier === "UNSET" && t.tier && (TIERS as readonly string[]).includes(t.tier) ? t.tier : cur.tier,
        source: cur.source && cur.source !== opts.source ? `${cur.source} + ${opts.source}` : cur.source ?? opts.source,
      } });
      merged++; mergedNames.push(`${t.name} (${dup.how})`);
    } else {
      await db.talent.create({ data: { ebmId: t.ebmId ?? null, name: t.name, nameKey: nameKey(t.name), tier: t.tier && (TIERS as readonly string[]).includes(t.tier) ? t.tier : "UNSET", source: opts.source, type: t.type ?? null, country: t.country ?? null, location: t.location ?? null, age: t.age ?? null,
        languages: t.languages ?? [], verticals: t.verticals ?? [], instagramHandle: t.instagramHandle ?? null, instagramUrl: t.instagramUrl ?? null, instagramFollowers: t.instagramFollowers ?? null,
        tiktokHandle: t.tiktokHandle ?? null, tiktokUrl: t.tiktokUrl ?? null, tiktokFollowers: t.tiktokFollowers ?? null, youtubeHandle: t.youtubeHandle ?? null, youtubeFollowers: t.youtubeFollowers ?? null,
        totalReach: t.totalReach ?? null, pastBrands: t.pastBrands ?? [], notes: t.notes ?? null, lastVerifiedAt: opts.verifiedAt ?? null } });
      created++;
    }
  }
  return { created, merged, mergedNames };
}

/** The roster as the model sees it: compact, nothing invented, nulls kept as nulls. */
export async function rosterForModel(filter?: { ids?: string[] }) {
  const rows = await db.talent.findMany({ where: { isActive: true, ...(filter?.ids?.length ? { id: { in: filter.ids } } : {}) }, orderBy: { name: "asc" } });
  return rows.map((t) => ({ name: t.name, tier: t.tier, type: t.type, country: t.country, location: t.location, age: t.age, languages: t.languages, verticals: t.verticals, instagramHandle: t.instagramHandle, instagramFollowers: t.instagramFollowers, tiktokHandle: t.tiktokHandle, tiktokFollowers: t.tiktokFollowers, youtubeHandle: t.youtubeHandle, youtubeFollowers: t.youtubeFollowers, totalReach: t.totalReach, pastBrands: t.pastBrands, notes: t.notes, lastVerifiedAt: t.lastVerifiedAt ? t.lastVerifiedAt.toISOString().slice(0, 10) : null }));
}
