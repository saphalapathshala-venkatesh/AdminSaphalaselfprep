/**
 * PATCH /api/users/[id]/entitlements/[eid]
 *   Update the status of a single UserEntitlement.
 *   Body: { status: "ACTIVE" | "REVOKED" }
 *
 *   Revoking sets status=REVOKED (soft-delete).
 *   purchaseId and all PaymentOrder/Purchase records are never touched.
 */
export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

const ALLOWED_STATUSES = ["ACTIVE", "REVOKED"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; eid: string } },
) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { status } = body;

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const ent = await prisma.userEntitlement.findUnique({
    where: { id: params.eid },
    select: { id: true, userId: true },
  });

  if (!ent || ent.userId !== params.id) {
    return NextResponse.json({ error: "Entitlement not found" }, { status: 404 });
  }

  const updated = await prisma.userEntitlement.update({
    where: { id: params.eid },
    data:  { status },
  });

  return NextResponse.json({ data: updated });
}
