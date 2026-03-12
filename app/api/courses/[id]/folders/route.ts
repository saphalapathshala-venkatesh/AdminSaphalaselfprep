export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folders = await prisma.courseFolder.findMany({
    where: { courseId: params.id },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ data: folders });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, parentId, description } = body;

    if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    if (parentId) {
      const parent = await prisma.courseFolder.findUnique({ where: { id: parentId } });
      if (!parent || parent.courseId !== params.id)
        return NextResponse.json({ error: "Parent folder not found in this course" }, { status: 400 });
    }

    // Place at end of siblings
    const lastSibling = await prisma.courseFolder.findFirst({
      where: { courseId: params.id, parentId: parentId || null },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (lastSibling?.sortOrder ?? -1) + 1;

    const folder = await prisma.courseFolder.create({
      data: {
        tenantId:    "default",
        courseId:    params.id,
        parentId:    parentId || null,
        title:       title.trim(),
        description: description?.trim() || null,
        sortOrder,
      },
    });

    writeAuditLog({ actorId: user.id, action: "FOLDER_CREATE", entityType: "CourseFolder", entityId: folder.id, after: { courseId: params.id, title: folder.title } });
    return NextResponse.json({ data: folder }, { status: 201 });
  } catch (err) {
    console.error("Folder POST error:", err);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
