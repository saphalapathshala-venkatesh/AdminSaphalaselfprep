export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ message: "Not implemented yet" }, { status: 501 });
}
