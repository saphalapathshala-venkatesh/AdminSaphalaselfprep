export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "SUPER_ADMIN only" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const revokeSession = body.revokeSessions !== false;

    const [deviceResult] = await Promise.all([
      prisma.userDevice.updateMany({ where: {}, data: { isActive: false } }),
      revokeSession
        ? prisma.session.updateMany({ where: { revokedAt: null }, data: { revokedAt: new Date() } })
        : Promise.resolve(),
    ]);

    writeAuditLog({
      actorId: admin.id,
      action: "GLOBAL_DEVICE_RESET",
      entityType: "System",
      after: { devicesReset: deviceResult.count, revokeSession },
    });

    return NextResponse.json({ ok: true, devicesReset: deviceResult.count });
  } catch (err) {
    console.error("Global device reset error:", err);
    return NextResponse.json({ error: "Failed to reset all devices" }, { status: 500 });
  }
}
