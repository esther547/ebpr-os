import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// Temporary endpoint to re-seed clients and team — DELETE AFTER USE
const CLIENTS = [
  { name: "Hector Benitez", industry: "Entertainment" },
  { name: "Beta Mejia", industry: "Entertainment" },
  { name: "Marko", industry: "Entertainment" },
  { name: "Lele Pons", industry: "Digital Creator / Entertainment" },
  { name: "Perro Negro", industry: "Music / Club Brand" },
  { name: "Guaynaa", industry: "Music" },
  { name: "Delfina Saud", industry: "Fashion / Lifestyle" },
  { name: "Andres Gonzalez / Casa D / Rosario", industry: "Entertainment" },
  { name: "Ana Estela Cisneros (SIMG)", industry: "Music / Entertainment" },
  { name: "Sky Kings Music / Senzione", industry: "Music" },
  { name: "Juan de Montreal", industry: "Entertainment" },
  { name: "Daniela Fernandez", industry: "Entertainment" },
  { name: "Camila Guiribitey", industry: "Lifestyle / Influencer" },
  { name: "Oscar Alejandro", industry: "Entertainment" },
  { name: "Reykon", industry: "Music" },
  { name: "Pao Ruiz", industry: "Entertainment / Influencer" },
  { name: "Karime Pindter", industry: "Reality TV / Influencer" },
  { name: "Fer Ariza", industry: "Entertainment" },
  { name: "Lex Borrero", industry: "Entrepreneurship / Mental Health" },
  { name: "Linda Paola Ortiz", industry: "Entertainment" },
  { name: "Tatiana Guiribitey", industry: "Lifestyle" },
  { name: "Diego Urquijo", industry: "Entertainment" },
  { name: "Lya Mariella", industry: "Music / Entertainment" },
  { name: "Stephany Abasali", industry: "Beauty Pageant / Public Figure" },
  { name: "Charlie Rincon", industry: "Entertainment" },
  { name: "Grace Andrea Bonilla", industry: "Entertainment" },
  { name: "Avital Cohen", industry: "Lifestyle / Influencer" },
  { name: "Yeri Mua", industry: "Beauty / Influencer" },
  { name: "Daniella Duran", industry: "Entertainment" },
  { name: "Ana Velez", industry: "Entertainment" },
  { name: "We Shop U", industry: "E-Commerce / Retail" },
  { name: "Luis Alberto Posada", industry: "Entertainment" },
  { name: "Betania Guerra", industry: "Music / Entertainment" },
  { name: "Dirty Rabbit", industry: "Music / Nightlife" },
  { name: "Cary Garcia / Bella Ciarni", industry: "Beauty / Lifestyle" },
  { name: "Herlly", industry: "Entertainment" },
  { name: "Zena Ayoub", industry: "Entertainment" },
  { name: "Los Hitmen", industry: "Music" },
];

const TEAM = [
  { email: "ana@ebpublicrelations.com", name: "Ana Cristina Duran", role: "STRATEGIST" },
  { email: "paola@ebpublicrelations.com", name: "Paola Precilla", role: "STRATEGIST" },
  { email: "juanita@ebpublicrelations.com", name: "Juanita Rodríguez", role: "STRATEGIST" },
  { email: "tomas@ebpublicrelations.com", name: "Tomás Gutiérrez", role: "STRATEGIST" },
  { email: "vero@ebpublicrelations.com", name: "Verónica Fernández", role: "STRATEGIST" },
  { email: "michel@ebpublicrelations.com", name: "Michel Suarez", role: "STRATEGIST" },
  { email: "jessica@ebpublicrelations.com", name: "Jessica Mizrahi", role: "LEGAL" },
  { email: "lori@ebpublicrelations.com", name: "Lori", role: "FINANCE" },
  { email: "julieta@ebpublicrelations.com", name: "Julieta Cepedes", role: "RUNNER" },
  { email: "eliana@ebpublicrelations.com", name: "Eliana Cortes", role: "RUNNER" },
  { email: "juan@ebpublicrelations.com", name: "Juan Deseda", role: "RUNNER" },
  { email: "valentina@ebpublicrelations.com", name: "Valentina Castiglioni", role: "RUNNER" },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Must be SUPER_ADMIN" }, { status: 403 });
  }

  const results: Record<string, number> = {};

  // Create team members
  let teamCount = 0;
  for (const member of TEAM) {
    const existing = await db.user.findUnique({ where: { email: member.email } });
    if (!existing) {
      await db.user.create({
        data: {
          clerkId: `pending_${member.email}`,
          email: member.email,
          name: member.name,
          role: member.role as any,
        },
      });
      teamCount++;
    }
  }
  results.teamAdded = teamCount;

  // Create clients (no deliverables, no fake data)
  let clientCount = 0;
  for (const clientData of CLIENTS) {
    const slug = slugify(clientData.name);
    const existing = await db.client.findUnique({ where: { slug } });
    if (!existing) {
      await db.client.create({
        data: {
          name: clientData.name,
          slug,
          industry: clientData.industry,
          status: "ACTIVE",
          monthlyTarget: 7,
        },
      });
      clientCount++;
    }
  }
  results.clientsAdded = clientCount;

  return NextResponse.json({
    message: `Seeded ${clientCount} clients and ${teamCount} team members. No fake deliverables or events.`,
    results,
  });
}
