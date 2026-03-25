export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

// DELETE /api/courses/[id]/linked-content/[linkedItemId]
export async function DELETE(req: NextRequest, { params }: { params: { id: string; linkedItemId: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: courseId, linkedItemId } = params;

  try {
    const row = await prisma.courseLinkedContent.findUnique({ where: { id: linkedItemId } });
    if (!row || row.courseId !== courseId) {
      return NextResponse.json({ error: "Linked content item not found" }, { status: 404 });
    }

    await prisma.courseLinkedContent.delete({ where: { id: linkedItemId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[linked-content DELETE] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
