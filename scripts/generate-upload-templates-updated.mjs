/**
 * Saphala Bulk Upload Template Generator — UPDATED (March 2026)
 * Run with: node scripts/generate-upload-templates-updated.mjs
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "downloads");
mkdirSync(OUT, { recursive: true });

// ── Style helpers ──────────────────────────────────────────────────────────
const C = {
  navy:"1e1b4b", blue:"3730a3", purple:"4f46e5", dark:"111827",
  gray:"6b7280", amber:"92400e", amberBg:"fefce8",
  greenBg:"f0fdf4", green:"166534", redBg:"fef2f2", red:"991b1b",
  slate:"f8fafc", lightPurple:"eef2ff",
};

function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text:t, bold:true, color:C.navy })], spacing:{before:300,after:140} }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text:t, bold:true, color:C.blue })], spacing:{before:260,after:120} }); }
function h3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text:t, bold:true, color:C.purple })], spacing:{before:200,after:80} }); }
function p(t, color=C.dark) { return new Paragraph({ children:[new TextRun({text:t,color})], spacing:{before:80,after:80} }); }
function bold(t, color=C.dark) { return new Paragraph({ children:[new TextRun({text:t,bold:true,color})], spacing:{before:80,after:60} }); }
function bullet(t, level=0, color=C.dark) { return new Paragraph({ bullet:{level}, children:[new TextRun({text:t,color})], spacing:{before:50,after:50} }); }
function sep() { return new Paragraph({ border:{bottom:{style:BorderStyle.SINGLE,size:6,color:"c7d2fe"}}, spacing:{before:200,after:200}, children:[] }); }
function code(t) { return new Paragraph({ shading:{type:ShadingType.CLEAR,color:"auto",fill:"f1f5f9"}, children:[new TextRun({text:t,font:"Courier New",size:18,color:"1e293b"})], spacing:{before:80,after:80}, indent:{left:360} }); }
function lv(label, value) { return new Paragraph({ children:[new TextRun({text:`${label}: `,bold:true,color:"374151"}), new TextRun({text:value,color:C.dark})], spacing:{before:60,after:60}, indent:{left:360} }); }
function note(t, fill=C.amberBg, color=C.amber) { return new Paragraph({ shading:{type:ShadingType.CLEAR,color:"auto",fill}, children:[new TextRun({text:t,size:18,color})], spacing:{before:100,after:100}, indent:{left:360,right:360} }); }
function goodNote(t) { return note("✓ "+t, C.greenBg, C.green); }
function warnNote(t) { return note("⚠ "+t, C.amberBg, C.amber); }
function errNote(t)  { return note("✗ "+t, C.redBg,   C.red); }

function thCell(t) {
  return new TableCell({ shading:{type:ShadingType.CLEAR,color:"auto",fill:C.purple}, children:[new Paragraph({ children:[new TextRun({text:t,bold:true,color:"ffffff",size:18})], alignment:AlignmentType.CENTER })] });
}
function tdCell(t, fill="ffffff") {
  return new TableCell({ shading:{type:ShadingType.CLEAR,color:"auto",fill}, children:[new Paragraph({ children:[new TextRun({text:t,size:18,color:C.dark})] })] });
}
function tbl(cols, rows) {
  return new Table({
    width:{size:100,type:WidthType.PERCENTAGE},
    rows:[
      new TableRow({ tableHeader:true, children:cols.map(thCell) }),
      ...rows.map((r,i) => new TableRow({ children:r.map(c => tdCell(c, i%2===0?"f8f9ff":"ffffff")) })),
    ],
  });
}

async function save(children, filename) {
  const doc = new Document({ sections:[{ children }] });
  const buf = await Packer.toBuffer(doc);
  writeFileSync(join(OUT, filename), buf);
  console.log(`✓ ${filename}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPDATED CSV
// ─────────────────────────────────────────────────────────────────────────────

const csvRows = [
  "question_text,question_image_ref,question_equation,option_a,option_a_image_ref,option_a_equation,option_b,option_b_image_ref,option_b_equation,option_c,option_c_image_ref,option_c_equation,option_d,option_d_image_ref,option_d_equation,correct_answer,explanation,explanation_image_ref,explanation_equation,category,subject,topic,subtopic,question_type,difficulty,source_tag,marks,negative_marks",
  `"The ratio of the ages of A and B is 3:5. If A is 18 years old, how old is B?",,,"24",,,"30",,,"36",,,"42",,,B,"If A=18 and ratio is 3:5 then B=(18÷3)×5=30 years.",,,"Banking","Quantitative Aptitude","Ratio and Proportion","Age Problems","MCQ","EASY","SBI_PO_2023",1,0.25`,
  `"Study the bar chart shown in the image. In which year was export revenue highest?","images/bar_chart_export_2018_2023.png",,"2018",,,"2020",,,"2021",,,"2022",,,C,"As shown in the chart, 2021 had the tallest bar for export revenue.","images/bar_chart_export_annotated.png",,"Banking","Data Interpretation","Bar Charts","Export Revenue","MCQ","MEDIUM","IBPS_PO_2022",2,0.5`,
  `"Solve: if x² - 5x + 6 = 0, what are the roots?",,"x^2 - 5x + 6 = 0","x = 1 and x = 6",,"x=1, x=6","x = 2 and x = 3",,"x=2, x=3","x = -2 and x = -3",,"x=-2, x=-3","x = 3 and x = 4",,"x=3, x=4",B,"Factorising: (x-2)(x-3)=0 so x=2 or x=3.","","(x-2)(x-3)=0","Banking","Quantitative Aptitude","Algebra","Quadratic Equations","MCQ","HARD","SBI_PO_2024",2,0.66`,
];
writeFileSync(join(OUT, "saphala_bulk_upload_single_questions_UPDATED.csv"), csvRows.join("\n"), "utf8");
console.log("✓ saphala_bulk_upload_single_questions_UPDATED.csv");

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPDATED SINGLE QUESTION DOCX
// ─────────────────────────────────────────────────────────────────────────────

await save([
  h1("Saphala Self Prep — Single Question Upload Template [UPDATED]"),
  p("Version 2.0  ·  March 2026  ·  Supports images, screenshots, and equations"),
  p("Do NOT include Section or Subsection fields — selected in admin UI before uploading."),
  sep(),

  h2("Upload Workflow"),
  bullet("1. Open Test Builder → navigate to the target test."),
  bullet("2. Select the Section where questions will be added."),
  bullet("3. If the section has subsections, select the Subsection."),
  bullet("4. Click Add Questions → Bulk Upload Questions."),
  bullet("5. Upload this DOCX file and review the preview."),
  bullet("6. Commit to save questions into the selected section/subsection."),
  sep(),

  h2("Template Rules"),
  bullet("Each question block begins with QUESTION: and ends with END_QUESTION."),
  bullet("Field labels are case-sensitive and must appear exactly as shown."),
  bullet("Optional fields may be left blank: (leave blank)"),
  bullet("Images: insert inline in the document directly below the relevant label line."),
  bullet("Equations: type using plain-text math notation, or insert as an inline image."),
  bullet("Blank lines between fields are ignored by the parser."),
  bullet("Maximum 200 questions per DOCX file."),
  sep(),

  h2("Image Rules"),
  bullet("Formats: PNG, JPG, JPEG, GIF, WEBP."),
  bullet("Minimum readable width: 600px. Maximum size per image: 2 MB."),
  goodNote("Screenshots are explicitly allowed and will not be rejected for being screenshots."),
  warnNote("Blurry or unreadable images are imported but flagged as WARNINGs. Fix before publishing."),
  bullet("Crop screenshots tightly — remove browser chrome, taskbars, unrelated content."),
  bullet("Use PNG format for text-heavy screenshots (better than JPEG for sharpness)."),
  sep(),

  h2("Equation Rules"),
  bullet("Use plain-text notation: x^2 for x², sqrt(16) for √16, 3/4 for ¾."),
  bullet("Paste special characters directly: ≤ ≥ ≠ π θ α β ∑ ∈."),
  bullet("If the equation is complex, insert it as an image instead of or alongside text."),
  warnNote("Do NOT paste raw LaTeX (e.g. \\frac{a}{b}) — use plain-text notation or an image."),
  sep(),

  h2("Example 1 — Text-Only Question"),
  code("QUESTION:"),
  lv("Question", "The ratio of ages of A and B is 3:5. If A is 18, how old is B?"),
  lv("Question Image", "(leave blank)"),
  lv("Question Equation", "(leave blank)"),
  lv("Option A", "24"),  lv("Option A Image", "(leave blank)"),  lv("Option A Equation", "(leave blank)"),
  lv("Option B", "30"),  lv("Option B Image", "(leave blank)"),  lv("Option B Equation", "(leave blank)"),
  lv("Option C", "36"),  lv("Option C Image", "(leave blank)"),  lv("Option C Equation", "(leave blank)"),
  lv("Option D", "42"),  lv("Option D Image", "(leave blank)"),  lv("Option D Equation", "(leave blank)"),
  lv("Correct Answer", "B"),
  lv("Explanation", "If A=18 and ratio is 3:5, then B=(18÷3)×5=30 years."),
  lv("Explanation Image", "(leave blank)"),
  lv("Explanation Equation", "(leave blank)"),
  lv("Category", "Banking"),   lv("Subject", "Quantitative Aptitude"),
  lv("Topic", "Ratio and Proportion"),  lv("Subtopic", "Age Problems"),
  lv("Question Type", "MCQ"),  lv("Difficulty", "EASY"),
  lv("Source Tag", "SBI_PO_2023"),  lv("Marks", "1"),  lv("Negative Marks", "0.25"),
  code("END_QUESTION"),
  sep(),

  h2("Example 2 — Question with Screenshot (Data Interpretation)"),
  p("Shows how to reference a screenshot of a bar chart in the question.", C.gray),
  code("QUESTION:"),
  lv("Question", "Study the bar chart shown below. In which year was export revenue highest?"),
  lv("Question Image", "images/bar_chart_export_2018_2023.png"),
  p("        ↑ In DOCX: insert the image inline here, below this label line.", C.gray),
  lv("Question Equation", "(leave blank)"),
  lv("Option A", "2018"),  lv("Option A Image", "(leave blank)"),  lv("Option A Equation", "(leave blank)"),
  lv("Option B", "2020"),  lv("Option B Image", "(leave blank)"),  lv("Option B Equation", "(leave blank)"),
  lv("Option C", "2021"),  lv("Option C Image", "(leave blank)"),  lv("Option C Equation", "(leave blank)"),
  lv("Option D", "2022"),  lv("Option D Image", "(leave blank)"),  lv("Option D Equation", "(leave blank)"),
  lv("Correct Answer", "C"),
  lv("Explanation", "As shown in the chart, 2021 recorded the highest export revenue bar."),
  lv("Explanation Image", "images/bar_chart_export_annotated.png"),
  lv("Explanation Equation", "(leave blank)"),
  lv("Category", "Banking"),  lv("Subject", "Data Interpretation"),
  lv("Topic", "Bar Charts"),  lv("Subtopic", "Export Revenue"),
  lv("Question Type", "MCQ"),  lv("Difficulty", "MEDIUM"),
  lv("Source Tag", "IBPS_PO_2022"),  lv("Marks", "2"),  lv("Negative Marks", "0.5"),
  code("END_QUESTION"),
  sep(),

  h2("Example 3 — Question with Equation (Algebra)"),
  p("Shows plain-text equation notation in both the question and answer options.", C.gray),
  code("QUESTION:"),
  lv("Question", "Solve: if x² − 5x + 6 = 0, what are the roots?"),
  lv("Question Image", "(leave blank)"),
  lv("Question Equation", "x^2 - 5x + 6 = 0"),
  lv("Option A", "x = 1 and x = 6"),  lv("Option A Image", "(leave blank)"),  lv("Option A Equation", "x=1, x=6"),
  lv("Option B", "x = 2 and x = 3"),  lv("Option B Image", "(leave blank)"),  lv("Option B Equation", "x=2, x=3"),
  lv("Option C", "x = −2 and x = −3"),  lv("Option C Image", "(leave blank)"),  lv("Option C Equation", "x=-2, x=-3"),
  lv("Option D", "x = 3 and x = 4"),  lv("Option D Image", "(leave blank)"),  lv("Option D Equation", "x=3, x=4"),
  lv("Correct Answer", "B"),
  lv("Explanation", "Factorising: (x−2)(x−3)=0, so x=2 or x=3."),
  lv("Explanation Image", "(leave blank)"),
  lv("Explanation Equation", "(x-2)(x-3) = 0"),
  lv("Category", "Banking"),  lv("Subject", "Quantitative Aptitude"),
  lv("Topic", "Algebra"),  lv("Subtopic", "Quadratic Equations"),
  lv("Question Type", "MCQ"),  lv("Difficulty", "HARD"),
  lv("Source Tag", "SBI_PO_2024"),  lv("Marks", "2"),  lv("Negative Marks", "0.66"),
  code("END_QUESTION"),
  sep(),

  h2("Field Reference"),
  tbl(["Field","Required","Image field","Equation field","Notes"], [
    ["question_text",       "MANDATORY","Question Image",     "Question Equation",     "Full question stem"],
    ["option_a / b / c / d","MANDATORY","Option X Image",     "Option X Equation",     "Each option has its own image and equation field"],
    ["correct_answer",      "MANDATORY","—",                  "—",                     "Exactly A, B, C, or D — uppercase"],
    ["explanation",         "optional", "Explanation Image",  "Explanation Equation",  "Shown after answer reveal"],
    ["category",            "MANDATORY","—",                  "—",                     "Top-level taxonomy"],
    ["subject",             "MANDATORY","—",                  "—",                     "Second-level taxonomy"],
    ["topic",               "MANDATORY","—",                  "—",                     "Third-level taxonomy"],
    ["subtopic",            "optional", "—",                  "—",                     "Fourth-level taxonomy"],
    ["question_type",       "MANDATORY","—",                  "—",                     "MCQ or TRUE_FALSE (exact)"],
    ["difficulty",          "MANDATORY","—",                  "—",                     "EASY, MEDIUM, or HARD (exact)"],
    ["source_tag",          "optional", "—",                  "—",                     "e.g. SBI_PO_2023"],
    ["marks",               "MANDATORY","—",                  "—",                     "Positive decimal — never 0"],
    ["negative_marks",      "optional", "—",                  "—",                     "0 or positive decimal; default 0"],
  ]),
], "saphala_single_question_template_UPDATED.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 3. UPDATED GROUP / PARAGRAPH DOCX
// ─────────────────────────────────────────────────────────────────────────────

await save([
  h1("Saphala Self Prep — Group / Paragraph Question Template [UPDATED]"),
  p("Version 2.0  ·  March 2026  ·  Supports images, screenshots, and equations in passage and child questions"),
  p("Do NOT include Section or Subsection — selected in admin UI before uploading."),
  sep(),

  h2("Group Structure Rules"),
  bullet("Every group starts with GROUP_START: <identifier> and ends with GROUP_END."),
  bullet("The shared paragraph/set follows after PASSAGE:."),
  bullet("Passage Image: (optional) — screenshot or chart shown above all child questions."),
  bullet("Passage Equation: (optional) — math expression relevant to the entire set."),
  bullet("CATEGORY / SUBJECT / TOPIC set once at group level and inherited by all children."),
  bullet("Each child question uses QUESTION: / END_QUESTION with its own Marks and Negative Marks."),
  bullet("Minimum 2, maximum 10 child questions per group."),
  bullet("Standalone questions (no GROUP_START) can appear before or after any group."),
  sep(),

  h2("Example 1 — Reading Comprehension (text-only passage)"),
  code("GROUP_START: RC_GROUP_RBI_01"),
  code("PASSAGE:"),
  new Paragraph({
    shading:{type:ShadingType.CLEAR,color:"auto",fill:"f0f9ff"},
    children:[new TextRun({text:"The Reserve Bank of India (RBI) was established on 1 April 1935 under the Reserve Bank of India Act, 1934. It serves as the central bank of the country and is responsible for the issue and supply of the Indian rupee and the regulation of the Indian banking system. The RBI also manages foreign exchange reserves under FEMA. Its headquarters is in Mumbai, Maharashtra.",size:18,color:"1e3a5f"})],
    spacing:{before:100,after:160}, indent:{left:360,right:360},
  }),
  lv("Passage Image",    "(leave blank)"),
  lv("Passage Equation", "(leave blank)"),
  code("CATEGORY: Banking"),
  code("SUBJECT: General Awareness"),
  code("TOPIC: Indian Banking System"),
  code("SUBTOPIC: RBI"),
  p(""),
  code("QUESTION:"),
  lv("Question","When was the RBI established?"),
  lv("Option A","1 April 1935"),  lv("Option B","1 January 1949"),
  lv("Option C","26 January 1950"),  lv("Option D","15 August 1947"),
  lv("Correct Answer","A"),
  lv("Explanation","The RBI was established on 1 April 1935 under the RBI Act, 1934."),
  lv("Question Type","MCQ"),  lv("Difficulty","EASY"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  p(""),
  code("QUESTION:"),
  lv("Question","Under which Act does the RBI manage India's foreign exchange reserves?"),
  lv("Option A","RBI Act, 1934"),  lv("Option B","Banking Regulation Act, 1949"),
  lv("Option C","Foreign Exchange Management Act (FEMA)"),  lv("Option D","Securities Contracts Regulation Act"),
  lv("Correct Answer","C"),
  lv("Explanation","FEMA governs foreign exchange management; the RBI is the implementing body."),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  p(""),
  code("QUESTION:"),
  lv("Question","Where is the RBI headquarters located?"),
  lv("Option A","New Delhi"),  lv("Option B","Kolkata"),
  lv("Option C","Chennai"),  lv("Option D","Mumbai"),
  lv("Correct Answer","D"),
  lv("Explanation","The RBI headquarters is in Mumbai, Maharashtra."),
  lv("Question Type","MCQ"),  lv("Difficulty","EASY"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  code("GROUP_END"),
  sep(),

  h2("Example 2 — Data Interpretation with Screenshot Passage"),
  p("Use this format when the DI set is based on a chart or table supplied as a screenshot.", C.gray),
  code("GROUP_START: DI_GROUP_EXPORT_01"),
  code("PASSAGE:"),
  lv("Passage Text","Study the bar chart below showing India's export revenues (₹ crore) from 2018 to 2023, then answer the questions."),
  lv("Passage Image","images/di_bar_chart_export_2018_2023.png"),
  p("        ↑ In DOCX: insert screenshot inline here, below this label line.", C.gray),
  lv("Passage Equation","(leave blank)"),
  code("CATEGORY: Banking"),
  code("SUBJECT: Data Interpretation"),
  code("TOPIC: Bar Charts"),
  code("SUBTOPIC: Export Revenue"),
  p(""),
  code("QUESTION:"),
  lv("Question","In which year was export revenue highest?"),
  lv("Question Image","(leave blank — passage image already shows chart)"),
  lv("Option A","2018"),  lv("Option B","2020"),  lv("Option C","2021"),  lv("Option D","2022"),
  lv("Correct Answer","C"),
  lv("Explanation","The tallest bar in the chart corresponds to 2021."),
  lv("Explanation Image","images/di_bar_chart_export_annotated.png"),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),  lv("Marks","2"),  lv("Negative Marks","0.5"),
  code("END_QUESTION"),
  p(""),
  code("QUESTION:"),
  lv("Question","What is the approximate ratio of export revenue in 2019 to 2022?"),
  lv("Question Equation","Revenue_2019 / Revenue_2022 = ?"),
  lv("Option A","2 : 3"),  lv("Option B","3 : 5"),  lv("Option C","4 : 7"),  lv("Option D","1 : 2"),
  lv("Correct Answer","B"),
  lv("Explanation","Reading from the chart: 2019 ≈ 3 units, 2022 ≈ 5 units → ratio 3:5."),
  lv("Question Type","MCQ"),  lv("Difficulty","HARD"),  lv("Marks","2"),  lv("Negative Marks","0.66"),
  code("END_QUESTION"),
  code("GROUP_END"),
  sep(),

  h2("Example 3 — Standalone Question After Group"),
  p("Proves that standalone questions can follow groups in the same file.", C.gray),
  code("QUESTION:"),
  lv("Question","Which of the following is NOT a function of the RBI?"),
  lv("Option A","Issuing currency notes"),
  lv("Option B","Regulating commercial banks"),
  lv("Option C","Collecting direct taxes"),
  lv("Option D","Acting as the government's banker"),
  lv("Correct Answer","C"),
  lv("Explanation","Collecting direct taxes is done by the Income Tax Department, not the RBI."),
  lv("Category","Banking"),  lv("Subject","General Awareness"),
  lv("Topic","Indian Banking System"),  lv("Subtopic","RBI"),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),
  lv("Marks","2"),  lv("Negative Marks","0.5"),
  code("END_QUESTION"),
  sep(),

  h2("Group Field Reference"),
  tbl(["Field","Required","Supports Image/Equation","Notes"], [
    ["GROUP_START",      "MANDATORY",  "—",                                   "Marks start; include a short identifier"],
    ["PASSAGE",         "MANDATORY",  "Passage Image + Passage Equation",    "Shared text written once"],
    ["Passage Image",   "optional",   "Yes — screenshot or chart",           "Displayed above all child questions"],
    ["Passage Equation","optional",   "Yes — plain-text or image",           "Shared equation for the entire set"],
    ["CATEGORY/SUBJECT/TOPIC","MANDATORY","—",                               "Set once; inherited by all children"],
    ["SUBTOPIC",        "optional",   "—",                                   "Set once at group level"],
    ["QUESTION block",  "≥2 MANDATORY","Per-child Image + Equation",         "Full child question format"],
    ["Marks",           "MANDATORY",  "—",                                   "Per child — may differ across children"],
    ["Negative Marks",  "optional",   "—",                                   "Per child — defaults to 0 if omitted"],
    ["GROUP_END",       "MANDATORY",  "—",                                   "Marks end of group"],
  ]),
], "saphala_group_question_template_UPDATED.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 4. UPDATED IMPORT RULES
// ─────────────────────────────────────────────────────────────────────────────

await save([
  h1("Saphala Self Prep — Import Rules [UPDATED]"),
  p("Version 2.0  ·  March 2026  ·  Covers images, screenshots, equations, and updated workflow"),
  sep(),

  h2("1. Upload Workflow"),
  bold("Mandatory steps before uploading:"),
  bullet("1. Open Test Builder → navigate to the target test."),
  bullet("2. Select the Section where questions will be added."),
  bullet("3. If that section has subsections, select the correct Subsection."),
  bullet("4. Click Add Questions → choose Add Single Question or Bulk Upload Questions."),
  bullet("5. For bulk: attach your CSV or DOCX (+ images ZIP if using image references)."),
  bullet("6. Review the preview panel — check all errors and warnings before committing."),
  bullet("7. Click Commit to save questions into the selected section/subsection."),
  note("Section and Subsection are NEVER columns in any upload file.", "eef2ff", "3730a3"),
  sep(),

  h2("2. CSV Upload"),
  h3("2.1 Format"),
  bullet("UTF-8 encoded, first row is the header, one question per data row."),
  bullet("Column names must match the template header exactly."),
  bullet("Maximum 500 questions per CSV file."),

  h3("2.2 Image references"),
  bullet("Use _image_ref columns: question_image_ref, option_a_image_ref, explanation_image_ref, etc."),
  bullet("Values are relative paths inside the ZIP: images/q001_chart.png"),
  bullet("All referenced images must be included in a ZIP alongside the CSV."),
  bold("Recommended ZIP structure:"),
  code("upload_batch.zip"),
  code("  ├─ questions.csv"),
  code("  └─ images/"),
  code("       ├─ q001_chart.png"),
  code("       ├─ q002_table_screenshot.png"),
  code("       └─ g01_passage_di.png"),
  bullet("Leave _image_ref empty when no image is needed."),
  goodNote("Screenshot files are accepted exactly like any other image — no special handling required."),

  h3("2.3 Equation references"),
  bullet("Use _equation columns alongside (or instead of) text for math content."),
  bullet("Use plain-text notation: x^2 + 3x - 4 = 0, sqrt(144), 3/4."),
  bullet("Both an equation and an image_ref may be provided for the same field."),
  sep(),

  h2("3. DOCX Upload"),
  h3("3.1 Single question DOCX"),
  bullet("Delimit each question with QUESTION: and END_QUESTION."),
  bullet("Field labels are case-sensitive: Question:, Option A:, Correct Answer:, etc."),
  bullet("Images: insert inline in the document, directly below the relevant label."),
  bullet("Equations: type using plain-text notation, or insert as an inline image."),
  bullet("Maximum 200 questions per DOCX file."),

  h3("3.2 Group DOCX"),
  bullet("GROUP_START: <id> and GROUP_END are mandatory boundary markers."),
  bullet("PASSAGE: declares the shared text. Passage Image: and Passage Equation: are optional."),
  bullet("Taxonomy declared once at group level — not repeated per child question."),
  bullet("Marks / Negative Marks set individually per child — may differ."),
  bullet("Minimum 2, maximum 10 child questions per group."),
  sep(),

  h2("4. Screenshot Policy"),
  goodNote("Screenshots are explicitly supported. They will NOT be rejected for being screenshots."),
  bullet("Accepted for: charts, tables, graphs, seating arrangements, DI sets, math expressions from PDFs."),
  bold("Best practices:"),
  bullet("Crop tightly — remove browser chrome, taskbars, and unrelated content.", 1),
  bullet("Use PNG format for text-heavy screenshots (sharper than JPEG).", 1),
  bullet("Minimum readable width: 600px. Recommended: 1000px+.", 1),
  bullet("For math: zoom in before screenshotting so symbols are clearly distinguishable.", 1),
  warnNote("An image that contains unreadable text is imported but flagged as a WARNING. Fix before publishing."),
  sep(),

  h2("5. Equation Guidelines"),
  h3("5.1 Plain-text notation"),
  tbl(["Math Expression","Plain-text","Example"], [
    ["x squared",        "x^2",           "x^2 + 5x - 6 = 0"],
    ["Square root of n", "sqrt(n)",       "sqrt(144) = 12"],
    ["Fraction a/b",     "a/b",           "3/4 + 1/2 = 5/4"],
    ["Absolute value",   "|x|",           "|x - 3| = 5"],
    ["Pi",               "pi or π",       "Area = pi × r^2"],
    ["Summation",        "sum or ∑",      "∑(i=1 to n) i"],
    ["Subscript",        "x_n",           "a_1, a_2 ... a_n"],
    ["Inequality",       "≤  ≥  ≠",       "x ≤ 10 and y ≥ 0"],
    ["Logarithm",        "log(x) log_2(x)","log x  log₂ x"],
    ["Trig",             "sin(x) cos(x)  tan(x)","sin 30° = 0.5"],
  ]),
  h3("5.2 Image fallback"),
  bullet("If the equation cannot be typed as plain text, insert it as an image."),
  bullet("Render in Word Equation Editor, Desmos, Wolfram Alpha, or LaTeX renderer, then screenshot."),
  bullet("Use the _image_ref field (CSV) or insert inline (DOCX) below the equation label."),
  bullet("When both text and image are provided for the same field, the image is displayed; text is used as alt-text."),
  errNote("Do NOT paste raw LaTeX (e.g. \\frac{a}{b}) — use plain-text notation or an image instead."),
  sep(),

  h2("6. Taxonomy Rules"),
  bullet("Category, Subject, and Topic must exist or will be auto-created if the setting allows."),
  bullet("Matching is case-insensitive; canonical casing from the database is preserved on save."),
  bullet("If a node is missing and auto-create is off: question is queued as a WARNING."),
  bullet("Subtopic is always optional and always auto-created if absent."),
  sep(),

  h2("7. Marks Rules"),
  bullet("marks must be a positive decimal — 0 is not allowed."),
  bullet("Different questions in the same upload may carry different marks values."),
  bullet("negative_marks must be 0 or positive. Default: 0 if omitted."),
  bullet("Typical values: 0.25, 0.33, 0.5, 0.66, 1."),
  sep(),

  h2("8. Shuffle Compatibility"),
  bullet("Shuffle settings are configured at the test level in the Test Builder — NOT in upload files."),
  bullet("When Shuffle Options is on: the runtime maps the correct answer by value — not by letter position. Always use A/B/C/D as the correct_answer in upload files; mapping is automatic."),
  bullet("When Shuffle Questions is on: questions stay within their section/subsection. The section context is determined by the admin's UI selection before upload."),
  bullet("Paragraph groups shuffle as single blocks — the passage remains attached to its child questions."),
  sep(),

  h2("9. Blocking Errors vs Warnings"),
  bold("Blocking Errors — must be fixed before committing:"),
  bullet("Missing mandatory field"),
  bullet("correct_answer not exactly A, B, C, or D"),
  bullet("difficulty not exactly EASY, MEDIUM, or HARD"),
  bullet("question_type not exactly MCQ or TRUE_FALSE"),
  bullet("marks is 0 or negative"),
  bullet("negative_marks is negative"),
  bullet("Unclosed GROUP_START (no matching GROUP_END)"),
  bullet("Group with fewer than 2 child questions"),
  bullet("Exact duplicate (identical content hash already in question bank)"),
  p(""),
  bold("Warnings — review recommended, but upload can proceed:"),
  bullet("Taxonomy node missing (auto-create off)"),
  bullet("explanation missing"),
  bullet("subtopic missing"),
  bullet("source_tag missing"),
  bullet("Image file referenced but not found in ZIP"),
  bullet("Image appears unreadable (low resolution)"),
  bullet("Question is ≥ 85% similar to an existing question"),
  sep(),

  h2("10. Common Mistakes"),
  errNote("Including section or subsection column — remove them entirely"),
  errNote("correct_answer written as 'option b' or '(B)' — must be exactly B"),
  errNote("difficulty written as 'Medium' — must be MEDIUM"),
  errNote("marks set to 0 — must be positive"),
  errNote("negative_marks set to -0.25 — use positive 0.25"),
  errNote("Missing END_QUESTION — entire block is silently skipped"),
  errNote("GROUP_START with no matching GROUP_END — entire group discarded"),
  errNote("Only 1 child question in a group — minimum is 2"),
  errNote("Image path in CSV does not match ZIP file name exactly"),
  errNote("Non-UTF-8 encoding in CSV — always save as UTF-8"),
], "saphala_import_rules_UPDATED.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 5. UPDATED QUICK REFERENCE
// ─────────────────────────────────────────────────────────────────────────────

await save([
  h1("Saphala Self Prep — Quick Reference [UPDATED]"),
  p("Version 2.0  ·  March 2026  ·  Keep this page open while preparing upload files."),
  sep(),

  h2("Workflow"),
  new Paragraph({ shading:{type:ShadingType.CLEAR,color:"auto",fill:"eef2ff"}, children:[new TextRun({text:"Test Builder → Select Section → (Subsection if exists) → Add Questions → Bulk Upload",bold:true,size:20,color:"3730a3"})], spacing:{before:120,after:120}, indent:{left:360,right:360} }),
  note("Section / Subsection are NEVER in the upload file.", "eef2ff", "3730a3"),
  sep(),

  h2("CSV Columns (in order)"),
  code("question_text | question_image_ref | question_equation"),
  code("option_a | option_a_image_ref | option_a_equation"),
  code("option_b | option_b_image_ref | option_b_equation"),
  code("option_c | option_c_image_ref | option_c_equation"),
  code("option_d | option_d_image_ref | option_d_equation"),
  code("correct_answer | explanation | explanation_image_ref | explanation_equation"),
  code("category | subject | topic | subtopic"),
  code("question_type | difficulty | source_tag | marks | negative_marks"),
  sep(),

  h2("Single Question DOCX Block"),
  code("QUESTION:"),
  code("Question: <text>  |  Question Image: <path>  |  Question Equation: <text>"),
  code("Option A: <text>  |  Option A Image: <path>  |  Option A Equation: <text>"),
  code("Option B / C / D: (same structure)"),
  code("Correct Answer: B"),
  code("Explanation: <text>  |  Explanation Image: <path>  |  Explanation Equation: <text>"),
  code("Category: X  |  Subject: X  |  Topic: X  |  Subtopic: X (opt)"),
  code("Question Type: MCQ  |  Difficulty: EASY / MEDIUM / HARD"),
  code("Source Tag: X (opt)  |  Marks: 2  |  Negative Marks: 0.5 (opt)"),
  code("END_QUESTION"),
  sep(),

  h2("Group / Paragraph DOCX Block"),
  code("GROUP_START: <group_id>"),
  code("PASSAGE: <full paragraph text>"),
  code("Passage Image: <path or inline image>  (optional)"),
  code("Passage Equation: <text>  (optional)"),
  code("CATEGORY: X  |  SUBJECT: X  |  TOPIC: X  |  SUBTOPIC: X (opt)"),
  code("QUESTION:  ...child question fields...  END_QUESTION   (repeat 2–10 times)"),
  code("GROUP_END"),
  sep(),

  h2("Image / Screenshot"),
  tbl(["Where","DOCX (inline)","CSV field"], [
    ["Question",       "Below: Question Image: label",    "question_image_ref"],
    ["Option A",       "Below: Option A Image: label",    "option_a_image_ref"],
    ["Explanation",    "Below: Explanation Image: label", "explanation_image_ref"],
    ["Group Passage",  "Below: Passage Image: label",     "passage_image_ref"],
  ]),
  goodNote("Screenshots accepted. Use PNG, crop tightly, min 600px wide."),
  warnNote("Blurry image → WARNING (imports but must fix before publishing)."),
  sep(),

  h2("Equation Quick-Lookup"),
  tbl(["Math","Plain-text"], [
    ["x²",     "x^2"],
    ["√16",    "sqrt(16)"],
    ["3/4",    "3/4"],
    ["|x|",    "|x|"],
    ["π",      "pi or π"],
    ["∑",      "sum or ∑"],
    ["≤ ≥ ≠",  "paste directly"],
    ["Cannot type it?", "Use _image_ref field instead"],
  ]),
  sep(),

  h2("Valid Values"),
  tbl(["Field","Valid Values"], [
    ["correct_answer", "A  /  B  /  C  /  D  (single uppercase letter)"],
    ["question_type",  "MCQ  /  TRUE_FALSE  (exact, case-sensitive)"],
    ["difficulty",     "EASY  /  MEDIUM  /  HARD  (exact, case-sensitive)"],
    ["marks",          "Positive decimal — never 0  (e.g. 1, 2, 1.5)"],
    ["negative_marks", "0 or positive decimal  (e.g. 0, 0.25, 0.5, 0.66)"],
  ]),
  sep(),

  h2("Top Mistakes"),
  bullet("1. Including section/subsection column — remove entirely"),
  bullet("2. Correct answer as 'option b' or '(B)' — must be exactly B"),
  bullet("3. difficulty as 'Medium' — must be MEDIUM"),
  bullet("4. marks = 0 — must be positive"),
  bullet("5. negative_marks = −0.25 — use positive 0.25"),
  bullet("6. Missing END_QUESTION — block silently skipped"),
  bullet("7. GROUP_START without GROUP_END — group discarded"),
  bullet("8. Only 1 child in group — minimum 2"),
  bullet("9. Image path in CSV not matching ZIP file name"),
  bullet("10. CSV not saved as UTF-8"),
], "saphala_quick_reference_UPDATED.docx");

// ─────────────────────────────────────────────────────────────────────────────
// 6. IMAGE / EQUATION GUIDE
// ─────────────────────────────────────────────────────────────────────────────

await save([
  h1("Saphala Self Prep — Image & Equation Reference Guide [UPDATED]"),
  p("Version 2.0  ·  March 2026  ·  For content team use"),
  sep(),

  h2("1. Where Images and Equations Can Be Used"),
  tbl(["Location","Image supported","Screenshot supported","Equation supported"], [
    ["Question text",        "Yes","Yes","Yes"],
    ["Option A / B / C / D", "Yes","Yes","Yes"],
    ["Explanation",          "Yes","Yes","Yes"],
    ["Shared passage (group)","Yes","Yes","Yes"],
  ]),
  sep(),

  h2("2. Screenshot Policy"),
  goodNote("Screenshots are explicitly supported and will NOT be rejected for being screenshots."),
  bullet("Accepted for: bar charts, pie charts, tables from Excel/PDF, seating diagrams, DI sets, maps."),
  bullet("Also accepted: math expressions photographed or screenshotted from textbook PDFs."),
  bold("Quality requirements:"),
  tbl(["Requirement","Minimum","Recommended"], [
    ["Image width",     "600px",          "1000px+"],
    ["File format",     "JPG / PNG",      "PNG (better for text)"],
    ["File size",       "—",              "Under 2 MB per image"],
    ["Text legibility", "Readable at 100% zoom","Crisp at 100% zoom"],
    ["Crop",            "Content visible","Tight crop, no browser chrome"],
  ]),
  p(""),
  bold("Good vs Bad screenshots:"),
  goodNote("Good: Cropped chart only, PNG, 1000px, no toolbar visible."),
  errNote("Bad: Full browser screenshot at 800px — chart too small to read."),
  goodNote("Good: Zoomed-in table where each cell is clearly readable."),
  errNote("Bad: Phone photo of printed page — skewed, low contrast, glare."),
  goodNote("Good: PDF equation screenshot zoomed in so symbols are distinct."),
  errNote("Bad: Handwritten equation photo without sufficient contrast."),
  warnNote("Unreadable images are imported but flagged as WARNINGs. Fix before publishing."),
  sep(),

  h2("3. Equation Plain-Text Notation"),
  tbl(["Concept","Plain-text","Rendered as"], [
    ["Power / exponent",  "x^2",              "x²"],
    ["Square root",       "sqrt(x)",          "√x"],
    ["Cube root",         "cbrt(x)",          "∛x"],
    ["Fraction",          "a/b",              "a÷b"],
    ["Absolute value",    "|x|",              "|x|"],
    ["Pi",                "pi or π",          "π"],
    ["Infinity",          "inf or ∞",         "∞"],
    ["Greek letters",     "alpha beta gamma", "α β γ"],
    ["Subscript",         "x_n  a_1",         "xₙ  a₁"],
    ["Superscript",       "x^n  e^x",         "xⁿ  eˣ"],
    ["Logarithm",         "log(x)  log_2(x)", "log x  log₂ x"],
    ["Trig",              "sin(x) cos(x)",    "sin x  cos x"],
    ["Inequality",        "≤  ≥  ≠",          "≤  ≥  ≠"],
    ["Summation",         "sum(i=1,n,i)",     "∑ᵢ₌₁ⁿ i"],
  ]),
  sep(),

  h2("4. When to Use Image Instead of Equation Text"),
  bullet("Multi-line equations with alignment (e.g. system of equations)."),
  bullet("Matrices and determinants."),
  bullet("Integrals, limits, and advanced calculus."),
  bullet("Any expression involving stacked fractions or nested roots."),
  bold("How to create an equation image:"),
  bullet("1. Type the equation in Microsoft Word using the Equation Editor.", 1),
  bullet("2. Or use Desmos, Wolfram Alpha, or an online LaTeX renderer.", 1),
  bullet("3. Screenshot or export as PNG.", 1),
  bullet("4. Reference using the _image_ref field (CSV) or insert inline (DOCX).", 1),
  bullet("5. Optionally also type the plain-text version in the equation field as alt-text.", 1),
  errNote("Do NOT paste raw LaTeX code (e.g. \\frac{a}{b}) — use plain-text notation or an image."),
  sep(),

  h2("5. File Naming Conventions"),
  tbl(["Context","Example filename"], [
    ["Question image",         "q001_question.png"],
    ["Option image",           "q001_opt_b.png"],
    ["Explanation image",      "q001_explanation.png"],
    ["Group passage image",    "g01_passage.png"],
    ["Passage annotated",      "g01_passage_annotated.png"],
    ["Equation screenshot",    "q003_equation.png"],
  ]),
  bullet("Lowercase letters only, underscores instead of spaces."),
  bullet("Include question/group reference number in the filename for traceability."),
  bullet("Keep all images in an images/ subfolder inside the ZIP."),
  sep(),

  h2("6. ZIP Archive Structure for CSV Uploads"),
  code("upload_batch_01.zip"),
  code("  ├─ questions.csv"),
  code("  └─ images/"),
  code("       ├─ q001_question.png"),
  code("       ├─ q001_explanation.png"),
  code("       ├─ q003_equation.png"),
  code("       └─ g01_passage.png"),
  bullet("CSV _image_ref values must match paths relative to the ZIP root."),
  bullet("Example: images/q001_question.png"),
  bullet("Image referenced in CSV but missing from ZIP → WARNING during preview."),
  sep(),

  h2("7. Future Planned Support"),
  p("The following are planned for future releases:", C.gray),
  bullet("DOCX inline images extracted and stored automatically by the parser."),
  bullet("LaTeX equation rendering natively in the student exam interface."),
  bullet("CSV image uploads without requiring a ZIP (direct per-question attachment)."),
  bullet("Automated image quality scoring to flag blurry content before commit."),
  note("Until these are available, use the current image_ref / inline DOCX approach described in this guide.", "eef2ff", "3730a3"),
], "saphala_image_equation_guide_UPDATED.docx");

console.log("\n✅ All 6 UPDATED files generated in public/downloads/");
