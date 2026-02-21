import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        series: { select: { id: true, title: true } },
        sections: { orderBy: { order: "asc" } },
        questions: {
          orderBy: { order: "asc" },
          include: {
            question: {
              select: {
                id: true, type: true, stem: true, difficulty: true, status: true,
                categoryId: true, subjectId: true, topicId: true, subtopicId: true,
              },
            },
          },
        },
      },
    });

    if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data: test });
  } catch (err) {
    console.error("Test GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
