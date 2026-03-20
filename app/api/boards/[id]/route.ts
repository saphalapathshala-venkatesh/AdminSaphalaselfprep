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
    if (body.code !== undefined) data.code = (body.code || "").trim().toUpperCase().replace(/\s+/g, "_");
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (!data.name && body.name !== undefined) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    if (!data.code && body.code !== undefined) return NextResponse.json({ error: "Code cannot be empty" }, { status: 400 });

    if (data.code) {
      const conflict = await prisma.board.findFirst({ where: { code: data.code, NOT: { id: params.id } } });
      if (conflict) return NextResponse.json({ error: "A board with this code already exists" }, { status: 409 });
    }

    const board = await prisma.board.update({ where: { id: params.id }, data });
    return NextResponse.json({ data: board });
  } catch (err) {
    console.error("Board PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
