export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts/[id]/pause
 *
 * Pauses an IN_PROGRESS attempt.
 * - Validates that the test allows pause (allowPause = true)
 * - Checks endsAt: if the test has already expired, marks EXPIRED and rejects pause
 * - Creates an AttemptPause record with pausedAt = now
 * - Sets Attempt.status = PAUSED
 *
 * Body (optional): { totalTimeUsedMs: number } — lets FE sync elapsed time
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
      select: { id: true, userId: true, status: true, testId: true, endsAt: true },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: `Cannot pause attempt with status "${attempt.status}". Only IN_PROGRESS attempts can be paused.` },
        { status: 409 }
      );
    }

    // ── Timer check: reject pause if test has expired ────────────────────────
    const now = new Date();
    if (attempt.endsAt && now > attempt.endsAt) {
      await prisma.attempt.update({ where: { id: params.id }, data: { status: "EXPIRED" } });
      return NextResponse.json(
        { error: "Test time has expired.", code: "TEST_EXPIRED" },
        { status: 403 }
      );
    }

    // ── Verify the test allows pause ─────────────────────────────────────────
    const test = await prisma.test.findUnique({
      where: { id: attempt.testId },
      select: { allowPause: true },
    });

    if (!test?.allowPause) {
      return NextResponse.json(
        { error: "This test does not allow pausing.", code: "PAUSE_NOT_ALLOWED" },
        { status: 403 }
      );
    }

    // ── Atomically: create pause event + update attempt status ───────────────
    await prisma.$transaction([
      prisma.attemptPause.create({
        data: { attemptId: params.id, pausedAt: now },
      }),
      prisma.attempt.update({
        where: { id: params.id },
        data: {
          status: "PAUSED",
          ...(typeof totalTimeUsedMs === "number" ? { totalTimeUsedMs } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      data: { attemptId: params.id, status: "PAUSED", pausedAt: now.toISOString() },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/pause/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
