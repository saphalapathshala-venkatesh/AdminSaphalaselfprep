/**
 * Shared helper — not a route file.
 * Idempotently settles a PAID PaymentOrder:
 *   - Marks the order PAID  (atomic claim — only one concurrent caller wins)
 *   - Creates the Purchase ledger record
 *   - Activates all UserEntitlements in the package
 *
 * Called from both:
 *   app/api/student/orders/[id]/route.ts  (poll-verify path)
 *   app/api/webhooks/cashfree/route.ts    (webhook path)
 *
 * Idempotency design
 * ------------------
 * The guard is enforced INSIDE the transaction using `updateMany` with
 * `WHERE status != PAID`. Postgres acquires an exclusive row lock on the
 * UPDATE; only the first concurrent caller gets count=1 and proceeds to
 * create the Purchase. The second caller sees count=0 and returns early
 * without touching Purchase or UserEntitlement tables.
 *
 * This prevents the race between a webhook delivery and a frontend poll
 * that can arrive simultaneously while the order is still PENDING.
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
  const pkg = order.package ?? await prisma.productPackage.findUnique({
    where: { id: order.packageId },
    select: { entitlementCodes: true, currency: true },
  });

  await prisma.$transaction(async tx => {
    // ── ATOMIC CLAIM ──────────────────────────────────────────────────────
    // Only the first concurrent caller gets count=1.
    // Postgres row-lock on UPDATE ensures the second caller sees the
    // already-committed PAID status and gets count=0, then returns.
    const claim = await tx.paymentOrder.updateMany({
      where: {
        id:     order.id,
        status: { not: "PAID" },   // reject if already settled
      },
      data: {
        status:            "PAID",
        paidAt:            new Date(),
        providerPaymentId: providerPaymentId ?? order.providerPaymentId ?? null,
      },
    });

    if (claim.count === 0) {
      // Already settled by a concurrent webhook delivery or poll.
      // Return silently — entitlements were granted by the winner.
      return;
    }
    // ── PURCHASE LEDGER ───────────────────────────────────────────────────
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

    // Link purchase back to order (best-effort; non-critical)
    await tx.paymentOrder.update({
      where: { id: order.id },
      data:  { purchaseId: purchase.id },
    });

    // ── ENTITLEMENT ACTIVATION ────────────────────────────────────────────
    // Upsert is idempotent by the DB unique constraint:
    //   @@unique([userId, productCode, tenantId])
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
