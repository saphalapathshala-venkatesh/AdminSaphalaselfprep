export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * GET /api/questions/groups/[id]
 * Fetch a QuestionGroup with all child questions and options.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await prisma.questionGroup.findUnique({
    where: { id: params.id },
    include: {
      questions: {
        orderBy: { createdAt: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: group });
}

/**
 * PUT /api/questions/groups/[id]
 * Update a QuestionGroup's paragraph text and optional taxonomy overrides.
 * Does NOT modify child questions (use individual question endpoints for that).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.questionGroup.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { paragraph, categoryId, subjectId, topicId, subtopicId } = body as {
    paragraph?: string;
    categoryId?: string | null;
    subjectId?: string | null;
    topicId?: string | null;
    subtopicId?: string | null;
  };

  if (paragraph !== undefined && (!paragraph || !paragraph.trim())) {
    return NextResponse.json({ error: "paragraph cannot be empty" }, { status: 400 });
  }

  const updated = await prisma.questionGroup.update({
    where: { id: params.id },
    data: {
      ...(paragraph !== undefined ? { paragraph } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(subjectId !== undefined ? { subjectId } : {}),
      ...(topicId !== undefined ? { topicId } : {}),
      ...(subtopicId !== undefined ? { subtopicId } : {}),
    },
    include: { _count: { select: { questions: true } } },
  });

  await writeAuditLog({
    actorId: user.id,
    action: "UPDATE",
    entityType: "QuestionGroup",
    entityId: params.id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

/**
 * DELETE /api/questions/groups/[id]
 * Delete a QuestionGroup. Child questions have their groupId set to NULL (onDelete: SetNull).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.questionGroup.findUnique({
    where: { id: params.id },
    include: { _count: { select: { questions: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.questionGroup.delete({ where: { id: params.id } });

  await writeAuditLog({
    actorId: user.id,
    action: "DELETE",
    entityType: "QuestionGroup",
    entityId: params.id,
    before: existing,
  });

  return NextResponse.json({ data: { deleted: true, childrenUnlinked: (existing as any)._count.questions } });
}
