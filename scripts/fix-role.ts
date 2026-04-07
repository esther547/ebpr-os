import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({
  datasources: {
    db: {
      url: process.argv[2] || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  // List all users
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "desc" },
  });

  console.log("Current users:");
  users.forEach((u) => console.log(`  ${u.name} (${u.email}) — ${u.role}`));

  // Find Esther's account and make it SUPER_ADMIN
  const esther = users.find(
    (u) => u.email.includes("esther") || u.email.includes("ebpr")
  );

  if (esther && esther.role !== "SUPER_ADMIN") {
    await db.user.update({
      where: { id: esther.id },
      data: { role: "SUPER_ADMIN" },
    });
    console.log(`\nUpdated ${esther.name} to SUPER_ADMIN`);
  } else if (esther) {
    console.log(`\n${esther.name} is already SUPER_ADMIN`);
  } else {
    // If can't find by email, just update the most recent user
    const latest = users[0];
    if (latest) {
      await db.user.update({
        where: { id: latest.id },
        data: { role: "SUPER_ADMIN" },
      });
      console.log(`\nUpdated ${latest.name} (most recent) to SUPER_ADMIN`);
    }
  }

  await db.$disconnect();
}

main().catch(console.error);
