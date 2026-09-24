import type { Prisma } from "@prisma/client";

/** Only Esther sees anything financial (invoices, payments, amounts). Everyone else: hidden everywhere. */
const FINANCE_OWNER_EMAIL = "esther@ebmanagement.io";

export function canSeeFinance(user: { email?: string | null } | null | undefined): boolean {
  return (user?.email ?? "").toLowerCase() === FINANCE_OWNER_EMAIL;
}

/** Activity-log `where` fragment that removes invoice/payment/finance entries for everyone but Esther. */
export function financeActivityFilter(user: { email?: string | null } | null | undefined): Prisma.ActivityLogWhereInput {
  if (canSeeFinance(user)) return {};
  return {
    NOT: {
      OR: [
        { action: { startsWith: "invoice", mode: "insensitive" } },
        { action: { startsWith: "payment", mode: "insensitive" } },
        { action: { contains: "financ", mode: "insensitive" } },
        { description: { contains: "invoice", mode: "insensitive" } },
        { description: { contains: "payment", mode: "insensitive" } },
        { description: { contains: "factura", mode: "insensitive" } },
        { description: { contains: "pago", mode: "insensitive" } },
        { description: { contains: "$" } },
      ],
    },
  };
}
