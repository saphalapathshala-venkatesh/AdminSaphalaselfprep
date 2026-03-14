export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateNewPassword } from "@/lib/safetyChecks";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { newPassword, confirmPassword, mustChangePassword } = body;

    if (!newPassword || !confirmPassword)
      return NextResponse.json({ error: "New password and confirmation are required" }, { status: 400 });
    if (newPassword !== confirmPassword)
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });

    const pwError = validateNewPassword(newPassword);
    if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target || target.deletedAt)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: params.id },
      data: {
        passwordHash,
        mustChangePassword: mustChangePassword === true,
      },
    });

    writeAuditLog({
      actorId: admin.id,
      action: "ADMIN_PASSWORD_RESET",
      entityType: "User",
      entityId: params.id,
      after: {
        mustChangePassword: mustChangePassword === true,
        resetBy: admin.email,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin password reset error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
