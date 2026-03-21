export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function PUT() {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}
