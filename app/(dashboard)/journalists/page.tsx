import { requireUser } from "@/lib/auth";
import { canManageJournalists } from "@/lib/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/header";
import { JournalistsClient } from "@/components/journalists/journalists-client";
import { journalistWhere } from "@/app/api/journalists/_shared";

export const metadata = { title: "Journalist Database" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SearchParams = { search?: string; beat?: string; page?: string };

export default async function JournalistsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  if (!canManageJournalists(user)) {
    return <p className="text-ink-muted py-10 text-center">Access restricted.</p>;
  }

  const search = (searchParams.search ?? "").trim();
  const beat = (searchParams.beat ?? "").trim();
  const pageRaw = parseInt(searchParams.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  // Filtering happens in the database so a ~5,000-row list stays searchable
  const where = journalistWhere({ search, beat });

  const [journalists, matching, total, beatRows] = await Promise.all([
    db.journalist.findMany({
      where,
      orderBy: { name: "asc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.journalist.count({ where }),
    db.journalist.count({ where: { isActive: true } }),
    db.journalist.findMany({
      where: { isActive: true, beat: { not: null } },
      select: { beat: true },
      distinct: ["beat"],
      orderBy: { beat: "asc" },
    }),
  ]);

  const beats = beatRows.map((b) => b.beat).filter((b): b is string => !!b);

  return (
    <>
      <PageHeader title="Journalist Database" subtitle={`${total} contacts`} />
      <JournalistsClient
        journalists={journalists.map((j) => ({
          id: j.id,
          name: j.name,
          email: j.email,
          outlet: j.outlet,
          beat: j.beat,
          phone: j.phone,
          city: j.city,
          country: j.country,
          language: j.language,
          notes: j.notes,
          tags: j.tags,
        }))}
        matching={matching}
        total={total}
        beats={beats}
        page={page}
        pageSize={PAGE_SIZE}
        initialSearch={search}
        initialBeat={beat}
      />
    </>
  );
}
