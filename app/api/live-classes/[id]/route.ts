export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lc = await prisma.liveClass.findUnique({
    where: { id: params.id },
    include: {
      faculty: { select: { id: true, name: true, title: true } },
      course: { select: { id: true, name: true } },
      createdBy: { select: { id: true, email: true } },
    },
  });
  if (!lc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: lc });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const existing = await prisma.liveClass.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const {
      title, description, facultyId, courseId, categoryId, examId, subjectId, topicId, subtopicId,
      sessionDate, startTime, endTime, accessType, status,
      platform, joinUrl, sessionCode, thumbnailUrl,
      notifyLearners, recordingPolicy, replayVideoId, publishedAt,
    } = body;

    const wasPublished = existing.status !== "PUBLISHED" && status === "PUBLISHED";

    const updated = await prisma.liveClass.update({
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
        sessionDate: sessionDate !== undefined ? (sessionDate ? new Date(sessionDate) : null) : existing.sessionDate,
        startTime: startTime !== undefined ? (startTime?.trim() || null) : existing.startTime,
        endTime: endTime !== undefined ? (endTime?.trim() || null) : existing.endTime,
        accessType: accessType || existing.accessType,
        status: status || existing.status,
        platform: platform || existing.platform,
        joinUrl: joinUrl !== undefined ? (joinUrl?.trim() || null) : existing.joinUrl,
        sessionCode: sessionCode !== undefined ? (sessionCode?.trim() || null) : existing.sessionCode,
        thumbnailUrl: thumbnailUrl !== undefined ? (thumbnailUrl?.trim() || null) : existing.thumbnailUrl,
        notifyLearners: notifyLearners !== undefined ? Boolean(notifyLearners) : existing.notifyLearners,
        recordingPolicy: recordingPolicy || existing.recordingPolicy,
        replayVideoId: replayVideoId !== undefined ? (replayVideoId || null) : existing.replayVideoId,
        publishedAt: wasPublished ? new Date() : (publishedAt !== undefined ? (publishedAt ? new Date(publishedAt) : null) : existing.publishedAt),
      },
      include: {
        faculty: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
      },
    });

    writeAuditLog({
      actorId: user.id, action: "LIVE_CLASS_UPDATE", entityType: "LiveClass", entityId: params.id,
      before: { title: existing.title, status: existing.status },
      after: { title: updated.title, status: updated.status },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("LiveClass PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.liveClass.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (["PUBLISHED", "COMPLETED"].includes(existing.status) && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete a published or completed session" }, { status: 403 });
    }

    await prisma.liveClass.delete({ where: { id: params.id } });
    writeAuditLog({ actorId: user.id, action: "LIVE_CLASS_DELETE", entityType: "LiveClass", entityId: params.id, before: { title: existing.title } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("LiveClass DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
