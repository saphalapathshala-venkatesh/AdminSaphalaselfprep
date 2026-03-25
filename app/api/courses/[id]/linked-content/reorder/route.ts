export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH /api/courses/[id]/linked-content/reorder
// Body: { orderedIds: string[] }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = params.id;
  const body = await req.json();
  const orderedIds: string[] = body.orderedIds ?? [];

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds array is required" }, { status: 400 });
  }

  try {
    await Promise.all(
      orderedIds.map((id, index) =>
        prisma.courseLinkedContent.updateMany({
          where: { id, courseId },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[linked-content reorder] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
