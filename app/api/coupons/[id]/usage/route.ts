export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const coupon = await prisma.coupon.findUnique({ where: { id: params.id } });
    if (!coupon) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [totalUses, uniqueUsersResult, recentPurchases] = await Promise.all([
      prisma.purchase.count({ where: { couponId: params.id } }),
      prisma.purchase.groupBy({ by: ["userId"], where: { couponId: params.id } }),
      prisma.purchase.findMany({
        where: { couponId: params.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { id: true, name: true, email: true } }, package: { select: { code: true, name: true } } },
      }),
    ]);

    return NextResponse.json({
      data: {
        totalUses,
        uniqueUsers: uniqueUsersResult.length,
        recentPurchases,
      },
    });
  } catch (err) {
    console.error("Coupon usage error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
