import { requireUser } from "@/lib/auth";
import { canManageJournalists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { JournalistsClient } from "@/components/journalists/journalists-client";

export const metadata = { title: "Journalist Database" };
export const dynamic = "force-dynamic";

export default async function JournalistsPage() {
  const user = await requireUser();
  if (!canManageJournalists(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const journalists = await db.journalist.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  const total = await db.journalist.count({ where: { isActive: true } });

  // Get unique beats for filtering
  const beats = await db.journalist.findMany({
    where: { isActive: true, beat: { not: null } },
    select: { beat: true },
    distinct: ["beat"],
  });
  const uniqueBeats = beats.map((b) => b.beat!).filter(Boolean).sort();

  return (
    <>
      <PageHeader title="Journalist Database" subtitle={`${total} contacts`} />
      <JournalistsClient
        journalists={JSON.parse(JSON.stringify(journalists))}
        total={total}
        beats={uniqueBeats}
      />
    </>
  );
}
