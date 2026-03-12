export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * PUT /api/courses/[id]/reorder
 * Body:
 * {
 *   parentFolderId: string | null,   // null = root level
 *   orderedEntries: Array<{ entryType: "folder" | "item", id: string }>
 * }
 * Reassigns sortOrder 0..n-1 atomically for the combined folder+item list.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { parentFolderId, orderedEntries } = body;

    if (!Array.isArray(orderedEntries) || orderedEntries.length === 0)
      return NextResponse.json({ error: "orderedEntries must be a non-empty array" }, { status: 400 });

    const folderIds = orderedEntries.filter((e: any) => e.entryType === "folder").map((e: any) => e.id);
    const itemIds   = orderedEntries.filter((e: any) => e.entryType === "item").map((e: any) => e.id);

    // Validate all folders belong here
    if (folderIds.length > 0) {
      const folders = await prisma.courseFolder.findMany({
        where: { id: { in: folderIds }, courseId: params.id, parentId: parentFolderId || null },
        select: { id: true },
      });
      if (folders.length !== folderIds.length)
        return NextResponse.json({ error: "Some folder IDs not found in this context" }, { status: 404 });
    }

    // Validate all items belong here
    if (itemIds.length > 0) {
      const items = await prisma.courseContentItem.findMany({
        where: { id: { in: itemIds }, courseId: params.id, folderId: parentFolderId || null },
        select: { id: true },
      });
      if (items.length !== itemIds.length)
        return NextResponse.json({ error: "Some item IDs not found in this context" }, { status: 404 });
    }

    // Build per-type sortOrder maps from the combined ordered list
    const folderOrderMap: Record<string, number> = {};
    const itemOrderMap:   Record<string, number> = {};
    orderedEntries.forEach((e: any, idx: number) => {
      if (e.entryType === "folder") folderOrderMap[e.id] = idx;
      else itemOrderMap[e.id] = idx;
    });

    await prisma.$transaction([
      ...Object.entries(folderOrderMap).map(([id, sortOrder]) =>
        prisma.courseFolder.update({ where: { id }, data: { sortOrder } })
      ),
      ...Object.entries(itemOrderMap).map(([id, sortOrder]) =>
        prisma.courseContentItem.update({ where: { id }, data: { sortOrder } })
      ),
    ]);

    writeAuditLog({ actorId: user.id, action: "COURSE_REORDER", entityType: "Course", entityId: params.id, after: { parentFolderId, count: orderedEntries.length } });
    return NextResponse.json({ data: { reordered: orderedEntries.length } });
  } catch (err) {
    console.error("Course reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
