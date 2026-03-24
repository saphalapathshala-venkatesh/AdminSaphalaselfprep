export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { parsePaiseFromRupees, validateCoursePricing, calcDiscountPercent } from "@/lib/pricing";

function parseProductTypes(body: any) {
  return {
    hasHtmlCourse:     Boolean(body.hasHtmlCourse),
    hasVideoCourse:    Boolean(body.hasVideoCourse),
    hasPdfCourse:      Boolean(body.hasPdfCourse),
    hasTestSeries:     Boolean(body.hasTestSeries),
    hasFlashcardDecks: Boolean(body.hasFlashcardDecks),
  };
}

function validateProductTypes(types: ReturnType<typeof parseProductTypes>): string | null {
  if (!types.hasHtmlCourse && !types.hasVideoCourse && !types.hasPdfCourse && !types.hasTestSeries && !types.hasFlashcardDecks) {
    return "At least one capability must be selected";
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search") || "";
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));
  const skip     = (page - 1) * pageSize;
  const all      = searchParams.get("all") === "true";
  const isActive = searchParams.get("isActive");

  const where: any = { tenantId: "default" };
  if (search)              where.name     = { contains: search, mode: "insensitive" };
  if (isActive === "true") where.isActive  = true;
  if (isActive === "false") where.isActive = false;

  try {
    if (all) {
      const items = await prisma.course.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, isActive: true, courseType: true,
          hasHtmlCourse: true, hasVideoCourse: true, hasPdfCourse: true, hasTestSeries: true, hasFlashcardDecks: true,
        },
      });
      return NextResponse.json({ data: items });
    }

    const [items, total] = await Promise.all([
      prisma.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { _count: { select: { videos: true, liveClasses: true } } },
      }),
      prisma.course.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Courses GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, categoryId, examId, isActive } = body;

    if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const productTypes = parseProductTypes(body);
    const typeError = validateProductTypes(productTypes);
    if (typeError) return NextResponse.json({ error: typeError }, { status: 400 });

    const courseType = body.courseType === "PACKAGE" ? "PACKAGE" : "STANDARD";

    const VALID_PRODUCT_CATEGORIES = [
      "FREE_DEMO","COMPLETE_PREP_PACK","VIDEO_ONLY","SELF_PREP",
      "PDF_ONLY","TEST_SERIES","FLASHCARDS_ONLY","CURRENT_AFFAIRS",
    ];
    const productCategory = body.productCategory && VALID_PRODUCT_CATEGORIES.includes(body.productCategory)
      ? body.productCategory : null;

    // Pricing
    const isFree = Boolean(body.isFree);
    const mrpPaise = isFree ? null : (body.mrpPaise !== undefined && body.mrpPaise !== null ? (parseInt(String(body.mrpPaise)) || null) : null);
    const sellingPricePaise = isFree ? null : (body.sellingPricePaise !== undefined && body.sellingPricePaise !== null ? (parseInt(String(body.sellingPricePaise)) || null) : null);
    const pricingError = validateCoursePricing(isFree, mrpPaise, sellingPricePaise);
    if (pricingError) return NextResponse.json({ error: pricingError }, { status: 400 });

    const course = await prisma.course.create({
      data: {
        tenantId:     "default",
        name:         name.trim(),
        description:  description?.trim() || null,
        categoryId:   categoryId || null,
        examId:       examId || null,
        courseType,
        productCategory: productCategory as any,
        isActive:     isActive !== undefined ? Boolean(isActive) : true,
        featured:     Boolean(body.featured),
        isFree,
        mrpPaise,
        sellingPricePaise,
        validityType:   body.validityType   || null,
        validityDays:   body.validityDays   ? Math.max(1, parseInt(body.validityDays) || 0)   : null,
        validityMonths: body.validityMonths ? Math.max(1, parseInt(body.validityMonths) || 0) : null,
        validUntil:     body.validUntil     ? new Date(body.validUntil)  : null,
        thumbnailUrl:           body.thumbnailUrl?.trim() || null,
        xpRedemptionEnabled:    Boolean(body.xpRedemptionEnabled),
        xpRedemptionMaxPercent: body.xpRedemptionMaxPercent
          ? Math.min(3, Math.max(1, parseInt(body.xpRedemptionMaxPercent) || 1))
          : 1,
        ...productTypes,
      },
    });

    writeAuditLog({ actorId: user.id, action: "COURSE_CREATE", entityType: "Course", entityId: course.id, after: { name: course.name, ...productTypes } });
    return NextResponse.json({ data: course }, { status: 201 });
  } catch (err) {
    console.error("Courses POST error:", err);
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
