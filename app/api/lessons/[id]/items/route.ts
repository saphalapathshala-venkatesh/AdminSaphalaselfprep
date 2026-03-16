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
  const { itemType, sourceId, titleSnapshot, unlockAt, externalUrl, description } = body;

  if (!itemType) return NextResponse.json({ error: "itemType required" }, { status: 400 });

  const validTypes: CourseItemType[] = ["VIDEO", "LIVE_CLASS", "PDF", "FLASHCARD_DECK", "HTML_PAGE", "EXTERNAL_LINK"];
  if (!validTypes.includes(itemType)) return NextResponse.json({ error: "Invalid itemType" }, { status: 400 });

  // EXTERNAL_LINK: requires externalUrl, no sourceId
  if (itemType === "EXTERNAL_LINK") {
    if (!externalUrl?.trim()) {
      return NextResponse.json({ error: "externalUrl is required for External Link items" }, { status: 400 });
    }
    try {
      new URL(externalUrl.trim());
    } catch {
      return NextResponse.json({ error: "Invalid URL — must be a valid absolute URL (e.g. https://example.com)" }, { status: 400 });
    }
    const count = await prisma.lessonItem.count({ where: { lessonId: params.id } });
    const item = await prisma.lessonItem.create({
      data: {
        lessonId: params.id,
        itemType: "EXTERNAL_LINK",
        sourceId: null,
        titleSnapshot: titleSnapshot?.trim() || null,
        sortOrder: count,
        unlockAt: unlockAt ? new Date(unlockAt) : null,
        externalUrl: externalUrl.trim(),
        description: description?.trim() || null,
      },
    });
    return NextResponse.json(item, { status: 201 });
  }

  // All other types require a sourceId
  if (!sourceId) return NextResponse.json({ error: "sourceId required" }, { status: 400 });

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
