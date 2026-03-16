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
 *   selectedOptionIds: string[],   // must be valid option IDs for this question
 *   isMarkedForReview?: boolean,
 *   timeSpentMs?: number
 * }
 *
 * Security guarantees:
 *  1. Timer enforcement — server checks endsAt; lazily marks attempt EXPIRED on timeout.
 *  2. Section lock — rejects answers for sections already submitted (strictSectionMode).
 *  3. Option validation — rejects option IDs that don't belong to this question.
 *  4. Cross-test injection — rejects question IDs not in this test.
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

    // ── Verify attempt ownership and status ──────────────────────────────────
    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      select: { userId: true, status: true, testId: true, endsAt: true },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (attempt.status === "SUBMITTED") {
      return NextResponse.json({ error: "Attempt is already submitted." }, { status: 409 });
    }
    if (attempt.status === "PAUSED") {
      return NextResponse.json({ error: "Attempt is paused. Resume before answering." }, { status: 409 });
    }
    if (attempt.status === "EXPIRED") {
      return NextResponse.json({ error: "Test time has expired.", code: "TEST_EXPIRED" }, { status: 403 });
    }

    // ── Server-side timer enforcement (lazy expiry) ──────────────────────────
    // If endsAt has passed, lazily expire the attempt and block further answers.
    // The frontend should catch TEST_EXPIRED and immediately call the submit endpoint.
    const now = new Date();
    if (attempt.endsAt && now > attempt.endsAt) {
      await prisma.attempt.update({ where: { id: params.id }, data: { status: "EXPIRED" } });
      return NextResponse.json(
        { error: "Test time has expired.", code: "TEST_EXPIRED" },
        { status: 403 }
      );
    }

    // ── Verify question belongs to this test ─────────────────────────────────
    // Also fetch sectionId (for section lock) and option IDs (for option validation).
    const testQuestion = await prisma.testQuestion.findUnique({
      where: { testId_questionId: { testId: attempt.testId, questionId } },
      select: {
        id: true,
        sectionId: true,
        test: { select: { strictSectionMode: true } },
        question: { select: { options: { select: { id: true } } } },
      },
    });

    if (!testQuestion) {
      return NextResponse.json({ error: "Question not part of this test." }, { status: 400 });
    }

    // ── Option ID validation ─────────────────────────────────────────────────
    // Prevents a student from submitting option IDs from a different question.
    if (selectedOptionIds.length > 0) {
      const validOptionIds = new Set(testQuestion.question.options.map((o) => o.id));
      const invalid = (selectedOptionIds as string[]).filter((id) => !validOptionIds.has(id));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "One or more selected options are not valid for this question.", code: "INVALID_OPTIONS" },
          { status: 400 }
        );
      }
    }

    // ── Strict section lock ──────────────────────────────────────────────────
    // If strictSectionMode is enabled and the question's section has already been
    // submitted via section-submit, block any further edits to answers in that section.
    if (testQuestion.sectionId && testQuestion.test.strictSectionMode) {
      const sectionSubmit = await prisma.attemptSectionSubmit.findUnique({
        where: {
          attemptId_sectionId: { attemptId: params.id, sectionId: testQuestion.sectionId },
        },
      });
      if (sectionSubmit) {
        return NextResponse.json(
          { error: "This section has already been submitted and is now locked.", code: "SECTION_LOCKED" },
          { status: 403 }
        );
      }
    }

    // ── Upsert the answer ────────────────────────────────────────────────────
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
