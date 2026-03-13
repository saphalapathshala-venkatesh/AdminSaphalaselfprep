import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sections = await prisma.courseSubjectSection.findMany({
    where: { courseId: params.id },
    orderBy: { sortOrder: "asc" },
    include: { chapters: { select: { id: true } } },
  });
  return NextResponse.json(sections);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { subjectId, label, subtitle } = body;
  if (!subjectId) return NextResponse.json({ error: "subjectId required" }, { status: 400 });

  const count = await prisma.courseSubjectSection.count({ where: { courseId: params.id } });
  const section = await prisma.courseSubjectSection.create({
    data: { courseId: params.id, subjectId, label: label || null, subtitle: subtitle || null, sortOrder: count },
  });
  return NextResponse.json(section, { status: 201 });
}
