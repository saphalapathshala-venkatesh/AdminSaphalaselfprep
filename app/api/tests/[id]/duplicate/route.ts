export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const original = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      sections: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!original) return NextResponse.json({ error: "Test not found" }, { status: 404 });

  const {
    id: _id, code: _code, isPublished: _pub, publishedAt: _pubAt,
    createdAt: _ca, updatedAt: _ua, createdById: _cbi,
    sections: _sections, questions: _questions,
    ...scalarFields
  } = original as any;

  const newTest = await prisma.test.create({
    data: {
      ...scalarFields,
      title: `Copy of ${original.title}`,
      isPublished: false,
      publishedAt: null,
      code: null,
      createdById: user.id,
    },
  });

  const sectionIdMap = new Map<string, string>();

  const topLevel = original.sections.filter((s) => !s.parentSectionId);
  for (const s of topLevel) {
    const ns = await prisma.testSection.create({
      data: {
        testId: newTest.id,
        title: s.title,
        order: s.order,
        durationSec: s.durationSec,
        targetCount: s.targetCount,
        parentSectionId: null,
      },
    });
    sectionIdMap.set(s.id, ns.id);
  }

  const children = original.sections.filter((s) => !!s.parentSectionId);
  for (const s of children) {
    const newParentId = sectionIdMap.get(s.parentSectionId!) ?? null;
    const ns = await prisma.testSection.create({
      data: {
        testId: newTest.id,
        title: s.title,
        order: s.order,
        durationSec: s.durationSec,
        targetCount: s.targetCount,
        parentSectionId: newParentId,
      },
    });
    sectionIdMap.set(s.id, ns.id);
  }

  if (original.questions.length > 0) {
    await prisma.testQuestion.createMany({
      data: original.questions.map((q) => ({
        testId: newTest.id,
        questionId: q.questionId,
        sectionId: q.sectionId ? (sectionIdMap.get(q.sectionId) ?? null) : null,
        order: q.order,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
      })),
    });
  }

  return NextResponse.json({ data: { id: newTest.id, title: newTest.title } });
}
