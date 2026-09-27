// "Redes sociales": shared types/helpers for the social posts board.
import type { SessionUser } from "@/lib/auth";

export const IDEAS_PER_POST = 3;

export type SocialIdea = { text: string; done: boolean };

export type SocialPostItem = {
  id: string;
  clientId: string | null;
  client: { id: string; name: string } | null;
  title: string;
  ideas: SocialIdea[];
  notes: string | null;
  postedAt: string | null;
  order: number;
};

export function canManageSocial(user: SessionUser): boolean {
  return user.role === "SUPER_ADMIN" || user.role === "STRATEGIST";
}

/** Always exactly three slots, each with a string and a boolean. */
export function normalizeIdeas(raw: unknown): SocialIdea[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: SocialIdea[] = [];
  for (let i = 0; i < IDEAS_PER_POST; i++) {
    const it = (arr[i] ?? {}) as { text?: unknown; done?: unknown };
    const text = typeof it.text === "string" ? it.text.trim().slice(0, 1000) : "";
    out.push({ text, done: Boolean(it.done) && text.length > 0 });
  }
  return out;
}

export function ideasDone(ideas: SocialIdea[]): number {
  return ideas.filter((i) => i.done).length;
}

export function isReady(ideas: SocialIdea[]): boolean {
  return ideasDone(ideas) === IDEAS_PER_POST;
}

/** Fields returned by the API for one post. */
export const socialSelect = {
  id: true, clientId: true, title: true, ideas: true, notes: true, postedAt: true, order: true,
  client: { select: { id: true, name: true } },
} as const;
