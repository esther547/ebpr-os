import { Prisma } from "@prisma/client";

/** Build the journalist `where` used by both the API and the page. */
export function journalistWhere(opts: {
  search?: string | null;
  beat?: string | null;
  tags?: string[];
  includeInactive?: boolean;
}): Prisma.JournalistWhereInput {
  const where: Prisma.JournalistWhereInput = {};
  if (!opts.includeInactive) where.isActive = true;

  const search = opts.search?.trim();
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { outlet: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
    ];
  }
  const beat = opts.beat?.trim();
  if (beat) where.beat = { equals: beat, mode: "insensitive" };

  const tags = (opts.tags ?? []).map((t) => t.trim()).filter(Boolean);
  if (tags.length) {
    // Match a journalist whose beat OR tags overlap the requested tags (used for press-release targeting)
    where.AND = [
      {
        OR: [
          { tags: { hasSome: tags } },
          { beat: { in: tags, mode: "insensitive" } },
        ],
      },
    ];
  }
  return where;
}
