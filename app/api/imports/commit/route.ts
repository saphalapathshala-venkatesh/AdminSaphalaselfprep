export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateRow, type RawRow } from "@/lib/importValidator";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

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

    if (job.status === "IMPORTED") {
      return NextResponse.json({ error: "Job already fully imported" }, { status: 400 });
    }

    const rows = await prisma.importRow.findMany({
      where: { importJobId },
      orderBy: { rowNumber: "asc" },
    });

    let importedCount = 0;
    let failedCount = 0;
    const errorRows: { rowNumber: number; errorField: string; errorMsg: string; stem: string }[] = [];

    for (const row of rows) {
      const dataToUse = (row.editedData || row.rawData) as RawRow;
      const result = validateRow(dataToUse);

      if (!result.isValid || !result.normalizedRow) {
        failedCount++;
        await prisma.importRow.update({
          where: { id: row.id },
          data: { isValid: false, errorField: result.errorField, errorMsg: result.errorMsg },
        });
        errorRows.push({
          rowNumber: row.rowNumber,
          errorField: result.errorField || "unknown",
          errorMsg: result.errorMsg || "Validation failed",
          stem: dataToUse.stem || "",
        });
        continue;
      }

      const nr = result.normalizedRow;

      const existingHash = await prisma.question.findUnique({
        where: { contentHash: nr.contentHash },
      });
      if (existingHash) {
        failedCount++;
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            isValid: false,
            errorField: "contentHash",
            errorMsg: "Exact duplicate blocked. A question with identical content already exists.",
          },
        });
        errorRows.push({
          rowNumber: row.rowNumber,
          errorField: "contentHash",
          errorMsg: "Exact duplicate blocked",
          stem: nr.stem,
        });
        continue;
      }

      try {
        let categoryId: string | null = null;
        let subjectId: string | null = null;
        let topicId: string | null = null;
        let subtopicId: string | null = null;

        if (nr.category) {
          const cat = await prisma.category.upsert({
            where: { name: nr.category },
            update: {},
            create: { name: nr.category },
          });
          categoryId = cat.id;

          if (nr.subject) {
            const existingSub = await prisma.subject.findFirst({
              where: { categoryId: cat.id, name: { equals: nr.subject, mode: "insensitive" } },
            });
            if (existingSub) {
              subjectId = existingSub.id;
            } else {
              const newSub = await prisma.subject.create({
                data: { name: nr.subject, categoryId: cat.id },
              });
              subjectId = newSub.id;
            }

            if (nr.topic && subjectId) {
              const existingTop = await prisma.topic.findFirst({
                where: { subjectId, name: { equals: nr.topic, mode: "insensitive" } },
              });
              if (existingTop) {
                topicId = existingTop.id;
              } else {
                const newTop = await prisma.topic.create({
                  data: { name: nr.topic, subjectId },
                });
                topicId = newTop.id;
              }

              if (nr.subtopic && topicId) {
                const existingSt = await prisma.subtopic.findFirst({
                  where: { topicId, name: { equals: nr.subtopic, mode: "insensitive" } },
                });
                if (existingSt) {
                  subtopicId = existingSt.id;
                } else {
                  const newSt = await prisma.subtopic.create({
                    data: { name: nr.subtopic, topicId },
                  });
                  subtopicId = newSt.id;
                }
              }
            }
          }
        }

        const isMCQ = ["MCQ_SINGLE", "MCQ_MULTIPLE"].includes(nr.type);

        await prisma.question.create({
          data: {
            type: nr.type as any,
            difficulty: nr.difficulty as any,
            status: nr.status as any,
            stem: nr.stem,
            explanation: nr.explanation,
            tags: nr.tags,
            contentHash: nr.contentHash,
            categoryId,
            subjectId,
            topicId,
            subtopicId,
            options: isMCQ
              ? {
                  create: nr.options.map((o) => ({
                    text: o.text,
                    isCorrect: o.isCorrect,
                    order: o.order,
                  })),
                }
              : undefined,
          },
        });

        importedCount++;
        await prisma.importRow.update({
          where: { id: row.id },
          data: { isValid: true, errorField: null, errorMsg: null },
        });
      } catch (rowErr: any) {
        failedCount++;
        const msg = rowErr?.code === "P2002"
          ? "Duplicate question content"
          : `Import error: ${rowErr?.message?.substring(0, 200) || "unknown"}`;
        await prisma.importRow.update({
          where: { id: row.id },
          data: { isValid: false, errorField: "import", errorMsg: msg },
        });
        errorRows.push({
          rowNumber: row.rowNumber,
          errorField: "import",
          errorMsg: msg,
          stem: dataToUse.stem || "",
        });
      }
    }

    let reportUrl: string | null = null;
    if (errorRows.length > 0) {
      try {
        const csvHeader = "rowNumber,errorField,errorMsg,stem";
        const csvRows = errorRows.map(
          (r) =>
            `${r.rowNumber},"${r.errorField}","${r.errorMsg.replace(/"/g, '""')}","${r.stem.replace(/"/g, '""').substring(0, 200)}"`
        );
        const csvContent = [csvHeader, ...csvRows].join("\n");
        const reportName = `error-report-${importJobId.substring(0, 8)}-${Date.now()}.csv`;
        const reportsDir = join(process.cwd(), "public", "reports");
        mkdirSync(reportsDir, { recursive: true });
        const reportPath = join(reportsDir, reportName);
        writeFileSync(reportPath, csvContent, "utf-8");
        reportUrl = `/reports/${reportName}`;
      } catch (reportErr) {
        console.error("Failed to write error report:", reportErr);
      }
    }

    const finalStatus = failedCount === 0 ? "IMPORTED" : importedCount > 0 ? "PARTIAL_IMPORTED" : "FAILED";

    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: finalStatus as any,
        validRows: importedCount,
        invalidRows: failedCount,
        reportUrl,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "IMPORT_COMMIT",
      entityType: "ImportJob",
      entityId: importJobId,
      after: {
        importedCount,
        failedCount,
        finalStatus,
        reportUrl,
      },
    });

    return NextResponse.json({
      data: {
        status: finalStatus,
        importedCount,
        failedCount,
        reportUrl,
      },
    });
  } catch (err) {
    console.error("Import commit error:", err);
    return NextResponse.json({ error: "Import commit failed" }, { status: 500 });
  }
}
