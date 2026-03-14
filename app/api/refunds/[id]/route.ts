export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = ["PENDING", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "REFUNDED"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const refund = await prisma.refund.findUnique({
    where: { id: params.id },
    include: {
      user:        { select: { id: true, name: true, email: true, mobile: true } },
      processedBy: { select: { id: true, name: true, email: true } },
      purchase:    { select: { id: true, grossPaise: true, netPaise: true, feePaise: true, createdAt: true, package: { select: { code: true, name: true } }, coupon: { select: { code: true } } } },
    },
  });
  if (!refund) return NextResponse.json({ error: "Refund not found" }, { status: 404 });
  return NextResponse.json({ data: refund });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { status, adminRemarks, approvedPaise, refundPct } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }

    const existing = await prisma.refund.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Refund not found" }, { status: 404 });
    if (existing.status === "REFUNDED") {
      return NextResponse.json({ error: "Cannot modify a completed refund" }, { status: 400 });
    }

    const isDecision = ["APPROVED", "PARTIALLY_APPROVED", "REJECTED", "REFUNDED"].includes(status);

    const updated = await prisma.refund.update({
      where: { id: params.id },
      data: {
        status,
        adminRemarks: adminRemarks?.trim() ?? existing.adminRemarks,
        approvedPaise: approvedPaise != null ? parseInt(approvedPaise) : existing.approvedPaise,
        refundPct:     refundPct     != null ? parseFloat(refundPct)   : existing.refundPct,
        processedById: isDecision ? user.id            : existing.processedById,
        processedAt:   isDecision ? new Date()         : existing.processedAt,
      },
      include: {
        user:        { select: { id: true, name: true, email: true } },
        processedBy: { select: { id: true, name: true, email: true } },
        purchase:    { select: { id: true, grossPaise: true, createdAt: true } },
      },
    });

    writeAuditLog({
      actorId: user.id,
      action: "REFUND_STATUS_UPDATED",
      entityType: "Refund",
      entityId: params.id,
      before: { status: existing.status },
      after:  { status, approvedPaise, adminRemarks },
    }).catch(() => {});

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Refund PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
