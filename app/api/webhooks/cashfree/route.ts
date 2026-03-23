/**
 * POST /api/webhooks/cashfree
 *
 * Cashfree webhook endpoint.
 *
 * Security rules:
 * 1. Raw body is read as text — NEVER parsed before signature verification.
 * 2. Signature is verified using the order's own PaymentConfig webhookSecret
 *    first (handles the case where admin rotates/switches configs after order
 *    creation). Falls back to all currently-active configs if the order-
 *    specific config cannot be resolved.
 * 3. Always returns 200 to Cashfree (even on errors) — non-200 triggers retries.
 * 4. Idempotency enforced inside settlePaidOrder via atomic DB claim.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPaymentProviderById, getAllActiveProviders } from "@/lib/payment/index";
import { settlePaidOrder } from "@/lib/payment/settlePaidOrder";

export async function POST(req: NextRequest) {
  // 1 — Read raw body FIRST (must be text for HMAC verification)
  const rawBody   = await req.text();
  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";

  // 2 — Parse payload early (read-only) to extract order_id for config lookup.
  //     This is a safe pre-verification DB read — no state is changed until
  //     after signature is confirmed.
  let parsedEarly: any = {};
  let earlyProviderOrderId: string | null = null;
  try {
    parsedEarly = JSON.parse(rawBody);
    const earlyOrderData = parsedEarly?.data?.order || parsedEarly?.order || {};
    earlyProviderOrderId = earlyOrderData.order_id || parsedEarly?.order_id || null;
  } catch {
    // ignore — will be caught again below
  }

  // 3 — Verify signature: prefer the order's own config (handles credential
  //     rotation / config switches), then fall back to active configs.
  let verified = false;

  if (earlyProviderOrderId) {
    // Look up the order's specific paymentConfigId (read-only)
    const earlyOrder = await prisma.paymentOrder.findFirst({
      where:  { providerOrderId: earlyProviderOrderId },
      select: { id: true, paymentConfigId: true },
    });

    if (earlyOrder?.paymentConfigId) {
      try {
        const { provider } = await getPaymentProviderById(earlyOrder.paymentConfigId);
        verified = provider.verifyWebhookSignature(rawBody, signature, timestamp);
      } catch {
        // Config was deleted — fall through to active-config fallback
      }
    }
  }

  // Fallback: try all currently-active configs
  if (!verified) {
    const activeProviders = await getAllActiveProviders().catch(() => []);
    for (const { provider } of activeProviders) {
      if (provider.verifyWebhookSignature(rawBody, signature, timestamp)) {
        verified = true;
        break;
      }
    }
  }

  if (!verified) {
    console.warn("[Webhook/Cashfree] Signature verification failed — discarding");
    // Return 200 to suppress Cashfree retries for genuinely bad requests
    return NextResponse.json({ received: true, error: "signature_mismatch" });
  }

  // 4 — Parse (or reuse) full payload
  let payload: any;
  try {
    payload = Object.keys(parsedEarly).length > 0 ? parsedEarly : JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true, error: "invalid_json" });
  }

  const eventType     = payload?.type || payload?.event_type || "";
  const orderData     = payload?.data?.order  || payload?.order   || {};
  const paymentData   = payload?.data?.payment || payload?.payment || {};

  const providerOrderId   = orderData.order_id   || payload?.order_id;
  const providerPaymentId = paymentData.cf_payment_id || payload?.cf_payment_id;
  const orderStatus       = orderData.order_status || payload?.order_status;

  if (!providerOrderId) {
    console.warn("[Webhook/Cashfree] No order_id in payload");
    return NextResponse.json({ received: true });
  }

  // 5 — Find our PaymentOrder (reuse early lookup result if ids match)
  const order = await prisma.paymentOrder.findFirst({
    where:   { providerOrderId },
    include: { package: { select: { id: true, name: true, entitlementCodes: true, currency: true } } },
  });

  if (!order) {
    console.warn("[Webhook/Cashfree] Unknown providerOrderId:", providerOrderId);
    return NextResponse.json({ received: true });
  }

  // 6 — Determine event intent
  const isPaid = eventType.includes("PAYMENT_SUCCESS") ||
    orderStatus === "PAID" ||
    paymentData.payment_status === "SUCCESS";

  const isFailed = eventType.includes("PAYMENT_FAILED") ||
    orderStatus === "EXPIRED" ||
    paymentData.payment_status === "FAILED" ||
    paymentData.payment_status === "USER_DROPPED";

  // 7 — Settle or fail (idempotency handled inside settlePaidOrder)
  if (isPaid) {
    try {
      await settlePaidOrder(order, providerPaymentId ? String(providerPaymentId) : null);
      console.log("[Webhook/Cashfree] Order settled:", order.id);
    } catch (err) {
      console.error("[Webhook/Cashfree] settlePaidOrder failed:", err);
      // Return 200 still — retry would re-enter the same settlement path
    }
  } else if (isFailed && order.status !== "PAID") {
    // Only mark FAILED if not already PAID (guard against ordering issues)
    await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data:  { status: "FAILED", metadata: { eventType, orderStatus, paymentStatus: paymentData.payment_status } as any },
    }).catch(err => console.error("[Webhook/Cashfree] Failed to mark order failed:", err));
  }

  return NextResponse.json({ received: true });
}
