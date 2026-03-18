export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const PDF_SELECT = {
  id: true,
  title: true,
  fileUrl: true,
  fileSize: true,
  mimeType: true,
  categoryId: true,
  examId: true,
  subjectId: true,
  topicId: true,
  subtopicId: true,
  isDownloadable: true,
  isPublished: true,
  publishedAt: true,
  unlockAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

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
        select: PDF_SELECT,
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string | null)?.trim();
    const categoryId = (formData.get("categoryId") as string | null) || null;
    const examId = (formData.get("examId") as string | null) || null;
    const subjectId = (formData.get("subjectId") as string | null) || null;
    const topicId = (formData.get("topicId") as string | null) || null;
    const subtopicId = (formData.get("subtopicId") as string | null) || null;

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 400 });

    const fileData = Buffer.from(await file.arrayBuffer());

    const host = req.headers.get("host") || "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";

    const asset = await prisma.pdfAsset.create({
      data: {
        title,
        fileUrl: "",
        fileData,
        fileSize: file.size,
        mimeType: "application/pdf",
        categoryId: categoryId || null,
        examId: examId || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        isDownloadable: true,
        isPublished: false,
        createdById: user.id,
      },
      select: { id: true },
    });

    const fileUrl = `${proto}://${host}/api/pdf-serve/${asset.id}`;
    const updated = await prisma.pdfAsset.update({
      where: { id: asset.id },
      data: { fileUrl },
      select: PDF_SELECT,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "PDFASSET_CREATE",
      entityType: "PdfAsset",
      entityId: asset.id,
      after: { title: updated.title, fileUrl: updated.fileUrl, fileSize: updated.fileSize },
    });

    return NextResponse.json({ data: updated }, { status: 201 });
  } catch (err) {
    console.error("PDF assets POST error:", err);
    return NextResponse.json({ error: "Failed to save PDF" }, { status: 500 });
  }
}
