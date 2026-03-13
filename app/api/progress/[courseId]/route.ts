import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { courseId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sections = await prisma.courseSubjectSection.findMany({
    where: { courseId: params.courseId },
    include: {
      chapters: {
        include: {
          lessons: {
            include: { items: { select: { id: true } } },
          },
        },
      },
    },
  });

  const allItemIds: string[] = [];
  for (const sec of sections) {
    for (const ch of sec.chapters) {
      for (const les of ch.lessons) {
        for (const item of les.items) allItemIds.push(item.id);
      }
    }
  }

  const completions = allItemIds.length
    ? await prisma.userItemCompletion.findMany({
        where: { userId: user.id, lessonItemId: { in: allItemIds } },
        select: { lessonItemId: true },
      })
    : [];

  const completedSet = new Set(completions.map((c) => c.lessonItemId));

  const result = sections.map((sec) => {
    const sectionItems: string[] = [];
    const chapterData = sec.chapters.map((ch) => {
      const chapterItems: string[] = [];
      const lessonData = ch.lessons.map((les) => {
        const lessonItemIds = les.items.map((i) => i.id);
        const lessonCompleted = lessonItemIds.filter((id) => completedSet.has(id)).length;
        chapterItems.push(...lessonItemIds);
        return { lessonId: les.id, total: lessonItemIds.length, completed: lessonCompleted };
      });
      sectionItems.push(...chapterItems);
      return {
        chapterId: ch.id,
        total: chapterItems.length,
        completed: chapterItems.filter((id) => completedSet.has(id)).length,
        lessons: lessonData,
      };
    });
    return {
      sectionId: sec.id,
      subjectId: sec.subjectId,
      total: sectionItems.length,
      completed: sectionItems.filter((id) => completedSet.has(id)).length,
      chapters: chapterData,
    };
  });

  return NextResponse.json({
    totalItems: allItemIds.length,
    totalCompleted: completions.length,
    sections: result,
  });
}
