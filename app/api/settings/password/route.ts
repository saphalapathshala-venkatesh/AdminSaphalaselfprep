export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateNewPassword } from "@/lib/safetyChecks";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { currentPassword, newPassword, confirmPassword } = body;

  if (!currentPassword || !newPassword || !confirmPassword)
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  if (newPassword !== confirmPassword)
    return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
  const pwError = validateNewPassword(newPassword, currentPassword);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  writeAuditLog({ actorId: user.id, action: "PASSWORD_CHANGED", entityType: "User", entityId: user.id }).catch(() => {});

  return NextResponse.json({ ok: true });
}
