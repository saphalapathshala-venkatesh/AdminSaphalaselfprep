export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Returns active Category records (used as "Grade" in UI) filtered by boardId.
// Used by the public registration form — no auth required.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const boardId = searchParams.get("boardId");

  if (!boardId) return NextResponse.json({ data: [] });

  try {
    const grades = await prisma.category.findMany({
      where: { boardId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return NextResponse.json({ data: grades });
  } catch (err) {
    console.error("Public grades GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
