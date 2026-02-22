export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let hasPasswordHash = false;
  let hasIsActive = false;

  try {
    const cols: Array<{ column_name: string }> = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User'
    `;
    const colNames = cols.map((c) => c.column_name);
    hasPasswordHash = colNames.includes("passwordHash");
    hasIsActive = colNames.includes("isActive");
  } catch (_) {}

  return NextResponse.json({
    ok: true,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAdminSeedEmail: !!process.env.ADMIN_SEED_EMAIL,
    hasAdminSeedPassword: !!process.env.ADMIN_SEED_PASSWORD,
    hasPasswordHash,
    hasIsActive,
  });
}
