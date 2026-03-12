export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// Build a where clause from context query params — exact match on all 5 fields.
// Null means "unspecified" (not any). Treats missing param and empty string both as null.
function buildContextWhere(sp: URLSearchParams) {
  const get = (k: string) => sp.get(k) || null;
  return {
    tenantId: "default",
    courseId:    get("courseId"),
    categoryId:  get("categoryId"),
    subjectId:   get("subjectId"),
    topicId:     get("topicId"),
    subtopicId:  get("subtopicId"),
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const where = buildContextWhere(searchParams);

  // Require at least one context field to be non-null so we never return everything
  const hasContext = Object.entries(where).some(([k, v]) => k !== "tenantId" && v !== null);
  if (!hasContext) return NextResponse.json({ error: "At least one context field (courseId, categoryId, subjectId, topicId, subtopicId) is required" }, { status: 400 });

  try {
    const items = await prisma.contentFlowItem.findMany({
      where,
      orderBy: { displayOrder: "asc" },
    });

    if (items.length === 0) return NextResponse.json({ data: [] });

    // Batch-resolve current titles/thumbnails by content type
    const videoIds     = items.filter(i => i.contentType === "VIDEO").map(i => i.contentId);
    const pdfIds       = items.filter(i => i.contentType === "PDF").map(i => i.contentId);
    const flashIds     = items.filter(i => i.contentType === "FLASHCARD").map(i => i.contentId);

    const [videos, pdfs, flashDecks] = await Promise.all([
      videoIds.length
        ? prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, title: true, thumbnailUrl: true, durationSeconds: true, status: true } })
        : [],
      pdfIds.length
        ? prisma.pdfAsset.findMany({ where: { id: { in: pdfIds } }, select: { id: true, title: true, isPublished: true } })
        : [],
      flashIds.length
        ? prisma.flashcardDeck.findMany({
            where: { id: { in: flashIds } },
            select: { id: true, title: true, isPublished: true, _count: { select: { cards: true } } },
          })
        : [],
    ]);

    const videoMap   = Object.fromEntries(videos.map(v => [v.id, v]));
    const pdfMap     = Object.fromEntries(pdfs.map(p => [p.id, p]));
    const flashMap   = Object.fromEntries(flashDecks.map(d => [d.id, d]));

    const resolved = items.map(item => {
      let currentTitle  = item.titleSnapshot;
      let thumbnailUrl: string | null = null;
      let extra: Record<string, unknown> = {};
      let contentMissing = false;

      if (item.contentType === "VIDEO") {
        const v = videoMap[item.contentId];
        if (v) { currentTitle = v.title; thumbnailUrl = v.thumbnailUrl; extra = { durationSeconds: v.durationSeconds, status: v.status }; }
        else contentMissing = true;
      } else if (item.contentType === "PDF") {
        const p = pdfMap[item.contentId];
        if (p) { currentTitle = p.title; extra = { isPublished: p.isPublished }; }
        else contentMissing = true;
      } else if (item.contentType === "FLASHCARD") {
        const d = flashMap[item.contentId];
        if (d) { currentTitle = d.title; extra = { isPublished: d.isPublished, cardCount: d._count.cards }; }
        else contentMissing = true;
      }

      return { ...item, currentTitle, thumbnailUrl, ...extra, contentMissing };
    });

    return NextResponse.json({ data: resolved });
  } catch (err) {
    console.error("ContentFlow GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { courseId, categoryId, subjectId, topicId, subtopicId, contentType, contentId, titleSnapshot } = body;

    if (!contentType || !["VIDEO","PDF","FLASHCARD"].includes(contentType))
      return NextResponse.json({ error: "contentType must be VIDEO, PDF, or FLASHCARD" }, { status: 400 });
    if (!contentId?.trim())
      return NextResponse.json({ error: "contentId is required" }, { status: 400 });

    const hasContext = !!(courseId || categoryId || subjectId || topicId || subtopicId);
    if (!hasContext)
      return NextResponse.json({ error: "At least one context field is required" }, { status: 400 });

    const contextWhere = {
      tenantId:   "default",
      courseId:   courseId   || null,
      categoryId: categoryId || null,
      subjectId:  subjectId  || null,
      topicId:    topicId    || null,
      subtopicId: subtopicId || null,
    };

    // Prevent duplicate — same contentType+contentId in same context
    const existing = await prisma.contentFlowItem.findFirst({
      where: { ...contextWhere, contentType, contentId },
    });
    if (existing)
      return NextResponse.json({ error: "This item is already in the flow for this context" }, { status: 409 });

    // Find max order in this context
    const maxItem = await prisma.contentFlowItem.findFirst({
      where: contextWhere,
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });
    const nextOrder = (maxItem?.displayOrder ?? -1) + 1;

    const item = await prisma.contentFlowItem.create({
      data: {
        ...contextWhere,
        contentType,
        contentId,
        titleSnapshot: titleSnapshot?.trim() || null,
        displayOrder: nextOrder,
      },
    });

    writeAuditLog({ actorId: user.id, action: "FLOW_ITEM_ADD", entityType: "ContentFlowItem", entityId: item.id, after: { contentType, contentId, displayOrder: nextOrder } });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    console.error("ContentFlow POST error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
