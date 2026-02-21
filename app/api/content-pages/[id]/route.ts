import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const page = await prisma.contentPage.findUnique({
      where: { id: params.id },
      include: {
        subtopic: {
          select: {
            id: true, name: true, topicId: true,
            topic: {
              select: {
                id: true, name: true, subjectId: true,
                subject: { select: { id: true, name: true, categoryId: true } },
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: page });
  } catch (err) {
    console.error("Content page GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.contentPage.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { title, body: pageBody, subtopicId, isPublished } = body;

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (pageBody !== undefined) data.body = pageBody;
    if (subtopicId !== undefined) data.subtopicId = subtopicId || null;

    if (isPublished !== undefined) {
      data.isPublished = isPublished;
      if (isPublished && !existing.isPublished) {
        data.publishedAt = new Date();
      } else if (!isPublished && existing.isPublished) {
        data.publishedAt = null;
      }
    }

    const updated = await prisma.contentPage.update({
      where: { id: params.id },
      data,
      include: {
        subtopic: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "CONTENTPAGE_UPDATE",
      entityType: "ContentPage",
      entityId: params.id,
      before: { title: existing.title, isPublished: existing.isPublished, subtopicId: existing.subtopicId },
      after: { title: updated.title, isPublished: updated.isPublished, subtopicId: updated.subtopicId },
    });

    if (isPublished !== undefined && isPublished !== existing.isPublished) {
      await writeAuditLog({
        actorId: user.id,
        action: isPublished ? "CONTENTPAGE_PUBLISH" : "CONTENTPAGE_UNPUBLISH",
        entityType: "ContentPage",
        entityId: params.id,
        before: { isPublished: existing.isPublished },
        after: { isPublished: updated.isPublished },
      });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Content page PUT error:", err);
    return NextResponse.json({ error: "Failed to update content page" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const page = await prisma.contentPage.findUnique({ where: { id: params.id } });
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (page.isPublished && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can delete published content." },
        { status: 403 }
      );
    }

    await prisma.contentPage.delete({ where: { id: params.id } });

    await writeAuditLog({
      actorId: user.id,
      action: "CONTENTPAGE_DELETE",
      entityType: "ContentPage",
      entityId: params.id,
      before: { title: page.title, isPublished: page.isPublished },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Content page DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete content page" }, { status: 500 });
  }
}
