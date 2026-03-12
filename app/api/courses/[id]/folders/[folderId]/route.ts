export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: { id: string; folderId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const folder = await prisma.courseFolder.findUnique({ where: { id: params.folderId } });
    if (!folder || folder.courseId !== params.id)
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    const updated = await prisma.courseFolder.update({
      where: { id: params.folderId },
      data: {
        title:       body.title?.trim()  || folder.title,
        description: body.description !== undefined ? (body.description?.trim() || null) : folder.description,
        parentId:    body.parentId    !== undefined ? (body.parentId || null) : folder.parentId,
      },
    });

    writeAuditLog({ actorId: user.id, action: "FOLDER_UPDATE", entityType: "CourseFolder", entityId: params.folderId, after: { title: updated.title } });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Folder PUT error:", err);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; folderId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const folder = await prisma.courseFolder.findUnique({ where: { id: params.folderId } });
    if (!folder || folder.courseId !== params.id)
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });

    // Safety checks — count subfolders and items
    const [subfolderCount, itemCount] = await Promise.all([
      prisma.courseFolder.count({ where: { parentId: params.folderId } }),
      prisma.courseContentItem.count({ where: { folderId: params.folderId } }),
    ]);

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    if ((subfolderCount > 0 || itemCount > 0) && !force) {
      return NextResponse.json({
        error: "Folder is not empty",
        subfolderCount,
        itemCount,
        hint: "Add ?force=true to move all contents to the parent folder before deleting",
      }, { status: 409 });
    }

    await prisma.$transaction(async tx => {
      if (force) {
        // Move subfolders up to parent
        await tx.courseFolder.updateMany({
          where: { parentId: params.folderId },
          data: { parentId: folder.parentId },
        });
        // Move items up to parent
        await tx.courseContentItem.updateMany({
          where: { folderId: params.folderId },
          data: { folderId: folder.parentId },
        });
      }
      await tx.courseFolder.delete({ where: { id: params.folderId } });
    });

    writeAuditLog({ actorId: user.id, action: "FOLDER_DELETE", entityType: "CourseFolder", entityId: params.folderId, before: { title: folder.title, force } });
    return NextResponse.json({ data: { deleted: true, movedSubfolders: force ? subfolderCount : 0, movedItems: force ? itemCount : 0 } });
  } catch (err) {
    console.error("Folder DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
}
