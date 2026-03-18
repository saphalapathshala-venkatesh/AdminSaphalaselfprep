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
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim();
  const isPublished = searchParams.get("isPublished");
  const isDownloadable = searchParams.get("isDownloadable");
  const categoryId = searchParams.get("categoryId");
  const subjectId = searchParams.get("subjectId");
  const topicId = searchParams.get("topicId");
  const subtopicId = searchParams.get("subtopicId");

  try {
    const where: any = {};
    if (search) where.title = { contains: search, mode: "insensitive" };
    if (isPublished === "true") where.isPublished = true;
    if (isPublished === "false") where.isPublished = false;
    if (isDownloadable === "true") where.isDownloadable = true;
    if (isDownloadable === "false") where.isDownloadable = false;
    if (categoryId) where.categoryId = categoryId;
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (subtopicId) where.subtopicId = subtopicId;

    const [items, total] = await Promise.all([
      prisma.pdfAsset.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.pdfAsset.count({ where }),
    ]);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    console.error("PDF assets GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      title, fileUrl, fileSize, mimeType,
      categoryId, examId, subjectId, topicId, subtopicId,
      isDownloadable, isPublished, unlockAt,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!fileUrl?.trim()) return NextResponse.json({ error: "File URL is required" }, { status: 400 });

    const asset = await prisma.pdfAsset.create({
      data: {
        title: title.trim(),
        fileUrl,
        fileSize: fileSize || 0,
        mimeType: mimeType || "application/pdf",
        categoryId: categoryId || null,
        examId: examId || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        isDownloadable: isDownloadable !== false,
        isPublished: isPublished === true,
        publishedAt: isPublished ? new Date() : null,
        unlockAt: unlockAt ? new Date(unlockAt) : null,
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "PDFASSET_CREATE",
      entityType: "PdfAsset",
      entityId: asset.id,
      after: { title: asset.title, fileUrl: asset.fileUrl, fileSize: asset.fileSize, isDownloadable: asset.isDownloadable },
    });

    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (err) {
    console.error("PDF assets POST error:", err);
    return NextResponse.json({ error: "Failed to save PDF" }, { status: 500 });
  }
}
