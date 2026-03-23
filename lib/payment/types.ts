/**
 * Payment abstraction layer — provider-agnostic types.
 *
 * All provider-specific logic lives in lib/payment/cashfree.ts (or future providers).
 * Business logic (order creation, entitlement activation) always calls through
 * this interface so swapping providers requires only a config change.
 */

export interface ProviderConfig {
  provider: string;
  environment: "TEST" | "PROD";
  appId: string;
  secretKey: string;
  webhookSecret: string;
}

export interface CreateOrderInput {
  /** Our internal PaymentOrder.id — used as the provider order_id */
  orderId: string;
  /** Amount in paise (we convert to rupees when calling provider APIs) */
  amountPaise: number;
  currency: string;
  returnUrl: string;
  customer: {
    id: string;      // userId
    name: string;
    email: string;
    phone: string;   // required by Cashfree
  };
  description?: string;
  /** Full URL Cashfree will POST payment events to (notify_url in Cashfree V3). */
  notifyUrl?: string;
}

export interface CreateOrderResult {
  /** Provider-assigned order ID (e.g. Cashfree cf_order_id) */
  providerOrderId: string;
  /** Short-lived session token for the Cashfree JS SDK */
  paymentSessionId: string;
}

export type ProviderPaymentStatus = "PAID" | "PENDING" | "FAILED" | "CANCELLED";

export interface VerifyOrderResult {
  providerOrderId: string;
  providerPaymentId: string | null;
  status: ProviderPaymentStatus;
  /** Amount provider actually charged (paise), or null if unknown */
  amountPaise: number | null;
}

/** Every payment provider must implement this interface. */
export interface PaymentProvider {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyOrder(providerOrderId: string): Promise<VerifyOrderResult>;
  /**
   * Verify a webhook signature.
   * rawBody  — the raw request body string (never parsed before calling this)
   * signature — value of the provider's signature header
   * timestamp — value of the provider's timestamp header (if applicable)
   */
  verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean;
}
