import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { lessonItemId } = body;
  if (!lessonItemId) return NextResponse.json({ error: "lessonItemId required" }, { status: 400 });

  await prisma.userItemCompletion.upsert({
    where: { userId_lessonItemId: { userId: user.id, lessonItemId } },
    create: { userId: user.id, lessonItemId, completedAt: new Date() },
    update: { completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
