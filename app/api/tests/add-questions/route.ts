export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { computeContentHash } from "@/lib/questionHash";

// POST /api/tests/add-questions
// Body: { testId, sectionId, questions: ReviewItem[] }
// Each ReviewItem: { stem, type, difficulty, explanation, categoryId, subjectId, topicId, subtopicId,
//                   sourceTag, marks, negativeMarks, options: [{text, isCorrect}],
//                   passageText?, groupId?, existingQuestionId? }
// If existingQuestionId is provided and no edits → use that questionId directly
// If existingQuestionId is provided with edits → save as new Question
// If no existingQuestionId → save as new Question

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { testId, sectionId, questions } = body as {
      testId: string;
      sectionId: string | null;
      questions: any[];
    };

    if (!testId) return NextResponse.json({ error: "testId is required" }, { status: 400 });
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "questions array is required" }, { status: 400 });
    }

    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    if (sectionId) {
      const section = await prisma.testSection.findUnique({ where: { id: sectionId } });
      if (!section || section.testId !== testId) {
        return NextResponse.json({ error: "Section not found or not part of this test" }, { status: 404 });
      }
    }

    const existing = await prisma.testQuestion.findMany({
      where: { testId },
      select: { questionId: true, order: true },
    });
    const existingQIds = new Set(existing.map((q: { questionId: string }) => q.questionId));
    let nextOrder = existing.length > 0 ? Math.max(...existing.map((q: { order: number }) => q.order)) + 1 : 0;

    const committed: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    const VALID_TYPES = ["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "PASSAGE_BASED", "INTEGER", "DESCRIPTIVE"];
    const VALID_DIFF = ["FOUNDATIONAL", "MODERATE", "ADVANCED"];

    await prisma.$transaction(async (tx) => {
      for (const item of questions) {
        try {
          const stem = (item.stem || "").trim();
          if (!stem) { errors.push(`Skipped: empty stem`); continue; }

          const type = VALID_TYPES.includes(item.type) ? item.type : "MCQ_SINGLE";
          const difficulty = VALID_DIFF.includes(item.difficulty) ? item.difficulty : "FOUNDATIONAL";
          const options: { text: string; isCorrect: boolean }[] = Array.isArray(item.options) ? item.options : [];
          const marks = Math.max(0, parseFloat(String(item.marks ?? 1)) || 1);
          const negativeMarks = Math.max(0, parseFloat(String(item.negativeMarks ?? 0)) || 0);

          let questionId: string;
          const isEdited = item.isEdited === true;
          const hasExisting = !!item.existingQuestionId;

          if (hasExisting && !isEdited) {
            questionId = item.existingQuestionId;
          } else {
            const hash = computeContentHash(stem, options.map((o: { text: string }) => ({ text: o.text })), type);
            const dup = await tx.question.findUnique({ where: { contentHash: hash } });
            if (dup) {
              questionId = dup.id;
            } else {
              const tags: string[] = [];
              if (item.sourceTag) tags.push(`source:${item.sourceTag}`);
              if (item.groupId) tags.push(`group:${item.groupId}`);
              if (item.passageText) tags.push(`passage:${item.passageText.slice(0, 500)}`);

              const newQ = await tx.question.create({
                data: {
                  stem,
                  type,
                  difficulty,
                  explanation: item.explanation?.trim() || null,
                  categoryId: item.categoryId || null,
                  subjectId: item.subjectId || null,
                  topicId: item.topicId || null,
                  subtopicId: item.subtopicId || null,
                  tags,
                  contentHash: hash,
                  status: "APPROVED",
                  options: {
                    create: options.map((opt: { text: string; isCorrect: boolean }, idx: number) => ({
                      text: opt.text.trim(),
                      isCorrect: opt.isCorrect === true,
                      order: idx,
                    })),
                  },
                },
              });
              questionId = newQ.id;
            }
          }

          if (existingQIds.has(questionId)) {
            skipped.push(questionId);
            continue;
          }

          await tx.testQuestion.create({
            data: {
              testId,
              questionId,
              sectionId: sectionId || null,
              order: nextOrder++,
              marks,
              negativeMarks,
            },
          });
          existingQIds.add(questionId);
          committed.push(questionId);
        } catch (innerErr: any) {
          errors.push(`Error on item: ${innerErr?.message || "unknown"}`);
        }
      }
    });

    writeAuditLog({
      actorId: user.id,
      action: "TEST_ADD_QUESTIONS",
      entityType: "Test",
      entityId: testId,
      after: { sectionId, committed: committed.length, skipped: skipped.length, errors: errors.length },
    }).catch(() => {});

    const updatedSections = await prisma.testSection.findMany({
      where: { testId },
      orderBy: { order: "asc" },
      select: { id: true, title: true, order: true, durationSec: true, targetCount: true, parentSectionId: true },
    });
    const updatedQuestions = await prisma.testQuestion.findMany({
      where: { testId },
      orderBy: { order: "asc" },
      include: {
        question: {
          select: {
            id: true, type: true, stem: true, difficulty: true, status: true,
            categoryId: true, subjectId: true, topicId: true, subtopicId: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: { committed: committed.length, skipped: skipped.length, errors, sections: updatedSections, questions: updatedQuestions },
    });
  } catch (err) {
    console.error("Add questions error:", err);
    return NextResponse.json({ error: "Failed to add questions" }, { status: 500 });
  }
}
