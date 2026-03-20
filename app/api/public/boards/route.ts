export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    });
    return NextResponse.json({ data: boards });
  } catch (err) {
    console.error("Public boards GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
