export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { deckId, cardType, front, back, content, imageUrl, subtopicId } = body;

    if (!deckId) return NextResponse.json({ error: "deckId is required" }, { status: 400 });

    const deck = await prisma.flashcardDeck.findUnique({ where: { id: deckId } });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    const lastCard = await prisma.flashcardCard.findFirst({
      where: { deckId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = (lastCard?.order ?? 0) + 1;

    const card = await prisma.flashcardCard.create({
      data: {
        deckId,
        cardType: cardType ?? "INFO",
        front: front?.trim() ?? "",
        back: back?.trim() ?? "",
        content: content ?? undefined,
        imageUrl: imageUrl?.trim() || null,
        subtopicId: subtopicId || null,
        order: nextOrder,
      },
      include: {
        subtopic: { select: { id: true, name: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_CARD_CREATE",
      entityType: "FlashcardCard",
      entityId: card.id,
      after: { deckId, cardType: card.cardType, order: card.order },
    });

    return NextResponse.json({ data: card }, { status: 201 });
  } catch (err) {
    console.error("Flashcard card POST error:", err);
    return NextResponse.json({ error: "Failed to create card" }, { status: 500 });
  }
}
