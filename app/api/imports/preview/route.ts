import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateRow, parseDocxText, type RawRow } from "@/lib/importValidator";
import Papa from "papaparse";
import mammoth from "mammoth";

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "docx"].includes(ext)) {
      return NextResponse.json({ error: "Only CSV and DOCX files are supported" }, { status: 400 });
    }

    let rawRows: RawRow[] = [];
    const fileType = ext.toUpperCase();

    if (ext === "csv") {
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().toLowerCase(),
      });
      rawRows = parsed.data as RawRow[];
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      rawRows = parseDocxText(result.value);
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "No rows found in file" }, { status: 400 });
    }

    const validationResults = rawRows.map((r) => validateRow(r));
    const validCount = validationResults.filter((v) => v.isValid).length;
    const invalidCount = validationResults.filter((v) => !v.isValid).length;

    const job = await prisma.importJob.create({
      data: {
        createdById: user.id,
        fileName,
        fileType,
        status: "PREVIEWED",
        totalRows: rawRows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        rows: {
          create: rawRows.map((raw, i) => ({
            rowNumber: i + 1,
            rawData: raw as any,
            isValid: validationResults[i].isValid,
            errorField: validationResults[i].errorField,
            errorMsg: validationResults[i].errorMsg,
          })),
        },
      },
      include: {
        rows: {
          orderBy: { rowNumber: "asc" },
          take: 50,
        },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "IMPORT_PREVIEW",
      entityType: "ImportJob",
      entityId: job.id,
      after: {
        fileName,
        fileType,
        totalRows: rawRows.length,
        validRows: validCount,
        invalidRows: invalidCount,
      },
    });

    return NextResponse.json({
      data: {
        job: {
          id: job.id,
          fileName: job.fileName,
          fileType: job.fileType,
          status: job.status,
          totalRows: job.totalRows,
          validRows: job.validRows,
          invalidRows: job.invalidRows,
          createdAt: job.createdAt,
        },
        rows: job.rows,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("Import preview error:", err);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
