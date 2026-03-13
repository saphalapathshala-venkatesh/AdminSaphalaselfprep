import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { InfringementEventType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { contentType, contentId, courseId, lessonId, eventType } = body;

    if (!contentType || !contentId || !eventType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validTypes: InfringementEventType[] = [
      "COPY_ATTEMPT", "RIGHT_CLICK_ATTEMPT", "SELECTION_ATTEMPT", "KEYBOARD_COPY_ATTEMPT"
    ];
    if (!validTypes.includes(eventType)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;

    // Get current warning count
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { infringementWarnings: true, infringementBlocked: true },
    });

    if (!currentUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const newWarningCount = currentUser.infringementWarnings + 1;
    let actionTaken: "LOGGED" | "WARNING_1" | "WARNING_2" | "AUTO_BLOCKED" = "LOGGED";
    let shouldBlock = false;

    if (newWarningCount === 1) actionTaken = "WARNING_1";
    else if (newWarningCount === 2) actionTaken = "WARNING_2";
    else if (newWarningCount >= 3) {
      actionTaken = "AUTO_BLOCKED";
      shouldBlock = true;
    }

    // Create event record
    const event = await prisma.infringementEvent.create({
      data: {
        userId: user.id,
        contentType,
        contentId,
        courseId: courseId || null,
        lessonId: lessonId || null,
        eventType,
        userAgent,
        ipAddress,
        warningCountAt: currentUser.infringementWarnings,
        actionTaken,
      },
    });

    // Update user warning count and block if needed
    await prisma.user.update({
      where: { id: user.id },
      data: {
        infringementWarnings: newWarningCount,
        ...(shouldBlock && {
          infringementBlocked: true,
          isBlocked: true,
          blockedReason: "Auto-blocked: repeated content policy violations (3+ detected offenses)",
        }),
      },
    });

    // If auto-blocked, revoke active sessions
    if (shouldBlock) {
      await prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return NextResponse.json({
      event,
      warningCount: newWarningCount,
      actionTaken,
      isBlocked: shouldBlock || currentUser.infringementBlocked,
    });
  } catch (err) {
    console.error("Infringement log error:", err);
    return NextResponse.json({ error: "Failed to log infringement event" }, { status: 500 });
  }
}
