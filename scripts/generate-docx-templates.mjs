/**
 * Generates updated DOCX bulk-upload templates (v2) where images are
 * referenced as URL tokens instead of being embedded in the file.
 *
 * Run: node scripts/generate-docx-templates.mjs
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType, TableCell, TableRow, Table,
  WidthType, convertInchesToTwip,
} from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "downloads");

// ── Helpers ──────────────────────────────────────────────────────────────────

const PURPLE = "7C3AED";
const BLUE   = "1D4ED8";
const GREEN  = "065F46";
const GRAY   = "6B7280";
const LIGHT  = "F3F4F6";

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    run: { color: PURPLE, bold: true },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    run: { color: BLUE },
  });
}

function heading3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: BLUE, size: 22 })],
    spacing: { before: 200, after: 60 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, ...opts })],
    spacing: { before: 60, after: 60 },
  });
}

function code(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Courier New", size: 19, color: "1e293b" })],
    spacing: { before: 40, after: 40 },
    shading: { type: ShadingType.CLEAR, fill: "F8F4FF" },
    indent: { left: convertInchesToTwip(0.3) },
  });
}

function label(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: PURPLE, size: 19, font: "Courier New" })],
    spacing: { before: 40, after: 20 },
    indent: { left: convertInchesToTwip(0.3) },
  });
}

function field(labelText, valueText, valueColor) {
  return new Paragraph({
    children: [
      new TextRun({ text: labelText, bold: true, color: PURPLE, size: 19, font: "Courier New" }),
      new TextRun({ text: " " + valueText, size: 19, font: "Courier New", color: valueColor || "1e293b" }),
    ],
    spacing: { before: 30, after: 30 },
    indent: { left: convertInchesToTwip(0.3) },
    shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
  });
}

function divider() {
  return new Paragraph({
    text: "",
    border: { bottom: { color: "E2E8F0", style: BorderStyle.SINGLE, size: 1 } },
    spacing: { before: 120, after: 120 },
  });
}

function note(text) {
  return new Paragraph({
    children: [new TextRun({ text: "ℹ️  " + text, size: 18, color: BLUE, italics: true })],
    spacing: { before: 60, after: 60 },
    indent: { left: convertInchesToTwip(0.2) },
  });
}

function warn(text) {
  return new Paragraph({
    children: [new TextRun({ text: "⚠️  " + text, size: 18, color: "92400E" })],
    spacing: { before: 60, after: 60 },
    indent: { left: convertInchesToTwip(0.2) },
  });
}

function bullet(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 19, ...opts })],
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
  });
}

function sectionBox(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: "F8F4FF" },
            borders: {
              top: { style: BorderStyle.SINGLE, color: PURPLE, size: 2 },
              bottom: { style: BorderStyle.SINGLE, color: PURPLE, size: 2 },
              left: { style: BorderStyle.SINGLE, color: PURPLE, size: 2 },
              right: { style: BorderStyle.SINGLE, color: PURPLE, size: 2 },
            },
            children: rows,
          }),
        ],
      }),
    ],
  });
}

function blank() {
  return new Paragraph({ text: "", spacing: { before: 60, after: 60 } });
}

// ── IMAGE GUIDE SECTION ──────────────────────────────────────────────────────

function imageGuideSection() {
  return [
    heading2("How to Include Images"),
    warn("Do NOT embed images directly into this Word document."),
    body("Instead, upload your image to any publicly accessible URL (CDN, Google Drive public link, Imgur, S3, etc.) and reference it using the token format below:"),
    blank(),
    code("[IMAGE: https://your-cdn.com/path/to/image.jpg]"),
    blank(),
    body("You can place this token anywhere inside a Question, Option, or Explanation field — the importer will convert it to a rendered image automatically."),
    blank(),
    body("Supported image formats:", { bold: true }),
    bullet("PNG  (.png)"),
    bullet("JPEG (.jpg / .jpeg)"),
    bullet("WebP (.webp)"),
    bullet("GIF  (.gif)"),
    blank(),
    body("Examples:", { bold: true }),
    code("[IMAGE: https://cdn.saphala.in/questions/bar-chart-2023.png]"),
    code("[IMAGE: https://storage.googleapis.com/bucket/diagram.jpg]"),
    code("[IMAGE: https://i.imgur.com/abc123.webp]"),
    blank(),
    note("The short form [IMG: URL] is also accepted and works identically."),
    divider(),
  ];
}

// ── FIELD REFERENCE TABLE ────────────────────────────────────────────────────

function fieldReferenceSection(includePassage) {
  const rows = [
    ["QUESTION",          "Required",  "Marks the start of a question block"],
    ["Question:",         "Required",  "The question stem (rich text + [IMAGE: URL] supported)"],
    ["Option A:",         "Required*", "Option text (* required for MCQ types)"],
    ["Option B:",         "Required*", "Option text"],
    ["Option C:",         "Optional",  "Option text"],
    ["Option D:",         "Optional",  "Option text"],
    ["Correct Answer:",   "Required",  "Letter(s): A, B, C or D. Multiple: A,C"],
    ["Type:",             "Optional",  "MCQ_SINGLE (default) | MCQ_MULTIPLE | TRUE_FALSE | INTEGER | DESCRIPTIVE"],
    ["Difficulty:",       "Required",  "EASY | MEDIUM | HARD | FOUNDATIONAL | PROFICIENT | MASTERY"],
    ["Category:",         "Optional",  "Exam category name (e.g. Banking, UPSC)"],
    ["Subject:",          "Optional",  "Subject name"],
    ["Topic:",            "Optional",  "Topic name"],
    ["Subtopic:",         "Optional",  "Subtopic name"],
    ["Explanation:",      "Optional",  "Solution / explanation (rich text + [IMAGE: URL] supported)"],
    ["Tags:",             "Optional",  "Comma-separated tags (e.g. source:SBI_PO_2024)"],
    ["Marks:",            "Optional",  "Marks awarded (default: 1)"],
    ["Negative Marks:",   "Optional",  "Marks deducted for wrong answer (default: 0)"],
    ["Status:",           "Optional",  "DRAFT (default) | APPROVED"],
    ["END_QUESTION",      "Optional",  "Marks end of block (auto-detected if omitted)"],
  ];

  if (includePassage) {
    rows.splice(2, 0,
      ["GROUP_START",   "Required",  "Opens a paragraph/comprehension group"],
      ["Passage:",      "Required",  "Shared passage HTML ([IMAGE: URL] supported)"],
      ["GROUP_END",     "Required",  "Closes the group — all questions between share the passage"],
    );
  }

  return [
    heading2("Field Reference"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Field", bold: true, size: 18 })] })], shading: { type: ShadingType.CLEAR, fill: "EDE9FE" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Required?", bold: true, size: 18 })] })], shading: { type: ShadingType.CLEAR, fill: "EDE9FE" } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true, size: 18 })] })], shading: { type: ShadingType.CLEAR, fill: "EDE9FE" } }),
          ],
        }),
        ...rows.map(([f, r, d]) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: f, font: "Courier New", size: 17, color: PURPLE })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r, size: 17, color: r === "Required" ? "065F46" : "6B7280" })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d, size: 17 })] })] }),
            ],
          })
        ),
      ],
    }),
    blank(),
    divider(),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 1 — SINGLE QUESTION TEMPLATE
// ══════════════════════════════════════════════════════════════════════════════

async function buildSingleTemplate() {
  const doc = new Document({
    creator: "Saphala Self Prep",
    title: "Single Question Bulk Import Template v2",
    description: "Template for importing standalone questions into the Question Bank",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [

        // ── Cover ──────────────────────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: "Saphala Self Prep", bold: true, size: 28, color: PURPLE })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Bulk Question Import Template", bold: true, size: 36, color: "1e293b" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Single / Standalone Questions  •  v2  (Image URL Edition)", size: 22, color: GRAY })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Upload this file at: Admin → Imports → Choose File", size: 19, color: BLUE, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 360 },
        }),

        divider(),

        // ── Image guide ───────────────────────────────────────────────────────
        ...imageGuideSection(),

        // ── Field reference ───────────────────────────────────────────────────
        ...fieldReferenceSection(false),

        // ── Example 1: text-only ───────────────────────────────────────────────
        heading2("Example 1 — Text-only MCQ"),
        sectionBox([
          field("QUESTION", "", GRAY),
          field("Question:", " What is 15% of 200?", "1e293b"),
          field("Option A:", " 25", "1e293b"),
          field("Option B:", " 30", "1e293b"),
          field("Option C:", " 35", "1e293b"),
          field("Option D:", " 40", "1e293b"),
          field("Correct Answer:", " B", GREEN),
          field("Type:", " MCQ_SINGLE", GRAY),
          field("Difficulty:", " EASY", GRAY),
          field("Category:", " Banking", GRAY),
          field("Subject:", " Quantitative Aptitude", GRAY),
          field("Topic:", " Percentage", GRAY),
          field("Subtopic:", " Basic Percentage", GRAY),
          field("Explanation:", " 15% of 200 = (15/100) × 200 = 30.", GRAY),
          field("END_QUESTION", "", GRAY),
        ]),
        blank(),

        // ── Example 2: image in stem ───────────────────────────────────────────
        heading2("Example 2 — Question with Image URL"),
        note("Use [IMAGE: URL] anywhere in the Question or Explanation field."),
        blank(),
        sectionBox([
          field("QUESTION", "", GRAY),
          field("Question:", " Study the bar chart and answer the question.", "1e293b"),
          new Paragraph({
            children: [
              new TextRun({ text: "            ", size: 19 }),
              new TextRun({ text: "[IMAGE: https://cdn.saphala.in/questions/bar-chart-exports.png]", font: "Courier New", size: 18, color: "7c3aed" }),
            ],
            spacing: { before: 30, after: 30 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "            ", size: 19 }),
              new TextRun({ text: "Which year had the highest export revenue?", size: 19, font: "Courier New", color: "1e293b" }),
            ],
            spacing: { before: 30, after: 30 },
          }),
          field("Option A:", " 2019", "1e293b"),
          field("Option B:", " 2020", "1e293b"),
          field("Option C:", " 2021", "1e293b"),
          field("Option D:", " 2022", "1e293b"),
          field("Correct Answer:", " C", GREEN),
          field("Type:", " MCQ_SINGLE", GRAY),
          field("Difficulty:", " MEDIUM", GRAY),
          field("Category:", " Banking", GRAY),
          field("Subject:", " Data Interpretation", GRAY),
          field("Topic:", " Bar Charts", GRAY),
          field("Subtopic:", " Export Revenue", GRAY),
          new Paragraph({
            children: [
              new TextRun({ text: "Explanation: ", bold: true, color: PURPLE, size: 19, font: "Courier New" }),
              new TextRun({ text: " As shown in the chart ", size: 19, font: "Courier New", color: GRAY }),
              new TextRun({ text: "[IMAGE: https://cdn.saphala.in/questions/bar-chart-annotated.png]", font: "Courier New", size: 18, color: "7c3aed" }),
              new TextRun({ text: ", 2021 had the tallest bar.", size: 19, font: "Courier New", color: GRAY }),
            ],
            spacing: { before: 30, after: 30 },
            indent: { left: convertInchesToTwip(0.3) },
          }),
          field("END_QUESTION", "", GRAY),
        ]),
        blank(),

        // ── Example 3: equation ───────────────────────────────────────────────
        heading2("Example 3 — Question with LaTeX Equation"),
        note("Wrap LaTeX expressions in $$ ... $$ — they render as KaTeX on the student side."),
        blank(),
        sectionBox([
          field("QUESTION", "", GRAY),
          field("Question:", " Solve: $$x^2 - 5x + 6 = 0$$. What are the roots?", "1e293b"),
          field("Option A:", " $$x = 1$$ and $$x = 6$$", "1e293b"),
          field("Option B:", " $$x = 2$$ and $$x = 3$$", "1e293b"),
          field("Option C:", " $$x = -2$$ and $$x = -3$$", "1e293b"),
          field("Option D:", " $$x = 3$$ and $$x = 4$$", "1e293b"),
          field("Correct Answer:", " B", GREEN),
          field("Type:", " MCQ_SINGLE", GRAY),
          field("Difficulty:", " HARD", GRAY),
          field("Category:", " Banking", GRAY),
          field("Subject:", " Quantitative Aptitude", GRAY),
          field("Topic:", " Algebra", GRAY),
          field("Subtopic:", " Quadratic Equations", GRAY),
          field("Tags:", " source:SBI_PO_2024", GRAY),
          field("Marks:", " 2", GRAY),
          field("Negative Marks:", " 0.66", GRAY),
          field("Explanation:", " Factorising: $$(x-2)(x-3) = 0$$, so $$x = 2$$ or $$x = 3$$.", GRAY),
          field("END_QUESTION", "", GRAY),
        ]),
        blank(),

        // ── Multiple correct ───────────────────────────────────────────────────
        heading2("Example 4 — Multiple-Correct MCQ"),
        sectionBox([
          field("QUESTION", "", GRAY),
          field("Question:", " Which of the following are prime numbers?", "1e293b"),
          field("Option A:", " 2", "1e293b"),
          field("Option B:", " 4", "1e293b"),
          field("Option C:", " 7", "1e293b"),
          field("Option D:", " 9", "1e293b"),
          field("Correct Answer:", " A,C", GREEN),
          field("Type:", " MCQ_MULTIPLE", GRAY),
          field("Difficulty:", " EASY", GRAY),
          field("Category:", " Banking", GRAY),
          field("Subject:", " Quantitative Aptitude", GRAY),
          field("Topic:", " Number Theory", GRAY),
          field("Explanation:", " 2 and 7 are prime numbers. 4 = 2×2, 9 = 3×3.", GRAY),
          field("END_QUESTION", "", GRAY),
        ]),
        blank(),

        divider(),
        body("For group/paragraph questions, use the Group Question Template.", { color: GRAY, italics: true }),
        body("For help, contact the admin team.", { color: GRAY, italics: true }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT 2 — GROUP / PARAGRAPH QUESTION TEMPLATE
// ══════════════════════════════════════════════════════════════════════════════

async function buildGroupTemplate() {
  const doc = new Document({
    creator: "Saphala Self Prep",
    title: "Group / Paragraph Question Bulk Import Template v2",
    description: "Template for importing comprehension/paragraph-based questions",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 20 } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [

        new Paragraph({
          children: [new TextRun({ text: "Saphala Self Prep", bold: true, size: 28, color: PURPLE })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Bulk Question Import Template", bold: true, size: 36, color: "1e293b" })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Group / Paragraph / Comprehension Questions  •  v2  (Image URL Edition)", size: 22, color: GRAY })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Upload this file at: Admin → Imports → Choose File", size: 19, color: BLUE, italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 360 },
        }),

        divider(),

        // ── Image guide ───────────────────────────────────────────────────────
        ...imageGuideSection(),

        // ── How groups work ───────────────────────────────────────────────────
        heading2("How Group / Paragraph Questions Work"),
        bullet("Wrap related questions in GROUP_START … GROUP_END"),
        bullet("Put the shared passage immediately after GROUP_START using the Passage: label"),
        bullet("All QUESTION blocks inside the group automatically inherit the shared passage"),
        bullet("Taxonomy (Category, Subject, Topic, Subtopic) set inside GROUP_START is inherited by all child questions"),
        bullet("Each child question can still override taxonomy individually"),
        blank(),
        note("You can include images in the passage using [IMAGE: URL] tokens — the importer renders them inline."),
        divider(),

        // ── Field reference ───────────────────────────────────────────────────
        ...fieldReferenceSection(true),

        // ── Example ────────────────────────────────────────────────────────────
        heading2("Example — Passage with Three Sub-questions"),
        sectionBox([
          field("GROUP_START", "", GRAY),
          field("Category:", " Banking", GRAY),
          field("Subject:", " Data Interpretation", GRAY),
          field("Topic:", " Table Charts", GRAY),
          field("Subtopic:", " Production Data", GRAY),
          new Paragraph({
            children: [
              new TextRun({ text: "Passage: ", bold: true, color: PURPLE, size: 19, font: "Courier New" }),
              new TextRun({ text: " Study the table below showing annual production data.", size: 19, font: "Courier New", color: "1e293b" }),
            ],
            spacing: { before: 30, after: 30 },
            indent: { left: convertInchesToTwip(0.3) },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "            ", size: 19 }),
              new TextRun({ text: "[IMAGE: https://cdn.saphala.in/questions/production-table-2019-2023.png]", font: "Courier New", size: 18, color: "7c3aed" }),
            ],
            spacing: { before: 30, after: 30 },
          }),
          blank(),

          field("QUESTION", "", GRAY),
          field("Question:", " In which year was the total production highest?", "1e293b"),
          field("Option A:", " 2019", "1e293b"),
          field("Option B:", " 2020", "1e293b"),
          field("Option C:", " 2021", "1e293b"),
          field("Option D:", " 2022", "1e293b"),
          field("Correct Answer:", " C", GREEN),
          field("Difficulty:", " MEDIUM", GRAY),
          field("Explanation:", " 2021 shows the highest total across all columns in the table.", GRAY),
          field("END_QUESTION", "", GRAY),
          blank(),

          field("QUESTION", "", GRAY),
          field("Question:", " What is the approximate percentage increase in production from 2020 to 2021?", "1e293b"),
          field("Option A:", " 10%", "1e293b"),
          field("Option B:", " 15%", "1e293b"),
          field("Option C:", " 20%", "1e293b"),
          field("Option D:", " 25%", "1e293b"),
          field("Correct Answer:", " B", GREEN),
          field("Difficulty:", " HARD", GRAY),
          field("Explanation:", " (2021 value − 2020 value) / 2020 value × 100 ≈ 15%.", GRAY),
          field("END_QUESTION", "", GRAY),
          blank(),

          field("QUESTION", "", GRAY),
          field("Question:", " Which year recorded the lowest production?", "1e293b"),
          field("Option A:", " 2019", "1e293b"),
          field("Option B:", " 2020", "1e293b"),
          field("Option C:", " 2022", "1e293b"),
          field("Option D:", " 2023", "1e293b"),
          field("Correct Answer:", " A", GREEN),
          field("Difficulty:", " EASY", GRAY),
          field("Explanation:", " 2019 had the lowest bar in the chart.", GRAY),
          field("END_QUESTION", "", GRAY),

          field("GROUP_END", "", GRAY),
        ]),
        blank(),

        divider(),
        body("For standalone (non-grouped) questions, use the Single Question Template.", { color: GRAY, italics: true }),
        body("For help, contact the admin team.", { color: GRAY, italics: true }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

const FILES = [
  { fn: buildSingleTemplate, name: "saphala_single_question_template_v2.docx" },
  { fn: buildGroupTemplate,  name: "saphala_group_question_template_v2.docx"  },
];

console.log("Generating DOCX templates...");
for (const { fn, name } of FILES) {
  const buf = await fn();
  const dest = path.join(OUT_DIR, name);
  fs.writeFileSync(dest, buf);
  console.log("  ✓", name, `(${Math.round(buf.length / 1024)} KB)`);
}
console.log("Done. Files saved to public/downloads/");
