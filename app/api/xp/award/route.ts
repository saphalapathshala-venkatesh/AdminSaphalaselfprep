export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import { awardContentXp } from "@/lib/xpEngine";

// Internal hook for awarding XP for content completion.
// Expects: { userId, sourceType, sourceId, baseXp, watchPercent? }
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, sourceType, sourceId, baseXp, watchPercent } = body;

    if (!userId || !sourceType || !sourceId || baseXp === undefined) {
      return NextResponse.json({ error: "userId, sourceType, sourceId, baseXp are required" }, { status: 400 });
    }

    const validTypes = ["VIDEO", "TEST", "FLASHCARD", "HTML"];
    if (!validTypes.includes(sourceType)) {
      return NextResponse.json({ error: `sourceType must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    // Only allow users to award XP for themselves, or admins for any user
    if (userId !== user.id && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await awardContentXp(
      userId,
      sourceType as "VIDEO" | "TEST" | "FLASHCARD" | "HTML",
      sourceId,
      Number(baseXp),
      watchPercent !== undefined ? Number(watchPercent) : 100,
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("XP award POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
