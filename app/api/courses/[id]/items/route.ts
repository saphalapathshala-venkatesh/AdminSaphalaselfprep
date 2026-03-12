export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_TYPES = ["VIDEO", "LIVE_CLASS", "PDF", "FLASHCARD_DECK"] as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { folderId, itemType, sourceId, titleSnapshot } = body;

    if (!itemType || !VALID_TYPES.includes(itemType))
      return NextResponse.json({ error: `itemType must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });
    if (!sourceId?.trim())
      return NextResponse.json({ error: "sourceId is required" }, { status: 400 });

    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    if (folderId) {
      const folder = await prisma.courseFolder.findUnique({ where: { id: folderId } });
      if (!folder || folder.courseId !== params.id)
        return NextResponse.json({ error: "Folder not found in this course" }, { status: 400 });
    }

    // Already mapped?
    const existing = await prisma.courseContentItem.findUnique({
      where: { courseId_itemType_sourceId: { courseId: params.id, itemType, sourceId } },
    });
    if (existing)
      return NextResponse.json({ error: "This content is already in the course" }, { status: 409 });

    // Place at end of this folder context
    const last = await prisma.courseContentItem.findFirst({
      where: { courseId: params.id, folderId: folderId || null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const item = await prisma.courseContentItem.create({
      data: {
        tenantId:      "default",
        courseId:      params.id,
        folderId:      folderId || null,
        itemType,
        sourceId,
        titleSnapshot: titleSnapshot?.trim() || null,
        sortOrder,
      },
    });

    writeAuditLog({ actorId: user.id, action: "COURSE_ITEM_ADD", entityType: "CourseContentItem", entityId: item.id, after: { itemType, sourceId, courseId: params.id } });
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "This content is already in the course" }, { status: 409 });
    console.error("Course item POST error:", err);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}
