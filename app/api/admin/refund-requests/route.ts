/**
 * GET /api/admin/refund-requests
 *
 * Lists all refund requests with pagination and filters.
 * Admin-only.
 *
 * Query params:
 *   status   — filter by RefundRequestStatus
 *   userId   — filter by specific student
 *   page     — pagination (default 1)
 *   limit    — page size (default 20, max 50)
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const userId = searchParams.get("userId") || "";
  const page   = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip   = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;

  const [rows, total] = await Promise.all([
    prisma.refundRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, status: true, reasonCategory: true,
        paidPaise: true, approvedPaise: true, requestedPaise: true,
        packageName: true, packageCode: true,
        createdAt: true, updatedAt: true, reviewedAt: true, processedAt: true,
        user:        { select: { id: true, name: true, email: true, mobile: true } },
        reviewedBy:  { select: { id: true, name: true, email: true } },
        processedBy: { select: { id: true, name: true, email: true } },
        paymentOrder: { select: { id: true, finalAmountPaise: true, paidAt: true, providerOrderId: true } },
      },
    }),
    prisma.refundRequest.count({ where }),
  ]);

  return NextResponse.json({ data: rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}
