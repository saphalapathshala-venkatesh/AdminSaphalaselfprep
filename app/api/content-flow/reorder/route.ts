export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * PUT /api/content-flow/reorder
 * Body: { orderedIds: string[] }  — array of ContentFlowItem IDs in the desired order.
 * Renumbers displayOrder 0..n-1 atomically using a transaction.
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0)
      return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });

    // Verify all IDs exist and belong to the same context
    const items = await prisma.contentFlowItem.findMany({
      where: { id: { in: orderedIds } },
      select: { id: true, courseId: true, categoryId: true, subjectId: true, topicId: true, subtopicId: true },
    });

    if (items.length !== orderedIds.length)
      return NextResponse.json({ error: "Some item IDs not found" }, { status: 404 });

    // Verify all items share the same context (prevent cross-context reorder)
    const first = items[0];
    const sameContext = items.every(i =>
      i.courseId    === first.courseId    &&
      i.categoryId  === first.categoryId  &&
      i.subjectId   === first.subjectId   &&
      i.topicId     === first.topicId     &&
      i.subtopicId  === first.subtopicId
    );
    if (!sameContext)
      return NextResponse.json({ error: "All items must belong to the same context" }, { status: 400 });

    // Batch update displayOrder using a transaction
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.contentFlowItem.update({
          where: { id },
          data: { displayOrder: index },
        })
      )
    );

    writeAuditLog({ actorId: user.id, action: "FLOW_REORDER", entityType: "ContentFlowItem", entityId: orderedIds[0], after: { count: orderedIds.length } });
    return NextResponse.json({ data: { reordered: orderedIds.length } });
  } catch (err) {
    console.error("ContentFlow reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
