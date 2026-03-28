export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(_req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doubt = await prisma.doubt.findUnique({
    where: { id: params.id },
    include: {
      student: { select: { id: true, name: true, email: true, mobile: true } },
      video: { select: { id: true, title: true } },
      course: { select: { id: true, name: true } },
      answeredBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!doubt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: doubt });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.doubt.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { answer, status } = body;

    const VALID_STATUSES = ["OPEN", "ANSWERED", "CLOSED"];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const resolvedStatus = status || (answer?.trim() ? "ANSWERED" : existing.status);

    const updated = await prisma.doubt.update({
      where: { id: params.id },
      data: {
        answer: answer !== undefined ? (answer?.trim() || null) : existing.answer,
        status: resolvedStatus as any,
        answeredById: resolvedStatus === "ANSWERED" && !existing.answeredById ? user.id : existing.answeredById,
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        video: { select: { id: true, title: true } },
        course: { select: { id: true, name: true } },
        answeredBy: { select: { id: true, name: true, email: true } },
      },
    });

    writeAuditLog({
      actorId: user.id, action: "DOUBT_UPDATE", entityType: "Doubt", entityId: params.id,
      before: { status: existing.status },
      after: { status: updated.status, hasAnswer: !!updated.answer },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Doubt PATCH error:", err);
    return NextResponse.json({ error: "Failed to update doubt" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.doubt.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.doubt.delete({ where: { id: params.id } });
    writeAuditLog({
      actorId: user.id, action: "DOUBT_DELETE", entityType: "Doubt", entityId: params.id,
      before: { status: existing.status },
    });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Doubt DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
