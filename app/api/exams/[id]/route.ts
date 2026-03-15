export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  return NextResponse.json({ exam });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = (body.name ?? "").trim();
  const categoryId = (body.categoryId ?? "").trim();
  let slug = (body.slug ?? "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Category is required" }, { status: 400 });
  if (!slug) slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const existing = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const conflict = await prisma.exam.findUnique({ where: { categoryId_slug: { categoryId, slug } } });
  if (conflict && conflict.id !== params.id) {
    return NextResponse.json({ error: "An exam with this slug already exists in this category" }, { status: 409 });
  }

  const exam = await prisma.exam.update({
    where: { id: params.id },
    data: { name, slug, categoryId },
    include: { category: { select: { id: true, name: true } } },
  });

  writeAuditLog({ actorId: user.id, action: "EXAM_UPDATED", entityType: "Exam", entityId: exam.id, after: { name, slug, categoryId } }).catch(() => {});

  return NextResponse.json({ ok: true, exam });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({ where: { id: params.id } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const [courses, testSeries, tests, flashcardDecks, contentPages, pdfAssets, videos, liveClasses] = await Promise.all([
    prisma.course.count({ where: { examId: params.id } }),
    prisma.testSeries.count({ where: { examId: params.id } }),
    prisma.test.count({ where: { examId: params.id } }),
    prisma.flashcardDeck.count({ where: { examId: params.id } }),
    prisma.contentPage.count({ where: { examId: params.id } }),
    prisma.pdfAsset.count({ where: { examId: params.id } }),
    prisma.video.count({ where: { examId: params.id } }),
    prisma.liveClass.count({ where: { examId: params.id } }),
  ]);

  const total = courses + testSeries + tests + flashcardDecks + contentPages + pdfAssets + videos + liveClasses;
  if (total > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${total} item(s) are still tagged with this exam. Remove the exam tag from all content first.` },
      { status: 409 }
    );
  }

  await prisma.exam.delete({ where: { id: params.id } });

  writeAuditLog({ actorId: user.id, action: "EXAM_DELETED", entityType: "Exam", entityId: params.id, before: { name: exam.name } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
