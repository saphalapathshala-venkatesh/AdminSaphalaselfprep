export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;
  const search = searchParams.get("search") || "";
  const filter = searchParams.get("filter") || "all";

  try {
    const where: any = { role: "STUDENT" };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search, mode: "insensitive" } },
      ];
    }

    if (filter === "paid") {
      where.entitlements = { some: { status: "ACTIVE" } };
    } else if (filter === "free") {
      where.NOT = { entitlements: { some: { status: "ACTIVE" } } };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { entitlements: { where: { status: "ACTIVE" } } } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map(u => u.id);

    const [xpSums, lastAttempts, lastSessions] = await Promise.all([
      prisma.xpLedgerEntry.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _sum: { delta: true } }),
      prisma.attempt.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _max: { startedAt: true } }),
      prisma.session.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _max: { createdAt: true } }),
    ]);

    const xpMap = Object.fromEntries(xpSums.map(x => [x.userId, x._sum.delta || 0]));
    const attemptMap = Object.fromEntries(lastAttempts.map(a => [a.userId, a._max.startedAt]));
    const sessionMap = Object.fromEntries(lastSessions.map(s => [s.userId, s._max.createdAt]));

    const data = users.map(u => {
      const lastAttempt = attemptMap[u.id];
      const lastSession = sessionMap[u.id];
      let lastActiveAt = lastAttempt || lastSession || null;
      if (lastAttempt && lastSession) {
        lastActiveAt = new Date(lastAttempt) > new Date(lastSession) ? lastAttempt : lastSession;
      }
      return {
        ...u,
        totalXp: xpMap[u.id] || 0,
        lastActiveAt,
        activeEntitlements: u._count.entitlements,
      };
    });

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Learners GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
