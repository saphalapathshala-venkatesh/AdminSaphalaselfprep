export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const PRACTICE_ONLY_TYPES = ["DRAG_REORDER", "DRAG_DROP", "FILL_BLANKS", "TRUE_FALSE"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        sections: { orderBy: { order: "asc" } },
        questions: {
          include: { question: { select: { id: true, type: true, status: true } } },
        },
      },
    });

    if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const errors: string[] = [];
    const warnings: string[] = [];

    if (test.questions.length === 0) {
      errors.push("Test has no questions.");
    }

    const unapproved = test.questions.filter((tq) => tq.question.status !== "APPROVED");
    if (unapproved.length > 0) {
      errors.push(`${unapproved.length} question(s) are not APPROVED.`);
    }

    const practiceOnly = test.questions.filter((tq) =>
      PRACTICE_ONLY_TYPES.includes(tq.question.type)
    );
    if (practiceOnly.length > 0) {
      errors.push(
        `${practiceOnly.length} question(s) use practice-only types (${practiceOnly.map((q) => q.question.type).join(", ")}). Not allowed in exam tests.`
      );
    }

    if (test.isTimed && !test.durationSec) {
      errors.push("Test is timed but total duration is not set.");
    }

    if (test.sections.length > 0) {
      const topLevelSections = test.sections.filter((s) => !s.parentSectionId);

      for (const section of topLevelSections) {
        const actual = test.questions.filter((tq) => tq.sectionId === section.id).length;

        if ((section.targetCount ?? 0) > 0 && actual !== section.targetCount) {
          errors.push(
            `Section "${section.title}": expected ${section.targetCount} question(s), found ${actual}.`
          );
        } else if (actual === 0) {
          warnings.push(`Section "${section.title}" has no questions assigned.`);
        }
      }

      const questionsWithoutSection = test.questions.filter((tq) => !tq.sectionId);
      if (questionsWithoutSection.length > 0) {
        errors.push(`${questionsWithoutSection.length} question(s) are not assigned to any section.`);
      }

      const sectionsWithTimer = topLevelSections.filter((s) => s.durationSec && s.durationSec > 0);
      if (sectionsWithTimer.length > 0 && test.durationSec) {
        const totalSectionSec = sectionsWithTimer.reduce((sum, s) => sum + (s.durationSec || 0), 0);
        if (totalSectionSec > test.durationSec) {
          errors.push(
            `Section time total (${Math.round(totalSectionSec / 60)} min) exceeds test total time (${Math.round(test.durationSec / 60)} min).`
          );
        }
        if (sectionsWithTimer.length === topLevelSections.length && totalSectionSec !== test.durationSec) {
          warnings.push(
            `All sections have timers, but their sum (${Math.round(totalSectionSec / 60)} min) does not equal the test total time (${Math.round(test.durationSec / 60)} min).`
          );
        }
      }
    }

    await writeAuditLog({
      actorId: user.id,
      action: "TEST_VALIDATE",
      entityType: "Test",
      entityId: params.id,
      after: { errors, warnings },
    });

    return NextResponse.json({
      data: {
        valid: errors.length === 0,
        errors,
        warnings,
      },
    });
  } catch (err) {
    console.error("Test validate error:", err);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
