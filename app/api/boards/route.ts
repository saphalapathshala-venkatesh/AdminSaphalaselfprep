export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const boards = await prisma.board.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { grades: true, users: true } } },
    });
    return NextResponse.json({ data: boards });
  } catch (err) {
    console.error("Boards GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getSessionUserFromRequest(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    const code = (body.code || "").trim().toUpperCase().replace(/\s+/g, "_");

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const conflict = await prisma.board.findUnique({ where: { code } });
    if (conflict) return NextResponse.json({ error: "A board with this code already exists" }, { status: 409 });

    const board = await prisma.board.create({
      data: { name, code, isActive: true },
    });
    return NextResponse.json({ data: board }, { status: 201 });
  } catch (err) {
    console.error("Boards POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
