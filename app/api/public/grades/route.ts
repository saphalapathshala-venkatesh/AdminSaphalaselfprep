export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("boardId");

  if (!boardId) return NextResponse.json({ data: [] });

  try {
    const grades = await prisma.grade.findMany({
      where: { boardId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, sortOrder: true },
    });
    return NextResponse.json({ data: grades });
  } catch (err) {
    console.error("Public grades GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
