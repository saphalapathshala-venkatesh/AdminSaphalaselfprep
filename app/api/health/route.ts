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

export async function GET() {
  const { dbHost, dbName } = parseDbInfo();
  const env = process.env.VERCEL_ENV || "local";
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), db: "ok", dbHost, dbName, env });
  } catch {
    return NextResponse.json({ ok: false, timestamp: new Date().toISOString(), db: "error", dbHost, dbName, env }, { status: 500 });
  }
}
