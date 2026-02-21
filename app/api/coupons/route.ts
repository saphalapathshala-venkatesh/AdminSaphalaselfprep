export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;
  const search = searchParams.get("search") || "";
  const active = searchParams.get("active");

  const where: any = {};
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;

  try {
    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { purchases: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Coupons GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { code, discountType, discountValue, validFrom, validUntil, usageLimit, perUserLimit, applicableEntitlements, isActive } = body;

    if (!code || !code.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
    if (!discountType || !["PERCENT", "FLAT"].includes(discountType)) return NextResponse.json({ error: "discountType must be PERCENT or FLAT" }, { status: 400 });

    const dv = parseInt(discountValue);
    if (isNaN(dv) || dv < 1) return NextResponse.json({ error: "discountValue must be >= 1" }, { status: 400 });
    if (discountType === "PERCENT" && dv > 100) return NextResponse.json({ error: "PERCENT discount must be 1-100" }, { status: 400 });

    if (validFrom && validUntil && new Date(validFrom) > new Date(validUntil)) {
      return NextResponse.json({ error: "validFrom must be before validUntil" }, { status: 400 });
    }

    if (usageLimit !== undefined && usageLimit !== null && usageLimit < 1) {
      return NextResponse.json({ error: "usageLimit must be >= 1" }, { status: 400 });
    }
    if (perUserLimit !== undefined && perUserLimit !== null && perUserLimit < 1) {
      return NextResponse.json({ error: "perUserLimit must be >= 1" }, { status: 400 });
    }

    const existing = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (existing) return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });

    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: dv,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        perUserLimit: perUserLimit ? parseInt(perUserLimit) : null,
        applicableEntitlements: Array.isArray(applicableEntitlements) ? applicableEntitlements : [],
        isActive: isActive !== undefined ? isActive : true,
        createdById: user.id,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "COUPON_CREATE",
      entityType: "Coupon",
      entityId: coupon.id,
      after: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
    });

    return NextResponse.json({ data: coupon }, { status: 201 });
  } catch (err) {
    console.error("Coupons POST error:", err);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, code, discountType, discountValue, validFrom, validUntil, usageLimit, perUserLimit, applicableEntitlements, isActive } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (discountType && !["PERCENT", "FLAT"].includes(discountType)) {
      return NextResponse.json({ error: "discountType must be PERCENT or FLAT" }, { status: 400 });
    }

    if (discountValue !== undefined) {
      const dv = parseInt(discountValue);
      if (isNaN(dv) || dv < 1) return NextResponse.json({ error: "discountValue must be >= 1" }, { status: 400 });
      const dt = discountType || existing.discountType;
      if (dt === "PERCENT" && dv > 100) return NextResponse.json({ error: "PERCENT discount must be 1-100" }, { status: 400 });
    }

    const vf = validFrom !== undefined ? (validFrom ? new Date(validFrom) : null) : existing.validFrom;
    const vu = validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : existing.validUntil;
    if (vf && vu && vf > vu) {
      return NextResponse.json({ error: "validFrom must be before validUntil" }, { status: 400 });
    }

    if (code && code.trim().toUpperCase() !== existing.code) {
      const dup = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
      if (dup) return NextResponse.json({ error: "A coupon with this code already exists" }, { status: 409 });
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        code: code ? code.trim().toUpperCase() : existing.code,
        discountType: discountType || existing.discountType,
        discountValue: discountValue !== undefined ? parseInt(discountValue) : existing.discountValue,
        validFrom: vf,
        validUntil: vu,
        usageLimit: usageLimit !== undefined ? (usageLimit ? parseInt(usageLimit) : null) : existing.usageLimit,
        perUserLimit: perUserLimit !== undefined ? (perUserLimit ? parseInt(perUserLimit) : null) : existing.perUserLimit,
        applicableEntitlements: applicableEntitlements !== undefined ? applicableEntitlements : existing.applicableEntitlements,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "COUPON_UPDATE",
      entityType: "Coupon",
      entityId: id,
      before: { code: existing.code, discountType: existing.discountType, discountValue: existing.discountValue, isActive: existing.isActive },
      after: { code: updated.code, discountType: updated.discountType, discountValue: updated.discountValue, isActive: updated.isActive },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Coupons PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.isActive && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete an active coupon" }, { status: 403 });
    }

    await prisma.coupon.delete({ where: { id } });

    await writeAuditLog({
      actorId: user.id,
      action: "COUPON_DELETE",
      entityType: "Coupon",
      entityId: id,
      before: { code: existing.code, discountType: existing.discountType },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Coupons DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
