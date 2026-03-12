export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { writeUserActivity } from "@/lib/userActivity";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const devices = await prisma.userDevice.findMany({
    where: { userId: params.id },
    orderBy: { lastSeenAt: "desc" },
  });
  return NextResponse.json({ data: devices });
}

// DELETE /api/users/[id]/devices — reset all devices for this user
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const revokeSession = searchParams.get("revokeSessions") !== "false";

    await prisma.userDevice.updateMany({
      where: { userId: params.id },
      data: { isActive: false },
    });

    if (revokeSession) {
      await prisma.session.updateMany({
        where: { userId: params.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    writeAuditLog({ actorId: admin.id, action: "DEVICE_RESET", entityType: "User", entityId: params.id });
    writeUserActivity({ userId: params.id, activityType: "DEVICE_RESET", meta: { by: admin.id, revokeSession } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Device reset error:", err);
    return NextResponse.json({ error: "Failed to reset devices" }, { status: 500 });
  }
}
