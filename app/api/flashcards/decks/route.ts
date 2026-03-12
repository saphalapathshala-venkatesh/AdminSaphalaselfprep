export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim();
  const isPublished = searchParams.get("isPublished");
  const categoryId = searchParams.get("categoryId");
  const subjectId = searchParams.get("subjectId");
  const topicId = searchParams.get("topicId");
  const subtopicId = searchParams.get("subtopicId");

  try {
    const where: any = {};
    if (search) where.title = { contains: search, mode: "insensitive" };
    if (isPublished === "true") where.isPublished = true;
    if (isPublished === "false") where.isPublished = false;
    if (categoryId) where.categoryId = categoryId;
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (subtopicId) where.subtopicId = subtopicId;

    const [items, total] = await Promise.all([
      prisma.flashcardDeck.findMany({
        where,
        include: {
          _count: { select: { cards: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.flashcardDeck.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    console.error("Flashcard decks GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, categoryId, subjectId, topicId, subtopicId } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const deck = await prisma.flashcardDeck.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        categoryId: categoryId || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        createdById: user.id,
      },
      include: {
        _count: { select: { cards: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "FLASHCARD_DECK_CREATE",
      entityType: "FlashcardDeck",
      entityId: deck.id,
      after: { title: deck.title, categoryId: deck.categoryId, subtopicId: deck.subtopicId },
    });

    return NextResponse.json({ data: deck }, { status: 201 });
  } catch (err) {
    console.error("Flashcard decks POST error:", err);
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 });
  }
}
