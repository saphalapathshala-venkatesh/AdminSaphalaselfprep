import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const STREAM_PRIORITY: string[] = ["TESTHUB", "SELFPREP_HTML", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, couponCode } = body;

    if (!userId || !userId.trim()) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId.trim() } });
    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const pkg = await prisma.productPackage.findUnique({ where: { id: params.id } });
    if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
    if (!pkg.isActive) return NextResponse.json({ error: "Package is not active" }, { status: 400 });

    let grossPaise = pkg.pricePaise;
    let discountPaise = 0;
    let couponId: string | null = null;

    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } });
      if (!coupon) return NextResponse.json({ error: "Coupon not found" }, { status: 400 });
      if (!coupon.isActive) return NextResponse.json({ error: "Coupon is not active" }, { status: 400 });

      const now = new Date();
      if (coupon.validFrom && now < coupon.validFrom) return NextResponse.json({ error: "Coupon is not yet valid" }, { status: 400 });
      if (coupon.validUntil && now > coupon.validUntil) return NextResponse.json({ error: "Coupon has expired" }, { status: 400 });

      if (coupon.usageLimit) {
        const globalUsage = await prisma.purchase.count({ where: { couponId: coupon.id } });
        if (globalUsage >= coupon.usageLimit) return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }

      if (coupon.perUserLimit) {
        const userUsage = await prisma.purchase.count({ where: { couponId: coupon.id, userId: userId.trim() } });
        if (userUsage >= coupon.perUserLimit) return NextResponse.json({ error: "Coupon per-user limit reached" }, { status: 400 });
      }

      if (coupon.applicableEntitlements.length > 0) {
        const intersection = pkg.entitlementCodes.filter(e => coupon.applicableEntitlements.includes(e));
        if (intersection.length === 0) {
          return NextResponse.json({ error: "Coupon is not applicable to this package" }, { status: 400 });
        }
      }

      if (coupon.discountType === "PERCENT") {
        discountPaise = Math.round(grossPaise * coupon.discountValue / 100);
      } else {
        discountPaise = coupon.discountValue;
      }
      discountPaise = Math.min(discountPaise, grossPaise);
      couponId = coupon.id;
    }

    const finalGross = grossPaise - discountPaise;
    const feePaise = Math.round(finalGross * 0.03);
    const netPaise = finalGross - feePaise;

    const stream = STREAM_PRIORITY.find(s => pkg.entitlementCodes.includes(s)) || "TESTHUB";

    const purchase = await prisma.purchase.create({
      data: {
        userId: userId.trim(),
        packageId: pkg.id,
        couponId,
        stream: stream as any,
        currency: pkg.currency,
        grossPaise: finalGross,
        feePaise,
        netPaise,
      },
    });

    const entitlements = [];
    for (const code of pkg.entitlementCodes) {
      const ent = await prisma.userEntitlement.upsert({
        where: { userId_productCode_tenantId: { userId: userId.trim(), productCode: code, tenantId: "" } },
        create: {
          userId: userId.trim(),
          productCode: code,
          status: "ACTIVE",
          purchaseId: purchase.id,
          tenantId: "",
        },
        update: {
          status: "ACTIVE",
          purchaseId: purchase.id,
        },
      });
      entitlements.push(ent);
    }

    await writeAuditLog({
      actorId: user.id,
      action: "PRODUCT_SIMULATE_PURCHASE",
      entityType: "Purchase",
      entityId: purchase.id,
      after: {
        packageCode: pkg.code,
        userId: userId.trim(),
        grossPaise: purchase.grossPaise,
        feePaise: purchase.feePaise,
        netPaise: purchase.netPaise,
        couponCode: couponCode || null,
        entitlementCodes: pkg.entitlementCodes,
      },
    });

    return NextResponse.json({ data: { purchase, entitlements } }, { status: 201 });
  } catch (err) {
    console.error("Simulate purchase error:", err);
    return NextResponse.json({ error: "Failed to simulate purchase" }, { status: 500 });
  }
}
