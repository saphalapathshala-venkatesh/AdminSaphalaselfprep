import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { isActive } = body;

    if (typeof isActive !== "boolean") return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { isActive },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "LEARNER_STATUS_UPDATE",
      entityType: "User",
      entityId: params.id,
      before: { isActive: existing.isActive },
      after: { isActive: updated.isActive },
    });

    return NextResponse.json({ data: { id: updated.id, isActive: updated.isActive } });
  } catch (err) {
    console.error("Learner status error:", err);
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
