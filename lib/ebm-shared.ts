// EBM brand-deal tracker: client-safe constants and types.

export const LEAD_STATUSES = [
  "PROSPECT",
  "CONTACTED",
  "IN_TALKS",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "ON_HOLD",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  PROSPECT: "Prospecto",
  CONTACTED: "Contactado",
  IN_TALKS: "En conversación",
  PROPOSAL_SENT: "Propuesta enviada",
  NEGOTIATION: "Negociación",
  WON: "Cerrado ✓",
  LOST: "Perdido",
  ON_HOLD: "En pausa",
};

export const OPEN_STATUSES: LeadStatus[] = ["PROSPECT", "CONTACTED", "IN_TALKS", "PROPOSAL_SENT", "NEGOTIATION", "ON_HOLD"];

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

export type LeadUpdateItem = {
  id: string;
  text: string;
  status: string | null;
  createdAt: string;
  author: { id: string; name: string };
};

export type BrandLeadItem = {
  id: string;
  brand: string;
  clientId: string | null;
  client: { id: string; name: string } | null;
  ownerId: string;
  owner: { id: string; name: string };
  status: string;
  contactName: string | null;
  contactInfo: string | null;
  nextStep: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  updates: LeadUpdateItem[];
};

export const leadSelect = {
  id: true,
  brand: true,
  clientId: true,
  client: { select: { id: true, name: true } },
  ownerId: true,
  owner: { select: { id: true, name: true } },
  status: true,
  contactName: true,
  contactInfo: true,
  nextStep: true,
  nextFollowUpAt: true,
  notes: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  updates: {
    select: { id: true, text: true, status: true, createdAt: true, author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
} as const;
