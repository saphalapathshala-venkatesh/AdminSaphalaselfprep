export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

function computeTotalPausedMs(
  pauseEvents: Array<{ pausedAt: Date; resumedAt: Date | null }>
): number {
  const now = Date.now();
  return pauseEvents.reduce((acc, pe) => {
    const end = pe.resumedAt ? pe.resumedAt.getTime() : now;
    return acc + Math.max(0, end - pe.pausedAt.getTime());
  }, 0);
}

/**
 * GET /api/student/attempts/[id]
 *
 * Returns the current state of an attempt: answers, pause events, timing.
 * Only the owner of the attempt can access it.
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
      include: {
        answers: {
          select: {
            questionId: true,
            selectedOptionIds: true,
            isMarkedForReview: true,
            timeSpentMs: true,
          },
        },
        pauseEvents: {
          orderBy: { pausedAt: "asc" },
          select: { id: true, pausedAt: true, resumedAt: true },
        },
      },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const totalPausedMs = computeTotalPausedMs(attempt.pauseEvents);

    return NextResponse.json({
      data: {
        id: attempt.id,
        testId: attempt.testId,
        status: attempt.status,
        attemptNumber: attempt.attemptNumber,
        language: attempt.language,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        totalTimeUsedMs: attempt.totalTimeUsedMs,
        totalPausedMs,
        scorePct: attempt.scorePct,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        unansweredCount: attempt.unansweredCount,
        answers: attempt.answers,
        pauseEvents: attempt.pauseEvents.map((pe) => ({
          id: pe.id,
          pausedAt: pe.pausedAt.toISOString(),
          resumedAt: pe.resumedAt?.toISOString() ?? null,
        })),
      },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
