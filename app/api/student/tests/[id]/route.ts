export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * GET /api/student/tests/[id]
 *
 * Returns a student-friendly test payload with:
 * - Test metadata (title, instructions, timing, pause, marking)
 * - Hierarchical section/subsection structure
 * - Questions with section/subsection mapping and display order
 * - timerMode: "TOTAL" | "SECTION" | "SUBSECTION"
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        sections: {
          orderBy: { order: "asc" },
        },
        questions: {
          orderBy: { order: "asc" },
          include: {
            question: {
              select: {
                id: true,
                type: true,
                stem: true,
                stemSecondary: true,
                // explanation and explanationSecondary intentionally omitted —
                // served only after submission via GET /api/student/attempts/[id]/review
                difficulty: true,
                options: {
                  select: {
                    id: true,
                    text: true,
                    textSecondary: true,
                    order: true,
                    // isCorrect intentionally omitted from student payload
                  },
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });
    if (!test.isPublished) return NextResponse.json({ error: "Test not available" }, { status: 403 });

    // ── Section hierarchy ────────────────────────────────────────────────────
    const topLevelSections = test.sections.filter((s) => !s.parentSectionId);
    const subsectionsByParent: Record<string, typeof test.sections> = {};
    for (const s of test.sections) {
      if (s.parentSectionId) {
        if (!subsectionsByParent[s.parentSectionId]) subsectionsByParent[s.parentSectionId] = [];
        subsectionsByParent[s.parentSectionId].push(s);
      }
    }

    const sectionsEnabled = topLevelSections.length > 0;
    const subsectionsEnabled = test.sections.some((s) => s.parentSectionId !== null);

    // Build a lookup: sectionId → parentSectionId (for question mapping)
    const sectionParentMap: Record<string, string | null> = {};
    for (const s of test.sections) {
      sectionParentMap[s.id] = s.parentSectionId;
    }

    // ── Question-to-section mapping ──────────────────────────────────────────
    // Track display order within each section for FE convenience
    const sectionOrderCounter: Record<string, number> = {};

    const questions = test.questions.map((tq, globalIdx) => {
      const sid = tq.sectionId;
      let topLevelSectionId: string | null = null;
      let subsectionId: string | null = null;

      if (sid) {
        const parent = sectionParentMap[sid];
        if (parent !== undefined && parent !== null) {
          // This section IS a subsection
          subsectionId = sid;
          topLevelSectionId = parent;
        } else {
          // This section IS a top-level section
          topLevelSectionId = sid;
        }
      }

      const counterKey = topLevelSectionId ?? "__unsectioned__";
      const orderWithinSection = (sectionOrderCounter[counterKey] ?? 0) + 1;
      sectionOrderCounter[counterKey] = orderWithinSection;

      return {
        testQuestionId: tq.id,
        questionId: tq.questionId,
        sectionId: topLevelSectionId,
        subsectionId,
        displayOrder: globalIdx + 1,
        displayOrderWithinSection: orderWithinSection,
        marks: tq.marks,
        negativeMarks: tq.negativeMarks,
        type: tq.question.type,
        stem: tq.question.stem,
        stemSecondary: tq.question.stemSecondary ?? null,
        difficulty: tq.question.difficulty,
        options: tq.question.options,
      };
    });

    // ── Section structure for FE ─────────────────────────────────────────────
    const sections = topLevelSections.map((sec, idx) => {
      const subs = (subsectionsByParent[sec.id] ?? []).map((sub, subIdx) => {
        const subQIds = questions
          .filter((q) => q.subsectionId === sub.id)
          .map((q) => q.questionId);
        return {
          id: sub.id,
          title: sub.title,
          sortOrder: subIdx + 1,
          durationSec: sub.durationSec ?? null,
          questionCount: subQIds.length,
          questionIds: subQIds,
        };
      });

      const secQIds = questions
        .filter((q) => q.sectionId === sec.id && !q.subsectionId)
        .map((q) => q.questionId);

      const totalQCount = questions.filter((q) => q.sectionId === sec.id).length;

      return {
        id: sec.id,
        title: sec.title,
        sortOrder: idx + 1,
        durationSec: sec.durationSec ?? null,
        questionCount: totalQCount,
        directQuestionIds: secQIds, // questions directly in section (not in a subsection)
        subsections: subs,
      };
    });

    // ── Timer mode ───────────────────────────────────────────────────────────
    let timerMode: "TOTAL" | "SECTION" | "SUBSECTION" = "TOTAL";
    if (subsectionsEnabled && test.sections.some((s) => s.parentSectionId && s.durationSec)) {
      timerMode = "SUBSECTION";
    } else if (sectionsEnabled && topLevelSections.some((s) => s.durationSec)) {
      timerMode = "SECTION";
    }

    const payload = {
      id: test.id,
      title: test.title,
      instructions: test.instructions ?? null,
      mode: test.mode,
      isTimed: test.isTimed,
      totalDurationSec: test.durationSec ?? null,
      pauseAllowed: test.allowPause,
      strictSectionMode: test.strictSectionMode,
      sectionsEnabled,
      subsectionsEnabled,
      timerMode,
      languageAvailable: test.languageAvailable,
      attemptsAllowed: test.attemptsAllowed,
      xpEnabled: test.xpEnabled,
      xpValue: test.xpValue,
      marksPerQuestion: test.marksPerQuestion ?? null,
      negativeMarksPerQuestion: test.negativeMarksPerQuestion ?? null,
      shuffleQuestions: test.shuffleQuestions,
      shuffleOptions: test.shuffleOptions,
      testStartTime: test.testStartTime?.toISOString() ?? null,
      unlockAt: test.unlockAt?.toISOString() ?? null,
      sections,
      questions,
    };

    return NextResponse.json({ data: payload });
  } catch (err) {
    console.error("[student/tests/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
