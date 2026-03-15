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
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const published = searchParams.get("published");

  const where: any = {};
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;

  try {
    const [items, total] = await Promise.all([
      prisma.testSeries.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { _count: { select: { tests: true } } },
      }),
      prisma.testSeries.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("TestSeries GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, description, categoryId, examId, subjectIds, pricePaise, discountPaise, currency, thumbnailUrl, scheduleJson, isFree, isPublished } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const series = await prisma.testSeries.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        categoryId: categoryId || null,
        examId: examId || null,
        subjectIds: subjectIds || [],
        pricePaise: parseInt(pricePaise) || 0,
        discountPaise: parseInt(discountPaise) || 0,
        currency: currency || "INR",
        thumbnailUrl: thumbnailUrl?.trim() || null,
        scheduleJson: scheduleJson || null,
        isFree: isFree === true,
        isPublished: isPublished || false,
        createdById: user.id,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "TESTSERIES_CREATE",
      entityType: "TestSeries",
      entityId: series.id,
      after: { title: series.title, categoryId: series.categoryId, isPublished: series.isPublished },
    });

    return NextResponse.json({ data: series }, { status: 201 });
  } catch (err) {
    console.error("TestSeries POST error:", err);
    return NextResponse.json({ error: "Failed to create test series" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, title, description, categoryId, examId, subjectIds, pricePaise, discountPaise, currency, thumbnailUrl, scheduleJson, isFree, isPublished } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await prisma.testSeries.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.testSeries.update({
      where: { id },
      data: {
        title: title?.trim() || existing.title,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
        examId: examId !== undefined ? (examId || null) : existing.examId,
        subjectIds: subjectIds !== undefined ? subjectIds : existing.subjectIds,
        pricePaise: pricePaise !== undefined ? parseInt(pricePaise) || 0 : existing.pricePaise,
        discountPaise: discountPaise !== undefined ? parseInt(discountPaise) || 0 : existing.discountPaise,
        currency: currency || existing.currency,
        thumbnailUrl: thumbnailUrl !== undefined ? (thumbnailUrl?.trim() || null) : existing.thumbnailUrl,
        scheduleJson: scheduleJson !== undefined ? scheduleJson : existing.scheduleJson,
        isFree: isFree !== undefined ? isFree === true : existing.isFree,
        isPublished: isPublished !== undefined ? isPublished : existing.isPublished,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: isPublished !== undefined && isPublished !== existing.isPublished ? "TESTSERIES_PUBLISH" : "TESTSERIES_UPDATE",
      entityType: "TestSeries",
      entityId: id,
      before: { title: existing.title, isPublished: existing.isPublished },
      after: { title: updated.title, isPublished: updated.isPublished },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("TestSeries PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const existing = await prisma.testSeries.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const publishedTestCount = await prisma.test.count({ where: { seriesId: id, isPublished: true } });
    if (publishedTestCount > 0) {
      return NextResponse.json({
        error: `Cannot delete: this series has ${publishedTestCount} published test${publishedTestCount > 1 ? "s" : ""}. Unpublish all tests in this series before deleting it.`,
      }, { status: 400 });
    }

    if (existing.isPublished && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete published series" }, { status: 403 });
    }

    await prisma.testSeries.delete({ where: { id } });

    await writeAuditLog({
      actorId: user.id,
      action: "TESTSERIES_DELETE",
      entityType: "TestSeries",
      entityId: id,
      before: { title: existing.title },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("TestSeries DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
