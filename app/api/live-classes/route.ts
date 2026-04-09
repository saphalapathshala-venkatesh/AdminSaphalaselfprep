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
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const courseId = searchParams.get("courseId") || "";
  const facultyId = searchParams.get("facultyId") || "";
  const platform = searchParams.get("platform") || "";

  const where: any = { tenantId: "default" };
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (status) where.status = status;
  if (facultyId) where.facultyId = facultyId;
  if (platform) where.platform = platform;
  // courseId filter: match either the legacy field OR the junction table
  if (courseId) where.OR = [{ courseId }, { courses: { some: { courseId } } }];

  try {
    const [items, total] = await Promise.all([
      prisma.liveClass.findMany({
        where,
        orderBy: { sessionDate: "desc" },
        skip,
        take: pageSize,
        include: {
          faculty: { select: { id: true, name: true } },
          course: { select: { id: true, name: true } },
          courses: { select: { courseId: true, course: { select: { id: true, name: true } } } },
          createdBy: { select: { id: true, email: true } },
        },
      }),
      prisma.liveClass.count({ where }),
    ]);
    return NextResponse.json({ data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    console.error("LiveClasses GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      title, description, facultyId, courseIds, categoryId, examId, subjectId, topicId, subtopicId,
      sessionDate, startTime, endTime, accessType, status,
      platform, joinUrl, sessionCode, thumbnailUrl,
      notifyLearners, recordingPolicy, unlockAt,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const selectedCourseIds: string[] = Array.isArray(courseIds) ? courseIds.filter(Boolean) : [];

    const lc = await prisma.liveClass.create({
      data: {
        tenantId: "default",
        title: title.trim(),
        description: description?.trim() || null,
        facultyId: facultyId || null,
        // legacy single courseId — keep first selected course for backward compat
        courseId: selectedCourseIds[0] || null,
        categoryId: categoryId || null,
        examId: examId || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        sessionDate: sessionDate ? new Date(sessionDate) : null,
        startTime: startTime?.trim() || null,
        endTime: endTime?.trim() || null,
        accessType: accessType || "FREE",
        status: status || "DRAFT",
        platform: platform || "ZOOM",
        joinUrl: joinUrl?.trim() || null,
        sessionCode: sessionCode?.trim() || null,
        thumbnailUrl: thumbnailUrl?.trim() || null,
        notifyLearners: Boolean(notifyLearners),
        recordingPolicy: recordingPolicy || "NO_RECORD",
        unlockAt: unlockAt ? new Date(unlockAt) : null,
        createdById: user.id,
        // create junction records for all selected courses
        courses: selectedCourseIds.length > 0
          ? { create: selectedCourseIds.map(cid => ({ courseId: cid })) }
          : undefined,
      },
      include: {
        faculty: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        courses: { select: { courseId: true, course: { select: { id: true, name: true } } } },
      },
    });

    writeAuditLog({ actorId: user.id, action: "LIVE_CLASS_CREATE", entityType: "LiveClass", entityId: lc.id, after: { title: lc.title, status: lc.status } });
    return NextResponse.json({ data: lc }, { status: 201 });
  } catch (err) {
    console.error("LiveClasses POST error:", err);
    return NextResponse.json({ error: "Failed to create live class" }, { status: 500 });
  }
}
