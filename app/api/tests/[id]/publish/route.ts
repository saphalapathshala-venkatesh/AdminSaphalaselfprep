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

    if (test.isPublished) {
      return NextResponse.json({ error: "Test is already published" }, { status: 400 });
    }

    const errors: string[] = [];

    if (test.questions.length === 0) errors.push("Test has no questions.");

    const unapproved = test.questions.filter((tq) => tq.question.status !== "APPROVED");
    if (unapproved.length > 0) errors.push(`${unapproved.length} question(s) are not APPROVED.`);

    const practiceOnly = test.questions.filter((tq) => PRACTICE_ONLY_TYPES.includes(tq.question.type));
    if (practiceOnly.length > 0) errors.push(`Practice-only question types found.`);

    if (test.isTimed && !test.durationSec) errors.push("Timed test missing duration.");

    if (test.sections.length > 0) {
      const topLevelSections = test.sections.filter((s) => !s.parentSectionId);

      for (const section of topLevelSections) {
        const actual = test.questions.filter((tq) => tq.sectionId === section.id).length;
        if ((section.targetCount ?? 0) > 0 && actual !== section.targetCount) {
          errors.push(`Section "${section.title}": expected ${section.targetCount} question(s), found ${actual}.`);
        } else if (actual === 0) {
          errors.push(`Section "${section.title}" has no questions assigned.`);
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
          errors.push(`Section time total (${Math.round(totalSectionSec / 60)} min) exceeds test total time (${Math.round(test.durationSec / 60)} min).`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: "Cannot publish. Validation errors exist.",
        data: { errors },
      }, { status: 400 });
    }

    const updated = await prisma.test.update({
      where: { id: params.id },
      data: { isPublished: true, publishedAt: new Date() },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "TEST_PUBLISH",
      entityType: "Test",
      entityId: params.id,
      before: { isPublished: false },
      after: { isPublished: true, publishedAt: updated.publishedAt },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Test publish error:", err);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
