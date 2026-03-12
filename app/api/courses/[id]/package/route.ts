export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * GET /api/courses/[id]/package
 * Returns all CoursePackageItem records for a PACKAGE course,
 * with resolved child course metadata.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id } });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const items = await prisma.coursePackageItem.findMany({
    where: { packageCourseId: params.id },
    orderBy: { sortOrder: "asc" },
  });

  // Resolve child course metadata in one query
  const childIds = items.map(i => i.childCourseId);
  const childCourses = childIds.length
    ? await prisma.course.findMany({
        where: { id: { in: childIds } },
        select: {
          id: true, name: true, description: true, categoryId: true, courseType: true,
          isActive: true, hasHtmlCourse: true, hasVideoCourse: true, hasPdfCourse: true,
          hasTestSeries: true, _count: { select: { videos: true, liveClasses: true } },
        },
      })
    : [];

  const courseMap = Object.fromEntries(childCourses.map(c => [c.id, c]));
  const resolved = items.map(item => ({ ...item, childCourse: courseMap[item.childCourseId] ?? null }));

  return NextResponse.json({ data: resolved, course });
}

/**
 * POST /api/courses/[id]/package
 * Import an existing STANDARD course into this PACKAGE course.
 * Body: { childCourseId: string }
 *
 * Validation:
 *   - packageCourse must be PACKAGE
 *   - childCourse must be STANDARD
 *   - no self-import
 *   - no PACKAGE → PACKAGE
 *   - no duplicate (@@unique enforced)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { childCourseId } = body;

    if (!childCourseId?.trim())
      return NextResponse.json({ error: "childCourseId is required" }, { status: 400 });

    // --- Load both courses in parallel ---
    const [packageCourse, childCourse] = await Promise.all([
      prisma.course.findUnique({ where: { id: params.id } }),
      prisma.course.findUnique({ where: { id: childCourseId } }),
    ]);

    if (!packageCourse) return NextResponse.json({ error: "Package course not found" }, { status: 404 });
    if (!childCourse)   return NextResponse.json({ error: "Child course not found" }, { status: 404 });

    // --- Validation ---
    if (packageCourse.courseType !== "PACKAGE")
      return NextResponse.json({ error: "Only PACKAGE courses can import other courses" }, { status: 400 });

    if (childCourse.courseType !== "STANDARD")
      return NextResponse.json({ error: "Only STANDARD courses can be imported into a package (no PACKAGE→PACKAGE nesting)" }, { status: 400 });

    if (params.id === childCourseId)
      return NextResponse.json({ error: "A course cannot import itself" }, { status: 400 });

    // Check for existing mapping (graceful duplicate message)
    const existing = await prisma.coursePackageItem.findUnique({
      where: { packageCourseId_childCourseId: { packageCourseId: params.id, childCourseId } },
    });
    if (existing)
      return NextResponse.json({ error: "This course is already part of the package" }, { status: 409 });

    // Place at end
    const last = await prisma.coursePackageItem.findFirst({
      where: { packageCourseId: params.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const item = await prisma.coursePackageItem.create({
      data: {
        tenantId:        "default",
        packageCourseId: params.id,
        childCourseId,
        sortOrder,
      },
    });

    writeAuditLog({
      actorId: user.id, action: "PACKAGE_IMPORT", entityType: "CoursePackageItem", entityId: item.id,
      after: { packageCourseId: params.id, childCourseId, childName: childCourse.name },
    });

    return NextResponse.json({ data: { ...item, childCourse: { id: childCourse.id, name: childCourse.name } } }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "This course is already part of the package" }, { status: 409 });
    console.error("Package POST error:", err);
    return NextResponse.json({ error: "Failed to import course" }, { status: 500 });
  }
}
