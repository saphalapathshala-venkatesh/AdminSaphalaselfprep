import { prisma } from "./prisma";
import { runStartupSchemaCheck } from "./startupCheck";

let initialized = false;

export async function ensureDbReady() {
  if (initialized) return;

  try {
    await prisma.$queryRaw`SELECT 1`;
    initialized = true;
    // Run schema check once on first successful DB connection (fire-and-forget)
    runStartupSchemaCheck().catch((e) =>
      console.error("[db-init] Startup schema check error:", e)
    );
  } catch (e) {
    console.error("[db-init] DB init failed", e);
  }
}
