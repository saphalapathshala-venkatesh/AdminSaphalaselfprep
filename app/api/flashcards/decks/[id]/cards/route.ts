export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "25")));
  const search = searchParams.get("search")?.trim();
  const subtopicId = searchParams.get("subtopicId");

  try {
    const deck = await prisma.flashcardDeck.findUnique({ where: { id: params.id } });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    const where: any = { deckId: params.id };
    if (search) {
      where.OR = [
        { front: { contains: search, mode: "insensitive" } },
        { back: { contains: search, mode: "insensitive" } },
      ];
    }
    if (subtopicId) where.subtopicId = subtopicId;

    const [items, total] = await Promise.all([
      prisma.flashcardCard.findMany({
        where,
        include: {
          subtopic: {
            select: {
              id: true,
              name: true,
              topicId: true,
              topic: {
                select: {
                  id: true,
                  name: true,
                  subjectId: true,
                  subject: {
                    select: {
                      id: true,
                      name: true,
                      categoryId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { order: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.flashcardCard.count({ where }),
    ]);

    return NextResponse.json({ deck, items, total, page, pageSize });
  } catch (err) {
    console.error("Flashcard cards GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deck = await prisma.flashcardDeck.findUnique({ where: { id: params.id } });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

    const body = await req.json();
    const { front, back, imageUrl, subtopicId } = body;

    if (!front?.trim()) return NextResponse.json({ error: "Front text is required" }, { status: 400 });
    if (!back?.trim()) return NextResponse.json({ error: "Back text is required" }, { status: 400 });

    const maxOrder = await prisma.flashcardCard.aggregate({
      where: { deckId: params.id },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    const card = await prisma.flashcardCard.create({
      data: {
        deckId: params.id,
        front: front.trim(),
        back: back.trim(),
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
      after: { front: card.front, back: card.back, deckId: params.id },
    });

    return NextResponse.json({ data: card }, { status: 201 });
  } catch (err) {
    console.error("Flashcard card POST error:", err);
    return NextResponse.json({ error: "Failed to create card" }, { status: 500 });
  }
}
