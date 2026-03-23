/**
 * POST /api/student/orders
 *
 * Creates a payment order for the authenticated student.
 * Server calculates the trusted amount — never trusted from frontend.
 *
 * Special paths:
 *   - PENDING order reuse: if a non-expired PENDING order already exists for
 *     the same user + package (within 30 min), that order is returned so the
 *     frontend can resume the existing payment session rather than creating a
 *     duplicate.
 *   - Zero-amount: if finalAmountPaise === 0 (free package or 100% coupon),
 *     Cashfree is bypassed and access is granted immediately.
 *
 * Body: { packageId, couponCode?, legalAccepted, returnUrl }
 *
 * Returns { orderId, paymentSessionId?, amountPaise, currency, environment,
 *           isFree?, resumed? }
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";
import { getActivePaymentProvider } from "@/lib/payment/index";
import { settlePaidOrder } from "@/lib/payment/settlePaidOrder";
import { CURRENT_LEGAL_VERSION } from "@/lib/legalVersion";

/** Reuse window: resume existing PENDING/CREATED orders up to 30 minutes old */
const PENDING_REUSE_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  const student = await getStudentUserFromRequest(req);
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { packageId, couponCode, legalAccepted, returnUrl } = body;

  if (!packageId)     return NextResponse.json({ error: "packageId is required" }, { status: 400 });
  if (!legalAccepted) return NextResponse.json({ error: "You must accept the Terms & Conditions before checkout." }, { status: 400 });
  if (!returnUrl)     return NextResponse.json({ error: "returnUrl is required" }, { status: 400 });

  // Validate returnUrl is a proper http/https URL — prevents open redirect.
  try {
    const parsed = new URL(returnUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return NextResponse.json({ error: "returnUrl must be an http or https URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "returnUrl must be a valid URL" }, { status: 400 });
  }

  // 1 — Validate package
  const pkg = await prisma.productPackage.findUnique({ where: { id: packageId } });
  if (!pkg)          return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (!pkg.isActive) return NextResponse.json({ error: "Package is not currently available" }, { status: 400 });

  // 2 — Calculate price (backend-trusted)
  let grossPaise    = pkg.pricePaise;
  let discountPaise = 0;
  let couponId: string | null = null;

  if (couponCode?.trim()) {
    const code = couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: {
        productCategoryScopes: true,
        examCategoryScopes:    true,
      },
    });
    if (!coupon)           return NextResponse.json({ error: "Coupon not found" }, { status: 400 });
    if (!coupon.isActive)  return NextResponse.json({ error: "Coupon is inactive" }, { status: 400 });

    const now = new Date();
    if (coupon.validFrom  && now < coupon.validFrom)  return NextResponse.json({ error: "Coupon is not yet valid" }, { status: 400 });
    if (coupon.validUntil && now > coupon.validUntil) return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });

    if (coupon.usageLimit) {
      const used = await prisma.paymentOrder.count({ where: { couponId: coupon.id, status: { in: ["PAID", "PENDING"] } } });
      if (used >= coupon.usageLimit) return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
    }
    if (coupon.perUserLimit) {
      const userUsed = await prisma.paymentOrder.count({ where: { couponId: coupon.id, userId: student.id, status: { in: ["PAID", "PENDING"] } } });
      if (userUsed >= coupon.perUserLimit) return NextResponse.json({ error: "You have already used this coupon the maximum number of times" }, { status: 400 });
    }

    // Legacy entitlement-based check (kept for backward compatibility with old coupons)
    if (coupon.applicableEntitlements.length > 0) {
      const overlap = pkg.entitlementCodes.filter(e => coupon.applicableEntitlements.includes(e));
      if (overlap.length === 0) return NextResponse.json({ error: "Coupon is not applicable to this package" }, { status: 400 });
    }

    // Dual-layer applicability check — BOTH conditions must pass
    // Layer 1: Product category (commercial layer)
    if (!coupon.appliesToAllPaidProductCategories) {
      const allowedProductCats = coupon.productCategoryScopes.map(s => s.productCategory as string);
      if (!pkg.productCategory || !allowedProductCats.includes(pkg.productCategory)) {
        return NextResponse.json({ error: "Coupon is not applicable to this product type" }, { status: 400 });
      }
    }

    // Layer 2: Exam category (taxonomy layer)
    if (!coupon.appliesToAllExamCategories) {
      const allowedCategoryIds = coupon.examCategoryScopes.map(s => s.categoryId);
      if (!pkg.categoryId || !allowedCategoryIds.includes(pkg.categoryId)) {
        return NextResponse.json({ error: "Coupon is not applicable to this exam category" }, { status: 400 });
      }
    }

    discountPaise = coupon.discountType === "PERCENT"
      ? Math.round(grossPaise * coupon.discountValue / 100)
      : coupon.discountValue;
    discountPaise = Math.min(discountPaise, grossPaise);
    couponId = coupon.id;
  }

  const finalAmountPaise = grossPaise - discountPaise;

  // 3 — Check for an existing PENDING/CREATED order (within reuse window)
  //     Returning the existing session avoids creating duplicate Cashfree orders
  //     when the user navigates back and tries to pay again.
  const existingOrder = await prisma.paymentOrder.findFirst({
    where: {
      userId:    student.id,
      packageId: pkg.id,
      status:    { in: ["PENDING", "CREATED"] },
      createdAt: { gte: new Date(Date.now() - PENDING_REUSE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingOrder?.paymentSessionId) {
    // Resolve environment from the stored config (needed by JS SDK)
    let environment = "TEST";
    if (existingOrder.paymentConfigId) {
      const cfg = await prisma.paymentConfig.findUnique({
        where:  { id: existingOrder.paymentConfigId },
        select: { environment: true },
      });
      environment = cfg?.environment ?? "TEST";
    }
    return NextResponse.json({
      data: {
        orderId:          existingOrder.id,
        paymentSessionId: existingOrder.paymentSessionId,
        amountPaise:      existingOrder.finalAmountPaise,
        currency:         existingOrder.currency,
        environment,
        package:          { id: pkg.id, name: pkg.name },
        resumed:          true,   // tells frontend this is a resumed session
      },
    }, { status: 200 });
  }

  // 4 — Zero-amount fast path (free package or 100% coupon discount)
  //     Bypass Cashfree entirely — create the order and settle it immediately.
  if (finalAmountPaise === 0) {
    const freeOrder = await prisma.paymentOrder.create({
      data: {
        userId:          student.id,
        packageId:       pkg.id,
        couponId,
        paymentConfigId: null,
        grossPaise,
        discountPaise,
        finalAmountPaise: 0,
        currency:         pkg.currency,
        status:           "CREATED",
        provider:         "FREE",
        legalAcceptedAt:  new Date(),
        legalVersion:     CURRENT_LEGAL_VERSION,
      },
    });

    // Attach package data so settlePaidOrder doesn't need an extra DB query
    const freeOrderWithPackage = {
      ...freeOrder,
      package: { id: pkg.id, name: pkg.name, entitlementCodes: pkg.entitlementCodes, currency: pkg.currency },
    };

    await settlePaidOrder(freeOrderWithPackage, null);

    return NextResponse.json({
      data: {
        orderId:     freeOrder.id,
        amountPaise: 0,
        currency:    pkg.currency,
        package:     { id: pkg.id, name: pkg.name },
        isFree:      true,
        status:      "PAID",
      },
    }, { status: 201 });
  }

  // 5 — Get active payment provider (paid orders only)
  let activePayment: Awaited<ReturnType<typeof getActivePaymentProvider>>;
  try {
    activePayment = await getActivePaymentProvider();
  } catch (err: any) {
    if (err.message === "PAYMENT_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Payment is not configured. Please contact support." }, { status: 503 });
    }
    throw err;
  }

  const { config, provider } = activePayment;

  // 6 — Construct notify_url.
  //     Priority: NEXT_PUBLIC_APP_URL env var (set in production) → request host headers.
  //     This ensures Cashfree sends payment events to our webhook even if it
  //     was not configured in the Cashfree dashboard separately.
  let notifyUrl = "";
  if (process.env.NEXT_PUBLIC_APP_URL) {
    notifyUrl = `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/cashfree`;
  } else {
    const host  = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) notifyUrl = `${proto}://${host}/api/webhooks/cashfree`;
  }

  // 7 — Create PaymentOrder record (status=CREATED)
  const order = await prisma.paymentOrder.create({
    data: {
      userId:          student.id,
      packageId:       pkg.id,
      couponId,
      paymentConfigId: config.id,
      grossPaise,
      discountPaise,
      finalAmountPaise,
      currency:        pkg.currency,
      status:          "CREATED",
      provider:        config.provider,
      legalAcceptedAt: new Date(),
      legalVersion:    CURRENT_LEGAL_VERSION,
    },
  });

  // 8 — Call provider to create order at Cashfree
  try {
    const phone = (student as any).mobile?.trim() || "0000000000";
    const email = student.email ?? "";
    const name  = (student as any).fullName?.trim() || (email ? email.split("@")[0] : student.id);

    const result = await provider.createOrder({
      orderId:     order.id,
      amountPaise: finalAmountPaise,
      currency:    pkg.currency,
      returnUrl:   `${returnUrl}?order_id=${order.id}`,
      notifyUrl,
      customer: {
        id:    student.id,
        name,
        email,
        phone,
      },
      description: pkg.name,
    });

    // 9 — Update order with provider details
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        providerOrderId:  result.providerOrderId,
        paymentSessionId: result.paymentSessionId,
        status:           "PENDING",
      },
    });

    return NextResponse.json({
      data: {
        orderId:          order.id,
        paymentSessionId: result.paymentSessionId,
        amountPaise:      finalAmountPaise,
        currency:         pkg.currency,
        environment:      config.environment,  // "TEST" | "PROD" — for JS SDK mode
        package:          { id: pkg.id, name: pkg.name },
      },
    }, { status: 201 });

  } catch (err: any) {
    // Mark order as FAILED if provider call fails
    await prisma.paymentOrder.update({
      where: { id: order.id },
      data:  { status: "FAILED", metadata: { error: err.message } },
    }).catch(() => {});
    console.error("Payment order creation error:", err);
    return NextResponse.json({ error: "Failed to initiate payment. Please try again." }, { status: 502 });
  }
}
