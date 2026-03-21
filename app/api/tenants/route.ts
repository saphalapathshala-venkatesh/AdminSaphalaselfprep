export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ data: [] });
}

export async function POST() {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
