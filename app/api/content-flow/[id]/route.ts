export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.contentFlowItem.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.contentFlowItem.delete({ where: { id: params.id } });

    // Renumber remaining items in the same context to close the gap
    const remaining = await prisma.contentFlowItem.findMany({
      where: {
        tenantId:   existing.tenantId,
        courseId:   existing.courseId,
        categoryId: existing.categoryId,
        subjectId:  existing.subjectId,
        topicId:    existing.topicId,
        subtopicId: existing.subtopicId,
      },
      orderBy: { displayOrder: "asc" },
      select: { id: true },
    });

    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((item, index) =>
          prisma.contentFlowItem.update({ where: { id: item.id }, data: { displayOrder: index } })
        )
      );
    }

    writeAuditLog({
      actorId: user.id, action: "FLOW_ITEM_REMOVE", entityType: "ContentFlowItem", entityId: params.id,
      before: { contentType: existing.contentType, contentId: existing.contentId, displayOrder: existing.displayOrder },
    });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("ContentFlow DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { titleSnapshot } = body;

    const existing = await prisma.contentFlowItem.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.contentFlowItem.update({
      where: { id: params.id },
      data: { titleSnapshot: titleSnapshot !== undefined ? titleSnapshot : existing.titleSnapshot },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("ContentFlow PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
