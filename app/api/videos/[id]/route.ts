export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const video = await prisma.video.findUnique({
    where: { id: params.id },
    include: {
      faculty: { select: { id: true, name: true, title: true } },
      course: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
    },
  });
  if (!video) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: video });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await prisma.video.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const {
      title, description, facultyId, courseId, categoryId, examId, subjectId, topicId, subtopicId,
      accessType, status, lessonOrder, durationSeconds, thumbnailUrl,
      provider, providerVideoId, hlsUrl, playbackUrl,
      processingStatus, processingError, allowPreview, tags, publishedAt, unlockAt,
    } = body;

    const wasPublished = existing.status !== "PUBLISHED" && status === "PUBLISHED";

    const updated = await prisma.video.update({
      where: { id: params.id },
      data: {
        title: title?.trim() || existing.title,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        facultyId: facultyId !== undefined ? (facultyId || null) : existing.facultyId,
        courseId: courseId !== undefined ? (courseId || null) : existing.courseId,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
        examId: examId !== undefined ? (examId || null) : existing.examId,
        subjectId: subjectId !== undefined ? (subjectId || null) : existing.subjectId,
        topicId: topicId !== undefined ? (topicId || null) : existing.topicId,
        subtopicId: subtopicId !== undefined ? (subtopicId || null) : existing.subtopicId,
        accessType: accessType || existing.accessType,
        status: status || existing.status,
        lessonOrder: lessonOrder !== undefined ? parseInt(lessonOrder) : existing.lessonOrder,
        durationSeconds: durationSeconds !== undefined ? (durationSeconds ? parseInt(durationSeconds) : null) : existing.durationSeconds,
        thumbnailUrl: thumbnailUrl !== undefined ? (thumbnailUrl?.trim() || null) : existing.thumbnailUrl,
        provider: provider || existing.provider,
        providerVideoId: providerVideoId !== undefined ? (providerVideoId?.trim() || null) : existing.providerVideoId,
        hlsUrl: hlsUrl !== undefined ? (hlsUrl?.trim() || null) : existing.hlsUrl,
        playbackUrl: playbackUrl !== undefined ? (playbackUrl?.trim() || null) : existing.playbackUrl,
        processingStatus: processingStatus !== undefined ? processingStatus : existing.processingStatus,
        processingError: processingError !== undefined ? processingError : existing.processingError,
        allowPreview: allowPreview !== undefined ? Boolean(allowPreview) : existing.allowPreview,
        tags: Array.isArray(tags) ? tags : existing.tags,
        publishedAt: wasPublished ? new Date() : (publishedAt !== undefined ? (publishedAt ? new Date(publishedAt) : null) : existing.publishedAt),
        unlockAt: unlockAt !== undefined ? (unlockAt ? new Date(unlockAt) : null) : existing.unlockAt,
        xpEnabled: body.xpEnabled !== undefined ? Boolean(body.xpEnabled) : existing.xpEnabled,
        xpValue: body.xpValue !== undefined ? Math.max(0, parseInt(body.xpValue) || 0) : existing.xpValue,
      },
      include: {
        faculty: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
      },
    });

    writeAuditLog({
      actorId: user.id, action: "VIDEO_UPDATE", entityType: "Video", entityId: params.id,
      before: { title: existing.title, status: existing.status },
      after: { title: updated.title, status: updated.status },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Video PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.video.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.status === "PUBLISHED" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete a published video" }, { status: 403 });
    }

    await prisma.video.delete({ where: { id: params.id } });
    writeAuditLog({ actorId: user.id, action: "VIDEO_DELETE", entityType: "Video", entityId: params.id, before: { title: existing.title } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Video DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
