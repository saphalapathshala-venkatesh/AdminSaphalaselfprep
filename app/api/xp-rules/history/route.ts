export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");

  try {
    const where: any = { action: "XP_RULE_UPDATE" };
    if (key) {
      where.OR = [
        { after: { path: ["key"], equals: key } },
        { before: { path: ["key"], equals: key } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error("XpRules history error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
