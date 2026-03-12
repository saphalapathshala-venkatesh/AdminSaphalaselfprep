/**
 * Saphala Bulk Upload Template Generator
 * Run with: node scripts/generate-upload-templates.mjs
 *
 * Generates all 5 downloadable documents into public/downloads/
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "downloads");
mkdirSync(OUT, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function h(text, level = HeadingLevel.HEADING_1, color = "1e1b4b") {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text, bold: true, color })],
    spacing: { before: 280, after: 120 },
  });
}

function h2(text) { return h(text, HeadingLevel.HEADING_2, "3730a3"); }
function h3(text) { return h(text, HeadingLevel.HEADING_3, "4f46e5"); }

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, ...opts })],
    spacing: { before: 80, after: 80 },
  });
}

function bold(text) { return p(text, { bold: true }); }

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    children: [new TextRun({ text })],
    spacing: { before: 60, after: 60 },
  });
}

function sep() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "c7d2fe" } },
    spacing: { before: 200, after: 200 },
    children: [],
  });
}

function codeBlock(text) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "f1f5f9" },
    children: [new TextRun({ text, font: "Courier New", size: 18, color: "1e293b" })],
    spacing: { before: 100, after: 100 },
    indent: { left: 360 },
  });
}

function labelValue(label, value) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: "374151" }),
      new TextRun({ text: value, color: "111827" }),
    ],
    spacing: { before: 60, after: 60 },
    indent: { left: 360 },
  });
}

function tableHeaderCell(text) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "4f46e5" },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: "ffffff", size: 18 })],
      alignment: AlignmentType.CENTER,
    })],
  });
}

function tableDataCell(text, fill = "ffffff") {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, color: "auto", fill },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, color: "1f2937" })],
    })],
  });
}

function fieldTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          tableHeaderCell("Field"),
          tableHeaderCell("Required"),
          tableHeaderCell("Valid Values"),
          tableHeaderCell("Notes"),
        ],
      }),
      ...rows.map(([field, req, valid, notes], i) =>
        new TableRow({
          children: [
            tableDataCell(field, i % 2 === 0 ? "f8f9ff" : "ffffff"),
            tableDataCell(req, i % 2 === 0 ? "f8f9ff" : "ffffff"),
            tableDataCell(valid, i % 2 === 0 ? "f8f9ff" : "ffffff"),
            tableDataCell(notes, i % 2 === 0 ? "f8f9ff" : "ffffff"),
          ],
        })
      ),
    ],
  });
}

async function saveDoc(doc, filename) {
  const buf = await Packer.toBuffer(doc);
  writeFileSync(join(OUT, filename), buf);
  console.log(`✓ ${filename}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CSV — SINGLE QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────

const csvContent = [
  "question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,category,subject,topic,subtopic,question_type,difficulty,source_tag,marks,negative_marks",
  `"The ratio of the ages of A and B is 3:5. If A is 18 years old, how old is B?","24","30","36","42","B","If A = 18 and ratio is 3:5, then B = (18/3)×5 = 30 years.","Banking","Quantitative Aptitude","Ratio and Proportion","Age Problems","MCQ","EASY","SBI_PO_2023","1","0.25"`,
  `"A train 150 m long passes a pole in 15 seconds. What is the speed of the train in km/h?","36","40","54","60","A","Speed = Distance/Time = 150/15 = 10 m/s. Converting to km/h: 10 × 18/5 = 36 km/h.","Banking","Quantitative Aptitude","Time Speed Distance","Trains","MCQ","MEDIUM","IBPS_PO_2022","2","0.5"`,
  `"Which article of the Indian Constitution provides for the formation of new states?","Article 3","Article 5","Article 14","Article 21","A","Article 3 of the Constitution empowers Parliament to form new states and alter boundaries of existing states.","UPSC","General Studies","Indian Polity","Constitutional Provisions","MCQ","HARD","UPSC_PRE_2023","2","0.66"`,
].join("\n");

writeFileSync(join(OUT, "saphala_bulk_upload_single_questions.csv"), csvContent, "utf8");
console.log("✓ saphala_bulk_upload_single_questions.csv");

// ─────────────────────────────────────────────────────────────────────────────
// 2. DOCX — SINGLE QUESTION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

const singleQuestionDoc = new Document({
  sections: [{
    children: [
      h("Saphala Self Prep — Single Question Upload Template"),
      p("Use this template to format questions for bulk upload via DOCX. Each question begins with QUESTION: and ends before the next QUESTION: block. Do not include Section or Subsection — these are selected in the admin UI before uploading."),
      sep(),

      h2("Template Instructions"),
      bullet("Every field label must appear on its own line, exactly as shown (case-sensitive)."),
      bullet("QUESTION: marks the start of each question block."),
      bullet("END_QUESTION marks the end of each question block."),
      bullet("Correct Answer must be exactly one of: A, B, C, or D."),
      bullet("Difficulty must be exactly one of: EASY, MEDIUM, HARD."),
      bullet("Question Type must be exactly one of: MCQ, TRUE_FALSE."),
      bullet("Marks and Negative Marks are numbers. Use 0 for no negative marking."),
      bullet("All fields except Explanation, Subtopic, Source Tag, and Negative Marks are mandatory."),
      sep(),

      h2("Question Examples"),

      // ── Example 1
      h3("Example 1 — Banking / Easy"),
      codeBlock("QUESTION:"),
      labelValue("Question", "The ratio of the ages of A and B is 3:5. If A is 18 years old, how old is B?"),
      labelValue("Option A", "24"),
      labelValue("Option B", "30"),
      labelValue("Option C", "36"),
      labelValue("Option D", "42"),
      labelValue("Correct Answer", "B"),
      labelValue("Explanation", "If A = 18 and ratio is 3:5, then B = (18/3)×5 = 30 years."),
      labelValue("Category", "Banking"),
      labelValue("Subject", "Quantitative Aptitude"),
      labelValue("Topic", "Ratio and Proportion"),
      labelValue("Subtopic", "Age Problems"),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "EASY"),
      labelValue("Source Tag", "SBI_PO_2023"),
      labelValue("Marks", "1"),
      labelValue("Negative Marks", "0.25"),
      codeBlock("END_QUESTION"),
      sep(),

      // ── Example 2
      h3("Example 2 — Banking / Medium"),
      codeBlock("QUESTION:"),
      labelValue("Question", "A train 150 m long passes a pole in 15 seconds. What is the speed of the train in km/h?"),
      labelValue("Option A", "36"),
      labelValue("Option B", "40"),
      labelValue("Option C", "54"),
      labelValue("Option D", "60"),
      labelValue("Correct Answer", "A"),
      labelValue("Explanation", "Speed = Distance / Time = 150/15 = 10 m/s. In km/h: 10 × 18/5 = 36 km/h."),
      labelValue("Category", "Banking"),
      labelValue("Subject", "Quantitative Aptitude"),
      labelValue("Topic", "Time Speed Distance"),
      labelValue("Subtopic", "Trains"),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "MEDIUM"),
      labelValue("Source Tag", "IBPS_PO_2022"),
      labelValue("Marks", "2"),
      labelValue("Negative Marks", "0.5"),
      codeBlock("END_QUESTION"),
      sep(),

      // ── Example 3
      h3("Example 3 — UPSC / Hard"),
      codeBlock("QUESTION:"),
      labelValue("Question", "Which article of the Indian Constitution provides for the formation of new states?"),
      labelValue("Option A", "Article 3"),
      labelValue("Option B", "Article 5"),
      labelValue("Option C", "Article 14"),
      labelValue("Option D", "Article 21"),
      labelValue("Correct Answer", "A"),
      labelValue("Explanation", "Article 3 empowers Parliament to form new states and alter boundaries of existing states."),
      labelValue("Category", "UPSC"),
      labelValue("Subject", "General Studies"),
      labelValue("Topic", "Indian Polity"),
      labelValue("Subtopic", "Constitutional Provisions"),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "HARD"),
      labelValue("Source Tag", "UPSC_PRE_2023"),
      labelValue("Marks", "2"),
      labelValue("Negative Marks", "0.66"),
      codeBlock("END_QUESTION"),
      sep(),

      h2("Field Reference"),
      fieldTable([
        ["question_text",  "MANDATORY", "Any text",                   "Full question stem"],
        ["option_a",       "MANDATORY", "Any text",                   "Option A text"],
        ["option_b",       "MANDATORY", "Any text",                   "Option B text"],
        ["option_c",       "MANDATORY", "Any text",                   "Option C text"],
        ["option_d",       "MANDATORY", "Any text",                   "Option D text"],
        ["correct_answer", "MANDATORY", "A / B / C / D",              "Single uppercase letter"],
        ["explanation",    "optional",  "Any text",                   "Shown after answer reveal"],
        ["category",       "MANDATORY", "e.g. Banking, UPSC",         "Top-level taxonomy node"],
        ["subject",        "MANDATORY", "e.g. Quantitative Aptitude", "Second-level taxonomy node"],
        ["topic",          "MANDATORY", "e.g. Ratio and Proportion",  "Third-level taxonomy node"],
        ["subtopic",       "optional",  "e.g. Age Problems",          "Fourth-level taxonomy node"],
        ["question_type",  "MANDATORY", "MCQ / TRUE_FALSE",           "Exact match, case-sensitive"],
        ["difficulty",     "MANDATORY", "EASY / MEDIUM / HARD",       "Exact match, case-sensitive"],
        ["source_tag",     "optional",  "e.g. SBI_PO_2023",           "Exam source tag"],
        ["marks",          "MANDATORY", "Positive number",            "e.g. 1, 2, 1.5"],
        ["negative_marks", "optional",  "Positive number or 0",       "e.g. 0.25, 0.5, 0.66"],
      ]),
    ],
  }],
});

await saveDoc(singleQuestionDoc, "saphala_single_question_template.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 3. DOCX — GROUP / PARAGRAPH QUESTION TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

const groupQuestionDoc = new Document({
  sections: [{
    children: [
      h("Saphala Self Prep — Group / Paragraph Question Upload Template"),
      p("Use this template for paragraph-based question groups: reading comprehension, reasoning puzzles, seating arrangements, and data interpretation. The paragraph is written once and shared across all child questions within the group."),
      p("Do not include Section or Subsection — these are selected in the admin UI before uploading."),
      sep(),

      h2("Group Structure Rules"),
      bullet("Every group starts with GROUP_START: and a group title."),
      bullet("The shared paragraph follows immediately after PASSAGE:."),
      bullet("Each question within the group uses the same QUESTION: / END_QUESTION format as single questions."),
      bullet("The group closes with GROUP_END."),
      bullet("Standalone questions outside groups use the same QUESTION: / END_QUESTION format with no GROUP_START."),
      bullet("Groups may contain 2 to 10 child questions."),
      bullet("Child questions inherit Marks and Negative Marks individually — they may differ within a group."),
      bullet("Taxonomy (Category / Subject / Topic / Subtopic) is set once at group level and inherited by all child questions."),
      sep(),

      h2("Example — Paragraph Group (Reading Comprehension)"),

      codeBlock("GROUP_START: RC_GROUP_01"),
      p(""),
      codeBlock("PASSAGE:"),
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "f0f9ff" },
        children: [new TextRun({
          text: "The Reserve Bank of India (RBI) was established on 1 April 1935 under the Reserve Bank of India Act, 1934. It serves as the central bank of the country and is responsible for the issue and supply of the Indian rupee and the regulation of the Indian banking system. The RBI also manages the country's foreign exchange reserves under the Foreign Exchange Management Act (FEMA). Its headquarters is in Mumbai, Maharashtra.",
          size: 18, color: "1e3a5f",
        })],
        spacing: { before: 100, after: 200 },
        indent: { left: 360, right: 360 },
      }),
      p(""),
      codeBlock("CATEGORY: Banking"),
      codeBlock("SUBJECT: General Awareness"),
      codeBlock("TOPIC: Indian Banking System"),
      codeBlock("SUBTOPIC: RBI"),
      p(""),

      // ── Child Q1
      codeBlock("QUESTION:"),
      labelValue("Question", "When was the Reserve Bank of India established?"),
      labelValue("Option A", "1 April 1935"),
      labelValue("Option B", "1 January 1949"),
      labelValue("Option C", "26 January 1950"),
      labelValue("Option D", "15 August 1947"),
      labelValue("Correct Answer", "A"),
      labelValue("Explanation", "The RBI was established on 1 April 1935 under the RBI Act, 1934."),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "EASY"),
      labelValue("Source Tag", "IBPS_CLERK_2023"),
      labelValue("Marks", "1"),
      labelValue("Negative Marks", "0.25"),
      codeBlock("END_QUESTION"),
      p(""),

      // ── Child Q2
      codeBlock("QUESTION:"),
      labelValue("Question", "Under which Act does the RBI manage India's foreign exchange reserves?"),
      labelValue("Option A", "RBI Act, 1934"),
      labelValue("Option B", "Banking Regulation Act, 1949"),
      labelValue("Option C", "Foreign Exchange Management Act (FEMA)"),
      labelValue("Option D", "Securities Contracts Regulation Act"),
      labelValue("Correct Answer", "C"),
      labelValue("Explanation", "The RBI manages foreign exchange reserves under FEMA."),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "MEDIUM"),
      labelValue("Source Tag", "IBPS_CLERK_2023"),
      labelValue("Marks", "1"),
      labelValue("Negative Marks", "0.25"),
      codeBlock("END_QUESTION"),
      p(""),

      // ── Child Q3
      codeBlock("QUESTION:"),
      labelValue("Question", "Where is the headquarters of the Reserve Bank of India located?"),
      labelValue("Option A", "New Delhi"),
      labelValue("Option B", "Kolkata"),
      labelValue("Option C", "Chennai"),
      labelValue("Option D", "Mumbai"),
      labelValue("Correct Answer", "D"),
      labelValue("Explanation", "The RBI headquarters is in Mumbai, Maharashtra."),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "EASY"),
      labelValue("Source Tag", "IBPS_CLERK_2023"),
      labelValue("Marks", "1"),
      labelValue("Negative Marks", "0.25"),
      codeBlock("END_QUESTION"),
      p(""),
      codeBlock("GROUP_END"),
      sep(),

      h2("Example — Standalone Question (After Group)"),
      codeBlock("QUESTION:"),
      labelValue("Question", "Which of the following is NOT a function of the Reserve Bank of India?"),
      labelValue("Option A", "Issuing currency notes"),
      labelValue("Option B", "Regulating commercial banks"),
      labelValue("Option C", "Collecting direct taxes"),
      labelValue("Option D", "Acting as the government's banker"),
      labelValue("Correct Answer", "C"),
      labelValue("Explanation", "Collecting direct taxes is the function of the Income Tax Department, not the RBI."),
      labelValue("Category", "Banking"),
      labelValue("Subject", "General Awareness"),
      labelValue("Topic", "Indian Banking System"),
      labelValue("Subtopic", "RBI"),
      labelValue("Question Type", "MCQ"),
      labelValue("Difficulty", "MEDIUM"),
      labelValue("Source Tag", "SBI_PO_2022"),
      labelValue("Marks", "2"),
      labelValue("Negative Marks", "0.5"),
      codeBlock("END_QUESTION"),
      sep(),

      h2("Group Field Reference"),
      fieldTable([
        ["GROUP_START",    "MANDATORY", "Any group identifier",       "Marks the start of a paragraph group"],
        ["PASSAGE",        "MANDATORY", "Full paragraph text",        "Written once, shared by all child Qs"],
        ["CATEGORY",       "MANDATORY", "e.g. Banking",              "Set once at group level"],
        ["SUBJECT",        "MANDATORY", "e.g. General Awareness",    "Set once at group level"],
        ["TOPIC",          "MANDATORY", "e.g. Indian Banking System","Set once at group level"],
        ["SUBTOPIC",       "optional",  "e.g. RBI",                  "Set once at group level"],
        ["QUESTION:",      "MANDATORY", "—",                          "Marks each child question"],
        ["correct_answer", "MANDATORY", "A / B / C / D",             "Per child question"],
        ["difficulty",     "MANDATORY", "EASY / MEDIUM / HARD",      "Per child question"],
        ["marks",          "MANDATORY", "Positive number",           "Per child question — may vary"],
        ["negative_marks", "optional",  "Positive number or 0",      "Per child question — may vary"],
        ["GROUP_END",      "MANDATORY", "—",                          "Marks the end of a paragraph group"],
      ]),
    ],
  }],
});

await saveDoc(groupQuestionDoc, "saphala_group_question_template.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 4. DOCX — IMPORT RULES
// ─────────────────────────────────────────────────────────────────────────────

const importRulesDoc = new Document({
  sections: [{
    children: [
      h("Saphala Self Prep — Import Rules Document"),
      p("Version 1.0  ·  March 2026  ·  For Saphala Content Team use only"),
      sep(),

      h2("1. Overview"),
      p("The Saphala Admin Console supports three upload methods for adding questions to a test section:"),
      bullet("CSV upload — spreadsheet-compatible, best for large batches of simple MCQs"),
      bullet("Single-question DOCX upload — formatted document, supports passages and richer formatting"),
      bullet("Group-question DOCX upload — for paragraph / passage-based question sets"),
      p(""),
      p("All three methods are accessed through the same Add Questions workflow. Section and Subsection are NEVER part of the upload file — they are selected in the admin UI before triggering the upload."),
      sep(),

      h2("2. Add Questions Workflow"),
      bold("Step-by-step process:"),
      bullet("1. Open the Test Builder and navigate to the correct test."),
      bullet("2. Select the Section where questions should be added."),
      bullet("3. If the section has subsections, select the correct Subsection."),
      bullet("4. Click the Add Questions button."),
      bullet("5. Choose one of the following options:", 1),
      bullet("Add Single Question — opens the question form.", 2),
      bullet("Bulk Upload Questions — opens the file upload dialog.", 2),
      bullet("6. For bulk upload: choose CSV or DOCX, select your file, and click Upload."),
      bullet("7. The system shows a Preview Panel with parsed questions."),
      bullet("8. Review errors and warnings before clicking Commit."),
      bullet("9. Committed questions appear in the selected section immediately."),
      sep(),

      h2("3. CSV Template"),
      h3("3.1 File format"),
      bullet("UTF-8 encoded .csv file"),
      bullet("First row must be the header row — field names in snake_case exactly as specified"),
      bullet("One question per data row"),
      bullet("Fields containing commas or quotes must be wrapped in double-quotes"),
      bullet("Maximum 500 questions per CSV file"),

      h3("3.2 Mandatory fields"),
      bullet("question_text — full question stem"),
      bullet("option_a, option_b, option_c, option_d — the four answer choices"),
      bullet("correct_answer — exactly one of: A, B, C, D (uppercase)"),
      bullet("category, subject, topic — taxonomy path, top three levels"),
      bullet("question_type — exactly MCQ or TRUE_FALSE"),
      bullet("difficulty — exactly EASY, MEDIUM, or HARD"),
      bullet("marks — positive decimal number (e.g. 1, 2, 1.5)"),

      h3("3.3 Optional fields"),
      bullet("explanation — shown after the correct answer is revealed"),
      bullet("subtopic — fourth taxonomy level"),
      bullet("source_tag — exam source reference (e.g. SBI_PO_2023)"),
      bullet("negative_marks — positive decimal or 0; defaults to 0 if omitted"),

      h3("3.4 Fields that MUST NOT appear in the file"),
      bullet("section — never include; selected in admin UI"),
      bullet("subsection — never include; selected in admin UI"),
      sep(),

      h2("4. Single-Question DOCX Template"),
      h3("4.1 Block structure"),
      p("Each question is a self-contained block:"),
      codeBlock("QUESTION:"),
      codeBlock("Question: <text>"),
      codeBlock("Option A: <text>"),
      codeBlock("Option B: <text>"),
      codeBlock("Option C: <text>"),
      codeBlock("Option D: <text>"),
      codeBlock("Correct Answer: <A|B|C|D>"),
      codeBlock("Explanation: <text>   (optional)"),
      codeBlock("Category: <text>"),
      codeBlock("Subject: <text>"),
      codeBlock("Topic: <text>"),
      codeBlock("Subtopic: <text>   (optional)"),
      codeBlock("Question Type: <MCQ|TRUE_FALSE>"),
      codeBlock("Difficulty: <EASY|MEDIUM|HARD>"),
      codeBlock("Source Tag: <text>   (optional)"),
      codeBlock("Marks: <number>"),
      codeBlock("Negative Marks: <number>   (optional)"),
      codeBlock("END_QUESTION"),

      h3("4.2 Rules"),
      bullet("Field labels are case-sensitive and must match exactly."),
      bullet("QUESTION: and END_QUESTION are mandatory delimiters — missing either causes the parser to skip the block."),
      bullet("Blank lines between fields are ignored."),
      bullet("Maximum 200 questions per DOCX file."),
      sep(),

      h2("5. Group / Paragraph DOCX Template"),
      h3("5.1 Block structure"),
      codeBlock("GROUP_START: <group_id>"),
      codeBlock("PASSAGE: <paragraph text>"),
      codeBlock("CATEGORY: <text>"),
      codeBlock("SUBJECT: <text>"),
      codeBlock("TOPIC: <text>"),
      codeBlock("SUBTOPIC: <text>   (optional)"),
      codeBlock("QUESTION:"),
      codeBlock("  ... child question fields (same as single question, no Category/Subject/Topic needed) ..."),
      codeBlock("END_QUESTION"),
      codeBlock("  (repeat QUESTION block for each child)"),
      codeBlock("GROUP_END"),

      h3("5.2 Rules"),
      bullet("GROUP_START and GROUP_END are mandatory. Missing either invalidates the entire group."),
      bullet("The passage text is inherited by all child questions automatically."),
      bullet("Category / Subject / Topic are declared once at group level — do not repeat per child."),
      bullet("Marks and Negative Marks are set individually per child question."),
      bullet("A group must contain at least 2 and at most 10 child questions."),
      bullet("Standalone questions may appear before or after groups in the same file."),
      sep(),

      h2("6. Taxonomy Rules"),
      bullet("Category, Subject, and Topic must match existing taxonomy nodes in the system OR will be auto-created if auto-create is enabled in admin settings."),
      bullet("Taxonomy matching is case-insensitive but the canonical casing stored in the database is preserved."),
      bullet("If a taxonomy node does not exist and auto-create is disabled, the question is flagged as a WARNING (not a blocking error) and placed in the review queue."),
      bullet("Subtopic is always optional and always auto-created if it does not exist."),
      sep(),

      h2("7. Marks & Negative Marking Rules"),
      bullet("marks must be a positive number. Zero is not allowed for marks."),
      bullet("negative_marks must be a non-negative number (0 or positive). Default: 0."),
      bullet("Different questions within the same upload may carry different marks values."),
      bullet("negative_marks is always optional. If omitted in CSV, it defaults to 0. In DOCX it defaults to 0."),
      bullet("Fractional values are supported: 0.25, 0.33, 0.5, 0.66, 1.5, etc."),
      sep(),

      h2("8. Blocking Errors vs Warnings"),
      bold("Blocking Errors (upload cannot be committed):"),
      bullet("Missing mandatory field in any question"),
      bullet("correct_answer not in [A, B, C, D]"),
      bullet("difficulty not in [EASY, MEDIUM, HARD]"),
      bullet("question_type not in [MCQ, TRUE_FALSE]"),
      bullet("marks is zero or negative"),
      bullet("negative_marks is negative"),
      bullet("Malformed GROUP_START/GROUP_END (unclosed or empty group)"),
      bullet("Duplicate question detected (identical content hash)"),
      p(""),
      bold("Warnings (upload can proceed after review):"),
      bullet("Taxonomy node does not exist (auto-create off)"),
      bullet("explanation is missing (informational only)"),
      bullet("subtopic is missing"),
      bullet("source_tag is missing"),
      bullet("Question is similar (not identical) to an existing question (similarity ≥ 85%)"),
    ],
  }],
});

await saveDoc(importRulesDoc, "saphala_import_rules.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 5. DOCX — QUICK REFERENCE CHEAT SHEET
// ─────────────────────────────────────────────────────────────────────────────

const quickRefDoc = new Document({
  sections: [{
    children: [
      h("Saphala Self Prep — Bulk Upload Quick Reference"),
      p("Keep this page open while preparing upload files."),
      sep(),

      h2("Add Questions Workflow"),
      new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: "eef2ff" },
        children: [new TextRun({ text: "Test Builder → Select Section → (Select Subsection if exists) → Add Questions → Single or Bulk Upload", bold: true, size: 20, color: "3730a3" })],
        spacing: { before: 120, after: 120 },
        indent: { left: 360, right: 360 },
      }),
      p("Section / Subsection are NEVER in the upload file."),
      sep(),

      h2("CSV Columns (in order)"),
      codeBlock("question_text | option_a | option_b | option_c | option_d | correct_answer | explanation | category | subject | topic | subtopic | question_type | difficulty | source_tag | marks | negative_marks"),
      sep(),

      h2("Single-Question DOCX Structure"),
      codeBlock("QUESTION:"),
      codeBlock("Question: <text>"),
      codeBlock("Option A: <text>  |  Option B: <text>  |  Option C: <text>  |  Option D: <text>"),
      codeBlock("Correct Answer: A  (must be A / B / C / D)"),
      codeBlock("Explanation: <text>  (optional)"),
      codeBlock("Category: <text>  |  Subject: <text>  |  Topic: <text>  |  Subtopic: <text> (opt)"),
      codeBlock("Question Type: MCQ  |  Difficulty: EASY / MEDIUM / HARD"),
      codeBlock("Source Tag: <text>  (optional)  |  Marks: 1  |  Negative Marks: 0.25  (optional)"),
      codeBlock("END_QUESTION"),
      sep(),

      h2("Group / Paragraph DOCX Structure"),
      codeBlock("GROUP_START: <group_id>"),
      codeBlock("PASSAGE: <full paragraph text here>"),
      codeBlock("CATEGORY: Banking  |  SUBJECT: General Awareness  |  TOPIC: RBI  |  SUBTOPIC: (opt)"),
      codeBlock("QUESTION:  ...child fields (no Category/Subject/Topic needed)...  END_QUESTION"),
      codeBlock("QUESTION:  ...  END_QUESTION   (repeat 2–10 times)"),
      codeBlock("GROUP_END"),
      sep(),

      h2("Valid Values — Quick Lookup"),
      fieldTable([
        ["correct_answer", "—",      "A / B / C / D",           "Uppercase, single character"],
        ["question_type",  "—",      "MCQ / TRUE_FALSE",        "Exact match, case-sensitive"],
        ["difficulty",     "—",      "EASY / MEDIUM / HARD",    "Exact match, case-sensitive"],
        ["marks",          "—",      "Positive decimal",        "e.g. 1, 2, 1.5 — never 0"],
        ["negative_marks", "—",      "0 or positive decimal",   "e.g. 0, 0.25, 0.33, 0.5, 0.66"],
      ]),
      sep(),

      h2("Common Upload Mistakes"),
      bullet("❌  Including section or subsection columns in CSV or DOCX — remove them entirely"),
      bullet("❌  correct_answer written as 'option b' or '(B)' instead of the single letter B"),
      bullet("❌  difficulty written as 'Medium' or 'medium' instead of MEDIUM"),
      bullet("❌  marks set to 0 — marks must be a positive number"),
      bullet("❌  negative_marks set to a negative number like -0.25 — use positive 0.25"),
      bullet("❌  Missing END_QUESTION delimiter — the question block will be skipped entirely"),
      bullet("❌  GROUP_START without a matching GROUP_END — entire group is discarded"),
      bullet("❌  Only 1 child question inside a group — minimum is 2"),
      bullet("❌  Taxonomy name typos — use the exact names from the Taxonomy Manager"),
      sep(),

      h2("Timer Note"),
      p("When configuring test timers in the Test Builder, enter the duration in MINUTES (e.g. 90)."),
      p("The runtime display automatically formats this as HH:MM:SS (e.g. 01:30:00 for 90 minutes)."),
    ],
  }],
});

await saveDoc(quickRefDoc, "saphala_quick_reference.docx");

console.log("\n✅ All 5 files generated in public/downloads/");
