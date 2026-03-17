export const dynamic = "force-dynamic";
export const runtime = "nodejs";
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
        ebookPages: { orderBy: { orderIndex: "asc" } },
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
    const { title, body: pageBody, categoryId, examId, subjectId, topicId, subtopicId, isPublished, xpEnabled, xpValue, unlockAt } = body;

    const data: any = {};
    if (title !== undefined) data.title = title.trim();
    if (pageBody !== undefined) data.body = pageBody;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (examId !== undefined) data.examId = examId || null;
    if (subjectId !== undefined) data.subjectId = subjectId || null;
    if (topicId !== undefined) data.topicId = topicId || null;
    if (subtopicId !== undefined) data.subtopicId = subtopicId || null;
    if (xpEnabled !== undefined) data.xpEnabled = xpEnabled === true;
    if (xpValue !== undefined) data.xpValue = Math.max(0, parseInt(xpValue) || 0);
    if (unlockAt !== undefined) data.unlockAt = unlockAt ? new Date(unlockAt) : null;

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
        ebookPages: { orderBy: { orderIndex: "asc" } },
      },
    });

    // Upsert pages if provided
    // contentBlocks (Json?) carries the block-based doc (v1 BlockDoc).
    // contentHtml is preserved for legacy pages; contentBlocks takes rendering precedence when set.
    const incomingPages: {
      id?: string;
      title?: string;
      contentHtml: string;
      contentBlocks?: unknown;
      orderIndex: number;
    }[] = body.pages || [];
    if (incomingPages.length > 0) {
      const existingPageIds = (await prisma.eBookPage.findMany({
        where: { ebookId: params.id }, select: { id: true },
      })).map(p => p.id);

      const incomingIds = incomingPages.filter(p => p.id).map(p => p.id as string);
      const toDelete = existingPageIds.filter(id => !incomingIds.includes(id));
      if (toDelete.length > 0) await prisma.eBookPage.deleteMany({ where: { id: { in: toDelete } } });

      for (const p of incomingPages) {
        const pageData: any = {
          title: p.title ?? null,
          contentHtml: p.contentHtml ?? "",
          orderIndex: p.orderIndex,
        };
        if (p.contentBlocks !== undefined) {
          pageData.contentBlocks = p.contentBlocks as any;
        }
        if (p.id) {
          await prisma.eBookPage.update({ where: { id: p.id }, data: pageData });
        } else {
          await prisma.eBookPage.create({ data: { ebookId: params.id, ...pageData } });
        }
      }
    }

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
