import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

async function getContentUnlockAt(itemType: string, sourceId: string): Promise<Date | null> {
  if (itemType === "VIDEO") {
    const r = await prisma.video.findUnique({ where: { id: sourceId }, select: { unlockAt: true } });
    return r?.unlockAt ?? null;
  }
  if (itemType === "HTML_PAGE") {
    const r = await prisma.contentPage.findUnique({ where: { id: sourceId }, select: { unlockAt: true } });
    return r?.unlockAt ?? null;
  }
  if (itemType === "PDF") {
    const r = await prisma.pdfAsset.findUnique({ where: { id: sourceId }, select: { unlockAt: true } });
    return r?.unlockAt ?? null;
  }
  if (itemType === "FLASHCARD_DECK") {
    const r = await prisma.flashcardDeck.findUnique({ where: { id: sourceId }, select: { unlockAt: true } });
    return r?.unlockAt ?? null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { lessonItemId } = body;
  if (!lessonItemId) return NextResponse.json({ error: "lessonItemId required" }, { status: 400 });

  // Fetch item to check effective unlock
  const item = await prisma.lessonItem.findUnique({ where: { id: lessonItemId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Effective unlock: LessonItem.unlockAt ?? sourceContent.unlockAt ?? null
  const contentUnlockAt = await getContentUnlockAt(item.itemType, item.sourceId);
  const effectiveUnlockAt: Date | null = item.unlockAt ?? contentUnlockAt ?? null;

  if (effectiveUnlockAt !== null && effectiveUnlockAt > new Date()) {
    return NextResponse.json(
      { error: "ITEM_LOCKED", message: "This item is not yet available.", unlocksAt: effectiveUnlockAt.toISOString() },
      { status: 403 }
    );
  }

  await prisma.userItemCompletion.upsert({
    where: { userId_lessonItemId: { userId: user.id, lessonItemId } },
    create: { userId: user.id, lessonItemId, completedAt: new Date() },
    update: { completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
