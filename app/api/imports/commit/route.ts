export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateRow, type RawRow } from "@/lib/importValidator";
import { resolveOrCreateSubject } from "@/lib/taxonomy";
import { uploadBase64ImageToStorage } from "@/lib/objectStorage";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Replace every base64-embedded image in an HTML string with a CDN URL.
 * Images are uploaded to object storage directly from the server (server-side PUT).
 * Falls back to keeping the base64 intact if the upload fails (non-fatal).
 */
async function replaceBase64Images(html: string): Promise<string> {
  if (!html || !html.includes("data:image")) return html;

  const pattern = /src="data:image\/([^;]+);base64,([^"]+)"/g;
  let result = html;
  let offset = 0;

  for (const m of Array.from(html.matchAll(new RegExp(pattern.source, "g")))) {
    const [fullMatch, mimeSubtype, base64Data] = m;
    const contentType = `image/${mimeSubtype}`;
    try {
      const cdnUrl = await uploadBase64ImageToStorage(base64Data, contentType);
      result = result.slice(0, (m.index ?? 0) + offset) +
               `src="${cdnUrl}"` +
               result.slice((m.index ?? 0) + offset + fullMatch.length);
      offset += `src="${cdnUrl}"`.length - fullMatch.length;
    } catch (err) {
      console.warn("[commit] base64 image upload failed, keeping inline:", err);
    }
  }
  return result;
}

