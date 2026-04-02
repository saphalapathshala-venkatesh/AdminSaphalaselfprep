export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const original = await prisma.course.findUnique({ where: { id: params.id } });
  if (!original) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const linkedContent = await prisma.courseLinkedContent.findMany({
    where: { courseId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  const folders = await prisma.courseFolder.findMany({
    where: { courseId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  const contentItems = await prisma.courseContentItem.findMany({
    where: { courseId: params.id },
    orderBy: { sortOrder: "asc" },
  });
  const packageItems = await prisma.coursePackageItem.findMany({
    where: { packageCourseId: params.id },
    orderBy: { sortOrder: "asc" },
  });

  const { id: _id, createdAt: _ca, updatedAt: _ua, ...scalarFields } = original as any;

  const newCourse = await prisma.course.create({
    data: {
      ...scalarFields,
      name: `Copy of ${original.name}`,
      isActive: false,
    },
  });

  if (linkedContent.length > 0) {
    await prisma.courseLinkedContent.createMany({
      data: linkedContent.map((lc) => ({
        courseId: newCourse.id,
        contentType: lc.contentType,
        sourceId: lc.sourceId,
        titleOverride: lc.titleOverride,
        sortOrder: lc.sortOrder,
      })),
    });
  }

  const folderIdMap = new Map<string, string>();
  const topFolders = folders.filter((f) => !f.parentId);
  for (const f of topFolders) {
    const nf = await prisma.courseFolder.create({
      data: {
        tenantId: f.tenantId,
        courseId: newCourse.id,
        parentId: null,
        title: f.title,
        description: f.description,
        sortOrder: f.sortOrder,
      },
    });
    folderIdMap.set(f.id, nf.id);
  }
  const childFolders = folders.filter((f) => !!f.parentId);
  for (const f of childFolders) {
    const newParentId = folderIdMap.get(f.parentId!) ?? null;
    const nf = await prisma.courseFolder.create({
      data: {
        tenantId: f.tenantId,
        courseId: newCourse.id,
        parentId: newParentId,
        title: f.title,
        description: f.description,
        sortOrder: f.sortOrder,
      },
    });
    folderIdMap.set(f.id, nf.id);
  }

  for (const item of contentItems) {
    const newFolderId = item.folderId ? (folderIdMap.get(item.folderId) ?? null) : null;
    await prisma.courseContentItem.create({
      data: {
        tenantId: item.tenantId,
        courseId: newCourse.id,
        folderId: newFolderId,
        itemType: item.itemType,
        sourceId: item.sourceId,
        titleSnapshot: item.titleSnapshot,
        sortOrder: item.sortOrder,
      },
    });
  }

  if (packageItems.length > 0) {
    await prisma.coursePackageItem.createMany({
      data: packageItems.map((pi) => ({
        tenantId: pi.tenantId,
        packageCourseId: newCourse.id,
        childCourseId: pi.childCourseId,
        sortOrder: pi.sortOrder,
      })),
    });
  }

  return NextResponse.json({ data: { id: newCourse.id, name: newCourse.name } });
}
