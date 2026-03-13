export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { writeUserActivity } from "@/lib/userActivity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing || existing.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const block  = Boolean(body.block);
    const reason = block ? (body.reason?.trim() || null) : null;

    const ops: any[] = [
      prisma.user.update({
        where: { id: params.id },
        data: { isBlocked: block, blockedReason: reason },
        select: { id: true, isBlocked: true, blockedReason: true, isActive: true },
      }),
    ];

    // Revoke active sessions when blocking
    if (block) {
      ops.push(
        prisma.session.updateMany({
          where: { userId: params.id, revokedAt: null },
          data: { revokedAt: new Date() },
        })
      );
    }

    const [updated] = await prisma.$transaction(ops);

    const activityType = block ? "USER_BLOCKED" : "USER_UNBLOCKED";
    writeAuditLog({ actorId: admin.id, action: activityType, entityType: "User", entityId: params.id });
    writeUserActivity({ userId: params.id, activityType, meta: { by: admin.id, reason } });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("User block error:", err);
    return NextResponse.json({ error: "Failed to update block status" }, { status: 500 });
  }
}
