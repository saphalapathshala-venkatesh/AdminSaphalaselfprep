export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * DELETE /api/courses/[id]/package/[itemId]
 * Remove an imported course from this package.
 * Does NOT delete the source course — only removes the mapping.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const item = await prisma.coursePackageItem.findUnique({ where: { id: params.itemId } });
    if (!item || item.packageCourseId !== params.id)
      return NextResponse.json({ error: "Package item not found" }, { status: 404 });

    await prisma.coursePackageItem.delete({ where: { id: params.itemId } });

    // Renumber remaining items to close the gap
    const remaining = await prisma.coursePackageItem.findMany({
      where: { packageCourseId: params.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((r, idx) => prisma.coursePackageItem.update({ where: { id: r.id }, data: { sortOrder: idx } }))
      );
    }

    writeAuditLog({ actorId: user.id, action: "PACKAGE_REMOVE", entityType: "CoursePackageItem", entityId: params.itemId, before: { packageCourseId: params.id, childCourseId: item.childCourseId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Package item DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove course from package" }, { status: 500 });
  }
}
