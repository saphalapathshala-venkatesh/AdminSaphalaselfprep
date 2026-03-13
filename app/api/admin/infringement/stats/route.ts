import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    todayCount,
    weekCount,
    warning1,
    warning2,
    blocked,
    recent,
  ] = await Promise.all([
    prisma.infringementEvent.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.infringementEvent.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.user.count({ where: { infringementWarnings: 1, infringementBlocked: false } }),
    prisma.user.count({ where: { infringementWarnings: 2, infringementBlocked: false } }),
    prisma.user.count({ where: { infringementBlocked: true } }),
    prisma.infringementEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({ todayCount, weekCount, warning1, warning2, blocked, recent });
}
