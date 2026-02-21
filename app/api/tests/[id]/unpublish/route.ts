import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const test = await prisma.test.findUnique({ where: { id: params.id } });
    if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!test.isPublished) {
      return NextResponse.json({ error: "Test is not published" }, { status: 400 });
    }

    const updated = await prisma.test.update({
      where: { id: params.id },
      data: { isPublished: false },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "TEST_UNPUBLISH",
      entityType: "Test",
      entityId: params.id,
      before: { isPublished: true },
      after: { isPublished: false },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Test unpublish error:", err);
    return NextResponse.json({ error: "Unpublish failed" }, { status: 500 });
  }
}
