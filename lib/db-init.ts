import { prisma } from "./prisma";

let initialized = false;

export async function ensureDbReady() {
  if (initialized) return;

  try {
    await prisma.$queryRaw`SELECT 1`;
    initialized = true;
  } catch (e) {
    console.error("DB init failed", e);
  }
}
