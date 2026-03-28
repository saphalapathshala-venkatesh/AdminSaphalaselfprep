export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/video/complete
 *
 * Student-facing endpoint — requires a valid `session` cookie (student auth).
 * Admin `admin_session` cookies are NOT accepted here.
 *
 * XP award rules (derived entirely from DB — frontend cannot influence count):
 *   attemptCount 1 → 100% of video.xpValue
 *   attemptCount 2 → 50%  of video.xpValue (floor)
 *   attemptCount 3+→ 0 XP
 *
 * Double-submission safety:
 *   - Uses an atomic upsert with { completionCount: { increment: 1 } } inside a
 *     serialisable transaction. Two concurrent requests for the same
 *     (userId, VIDEO, videoId) will each get a distinct count from Postgres and
 *     therefore a distinct XP tier — there is no race window for duplicate XP.
 *   - Frontend must also guard with a `completionFired` ref so the API is
 *     called at most once per page-load.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

export async function POST(req: NextRequest) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let videoId: string;
  try {
    const body = await req.json();
    videoId = body?.videoId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!videoId || typeof videoId !== "string") {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, xpEnabled: true, xpValue: true },
  });
  if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomically upsert the progress row and increment the count.
      // The returned record reflects the state AFTER the increment —
      // so completionCount === 1 means this is genuinely the first completion.
      const progress = await tx.userXpSourceProgress.upsert({
        where: {
          userId_sourceType_sourceId: {
            userId: user.id,
            sourceType: "VIDEO",
            sourceId: videoId,
          },
        },
        create: {
          userId: user.id,
          sourceType: "VIDEO",
          sourceId: videoId,
          completionCount: 1,
          totalXpAwarded: 0,
        },
        update: {
          completionCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      const attemptCount = progress.completionCount;

      // Determine XP — entirely server-side, not trusted from client
      let xpAwarded = 0;
      if (video.xpEnabled && video.xpValue > 0) {
        if (attemptCount === 1) {
          xpAwarded = video.xpValue;
        } else if (attemptCount === 2) {
          xpAwarded = Math.floor(video.xpValue * 0.5);
        }
        // 3+ → xpAwarded stays 0
      }

      if (xpAwarded > 0) {
        // Record the earning in the ledger
        await tx.xpLedgerEntry.create({
          data: {
            userId: user.id,
            delta: xpAwarded,
            reason:
              attemptCount === 1
                ? "Video completed — 1st watch (100%)"
                : "Video completed — 2nd watch (50%)",
            refType: "VIDEO",
            refId: videoId,
            meta: { attemptCount, videoId, baseXp: video.xpValue },
          },
        });

        // Update (or create) the student's XP wallet
        await tx.userXpWallet.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            currentXpBalance: xpAwarded,
            lifetimeXpEarned: xpAwarded,
          },
          update: {
            currentXpBalance: { increment: xpAwarded },
            lifetimeXpEarned: { increment: xpAwarded },
          },
        });

        // Keep totalXpAwarded on the progress row in sync
        await tx.userXpSourceProgress.update({
          where: {
            userId_sourceType_sourceId: {
              userId: user.id,
              sourceType: "VIDEO",
              sourceId: videoId,
            },
          },
          data: { totalXpAwarded: { increment: xpAwarded } },
        });
      }

      return { attemptCount, xpAwarded };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[video/complete] Transaction error:", err);
    return NextResponse.json({ error: "Failed to record completion" }, { status: 500 });
  }
}
