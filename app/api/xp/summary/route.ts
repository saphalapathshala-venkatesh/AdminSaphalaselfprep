export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { getXpSummary } from "@/lib/xpEngine";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || user.id;

  // Only admins can look up other users
  if (userId !== user.id && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await getXpSummary(userId);
    return NextResponse.json({ data: summary });
  } catch (err) {
    console.error("XP summary GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
