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
  const accessType = searchParams.get("accessType") || "";
  const provider = searchParams.get("provider") || "";

  const where: any = { tenantId: "default" };
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (status) where.status = status;
  if (courseId) where.courseId = courseId;
  if (facultyId) where.facultyId = facultyId;
  if (accessType) where.accessType = accessType;
  if (provider) where.provider = provider;

  try {
    const [items, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          faculty: { select: { id: true, name: true } },
          course: { select: { id: true, name: true } },
          createdBy: { select: { id: true, email: true } },
        },
      }),
      prisma.video.count({ where }),
    ]);
    return NextResponse.json({ data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) {
    console.error("Videos GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      title, description, facultyId, courseId, categoryId, examId, subjectId, topicId, subtopicId,
      accessType, status, lessonOrder, durationSeconds, thumbnailUrl,
      provider, providerVideoId, hlsUrl, playbackUrl,
      allowPreview, tags, unlockAt, xpEnabled, xpValue,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const xpEnabledBool = Boolean(xpEnabled);
    const xpValueInt = Math.max(0, parseInt(xpValue) || 0);
    if (xpEnabledBool && xpValueInt === 0) {
      return NextResponse.json({ error: "XP value must be set when XP is enabled" }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: {
        tenantId: "default",
        title: title.trim(),
        description: description?.trim() || null,
        facultyId: facultyId || null,
        courseId: courseId || null,
        categoryId: categoryId || null,
        examId: examId || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        accessType: accessType || "FREE",
        status: status || "DRAFT",
        lessonOrder: lessonOrder !== undefined ? parseInt(lessonOrder) : 0,
        durationSeconds: durationSeconds ? parseInt(durationSeconds) : null,
        thumbnailUrl: thumbnailUrl?.trim() || null,
        provider: provider || "MANUAL",
        providerVideoId: providerVideoId?.trim() || null,
        hlsUrl: hlsUrl?.trim() || null,
        playbackUrl: playbackUrl?.trim() || null,
        allowPreview: Boolean(allowPreview),
        tags: Array.isArray(tags) ? tags : [],
        unlockAt: unlockAt ? new Date(unlockAt) : null,
        xpEnabled: xpEnabledBool,
        xpValue: xpValueInt,
        createdById: user.id,
      },
      include: {
        faculty: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
      },
    });

    writeAuditLog({ actorId: user.id, action: "VIDEO_CREATE", entityType: "Video", entityId: video.id, after: { title: video.title, status: video.status } });
    return NextResponse.json({ data: video }, { status: 201 });
  } catch (err) {
    console.error("Videos POST error:", err);
    return NextResponse.json({ error: "Failed to create video" }, { status: 500 });
  }
}
