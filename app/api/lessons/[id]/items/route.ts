import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CourseItemType } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.lessonItem.findMany({
    where: { lessonId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { itemType, sourceId, titleSnapshot, unlockAt } = body;

  if (!itemType || !sourceId) return NextResponse.json({ error: "itemType and sourceId required" }, { status: 400 });

  const validTypes: CourseItemType[] = ["VIDEO", "LIVE_CLASS", "PDF", "FLASHCARD_DECK", "HTML_PAGE"];
  if (!validTypes.includes(itemType)) return NextResponse.json({ error: "Invalid itemType" }, { status: 400 });

  const count = await prisma.lessonItem.count({ where: { lessonId: params.id } });

  const item = await prisma.lessonItem.create({
    data: {
      lessonId: params.id,
      itemType,
      sourceId,
      titleSnapshot: titleSnapshot || null,
      sortOrder: count,
      unlockAt: unlockAt ? new Date(unlockAt) : null,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
