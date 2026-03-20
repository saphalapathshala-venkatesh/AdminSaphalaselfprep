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
      tenantId: true, tenant: { select: { id: true, name: true } },
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
    if (body.name !== undefined) data.name = body.name?.trim() || existing.name;

    if (body.email !== undefined) {
      const trimEmail = (body.email || "").trim().toLowerCase() || null;
      if (trimEmail) {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRe.test(trimEmail))
          return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
        const conflict = await prisma.user.findFirst({
          where: { email: trimEmail, NOT: { id: params.id } },
          select: { id: true },
        });
        if (conflict) return NextResponse.json({ error: "Email is already in use by another account" }, { status: 409 });
      }
      data.email = trimEmail;
    }

    if (body.mobile !== undefined) {
      const trimMobile = (body.mobile || "").trim() || null;
      if (trimMobile) {
        const conflict = await prisma.user.findFirst({
          where: { mobile: trimMobile, NOT: { id: params.id } },
          select: { id: true },
        });
        if (conflict) return NextResponse.json({ error: "Mobile number is already in use by another account" }, { status: 409 });
      }
      data.mobile = trimMobile;
    }

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

    // tenantId: null clears the link (B2C); a string links to a tenant (B2B)
    if ("tenantId" in body) {
      const tid = body.tenantId || null;
      if (tid) {
        const tenant = await prisma.tenant.findUnique({ where: { id: tid } });
        if (!tenant) return NextResponse.json({ error: "Selected school/tenant not found" }, { status: 400 });
      }
      data.tenantId = tid;
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: {
        id: true, name: true, email: true, mobile: true, role: true,
        isActive: true, isBlocked: true, blockedReason: true,
        maxWebDevices: true, deletedAt: true, createdAt: true, updatedAt: true,
        tenantId: true, tenant: { select: { id: true, name: true } },
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
