export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";
import { normalizeCard } from "@/lib/flashcardNormalize";

/**
 * GET /api/student/decks/[id]/cards
 *
 * Student-facing endpoint. Returns all cards for a published, unlocked flashcard deck.
 *
 * Auth: requires a valid student (or admin-preview) session cookie.
 *
 * Response shape:
 * {
 *   deck: { id, title, subtitle, subjectColor, titleTemplate, titleImageUrl,
 *            xpEnabled, xpValue },
 *   items: NormalizedFlashcardCard[],   // ordered by `order` ASC
 *   total: number,
 * }
 *
 * Each card in `items` has top-level `instruction` and `layout` fields in addition
 * to the full per-type `content` JSON. See lib/flashcardNormalize.ts for field docs.
 *
 * Error codes:
 *   401  – not authenticated
 *   403  – deck not yet unlocked (unlockAt is in the future)
 *   404  – deck not found or not published
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deck = await prisma.flashcardDeck.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        subtitle: true,
        subjectColor: true,
        titleTemplate: true,
        titleImageUrl: true,
        xpEnabled: true,
        xpValue: true,
        isPublished: true,
        unlockAt: true,
      },
    });

    if (!deck || !deck.isPublished) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    if (deck.unlockAt && deck.unlockAt > new Date()) {
      return NextResponse.json(
        { error: "This deck is not yet available", unlocksAt: deck.unlockAt.toISOString() },
        { status: 403 }
      );
    }

    const rawCards = await prisma.flashcardCard.findMany({
      where: { deckId: params.id },
      orderBy: { order: "asc" },
    });

    const items = rawCards.map((c) => normalizeCard(c as any));

    return NextResponse.json({
      deck: {
        id: deck.id,
        title: deck.title,
        subtitle: deck.subtitle,
        subjectColor: deck.subjectColor,
        titleTemplate: deck.titleTemplate,
        titleImageUrl: deck.titleImageUrl,
        xpEnabled: deck.xpEnabled,
        xpValue: deck.xpValue,
      },
      items,
      total: items.length,
    });
  } catch (err) {
    console.error("Student deck cards GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
