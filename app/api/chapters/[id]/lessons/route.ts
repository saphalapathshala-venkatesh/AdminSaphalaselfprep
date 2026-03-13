import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lessons = await prisma.lesson.findMany({
    where: { chapterId: params.id },
    orderBy: { sortOrder: "asc" },
    include: { items: { select: { id: true } } },
  });
  return NextResponse.json(lessons);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, description, status } = body;
  if (!title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 });

  const count = await prisma.lesson.count({ where: { chapterId: params.id } });
  const lesson = await prisma.lesson.create({
    data: {
      chapterId: params.id,
      title: title.trim(),
      description: description || null,
      status: status || "PUBLISHED",
      sortOrder: count,
    },
  });
  return NextResponse.json(lesson, { status: 201 });
}
