export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const faculty = await prisma.faculty.findUnique({ where: { id: params.id }, include: { _count: { select: { videos: true, liveClasses: true } } } });
  if (!faculty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: faculty });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, title, bio, avatarUrl, isActive } = body;

    const existing = await prisma.faculty.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.faculty.update({
      where: { id: params.id },
      data: {
        name: name?.trim() || existing.name,
        title: title !== undefined ? (title?.trim() || null) : existing.title,
        bio: bio !== undefined ? (bio?.trim() || null) : existing.bio,
        avatarUrl: avatarUrl !== undefined ? (avatarUrl?.trim() || null) : existing.avatarUrl,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      },
    });

    writeAuditLog({ actorId: user.id, action: "FACULTY_UPDATE", entityType: "Faculty", entityId: params.id, before: { name: existing.name }, after: { name: updated.name } });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Faculty PUT error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "SUPER_ADMIN only" }, { status: 403 });

  try {
    const existing = await prisma.faculty.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const inUse = await prisma.video.count({ where: { facultyId: params.id } });
    if (inUse > 0) return NextResponse.json({ error: "Faculty has videos — remove them first" }, { status: 409 });

    await prisma.faculty.delete({ where: { id: params.id } });
    writeAuditLog({ actorId: user.id, action: "FACULTY_DELETE", entityType: "Faculty", entityId: params.id, before: { name: existing.name } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Faculty DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
