export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts/[id]/answer
 *
 * Upsert an answer for a question within an active attempt.
 *
 * Body:
 * {
 *   questionId: string,
 *   selectedOptionIds: string[],
 *   isMarkedForReview?: boolean,
 *   timeSpentMs?: number
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { questionId, selectedOptionIds, isMarkedForReview, timeSpentMs } = body;

    if (!questionId) return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    if (!Array.isArray(selectedOptionIds)) {
      return NextResponse.json({ error: "selectedOptionIds must be an array" }, { status: 400 });
    }

    // Verify attempt belongs to user and is active
    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      select: { userId: true, status: true, testId: true },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({ error: "Attempt is already submitted" }, { status: 409 });
    }
    if (attempt.status === "PAUSED") {
      return NextResponse.json({ error: "Attempt is paused. Resume before answering." }, { status: 409 });
    }

    // Verify the question belongs to this test
    const testQuestion = await prisma.testQuestion.findUnique({
      where: { testId_questionId: { testId: attempt.testId, questionId } },
      select: { id: true },
    });

    if (!testQuestion) {
      return NextResponse.json({ error: "Question not part of this test" }, { status: 400 });
    }

    // Upsert the answer
    const answer = await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId: params.id, questionId } },
      create: {
        attemptId: params.id,
        questionId,
        selectedOptionIds,
        isMarkedForReview: isMarkedForReview ?? false,
        timeSpentMs: timeSpentMs ?? 0,
      },
      update: {
        selectedOptionIds,
        isMarkedForReview: isMarkedForReview ?? false,
        timeSpentMs: timeSpentMs ?? 0,
      },
    });

    return NextResponse.json({ data: { questionId: answer.questionId, saved: true } });
  } catch (err) {
    console.error("[student/attempts/[id]/answer/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