/** Apply base64→CDN replacement to stem, explanation, and option texts in a normalised row. */
async function hoistImages(nr: ReturnType<typeof validateRow>["normalizedRow"] & {}): Promise<void> {
  if (!nr) return;
  nr.stem = await replaceBase64Images(nr.stem);
  if (nr.explanation) nr.explanation = await replaceBase64Images(nr.explanation);
  for (const opt of nr.options ?? []) {
    opt.text = await replaceBase64Images(opt.text);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { importJobId, overrideStatus } = body;

    if (!importJobId) {
      return NextResponse.json({ error: "importJobId is required" }, { status: 400 });
    }

    // Validate overrideStatus if provided
    const statusOverride: "DRAFT" | "APPROVED" | null =
      overrideStatus === "APPROVED" ? "APPROVED" : overrideStatus === "DRAFT" ? "DRAFT" : null;

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

    // ── Pre-pass: create QuestionGroup records for DOCX paragraph blocks ─────
    // Rows produced by parseDocxHtml carry _groupKey and _paragraphHtml in rawData.
    // We create one QuestionGroup per unique key and store the ID in a map for
    // the main loop to link child questions.
    const groupIdByKey = new Map<string, string>();

    for (const row of rows) {
      const data = (row.editedData || row.rawData) as Record<string, unknown>;
      const key = data._groupKey as string | undefined;
      if (!key || groupIdByKey.has(key)) continue;

      const paragraphHtml = (data._paragraphHtml as string | undefined) ?? "";
      try {
        const hoistedParagraph = await replaceBase64Images(paragraphHtml);
        const group = await prisma.questionGroup.create({
          data: { paragraph: hoistedParagraph },
        });
        groupIdByKey.set(key, group.id);
      } catch (err) {
        console.warn("[commit] Failed to create QuestionGroup for key", key, err);
      }
    }

    // ── Main import loop ───────────────────────────────────────────────────────
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
        // If the existing question has no taxonomy but the import supplies it,
        // patch the taxonomy instead of blocking — lets users re-upload with
        // Category/Subject/Topic/Subtopic to enrich previously bare questions.
        const hasTaxInImport = !!(nr.category);
        const hasTaxInDb = !!(existingHash.categoryId);

        if (hasTaxInImport && !hasTaxInDb) {
          try {
            // Resolve taxonomy the same way as new imports
            let patchCategoryId: string | null = null;
            let patchSubjectId: string | null = null;
            let patchTopicId: string | null = null;
            let patchSubtopicId: string | null = null;

            let cat = await prisma.category.findFirst({ where: { name: nr.category! } });
            if (!cat) cat = await prisma.category.create({ data: { name: nr.category! } });
            patchCategoryId = cat.id;

            if (nr.subject) {
              patchSubjectId = await resolveOrCreateSubject(cat.id, nr.subject);

              if (nr.topic && patchSubjectId) {
                const existingTop = await prisma.topic.findFirst({
                  where: { subjectId: patchSubjectId, name: { equals: nr.topic, mode: "insensitive" } },
                });
                patchTopicId = existingTop
                  ? existingTop.id
                  : (await prisma.topic.create({ data: { name: nr.topic, subjectId: patchSubjectId } })).id;

                if (nr.subtopic && patchTopicId) {
                  const existingSt = await prisma.subtopic.findFirst({
                    where: { topicId: patchTopicId, name: { equals: nr.subtopic, mode: "insensitive" } },
                  });
                  patchSubtopicId = existingSt
                    ? existingSt.id
                    : (await prisma.subtopic.create({ data: { name: nr.subtopic, topicId: patchTopicId } })).id;
                }
              }
            }

            await prisma.question.update({
              where: { id: existingHash.id },
              data: {
                categoryId: patchCategoryId,
                subjectId: patchSubjectId,
                topicId: patchTopicId,
                subtopicId: patchSubtopicId,
              },
            });

            importedCount++;
            await prisma.importRow.update({
              where: { id: row.id },
              data: { isValid: true, errorField: null, errorMsg: null },
            });
            console.log(`[commit] Patched taxonomy on existing question ${existingHash.id}`);
          } catch (patchErr: any) {
            console.warn("[commit] Taxonomy patch failed:", patchErr?.message);
            failedCount++;
            await prisma.importRow.update({
              where: { id: row.id },
              data: {
                isValid: false,
                errorField: "contentHash",
                errorMsg: "Duplicate question — taxonomy patch failed.",
              },
            });
            errorRows.push({ rowNumber: row.rowNumber, errorField: "contentHash", errorMsg: "Taxonomy patch failed", stem: nr.stem });
          }
        } else {
          failedCount++;
          await prisma.importRow.update({
            where: { id: row.id },
            data: {
              isValid: false,
              errorField: "contentHash",
              errorMsg: hasTaxInDb
                ? "Exact duplicate blocked. Question already exists with taxonomy."
                : "Exact duplicate blocked. A question with identical content already exists.",
            },
          });
          errorRows.push({
            rowNumber: row.rowNumber,
            errorField: "contentHash",
            errorMsg: "Exact duplicate blocked",
            stem: nr.stem,
          });
        }
        continue;
      }

      try {
        // ── Hoist base64 images to CDN before saving ────────────────────────
        await hoistImages(nr);

        // ── Taxonomy resolution ─────────────────────────────────────────────
        let categoryId: string | null = null;
        let subjectId: string | null = null;
        let topicId: string | null = null;
        let subtopicId: string | null = null;

        if (nr.category) {
          let cat = await prisma.category.findFirst({ where: { name: nr.category } });
          if (!cat) cat = await prisma.category.create({ data: { name: nr.category } });
          categoryId = cat.id;

          if (nr.subject) {
            subjectId = await resolveOrCreateSubject(cat.id, nr.subject);

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

        // ── Group linkage ───────────────────────────────────────────────────
        const rawData = (row.editedData || row.rawData) as Record<string, unknown>;
        const groupKey = rawData._groupKey as string | undefined;
        const groupId = groupKey ? (groupIdByKey.get(groupKey) ?? null) : null;

        // ── Create question ─────────────────────────────────────────────────
        const isMCQ = ["MCQ_SINGLE", "MCQ_MULTIPLE"].includes(nr.type);

        await prisma.question.create({
          data: {
            type: nr.type as any,
            difficulty: nr.difficulty as any,
            status: (statusOverride ?? nr.status) as any,
            stem: nr.stem,
            stemSecondary: nr.stemSecondary ?? null,
            explanation: nr.explanation,
            explanationSecondary: nr.explanationSecondary ?? null,
            tags: nr.tags,
            contentHash: nr.contentHash,
            categoryId,
            subjectId,
            topicId,
            subtopicId,
            groupId,
            options: isMCQ
              ? {
                  create: nr.options.map((o) => ({
                    text: o.text,
                    textSecondary: o.textSecondary ?? null,
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

    // ── Error report CSV ───────────────────────────────────────────────────────
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
        groupsCreated: groupIdByKey.size,
      },
    });

    return NextResponse.json({
      data: {
        status: finalStatus,
        importedCount,
        failedCount,
        reportUrl,
        groupsCreated: groupIdByKey.size,
      },
    });
  } catch (err) {
    console.error("Import commit error:", err);
    return NextResponse.json({ error: "Import commit failed" }, { status: 500 });
  }
}
