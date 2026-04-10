export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUserFromRequest } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { validateRow, parseDocxHtml, normalizeColumnNames, type RawRow } from "@/lib/importValidator";
import { smartParseDocxText } from "@/lib/smartQuestionParser";
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
    let parserWarnings: string[] = [];

    if (ext === "csv") {
      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim().toLowerCase(),
      });
      rawRows = (parsed.data as Record<string, any>[]).map(normalizeColumnNames);

      if (rawRows.length === 0) {
        return NextResponse.json(
          { error: "No rows found in CSV. Ensure the file has a header row and at least one data row." },
          { status: 400 }
        );
      }
    } else {
      // ── DOCX ─────────────────────────────────────────────────────────────
      const buffer = Buffer.from(await file.arrayBuffer());

      // Run both conversions in parallel — HTML for the strict parser,
      // plain text as a fallback source for the smart parser.
      const [htmlResult, textResult] = await Promise.all([
        mammoth.convertToHtml(
          { buffer },
          {
            convertImage: mammoth.images.imgElement((image) =>
              image.read("base64").then((b64) => ({
                src: `data:${image.contentType};base64,${b64}`,
              }))
            ),
          }
        ),
        mammoth.extractRawText({ buffer }),
      ]);

      // ── Attempt 1: strict paragraph-based parser ──────────────────────────
      rawRows = parseDocxHtml(htmlResult.value);

      // ── Attempt 2: smart tolerant parser (auto-fallback) ──────────────────
      if (rawRows.length === 0) {
        const smartResult = smartParseDocxText(textResult.value);

        if (smartResult.rows.length > 0) {
          rawRows = smartResult.rows;
          parserWarnings = [
            `⚠ Smart parser was used because the file's paragraph formatting was imperfect. ` +
            `${smartResult.blocksFound} question block(s) detected, ` +
            `${smartResult.blocksParsed} parsed successfully` +
            (smartResult.blocksFailed > 0
              ? `, ${smartResult.blocksFailed} skipped due to missing fields.`
              : "."),
            ...smartResult.diagnostics,
          ];
        } else {
          // Both parsers found nothing — return the smart parser's diagnostics
          const detail = smartResult.diagnostics.length > 0
            ? smartResult.diagnostics.join(" | ")
            : "The file appears to be empty or contains no recognisable question blocks.";
          return NextResponse.json(
            { error: `No questions found in file. ${detail}` },
            { status: 400 }
          );
        }
      }
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

    // ── Resolve taxonomy text → DB IDs for each valid row ────────────────────
    // Uses find-or-create at every level so that taxonomy declared in the DOCX
    // is always resolvable to real IDs — even when the Subject/Topic/Subtopic
    // records do not yet exist in the database.  This mirrors what the commit
    // route does and ensures the test-builder review form can pre-populate the
    // Subject/Topic/Subtopic dropdowns correctly.
    const taxoResolved: Record<number, {
      categoryId: string | null;
      subjectId: string | null;
      topicId: string | null;
      subtopicId: string | null;
    }> = {};

    const rowsWithTaxo = validationResults
      .map((vr, i) => ({ rowNumber: i + 1, nr: vr.normalizedRow }))
      .filter(r => r.nr?.category);

    for (const { rowNumber, nr } of rowsWithTaxo) {
      if (!nr) continue;
      let categoryId: string | null = null;
      let subjectId: string | null = null;
      let topicId: string | null = null;
      let subtopicId: string | null = null;

      try {
        // ── Category: find only (categories are master data, never auto-created here)
        const cat = await prisma.category.findFirst({
          where: { name: { equals: nr.category!, mode: "insensitive" } },
        });

        if (cat) {
          categoryId = cat.id;

          // ── Subject: find or create under this category
          if (nr.subject) {
            const existingSub = await prisma.subject.findFirst({
              where: { categoryId: cat.id, name: { equals: nr.subject, mode: "insensitive" } },
            });
            const sub = existingSub ?? await prisma.subject.create({
              data: { name: nr.subject, categoryId: cat.id },
            });
            subjectId = sub.id;

            // ── Topic: find or create under this subject
            if (nr.topic) {
              const existingTop = await prisma.topic.findFirst({
                where: { subjectId: sub.id, name: { equals: nr.topic, mode: "insensitive" } },
              });
              const top = existingTop ?? await prisma.topic.create({
                data: { name: nr.topic, subjectId: sub.id },
              });
              topicId = top.id;

              // ── Subtopic: find or create under this topic
              if (nr.subtopic) {
                const existingSt = await prisma.subtopic.findFirst({
                  where: { topicId: top.id, name: { equals: nr.subtopic, mode: "insensitive" } },
                });
                const st = existingSt ?? await prisma.subtopic.create({
                  data: { name: nr.subtopic, topicId: top.id },
                });
                subtopicId = st.id;
              }
            }
          }
        }
      } catch (taxoErr) {
        console.warn("[preview] Taxonomy resolve/create failed for row", rowNumber, taxoErr);
      }

      taxoResolved[rowNumber] = { categoryId, subjectId, topicId, subtopicId };
    }

    const enrichedRows = job.rows.map(row => ({
      ...row,
      resolvedTaxonomy: taxoResolved[row.rowNumber] ?? null,
    }));

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
        rows: enrichedRows,
        parserWarnings: parserWarnings.length > 0 ? parserWarnings : undefined,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("Import preview error:", err);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
