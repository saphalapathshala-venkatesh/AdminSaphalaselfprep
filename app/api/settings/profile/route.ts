export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lastLoginLog = await prisma.auditLog.findFirst({
    where: { actorId: user.id, action: "ADMIN_LOGIN" },
    orderBy: { createdAt: "desc" },
    skip: 1,
  });

  const activeSessions = await prisma.session.count({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, type: "ADMIN" },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLogin: lastLoginLog?.createdAt ?? null,
    activeSessions,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ error: "Name must be 80 characters or fewer" }, { status: 400 });

  const updated = await prisma.user.update({ where: { id: user.id }, data: { name } });

  writeAuditLog({ actorId: user.id, action: "PROFILE_UPDATED", entityType: "User", entityId: user.id, after: { name } }).catch(() => {});

  return NextResponse.json({ ok: true, name: updated.name });
}
