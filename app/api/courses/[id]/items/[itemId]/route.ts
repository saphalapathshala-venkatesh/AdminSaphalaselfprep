export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const item = await prisma.courseContentItem.findUnique({ where: { id: params.itemId } });
    if (!item || item.courseId !== params.id)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    await prisma.courseContentItem.delete({ where: { id: params.itemId } });

    // Renumber remaining items in the same folder context to close the gap
    const remaining = await prisma.courseContentItem.findMany({
      where: { courseId: params.id, folderId: item.folderId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((r, idx) => prisma.courseContentItem.update({ where: { id: r.id }, data: { sortOrder: idx } }))
      );
    }

    writeAuditLog({ actorId: user.id, action: "COURSE_ITEM_REMOVE", entityType: "CourseContentItem", entityId: params.itemId, before: { itemType: item.itemType, sourceId: item.sourceId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Course item DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const item = await prisma.courseContentItem.findUnique({ where: { id: params.itemId } });
    if (!item || item.courseId !== params.id)
      return NextResponse.json({ error: "Item not found" }, { status: 404 });

    // Validate new folder if provided
    if (body.folderId !== undefined && body.folderId !== null) {
      const folder = await prisma.courseFolder.findUnique({ where: { id: body.folderId } });
      if (!folder || folder.courseId !== params.id)
        return NextResponse.json({ error: "Folder not found in this course" }, { status: 400 });
    }

    const updated = await prisma.courseContentItem.update({
      where: { id: params.itemId },
      data: {
        folderId:      body.folderId      !== undefined ? (body.folderId || null) : item.folderId,
        titleSnapshot: body.titleSnapshot !== undefined ? body.titleSnapshot       : item.titleSnapshot,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Course item PUT error:", err);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}
