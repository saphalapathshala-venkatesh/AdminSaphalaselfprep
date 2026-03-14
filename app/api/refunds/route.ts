export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status  = searchParams.get("status")  || "";
  const userId  = searchParams.get("userId")  || "";
  const page    = Math.max(1, parseInt(searchParams.get("page")  || "1"));
  const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip    = (page - 1) * limit;

  const where: any = {};
  if (status)  where.status  = status;
  if (userId)  where.userId  = userId;

  const [rows, total] = await Promise.all([
    prisma.refund.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user:        { select: { id: true, name: true, email: true, mobile: true } },
        processedBy: { select: { id: true, name: true, email: true } },
        purchase:    { select: { id: true, grossPaise: true, createdAt: true, package: { select: { code: true, name: true } } } },
      },
    }),
    prisma.refund.count({ where }),
  ]);

  return NextResponse.json({ data: rows, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { purchaseId, reason, consumptionPct } = body;

    if (!purchaseId || !reason?.trim()) {
      return NextResponse.json({ error: "purchaseId and reason are required" }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { refund: true },
    });
    if (!purchase) return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    if (purchase.refund) return NextResponse.json({ error: "A refund request already exists for this purchase" }, { status: 409 });

    const refund = await prisma.refund.create({
      data: {
        purchaseId,
        userId: purchase.userId,
        amountPaidPaise: purchase.grossPaise,
        reason: reason.trim(),
        consumptionPct: consumptionPct != null ? parseFloat(consumptionPct) : null,
        status: "PENDING",
      },
      include: {
        user:     { select: { id: true, name: true, email: true } },
        purchase: { select: { id: true, grossPaise: true, createdAt: true } },
      },
    });

    writeAuditLog({
      actorId: user.id,
      action: "REFUND_CREATED",
      entityType: "Refund",
      entityId: refund.id,
      after: { purchaseId, userId: purchase.userId, amountPaidPaise: purchase.grossPaise, reason: reason.trim() },
    }).catch(() => {});

    return NextResponse.json({ data: refund }, { status: 201 });
  } catch (err) {
    console.error("Refund POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
