export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { unlink } from "fs/promises";
import path from "path";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.pdfAsset.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { title, categoryId, examId, subjectId, topicId, subtopicId, isPublished, isDownloadable } = body;

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (examId !== undefined) data.examId = examId || null;
    if (subjectId !== undefined) data.subjectId = subjectId || null;
    if (topicId !== undefined) data.topicId = topicId || null;
    if (subtopicId !== undefined) data.subtopicId = subtopicId || null;
    if (isDownloadable !== undefined) data.isDownloadable = Boolean(isDownloadable);

    if (isPublished !== undefined) {
      data.isPublished = isPublished;
      if (isPublished && !existing.isPublished) {
        data.publishedAt = new Date();
      } else if (!isPublished && existing.isPublished) {
        data.publishedAt = null;
      }
    }

    const updated = await prisma.pdfAsset.update({
      where: { id: params.id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "PDFASSET_UPDATE",
      entityType: "PdfAsset",
      entityId: params.id,
      before: { title: existing.title, isPublished: existing.isPublished },
      after: { title: updated.title, isPublished: updated.isPublished },
    });

    if (isPublished !== undefined && isPublished !== existing.isPublished) {
      await writeAuditLog({
        actorId: user.id,
        action: isPublished ? "PDFASSET_PUBLISH" : "PDFASSET_UNPUBLISH",
        entityType: "PdfAsset",
        entityId: params.id,
        before: { isPublished: existing.isPublished },
        after: { isPublished: updated.isPublished },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PDF asset PUT error:", err);
    return NextResponse.json({ error: "Failed to update PDF asset" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const asset = await prisma.pdfAsset.findUnique({ where: { id: params.id } });
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (asset.isPublished && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can delete published content." },
        { status: 403 }
      );
    }

    await prisma.pdfAsset.delete({ where: { id: params.id } });

    try {
      const relativePath = asset.fileUrl.startsWith("/") ? asset.fileUrl.slice(1) : asset.fileUrl;
      const filePath = path.join(process.cwd(), "public", relativePath);
      await unlink(filePath);
    } catch {}

    await writeAuditLog({
      actorId: user.id,
      action: "PDFASSET_DELETE",
      entityType: "PdfAsset",
      entityId: params.id,
      before: { title: asset.title, fileUrl: asset.fileUrl, isPublished: asset.isPublished },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PDF asset DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete PDF asset" }, { status: 500 });
  }
}
