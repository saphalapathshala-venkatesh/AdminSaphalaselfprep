import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const annotation = await prisma.learnerAnnotation.findUnique({ where: { id: params.id } });
  if (!annotation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (annotation.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.learnerAnnotation.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
