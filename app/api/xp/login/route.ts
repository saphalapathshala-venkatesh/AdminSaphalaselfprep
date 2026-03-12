export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { handleDailyLogin } from "@/lib/xpEngine";

// Daily login XP hook. Call this on each authenticated page load or dedicated login event.
// Idempotent: awards XP only once per calendar day.
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId || user.id;

    if (userId !== user.id && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await handleDailyLogin(userId);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("XP login POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
