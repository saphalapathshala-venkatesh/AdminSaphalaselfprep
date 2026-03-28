export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = ["OPEN", "ANSWERED", "ADDRESSED", "CLOSED"];

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20));
  const skip = (page - 1) * pageSize;
  const status = searchParams.get("status") || "";
  const videoId = searchParams.get("videoId") || "";
  const courseId = searchParams.get("courseId") || "";
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  // Validate status against enum before using in query to prevent P2023
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (videoId) where.videoId = videoId;
  if (courseId) where.courseId = courseId;
  // Search against body (the question text) — DB column name is "body"
  if (search) where.body = { contains: search, mode: "insensitive" };

  try {
    const [items, total] = await Promise.all([
      prisma.doubt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          student: { select: { id: true, name: true, email: true, mobile: true } },
          video: { select: { id: true, title: true } },
          course: { select: { id: true, name: true } },
          answeredBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.doubt.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error("[Doubts GET] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    // userId = the student asking the doubt (DB column name is userId)
    const { userId, videoId, courseId, title, body: questionBody } = body;

    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!questionBody?.trim()) return NextResponse.json({ error: "body (question) is required" }, { status: 400 });

    const doubt = await prisma.doubt.create({
      data: {
        userId,
        videoId: videoId || null,
        courseId: courseId || null,
        title: title?.trim() || null,
        body: questionBody.trim(),
        status: "OPEN",
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        video: { select: { id: true, title: true } },
        course: { select: { id: true, name: true } },
      },
    });

    writeAuditLog({
      actorId: user.id, action: "DOUBT_CREATE", entityType: "Doubt", entityId: doubt.id,
      after: { userId, body: doubt.body.slice(0, 80) },
    });
    return NextResponse.json({ data: doubt }, { status: 201 });
  } catch (err) {
    console.error("[Doubts POST] Error:", err);
    return NextResponse.json({ error: "Failed to create doubt" }, { status: 500 });
  }
}
