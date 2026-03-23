/**
 * GET  /api/admin/refund-requests/[id]  — fetch one refund request
 * PUT  /api/admin/refund-requests/[id]  — update status / admin decision
 *
 * Valid status transitions (enforced at application level):
 *   REQUESTED     → UNDER_REVIEW | REJECTED | CANCELLED
 *   UNDER_REVIEW  → APPROVED | REJECTED | CANCELLED
 *   APPROVED      → PROCESSED | FAILED | CANCELLED
 *   PROCESSED     — terminal (no further updates)
 *   REJECTED      — terminal
 *   FAILED        → APPROVED (retry)
 *   CANCELLED     — terminal
 *
 * This phase does NOT trigger gateway refund execution.
 * approvedPaise is recorded for use in the future processing phase.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

type Status =
  | "REQUESTED" | "UNDER_REVIEW" | "APPROVED"
  | "REJECTED"  | "PROCESSED"   | "FAILED" | "CANCELLED";

const TERMINAL: Status[] = ["PROCESSED", "REJECTED", "CANCELLED"];

const ALLOWED_TRANSITIONS: Record<Status, Status[]> = {
  REQUESTED:    ["UNDER_REVIEW", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED:     ["PROCESSED", "FAILED", "CANCELLED"],
  FAILED:       ["APPROVED"],
  PROCESSED:    [],
  REJECTED:     [],
  CANCELLED:    [],
};

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rr = await prisma.refundRequest.findUnique({
    where: { id: params.id },
    include: {
      user:         { select: { id: true, name: true, email: true, mobile: true } },
      reviewedBy:   { select: { id: true, name: true, email: true } },
      processedBy:  { select: { id: true, name: true, email: true } },
      paymentOrder: {
        select: {
          id: true, finalAmountPaise: true, grossPaise: true, discountPaise: true,
          paidAt: true, providerOrderId: true, providerPaymentId: true, currency: true,
          package: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!rr) return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
  return NextResponse.json({ data: rr });
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { status, adminNote, approvedPaise } = body;

  // Fetch current record
  const existing = await prisma.refundRequest.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Refund request not found" }, { status: 404 });

  const currentStatus = existing.status as Status;

  // Validate requested status
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });
  if (status === currentStatus) {
    // Allow no-op updates (e.g., update adminNote without changing status)
  } else {
    if (TERMINAL.includes(currentStatus)) {
      return NextResponse.json({ error: `Cannot modify a ${currentStatus} refund request` }, { status: 400 });
    }
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(status as Status)) {
      return NextResponse.json({
        error: `Cannot transition from ${currentStatus} to ${status}. Allowed: ${allowed.join(", ") || "none"}`,
      }, { status: 400 });
    }
  }

  // Validate approvedPaise when approving
  if ((status === "APPROVED" || status === "PROCESSED") && approvedPaise == null) {
    return NextResponse.json({ error: "approvedPaise is required when approving" }, { status: 400 });
  }
  if (approvedPaise != null && parseInt(approvedPaise) > existing.paidPaise) {
    return NextResponse.json({ error: "approvedPaise cannot exceed paidPaise" }, { status: 400 });
  }

  // Determine which timestamp/admin fields to set
  const isReviewAction   = ["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status);
  const isProcessAction  = ["PROCESSED", "FAILED"].includes(status);

  const updated = await prisma.refundRequest.update({
    where: { id: params.id },
    data: {
      status: status as any,
      adminNote:    adminNote?.trim()  ?? existing.adminNote,
      approvedPaise: approvedPaise != null ? parseInt(approvedPaise) : existing.approvedPaise,

      reviewedById: isReviewAction  ? admin.id         : existing.reviewedById,
      reviewedAt:   isReviewAction  ? new Date()        : existing.reviewedAt,
      processedById: isProcessAction ? admin.id         : existing.processedById,
      processedAt:   isProcessAction ? new Date()        : existing.processedAt,
    },
    include: {
      user:         { select: { id: true, name: true, email: true } },
      reviewedBy:   { select: { id: true, name: true, email: true } },
      processedBy:  { select: { id: true, name: true, email: true } },
      paymentOrder: { select: { id: true, finalAmountPaise: true, paidAt: true } },
    },
  });

  writeAuditLog({
    actorId:    admin.id,
    action:     "REFUND_REQUEST_UPDATED",
    entityType: "RefundRequest",
    entityId:   params.id,
    before:     { status: currentStatus, approvedPaise: existing.approvedPaise },
    after:      { status, approvedPaise, adminNote },
  }).catch(() => {});

  return NextResponse.json({ data: updated });
}
