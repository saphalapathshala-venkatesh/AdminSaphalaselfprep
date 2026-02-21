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
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;

  try {
    const [items, total] = await Promise.all([
      prisma.productPackage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { purchases: true } } },
      }),
      prisma.productPackage.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Products GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { code, name, description, entitlementCodes, pricePaise, currency, isActive } = body;

    if (!code || !code.trim()) return NextResponse.json({ error: "Code is required" }, { status: 400 });
    if (!name || !name.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const existing = await prisma.productPackage.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (existing) return NextResponse.json({ error: "A package with this code already exists" }, { status: 409 });

    const pkg = await prisma.productPackage.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || null,
        entitlementCodes: Array.isArray(entitlementCodes) ? entitlementCodes : [],
        pricePaise: parseInt(pricePaise) || 0,
        currency: currency || "INR",
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "PRODUCT_CREATE",
      entityType: "ProductPackage",
      entityId: pkg.id,
      after: { code: pkg.code, name: pkg.name, pricePaise: pkg.pricePaise, entitlementCodes: pkg.entitlementCodes },
    });

    return NextResponse.json({ data: pkg }, { status: 201 });
  } catch (err) {
    console.error("Products POST error:", err);
    return NextResponse.json({ error: "Failed to create package" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, code, name, description, entitlementCodes, pricePaise, currency, isActive } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await prisma.productPackage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (code && code.trim().toUpperCase() !== existing.code) {
      const dup = await prisma.productPackage.findUnique({ where: { code: code.trim().toUpperCase() } });
      if (dup) return NextResponse.json({ error: "A package with this code already exists" }, { status: 409 });
    }

    const updated = await prisma.productPackage.update({
      where: { id },
      data: {
        code: code ? code.trim().toUpperCase() : existing.code,
        name: name?.trim() || existing.name,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        entitlementCodes: entitlementCodes !== undefined ? entitlementCodes : existing.entitlementCodes,
        pricePaise: pricePaise !== undefined ? parseInt(pricePaise) || 0 : existing.pricePaise,
        currency: currency || existing.currency,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "PRODUCT_UPDATE",
      entityType: "ProductPackage",
      entityId: id,
      before: { code: existing.code, name: existing.name, pricePaise: existing.pricePaise, isActive: existing.isActive },
      after: { code: updated.code, name: updated.name, pricePaise: updated.pricePaise, isActive: updated.isActive },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Products PUT error:", err);
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
    const existing = await prisma.productPackage.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.isActive && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete an active package" }, { status: 403 });
    }

    await prisma.productPackage.delete({ where: { id } });

    await writeAuditLog({
      actorId: user.id,
      action: "PRODUCT_DELETE",
      entityType: "ProductPackage",
      entityId: id,
      before: { code: existing.code, name: existing.name },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Products DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
