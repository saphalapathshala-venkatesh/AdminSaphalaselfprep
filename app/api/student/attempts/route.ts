export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts
 *
 * Start a new attempt for a test, or resume an existing IN_PROGRESS/PAUSED attempt.
 *
 * Body: { testId: string, language?: "EN" | "TE" | "BOTH" }
 *
 * Returns: { data: { attemptId, attemptNumber, status, startedAt } }
 */
export async function POST(req: NextRequest) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { testId, language } = body;

    if (!testId) return NextResponse.json({ error: "testId is required" }, { status: 400 });

    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: { id: true, isPublished: true, attemptsAllowed: true, unlockAt: true },
    });

    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    if (!test.isPublished) return NextResponse.json({ error: "Test not available" }, { status: 403 });
    if (test.unlockAt && test.unlockAt > new Date()) {
      return NextResponse.json({ error: "Test is not yet unlocked", code: "TEST_LOCKED" }, { status: 403 });
    }

    // ── Resume if an active attempt exists ──────────────────────────────────
    const activeAttempt = await prisma.attempt.findFirst({
      where: {
        testId,
        userId: user.id,
        status: { in: ["IN_PROGRESS", "PAUSED"] },
      },
      orderBy: { startedAt: "desc" },
    });

    if (activeAttempt) {
      return NextResponse.json({
        data: {
          attemptId: activeAttempt.id,
          attemptNumber: activeAttempt.attemptNumber,
          status: activeAttempt.status,
          startedAt: activeAttempt.startedAt.toISOString(),
          resumed: true,
        },
      });
    }

    // ── Check attemptsAllowed ────────────────────────────────────────────────
    const pastCount = await prisma.attempt.count({
      where: { testId, userId: user.id, status: "SUBMITTED" },
    });

    if (pastCount >= test.attemptsAllowed) {
      return NextResponse.json(
        { error: `Attempt limit reached. You may only attempt this test ${test.attemptsAllowed} time(s).`, code: "ATTEMPTS_EXHAUSTED" },
        { status: 403 }
      );
    }

    // ── Create new attempt ───────────────────────────────────────────────────
    const attempt = await prisma.attempt.create({
      data: {
        userId: user.id,
        testId,
        language: (language as "EN" | "TE" | "BOTH") ?? "EN",
        status: "IN_PROGRESS",
        attemptNumber: pastCount + 1,
      },
    });

    return NextResponse.json(
      {
        data: {
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          startedAt: attempt.startedAt.toISOString(),
          resumed: false,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[student/attempts/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
