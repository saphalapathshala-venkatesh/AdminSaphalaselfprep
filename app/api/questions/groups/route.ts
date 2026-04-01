export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { computeContentHash } from "@/lib/questionHash";

interface ChildInput {
  type: string;
  stem: string;
  stemSecondary?: string;
  difficulty?: string;
  status?: string;
  explanation?: string;
  explanationSecondary?: string;
  options?: Array<{ text: string; textSecondary?: string; isCorrect: boolean }>;
}

/**
 * POST /api/questions/groups
 *
 * Create a QuestionGroup (paragraph + child questions) in one transaction.
 *
 * Body:
 * {
 *   paragraph: string,         // HTML passage shown above child questions
 *   categoryId?: string,
 *   subjectId?: string,
 *   topicId?: string,
 *   subtopicId?: string,
 *   children: ChildInput[]     // 2–20 child questions
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { paragraph, paragraphSecondary, categoryId, subjectId, topicId, subtopicId, children } = body as {
    paragraph?: string;
    paragraphSecondary?: string;
    categoryId?: string;
    subjectId?: string;
    topicId?: string;
    subtopicId?: string;
    children?: ChildInput[];
  };

  if (!paragraph || typeof paragraph !== "string" || !paragraph.trim()) {
    return NextResponse.json({ error: "paragraph (passage HTML) is required" }, { status: 400 });
  }

  if (!Array.isArray(children) || children.length < 1) {
    return NextResponse.json({ error: "At least 1 child question is required" }, { status: 400 });
  }

  if (children.length > 20) {
    return NextResponse.json({ error: "Maximum 20 child questions per group" }, { status: 400 });
  }

  const VALID_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE", "TRUE_FALSE", "SHORT_ANSWER", "FILL_BLANK", "MATCH", "ASSERTION_REASON", "CASE_STUDY"];
  const VALID_DIFF = ["FOUNDATIONAL", "EASY", "MODERATE", "HARD", "ADVANCED"];
  const VALID_STATUS = ["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"];
  const MCQ_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE"];

  // Validate each child
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (!c.stem || !c.stem.trim()) {
      return NextResponse.json({ error: `Child ${i + 1}: stem is required` }, { status: 400 });
    }
    if (!VALID_TYPES.includes(c.type)) {
      return NextResponse.json({ error: `Child ${i + 1}: invalid type "${c.type}"` }, { status: 400 });
    }
    if (MCQ_TYPES.includes(c.type)) {
      if (!Array.isArray(c.options) || c.options.length < 2) {
        return NextResponse.json({ error: `Child ${i + 1}: MCQ questions require at least 2 options` }, { status: 400 });
      }
      if (!c.options.some((o) => o.isCorrect)) {
        return NextResponse.json({ error: `Child ${i + 1}: at least one option must be marked correct` }, { status: 400 });
      }
      if (c.type === "MCQ_SINGLE" && c.options.filter((o) => o.isCorrect).length > 1) {
        return NextResponse.json({ error: `Child ${i + 1}: MCQ_SINGLE can only have one correct option` }, { status: 400 });
      }
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.questionGroup.create({
        data: {
          paragraph,
          paragraphSecondary: paragraphSecondary?.trim() || null,
          categoryId: categoryId || null,
          subjectId: subjectId || null,
          topicId: topicId || null,
          subtopicId: subtopicId || null,
        },
      });

      const createdQuestions = [];
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        const difficulty = VALID_DIFF.includes(c.difficulty ?? "") ? c.difficulty! : "FOUNDATIONAL";
        const status = VALID_STATUS.includes(c.status ?? "") ? c.status! : "DRAFT";
        const isMCQ = MCQ_TYPES.includes(c.type);
        const optionObjects = isMCQ ? (c.options ?? []) : [];
        const contentHash = computeContentHash(c.stem, optionObjects, c.type);

        const q = await tx.question.create({
          data: {
            type: c.type as any,
            difficulty: difficulty as any,
            status: status as any,
            stem: c.stem,
            stemSecondary: c.stemSecondary ?? null,
            explanation: c.explanation ?? null,
            explanationSecondary: c.explanationSecondary ?? null,
            contentHash,
            categoryId: categoryId ?? null,
            subjectId: subjectId ?? null,
            topicId: topicId ?? null,
            subtopicId: subtopicId ?? null,
            groupId: group.id,
            options: isMCQ
              ? {
                  create: (c.options ?? []).map((o, idx) => ({
                    text: o.text,
                    textSecondary: o.textSecondary ?? null,
                    isCorrect: o.isCorrect,
                    order: idx,
                  })),
                }
              : undefined,
          },
          include: { options: { orderBy: { order: "asc" } } },
        });
        createdQuestions.push(q);
      }

      return { group, questions: createdQuestions };
    });

    await writeAuditLog({
      actorId: user.id,
      action: "CREATE",
      entityType: "QuestionGroup",
      entityId: result.group.id,
      after: { childCount: children.length, categoryId, subjectId, topicId, subtopicId },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "One or more child questions have identical content to existing questions (duplicate blocked)" },
        { status: 409 }
      );
    }
    console.error("[POST /api/questions/groups]", err);
    return NextResponse.json({ error: "Failed to create question group" }, { status: 500 });
  }
}

/**
 * GET /api/questions/groups
 * List all question groups (paginated).
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  const [groups, total] = await Promise.all([
    prisma.questionGroup.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true } },
      },
    }),
    prisma.questionGroup.count(),
  ]);

  return NextResponse.json({ data: groups, total, page, limit });
}
