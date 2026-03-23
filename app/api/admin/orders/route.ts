/**
 * GET /api/admin/orders
 *
 * Admin view of all PaymentOrders with pagination + status filter.
 * Returns masked sensitive fields — providerOrderId/paymentId exposed (not sensitive).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")));
  const skip     = (page - 1) * pageSize;
  const status   = searchParams.get("status") || "";
  const search   = searchParams.get("search") || "";

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { fullName: { contains: search, mode: "insensitive" } } },
      { providerOrderId: { contains: search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.paymentOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        status: true,
        provider: true,
        finalAmountPaise: true,
        grossPaise: true,
        discountPaise: true,
        currency: true,
        providerOrderId: true,
        providerPaymentId: true,
        purchaseId: true,
        paidAt: true,
        createdAt: true,
        legalAcceptedAt: true,
        user: { select: { id: true, email: true, fullName: true, mobile: true } },
        package: { select: { id: true, name: true, code: true } },
        coupon: { select: { id: true, code: true } },
        paymentConfig: { select: { id: true, displayName: true, environment: true } },
      },
    }),
    prisma.paymentOrder.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    summary: {
      total,
      paid:    await prisma.paymentOrder.count({ where: { status: "PAID" } }),
      pending: await prisma.paymentOrder.count({ where: { status: "PENDING" } }),
      failed:  await prisma.paymentOrder.count({ where: { status: "FAILED" } }),
    },
  });
}
