export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { updateZoomPoll, deleteZoomPoll } from "@/lib/zoom";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lc = await prisma.liveClass.findUnique({
    where: { id: params.id },
    select: { zoomMeetingId: true, platform: true },
  });
  if (!lc || !lc.zoomMeetingId) return NextResponse.json({ error: "No Zoom meeting linked" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { title, questions } = body as {
    title?: string;
    questions?: { name: string; type: string; answers: string[] }[];
  };

  if (!title?.trim()) return NextResponse.json({ error: "Poll title is required" }, { status: 400 });
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
  }

  try {
    await updateZoomPoll(lc.zoomMeetingId, params.pollId, {
      title: title.trim(),
      questions: questions.map(q => ({
        name: q.name.trim(),
        type: q.type as "single" | "multiple",
        answers: q.answers.map((a: string) => a.trim()).filter(Boolean),
      })),
    });
    return NextResponse.json({ updated: true });
  } catch (err: any) {
    console.error("[polls PUT]", err);
    return NextResponse.json({ error: err.message || "Zoom API error" }, { status: 502 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; pollId: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lc = await prisma.liveClass.findUnique({
    where: { id: params.id },
    select: { zoomMeetingId: true, platform: true },
  });
  if (!lc || !lc.zoomMeetingId) return NextResponse.json({ error: "No Zoom meeting linked" }, { status: 404 });

  try {
    await deleteZoomPoll(lc.zoomMeetingId, params.pollId);
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    console.error("[polls DELETE]", err);
    return NextResponse.json({ error: err.message || "Zoom API error" }, { status: 502 });
  }
}
