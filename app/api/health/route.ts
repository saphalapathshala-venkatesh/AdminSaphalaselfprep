export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), db: "ok" });
  } catch {
    return NextResponse.json({ ok: false, timestamp: new Date().toISOString(), db: "error" }, { status: 500 });
  }
}
