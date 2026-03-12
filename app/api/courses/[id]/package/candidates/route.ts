export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

/**
 * GET /api/courses/[id]/package/candidates
 * Returns STANDARD courses that can be imported into this PACKAGE course.
 *
 * Filters applied automatically:
 *   - courseType === STANDARD
 *   - not the package course itself
 *   - not already imported
 *   - same categoryId as the package course (when set)
 *   - isActive === true (by default; pass ?includeInactive=true to relax)
 *
 * Optional query params:
 *   search           — title search
 *   includeInactive  — "true" to include inactive courses
 *   hasVideoCourse   — "true" to filter by product type
 *   hasPdfCourse     — "true"
 *   hasHtmlCourse    — "true"
 *   hasTestSeries    — "true"
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search          = searchParams.get("search")?.trim() || "";
  const includeInactive = searchParams.get("includeInactive") === "true";

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  if (course.courseType !== "PACKAGE")
    return NextResponse.json({ error: "Only PACKAGE courses have importable candidates" }, { status: 400 });

  // Already-imported child IDs
  const alreadyImported = await prisma.coursePackageItem.findMany({
    where: { packageCourseId: params.id },
    select: { childCourseId: true },
  });
  const excludeIds = [params.id, ...alreadyImported.map(i => i.childCourseId)];

  const where: any = {
    tenantId:   "default",
    courseType: "STANDARD",
    id:         { notIn: excludeIds },
  };

  // Category filter — same category as package (if set)
  if (course.categoryId) where.categoryId = course.categoryId;

  // Active filter
  if (!includeInactive) where.isActive = true;

  // Product-type filters (all optional)
  const ptKeys = ["hasVideoCourse", "hasPdfCourse", "hasHtmlCourse", "hasTestSeries"] as const;
  for (const key of ptKeys) {
    if (searchParams.get(key) === "true") where[key] = true;
  }

  // Title search
  if (search) where.name = { contains: search, mode: "insensitive" };

  try {
    const candidates = await prisma.course.findMany({
      where,
      orderBy: { name: "asc" },
      take: 60,
      select: {
        id: true, name: true, description: true, categoryId: true, courseType: true,
        isActive: true, hasHtmlCourse: true, hasVideoCourse: true, hasPdfCourse: true,
        hasTestSeries: true, _count: { select: { videos: true, liveClasses: true } },
      },
    });

    return NextResponse.json({
      data: candidates,
      packageCategory: course.categoryId,
      alreadyImportedCount: alreadyImported.length,
    });
  } catch (err) {
    console.error("Package candidates error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
