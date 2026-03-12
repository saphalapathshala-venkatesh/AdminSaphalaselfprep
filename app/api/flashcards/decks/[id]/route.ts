export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.flashcardDeck.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { title, description, categoryId, subjectId, topicId, subtopicId, isPublished, xpEnabled, xpValue } = body;

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (subjectId !== undefined) data.subjectId = subjectId || null;
    if (topicId !== undefined) data.topicId = topicId || null;
    if (subtopicId !== undefined) data.subtopicId = subtopicId || null;
    if (isPublished !== undefined) data.isPublished = isPublished;
    if (xpEnabled !== undefined) data.xpEnabled = xpEnabled === true;
    if (xpValue !== undefined) data.xpValue = Math.max(0, parseInt(xpValue) || 0);

    const updated = await prisma.flashcardDeck.update({
      where: { id: params.id },
      data,
      include: {
        _count: { select: { cards: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_DECK_UPDATE",
      entityType: "FlashcardDeck",
      entityId: params.id,
      before: { title: existing.title, description: existing.description, isPublished: existing.isPublished },
      after: { title: updated.title, description: updated.description, isPublished: updated.isPublished },
    });

    if (isPublished !== undefined && isPublished !== existing.isPublished) {
      await writeAuditLog({
        actorId: user.id,
        action: isPublished ? "FLASHCARD_DECK_PUBLISH" : "FLASHCARD_DECK_UNPUBLISH",
        entityType: "FlashcardDeck",
        entityId: params.id,
        before: { isPublished: existing.isPublished },
        after: { isPublished: updated.isPublished },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Flashcard deck PUT error:", err);
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deck = await prisma.flashcardDeck.findUnique({ where: { id: params.id } });
    if (!deck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (deck.isPublished && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can delete a published deck." },
        { status: 403 }
      );
    }

    await prisma.flashcardDeck.delete({ where: { id: params.id } });

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_DECK_DELETE",
      entityType: "FlashcardDeck",
      entityId: params.id,
      before: { title: deck.title, isPublished: deck.isPublished },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Flashcard deck DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}
