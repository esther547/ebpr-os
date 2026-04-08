import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint to seed accounting data — DELETE AFTER USE
const ACCOUNTING_DATA = [
  { client: "Hector Benitez", contract: "SIGNED", contractEnd: "Month to Month", amount: 4000, invoiceDay: 25, dueDay: 31, billTo: "hector.benme@gmail.com", notes: "Pays at end of month" },
  { client: "Beta Mejia", contract: "NO CONTRACT NEEDED", contractEnd: "Month to Month", amount: 3000, invoiceDay: 10, dueDay: 15, billTo: "administracion@benmelegal.org", notes: "" },
  { client: "Marko", contract: "NO CONTRACT NEEDED", contractEnd: "Month to Month", amount: 3000, invoiceDay: 1, dueDay: 1, billTo: "admin@markoenweb.com", notes: "" },
  { client: "Lele Pons", contract: "SIGNED", contractEnd: "Month to Month", amount: 3500, invoiceDay: 15, dueDay: 19, billTo: "LELE PONS, LLC", notes: "" },
  { client: "Perro Negro", contract: "SIGNED", contractEnd: null, amount: 5000, invoiceDay: 20, dueDay: 22, billTo: "accounting@perronegromiami.com", notes: "" },
  { client: "Guaynaa", contract: "SIGNED", contractEnd: "Aug 18, 2025 - May 17, 2026", amount: 2000, invoiceDay: 15, dueDay: 19, billTo: "Guaynaapayments@gmail.com", notes: "GUAYNAA ENTERTAINMENT, LLC" },
  { client: "Delfina Saud", contract: "SIGNED", contractEnd: "Jan 5, 2026 - Jan 5, 2027", amount: 3000, invoiceDay: 17, dueDay: 12, billTo: "sauddelfi@gmail.com", notes: "" },
  { client: "Andres Gonzalez / Casa D / Rosario", contract: "SIGNED", contractEnd: "Jan 5, 2026 - Jan 5, 2027", amount: 3500, invoiceDay: 1, dueDay: 5, billTo: "Rweihe@bomapr.com", notes: "Issued to Rosario Wynwood Corp." },
  { client: "Ana Estela Cisneros (SIMG)", contract: "SIGNED", contractEnd: "Feb 1, 2026 - Jan 31, 2027", amount: 3000, invoiceDay: 25, dueDay: 1, billTo: "anacsimg99@gmail.com", notes: "anasimg@hotmail.com" },
  { client: "Sky Kings Music / Senzione", contract: "SIGNED", contractEnd: "Mar 3, 2026 (renewed)", amount: 3600, invoiceDay: 3, dueDay: 30, billTo: "info@skykingsmusic.com", notes: "SKY KINGS MUSIC, LLC" },
  { client: "Juan de Montreal", contract: "SENT", contractEnd: "Month to Month", amount: 4000, invoiceDay: 25, dueDay: 30, billTo: "juandemontreal@gmail.com", notes: "RENEWAL - WAITING ON SIGNATURE" },
  { client: "Daniela Fernandez", contract: "SENT", contractEnd: "Month to Month", amount: 4500, invoiceDay: 1, dueDay: 1, billTo: "Danifernazer@gmail.com", notes: "RENEWAL" },
  { client: "Camila Guiribitey", contract: "SENT", contractEnd: "Month to Month", amount: 4200, invoiceDay: 1, dueDay: 5, billTo: "dagmara@cgcamile.com", notes: "RESEND BOTH EMAILS + 3%" },
  { client: "Oscar Alejandro", contract: "SIGNED", contractEnd: "Month to Month", amount: 4000, invoiceDay: 1, dueDay: 5, billTo: "oscaralejandro14@gmail.com", notes: "ELOSCARALE INC" },
  { client: "Reykon", contract: "SIGNED", contractEnd: null, amount: 5000, invoiceDay: 25, dueDay: 1, billTo: "gerencia@thehacienda.com.co", notes: "" },
  { client: "Pao Ruiz", contract: "SIGNED", contractEnd: "Month to Month", amount: 2500, invoiceDay: 25, dueDay: 1, billTo: "paoruizcollab@gmail.com", notes: "" },
  { client: "Karime Pindter", contract: "SIGNED", contractEnd: "Feb 1, 2025 - Jan 31, 2027", amount: 3500, invoiceDay: 7, dueDay: 12, billTo: "Karime Pindter", notes: "" },
  { client: "Fer Ariza", contract: "SIGNED", contractEnd: "Jan 12, 2026 - Jan 11, 2027", amount: 4500, invoiceDay: 10, dueDay: 15, billTo: "managementferariza@gmail.com", notes: "Beto Music, S.A.S" },
  { client: "Lex Borrero", contract: "SIGNED", contractEnd: "Feb 5, 2026", amount: 4200, invoiceDay: 10, dueDay: 15, billTo: "lex@neon16.com", notes: "MCMXVI Investments, LLC" },
  { client: "Linda Paola Ortiz", contract: "SIGNED", contractEnd: "Month to Month - Starting Feb 15", amount: 4500, invoiceDay: 25, dueDay: 1, billTo: "Cata2034@gmail.com", notes: "PuTech Solutions USA LLC" },
  { client: "Tatiana Guiribitey", contract: "SIGNED", contractEnd: "Month to Month - Starting Feb 1", amount: 4200, invoiceDay: 25, dueDay: 1, billTo: "tatyg22@icloud.com", notes: "" },
  { client: "Diego Urquijo", contract: "SIGNED", contractEnd: "Month to Month", amount: 4500, invoiceDay: 25, dueDay: 1, billTo: "du@soydiegoup.com", notes: "vs@urpeintegralservices.co" },
  { client: "Lya Mariella", contract: "SIGNED", contractEnd: "Feb 2, 2026 - Apr 2, 2026", amount: 2000, invoiceDay: 9, dueDay: 9, billTo: "lya@lyamariellablog.com", notes: "Lya Mariella, LLC" },
  { client: "Stephany Abasali", contract: "SIGNED", contractEnd: "Feb 5, 2026 - Apr 5, 2026", amount: 3800, invoiceDay: 15, dueDay: 15, billTo: "adrianaly29@gmail.com", notes: "" },
  { client: "Charlie Rincon", contract: "SIGNED", contractEnd: "Feb 23, 2026 - Jun 23, 2026", amount: 4200, invoiceDay: 18, dueDay: 23, billTo: "charlierinconstylist@gmail.com", notes: "" },
  { client: "Grace Andrea Bonilla", contract: "SIGNED", contractEnd: "Mar 3, 2026 - Jul 3, 2026", amount: 4500, invoiceDay: 28, dueDay: 3, billTo: "graciebon04@gmail.com", notes: "" },
  { client: "Avital Cohen", contract: "SENT", contractEnd: "Apr 13, 2026 - Jun 13, 2026", amount: 5000, invoiceDay: 7, dueDay: 13, billTo: "avital@acholding.co", notes: "shirgolabry@gmail.com" },
  { client: "Yeri Mua", contract: "SIGNED", contractEnd: "Mar 9, 2026 - Month to Month", amount: 1600, invoiceDay: 1, dueDay: 9, billTo: "Reynayvc1@gmail.com", notes: "MUA ENTERTAINMENT S.A. DE C.V" },
  { client: "Daniella Duran", contract: "SIGNED", contractEnd: "Mar 11, 2026 - Month to Month", amount: 4200, invoiceDay: 3, dueDay: 11, billTo: "Daniella@didi-sports.com", notes: "Didi Sports, Inc" },
  { client: "Ana Velez", contract: "SIGNED", contractEnd: null, amount: 2000, invoiceDay: 1, dueDay: 1, billTo: "anamaria316@gmail.com", notes: "Ana Velez Creations INC" },
  { client: "We Shop U", contract: "SIGNED", contractEnd: "Mar 11, 2026 - Month to Month", amount: 900, invoiceDay: 1, dueDay: 1, billTo: "pr@weshopu.us", notes: "" },
  { client: "Luis Alberto Posada", contract: "SIGNED", contractEnd: "Mar 13, 2026", amount: 5000, invoiceDay: 11, dueDay: 16, billTo: "luisposada.us@gmail.com", notes: "" },
  { client: "Betania Guerra", contract: "SIGNED", contractEnd: "Mar 16, 2026", amount: 5000, invoiceDay: 5, dueDay: 9, billTo: "beplasticsurgery@gmail.com", notes: "" },
  { client: "Dirty Rabbit", contract: "SIGNED", contractEnd: "Mar 17, 2026 - Feb 17, 2027", amount: 3800, invoiceDay: 12, dueDay: 17, billTo: "the_dirty_rabbit@gmail.com", notes: "The Dirty Rabbit, LLC. Also: accountingclerk@dirtyrabbitgroup.com, accounting.tdr@thedirtyrabbitgroup.com, mary@thedirtyrabbitgroup.com" },
  { client: "Cary Garcia / Bella Ciarni", contract: "SIGNED", contractEnd: "Apr 1, 2026", amount: 4500, invoiceDay: 25, dueDay: 1, billTo: "cgarcia4@yahoo.com", notes: "Bella Ciarni" },
  { client: "Herlly", contract: "SIGNED", contractEnd: null, amount: 3000, invoiceDay: 1, dueDay: 1, billTo: "hmotions@hotmail.com", notes: "Herlly - Visa" },
  { client: "Zena Ayoub", contract: "SIGNED", contractEnd: "Jan 28 - Mar 28", amount: 700, invoiceDay: 25, dueDay: 28, billTo: "info@zenaayoub.com", notes: "" },
  { client: "Los Hitmen", contract: "SENT", contractEnd: "Apr 6, 2026 - Aug 6, 2026", amount: 4000, invoiceDay: 1, dueDay: 6, billTo: "loshitmen@gmail.com", notes: "Los Hitmen Global, LLC. Also: Management@lemovementprojects.com" },
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Must be SUPER_ADMIN" }, { status: 403 });
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  let contractsCreated = 0;
  let invoicesCreated = 0;
  const errors: string[] = [];

  for (const row of ACCOUNTING_DATA) {
    // Find the client
    const client = await db.client.findFirst({
      where: { name: { contains: row.client.split("/")[0].trim(), mode: "insensitive" } },
    });

    if (!client) {
      errors.push(`Client not found: ${row.client}`);
      continue;
    }

    // Update client description with billing notes
    if (row.notes || row.billTo) {
      await db.client.update({
        where: { id: client.id },
        data: {
          description: [row.billTo, row.notes, row.contractEnd ? `Contract: ${row.contractEnd}` : null]
            .filter(Boolean)
            .join(" | "),
        },
      });
    }

    // Create contract if none exists
    const existingContract = await db.contract.findFirst({ where: { clientId: client.id } });
    if (!existingContract) {
      const status = row.contract === "SIGNED" ? "SIGNED" : row.contract === "SENT" ? "SENT" : "DRAFT";
      await db.contract.create({
        data: {
          clientId: client.id,
          title: `${client.name} — PR Retainer 2026`,
          status,
          value: row.amount,
          billingReady: status === "SIGNED",
          signedAt: status === "SIGNED" ? new Date() : null,
          sentAt: status === "SENT" ? new Date() : null,
          notes: row.contractEnd ? `End: ${row.contractEnd}` : null,
        },
      });
      contractsCreated++;
    }

    // Create current month invoice if none exists
    const invoiceNumber = `EBPR-${currentYear}-${String(currentMonth).padStart(2, "0")}-${client.name.split(" ")[0].toUpperCase().substring(0, 4)}`;
    const existingInvoice = await db.invoice.findFirst({
      where: { clientId: client.id, invoiceNumber },
    });

    if (!existingInvoice) {
      const invoiceDate = new Date(currentYear, currentMonth - 1, row.invoiceDay);
      const dueDate = new Date(currentYear, currentMonth - 1, row.dueDay);
      // If due day is less than invoice day, it's next month
      if (row.dueDay < row.invoiceDay) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      const isPastDue = dueDate < now;

      await db.invoice.create({
        data: {
          clientId: client.id,
          invoiceNumber,
          amount: row.amount,
          status: isPastDue ? "OVERDUE" : "SENT",
          issuedAt: invoiceDate,
          dueDate,
          notes: row.billTo ? `Bill to: ${row.billTo}` : null,
        },
      });
      invoicesCreated++;
    }
  }

  return NextResponse.json({
    message: `Seeded ${contractsCreated} contracts and ${invoicesCreated} invoices`,
    contractsCreated,
    invoicesCreated,
    errors,
  });
}
