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
    const existing = await prisma.flashcardCard.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    const body = await req.json();
    const { cardType, front, back, content, imageUrl, subtopicId } = body;

    const data: any = {};
    if (cardType !== undefined) data.cardType = cardType;
    if (front !== undefined) data.front = front?.trim() ?? "";
    if (back !== undefined) data.back = back?.trim() ?? "";
    if (content !== undefined) data.content = content ?? null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl?.trim() || null;
    if (subtopicId !== undefined) data.subtopicId = subtopicId || null;

    const updated = await prisma.flashcardCard.update({
      where: { id: params.id },
      data,
      include: {
        subtopic: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_CARD_UPDATE",
      entityType: "FlashcardCard",
      entityId: params.id,
      before: { front: existing.front, back: existing.back, imageUrl: existing.imageUrl, subtopicId: existing.subtopicId },
      after: { front: updated.front, back: updated.back, imageUrl: updated.imageUrl, subtopicId: updated.subtopicId },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Flashcard card PUT error:", err);
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const card = await prisma.flashcardCard.findUnique({ where: { id: params.id } });
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    await prisma.flashcardCard.delete({ where: { id: params.id } });

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_CARD_DELETE",
      entityType: "FlashcardCard",
      entityId: params.id,
      before: { front: card.front, back: card.back, deckId: card.deckId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Flashcard card DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  }
}
