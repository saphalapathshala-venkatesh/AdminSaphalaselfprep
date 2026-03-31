export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * GET /api/student/attempts/[id]/review
 *
 * Returns the full review payload for a SUBMITTED attempt.
 * Explanations and correct-answer flags are only served here — never
 * in the initial test load — to preserve exam integrity.
 *
 * Guard: attempt.status must be "SUBMITTED".
 * Only the owner of the attempt can call this.
 *
 * Response shape:
 * {
 *   attemptId, testId, submittedAt, scorePct,
 *   correctCount, wrongCount, unansweredCount,
 *   questions: [{
 *     testQuestionId, questionId, displayOrder, sectionId, subsectionId,
 *     marks, negativeMarks, type, difficulty,
 *     stem, stemSecondary,
 *     explanation, explanationSecondary,
 *     options: [{ id, text, textSecondary, order, isCorrect }],
 *     selectedOptionIds, isMarkedForReview, isCorrect, timeSpentMs,
 *   }]
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
        testId: true,
        status: true,
        submittedAt: true,
        scorePct: true,
        correctCount: true,
        wrongCount: true,
        unansweredCount: true,
        language: true,
      },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Explanations are only available after the attempt is fully submitted
    if (attempt.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: "Review is only available after the attempt is submitted.", code: "NOT_SUBMITTED" },
        { status: 403 }
      );
    }

    // Load the test questions with full question data including explanations and correct flags
    const testQuestions = await prisma.testQuestion.findMany({
      where: { testId: attempt.testId },
      orderBy: { order: "asc" },
      select: {
        id: true,
        questionId: true,
        sectionId: true,
        order: true,
        marks: true,
        negativeMarks: true,
        question: {
          select: {
            id: true,
            type: true,
            difficulty: true,
            stem: true,
            stemSecondary: true,
            explanation: true,
            explanationSecondary: true,
            options: {
              select: {
                id: true,
                text: true,
                textSecondary: true,
                order: true,
                isCorrect: true, // included in review — attempt is already submitted
              },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    // Load the student's answers for this attempt
    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptId: params.id },
      select: {
        questionId: true,
        selectedOptionIds: true,
        isMarkedForReview: true,
        isCorrect: true,
        timeSpentMs: true,
      },
    });

    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    // Build section hierarchy for sectionId / subsectionId mapping
    const sections = await prisma.testSection.findMany({
      where: { testId: attempt.testId },
      select: { id: true, parentSectionId: true },
    });

    const sectionParentMap: Record<string, string | null> = {};
    for (const s of sections) {
      sectionParentMap[s.id] = s.parentSectionId;
    }

    const questions = testQuestions.map((tq, idx) => {
      const sid = tq.sectionId;
      let topLevelSectionId: string | null = null;
      let subsectionId: string | null = null;

      if (sid) {
        const parent = sectionParentMap[sid];
        if (parent !== undefined && parent !== null) {
          subsectionId = sid;
          topLevelSectionId = parent;
        } else {
          topLevelSectionId = sid;
        }
      }

      const ans = answerMap.get(tq.questionId);

      return {
        testQuestionId: tq.id,
        questionId: tq.questionId,
        displayOrder: idx + 1,
        sectionId: topLevelSectionId,
        subsectionId,
        marks: tq.marks,
        negativeMarks: tq.negativeMarks,
        type: tq.question.type,
        difficulty: tq.question.difficulty,
        stem: tq.question.stem,
        stemSecondary: tq.question.stemSecondary ?? null,
        explanation: tq.question.explanation ?? null,
        explanationSecondary: tq.question.explanationSecondary ?? null,
        options: tq.question.options,
        selectedOptionIds: ans?.selectedOptionIds ?? [],
        isMarkedForReview: ans?.isMarkedForReview ?? false,
        isCorrect: ans?.isCorrect ?? false,
        timeSpentMs: ans?.timeSpentMs ?? 0,
      };
    });

    return NextResponse.json({
      data: {
        attemptId: attempt.id,
        testId: attempt.testId,
        language: attempt.language,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        scorePct: attempt.scorePct,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        unansweredCount: attempt.unansweredCount,
        questions,
      },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/review/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
