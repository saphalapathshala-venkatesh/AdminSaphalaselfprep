/**
 * GET /api/student/orders/[id]
 *
 * Verifies payment status for the authenticated student.
 * Used by the frontend after Cashfree redirects back.
 *
 * If the order is already PAID (webhook processed it), returns immediately.
 * If still PENDING, queries the provider directly and updates DB.
 * This handles cases where the webhook arrives after the redirect.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";
import { getPaymentProviderById } from "@/lib/payment/index";
import { CURRENT_LEGAL_VERSION } from "@/lib/legalVersion";

const STREAM_PRIORITY = ["TESTHUB", "SELFPREP_HTML", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const student = await getStudentUserFromRequest(req);
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.paymentOrder.findUnique({
    where: { id: params.id },
    include: { package: { select: { id: true, name: true, entitlementCodes: true, currency: true } } },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== student.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Already finalized — return current state immediately
  if (order.status === "PAID" || order.status === "FAILED" || order.status === "CANCELLED") {
    return NextResponse.json({ data: formatOrder(order) });
  }

  // Still PENDING — query provider for latest status
  if (order.providerOrderId && order.paymentConfigId) {
    try {
      const { provider } = await getPaymentProviderById(order.paymentConfigId);
      const result = await provider.verifyOrder(order.providerOrderId);

      if (result.status === "PAID") {
        await settlePaidOrder(order, result.providerPaymentId);
        const refreshed = await prisma.paymentOrder.findUnique({ where: { id: order.id }, include: { package: { select: { id: true, name: true, entitlementCodes: true, currency: true } } } });
        return NextResponse.json({ data: formatOrder(refreshed!) });
      }

      if (result.status === "FAILED" || result.status === "CANCELLED") {
        await prisma.paymentOrder.update({
          where: { id: order.id },
          data: { status: result.status },
        });
        return NextResponse.json({ data: { ...formatOrder(order), status: result.status } });
      }
    } catch (err) {
      console.error("Verify order provider error:", err);
      // Fall through — return current DB status
    }
  }

  return NextResponse.json({ data: formatOrder(order) });
}

function formatOrder(order: any) {
  return {
    orderId:          order.id,
    status:           order.status,
    amountPaise:      order.finalAmountPaise,
    currency:         order.currency,
    paidAt:           order.paidAt,
    purchaseId:       order.purchaseId,
    package:          order.package,
    providerOrderId:  order.providerOrderId,
    providerPaymentId: order.providerPaymentId,
  };
}

/** Idempotently settle a PAID order: create Purchase + activate entitlements. */
export async function settlePaidOrder(order: any, providerPaymentId: string | null) {
  // Guard: skip if already settled
  if (order.status === "PAID") return;

  const pkg = order.package ?? await prisma.productPackage.findUnique({
    where: { id: order.packageId },
    select: { entitlementCodes: true, currency: true },
  });

  await prisma.$transaction(async tx => {
    // Mark order as PAID
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        providerPaymentId: providerPaymentId || order.providerPaymentId,
      },
    });

    // Create Purchase record (analytics ledger)
    const stream = STREAM_PRIORITY.find(s => pkg?.entitlementCodes?.includes(s)) || "TESTHUB";
    const purchase = await tx.purchase.create({
      data: {
        userId:       order.userId,
        packageId:    order.packageId,
        couponId:     order.couponId,
        stream:       stream as any,
        currency:     order.currency,
        grossPaise:   order.finalAmountPaise,
        feePaise:     0,
        netPaise:     order.finalAmountPaise,
        legalAcceptedAt: order.legalAcceptedAt ?? new Date(),
        legalVersion:    order.legalVersion ?? CURRENT_LEGAL_VERSION,
      },
    });

    // Link purchase back to order
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { purchaseId: purchase.id },
    });

    // Activate entitlements (idempotent upsert)
    for (const code of (pkg?.entitlementCodes ?? [])) {
      await tx.userEntitlement.upsert({
        where: { userId_productCode_tenantId: { userId: order.userId, productCode: code, tenantId: "default" } },
        create: { userId: order.userId, productCode: code, status: "ACTIVE", purchaseId: purchase.id, tenantId: "default" },
        update: { status: "ACTIVE", purchaseId: purchase.id },
      });
    }
  });
}
