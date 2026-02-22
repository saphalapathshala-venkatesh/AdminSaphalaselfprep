export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAdminSeedEmail: !!process.env.ADMIN_SEED_EMAIL,
    hasAdminSeedPassword: !!process.env.ADMIN_SEED_PASSWORD,
  });
}
