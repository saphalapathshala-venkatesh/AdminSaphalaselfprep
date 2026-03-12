export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const course = await prisma.course.findUnique({ where: { id: params.id }, include: { _count: { select: { videos: true, liveClasses: true } } } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: course });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, categoryId, isActive } = body;

    const existing = await prisma.course.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.course.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || existing.name,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      },
    });

    writeAuditLog({ actorId: user.id, action: "COURSE_UPDATE", entityType: "Course", entityId: params.id, before: { name: existing.name }, after: { name: updated.name } });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Course PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "SUPER_ADMIN only" }, { status: 403 });

  try {
    const existing = await prisma.course.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.course.delete({ where: { id: params.id } });
    writeAuditLog({ actorId: user.id, action: "COURSE_DELETE", entityType: "Course", entityId: params.id, before: { name: existing.name } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Course DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
