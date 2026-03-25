export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/courses/[id]/linked-content — list all linked content for a course
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = params.id;

  try {
    const rows = await prisma.courseLinkedContent.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
    });

    // Enrich with title snapshots from source tables
    const byType: Record<string, string[]> = {};
    for (const r of rows) {
      if (!byType[r.contentType]) byType[r.contentType] = [];
      byType[r.contentType].push(r.sourceId);
    }

    const titleMap: Record<string, string> = {};

    await Promise.all(Object.entries(byType).map(async ([type, ids]) => {
      if (type === "TEST_SERIES") {
        const series = await prisma.testSeries.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        for (const s of series) titleMap[s.id] = s.title;
      } else if (type === "PDF") {
        const pdfs = await prisma.pdfAsset.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        for (const p of pdfs) titleMap[p.id] = p.title;
      } else if (type === "EBOOK") {
        const ebooks = await prisma.contentPage.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        for (const e of ebooks) titleMap[e.id] = e.title;
      } else if (type === "VIDEO") {
        const vids = await prisma.video.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        for (const v of vids) titleMap[v.id] = v.title;
      } else if (type === "FLASHCARD_DECK") {
        const decks = await prisma.flashcardDeck.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        for (const d of decks) titleMap[d.id] = d.title;
      } else if (type === "LIVE_CLASS") {
        const lcs = await prisma.liveClass.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        for (const lc of lcs) titleMap[lc.id] = lc.title;
      }
    }));

    const enriched = rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      contentType: r.contentType,
      sourceId: r.sourceId,
      sortOrder: r.sortOrder,
      titleOverride: r.titleOverride,
      titleSnapshot: r.titleOverride ?? titleMap[r.sourceId] ?? "(Deleted)",
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ items: enriched });
  } catch (err) {
    console.error("[linked-content GET] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/courses/[id]/linked-content — add items to a course
// Body: { items: [{ contentType, sourceId, titleOverride? }] }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = params.id;

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const body = await req.json();
  const items: { contentType: string; sourceId: string; titleOverride?: string }[] = body.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items array is required and must not be empty" }, { status: 400 });
  }

  try {
    // Get current max sortOrder to append new items at the end
    const maxRow = await prisma.courseLinkedContent.findFirst({
      where: { courseId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let nextOrder = (maxRow?.sortOrder ?? -1) + 1;

    const created: unknown[] = [];
    for (const item of items) {
      if (!item.contentType || !item.sourceId) continue;
      try {
        const row = await prisma.courseLinkedContent.create({
          data: {
            courseId,
            contentType: item.contentType as any,
            sourceId: item.sourceId,
            titleOverride: item.titleOverride ?? null,
            sortOrder: nextOrder++,
          },
        });
        created.push(row);
      } catch (e: any) {
        // Unique constraint violation = already linked — skip silently
        if (e.code !== "P2002") throw e;
      }
    }

    return NextResponse.json({ ok: true, created: created.length });
  } catch (err) {
    console.error("[linked-content POST] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
