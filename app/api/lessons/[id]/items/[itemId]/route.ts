import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { unlockAt, titleSnapshot } = body;

  const data: Record<string, unknown> = {};
  if (unlockAt !== undefined) data.unlockAt = unlockAt ? new Date(unlockAt) : null;
  if (titleSnapshot !== undefined) data.titleSnapshot = titleSnapshot || null;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const item = await prisma.lessonItem.update({ where: { id: params.itemId }, data });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.lessonItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ ok: true });
}
