import { PrismaClient } from "@prisma/client";

const BLOCKED = ["replit", "helium", "localhost", "127.0.0.1"];

function validateDbUrl() {
  if (process.env.ENFORCE_NEON_ONLY === "true") {
    const url = (process.env.DATABASE_URL || "").toLowerCase();
    for (const p of BLOCKED) {
      if (url.includes(p)) {
        throw new Error(`[DB] Refusing non-Neon DATABASE_URL. Contains "${p}". Use Neon connection string only.`);
      }
    }
  }
}

validateDbUrl();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

// Cache the instance on globalThis in ALL environments.
// In development this prevents HMR from creating multiple PrismaClient instances.
// In production (Vercel warm instances) this prevents per-request connection leaks.
globalForPrisma.prisma = prisma;

export default prisma;
