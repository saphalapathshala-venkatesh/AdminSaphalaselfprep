export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  computeContentHash,
  computeSimilarity,
} from "@/lib/questionHash";

const VALID_TYPES = [
  "MCQ_SINGLE",
  "MCQ_MULTIPLE",
  "DRAG_REORDER",
  "DRAG_DROP",
  "FILL_BLANKS",
  "TRUE_FALSE",
];
const VALID_DIFFICULTIES = ["FOUNDATIONAL", "PROFICIENT", "MASTERY"];
const VALID_STATUSES = ["DRAFT", "APPROVED"];
const MCQ_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE"];
const NEAR_DUP_THRESHOLD = 0.85;

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const existing = await prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { order: "asc" } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      type,
      difficulty,
      stem,
      explanation,
      tags,
      categoryId,
      subjectId,
      topicId,
      subtopicId,
      options,
      status: qStatus,
      confirmNearDuplicate,
    } = body;

    const finalType = type && VALID_TYPES.includes(type) ? type : existing.type;
    const finalDifficulty =
      difficulty && VALID_DIFFICULTIES.includes(difficulty)
        ? difficulty
        : existing.difficulty;
    const finalStem = stem && typeof stem === "string" && stem.trim() ? stem.trim() : existing.stem;
    const finalStatus =
      qStatus && VALID_STATUSES.includes(qStatus) ? qStatus : existing.status;

    const isMCQ = MCQ_TYPES.includes(finalType);
    let validatedOptions: { text: string; isCorrect: boolean; order: number }[] = [];

    if (isMCQ && Array.isArray(options)) {
      if (options.length < 2 || options.length > 8) {
        return NextResponse.json(
          { error: "MCQ questions require 2-8 options" },
          { status: 400 }
        );
      }
      validatedOptions = options.map((o: any, i: number) => ({
        text: String(o.text || "").trim(),
        isCorrect: Boolean(o.isCorrect),
        order: i,
      }));
      if (validatedOptions.some((o) => !o.text)) {
        return NextResponse.json({ error: "All options must have text" }, { status: 400 });
      }
      const correctCount = validatedOptions.filter((o) => o.isCorrect).length;
      if (finalType === "MCQ_SINGLE" && correctCount !== 1) {
        return NextResponse.json(
          { error: "MCQ_SINGLE must have exactly 1 correct option" },
          { status: 400 }
        );
      }
      if (finalType === "MCQ_MULTIPLE" && correctCount < 1) {
        return NextResponse.json(
          { error: "MCQ_MULTIPLE must have at least 1 correct option" },
          { status: 400 }
        );
      }
    } else if (isMCQ) {
      validatedOptions = existing.options.map((o) => ({
        text: o.text,
        isCorrect: o.isCorrect,
        order: o.order,
      }));
    }

    const contentHash = computeContentHash(finalStem, validatedOptions, finalType);

    const existingExact = await prisma.question.findUnique({
      where: { contentHash },
    });
    if (existingExact && existingExact.id !== id) {
      return NextResponse.json(
        {
          error:
            "Exact duplicate blocked. Modify question/options before saving.",
          duplicateId: existingExact.id,
        },
        { status: 409 }
      );
    }

    const finalSubtopicId =
      subtopicId !== undefined ? subtopicId || null : existing.subtopicId;
    if (!confirmNearDuplicate && finalSubtopicId && (stem || options)) {
      const sameSubtopicQuestions = await prisma.question.findMany({
        where: { subtopicId: finalSubtopicId, type: finalType as any, id: { not: id } },
        select: { id: true, stem: true },
        take: 200,
      });

      const nearMatches = sameSubtopicQuestions
        .map((q) => ({
          id: q.id,
          stem: q.stem,
          similarity: computeSimilarity(finalStem, q.stem),
        }))
        .filter((m) => m.similarity >= NEAR_DUP_THRESHOLD);

      if (nearMatches.length > 0) {
        return NextResponse.json(
          {
            warning: true,
            message: "Near-duplicate questions found. Confirm to proceed.",
            matches: nearMatches.map((m) => ({
              id: m.id,
              stem: m.stem.substring(0, 200),
              similarity: Math.round(m.similarity * 100),
            })),
          },
          { status: 200 }
        );
      }
    }

    const beforeData = {
      type: existing.type,
      difficulty: existing.difficulty,
      status: existing.status,
      stem: existing.stem,
      categoryId: existing.categoryId,
      subjectId: existing.subjectId,
      topicId: existing.topicId,
      subtopicId: existing.subtopicId,
      tags: existing.tags,
      optionCount: existing.options.length,
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (isMCQ && Array.isArray(options)) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        await tx.questionOption.createMany({
          data: validatedOptions.map((o) => ({
            questionId: id,
            text: o.text,
            isCorrect: o.isCorrect,
            order: o.order,
          })),
        });
      }

      return tx.question.update({
        where: { id },
        data: {
          type: finalType as any,
          difficulty: finalDifficulty as any,
          status: finalStatus as any,
          stem: finalStem,
          explanation: explanation !== undefined ? explanation || null : undefined,
          tags: tags !== undefined
            ? Array.isArray(tags)
              ? tags.filter((t: any) => typeof t === "string" && t.trim())
              : existing.tags
            : undefined,
          contentHash,
          categoryId: categoryId !== undefined ? categoryId || null : undefined,
          subjectId: subjectId !== undefined ? subjectId || null : undefined,
          topicId: topicId !== undefined ? topicId || null : undefined,
          subtopicId: subtopicId !== undefined ? subtopicId || null : undefined,
        },
        include: {
          options: { orderBy: { order: "asc" } },
        },
      });
    });

    await writeAuditLog({
      actorId: user.id,
      action: "QUESTION_UPDATE",
      entityType: "Question",
      entityId: id,
      before: beforeData,
      after: {
        type: finalType,
        difficulty: finalDifficulty,
        status: finalStatus,
        stem: finalStem,
        categoryId: updated.categoryId,
        subjectId: updated.subjectId,
        topicId: updated.topicId,
        subtopicId: updated.subtopicId,
        tags: updated.tags,
        optionCount: updated.options.length,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Exact duplicate blocked. Modify question/options before saving." },
        { status: 409 }
      );
    }
    console.error("Questions PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const forceDelete = new URL(req.url).searchParams.get("force") === "true";

    const existing = await prisma.question.findUnique({
      where: { id },
      select: { id: true, stem: true, type: true, status: true, _count: { select: { testQuestions: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const usageCount = existing._count.testQuestions;
    if (usageCount > 0 && !forceDelete) {
      return NextResponse.json({
        warning: true,
        usageCount,
        message: `This question is used in ${usageCount} test${usageCount > 1 ? "s" : ""}. Deleting it will remove it from those tests. Pass force=true to confirm deletion.`,
      }, { status: 200 });
    }

    await prisma.question.delete({ where: { id } });

    await writeAuditLog({
      actorId: user.id,
      action: "QUESTION_DELETE",
      entityType: "Question",
      entityId: id,
      before: {
        stem: existing.stem,
        type: existing.type,
        status: existing.status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete: question is used in tests or attempts." },
        { status: 409 }
      );
    }
    console.error("Questions DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
