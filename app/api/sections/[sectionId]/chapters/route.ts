import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { sectionId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chapters = await prisma.chapter.findMany({
    where: { sectionId: params.sectionId },
    orderBy: { sortOrder: "asc" },
    include: { lessons: { select: { id: true } } },
  });
  return NextResponse.json(chapters);
}

export async function POST(req: NextRequest, { params }: { params: { sectionId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description } = body;
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const count = await prisma.chapter.count({ where: { sectionId: params.sectionId } });
  const chapter = await prisma.chapter.create({
    data: { sectionId: params.sectionId, title: title.trim(), description: description || null, sortOrder: count },
  });
  return NextResponse.json(chapter, { status: 201 });
}
