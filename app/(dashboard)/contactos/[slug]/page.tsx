import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { outreachWhere } from "@/lib/outreach";
import { canOpenDatabase, databaseBySlug, visibleContactTabs } from "@/lib/contact-lists";
import { PageHeader } from "@/components/layout/header";
import { ContactsTabs } from "@/components/contacts/contacts-tabs";
import { OutreachClient } from "@/components/outreach/outreach-client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;

export default async function ContactDatabasePage({ params, searchParams }: { params: { slug: string }; searchParams: { search?: string; category?: string; page?: string } }) {
  const database = databaseBySlug(params.slug);
  if (!database) notFound();
  const user = await requireUser();
  if (!canOpenDatabase(user, database)) redirect("/contactos");
  const list = database.list;
  const search = (searchParams.search ?? "").trim();
  const category = (searchParams.category ?? "").trim();
  const pageRaw = parseInt(searchParams.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const where = outreachWhere({ list, search, category });
  const [contacts, matching, total, categoryRows, sends, tagRows, mediosCount] = await Promise.all([
    db.outreachContact.findMany({ where, orderBy: { name: "asc" }, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    db.outreachContact.count({ where }),
    db.outreachContact.count({ where: { list, isActive: true } }),
    db.outreachContact.groupBy({ by: ["category"], where: { list, isActive: true }, _count: { _all: true }, orderBy: { category: "asc" } }),
    db.outreachSend.findMany({ where: { list }, orderBy: { sentAt: "desc" }, take: 8, select: { id: true, subject: true, categories: true, recipientCount: true, sentAt: true } }),
    db.outreachContact.findMany({ where: { list, isActive: true }, select: { tags: true } }),
    db.journalist.count({ where: { isActive: true } }),
  ]);
  const tagCounts = new Map<string, number>();
  for (const t of tagRows.flatMap((r) => r.tags)) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  const categories = categoryRows.filter((c) => c.category).map((c) => ({ name: c.category as string, count: c._count._all }));
  const basePath = `/contactos/${database.slug}`;
  return (
    <>
      <PageHeader title="Contactos" subtitle="Bases de datos de la agencia: medios, industria musical y las que vayamos sumando." />
      <ContactsTabs tabs={visibleContactTabs(user)} current={basePath} />
      <p className="mb-4 text-sm text-ink-secondary">{database.label} · {total} contactos. {database.description}</p>
      <OutreachClient
        list={list}
        basePath={basePath}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, company: c.company, role: c.role, category: c.category, phone: c.phone, city: c.city, country: c.country, notes: c.notes, tags: c.tags, isActive: c.isActive }))}
        matching={matching}
        total={total}
        categories={categories}
        tags={tags}
        mediosCount={mediosCount}
        page={page}
        pageSize={PAGE_SIZE}
        initialSearch={search}
        initialCategory={category}
        sends={sends.map((s) => ({ ...s, sentAt: s.sentAt.toISOString() }))}
      />
    </>
  );
}
