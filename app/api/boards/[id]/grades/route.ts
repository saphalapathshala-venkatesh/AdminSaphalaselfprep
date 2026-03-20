export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const grades = await prisma.grade.findMany({
      where: { boardId: params.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json({ data: grades });
  } catch (err) {
    console.error("Grades GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const sortOrder = parseInt(body.sortOrder) || 0;

    if (!name) return NextResponse.json({ error: "Grade name is required" }, { status: 400 });

    const board = await prisma.board.findUnique({ where: { id: params.id } });
    if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

    const conflict = await prisma.grade.findUnique({ where: { boardId_name: { boardId: params.id, name } } });
    if (conflict) return NextResponse.json({ error: "A grade with this name already exists in this board" }, { status: 409 });

    const grade = await prisma.grade.create({
      data: { boardId: params.id, name, sortOrder, isActive: true },
    });
    return NextResponse.json({ data: grade }, { status: 201 });
  } catch (err) {
    console.error("Grade POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
