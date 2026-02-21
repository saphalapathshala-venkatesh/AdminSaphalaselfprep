import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateRow, type RawRow } from "@/lib/importValidator";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { importJobId } = body;

    if (!importJobId) {
      return NextResponse.json({ error: "importJobId is required" }, { status: 400 });
    }

    const job = await prisma.importJob.findUnique({ where: { id: importJobId } });
    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    const rows = await prisma.importRow.findMany({
      where: { importJobId },
      orderBy: { rowNumber: "asc" },
    });

    let validCount = 0;
    let invalidCount = 0;

    for (const row of rows) {
      const dataToValidate = (row.editedData || row.rawData) as RawRow;
      const result = validateRow(dataToValidate);

      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          isValid: result.isValid,
          errorField: result.errorField,
          errorMsg: result.errorMsg,
        },
      });

      if (result.isValid) validCount++;
      else invalidCount++;
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: "VALIDATED",
        validRows: validCount,
        invalidRows: invalidCount,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "IMPORT_VALIDATE",
      entityType: "ImportJob",
      entityId: importJobId,
      after: { validRows: validCount, invalidRows: invalidCount, revalidate: true },
    });

    return NextResponse.json({
      data: {
        status: "VALIDATED",
        totalRows: rows.length,
        validRows: validCount,
        invalidRows: invalidCount,
      },
    });
  } catch (err) {
    console.error("Import revalidate error:", err);
    return NextResponse.json({ error: "Re-validation failed" }, { status: 500 });
  }
}
