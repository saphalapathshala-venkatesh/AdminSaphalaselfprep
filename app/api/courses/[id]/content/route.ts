export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

/**
 * GET /api/courses/[id]/content
 * Returns the full course, all CourseFolder records, and all CourseContentItem records
 * with resolved titles/thumbnails from their source tables.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const [folders, items] = await Promise.all([
    prisma.courseFolder.findMany({
      where: { courseId: params.id },
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.courseContentItem.findMany({
      where: { courseId: params.id },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Batch-resolve titles/thumbnails from source tables
  const videoIds   = items.filter(i => i.itemType === "VIDEO").map(i => i.sourceId);
  const liveIds    = items.filter(i => i.itemType === "LIVE_CLASS").map(i => i.sourceId);
  const pdfIds     = items.filter(i => i.itemType === "PDF").map(i => i.sourceId);
  const flashIds   = items.filter(i => i.itemType === "FLASHCARD_DECK").map(i => i.sourceId);

  const [videos, liveClasses, pdfs, flashDecks] = await Promise.all([
    videoIds.length
      ? prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true, thumbnailUrl: true, durationSeconds: true, status: true } })
      : [],
    liveIds.length
      ? prisma.liveClass.findMany({ where: { id: { in: liveIds } }, select: { id: true, title: true, thumbnailUrl: true, status: true, sessionDate: true } })
      : [],
    pdfIds.length
      ? prisma.pdfAsset.findMany({ where: { id: { in: pdfIds } }, select: { id: true, title: true, isPublished: true } })
      : [],
    flashIds.length
      ? prisma.flashcardDeck.findMany({ where: { id: { in: flashIds } }, select: { id: true, title: true, isPublished: true, _count: { select: { cards: true } } } })
      : [],
  ]);

  const vMap  = Object.fromEntries(videos.map(v => [v.id, v]));
  const lMap  = Object.fromEntries(liveClasses.map(l => [l.id, l]));
  const pMap  = Object.fromEntries(pdfs.map(p => [p.id, p]));
  const fMap  = Object.fromEntries(flashDecks.map(d => [d.id, d]));

  const resolvedItems = items.map(item => {
    let title = item.titleSnapshot;
    let thumbnailUrl: string | null = null;
    let meta: Record<string, unknown> = {};
    let sourceMissing = false;

    if (item.itemType === "VIDEO") {
      const v = vMap[item.sourceId];
      if (v) { title = v.title; thumbnailUrl = v.thumbnailUrl; meta = { durationSeconds: v.durationSeconds, status: v.status }; }
      else sourceMissing = true;
    } else if (item.itemType === "LIVE_CLASS") {
      const l = lMap[item.sourceId];
      if (l) { title = l.title; thumbnailUrl = l.thumbnailUrl; meta = { status: l.status, sessionDate: l.sessionDate }; }
      else sourceMissing = true;
    } else if (item.itemType === "PDF") {
      const p = pMap[item.sourceId];
      if (p) { title = p.title; meta = { isPublished: p.isPublished }; }
      else sourceMissing = true;
    } else if (item.itemType === "FLASHCARD_DECK") {
      const d = fMap[item.sourceId];
      if (d) { title = d.title; meta = { isPublished: d.isPublished, cardCount: d._count.cards }; }
      else sourceMissing = true;
    }

    return { ...item, resolvedTitle: title, thumbnailUrl, ...meta, sourceMissing };
  });

  return NextResponse.json({ course, folders, items: resolvedItems });
}
