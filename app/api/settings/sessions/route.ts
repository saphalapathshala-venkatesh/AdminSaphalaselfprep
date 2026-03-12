export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentToken = req.cookies.get("admin_session")?.value;

  const result = await prisma.session.updateMany({
    where: {
      userId: user.id,
      token: { not: currentToken ?? "" },
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  writeAuditLog({ actorId: user.id, action: "SESSIONS_REVOKED", entityType: "Session", after: { count: result.count } }).catch(() => {});

  return NextResponse.json({ ok: true, revoked: result.count });
}
