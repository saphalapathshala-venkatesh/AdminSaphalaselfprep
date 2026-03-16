export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts/[id]/resume
 *
 * Resumes a PAUSED attempt.
 * - Closes the latest open AttemptPause event (sets resumedAt = now)
 * - Extends Attempt.endsAt by the pause duration so the learner does not lose time
 * - Sets Attempt.status = IN_PROGRESS
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true, endsAt: true },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (attempt.status !== "PAUSED") {
      return NextResponse.json(
        { error: `Cannot resume attempt with status "${attempt.status}". Only PAUSED attempts can be resumed.` },
        { status: 409 }
      );
    }

    // Find the latest open pause event (no resumedAt yet)
    const openPause = await prisma.attemptPause.findFirst({
      where: { attemptId: params.id, resumedAt: null },
      orderBy: { pausedAt: "desc" },
    });

    const now = new Date();

    // Extend endsAt by the duration of this pause so the learner doesn't lose time
    let newEndsAt: Date | undefined;
    if (openPause && attempt.endsAt) {
      const pauseDurationMs = now.getTime() - openPause.pausedAt.getTime();
      newEndsAt = new Date(attempt.endsAt.getTime() + pauseDurationMs);
    }

    await prisma.$transaction([
      // Close the open pause event
      ...(openPause
        ? [prisma.attemptPause.update({
            where: { id: openPause.id },
            data: { resumedAt: now },
          })]
        : []),
      // Restore IN_PROGRESS and extend timer
      prisma.attempt.update({
        where: { id: params.id },
        data: {
          status: "IN_PROGRESS",
          ...(newEndsAt ? { endsAt: newEndsAt } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      data: {
        attemptId: params.id,
        status: "IN_PROGRESS",
        resumedAt: now.toISOString(),
        ...(newEndsAt ? { endsAt: newEndsAt.toISOString() } : {}),
      },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/resume/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
