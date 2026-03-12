export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { writeUserActivity } from "@/lib/userActivity";

export async function PUT(req: NextRequest, { params }: { params: { id: string; deviceId: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const device = await prisma.userDevice.findFirst({
    where: { id: params.deviceId, userId: params.id },
  });
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = {};
  if (body.label     !== undefined) data.label     = body.label?.trim() || null;
  if (body.isBlocked !== undefined) data.isBlocked  = Boolean(body.isBlocked);
  if (body.isActive  !== undefined) data.isActive   = Boolean(body.isActive);

  const updated = await prisma.userDevice.update({ where: { id: params.deviceId }, data });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; deviceId: string } }) {
  const admin = await getSessionUserFromRequest(_req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const device = await prisma.userDevice.findFirst({
    where: { id: params.deviceId, userId: params.id },
  });
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.userDevice.update({
    where: { id: params.deviceId },
    data: { isActive: false },
  });

  writeAuditLog({ actorId: admin.id, action: "DEVICE_REMOVED", entityType: "UserDevice", entityId: params.deviceId });
  writeUserActivity({ userId: params.id, activityType: "DEVICE_REMOVED", meta: { deviceId: params.deviceId, by: admin.id } });

  return NextResponse.json({ ok: true });
}
