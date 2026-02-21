import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  computeContentHash,
  computeSimilarity,
} from "@/lib/questionHash";

const VALID_TYPES = [
  "MCQ_SINGLE",
  "MCQ_MULTIPLE",
  "DRAG_REORDER",
  "DRAG_DROP",
  "FILL_BLANKS",
  "TRUE_FALSE",
];
const VALID_DIFFICULTIES = ["FOUNDATIONAL", "PROFICIENT", "MASTERY"];
const VALID_STATUSES = ["DRAFT", "APPROVED"];
const MCQ_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE"];
const NEAR_DUP_THRESHOLD = 0.85;

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const difficulty = searchParams.get("difficulty");
  const categoryId = searchParams.get("categoryId");
  const subjectId = searchParams.get("subjectId");
  const topicId = searchParams.get("topicId");
  const subtopicId = searchParams.get("subtopicId");
  const search = searchParams.get("search");

  const where: any = {};
  if (type && VALID_TYPES.includes(type)) where.type = type;
  if (status && VALID_STATUSES.includes(status)) where.status = status;
  if (difficulty && VALID_DIFFICULTIES.includes(difficulty)) where.difficulty = difficulty;
  if (categoryId) where.categoryId = categoryId;
  if (subjectId) where.subjectId = subjectId;
  if (topicId) where.topicId = topicId;
  if (subtopicId) where.subtopicId = subtopicId;
  if (search) {
    where.OR = [
      { stem: { contains: search, mode: "insensitive" } },
      { tags: { has: search } },
    ];
  }

  try {
    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        include: {
          options: { orderBy: { order: "asc" } },
          subtopic: {
            select: {
              id: true,
              name: true,
              topic: {
                select: {
                  id: true,
                  name: true,
                  subject: {
                    select: {
                      id: true,
                      name: true,
                      category: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.question.count({ where }),
    ]);

    return NextResponse.json({
      data: questions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Questions GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      type,
      difficulty,
      stem,
      explanation,
      tags,
      categoryId,
      subjectId,
      topicId,
      subtopicId,
      options,
      status: qStatus,
      confirmNearDuplicate,
    } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
    }
    if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty level" }, { status: 400 });
    }
    if (!stem || typeof stem !== "string" || !stem.trim()) {
      return NextResponse.json({ error: "Question stem is required" }, { status: 400 });
    }

    const isMCQ = MCQ_TYPES.includes(type);
    let validatedOptions: { text: string; isCorrect: boolean; order: number }[] = [];

    if (isMCQ) {
      if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
        return NextResponse.json(
          { error: "MCQ questions require 2-8 options" },
          { status: 400 }
        );
      }
      validatedOptions = options.map((o: any, i: number) => ({
        text: String(o.text || "").trim(),
        isCorrect: Boolean(o.isCorrect),
        order: i,
      }));
      if (validatedOptions.some((o) => !o.text)) {
        return NextResponse.json({ error: "All options must have text" }, { status: 400 });
      }
      const correctCount = validatedOptions.filter((o) => o.isCorrect).length;
      if (type === "MCQ_SINGLE" && correctCount !== 1) {
        return NextResponse.json(
          { error: "MCQ_SINGLE must have exactly 1 correct option" },
          { status: 400 }
        );
      }
      if (type === "MCQ_MULTIPLE" && correctCount < 1) {
        return NextResponse.json(
          { error: "MCQ_MULTIPLE must have at least 1 correct option" },
          { status: 400 }
        );
      }
    }

    const contentHash = computeContentHash(stem, validatedOptions, type);

    const existingExact = await prisma.question.findUnique({
      where: { contentHash },
    });
    if (existingExact) {
      return NextResponse.json(
        {
          error:
            "Exact duplicate blocked. Modify question/options before saving.",
          duplicateId: existingExact.id,
        },
        { status: 409 }
      );
    }

    if (!confirmNearDuplicate && subtopicId) {
      const sameSubtopicQuestions = await prisma.question.findMany({
        where: { subtopicId, type },
        select: { id: true, stem: true },
        take: 200,
      });

      const nearMatches = sameSubtopicQuestions
        .map((q) => ({
          id: q.id,
          stem: q.stem,
          similarity: computeSimilarity(stem, q.stem),
        }))
        .filter((m) => m.similarity >= NEAR_DUP_THRESHOLD);

      if (nearMatches.length > 0) {
        return NextResponse.json(
          {
            warning: true,
            message:
              "Near-duplicate questions found. Confirm to proceed.",
            matches: nearMatches.map((m) => ({
              id: m.id,
              stem: m.stem.substring(0, 200),
              similarity: Math.round(m.similarity * 100),
            })),
          },
          { status: 200 }
        );
      }
    }

    const finalStatus =
      qStatus && VALID_STATUSES.includes(qStatus) ? qStatus : "DRAFT";

    const question = await prisma.question.create({
      data: {
        type: type as any,
        difficulty: difficulty as any,
        status: finalStatus as any,
        stem: stem.trim(),
        explanation: explanation || null,
        tags: Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string" && t.trim()) : [],
        contentHash,
        categoryId: categoryId || null,
        subjectId: subjectId || null,
        topicId: topicId || null,
        subtopicId: subtopicId || null,
        options: isMCQ
          ? {
              create: validatedOptions.map((o) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                order: o.order,
              })),
            }
          : undefined,
      },
      include: {
        options: { orderBy: { order: "asc" } },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "QUESTION_CREATE",
      entityType: "Question",
      entityId: question.id,
      after: {
        type,
        difficulty,
        status: finalStatus,
        stem: stem.trim(),
        optionCount: validatedOptions.length,
        tags,
        categoryId,
        subjectId,
        topicId,
        subtopicId,
      },
    });

    return NextResponse.json({ data: question }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Exact duplicate blocked. Modify question/options before saving.",
        },
        { status: 409 }
      );
    }
    console.error("Questions POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
