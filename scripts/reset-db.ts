import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting database (DROP + CREATE public schema)...");
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  console.log("Database reset complete. Run 'npm run db:setup' to recreate tables and seed.");
}

main()
  .catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
