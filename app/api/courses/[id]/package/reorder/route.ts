export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * PUT /api/courses/[id]/package/reorder
 * Body: { orderedIds: string[] }  — ordered CoursePackageItem IDs
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0)
      return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });

    // Validate all IDs belong to this package
    const existing = await prisma.coursePackageItem.findMany({
      where: { id: { in: orderedIds }, packageCourseId: params.id },
      select: { id: true },
    });
    if (existing.length !== orderedIds.length)
      return NextResponse.json({ error: "Some IDs not found in this package" }, { status: 404 });

    await prisma.$transaction(
      orderedIds.map((id, idx) => prisma.coursePackageItem.update({ where: { id }, data: { sortOrder: idx } }))
    );

    writeAuditLog({ actorId: user.id, action: "PACKAGE_REORDER", entityType: "Course", entityId: params.id, after: { count: orderedIds.length } });
    return NextResponse.json({ data: { reordered: orderedIds.length } });
  } catch (err) {
    console.error("Package reorder error:", err);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
