export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const learner = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!learner) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [entitlements, attempts, xpHistory, purchases, xpTotal] = await Promise.all([
      prisma.userEntitlement.findMany({
        where: { userId: params.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, productCode: true, status: true, validUntil: true, createdAt: true },
      }),
      prisma.attempt.findMany({
        where: { userId: params.id },
        orderBy: { startedAt: "desc" },
        take: 20,
        select: { id: true, testId: true, scorePct: true, startedAt: true, submittedAt: true, correctCount: true, wrongCount: true, test: { select: { title: true } } },
      }),
      prisma.xpLedgerEntry.findMany({
        where: { userId: params.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, delta: true, reason: true, createdAt: true },
      }),
      prisma.purchase.findMany({
        where: { userId: params.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { package: { select: { code: true, name: true } }, coupon: { select: { code: true } } },
      }),
      prisma.xpLedgerEntry.aggregate({ where: { userId: params.id }, _sum: { delta: true } }),
    ]);

    return NextResponse.json({
      data: {
        ...learner,
        totalXp: xpTotal._sum.delta || 0,
        entitlements,
        attempts,
        xpHistory,
        purchases,
      },
    });
  } catch (err) {
    console.error("Learner profile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
