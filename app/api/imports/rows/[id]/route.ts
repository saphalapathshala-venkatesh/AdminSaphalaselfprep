import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  try {
    const existing = await prisma.importRow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Import row not found" }, { status: 404 });
    }

    const body = await req.json();
    const { editedData } = body;

    if (!editedData || typeof editedData !== "object") {
      return NextResponse.json({ error: "editedData is required" }, { status: 400 });
    }

    const updated = await prisma.importRow.update({
      where: { id },
      data: {
        editedData: editedData as any,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "IMPORT_ROW_EDIT",
      entityType: "ImportRow",
      entityId: id,
      before: { rawData: existing.rawData, editedData: existing.editedData },
      after: { editedData },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Import row edit error:", err);
    return NextResponse.json({ error: "Failed to update row" }, { status: 500 });
  }
}
