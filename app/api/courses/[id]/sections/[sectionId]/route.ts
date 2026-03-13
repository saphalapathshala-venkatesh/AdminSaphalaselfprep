import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: { id: string; sectionId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { label, subtitle } = body;

  const section = await prisma.courseSubjectSection.update({
    where: { id: params.sectionId },
    data: { label: label ?? undefined, subtitle: subtitle ?? undefined },
  });
  return NextResponse.json(section);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; sectionId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.courseSubjectSection.delete({ where: { id: params.sectionId } });
  return NextResponse.json({ ok: true });
}
