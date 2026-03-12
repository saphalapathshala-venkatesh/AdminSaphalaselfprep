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

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, mobile: true, role: true,
      isActive: true, isBlocked: true, blockedReason: true,
      maxWebDevices: true, deletedAt: true, createdAt: true, updatedAt: true,
      _count: { select: { devices: true, sessions: true, activities: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: user });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing || existing.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data: any = {};
    if (body.name         !== undefined) data.name         = body.name?.trim() || existing.name;
    if (body.maxWebDevices !== undefined) {
      const n = parseInt(body.maxWebDevices);
      if (isNaN(n) || n < 1 || n > 5) return NextResponse.json({ error: "maxWebDevices must be between 1 and 5" }, { status: 400 });
      data.maxWebDevices = n;
    }
    if (body.role !== undefined) {
      const valid = ["STUDENT", "ADMIN", "SUPER_ADMIN"];
      if (!valid.includes(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      data.role = body.role;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true, name: true, email: true, mobile: true, role: true,
        isActive: true, isBlocked: true, blockedReason: true,
        maxWebDevices: true, deletedAt: true, createdAt: true, updatedAt: true,
      },
    });

    writeAuditLog({ actorId: admin.id, action: "USER_EDIT", entityType: "User", entityId: params.id });
    writeUserActivity({ userId: params.id, activityType: "USER_EDITED", meta: { editedBy: admin.id } });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("User PUT error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "SUPER_ADMIN") return NextResponse.json({ error: "SUPER_ADMIN only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  try {
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (hard) {
      await prisma.user.delete({ where: { id: params.id } });
      writeAuditLog({ actorId: admin.id, action: "USER_HARD_DELETE", entityType: "User", entityId: params.id });
    } else {
      // Soft delete: set deletedAt + revoke all sessions
      await prisma.$transaction([
        prisma.user.update({ where: { id: params.id }, data: { deletedAt: new Date() } }),
        prisma.session.updateMany({
          where: { userId: params.id, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);
      writeAuditLog({ actorId: admin.id, action: "USER_SOFT_DELETE", entityType: "User", entityId: params.id });
      writeUserActivity({ userId: params.id, activityType: "USER_SOFT_DELETED", meta: { deletedBy: admin.id } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("User DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
