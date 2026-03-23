/**
 * Shared helper — not a route file.
 * Idempotently settles a PAID PaymentOrder:
 *   - Marks the order PAID
 *   - Creates the Purchase ledger record
 *   - Activates all UserEntitlements in the package
 *
 * Called from both:
 *   app/api/student/orders/[id]/route.ts  (poll-verify path)
 *   app/api/webhooks/cashfree/route.ts    (webhook path)
 */

import prisma from "@/lib/prisma";
import { CURRENT_LEGAL_VERSION } from "@/lib/legalVersion";

const STREAM_PRIORITY = [
  "TESTHUB", "SELFPREP_HTML", "FLASHCARDS",
  "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON",
];

export async function settlePaidOrder(
  order: any,
  providerPaymentId: string | null,
): Promise<void> {
  // Guard: skip if already settled (idempotency)
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
        userId:          order.userId,
        packageId:       order.packageId,
        couponId:        order.couponId,
        stream:          stream as any,
        currency:        order.currency,
        grossPaise:      order.finalAmountPaise,
        feePaise:        0,
        netPaise:        order.finalAmountPaise,
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
        where: {
          userId_productCode_tenantId: {
            userId:      order.userId,
            productCode: code,
            tenantId:    "default",
          },
        },
        create: {
          userId:      order.userId,
          productCode: code,
          status:      "ACTIVE",
          purchaseId:  purchase.id,
          tenantId:    "default",
        },
        update: { status: "ACTIVE", purchaseId: purchase.id },
      });
    }
  });
}
