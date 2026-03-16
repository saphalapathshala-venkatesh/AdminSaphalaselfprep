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

  // ── Effective unlock computation ──────────────────────────────────────────
  // For each LessonItem we compute:
  //   effectiveUnlockAt = LessonItem.unlockAt ?? sourceContent.unlockAt ?? null
  //   isLocked = effectiveUnlockAt !== null && effectiveUnlockAt > now
  // EXTERNAL_LINK items have no source content — they only use LessonItem.unlockAt.
  // We guard against null sourceId before pushing into ID arrays.

  const videoIds: string[] = [];
  const htmlPageIds: string[] = [];
  const pdfIds: string[] = [];
  const deckIds: string[] = [];

  for (const sec of sections) {
    for (const ch of sec.chapters) {
      for (const les of ch.lessons) {
        for (const item of les.items) {
          if (!item.sourceId) continue; // EXTERNAL_LINK and future types with no source
          if (item.itemType === "VIDEO") videoIds.push(item.sourceId);
          else if (item.itemType === "HTML_PAGE") htmlPageIds.push(item.sourceId);
          else if (item.itemType === "PDF") pdfIds.push(item.sourceId);
          else if (item.itemType === "FLASHCARD_DECK") deckIds.push(item.sourceId);
        }
      }
    }
  }

  const [videos, htmlPages, pdfs, decks] = await Promise.all([
    videoIds.length ? prisma.video.findMany({ where: { id: { in: videoIds } }, select: { id: true, unlockAt: true } }) : [],
    htmlPageIds.length ? prisma.contentPage.findMany({ where: { id: { in: htmlPageIds } }, select: { id: true, unlockAt: true } }) : [],
    pdfIds.length ? prisma.pdfAsset.findMany({ where: { id: { in: pdfIds } }, select: { id: true, unlockAt: true } }) : [],
    deckIds.length ? prisma.flashcardDeck.findMany({ where: { id: { in: deckIds } }, select: { id: true, unlockAt: true } }) : [],
  ]);

  const contentUnlockMap: Record<string, Date | null> = {};
  for (const r of [...videos, ...htmlPages, ...pdfs, ...decks]) {
    contentUnlockMap[r.id] = (r as { id: string; unlockAt: Date | null }).unlockAt;
  }

  const now = new Date();

  function enrichItems(items: typeof sections[0]["chapters"][0]["lessons"][0]["items"]) {
    return items.map((item) => {
      // EXTERNAL_LINK: no source content, unlock is only from LessonItem.unlockAt
      const contentUnlockAt = item.sourceId ? (contentUnlockMap[item.sourceId] ?? null) : null;
      const effectiveUnlockAt: Date | null = item.unlockAt ?? contentUnlockAt ?? null;
      const isLocked = effectiveUnlockAt !== null && effectiveUnlockAt > now;
      return { ...item, effectiveUnlockAt, isLocked };
    });
  }

  const enriched = sections.map((sec) => ({
    ...sec,
    subject: subjectMap[sec.subjectId] ?? null,
    chapters: sec.chapters.map((ch) => ({
      ...ch,
      lessons: ch.lessons.map((les) => ({
        ...les,
        items: enrichItems(les.items),
      })),
    })),
  }));

  return NextResponse.json({ course, sections: enriched });
}
