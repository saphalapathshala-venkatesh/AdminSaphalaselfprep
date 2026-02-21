import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

const VALID_DIFFICULTIES = ["FOUNDATIONAL", "PROFICIENT", "MASTERY"];
const VALID_STATUSES = ["DRAFT", "APPROVED"];

export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { ids, updates } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No question IDs provided" }, { status: 400 });
    }
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const existing = await prisma.question.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        categoryId: true,
        subjectId: true,
        topicId: true,
        subtopicId: true,
        difficulty: true,
        status: true,
        tags: true,
      },
    });

    if (existing.length === 0) {
      return NextResponse.json({ error: "No matching questions found" }, { status: 404 });
    }

    const data: any = {};
    const changedFields: string[] = [];

    if (updates.categoryId !== undefined) {
      data.categoryId = updates.categoryId || null;
      changedFields.push("categoryId");
    }
    if (updates.subjectId !== undefined) {
      data.subjectId = updates.subjectId || null;
      changedFields.push("subjectId");
    }
    if (updates.topicId !== undefined) {
      data.topicId = updates.topicId || null;
      changedFields.push("topicId");
    }
    if (updates.subtopicId !== undefined) {
      data.subtopicId = updates.subtopicId || null;
      changedFields.push("subtopicId");
    }
    if (updates.difficulty && VALID_DIFFICULTIES.includes(updates.difficulty)) {
      data.difficulty = updates.difficulty;
      changedFields.push("difficulty");
    }
    if (updates.status && VALID_STATUSES.includes(updates.status)) {
      data.status = updates.status;
      changedFields.push("status");
    }
    if (updates.tags !== undefined) {
      if (updates.tagsMode === "replace") {
        data.tags = Array.isArray(updates.tags)
          ? updates.tags.filter((t: any) => typeof t === "string" && t.trim())
          : [];
        changedFields.push("tags");
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid update fields provided" }, { status: 400 });
    }

    const result = await prisma.question.updateMany({
      where: { id: { in: ids } },
      data,
    });

    await writeAuditLog({
      actorId: user.id,
      action: "QUESTION_BULK_UPDATE",
      entityType: "Question",
      before: {
        affectedIds: ids,
        count: existing.length,
      },
      after: {
        changedFields,
        updates: data,
        updatedCount: result.count,
      },
    });

    return NextResponse.json({
      ok: true,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("Questions bulk PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
