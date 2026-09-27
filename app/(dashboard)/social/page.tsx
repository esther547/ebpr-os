import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageSocial, normalizeIdeas, type SocialPostItem } from "@/lib/social-posts";
import { SocialBoard } from "@/components/social/social-board";

export const metadata = { title: "Redes sociales" };
export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const user = await requireUser();
  if (!canManageSocial(user)) redirect(ROLE_HOME[user.role]);

  const [rows, clients] = await Promise.all([
    db.socialPost.findMany({
      select: { id: true, clientId: true, title: true, ideas: true, notes: true, postedAt: true, order: true, client: { select: { id: true, name: true } } },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
    db.client.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const posts: SocialPostItem[] = rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    client: r.client,
    title: r.title,
    ideas: normalizeIdeas(r.ideas),
    notes: r.notes,
    postedAt: r.postedAt ? r.postedAt.toISOString() : null,
    order: r.order,
  }));

  return <SocialBoard initialPosts={posts} clients={clients} />;
}
