export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "pdfs");
const MAX_SIZE = 20 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const search = searchParams.get("search")?.trim();
  const isPublished = searchParams.get("isPublished");
  const categoryId = searchParams.get("categoryId");
  const subjectId = searchParams.get("subjectId");
  const topicId = searchParams.get("topicId");
  const subtopicId = searchParams.get("subtopicId");

  try {
    const where: any = {};
    if (search) where.title = { contains: search, mode: "insensitive" };
    if (isPublished === "true") where.isPublished = true;
    if (isPublished === "false") where.isPublished = false;
    if (categoryId) where.categoryId = categoryId;
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (subtopicId) where.subtopicId = subtopicId;

    const [items, total] = await Promise.all([
      prisma.pdfAsset.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
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
    const title = formData.get("title") as string;
    const file = formData.get("file") as File | null;
    const categoryId = (formData.get("categoryId") as string) || null;
    const subjectId = (formData.get("subjectId") as string) || null;
    const topicId = (formData.get("topicId") as string) || null;
    const subtopicId = (formData.get("subtopicId") as string) || null;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "PDF file is required" }, { status: 400 });

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 20MB limit" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = ".pdf";
    const uniqueName = `${Date.now()}_${randomBytes(8).toString("hex")}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/pdfs/${uniqueName}`;

    const asset = await prisma.pdfAsset.create({
      data: {
        title: title.trim(),
        fileUrl,
        fileSize: file.size,
        mimeType: file.type,
        categoryId,
        subjectId,
        topicId,
        subtopicId,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "PDFASSET_CREATE",
      entityType: "PdfAsset",
      entityId: asset.id,
      after: { title: asset.title, fileUrl: asset.fileUrl, fileSize: asset.fileSize },
    });

    return NextResponse.json({ data: asset }, { status: 201 });
  } catch (err) {
    console.error("PDF assets POST error:", err);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}
