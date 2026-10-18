import { z } from "zod";
import { TIERS } from "@/lib/talent-tiers";

/** Validation for the add/edit talent forms. */
const optText = z.string().trim().max(1000).optional().nullable().transform((v) => (v ? v : null));
const optInt = z.union([z.number(), z.string()]).optional().nullable().transform((v) => { if (v === null || v === undefined || v === "") return null; const n = typeof v === "number" ? v : Number(String(v).replace(/[,.\s]/g, "")); return Number.isFinite(n) ? Math.round(n) : null; });
const strList = z.union([z.array(z.string()), z.string()]).optional().nullable().transform((v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;\n]/) : []).map((x) => x.trim()).filter(Boolean));
export const talentSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  ebmId: optText, tier: z.enum(TIERS).optional(), type: optText, country: optText, location: optText, age: optInt,
  languages: strList, verticals: strList,
  instagramHandle: optText, instagramUrl: optText, instagramFollowers: optInt, tiktokHandle: optText, tiktokUrl: optText, tiktokFollowers: optInt,
  youtubeHandle: optText, youtubeFollowers: optInt, totalReach: optInt, pastBrands: strList, notes: z.string().trim().max(10000).optional().nullable().transform((v) => (v ? v : null)),
  lastVerifiedAt: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
});
