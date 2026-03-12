export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

const VALID_TYPES = ["VIDEO", "LIVE_CLASS", "PDF", "FLASHCARD_DECK"] as const;
type CandidateType = (typeof VALID_TYPES)[number];

/**
 * GET /api/courses/[id]/candidates
 * Query params:
 *   type       — required: VIDEO | LIVE_CLASS | PDF | FLASHCARD_DECK
 *   search     — optional text search on title
 *   subjectId  — optional taxonomy filter
 *   topicId    — optional taxonomy filter
 *   subtopicId — optional taxonomy filter
 *   pageSize   — default 40
 *
 * Automatically:
 *   - Filters by course.categoryId when set
 *   - Excludes items already mapped into this course (any folder)
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type      = searchParams.get("type") as CandidateType | null;
  const search    = searchParams.get("search")?.trim()    || "";
  const subjectId = searchParams.get("subjectId")?.trim() || null;
  const topicId   = searchParams.get("topicId")?.trim()   || null;
  const subtopicId= searchParams.get("subtopicId")?.trim()|| null;
  const pageSize  = Math.min(60, Math.max(1, parseInt(searchParams.get("pageSize") || "40")));

  if (!type || !VALID_TYPES.includes(type))
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Already-mapped sourceIds for this type in this course (across all folders)
  const mapped = await prisma.courseContentItem.findMany({
    where: { courseId: params.id, itemType: type },
    select: { sourceId: true },
  });
  const excludeIds = mapped.map(m => m.sourceId);

  // Base taxonomy filter — use course.categoryId if set
  const taxBase: Record<string, any> = {};
  if (course.categoryId) taxBase.categoryId = course.categoryId;
  if (subjectId)         taxBase.subjectId  = subjectId;
  if (topicId)           taxBase.topicId    = topicId;
  if (subtopicId)        taxBase.subtopicId = subtopicId;

  const excludeFilter = excludeIds.length ? { id: { notIn: excludeIds } } : {};

  try {
    if (type === "VIDEO") {
      const items = await prisma.video.findMany({
        where: {
          tenantId: "default",
          ...taxBase,
          ...excludeFilter,
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, thumbnailUrl: true, durationSeconds: true, status: true, categoryId: true, courseId: true },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      });
      return NextResponse.json({ type, data: items, courseCategory: course.categoryId });
    }

    if (type === "LIVE_CLASS") {
      const items = await prisma.liveClass.findMany({
        where: {
          tenantId: "default",
          ...taxBase,
          ...excludeFilter,
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, thumbnailUrl: true, status: true, sessionDate: true, platform: true, categoryId: true, courseId: true },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      });
      return NextResponse.json({ type, data: items, courseCategory: course.categoryId });
    }

    if (type === "PDF") {
      const items = await prisma.pdfAsset.findMany({
        where: {
          ...taxBase,
          ...excludeFilter,
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, isPublished: true, categoryId: true },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      });
      return NextResponse.json({ type, data: items, courseCategory: course.categoryId });
    }

    if (type === "FLASHCARD_DECK") {
      const items = await prisma.flashcardDeck.findMany({
        where: {
          ...taxBase,
          ...excludeFilter,
          ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
        },
        select: { id: true, title: true, isPublished: true, categoryId: true, _count: { select: { cards: true } } },
        orderBy: { createdAt: "desc" },
        take: pageSize,
      });
      return NextResponse.json({ type, data: items, courseCategory: course.categoryId });
    }

    return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  } catch (err) {
    console.error("Candidates GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
