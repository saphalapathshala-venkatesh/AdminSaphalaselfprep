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
    const deck = await prisma.flashcardDeck.findUnique({ where: { id: params.id } });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    const body = await req.json();
    const { orderedCardIds } = body;

    if (!Array.isArray(orderedCardIds) || orderedCardIds.length === 0) {
      return NextResponse.json({ error: "orderedCardIds is required" }, { status: 400 });
    }

    const existingCards = await prisma.flashcardCard.findMany({
      where: { deckId: params.id },
      select: { id: true },
    });

    const existingIds = new Set(existingCards.map((c) => c.id));
    const providedIds = new Set(orderedCardIds);

    if (existingIds.size !== providedIds.size) {
      return NextResponse.json(
        { error: `Card count mismatch: expected ${existingIds.size}, got ${providedIds.size}` },
        { status: 400 }
      );
    }

    for (const cid of orderedCardIds) {
      if (!existingIds.has(cid)) {
        return NextResponse.json({ error: `Card ${cid} does not belong to this deck` }, { status: 400 });
      }
    }

    await prisma.$transaction(
      orderedCardIds.map((cardId: string, index: number) =>
        prisma.flashcardCard.update({
          where: { id: cardId },
          data: { order: index },
        })
      )
    );

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_CARD_REORDER",
      entityType: "FlashcardDeck",
      entityId: params.id,
      after: { orderedCardIds },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Flashcard reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder cards" }, { status: 500 });
  }
}
