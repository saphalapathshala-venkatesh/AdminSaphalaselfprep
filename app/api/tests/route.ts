export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const seriesId = searchParams.get("seriesId");
  const published = searchParams.get("published");

  const where: any = {};
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (seriesId) where.seriesId = seriesId;
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;

  try {
    const [items, total] = await Promise.all([
      prisma.test.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          series: { select: { id: true, title: true, categoryId: true } },
          _count: { select: { questions: true, sections: true } },
        },
      }),
      prisma.test.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Tests GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, instructions, mode, isTimed, durationSec, totalQuestions, marksPerQuestion, negativeMarksPerQuestion,
            allowPause, strictSectionMode,
            shuffleQuestions, shuffleOptions, shuffleGroups, shuffleGroupChildren, seriesId,
            sections, questions, xpEnabled, xpValue, testStartTime, isFree, unlockAt } = body;
    let { categoryId, examId } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!mode || !["TIMED", "SECTIONAL", "MULTI_SECTION"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (seriesId) {
      const series = await prisma.testSeries.findUnique({ where: { id: seriesId }, select: { categoryId: true } });
      if (!series) return NextResponse.json({ error: "Test series not found" }, { status: 400 });
      if (series.categoryId) {
        if (categoryId && categoryId !== series.categoryId) {
          return NextResponse.json({
            error: "Category mismatch: the selected test series belongs to a different category. Please choose a series that matches the selected category, or clear the category field.",
          }, { status: 400 });
        }
        categoryId = series.categoryId;
      }
    }

    const test = await prisma.$transaction(async (tx) => {
      const created = await tx.test.create({
        data: {
          title: title.trim(),
          instructions: instructions?.trim() || null,
          mode,
          isTimed: isTimed !== undefined ? isTimed : true,
          durationSec: durationSec ? parseInt(durationSec) : null,
          totalQuestions: totalQuestions ? parseInt(totalQuestions) : null,
          marksPerQuestion: marksPerQuestion != null ? parseFloat(marksPerQuestion) || null : null,
          negativeMarksPerQuestion: negativeMarksPerQuestion != null ? parseFloat(negativeMarksPerQuestion) || null : null,
          allowPause: allowPause || false,
          strictSectionMode: strictSectionMode || false,
          shuffleQuestions: shuffleQuestions || false,
          shuffleOptions: shuffleOptions || false,
          shuffleGroups: shuffleGroups || false,
          shuffleGroupChildren: shuffleGroupChildren || false,
          seriesId: seriesId || null,
          categoryId: categoryId || null,
          examId: examId || null,
          xpEnabled: xpEnabled === true,
          xpValue: xpValue !== undefined ? Math.max(0, parseInt(xpValue) || 0) : 0,
          testStartTime: testStartTime ? new Date(testStartTime) : null,
          isFree: isFree === true,
          unlockAt: unlockAt ? new Date(unlockAt) : null,
          createdById: user.id,
        },
      });

      const createdSections: { id: string }[] = [];
      if (Array.isArray(sections) && sections.length > 0) {
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const parentId = (s.parentIndex !== null && s.parentIndex !== undefined && createdSections[s.parentIndex])
            ? createdSections[s.parentIndex].id
            : null;
          const sec = await tx.testSection.create({
            data: {
              testId: created.id,
              title: s.title || `Section ${i + 1}`,
              order: i,
              durationSec: s.durationSec ? parseInt(s.durationSec) : null,
              targetCount: s.targetCount ? parseInt(s.targetCount) : null,
              parentSectionId: parentId,
            },
          });
          createdSections.push(sec);
        }
      }

      if (Array.isArray(questions) && questions.length > 0) {
        const tqData = questions.map((q: any, i: number) => {
          let sectionId: string | null = null;
          if (q.sectionIndex !== undefined && q.sectionIndex !== null && createdSections[q.sectionIndex]) {
            sectionId = createdSections[q.sectionIndex].id;
          }
          return {
            testId: created.id,
            questionId: q.questionId,
            sectionId,
            order: i,
            marks: q.marks !== undefined ? parseFloat(String(q.marks)) || 1 : 1,
            negativeMarks: q.negativeMarks !== undefined ? parseFloat(String(q.negativeMarks)) || 0 : 0,
          };
        });
        await tx.testQuestion.createMany({ data: tqData });
      }

      return tx.test.findUnique({
        where: { id: created.id },
        include: {
          sections: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, order: true, durationSec: true, targetCount: true, parentSectionId: true },
          },
          questions: { orderBy: { order: "asc" }, include: { question: true } },
        },
      });
    });

    writeAuditLog({
      actorId: user.id,
      action: "TEST_CREATE",
      entityType: "Test",
      entityId: test!.id,
      after: { title: test!.title, mode: test!.mode },
    }).catch(() => {});

    return NextResponse.json({ data: test }, { status: 201 });
  } catch (err) {
    console.error("Tests POST error:", err);
    return NextResponse.json({ error: "Failed to create test" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, title, instructions, mode, isTimed, durationSec, totalQuestions, marksPerQuestion, negativeMarksPerQuestion,
            allowPause, strictSectionMode,
            shuffleQuestions, shuffleOptions, shuffleGroups, shuffleGroupChildren,
            seriesId, sections, questions, xpEnabled, xpValue, testStartTime, isFree, unlockAt } = body;
    let { categoryId, examId } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await prisma.test.findUnique({
      where: { id },
      include: { sections: true, questions: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const resolvedSeriesId = seriesId !== undefined ? (seriesId || null) : existing.seriesId;
    if (resolvedSeriesId) {
      const series = await prisma.testSeries.findUnique({ where: { id: resolvedSeriesId }, select: { categoryId: true } });
      if (series?.categoryId) {
        const resolvedCategoryId = categoryId !== undefined ? (categoryId || null) : existing.categoryId;
        if (resolvedCategoryId && resolvedCategoryId !== series.categoryId) {
          return NextResponse.json({
            error: "Category mismatch: the selected test series belongs to a different category. Please choose a series that matches the selected category.",
          }, { status: 400 });
        }
        if (categoryId === undefined) categoryId = series.categoryId;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.test.update({
        where: { id },
        data: {
          title: title?.trim() || existing.title,
          instructions: instructions !== undefined ? (instructions?.trim() || null) : existing.instructions,
          mode: mode || existing.mode,
          isTimed: isTimed !== undefined ? isTimed : existing.isTimed,
          durationSec: durationSec !== undefined ? (durationSec ? parseInt(durationSec) : null) : existing.durationSec,
          totalQuestions: totalQuestions !== undefined ? (totalQuestions ? parseInt(totalQuestions) : null) : existing.totalQuestions,
          marksPerQuestion: marksPerQuestion !== undefined ? (marksPerQuestion != null ? parseFloat(marksPerQuestion) || null : null) : existing.marksPerQuestion,
          negativeMarksPerQuestion: negativeMarksPerQuestion !== undefined ? (negativeMarksPerQuestion != null ? parseFloat(negativeMarksPerQuestion) || null : null) : existing.negativeMarksPerQuestion,
          allowPause: allowPause !== undefined ? allowPause : existing.allowPause,
          strictSectionMode: strictSectionMode !== undefined ? strictSectionMode : existing.strictSectionMode,
          shuffleQuestions: shuffleQuestions !== undefined ? shuffleQuestions : existing.shuffleQuestions,
          shuffleOptions: shuffleOptions !== undefined ? shuffleOptions : existing.shuffleOptions,
          shuffleGroups: shuffleGroups !== undefined ? shuffleGroups : existing.shuffleGroups,
          shuffleGroupChildren: shuffleGroupChildren !== undefined ? shuffleGroupChildren : existing.shuffleGroupChildren,
          seriesId: resolvedSeriesId,
          categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
          examId: examId !== undefined ? (examId || null) : existing.examId,
          xpEnabled: xpEnabled !== undefined ? xpEnabled === true : existing.xpEnabled,
          xpValue: xpValue !== undefined ? Math.max(0, parseInt(xpValue) || 0) : existing.xpValue,
          testStartTime: testStartTime !== undefined ? (testStartTime ? new Date(testStartTime) : null) : existing.testStartTime,
          isFree: isFree !== undefined ? isFree === true : existing.isFree,
          unlockAt: unlockAt !== undefined ? (unlockAt ? new Date(unlockAt) : null) : existing.unlockAt,
        },
      });

      if (sections !== undefined && Array.isArray(sections)) {
        await tx.testQuestion.deleteMany({ where: { testId: id } });
        await tx.testSection.deleteMany({ where: { testId: id } });

        const createdSections: { id: string }[] = [];
        for (let i = 0; i < sections.length; i++) {
          const s = sections[i];
          const parentId = (s.parentIndex !== null && s.parentIndex !== undefined && createdSections[s.parentIndex])
            ? createdSections[s.parentIndex].id
            : null;
          const created = await tx.testSection.create({
            data: {
              testId: id,
              title: s.title || `Section ${i + 1}`,
              order: i,
              durationSec: s.durationSec ? parseInt(s.durationSec) : null,
              targetCount: s.targetCount ? parseInt(s.targetCount) : null,
              parentSectionId: parentId,
            },
          });
          createdSections.push(created);
        }

        if (questions !== undefined && Array.isArray(questions) && questions.length > 0) {
          const tqData = questions.map((q: any, i: number) => {
            let sectionId: string | null = null;
            if (q.sectionIndex !== undefined && q.sectionIndex !== null && createdSections[q.sectionIndex]) {
              sectionId = createdSections[q.sectionIndex].id;
            } else if (q.sectionId) {
              sectionId = q.sectionId;
            }
            return {
              testId: id,
              questionId: q.questionId,
              sectionId,
              order: i,
              marks: q.marks !== undefined ? parseFloat(String(q.marks)) || 1 : 1,
              negativeMarks: q.negativeMarks !== undefined ? parseFloat(String(q.negativeMarks)) || 0 : 0,
            };
          });
          await tx.testQuestion.createMany({ data: tqData });
        }
      } else if (questions !== undefined && Array.isArray(questions)) {
        await tx.testQuestion.deleteMany({ where: { testId: id } });
        const currentSections = await tx.testSection.findMany({
          where: { testId: id },
          orderBy: { order: "asc" },
        });
        if (questions.length > 0) {
          const tqData = questions.map((q: any, i: number) => {
            let sectionId: string | null = null;
            if (q.sectionIndex !== undefined && q.sectionIndex !== null && currentSections[q.sectionIndex]) {
              sectionId = currentSections[q.sectionIndex].id;
            } else if (q.sectionId) {
              sectionId = q.sectionId;
            }
            return {
              testId: id,
              questionId: q.questionId,
              sectionId,
              order: i,
              marks: q.marks !== undefined ? parseFloat(String(q.marks)) || 1 : 1,
              negativeMarks: q.negativeMarks !== undefined ? parseFloat(String(q.negativeMarks)) || 0 : 0,
            };
          });
          await tx.testQuestion.createMany({ data: tqData });
        }
      }

      return tx.test.findUnique({
        where: { id },
        include: {
          sections: {
            orderBy: { order: "asc" },
            select: { id: true, title: true, order: true, durationSec: true, targetCount: true, parentSectionId: true },
          },
          questions: { orderBy: { order: "asc" }, include: { question: true } },
        },
      });
    });

    writeAuditLog({
      actorId: user.id,
      action: "TEST_UPDATE",
      entityType: "Test",
      entityId: id,
      before: { title: existing.title, mode: existing.mode },
      after: { title: result?.title, mode: result?.mode },
    }).catch(() => {});

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("Tests PUT error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Duplicate question in test" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update test" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.isPublished && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete published tests" }, { status: 403 });
    }

    await prisma.test.delete({ where: { id } });

    writeAuditLog({
      actorId: user.id,
      action: "TEST_DELETE",
      entityType: "Test",
      entityId: id,
      before: { title: existing.title },
    }).catch(() => {});

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Tests DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
