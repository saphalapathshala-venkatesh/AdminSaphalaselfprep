export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

function validateProductTypes(body: any, existing?: any): string | null {
  const hasHtml      = body.hasHtmlCourse      !== undefined ? Boolean(body.hasHtmlCourse)      : existing?.hasHtmlCourse;
  const hasVideo     = body.hasVideoCourse     !== undefined ? Boolean(body.hasVideoCourse)     : existing?.hasVideoCourse;
  const hasPdf       = body.hasPdfCourse       !== undefined ? Boolean(body.hasPdfCourse)       : existing?.hasPdfCourse;
  const hasTest      = body.hasTestSeries      !== undefined ? Boolean(body.hasTestSeries)      : existing?.hasTestSeries;
  const hasFlashcard = body.hasFlashcardDecks  !== undefined ? Boolean(body.hasFlashcardDecks)  : existing?.hasFlashcardDecks;
  if (!hasHtml && !hasVideo && !hasPdf && !hasTest && !hasFlashcard) {
    return "At least one capability must be selected";
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({
    where: { id: params.id },
    include: { _count: { select: { videos: true, liveClasses: true } } },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: course });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const existing = await prisma.course.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const typeError = validateProductTypes(body, existing);
    if (typeError) return NextResponse.json({ error: typeError }, { status: 400 });

    // --- courseType change safety checks ---
    let courseType: "STANDARD" | "PACKAGE" = existing.courseType as "STANDARD" | "PACKAGE";
    if (body.courseType !== undefined && body.courseType !== existing.courseType) {
      const newType = body.courseType === "PACKAGE" ? "PACKAGE" : "STANDARD";

      if (newType === "STANDARD" && existing.courseType === "PACKAGE") {
        // Downgrade: block if already has imported child courses
        const childCount = await prisma.coursePackageItem.count({ where: { packageCourseId: params.id } });
        if (childCount > 0)
          return NextResponse.json({ error: `Cannot change to Standard: this course has ${childCount} imported course(s). Remove all imports first.` }, { status: 409 });
      }

      if (newType === "PACKAGE" && existing.courseType === "STANDARD") {
        // Upgrade: block if this course is already a child inside another package
        const parentCount = await prisma.coursePackageItem.count({ where: { childCourseId: params.id } });
        if (parentCount > 0)
          return NextResponse.json({ error: "Cannot change to Package: this course is already imported inside another package course." }, { status: 409 });
      }

      courseType = newType;
    }

    const VALID_PRODUCT_CATEGORIES = [
      "FREE_DEMO","COMPLETE_PREP_PACK","VIDEO_ONLY","SELF_PREP",
      "PDF_ONLY","TEST_SERIES","FLASHCARDS_ONLY","CURRENT_AFFAIRS",
    ];
    let productCategory: string | null = existing.productCategory ?? null;
    if (body.productCategory !== undefined) {
      productCategory = body.productCategory && VALID_PRODUCT_CATEGORIES.includes(body.productCategory)
        ? body.productCategory : null;
    }

    const updated = await prisma.course.update({
      where: { id: params.id },
      data: {
        name:           body.name?.trim()  || existing.name,
        description:    body.description   !== undefined ? (body.description?.trim() || null) : existing.description,
        categoryId:     body.categoryId    !== undefined ? (body.categoryId  || null) : existing.categoryId,
        courseType,
        productCategory: productCategory as any,
        isActive:       body.isActive      !== undefined ? Boolean(body.isActive)     : existing.isActive,
        featured:       body.featured      !== undefined ? Boolean(body.featured)      : existing.featured,
        hasHtmlCourse:     body.hasHtmlCourse     !== undefined ? Boolean(body.hasHtmlCourse)     : existing.hasHtmlCourse,
        hasVideoCourse:    body.hasVideoCourse    !== undefined ? Boolean(body.hasVideoCourse)    : existing.hasVideoCourse,
        hasPdfCourse:      body.hasPdfCourse      !== undefined ? Boolean(body.hasPdfCourse)      : existing.hasPdfCourse,
        hasTestSeries:     body.hasTestSeries     !== undefined ? Boolean(body.hasTestSeries)     : existing.hasTestSeries,
        hasFlashcardDecks: body.hasFlashcardDecks !== undefined ? Boolean(body.hasFlashcardDecks) : existing.hasFlashcardDecks,
        thumbnailUrl:           body.thumbnailUrl           !== undefined ? (body.thumbnailUrl?.trim() || null) : existing.thumbnailUrl,
        xpRedemptionEnabled:    body.xpRedemptionEnabled    !== undefined ? Boolean(body.xpRedemptionEnabled)  : existing.xpRedemptionEnabled,
        xpRedemptionMaxPercent: body.xpRedemptionMaxPercent !== undefined
          ? Math.min(3, Math.max(1, parseInt(body.xpRedemptionMaxPercent) || 1))
          : existing.xpRedemptionMaxPercent,
      },
    });

    writeAuditLog({
      actorId: user.id, action: "COURSE_UPDATE", entityType: "Course", entityId: params.id,
      before: { name: existing.name }, after: { name: updated.name },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Course PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "SUPER_ADMIN only" }, { status: 403 });

  try {
    const existing = await prisma.course.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.course.delete({ where: { id: params.id } });
    writeAuditLog({ actorId: user.id, action: "COURSE_DELETE", entityType: "Course", entityId: params.id, before: { name: existing.name } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Course DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
