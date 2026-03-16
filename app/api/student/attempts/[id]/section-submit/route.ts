export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentUserFromRequest } from "@/lib/studentAuth";

/**
 * POST /api/student/attempts/[id]/section-submit
 *
 * Submits the current section in a strict-section-mode test.
 *
 * Body: { sectionId: string }
 *
 * Behaviour:
 *  - Validates attempt is IN_PROGRESS and test has strictSectionMode=true
 *  - Creates an AttemptSectionSubmit record (idempotent — duplicate submit is a no-op)
 *  - Determines the next top-level section (by order)
 *  - If the submitted section is the last one → returns { allSectionsSubmitted: true }
 *    and the caller must immediately submit the full attempt
 *  - Otherwise → returns { nextSectionId, nextSectionTitle, nextSectionOrder }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getStudentUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { sectionId } = body;

    if (!sectionId || typeof sectionId !== "string") {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 });
    }

    // ── Load attempt with test metadata ──────────────────────────────────────
    const attempt = await prisma.attempt.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        userId: true,
        status: true,
        testId: true,
      },
    });

    if (!attempt) return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    if (attempt.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: `Cannot submit section for attempt with status "${attempt.status}".` },
        { status: 409 }
      );
    }

    // ── Load test + sections ──────────────────────────────────────────────────
    const test = await prisma.test.findUnique({
      where: { id: attempt.testId },
      select: {
        strictSectionMode: true,
        sections: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, order: true, parentSectionId: true },
        },
      },
    });

    if (!test) return NextResponse.json({ error: "Test not found" }, { status: 404 });

    if (!test.strictSectionMode) {
      return NextResponse.json(
        { error: "This test does not use strict section mode.", code: "NOT_STRICT_SECTION_MODE" },
        { status: 403 }
      );
    }

    // Only top-level sections participate in the sequential submit flow
    const topLevelSections = test.sections.filter((s) => s.parentSectionId === null);

    const targetSection = topLevelSections.find((s) => s.id === sectionId);
    if (!targetSection) {
      return NextResponse.json(
        { error: "Section not found in this test or is a subsection." },
        { status: 404 }
      );
    }

    // ── Idempotent upsert of the section-submit record ────────────────────────
    await prisma.attemptSectionSubmit.upsert({
      where: { attemptId_sectionId: { attemptId: params.id, sectionId } },
      update: {},
      create: { attemptId: params.id, sectionId },
    });

    // ── Determine next section ────────────────────────────────────────────────
    const nextSection = topLevelSections.find((s) => s.order > targetSection.order);

    if (!nextSection) {
      // Last section submitted — caller must now submit the full attempt
      return NextResponse.json({
        data: {
          sectionId,
          submittedAt: new Date().toISOString(),
          allSectionsSubmitted: true,
          nextSection: null,
        },
      });
    }

    return NextResponse.json({
      data: {
        sectionId,
        submittedAt: new Date().toISOString(),
        allSectionsSubmitted: false,
        nextSection: {
          id: nextSection.id,
          title: nextSection.title,
          order: nextSection.order,
        },
      },
    });
  } catch (err) {
    console.error("[student/attempts/[id]/section-submit/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
