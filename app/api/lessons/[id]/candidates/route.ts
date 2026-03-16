import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const itemType = url.searchParams.get("itemType");
  const search = url.searchParams.get("search") || "";
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const subjectId = url.searchParams.get("subjectId") || undefined;

  const existing = await prisma.lessonItem.findMany({
    where: { lessonId: params.id },
    select: { itemType: true, sourceId: true },
  });
  const excludeMap: Record<string, string[]> = {};
  for (const e of existing) {
    if (!e.sourceId) continue; // EXTERNAL_LINK items have no sourceId
    if (!excludeMap[e.itemType]) excludeMap[e.itemType] = [];
    excludeMap[e.itemType].push(e.sourceId);
  }

  const take = 50;

  if (itemType === "VIDEO") {
    const rows = await prisma.video.findMany({
      where: {
        status: { in: ["READY", "PUBLISHED"] },
        ...(categoryId ? { categoryId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        id: { notIn: excludeMap["VIDEO"] || [] },
      },
      take,
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true, categoryId: true, subjectId: true },
    });
    return NextResponse.json(rows.map((r) => ({ id: r.id, title: r.title, itemType: "VIDEO", meta: { status: r.status } })));
  }

  if (itemType === "HTML_PAGE") {
    const rows = await prisma.contentPage.findMany({
      where: {
        isPublished: true,
        ...(categoryId ? { categoryId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        id: { notIn: excludeMap["HTML_PAGE"] || [] },
      },
      take,
      orderBy: { title: "asc" },
      select: { id: true, title: true, categoryId: true, subjectId: true },
    });
    return NextResponse.json(rows.map((r) => ({ id: r.id, title: r.title, itemType: "HTML_PAGE" })));
  }

  if (itemType === "PDF") {
    const rows = await prisma.pdfAsset.findMany({
      where: {
        isPublished: true,
        ...(categoryId ? { categoryId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        id: { notIn: excludeMap["PDF"] || [] },
      },
      take,
      orderBy: { title: "asc" },
      select: { id: true, title: true, categoryId: true, subjectId: true },
    });
    return NextResponse.json(rows.map((r) => ({ id: r.id, title: r.title, itemType: "PDF" })));
  }

  if (itemType === "FLASHCARD_DECK") {
    const rows = await prisma.flashcardDeck.findMany({
      where: {
        isPublished: true,
        ...(categoryId ? { categoryId } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        id: { notIn: excludeMap["FLASHCARD_DECK"] || [] },
      },
      take,
      orderBy: { title: "asc" },
      select: { id: true, title: true, categoryId: true, subjectId: true, subjectColor: true },
    });
    return NextResponse.json(rows.map((r) => ({ id: r.id, title: r.title, itemType: "FLASHCARD_DECK", meta: { subjectColor: r.subjectColor } })));
  }

  return NextResponse.json({ error: "itemType required: VIDEO | HTML_PAGE | PDF | FLASHCARD_DECK" }, { status: 400 });
}
