/**
 * POST /api/webhooks/cashfree
 *
 * Cashfree webhook endpoint.
 *
 * Security rules:
 * 1. Raw body is read as text — NEVER parsed before signature verification.
 * 2. Signature verified with HMAC-SHA256 using the active config's webhookSecret.
 * 3. Always returns 200 to Cashfree (even on duplicate delivery) — non-200 triggers retries.
 * 4. Idempotent: if order is already PAID, skip processing.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAllActiveProviders } from "@/lib/payment/index";
import { settlePaidOrder } from "@/lib/payment/settlePaidOrder";

export async function POST(req: NextRequest) {
  // 1 — Read raw body (must be before any parsing)
  const rawBody  = await req.text();
  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";

  // 2 — Verify signature against all active configs
  let verified = false;
  const activeProviders = await getAllActiveProviders().catch(() => []);

  for (const { provider } of activeProviders) {
    if (provider.verifyWebhookSignature(rawBody, signature, timestamp)) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    console.warn("[Webhook] Cashfree signature verification failed");
    // Return 200 to prevent Cashfree from infinite retry — log and discard
    return NextResponse.json({ received: true, error: "signature_mismatch" });
  }

  // 3 — Parse payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true, error: "invalid_json" });
  }

  const eventType = payload?.type || payload?.event_type || "";
  const orderData = payload?.data?.order || payload?.order || {};
  const paymentData = payload?.data?.payment || payload?.payment || {};

  const providerOrderId  = orderData.order_id || payload?.order_id;
  const providerPaymentId = paymentData.cf_payment_id || payload?.cf_payment_id;
  const orderStatus      = orderData.order_status || payload?.order_status;

  if (!providerOrderId) {
    console.warn("[Webhook] Cashfree: no order_id in payload", payload);
    return NextResponse.json({ received: true });
  }

  // 4 — Find our PaymentOrder
  const order = await prisma.paymentOrder.findFirst({
    where: { providerOrderId },
    include: { package: { select: { id: true, name: true, entitlementCodes: true, currency: true } } },
  });

  if (!order) {
    console.warn("[Webhook] Cashfree: unknown providerOrderId:", providerOrderId);
    return NextResponse.json({ received: true });
  }

  // 5 — Idempotency: skip if already processed
  if (order.status === "PAID") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // 6 — Process based on event/status
  const isPaid = eventType.includes("PAYMENT_SUCCESS") ||
    orderStatus === "PAID" ||
    paymentData.payment_status === "SUCCESS";

  const isFailed = eventType.includes("PAYMENT_FAILED") ||
    orderStatus === "EXPIRED" ||
    paymentData.payment_status === "FAILED" ||
    paymentData.payment_status === "USER_DROPPED";

  if (isPaid) {
    try {
      await settlePaidOrder(order, providerPaymentId ? String(providerPaymentId) : null);
      console.log("[Webhook] Cashfree: order settled:", order.id);
    } catch (err) {
      console.error("[Webhook] Cashfree: settlePaidOrder failed:", err);
      // Return 200 still — Cashfree should not retry; we'll resolve via polling
    }
  } else if (isFailed) {
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { status: "FAILED", metadata: { eventType, orderStatus, paymentStatus: paymentData.payment_status } },
    }).catch(err => console.error("[Webhook] Failed to mark order failed:", err));
  }

  return NextResponse.json({ received: true });
}
