export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { listZoomPolls, createZoomPoll } from "@/lib/zoom";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lc = await prisma.liveClass.findUnique({
    where: { id: params.id },
    select: { zoomMeetingId: true, platform: true },
  });
  if (!lc) return NextResponse.json({ error: "Live class not found" }, { status: 404 });
  if (lc.platform !== "ZOOM") return NextResponse.json({ error: "Not a Zoom session" }, { status: 400 });
  if (!lc.zoomMeetingId) return NextResponse.json({ polls: [] });

  try {
    const polls = await listZoomPolls(lc.zoomMeetingId);
    return NextResponse.json({ polls });
  } catch (err: any) {
    console.error("[polls GET]", err);
    return NextResponse.json({ error: err.message || "Zoom API error" }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lc = await prisma.liveClass.findUnique({
    where: { id: params.id },
    select: { zoomMeetingId: true, platform: true },
  });
  if (!lc) return NextResponse.json({ error: "Live class not found" }, { status: 404 });
  if (lc.platform !== "ZOOM") return NextResponse.json({ error: "Not a Zoom session" }, { status: 400 });
  if (!lc.zoomMeetingId) {
    return NextResponse.json({ error: "No Zoom meeting linked — create a Zoom meeting first" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { title, questions } = body as {
    title?: string;
    questions?: { name: string; type: string; answers: string[] }[];
  };

  if (!title?.trim()) return NextResponse.json({ error: "Poll title is required" }, { status: 400 });
  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "At least one question is required" }, { status: 400 });
  }

  for (const q of questions) {
    if (!q.name?.trim()) return NextResponse.json({ error: "Question text is required" }, { status: 400 });
    if (!["single", "multiple"].includes(q.type)) return NextResponse.json({ error: "Question type must be 'single' or 'multiple'" }, { status: 400 });
    const validAnswers = (q.answers || []).map((a: string) => a.trim()).filter(Boolean);
    if (validAnswers.length < 2) return NextResponse.json({ error: "Each question needs at least 2 answer options" }, { status: 400 });
    if (validAnswers.length > 10) return NextResponse.json({ error: "Maximum 10 answer options per question" }, { status: 400 });
  }

  try {
    const poll = await createZoomPoll(lc.zoomMeetingId, {
      title: title.trim(),
      questions: questions.map(q => ({
        name: q.name.trim(),
        type: q.type as "single" | "multiple",
        answers: q.answers.map((a: string) => a.trim()).filter(Boolean),
      })),
    });
    return NextResponse.json({ poll }, { status: 201 });
  } catch (err: any) {
    console.error("[polls POST]", err);
    return NextResponse.json({ error: err.message || "Zoom API error" }, { status: 502 });
  }
}
