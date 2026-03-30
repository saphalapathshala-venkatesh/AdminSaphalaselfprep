/**
 * GET  /api/users/[id]/entitlements
 *   Returns the user's current entitlements (all statuses) and
 *   the list of active packages the user does NOT yet have ACTIVE access to.
 *
 * POST /api/users/[id]/entitlements
 *   Admin-grants access to a package without creating an order or purchase.
 *   Body: { packageId: string }
 *   Upserts one UserEntitlement per entitlementCode in the package.
 *   purchaseId is intentionally omitted — existing purchase history is untouched.
 */
export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [entitlements, allPackages] = await Promise.all([
    prisma.userEntitlement.findMany({
      where: { userId: params.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productPackage.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, entitlementCodes: true },
    }),
  ]);

  // Build productCode → package lookup
  const codeToPackage: Record<string, { id: string; name: string; code: string }> = {};
  for (const pkg of allPackages) {
    for (const code of pkg.entitlementCodes) {
      codeToPackage[code] = { id: pkg.id, name: pkg.name, code: pkg.code };
    }
  }

  // Product codes the user currently has ACTIVE
  const activeUserCodes = new Set(
    entitlements.filter(e => e.status === "ACTIVE").map(e => e.productCode),
  );

  // Available = packages with ≥1 entitlement code AND none of them already ACTIVE for this user
  const available = allPackages.filter(
    pkg =>
      pkg.entitlementCodes.length > 0 &&
      !pkg.entitlementCodes.some(code => activeUserCodes.has(code)),
  );

  const enrolled = entitlements.map(e => ({
    id:          e.id,
    productCode: e.productCode,
    status:      e.status,
    createdAt:   e.createdAt,
    purchaseId:  e.purchaseId,
    package:     codeToPackage[e.productCode] ?? null,
  }));

  return NextResponse.json({ data: { enrolled, available } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { packageId } = body;
  if (!packageId) return NextResponse.json({ error: "packageId is required" }, { status: 400 });

  const pkg = await prisma.productPackage.findUnique({ where: { id: packageId } });
  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });
  if (!pkg.entitlementCodes.length)
    return NextResponse.json({ error: "Package has no entitlement codes configured" }, { status: 400 });

  // Upsert one entitlement per code — same logic as settlePaidOrder but without purchaseId.
  // If a REVOKED entitlement already exists, this re-activates it.
  const granted = [];
  for (const code of pkg.entitlementCodes) {
    const ent = await prisma.userEntitlement.upsert({
      where: {
        userId_productCode_tenantId: {
          userId:      params.id,
          productCode: code,
          tenantId:    "default",
        },
      },
      create: {
        userId:      params.id,
        productCode: code,
        status:      "ACTIVE",
        tenantId:    "default",
        // purchaseId intentionally omitted — admin grant, no payment
      },
      update: { status: "ACTIVE" },
    });
    granted.push(ent);
  }

  return NextResponse.json({ data: granted }, { status: 201 });
}
