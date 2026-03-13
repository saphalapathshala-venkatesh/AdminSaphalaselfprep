import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin || (admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = params;
  const body = await req.json().catch(() => ({}));
  const resetWarnings = body.resetWarnings !== false;

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: userId },
    data: {
      infringementBlocked: false,
      isBlocked: false,
      blockedReason: null,
      ...(resetWarnings && { infringementWarnings: 0 }),
    },
  });

  // Audit log
  await prisma.userActivity.create({
    data: {
      userId: admin.id,
      activityType: "USER_UNBLOCKED",
      meta: JSON.stringify({ targetUserId: userId, targetName: target.name, reason: "Manual infringement unblock by admin" }),
    },
  });

  return NextResponse.json({ success: true });
}
