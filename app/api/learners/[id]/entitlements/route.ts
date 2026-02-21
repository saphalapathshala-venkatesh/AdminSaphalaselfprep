export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only SUPER_ADMIN can manage entitlements" }, { status: 403 });

  try {
    const body = await req.json();
    const { action, productCode, validUntil } = body;

    if (!action || !["GRANT", "REVOKE"].includes(action)) return NextResponse.json({ error: "action must be GRANT or REVOKE" }, { status: 400 });
    if (!productCode) return NextResponse.json({ error: "productCode is required" }, { status: 400 });

    const learner = await prisma.user.findUnique({ where: { id: params.id } });
    if (!learner) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (action === "GRANT") {
      const ent = await prisma.userEntitlement.upsert({
        where: { userId_productCode_tenantId: { userId: params.id, productCode, tenantId: "default" } },
        create: {
          userId: params.id,
          productCode,
          status: "ACTIVE",
          validUntil: validUntil ? new Date(validUntil) : null,
          tenantId: "default",
        },
        update: {
          status: "ACTIVE",
          validUntil: validUntil ? new Date(validUntil) : null,
        },
      });

      await writeAuditLog({
        actorId: user.id,
        action: "LEARNER_ENTITLEMENT_GRANT",
        entityType: "UserEntitlement",
        entityId: ent.id,
        after: { userId: params.id, productCode, status: "ACTIVE", validUntil },
      });

      return NextResponse.json({ data: ent });
    } else {
      const existing = await prisma.userEntitlement.findUnique({
        where: { userId_productCode_tenantId: { userId: params.id, productCode, tenantId: "default" } },
      });
      if (!existing) return NextResponse.json({ error: "Entitlement not found" }, { status: 404 });

      const ent = await prisma.userEntitlement.update({
        where: { id: existing.id },
        data: { status: "REVOKED" },
      });

      await writeAuditLog({
        actorId: user.id,
        action: "LEARNER_ENTITLEMENT_REVOKE",
        entityType: "UserEntitlement",
        entityId: ent.id,
        before: { userId: params.id, productCode, status: existing.status },
        after: { userId: params.id, productCode, status: "REVOKED" },
      });

      return NextResponse.json({ data: ent });
    }
  } catch (err) {
    console.error("Entitlement update error:", err);
    return NextResponse.json({ error: "Failed to update entitlement" }, { status: 500 });
  }
}
