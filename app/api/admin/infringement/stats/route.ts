export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

const EMPTY_STATS = { todayCount: 0, weekCount: 0, warning1: 0, warning2: 0, blocked: 0, recent: [] };

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  try {
    const [todayCount, weekCount, warning1, warning2, blocked, recent] = await Promise.all([
      prisma.infringementEvent.count({ where: { createdAt: { gte: todayStart } } }).catch((e) => {
        console.warn("[infringement/stats] infringementEvent.count(today) failed:", e?.message);
        return 0;
      }),
      prisma.infringementEvent.count({ where: { createdAt: { gte: weekStart } } }).catch((e) => {
        console.warn("[infringement/stats] infringementEvent.count(week) failed:", e?.message);
        return 0;
      }),
      prisma.user.count({ where: { infringementWarnings: 1, infringementBlocked: false } }).catch((e) => {
        console.warn("[infringement/stats] user.count(warning1) failed:", e?.message);
        return 0;
      }),
      prisma.user.count({ where: { infringementWarnings: 2, infringementBlocked: false } }).catch((e) => {
        console.warn("[infringement/stats] user.count(warning2) failed:", e?.message);
        return 0;
      }),
      prisma.user.count({ where: { infringementBlocked: true } }).catch((e) => {
        console.warn("[infringement/stats] user.count(blocked) failed:", e?.message);
        return 0;
      }),
      prisma.infringementEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true, email: true } } },
      }).catch((e) => {
        console.warn("[infringement/stats] infringementEvent.findMany failed:", e?.message);
        return [];
      }),
    ]);

    return NextResponse.json({ todayCount, weekCount, warning1, warning2, blocked, recent });
  } catch (err: any) {
    console.error("[infringement/stats] Unhandled error — returning empty stats:", err?.message || err);
    return NextResponse.json(EMPTY_STATS, { status: 200 });
  }
}
