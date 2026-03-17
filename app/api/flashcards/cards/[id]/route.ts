export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { normalizeCard, mergeContentFields } from "@/lib/flashcardNormalize";

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
    // `instruction` and `layout` can be top-level params (or embedded inside `content`).
    const { cardType, front, back, content, instruction, layout, imageUrl, subtopicId } = body;

    const data: any = {};
    if (cardType !== undefined) data.cardType = cardType;
    if (front !== undefined) data.front = front?.trim() ?? "";
    if (back !== undefined) data.back = back?.trim() ?? "";
    if (imageUrl !== undefined) data.imageUrl = imageUrl?.trim() || null;
    if (subtopicId !== undefined) data.subtopicId = subtopicId || null;

    // Content update: preserve existing instruction/layout unless the request explicitly overrides them.
    // This means a standard admin save (which sends `content` but not `instruction`) never accidentally
    // wipes out an instruction that was set via a separate API call.
    if (content !== undefined || instruction !== undefined || layout !== undefined) {
      const existingContent = (existing.content as Record<string, unknown>) ?? {};
      // Use provided content as base, otherwise start from existing
      const base = content !== undefined ? (content ?? {}) : existingContent;
      // Preserve existing instruction/layout when the incoming content doesn't include them
      const existingInstruction = existingContent.instruction;
      const existingLayout = existingContent.layout;
      const baseWithPreserved: Record<string, unknown> = {
        ...(existingInstruction !== undefined && (base as any).instruction === undefined ? { instruction: existingInstruction } : {}),
        ...(existingLayout !== undefined && (base as any).layout === undefined ? { layout: existingLayout } : {}),
        ...(base as Record<string, unknown>),
      };
      data.content = mergeContentFields(baseWithPreserved, instruction, layout);
      if (Object.keys(data.content).length === 0) data.content = null;
    }

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

    return NextResponse.json({ data: normalizeCard(updated as any) });
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
