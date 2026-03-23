/**
 * Payment abstraction — entry point for all business logic.
 *
 * Gets the active PaymentConfig from DB, builds the correct provider,
 * and returns it. Changing the active provider account only requires
 * flipping isActive in the PaymentConfig table — zero code changes.
 */

import prisma from "@/lib/prisma";
import { CashfreeProvider } from "./cashfree";
import type { PaymentProvider } from "./types";
import type { PaymentConfig } from "@prisma/client";

export type ActivePayment = {
  config: PaymentConfig;
  provider: PaymentProvider;
};

/**
 * Fetches the single active PaymentConfig and returns the matching provider.
 * Throws "PAYMENT_NOT_CONFIGURED" if no active config exists.
 */
export async function getActivePaymentProvider(): Promise<ActivePayment> {
  const config = await prisma.paymentConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!config) {
    throw new Error("PAYMENT_NOT_CONFIGURED");
  }

  const provider = buildProvider(config);
  return { config, provider };
}

/**
 * Fetches a PaymentConfig by ID and returns the matching provider.
 * Used in the webhook endpoint which looks up config via stored ID.
 */
export async function getPaymentProviderById(configId: string): Promise<ActivePayment> {
  const config = await prisma.paymentConfig.findUnique({ where: { id: configId } });
  if (!config) throw new Error("PaymentConfig not found: " + configId);
  return { config, provider: buildProvider(config) };
}

/**
 * Returns all active configs (for webhook verification fallback).
 */
export async function getAllActiveProviders(): Promise<ActivePayment[]> {
  const configs = await prisma.paymentConfig.findMany({ where: { isActive: true } });
  return configs.map(config => ({ config, provider: buildProvider(config) }));
}

function buildProvider(config: PaymentConfig): PaymentProvider {
  switch (config.provider.toUpperCase()) {
    case "CASHFREE":
      return new CashfreeProvider({
        provider: config.provider,
        environment: config.environment as "TEST" | "PROD",
        appId: config.appId,
        secretKey: config.secretKey,
        webhookSecret: config.webhookSecret,
      });
    default:
      throw new Error(`Unsupported payment provider: ${config.provider}`);
  }
}

export { type PaymentProvider } from "./types";
