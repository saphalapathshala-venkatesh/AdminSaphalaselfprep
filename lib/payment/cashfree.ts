/**
 * Cashfree Payments (PG V3 – API version 2023-08-01) provider implementation.
 *
 * Implements the PaymentProvider interface from lib/payment/types.ts.
 * Never import this directly from business routes — use lib/payment/index.ts.
 */

import crypto from "crypto";
import type {
  ProviderConfig,
  PaymentProvider,
  CreateOrderInput,
  CreateOrderResult,
  VerifyOrderResult,
  ProviderPaymentStatus,
} from "./types";

const API_VERSION = "2023-08-01";

export class CashfreeProvider implements PaymentProvider {
  private baseUrl: string;
  private appId: string;
  private secretKey: string;
  private webhookSecret: string;

  constructor(config: ProviderConfig) {
    this.appId       = config.appId;
    this.secretKey   = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.baseUrl = config.environment === "PROD"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": this.appId,
      "x-client-secret": this.secretKey,
    };
  }

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const body = {
      order_id:       input.orderId,
      order_amount:   input.amountPaise / 100,  // Cashfree uses rupees (float)
      order_currency: input.currency,
      customer_details: {
        customer_id:    input.customer.id,
        customer_name:  input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: "",  // webhook handled separately
      },
      ...(input.description ? { order_note: input.description } : {}),
    };

    const res = await fetch(`${this.baseUrl}/orders`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cashfree createOrder error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      providerOrderId: data.cf_order_id ?? data.order_id,
      paymentSessionId: data.payment_session_id,
    };
  }

  async verifyOrder(providerOrderId: string): Promise<VerifyOrderResult> {
    const res = await fetch(`${this.baseUrl}/orders/${providerOrderId}`, {
      method: "GET",
      headers: this.headers(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cashfree verifyOrder error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const status = mapCashfreeStatus(data.order_status);
    const amountPaise = data.order_amount != null
      ? Math.round(data.order_amount * 100)
      : null;

    // Fetch the most recent payment to get the payment ID
    let providerPaymentId: string | null = null;
    if (status === "PAID") {
      try {
        const pRes = await fetch(`${this.baseUrl}/orders/${providerOrderId}/payments`, {
          method: "GET",
          headers: this.headers(),
        });
        if (pRes.ok) {
          const payments = await pRes.json();
          const paid = Array.isArray(payments)
            ? payments.find((p: any) => p.payment_status === "SUCCESS")
            : null;
          if (paid) providerPaymentId = paid.cf_payment_id ?? null;
        }
      } catch {
        // non-critical — don't break verification
      }
    }

    return { providerOrderId, providerPaymentId, status, amountPaise };
  }

  /**
   * Verify Cashfree webhook signature.
   *
   * Cashfree computes: Base64( HMAC-SHA256( timestamp + rawBody, secretKey ) )
   * Headers: x-webhook-timestamp (Unix seconds), x-webhook-signature
   */
  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
    if (!signature || !timestamp) return false;
    try {
      const signedPayload = timestamp + rawBody;
      const expected = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(signedPayload)
        .digest("base64");
      // Constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }
}

function mapCashfreeStatus(status: string): ProviderPaymentStatus {
  switch (status?.toUpperCase()) {
    case "PAID":    return "PAID";
    case "ACTIVE":  return "PENDING";
    case "EXPIRED": return "FAILED";
    case "CANCELLED": return "CANCELLED";
    default:        return "PENDING";
  }
}
