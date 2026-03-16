export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts/[id]/submit
 *
 * Submits an IN_PROGRESS or PAUSED attempt.
 * - Closes any open pause events
 * - Computes correct/wrong/unanswered counts and scorePct
 * - Sets Attempt.status = SUBMITTED and submittedAt = now
 * - Accepts optional totalTimeUsedMs from FE for accurate time tracking
 *
 * Body (optional): { totalTimeUsedMs?: number }
 *
 * Returns: result summary
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { totalTimeUsedMs } = body;

    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true, testId: true },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({ error: "Attempt is already submitted" }, { status: 409 });
    }

    // ── Load test questions with correct answers ──────────────────────────────
    const testQuestions = await prisma.testQuestion.findMany({
      where: { testId: attempt.testId },
      select: {
        questionId: true,
        marks: true,
        negativeMarks: true,
        question: {
          select: {
            options: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });

    // Load submitted answers
    const answers = await prisma.attemptAnswer.findMany({
      where: { attemptId: params.id },
      select: { questionId: true, selectedOptionIds: true },
    });

    const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]));

    // ── Score computation ─────────────────────────────────────────────────────
    let totalMarks = 0;
    let earnedMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    for (const tq of testQuestions) {
      totalMarks += tq.marks;
      const correctOptionIds = new Set(
        tq.question.options.filter((o) => o.isCorrect).map((o) => o.id)
      );
      const selected = answerMap.get(tq.questionId) ?? [];

      if (selected.length === 0) {
        unansweredCount++;
        continue;
      }

      // All selected options must be correct and all correct options must be selected
      const allSelectedCorrect = selected.every((id) => correctOptionIds.has(id));
      const allCorrectSelected = correctOptionIds.size === selected.length && allSelectedCorrect;

      if (allCorrectSelected) {
        earnedMarks += tq.marks;
        correctCount++;
      } else {
        earnedMarks -= tq.negativeMarks;
        wrongCount++;
      }
    }

    const scorePct = totalMarks > 0 ? Math.max(0, (earnedMarks / totalMarks) * 100) : 0;
    const now = new Date();

    // ── Close any open pause events ───────────────────────────────────────────
    await prisma.attemptPause.updateMany({
      where: { attemptId: params.id, resumedAt: null },
      data: { resumedAt: now },
    });

    // ── Update attempt ────────────────────────────────────────────────────────
    const updated = await prisma.attempt.update({
      where: { id: params.id },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        scorePct: Math.round(scorePct * 100) / 100,
        correctCount,
        wrongCount,
        unansweredCount,
        ...(typeof totalTimeUsedMs === "number" ? { totalTimeUsedMs } : {}),
      },
    });

    return NextResponse.json({
      data: {
        attemptId: params.id,
        status: "SUBMITTED",
        submittedAt: now.toISOString(),
        scorePct: updated.scorePct,
        correctCount,
        wrongCount,
        unansweredCount,
        totalQuestions: testQuestions.length,
        earnedMarks: Math.round(earnedMarks * 100) / 100,
        totalMarks: Math.round(totalMarks * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/submit/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
