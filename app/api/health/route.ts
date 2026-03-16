export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function parseDbInfo(): { dbHost: string; dbName: string } {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return { dbHost: url.hostname, dbName: url.pathname.replace("/", "") };
  } catch {
    return { dbHost: "unknown", dbName: "unknown" };
  }
}

type ColumnRow = { column_name: string };

/** Quick schema probe: check the columns that most commonly drift */
async function probeSchema(): Promise<{ ok: boolean; missing: string[] }> {
  const critical: Array<{ table: string; col: string }> = [
    { table: "User",    col: "password_hash" },
    { table: "User",    col: "is_active" },
    { table: "User",    col: "is_blocked" },
    { table: "Session", col: "token" },
    { table: "Session", col: "revoked_at" },
    { table: "Attempt", col: "status" },
  ];

  const missing: string[] = [];
  for (const { table, col } of critical) {
    try {
      const rows = await prisma.$queryRaw<ColumnRow[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
          AND column_name = ${col}
      `;
      if (rows.length === 0) missing.push(`"${table}"."${col}"`);
    } catch {
      missing.push(`"${table}"."${col}" (query error)`);
    }
  }
  return { ok: missing.length === 0, missing };
}

export async function GET() {
  const { dbHost, dbName } = parseDbInfo();
  const env = process.env.VERCEL_ENV || "local";
  try {
    await prisma.$queryRaw`SELECT 1`;
    const schema = await probeSchema();
    const status = schema.ok ? "ok" : "drift_detected";
    const httpCode = schema.ok ? 200 : 503;
    return NextResponse.json(
      {
        ok: schema.ok,
        timestamp: new Date().toISOString(),
        db: "ok",
        schema: status,
        ...(schema.missing.length > 0 ? { schemaMissing: schema.missing } : {}),
        dbHost,
        dbName,
        env,
      },
      { status: httpCode }
    );
  } catch {
    return NextResponse.json(
      { ok: false, timestamp: new Date().toISOString(), db: "error", schema: "unknown", dbHost, dbName, env },
      { status: 500 }
    );
  }
}
