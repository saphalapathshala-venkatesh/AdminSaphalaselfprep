export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts/[id]/submit
 *
 * Submits an IN_PROGRESS, PAUSED, or EXPIRED attempt.
 * - Closes any open pause events
 * - Computes correct/wrong/unanswered counts and scorePct
 * - Sets Attempt.status = SUBMITTED and submittedAt = now
 * - Awards XP to the student wallet based on attempt number:
 *     attempt 1 → 100% of test.xpValue
 *     attempt 2 → 50%
 *     attempt ≥3 → 0%
 * - Accepts optional totalTimeUsedMs from FE for time sync
 *
 * Body (optional): { totalTimeUsedMs?: number }
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
      select: { id: true, userId: true, status: true, testId: true, attemptNumber: true },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({ error: "Attempt is already submitted." }, { status: 409 });
    }

    // ── Load test questions + test metadata in parallel ───────────────────────
    const [testQuestions, test] = await Promise.all([
      prisma.testQuestion.findMany({
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
      }),
      prisma.test.findUnique({
        where: { id: attempt.testId },
        select: { xpEnabled: true, xpValue: true },
      }),
    ]);

    // ── Load submitted answers ────────────────────────────────────────────────
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

      // All selected must be correct AND all correct must be selected
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

    // ── Persist result ────────────────────────────────────────────────────────
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

    // ── XP award ─────────────────────────────────────────────────────────────
    // Attempt 1 → 100%, Attempt 2 → 50%, Attempt ≥3 → 0%.
    // Fire-and-forget: XP failure must never break the submit response.
    let xpAwarded = 0;
    if (test?.xpEnabled && test.xpValue > 0) {
      const multiplier =
        attempt.attemptNumber === 1 ? 1.0 : attempt.attemptNumber === 2 ? 0.5 : 0;
      xpAwarded = Math.floor(test.xpValue * multiplier);

      if (xpAwarded > 0) {
        // Run all three XP writes in a single transaction
        prisma
          .$transaction([
            prisma.xpLedgerEntry.create({
              data: {
                userId: attempt.userId,
                delta: xpAwarded,
                reason: "TEST_COMPLETION",
                refType: "Attempt",
                refId: params.id,
                meta: {
                  testId: attempt.testId,
                  attemptNumber: attempt.attemptNumber,
                  xpMultiplier: multiplier,
                },
              },
            }),
            prisma.userXpWallet.upsert({
              where: { userId: attempt.userId },
              create: {
                userId: attempt.userId,
                currentXpBalance: xpAwarded,
                lifetimeXpEarned: xpAwarded,
              },
              update: {
                currentXpBalance: { increment: xpAwarded },
                lifetimeXpEarned: { increment: xpAwarded },
              },
            }),
            prisma.userXpSourceProgress.upsert({
              where: {
                userId_sourceType_sourceId: {
                  userId: attempt.userId,
                  sourceType: "TEST",
                  sourceId: attempt.testId,
                },
              },
              create: {
                userId: attempt.userId,
                sourceType: "TEST",
                sourceId: attempt.testId,
                completionCount: 1,
                totalXpAwarded: xpAwarded,
              },
              update: {
                completionCount: { increment: 1 },
                totalXpAwarded: { increment: xpAwarded },
              },
            }),
          ])
          .catch((xpErr) => {
            // Log but never surface to student — result is already saved
            console.error("[student/attempts/submit] XP award failed:", xpErr);
          });
      }
    }

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
        xpAwarded,
      },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/submit/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
