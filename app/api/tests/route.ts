import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;
  const search = searchParams.get("search") || "";
  const seriesId = searchParams.get("seriesId");
  const published = searchParams.get("published");

  const where: any = {};
  if (search) where.title = { contains: search, mode: "insensitive" };
  if (seriesId) where.seriesId = seriesId;
  if (published === "true") where.isPublished = true;
  if (published === "false") where.isPublished = false;

  try {
    const [items, total] = await Promise.all([
      prisma.test.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          series: { select: { id: true, title: true } },
          _count: { select: { questions: true, sections: true } },
        },
      }),
      prisma.test.count({ where }),
    ]);

    return NextResponse.json({
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Tests GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, instructions, mode, isTimed, durationSec, allowPause, strictSectionMode, seriesId } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    if (!mode || !["TIMED", "SECTIONAL", "MULTI_SECTION"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const test = await prisma.test.create({
      data: {
        title: title.trim(),
        instructions: instructions?.trim() || null,
        mode,
        isTimed: isTimed !== undefined ? isTimed : true,
        durationSec: durationSec ? parseInt(durationSec) : null,
        allowPause: allowPause || false,
        strictSectionMode: strictSectionMode || false,
        seriesId: seriesId || null,
        createdById: user.id,
      },
      include: {
        sections: { orderBy: { order: "asc" } },
        questions: { orderBy: { order: "asc" }, include: { question: true } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "TEST_CREATE",
      entityType: "Test",
      entityId: test.id,
      after: { title: test.title, mode: test.mode },
    });

    return NextResponse.json({ data: test }, { status: 201 });
  } catch (err) {
    console.error("Tests POST error:", err);
    return NextResponse.json({ error: "Failed to create test" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, title, instructions, mode, isTimed, durationSec, allowPause, strictSectionMode, seriesId, sections, questions } = body;

    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await prisma.test.findUnique({
      where: { id },
      include: { sections: true, questions: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.test.update({
        where: { id },
        data: {
          title: title?.trim() || existing.title,
          instructions: instructions !== undefined ? (instructions?.trim() || null) : existing.instructions,
          mode: mode || existing.mode,
          isTimed: isTimed !== undefined ? isTimed : existing.isTimed,
          durationSec: durationSec !== undefined ? (durationSec ? parseInt(durationSec) : null) : existing.durationSec,
          allowPause: allowPause !== undefined ? allowPause : existing.allowPause,
          strictSectionMode: strictSectionMode !== undefined ? strictSectionMode : existing.strictSectionMode,
          seriesId: seriesId !== undefined ? (seriesId || null) : existing.seriesId,
        },
      });

      if (sections !== undefined && Array.isArray(sections)) {
        await tx.testQuestion.deleteMany({ where: { testId: id } });
        await tx.testSection.deleteMany({ where: { testId: id } });
        if (sections.length > 0) {
          await tx.testSection.createMany({
            data: sections.map((s: any, i: number) => ({
              testId: id,
              title: s.title || `Section ${i + 1}`,
              order: i,
              durationSec: s.durationSec ? parseInt(s.durationSec) : null,
            })),
          });
        }
      }

      if (questions !== undefined && Array.isArray(questions)) {
        if (!(sections !== undefined && Array.isArray(sections))) {
          await tx.testQuestion.deleteMany({ where: { testId: id } });
        }

        const newSections = await tx.testSection.findMany({
          where: { testId: id },
          orderBy: { order: "asc" },
        });

        if (questions.length > 0) {
          const tqData = questions.map((q: any, i: number) => {
            let sectionId: string | null = null;
            if (q.sectionIndex !== undefined && q.sectionIndex !== null && newSections[q.sectionIndex]) {
              sectionId = newSections[q.sectionIndex].id;
            } else if (q.sectionId) {
              sectionId = q.sectionId;
            }
            return {
              testId: id,
              questionId: q.questionId,
              sectionId,
              order: i,
            };
          });
          await tx.testQuestion.createMany({ data: tqData });
        }
      }

      return tx.test.findUnique({
        where: { id },
        include: {
          sections: { orderBy: { order: "asc" } },
          questions: { orderBy: { order: "asc" }, include: { question: true } },
        },
      });
    });

    await writeAuditLog({
      actorId: user.id,
      action: "TEST_UPDATE",
      entityType: "Test",
      entityId: id,
      before: { title: existing.title, mode: existing.mode },
      after: { title: result?.title, mode: result?.mode },
    });

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("Tests PUT error:", err);
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Duplicate question in test" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update test" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const existing = await prisma.test.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (existing.isPublished && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Only SUPER_ADMIN can delete published tests" }, { status: 403 });
    }

    await prisma.test.delete({ where: { id } });

    await writeAuditLog({
      actorId: user.id,
      action: "TEST_DELETE",
      entityType: "Test",
      entityId: id,
      before: { title: existing.title },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    console.error("Tests DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
