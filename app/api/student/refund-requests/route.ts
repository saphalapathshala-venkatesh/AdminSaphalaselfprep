/**
 * Student Refund Request API
 *
 * POST — student submits a refund request for a PAID order
 * GET  — student lists their own refund requests
 *
 * Rules:
 * - Order must be PAID and belong to the authenticated student
 * - Only one open refund request per order (REQUESTED / UNDER_REVIEW / APPROVED / PROCESSED)
 * - REJECTED or CANCELLED requests allow re-submission for the same order
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

const OPEN_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSED"] as const;

const VALID_REASON_CATEGORIES = [
  "CHANGED_MIND",
  "TECHNICAL_ISSUE",
  "CONTENT_NOT_AS_DESCRIBED",
  "DUPLICATE_PURCHASE",
  "COURSE_NOT_STARTED",
  "OTHER",
] as const;

// ── POST /api/student/refund-requests ────────────────────────────────────────
export async function POST(req: NextRequest) {
  const student = await getStudentUserFromRequest(req);
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { paymentOrderId, reasonCategory, reasonText, requestedPaise } = body;

  if (!paymentOrderId)   return NextResponse.json({ error: "paymentOrderId is required" }, { status: 400 });
  if (!reasonCategory || !VALID_REASON_CATEGORIES.includes(reasonCategory)) {
    return NextResponse.json({ error: `reasonCategory must be one of: ${VALID_REASON_CATEGORIES.join(", ")}` }, { status: 400 });
  }
  if (!reasonText?.trim()) return NextResponse.json({ error: "reasonText is required" }, { status: 400 });

  // Fetch the order — must be PAID and belong to this student
  const order = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    include: { package: { select: { id: true, name: true, code: true } } },
  });

  if (!order)                       return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== student.id)  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== "PAID")      return NextResponse.json({ error: "Only PAID orders are eligible for refund" }, { status: 400 });

  // Check for an existing open refund request on this order
  const existing = await prisma.refundRequest.findFirst({
    where: {
      paymentOrderId,
      status: { in: OPEN_STATUSES as unknown as any[] },
    },
    select: { id: true, status: true },
  });

  if (existing) {
    return NextResponse.json({
      error: "An open refund request already exists for this order",
      existingId: existing.id,
      existingStatus: existing.status,
    }, { status: 409 });
  }

  const refundReq = await prisma.refundRequest.create({
    data: {
      paymentOrderId,
      userId:         student.id,
      packageId:      order.package?.id      ?? order.packageId ?? null,
      packageName:    order.package?.name    ?? null,
      packageCode:    order.package?.code    ?? null,
      paidPaise:      order.finalAmountPaise,
      requestedPaise: requestedPaise != null ? parseInt(requestedPaise) : null,
      reasonCategory,
      reasonText:     reasonText.trim(),
      status:         "REQUESTED",
    },
    select: {
      id: true, status: true, reasonCategory: true, reasonText: true,
      paidPaise: true, requestedPaise: true, packageName: true,
      createdAt: true, updatedAt: true,
    },
  });

  return NextResponse.json({ data: refundReq }, { status: 201 });
}

// ── GET /api/student/refund-requests ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const student = await getStudentUserFromRequest(req);
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip  = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.refundRequest.findMany({
      where:   { userId: student.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, status: true, reasonCategory: true, reasonText: true,
        paidPaise: true, requestedPaise: true, approvedPaise: true,
        packageName: true, packageCode: true,
        adminNote: true,
        reviewedAt: true, processedAt: true,
        createdAt: true, updatedAt: true,
        paymentOrder: { select: { id: true, finalAmountPaise: true, paidAt: true } },
      },
    }),
    prisma.refundRequest.count({ where: { userId: student.id } }),
  ]);

  return NextResponse.json({ data: rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}
