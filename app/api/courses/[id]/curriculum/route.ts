import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = params.id;

  const [course, sections] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true, name: true, categoryId: true, courseType: true,
        hasHtmlCourse: true, hasVideoCourse: true, hasPdfCourse: true,
        hasTestSeries: true, hasFlashcardDecks: true,
      },
    }),
    prisma.courseSubjectSection.findMany({
      where: { courseId },
      orderBy: { sortOrder: "asc" },
      include: {
        chapters: {
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: { orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const subjectIds = sections.map((s) => s.subjectId);
  const subjects = subjectIds.length
    ? await prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true, categoryId: true },
      })
    : [];
  const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));

  const enriched = sections.map((sec) => ({
    ...sec,
    subject: subjectMap[sec.subjectId] ?? null,
  }));

  return NextResponse.json({ course, sections: enriched });
}
