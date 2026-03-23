/**
 * GET /api/student/live-classes
 *
 * Returns live classes visible to the authenticated student.
 * Supports filtering by courseId, status, and pagination.
 * Each item includes computed `liveStatus` (upcoming | live_now | completed)
 * and exposes `joinUrl`, `zoomPassword`, and `zoomMeetingId` only when
 * the session is active (live_now) or within 15 minutes of start.
 *
 * Students must be authenticated via the `session` cookie.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

function computeLiveStatus(lc: {
  sessionDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
}): "upcoming" | "live_now" | "completed" | "cancelled" | "draft" {
  if (lc.status === "CANCELLED") return "cancelled";
  if (lc.status === "DRAFT")     return "draft";
  if (lc.status === "COMPLETED") return "completed";

  if (!lc.sessionDate || !lc.startTime) return "upcoming";

  const dateStr = lc.sessionDate.toISOString().split("T")[0];
  const startIso = new Date(`${dateStr}T${lc.startTime}:00+05:30`);
  const endIso   = lc.endTime
    ? new Date(`${dateStr}T${lc.endTime}:00+05:30`)
    : new Date(startIso.getTime() + 60 * 60 * 1000); // default 1 hr

  const now = new Date();
  if (now >= startIso && now <= endIso) return "live_now";
  if (now > endIso)                     return "completed";
  return "upcoming";
}

const JOIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes before start

function shouldExposeJoinUrl(lc: {
  sessionDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
}, liveStatus: string): boolean {
  if (liveStatus === "live_now") return true;

  if (!lc.sessionDate || !lc.startTime) return false;
  const dateStr = lc.sessionDate.toISOString().split("T")[0];
  const startIso = new Date(`${dateStr}T${lc.startTime}:00+05:30`);
  const now = new Date();
  return now >= new Date(startIso.getTime() - JOIN_WINDOW_MS) && now < startIso;
}

export async function GET(req: NextRequest) {
  const student = await getStudentUserFromRequest(req);
  if (!student) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  const skip     = (page - 1) * pageSize;
  const courseId = searchParams.get("courseId") || "";
  const statusFilter = searchParams.get("status") || "";

  const now = new Date();

  const where: any = {
    tenantId: "default",
    status: { in: ["SCHEDULED", "PUBLISHED", "COMPLETED"] },
    OR: [
      { unlockAt: null },
      { unlockAt: { lte: now } },
    ],
  };

  if (courseId)     where.courseId = courseId;
  if (statusFilter) where.status   = statusFilter;

  try {
    const [items, total] = await Promise.all([
      prisma.liveClass.findMany({
        where,
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          status: true,
          platform: true,
          accessType: true,
          thumbnailUrl: true,
          unlockAt: true,
          courseId: true,
          categoryId: true,
          subjectId: true,
          topicId: true,
          subtopicId: true,
          joinUrl: true,
          sessionCode: true,
          zoomMeetingId: true,
          zoomPassword: true,
          replayVideoId: true,
          recordingPolicy: true,
          publishedAt: true,
          faculty: { select: { id: true, name: true, title: true, avatarUrl: true } },
          course: { select: { id: true, name: true } },
        },
      }),
      prisma.liveClass.count({ where }),
    ]);

    const enriched = items.map(lc => {
      const liveStatus = computeLiveStatus(lc);
      const canJoin    = shouldExposeJoinUrl(lc, liveStatus);

      return {
        id:           lc.id,
        title:        lc.title,
        description:  lc.description,
        sessionDate:  lc.sessionDate,
        startTime:    lc.startTime,
        endTime:      lc.endTime,
        status:       lc.status,
        liveStatus,   // "upcoming" | "live_now" | "completed"
        platform:     lc.platform,
        accessType:   lc.accessType,
        thumbnailUrl: lc.thumbnailUrl,
        unlockAt:     lc.unlockAt,
        courseId:     lc.courseId,
        categoryId:   lc.categoryId,
        subjectId:    lc.subjectId,
        topicId:      lc.topicId,
        subtopicId:   lc.subtopicId,
        faculty:      lc.faculty,
        course:       lc.course,
        replayVideoId: lc.replayVideoId,
        // Join credentials — exposed only in join window
        canJoin,
        joinUrl:      canJoin ? lc.joinUrl : null,
        meetingPassword: canJoin ? lc.zoomPassword : null,
        zoomMeetingId:   canJoin ? lc.zoomMeetingId : null,
      };
    });

    return NextResponse.json({
      data: enriched,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("Student live-classes GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
