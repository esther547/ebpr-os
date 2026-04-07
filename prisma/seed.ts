import { PrismaClient, UserRole, ClientStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ── Real EBPR client list (38 clients) ─────────────────────────────
const CLIENTS = [
  { name: "Hector Benitez", industry: "Entertainment", notes: "Pays at end of month" },
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("🌱 Seeding EBPR OS with real data...\n");

  // ── Real EBPR Team ──────────────────────────────────────────────
  console.log("👥 Creating team members...");

  const team = await Promise.all([
    // Strategy team
    prisma.user.upsert({
      where: { email: "esther@ebpublicrelations.com" },
      update: { name: "Esther Beniflah", role: UserRole.SUPER_ADMIN },
      create: {
        clerkId: "seed_esther_beniflah",
        email: "esther@ebpublicrelations.com",
        name: "Esther Beniflah",
        role: UserRole.SUPER_ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: "ana@ebpublicrelations.com" },
      update: { name: "Ana Cristina Duran", role: UserRole.STRATEGIST },
      create: {
        clerkId: "seed_ana_duran",
        email: "ana@ebpublicrelations.com",
        name: "Ana Cristina Duran",
        role: UserRole.STRATEGIST,
      },
    }),
    prisma.user.upsert({
      where: { email: "paola@ebpublicrelations.com" },
      update: { name: "Paola Precilla", role: UserRole.STRATEGIST },
      create: {
        clerkId: "seed_paola_precilla",
        email: "paola@ebpublicrelations.com",
        name: "Paola Precilla",
        role: UserRole.STRATEGIST,
      },
    }),
    prisma.user.upsert({
      where: { email: "juanita@ebpublicrelations.com" },
      update: { name: "Juanita Rodríguez", role: UserRole.STRATEGIST },
      create: {
        clerkId: "seed_juanita_rodriguez",
        email: "juanita@ebpublicrelations.com",
        name: "Juanita Rodríguez",
        role: UserRole.STRATEGIST,
      },
    }),
    prisma.user.upsert({
      where: { email: "tomas@ebpublicrelations.com" },
      update: { name: "Tomás Gutiérrez", role: UserRole.STRATEGIST },
      create: {
        clerkId: "seed_tomas_gutierrez",
        email: "tomas@ebpublicrelations.com",
        name: "Tomás Gutiérrez",
        role: UserRole.STRATEGIST,
      },
    }),
    prisma.user.upsert({
      where: { email: "vero@ebpublicrelations.com" },
      update: { name: "Verónica Fernández", role: UserRole.STRATEGIST },
      create: {
        clerkId: "seed_vero_fernandez",
        email: "vero@ebpublicrelations.com",
        name: "Verónica Fernández",
        role: UserRole.STRATEGIST,
      },
    }),
    prisma.user.upsert({
      where: { email: "michel@ebpublicrelations.com" },
      update: { name: "Michel Suarez", role: UserRole.STRATEGIST },
      create: {
        clerkId: "seed_michel_suarez",
        email: "michel@ebpublicrelations.com",
        name: "Michel Suarez",
        role: UserRole.STRATEGIST,
      },
    }),
    // Legal
    prisma.user.upsert({
      where: { email: "jessica@ebpublicrelations.com" },
      update: { name: "Jessica Mizrahi", role: UserRole.LEGAL },
      create: {
        clerkId: "seed_jessica_mizrahi",
        email: "jessica@ebpublicrelations.com",
        name: "Jessica Mizrahi",
        role: UserRole.LEGAL,
      },
    }),
    // Finance
    prisma.user.upsert({
      where: { email: "lori@ebpublicrelations.com" },
      update: { name: "Lori", role: UserRole.FINANCE },
      create: {
        clerkId: "seed_lori",
        email: "lori@ebpublicrelations.com",
        name: "Lori",
        role: UserRole.FINANCE,
      },
    }),
    // Runners
    prisma.user.upsert({
      where: { email: "julieta@ebpublicrelations.com" },
      update: { name: "Julieta Cepedes", role: UserRole.RUNNER },
      create: {
        clerkId: "seed_julieta_cepedes",
        email: "julieta@ebpublicrelations.com",
        name: "Julieta Cepedes",
        role: UserRole.RUNNER,
      },
    }),
    prisma.user.upsert({
      where: { email: "eliana@ebpublicrelations.com" },
      update: { name: "Eliana Cortes", role: UserRole.RUNNER },
      create: {
        clerkId: "seed_eliana_cortes",
        email: "eliana@ebpublicrelations.com",
        name: "Eliana Cortes",
        role: UserRole.RUNNER,
      },
    }),
    prisma.user.upsert({
      where: { email: "juan@ebpublicrelations.com" },
      update: { name: "Juan Deseda", role: UserRole.RUNNER },
      create: {
        clerkId: "seed_juan_deseda",
        email: "juan@ebpublicrelations.com",
        name: "Juan Deseda",
        role: UserRole.RUNNER,
      },
    }),
    prisma.user.upsert({
      where: { email: "valentina@ebpublicrelations.com" },
      update: { name: "Valentina Castiglioni", role: UserRole.RUNNER },
      create: {
        clerkId: "seed_valentina_castiglioni",
        email: "valentina@ebpublicrelations.com",
        name: "Valentina Castiglioni",
        role: UserRole.RUNNER,
      },
    }),
  ]);

  const [esther, ana, paola, juanita, tomas, vero] = team;
  const strategists = [esther, ana, paola, juanita, tomas, vero];

  console.log(`  ✓ ${team.length} team members`);

  // ── All 38 clients ─────────────────────────────────────────────
  console.log("\n🏢 Creating 38 clients...");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const createdClients: { id: string; name: string }[] = [];

  for (const [i, clientData] of CLIENTS.entries()) {
    const slug = slugify(clientData.name);

    // Ensure unique slug
    let finalSlug = slug;
    let attempt = 1;
    while (true) {
      const existing = await prisma.client.findUnique({
        where: { slug: finalSlug },
      });
      if (!existing) break;
      // If it already belongs to this seed run, just use it
      if (existing.name === clientData.name) {
        finalSlug = slug;
        break;
      }
      finalSlug = `${slug}-${attempt++}`;
    }

    const client = await prisma.client.upsert({
      where: { slug: finalSlug },
      update: {
        name: clientData.name,
        industry: clientData.industry,
        status: ClientStatus.ACTIVE,
      },
      create: {
        name: clientData.name,
        slug: finalSlug,
        industry: clientData.industry ?? null,
        status: ClientStatus.ACTIVE,
        monthlyTarget: 7,
        description: (clientData as any).notes ?? null,
      },
    });

    createdClients.push({ id: client.id, name: client.name });

    // Assign a strategist (round-robin across core 6)
    const strategist = strategists[i % strategists.length];

    // Create a campaign per client
    await prisma.campaign.upsert({
      where: {
        id: `seed_campaign_${client.id}`,
      },
      update: {},
      create: {
        id: `seed_campaign_${client.id}`,
        clientId: client.id,
        name: `${now.getFullYear()} Campaign`,
        status: "ACTIVE",
        ownerId: strategist.id,
        monthlyTarget: 7,
        objectives: [
          "Increase press coverage",
          "Secure brand partnerships",
          "Grow public profile",
        ],
      },
    });

    // Add 2 sample deliverables per client for the current month
    await prisma.deliverable.createMany({
      skipDuplicates: true,
      data: [
        {
          id: `seed_del_${client.id}_1`,
          clientId: client.id,
          campaignId: `seed_campaign_${client.id}`,
          title: "Press Placement — Major Outlet",
          type: "PRESS_PLACEMENT",
          status: i % 3 === 0 ? "COMPLETED" : i % 3 === 1 ? "OUTREACH" : "IDEA",
          assigneeId: strategist.id,
          month,
          year,
          outcome:
            i % 3 === 0
              ? "Feature published in major publication"
              : null,
          isClientVisible: true,
        },
        {
          id: `seed_del_${client.id}_2`,
          clientId: client.id,
          campaignId: `seed_campaign_${client.id}`,
          title: "Event Appearance",
          type: "EVENT_APPEARANCE",
          status: i % 4 === 0 ? "CONFIRMED" : "IDEA",
          assigneeId: strategist.id,
          month,
          year,
          isClientVisible: true,
        },
      ],
    });
  }

  console.log(`  ✓ ${createdClients.length} clients created`);

  // ── Sample agenda items for key clients ────────────────────────
  console.log("\n📅 Creating sample agenda items (runner assignments)...");

  const [julieta, eliana, juan, valentina] = team.slice(9);
  const runners = [julieta, eliana, juan, valentina];

  // Reykon client
  const reykon = createdClients.find((c) => c.name === "Reykon");
  const anaSIMG = createdClients.find((c) =>
    c.name.includes("SIMG") || c.name.includes("Cisneros")
  );
  const guaynaa = createdClients.find((c) => c.name === "Guaynaa");

  const agendaItems = [
    reykon && {
      runnerId: eliana.id,
      eventName: "Movistar Arena Bogotá — Concert",
      eventDate: new Date("2026-11-06T20:00:00"),
      clientId: reykon.id,
      location: "Bogotá, Colombia",
      status: "CONFIRMED",
      weekOf: new Date("2026-11-02"),
    },
    reykon && {
      runnerId: tomas.id,
      eventName: "Evento Louis Vuitton Miami",
      eventDate: new Date("2026-04-10T19:00:00"),
      clientId: reykon.id,
      location: "Miami, EEUU",
      status: "CONFIRMED",
      weekOf: new Date("2026-04-06"),
    },
    reykon && {
      runnerId: paola.id,
      eventName: "Perro Negro Miami",
      eventDate: new Date("2026-04-11T22:00:00"),
      clientId: reykon.id,
      location: "Miami, EEUU",
      status: "CONFIRMED",
      weekOf: new Date("2026-04-06"),
    },
    anaSIMG && {
      runnerId: juanita.id,
      eventName: "TELEMUNDO — Hoy Dia",
      eventDate: new Date("2026-01-16T10:00:00"),
      clientId: anaSIMG.id,
      location: "Telemundo Center, Miami",
      status: "SCHEDULED",
      weekOf: new Date("2026-01-12"),
    },
    anaSIMG && {
      runnerId: eliana.id,
      eventName: "Premios Lo Nuestro — Red Carpet",
      eventDate: new Date("2026-02-19T16:15:00"),
      clientId: anaSIMG.id,
      location: "Kaseya Center, Miami",
      status: "SCHEDULED",
      weekOf: new Date("2026-02-16"),
    },
    guaynaa && {
      runnerId: julieta.id,
      eventName: "Portada Esquire Colombia",
      eventDate: new Date("2026-01-23T12:00:00"),
      clientId: guaynaa.id,
      location: "Bogotá, Colombia",
      status: "CONFIRMED",
      weekOf: new Date("2026-01-19"),
    },
    guaynaa && {
      runnerId: julieta.id,
      eventName: "Rey Carnaval Calle 8 — Performance",
      eventDate: new Date("2026-03-15T17:00:00"),
      clientId: guaynaa.id,
      location: "Calle 8, Miami",
      status: "CONFIRMED",
      weekOf: new Date("2026-03-09"),
    },
  ].filter(Boolean) as {
    runnerId: string;
    eventName: string;
    eventDate: Date;
    clientId: string;
    location: string;
    status: string;
    weekOf: Date;
  }[];

  for (const item of agendaItems) {
    await prisma.runnerAssignment.create({ data: item as any });
  }

  console.log(`  ✓ ${agendaItems.length} agenda items created`);

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\n✅ Seed complete!");
  console.log(`   ${team.length} team members`);
  console.log(`   ${createdClients.length} clients (all active)`);
  console.log(`   ${createdClients.length * 2} deliverables (2 per client)`);
  console.log(`   ${agendaItems.length} agenda/runner assignments`);
  console.log("\n👉 Sign in as esther@ebpublicrelations.com to see the dashboard");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
