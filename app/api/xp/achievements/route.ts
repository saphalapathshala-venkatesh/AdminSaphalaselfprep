export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || user.id;

  if (userId !== user.id && !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: "asc" },
    });
    return NextResponse.json({ data: achievements });
  } catch (err) {
    console.error("XP achievements GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
