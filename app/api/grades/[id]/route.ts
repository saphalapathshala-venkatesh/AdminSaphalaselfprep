export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = (body.name || "").trim();
    if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder) || 0;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (!data.name && body.name !== undefined) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });

    const existing = await prisma.grade.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Grade not found" }, { status: 404 });

    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.grade.findUnique({
        where: { boardId_name: { boardId: existing.boardId, name: data.name } },
      });
      if (conflict) return NextResponse.json({ error: "A grade with this name already exists in this board" }, { status: 409 });
    }

    const grade = await prisma.grade.update({ where: { id: params.id }, data });
    return NextResponse.json({ data: grade });
  } catch (err) {
    console.error("Grade PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
