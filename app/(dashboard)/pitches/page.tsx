import { redirect } from "next/navigation";
import { ROLE_HOME, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canUsePitches, pitchSelect, serializePitch } from "@/lib/press-pitches";
import { PitchesBoard } from "@/components/pitches/pitches-board";

export const metadata = { title: "Pitches de prensa" };
export const dynamic = "force-dynamic";

export default async function PitchesPage() {
  const user = await requireUser();
  if (!canUsePitches(user)) redirect(ROLE_HOME[user.role]);
  const [rows, clients, publicists] = await Promise.all([
    db.pressPitch.findMany({ select: pitchSelect, orderBy: { pitchedAt: "desc" }, take: 500 }),
    db.client.findMany({ where: { status: { in: ["ACTIVE", "PROSPECT", "PAUSED"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({ where: { isActive: true, role: { in: ["SUPER_ADMIN", "STRATEGIST"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return <PitchesBoard initialPitches={rows.map(serializePitch)} clients={clients} publicists={publicists} currentUserId={user.id} isAdmin={user.role === "SUPER_ADMIN"} />;
}
