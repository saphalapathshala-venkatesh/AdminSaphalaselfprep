/**
 * Saphala Bulk Upload Template Generator — UPDATED (March 2026)
 * Rich Text + Image + Equation edition.
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

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  navy:"1e1b4b", blue:"3730a3", purple:"4f46e5", dark:"111827",
  gray:"6b7280", amber:"92400e", amberBg:"fefce8",
  greenBg:"f0fdf4", green:"166534", redBg:"fef2f2", red:"991b1b",
  slate:"f8fafc", lightPurple:"eef2ff",
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text:t, bold:true, color:C.navy })], spacing:{before:300,after:140} });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text:t, bold:true, color:C.blue })], spacing:{before:260,after:120} });
const h3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text:t, bold:true, color:C.purple })], spacing:{before:200,after:80} });
const p  = (t, color=C.dark) => new Paragraph({ children:[new TextRun({text:t,color})], spacing:{before:80,after:80} });
const b  = (t, color=C.dark) => new Paragraph({ children:[new TextRun({text:t,bold:true,color})], spacing:{before:80,after:60} });
const bl = (t, level=0, color=C.dark) => new Paragraph({ bullet:{level}, children:[new TextRun({text:t,color})], spacing:{before:50,after:50} });
const sep = () => new Paragraph({ border:{bottom:{style:BorderStyle.SINGLE,size:6,color:"c7d2fe"}}, spacing:{before:200,after:200}, children:[] });
const code = (t) => new Paragraph({ shading:{type:ShadingType.CLEAR,color:"auto",fill:"f1f5f9"}, children:[new TextRun({text:t,font:"Courier New",size:18,color:"1e293b"})], spacing:{before:80,after:80}, indent:{left:360} });
const lv  = (label, value) => new Paragraph({ children:[new TextRun({text:`${label}: `,bold:true,color:"374151"}), new TextRun({text:value,color:C.dark})], spacing:{before:60,after:60}, indent:{left:360} });
const note = (t, fill=C.amberBg, color=C.amber) => new Paragraph({ shading:{type:ShadingType.CLEAR,color:"auto",fill}, children:[new TextRun({text:t,size:18,color})], spacing:{before:100,after:100}, indent:{left:360,right:360} });
const goodNote = (t) => note("✓ "+t, C.greenBg, C.green);
const warnNote = (t) => note("⚠ "+t, C.amberBg, C.amber);
const errNote  = (t) => note("✗ "+t, C.redBg,   C.red);

const thCell = (t) => new TableCell({ shading:{type:ShadingType.CLEAR,color:"auto",fill:C.purple}, children:[new Paragraph({ children:[new TextRun({text:t,bold:true,color:"ffffff",size:18})], alignment:AlignmentType.CENTER })] });
const tdCell = (t, fill="ffffff") => new TableCell({ shading:{type:ShadingType.CLEAR,color:"auto",fill}, children:[new Paragraph({ children:[new TextRun({text:t,size:18,color:C.dark})] })] });
const tbl = (cols, rows) => new Table({
  width:{size:100,type:WidthType.PERCENTAGE},
  rows:[
    new TableRow({ tableHeader:true, children:cols.map(thCell) }),
    ...rows.map((r,i) => new TableRow({ children:r.map(c => tdCell(c, i%2===0?"f8f9ff":"ffffff")) })),
  ],
});
const save = async (children, filename) => {
  const doc = new Document({ sections:[{ children }] });
  const buf = await Packer.toBuffer(doc);
  writeFileSync(join(OUT, filename), buf);
  console.log(`✓ ${filename}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UPDATED CSV — SINGLE QUESTIONS (rich-text column names)
// ═══════════════════════════════════════════════════════════════════════════════

const csvRows = [
  // Header — rich_text variants
  [
    "question_rich_text","question_image_ref","question_equation",
    "option_a_rich_text","option_a_image_ref","option_a_equation",
    "option_b_rich_text","option_b_image_ref","option_b_equation",
    "option_c_rich_text","option_c_image_ref","option_c_equation",
    "option_d_rich_text","option_d_image_ref","option_d_equation",
    "correct_answer",
    "explanation_rich_text","explanation_image_ref","explanation_equation",
    "category","subject","topic","subtopic",
    "question_type","difficulty","source_tag","marks","negative_marks",
  ].join(","),

  // Row 1 — plain rich text (bold keyword example)
  [
    '"The ratio of the ages of A and B is <b>3:5</b>. If A is 18 years old, how old is B?"',"","",
    '"<b>24</b>"',"","",
    '"<b>30</b>"',"","",
    '"<b>36</b>"',"","",
    '"<b>42</b>"',"","",
    "B",
    '"If A = 18 and ratio is 3:5 then B = (18 ÷ 3) × 5 = <b>30 years</b>."',"","",
    "Banking","Quantitative Aptitude","Ratio and Proportion","Age Problems",
    "MCQ","EASY","SBI_PO_2023","1","0.25",
  ].join(","),

  // Row 2 — image / screenshot in question
  [
    '"Study the bar chart shown in the image. In which year was the export revenue highest?"',
    "images/bar_chart_export_2018_2023.png","",
    '"2018"',"","",
    '"2020"',"","",
    '"2021"',"","",
    '"2022"',"","",
    "C",
    '"As shown in the chart, 2021 recorded the tallest bar for export revenue."',
    "images/bar_chart_export_annotated.png","",
    "Banking","Data Interpretation","Bar Charts","Export Revenue",
    "MCQ","MEDIUM","IBPS_PO_2022","2","0.5",
  ].join(","),

  // Row 3 — equation in question and options
  [
    '"Solve: if x² − 5x + 6 = 0, what are the roots?"',"",
    "x^2 - 5x + 6 = 0",
    '"x = 1 and x = 6"',"","x=1, x=6",
    '"x = 2 and x = 3"',"","x=2, x=3",
    '"x = −2 and x = −3"',"","x=-2, x=-3",
    '"x = 3 and x = 4"',"","x=3, x=4",
    "B",
    '"Factorising: (x−2)(x−3) = 0, so x = 2 or x = 3."',"","(x-2)(x-3) = 0",
    "Banking","Quantitative Aptitude","Algebra","Quadratic Equations",
    "MCQ","HARD","SBI_PO_2024","2","0.66",
  ].join(","),
];
writeFileSync(join(OUT, "saphala_bulk_upload_single_questions_UPDATED.csv"), csvRows.join("\n"), "utf8");
console.log("✓ saphala_bulk_upload_single_questions_UPDATED.csv");

// ═══════════════════════════════════════════════════════════════════════════════
// 2. UPDATED DOCX — SINGLE QUESTION TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

await save([
  h1("Saphala Self Prep — Single Question Upload Template [UPDATED]"),
  p("Version 3.0  ·  March 2026  ·  Rich Text + Images + Screenshots + Equations"),
  p("Do NOT include Section or Subsection. These are selected in the admin UI before uploading."),
  sep(),

  h2("Upload Workflow"),
  bl("1. Open Test Builder → navigate to the target test."),
  bl("2. Select the Section where questions will be added."),
  bl("3. If the section has subsections, select the correct Subsection."),
  bl("4. Click Add Questions → Bulk Upload Questions."),
  bl("5. Upload this DOCX file (and a ZIP with any referenced images)."),
  bl("6. Review the preview — check errors and warnings."),
  bl("7. Commit to save questions into the selected section/subsection."),
  note("Section and Subsection are NEVER columns in any upload file.", "eef2ff", "3730a3"),
  sep(),

  h2("Rich Content Rules"),
  bl("question_rich_text, option_a/b/c/d_rich_text, explanation_rich_text may contain:"),
  bl("Formatted text — bold, italic using HTML tags: <b>bold</b> <i>italic</i>", 1),
  bl("Image references — use the matching _image_ref column or inline images in DOCX", 1),
  bl("Equation markers — use the matching _equation column for math expressions", 1),
  bl("Screenshots — treated as regular images; not rejected for being screenshots", 1),
  sep(),

  h2("Image and Screenshot Rules"),
  goodNote("Screenshots are explicitly supported. They are NOT rejected for being screenshots."),
  bl("Formats: PNG, JPG, JPEG, GIF, WEBP."),
  bl("Minimum readable width: 600px. Recommended: 1000px+. Max size: 2 MB per image."),
  bl("DOCX: insert inline below the relevant label line (Question Image:, Option A Image:, etc.)"),
  bl("CSV: enter a relative path in the _image_ref column — images/q001_chart.png"),
  bl("All referenced images must be included in a ZIP alongside the CSV."),
  bl("Crop screenshots tightly — remove browser chrome, toolbars, unrelated content."),
  bl("Use PNG format for text-heavy screenshots (sharper text than JPEG)."),
  warnNote("Blurry or unreadable images are imported but flagged as WARNINGs. Fix before publishing."),
  sep(),

  h2("Equation Rules"),
  bl("Use plain-text math notation in the _equation column:"),
  bl("x^2 + 5x - 6 = 0  →  x squared plus 5x minus 6", 1),
  bl("sqrt(144) = 12     →  square root of 144", 1),
  bl("3/4 + 1/2 = 5/4    →  fractions", 1),
  bl("sin(x) cos(x)       →  trigonometry", 1),
  bl("If the equation is too complex to type, insert it as a screenshot in the _image_ref column."),
  warnNote("Do NOT paste raw LaTeX code (e.g. \\frac{a}{b}) — use plain-text notation or an image."),
  sep(),

  h2("Example 1 — Rich Text Question (bold formatting)"),
  code("QUESTION:"),
  lv("Question Rich Text", "The ratio of the ages of A and B is <b>3:5</b>. If A is 18, how old is B?"),
  lv("Question Image",     "(leave blank)"),
  lv("Question Equation",  "(leave blank)"),
  lv("Option A Rich Text", "<b>24</b>"),  lv("Option A Image", "(leave blank)"),  lv("Option A Equation", "(leave blank)"),
  lv("Option B Rich Text", "<b>30</b>"),  lv("Option B Image", "(leave blank)"),  lv("Option B Equation", "(leave blank)"),
  lv("Option C Rich Text", "<b>36</b>"),  lv("Option C Image", "(leave blank)"),  lv("Option C Equation", "(leave blank)"),
  lv("Option D Rich Text", "<b>42</b>"),  lv("Option D Image", "(leave blank)"),  lv("Option D Equation", "(leave blank)"),
  lv("Correct Answer",     "B"),
  lv("Explanation Rich Text", "If A = 18 and ratio is 3:5 then B = (18 ÷ 3) × 5 = <b>30 years</b>."),
  lv("Explanation Image",  "(leave blank)"),
  lv("Explanation Equation","(leave blank)"),
  lv("Category","Banking"),  lv("Subject","Quantitative Aptitude"),
  lv("Topic","Ratio and Proportion"),  lv("Subtopic","Age Problems"),
  lv("Question Type","MCQ"),  lv("Difficulty","EASY"),
  lv("Source Tag","SBI_PO_2023"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  sep(),

  h2("Example 2 — Question with Screenshot (Data Interpretation)"),
  code("QUESTION:"),
  lv("Question Rich Text", "Study the bar chart shown below. In which year was export revenue highest?"),
  lv("Question Image",     "images/bar_chart_export_2018_2023.png"),
  p("        ↑ In DOCX: insert screenshot inline here, below this label line.", C.gray),
  lv("Question Equation",  "(leave blank)"),
  lv("Option A Rich Text", "2018"),  lv("Option A Image","(leave blank)"),  lv("Option A Equation","(leave blank)"),
  lv("Option B Rich Text", "2020"),  lv("Option B Image","(leave blank)"),  lv("Option B Equation","(leave blank)"),
  lv("Option C Rich Text", "2021"),  lv("Option C Image","(leave blank)"),  lv("Option C Equation","(leave blank)"),
  lv("Option D Rich Text", "2022"),  lv("Option D Image","(leave blank)"),  lv("Option D Equation","(leave blank)"),
  lv("Correct Answer",     "C"),
  lv("Explanation Rich Text","As shown in the chart, 2021 recorded the highest export revenue bar."),
  lv("Explanation Image",  "images/bar_chart_export_annotated.png"),
  lv("Explanation Equation","(leave blank)"),
  lv("Category","Banking"),  lv("Subject","Data Interpretation"),
  lv("Topic","Bar Charts"),  lv("Subtopic","Export Revenue"),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),
  lv("Source Tag","IBPS_PO_2022"),  lv("Marks","2"),  lv("Negative Marks","0.5"),
  code("END_QUESTION"),
  sep(),

  h2("Example 3 — Question with Equation (Algebra)"),
  code("QUESTION:"),
  lv("Question Rich Text", "Solve: if x² − 5x + 6 = 0, what are the roots?"),
  lv("Question Image",     "(leave blank)"),
  lv("Question Equation",  "x^2 - 5x + 6 = 0"),
  lv("Option A Rich Text", "x = 1 and x = 6"),  lv("Option A Image","(leave blank)"),  lv("Option A Equation","x=1, x=6"),
  lv("Option B Rich Text", "x = 2 and x = 3"),  lv("Option B Image","(leave blank)"),  lv("Option B Equation","x=2, x=3"),
  lv("Option C Rich Text", "x = −2 and x = −3"), lv("Option C Image","(leave blank)"),  lv("Option C Equation","x=-2, x=-3"),
  lv("Option D Rich Text", "x = 3 and x = 4"),  lv("Option D Image","(leave blank)"),  lv("Option D Equation","x=3, x=4"),
  lv("Correct Answer",     "B"),
  lv("Explanation Rich Text","Factorising: (x−2)(x−3) = 0, so x = 2 or x = 3."),
  lv("Explanation Image",  "(leave blank)"),
  lv("Explanation Equation","(x-2)(x-3) = 0"),
  lv("Category","Banking"),  lv("Subject","Quantitative Aptitude"),
  lv("Topic","Algebra"),     lv("Subtopic","Quadratic Equations"),
  lv("Question Type","MCQ"),  lv("Difficulty","HARD"),
  lv("Source Tag","SBI_PO_2024"),  lv("Marks","2"),  lv("Negative Marks","0.66"),
  code("END_QUESTION"),
  sep(),

  h2("Field Reference"),
  tbl(["Field","Required","Rich Text","Image","Equation","Notes"], [
    ["question_rich_text",       "MANDATORY","Yes — HTML tags","Question Image field","Question Equation field","Full question stem"],
    ["option_a/b/c/d_rich_text", "MANDATORY","Yes","Option X Image field","Option X Equation field","Each option has its own image and equation field"],
    ["correct_answer",           "MANDATORY","—","—","—","Exactly A, B, C, or D — uppercase"],
    ["explanation_rich_text",    "optional", "Yes","Explanation Image","Explanation Equation","Shown after answer reveal"],
    ["category",                 "MANDATORY","—","—","—","Top-level taxonomy"],
    ["subject",                  "MANDATORY","—","—","—","Second-level taxonomy"],
    ["topic",                    "MANDATORY","—","—","—","Third-level taxonomy"],
    ["subtopic",                 "optional", "—","—","—","Fourth-level taxonomy"],
    ["question_type",            "MANDATORY","—","—","—","MCQ or TRUE_FALSE (exact)"],
    ["difficulty",               "MANDATORY","—","—","—","EASY, MEDIUM, or HARD (exact)"],
    ["source_tag",               "optional", "—","—","—","e.g. SBI_PO_2023"],
    ["marks",                    "MANDATORY","—","—","—","Positive decimal — never 0"],
    ["negative_marks",           "optional", "—","—","—","0 or positive decimal; default 0"],
  ]),
], "saphala_single_question_template_UPDATED.docx");

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UPDATED DOCX — GROUP / PARAGRAPH TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

await save([
  h1("Saphala Self Prep — Group / Paragraph Question Template [UPDATED]"),
  p("Version 3.0  ·  March 2026  ·  Rich Text + Images + Screenshots + Equations in passage and children"),
  p("Do NOT include Section or Subsection — selected in admin UI before uploading."),
  sep(),

  h2("Group Structure Rules"),
  bl("Every group starts with GROUP_START: <identifier> and ends with GROUP_END."),
  bl("The shared paragraph/passage follows PASSAGE:."),
  bl("PASSAGE may contain rich text (HTML), an image/screenshot, and/or an equation."),
  bl("CATEGORY / SUBJECT / TOPIC set once at group level and inherited by all children."),
  bl("Each child question uses QUESTION: / END_QUESTION with its own Marks and Negative Marks."),
  bl("Minimum 2, maximum 10 child questions per group."),
  bl("Standalone questions may appear before or after any group."),
  bl("Paragraph images are shown once above all child questions."),
  sep(),

  h2("Rich Content in Groups"),
  bl("PASSAGE text may include bold/italic HTML formatting."),
  bl("PASSAGE may include an image or screenshot below the Passage Image: label."),
  bl("PASSAGE may include an equation in the Passage Equation: field."),
  bl("Each child question's Question Rich Text, options, and explanation all support rich content."),
  goodNote("Screenshots in passages are supported. Crop to the relevant content for best readability."),
  sep(),

  h2("Example 1 — Reading Comprehension with Rich Text Passage"),
  code("GROUP_START: RC_GROUP_RBI_01"),
  code("PASSAGE:"),
  new Paragraph({
    shading:{type:ShadingType.CLEAR,color:"auto",fill:"f0f9ff"},
    children:[new TextRun({text:"The <b>Reserve Bank of India (RBI)</b> was established on <b>1 April 1935</b> under the Reserve Bank of India Act, 1934. It serves as the <i>central bank</i> of India and is responsible for the issue and supply of the Indian rupee, the regulation of the banking system, and management of foreign exchange reserves under FEMA. Its headquarters is in <b>Mumbai</b>.",size:18,color:"1e3a5f"})],
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
  lv("Question Rich Text","When was the <b>RBI</b> established?"),
  lv("Option A Rich Text","<b>1 April 1935</b>"),
  lv("Option B Rich Text","1 January 1949"),
  lv("Option C Rich Text","26 January 1950"),
  lv("Option D Rich Text","15 August 1947"),
  lv("Correct Answer","A"),
  lv("Explanation Rich Text","The RBI was established on <b>1 April 1935</b> under the RBI Act, 1934."),
  lv("Question Type","MCQ"),  lv("Difficulty","EASY"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  p(""),
  code("QUESTION:"),
  lv("Question Rich Text","Under which Act does the RBI manage India's <i>foreign exchange reserves</i>?"),
  lv("Option A Rich Text","RBI Act, 1934"),
  lv("Option B Rich Text","Banking Regulation Act, 1949"),
  lv("Option C Rich Text","<b>Foreign Exchange Management Act (FEMA)</b>"),
  lv("Option D Rich Text","Securities Contracts Regulation Act"),
  lv("Correct Answer","C"),
  lv("Explanation Rich Text","FEMA governs foreign exchange management; the RBI is the implementing body."),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  p(""),
  code("QUESTION:"),
  lv("Question Rich Text","Where is the <b>RBI headquarters</b> located?"),
  lv("Option A Rich Text","New Delhi"),
  lv("Option B Rich Text","Kolkata"),
  lv("Option C Rich Text","Chennai"),
  lv("Option D Rich Text","<b>Mumbai</b>"),
  lv("Correct Answer","D"),
  lv("Explanation Rich Text","The RBI headquarters is in <b>Mumbai</b>, Maharashtra."),
  lv("Question Type","MCQ"),  lv("Difficulty","EASY"),  lv("Marks","1"),  lv("Negative Marks","0.25"),
  code("END_QUESTION"),
  code("GROUP_END"),
  sep(),

  h2("Example 2 — DI Group with Screenshot Passage and Equation"),
  code("GROUP_START: DI_GROUP_EXPORT_01"),
  code("PASSAGE:"),
  lv("Passage Rich Text","Study the bar chart below showing India's <b>export revenues (₹ crore)</b> from 2018 to 2023, then answer the questions."),
  lv("Passage Image","images/di_bar_chart_export_2018_2023.png"),
  p("        ↑ In DOCX: insert screenshot inline here below this label.", C.gray),
  lv("Passage Equation","(leave blank)"),
  code("CATEGORY: Banking"),
  code("SUBJECT: Data Interpretation"),
  code("TOPIC: Bar Charts"),
  code("SUBTOPIC: Export Revenue"),
  p(""),
  code("QUESTION:"),
  lv("Question Rich Text","In which year was export revenue <b>highest</b>?"),
  lv("Question Image","(leave blank — passage image already shows chart)"),
  lv("Option A Rich Text","2018"),  lv("Option B Rich Text","2020"),
  lv("Option C Rich Text","<b>2021</b>"),  lv("Option D Rich Text","2022"),
  lv("Correct Answer","C"),
  lv("Explanation Rich Text","The tallest bar in the chart corresponds to <b>2021</b>."),
  lv("Explanation Image","images/di_bar_chart_export_annotated.png"),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),  lv("Marks","2"),  lv("Negative Marks","0.5"),
  code("END_QUESTION"),
  p(""),
  code("QUESTION:"),
  lv("Question Rich Text","What is the approximate ratio of export revenue in 2019 to 2022?"),
  lv("Question Equation","Revenue_2019 / Revenue_2022 = ?"),
  lv("Option A Rich Text","2 : 3"),  lv("Option B Rich Text","<b>3 : 5</b>"),
  lv("Option C Rich Text","4 : 7"),  lv("Option D Rich Text","1 : 2"),
  lv("Correct Answer","B"),
  lv("Explanation Rich Text","Reading from the chart: 2019 ≈ 3 units, 2022 ≈ 5 units → ratio <b>3:5</b>."),
  lv("Question Type","MCQ"),  lv("Difficulty","HARD"),  lv("Marks","2"),  lv("Negative Marks","0.66"),
  code("END_QUESTION"),
  code("GROUP_END"),
  sep(),

  h2("Standalone Question After Group"),
  p("Standalone questions use QUESTION: / END_QUESTION outside any group:", C.gray),
  code("QUESTION:"),
  lv("Question Rich Text","Which of the following is <b>NOT</b> a function of the RBI?"),
  lv("Option A Rich Text","Issuing currency notes"),
  lv("Option B Rich Text","Regulating commercial banks"),
  lv("Option C Rich Text","<b>Collecting direct taxes</b>"),
  lv("Option D Rich Text","Acting as the government's banker"),
  lv("Correct Answer","C"),
  lv("Explanation Rich Text","Collecting direct taxes is done by the Income Tax Department, <i>not</i> the RBI."),
  lv("Category","Banking"),  lv("Subject","General Awareness"),
  lv("Topic","Indian Banking System"),  lv("Subtopic","RBI"),
  lv("Question Type","MCQ"),  lv("Difficulty","MEDIUM"),
  lv("Marks","2"),  lv("Negative Marks","0.5"),
  code("END_QUESTION"),
  sep(),

  h2("Group Field Reference"),
  tbl(["Field","Required","Rich Text","Image","Equation","Notes"], [
    ["GROUP_START",       "MANDATORY","—","—","—","Marks start; include short identifier"],
    ["PASSAGE",          "MANDATORY","Yes — HTML formatting","Passage Image field","Passage Equation field","Shared text written once"],
    ["Passage Image",    "optional", "—","Yes — screenshot or chart","—","Shown above all child questions"],
    ["Passage Equation", "optional", "—","—","Yes","Shared equation for the entire set"],
    ["CATEGORY/SUBJECT/TOPIC","MANDATORY","—","—","—","Set once; inherited by all children"],
    ["SUBTOPIC",         "optional", "—","—","—","Set once at group level"],
    ["QUESTION block",   "≥2 MANDATORY","Yes","Per-child image fields","Per-child equation fields","Full child question format"],
    ["Marks",            "MANDATORY per child","—","—","—","May differ across children"],
    ["Negative Marks",   "optional per child","—","—","—","Defaults to 0 if omitted"],
    ["GROUP_END",        "MANDATORY","—","—","—","Marks end of group"],
  ]),
], "saphala_group_question_template_UPDATED.docx");

// ═══════════════════════════════════════════════════════════════════════════════
// 4. UPDATED IMPORT RULES
// ═══════════════════════════════════════════════════════════════════════════════

await save([
  h1("Saphala Self Prep — Import Rules [UPDATED]"),
  p("Version 3.0  ·  March 2026  ·  Covers rich text, images, screenshots, and equations"),
  sep(),

  h2("A. Upload Workflow"),
  b("Mandatory steps before uploading:"),
  bl("1. Open Test Builder → navigate to the target test."),
  bl("2. Select the Section where questions will be added."),
  bl("3. If that section has subsections, select the correct Subsection."),
  bl("4. Click Add Questions → choose Add Single Question or Bulk Upload Questions."),
  bl("5. For bulk: attach your CSV or DOCX (plus images ZIP if using image references)."),
  bl("6. Review the preview panel — check all errors and warnings before committing."),
  bl("7. Click Commit to save questions into the selected section/subsection."),
  note("Section and Subsection are NEVER columns in any upload file.", "eef2ff", "3730a3"),
  sep(),

  h2("B. CSV Upload"),
  h3("B1. File format"),
  bl("UTF-8 encoded .csv, first row is the header, one question per data row."),
  bl("Column names must exactly match the template header."),
  bl("Values containing commas or double-quotes must be wrapped in double-quotes."),
  bl("Maximum 500 questions per CSV file."),
  h3("B2. Rich text in CSV"),
  bl("The _rich_text columns accept plain text or HTML."),
  bl("Supported tags: <b>bold</b>  <i>italic</i>  <u>underline</u>  <br> line break."),
  bl("Images embedded directly into rich text are NOT supported in CSV — use _image_ref columns instead."),
  h3("B3. Image references in CSV"),
  bl("Use _image_ref columns: question_image_ref, option_a_image_ref, explanation_image_ref, etc."),
  bl("Values are relative paths inside the ZIP: images/q001_chart.png"),
  bl("All referenced images must be included in a ZIP alongside the CSV."),
  bl("Leave _image_ref empty when no image is needed."),
  goodNote("Screenshot files are accepted exactly like any other image — no special handling required."),
  h3("B4. Equations in CSV"),
  bl("Use _equation columns for math content alongside (or instead of) rich text."),
  bl("Write equations in plain-text notation: x^2 + 3x - 4 = 0, sqrt(144), 3/4."),
  bl("Both an equation and an image_ref may be provided for the same field."),
  code("ZIP structure for CSV uploads:"),
  code("  upload_batch.zip"),
  code("    ├─ questions.csv"),
  code("    └─ images/"),
  code("         ├─ q001_question.png"),
  code("         └─ g01_passage_chart.png"),
  sep(),

  h2("C. DOCX Upload"),
  h3("C1. Single question DOCX"),
  bl("Delimit each question with QUESTION: and END_QUESTION."),
  bl("Field labels are case-sensitive: Question Rich Text:, Option A Rich Text:, etc."),
  bl("Rich text: type HTML tags directly in the field value, or use native DOCX bold/italic."),
  bl("Images: insert inline in the DOCX directly below the relevant label line."),
  bl("Equations: type using plain-text notation in the _equation field, or insert as inline image."),
  bl("Maximum 200 questions per DOCX file."),
  h3("C2. Group DOCX"),
  bl("GROUP_START: <id> and GROUP_END are mandatory boundary markers."),
  bl("PASSAGE: declares the shared text (may contain HTML formatting)."),
  bl("Passage Image: and Passage Equation: are optional."),
  bl("Taxonomy set once at group level; Marks / Negative Marks per child."),
  bl("Minimum 2, maximum 10 child questions per group."),
  sep(),

  h2("D. Image Usage"),
  bl("Images can appear in: Question, Paragraph/Passage, Options (A/B/C/D), Explanation."),
  tbl(["Location","DOCX label","CSV column"], [
    ["Question",       "Question Image:",    "question_image_ref"],
    ["Option A",       "Option A Image:",    "option_a_image_ref"],
    ["Option B",       "Option B Image:",    "option_b_image_ref"],
    ["Option C",       "Option C Image:",    "option_c_image_ref"],
    ["Option D",       "Option D Image:",    "option_d_image_ref"],
    ["Explanation",    "Explanation Image:", "explanation_image_ref"],
    ["Group Passage",  "Passage Image:",     "passage_image_ref"],
  ]),
  sep(),

  h2("E. Screenshot Usage"),
  goodNote("Screenshots are explicitly supported and will NOT be rejected for being screenshots."),
  bl("Accepted for: charts, tables, graphs, DI sets, seating arrangements, math from PDFs."),
  bl("Best practices:"),
  bl("Crop tightly — remove browser chrome, toolbars, and unrelated content.", 1),
  bl("Use PNG format for text-heavy screenshots (sharper than JPEG).", 1),
  bl("Minimum readable width: 600px. Recommended: 1000px+.", 1),
  bl("For math: zoom in before screenshotting so symbols are distinct.", 1),
  warnNote("An image with unreadable text imports but is flagged as a WARNING. Fix before publishing."),
  sep(),

  h2("F. Equation Usage"),
  bl("Equations can appear in: Question, Paragraph/Passage, Options, Explanation."),
  tbl(["Location","DOCX label","CSV column"], [
    ["Question",    "Question Equation:",    "question_equation"],
    ["Option A",    "Option A Equation:",    "option_a_equation"],
    ["Option B",    "Option B Equation:",    "option_b_equation"],
    ["Option C",    "Option C Equation:",    "option_c_equation"],
    ["Option D",    "Option D Equation:",    "option_d_equation"],
    ["Explanation", "Explanation Equation:", "explanation_equation"],
    ["Group Passage","Passage Equation:",    "passage_equation"],
  ]),
  h3("F1. Plain-text notation"),
  tbl(["Math","Plain-text","Example"], [
    ["x²",      "x^2",      "x^2 + 5x - 6 = 0"],
    ["√16",     "sqrt(16)", "sqrt(144) = 12"],
    ["3/4",     "3/4",      "3/4 + 1/2 = 5/4"],
    ["|x|",     "|x|",      "|x - 3| = 5"],
    ["π",       "pi or π",  "Area = pi × r^2"],
    ["∑",       "sum or ∑", "∑(i=1 to n) i"],
    ["≤ ≥ ≠",   "≤ ≥ ≠",    "x ≤ 10 and y ≥ 0"],
    ["log₂ x",  "log_2(x)", "log_2(8) = 3"],
    ["sin x",   "sin(x)",   "sin(30°) = 0.5"],
  ]),
  sep(),

  h2("G. Marks Rules"),
  bl("marks must be a positive decimal — never 0."),
  bl("Different questions in the same upload may carry different marks values."),
  bl("Typical values: 1, 2, 1.5, 2.5."),
  sep(),

  h2("H. Negative Marks Rules"),
  bl("negative_marks must be 0 or a positive decimal. Default: 0 if omitted."),
  bl("Typical values: 0.25, 0.33, 0.5, 0.66, 1."),
  bl("Do NOT use a minus sign — write 0.25, not -0.25."),
  sep(),

  h2("I. Taxonomy Rules"),
  bl("Category, Subject, and Topic must exist or will be auto-created if the setting allows."),
  bl("Subtopic is always optional and always auto-created if absent."),
  bl("Matching is case-insensitive; canonical casing from the database is preserved."),
  sep(),

  h2("J. Common Errors"),
  errNote("Including section or subsection column — remove entirely"),
  errNote("correct_answer written as 'option b' or '(B)' — must be exactly B"),
  errNote("difficulty written as 'Medium' — must be MEDIUM"),
  errNote("marks set to 0 — must be positive"),
  errNote("negative_marks set to -0.25 — use positive 0.25"),
  errNote("Missing END_QUESTION — block silently skipped"),
  errNote("GROUP_START without GROUP_END — group discarded"),
  errNote("Only 1 child question in group — minimum 2"),
  errNote("Image path in CSV not matching ZIP file name"),
  errNote("CSV not saved as UTF-8"),
  sep(),

  h2("K. Blocking Errors vs Warnings"),
  b("Blocking Errors — must fix before committing:"),
  bl("Missing mandatory field (question_rich_text, options, correct_answer, category, subject, topic, question_type, difficulty, marks)"),
  bl("correct_answer not exactly A, B, C, or D"),
  bl("difficulty not EASY, MEDIUM, or HARD"),
  bl("question_type not MCQ or TRUE_FALSE"),
  bl("marks is 0 or negative"),
  bl("negative_marks is negative"),
  bl("Unclosed GROUP_START"),
  bl("Group with fewer than 2 child questions"),
  bl("Exact duplicate (content hash already in question bank)"),
  p(""),
  b("Warnings — review recommended, upload can proceed:"),
  bl("Taxonomy node missing (auto-create off)"),
  bl("explanation missing"),
  bl("subtopic missing"),
  bl("source_tag missing"),
  bl("Image file referenced but not found in ZIP"),
  bl("Image appears unreadable (low resolution)"),
  bl("Question is ≥ 85% similar to existing question"),
], "saphala_import_rules_UPDATED.docx");

// ═══════════════════════════════════════════════════════════════════════════════
// 5. UPDATED QUICK REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

await save([
  h1("Saphala Self Prep — Quick Reference [UPDATED]"),
  p("Version 3.0  ·  March 2026  ·  Rich Text + Images + Screenshots + Equations"),
  sep(),

  h2("Workflow"),
  new Paragraph({ shading:{type:ShadingType.CLEAR,color:"auto",fill:"eef2ff"}, children:[new TextRun({text:"Test Builder → Select Section → (Subsection if exists) → Add Questions → Bulk Upload",bold:true,size:20,color:"3730a3"})], spacing:{before:120,after:120}, indent:{left:360,right:360} }),
  note("Section / Subsection are NEVER in the upload file.", "eef2ff", "3730a3"),
  sep(),

  h2("CSV Columns (in order)"),
  code("question_rich_text | question_image_ref | question_equation"),
  code("option_a_rich_text | option_a_image_ref | option_a_equation"),
  code("option_b_rich_text | option_b_image_ref | option_b_equation"),
  code("option_c_rich_text | option_c_image_ref | option_c_equation"),
  code("option_d_rich_text | option_d_image_ref | option_d_equation"),
  code("correct_answer"),
  code("explanation_rich_text | explanation_image_ref | explanation_equation"),
  code("category | subject | topic | subtopic"),
  code("question_type | difficulty | source_tag | marks | negative_marks"),
  sep(),

  h2("Single Question DOCX Block"),
  code("QUESTION:"),
  code("Question Rich Text: <text or HTML>  |  Question Image: <path>  |  Question Equation: <text>"),
  code("Option A Rich Text: <text>  |  Option A Image: <path>  |  Option A Equation: <text>"),
  code("Option B/C/D: (same structure)"),
  code("Correct Answer: B"),
  code("Explanation Rich Text: <text>  |  Explanation Image: <path>  |  Explanation Equation: <text>"),
  code("Category: X  |  Subject: X  |  Topic: X  |  Subtopic: X (opt)"),
  code("Question Type: MCQ  |  Difficulty: EASY / MEDIUM / HARD"),
  code("Source Tag: X (opt)  |  Marks: 2  |  Negative Marks: 0.5 (opt)"),
  code("END_QUESTION"),
  sep(),

  h2("Group / Paragraph DOCX Block"),
  code("GROUP_START: <group_id>"),
  code("PASSAGE: <rich text — HTML formatting allowed>"),
  code("Passage Image: <path or inline>  (optional)"),
  code("Passage Equation: <text>  (optional)"),
  code("CATEGORY: X  |  SUBJECT: X  |  TOPIC: X  |  SUBTOPIC: X (opt)"),
  code("QUESTION: ... rich child question ... END_QUESTION   (2–10 times)"),
  code("GROUP_END"),
  sep(),

  h2("Rich Text Formatting"),
  tbl(["Format","HTML tag","Example"], [
    ["Bold",      "<b>…</b>",   "<b>RBI was founded in 1935</b>"],
    ["Italic",    "<i>…</i>",   "<i>foreign exchange</i>"],
    ["Underline", "<u>…</u>",   "<u>key term</u>"],
    ["Line break","<br>",       "Line one<br>Line two"],
  ]),
  sep(),

  h2("Image / Screenshot"),
  tbl(["Where","DOCX (inline)","CSV field"], [
    ["Question",       "Below: Question Image: label",    "question_image_ref"],
    ["Option A/B/C/D", "Below: Option X Image: label",    "option_X_image_ref"],
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
    ["Complex equation?","Use _image_ref field instead"],
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
  bl("1. Section/subsection column included — remove entirely"),
  bl("2. Correct answer as 'option b' or '(B)' — must be exactly B"),
  bl("3. difficulty as 'Medium' — must be MEDIUM"),
  bl("4. marks = 0 — must be positive"),
  bl("5. negative_marks = −0.25 — use positive 0.25"),
  bl("6. Missing END_QUESTION — block silently skipped"),
  bl("7. GROUP_START without GROUP_END — group discarded"),
  bl("8. Only 1 child in group — minimum 2"),
  bl("9. Image path in CSV not matching ZIP file name"),
  bl("10. CSV not saved as UTF-8"),
], "saphala_quick_reference_UPDATED.docx");

// ═══════════════════════════════════════════════════════════════════════════════
// 6. IMAGE & EQUATION REFERENCE GUIDE
// ═══════════════════════════════════════════════════════════════════════════════

await save([
  h1("Saphala Self Prep — Image & Equation Reference Guide [UPDATED]"),
  p("Version 3.0  ·  March 2026  ·  Rich content in all question fields"),
  sep(),

  h2("1. Where Rich Content Is Supported"),
  tbl(["Location","Rich Text","Image","Screenshot","Equation"], [
    ["Question text",         "Yes","Yes","Yes","Yes"],
    ["Option A / B / C / D",  "Yes","Yes","Yes","Yes"],
    ["Explanation",           "Yes","Yes","Yes","Yes"],
    ["Shared passage (group)","Yes","Yes","Yes","Yes"],
  ]),
  sep(),

  h2("2. Screenshot Policy"),
  goodNote("Screenshots are explicitly supported and will NOT be rejected for being screenshots."),
  bl("Accepted for: bar charts, pie charts, tables from Excel/PDF, DI sets, seating diagrams, math from textbooks."),
  b("Quality requirements:"),
  tbl(["Requirement","Minimum","Recommended"], [
    ["Image width",      "600px",          "1000px+"],
    ["File format",      "JPG / PNG",      "PNG (better for text)"],
    ["File size",        "—",              "Under 2 MB"],
    ["Text legibility",  "Readable at 100% zoom","Crisp at 100% zoom"],
    ["Crop",             "Content visible","Tight crop, no browser chrome"],
  ]),
  p(""),
  b("Good vs bad screenshots:"),
  goodNote("Good: Cropped chart only, PNG, 1000px, no toolbar visible."),
  errNote("Bad: Full browser screenshot at 800px — chart too small to read."),
  goodNote("Good: Zoomed-in table where each cell is clearly readable."),
  errNote("Bad: Phone photo of printed page — skewed, low contrast, glare."),
  goodNote("Good: Screenshot of PDF equation, zoomed in, symbols distinct."),
  errNote("Bad: Handwritten equation without sufficient contrast."),
  warnNote("Unreadable images are imported but flagged as WARNINGs. Fix before publishing."),
  sep(),

  h2("3. Rich Text Formatting Reference"),
  tbl(["Effect","Tag","Example input","Rendered output"], [
    ["Bold",      "<b>…</b>",   "<b>RBI established in 1935</b>",     "RBI established in 1935 (bold)"],
    ["Italic",    "<i>…</i>",   "The <i>central bank</i> of India",   "central bank (italic)"],
    ["Underline", "<u>…</u>",   "<u>key term</u>",                    "key term (underlined)"],
    ["Line break","<br>",       "Line one<br>Line two",               "Two lines displayed"],
    ["Combined",  "nesting",    "<b><i>bold italic</i></b>",          "bold italic"],
  ]),
  sep(),

  h2("4. Equation Plain-Text Notation"),
  tbl(["Concept","Plain-text","Rendered as"], [
    ["Power / exponent",  "x^2",              "x²"],
    ["Square root",       "sqrt(x)",          "√x"],
    ["Cube root",         "cbrt(x)",          "∛x"],
    ["Fraction",          "a/b",              "a÷b"],
    ["Absolute value",    "|x|",              "|x|"],
    ["Pi",                "pi or π",          "π"],
    ["Infinity",          "inf or ∞",         "∞"],
    ["Greek letters",     "alpha beta theta", "α β θ"],
    ["Subscript",         "x_n  a_1",         "xₙ  a₁"],
    ["Superscript",       "x^n  e^x",         "xⁿ  eˣ"],
    ["Logarithm",         "log(x)  log_2(x)", "log x  log₂ x"],
    ["Trig",              "sin(x) cos(x)",    "sin x  cos x"],
    ["Inequality",        "≤  ≥  ≠",          "≤  ≥  ≠"],
    ["Summation",         "sum(i=1,n,i)",     "∑ᵢ₌₁ⁿ i"],
  ]),
  sep(),

  h2("5. When to Use Image Instead of Equation Text"),
  bl("Multi-line equations with alignment (system of equations)."),
  bl("Matrices and determinants."),
  bl("Integrals, limits, and advanced calculus."),
  bl("Any expression with stacked fractions or nested roots."),
  b("How to create an equation image:"),
  bl("1. Type in Microsoft Word Equation Editor, Desmos, or Wolfram Alpha.", 1),
  bl("2. Screenshot or export as PNG.", 1),
  bl("3. Reference using the _image_ref field (CSV) or insert inline (DOCX).", 1),
  bl("4. Optionally type the plain-text version in the _equation field as alt-text.", 1),
  errNote("Do NOT paste raw LaTeX code (e.g. \\frac{a}{b}) — use plain-text or an image."),
  sep(),

  h2("6. File Naming Conventions"),
  tbl(["Context","Example filename"], [
    ["Question image",         "q001_question.png"],
    ["Option image",           "q001_opt_b.png"],
    ["Explanation image",      "q001_explanation.png"],
    ["Group passage image",    "g01_passage.png"],
    ["Passage annotated",      "g01_passage_annotated.png"],
    ["Equation screenshot",    "q003_equation.png"],
  ]),
  bl("Use lowercase letters only, underscores instead of spaces."),
  bl("Include question or group reference in the filename for traceability."),
  bl("Keep all images in an images/ subfolder inside the ZIP."),
  sep(),

  h2("7. ZIP Archive Structure for CSV Uploads"),
  code("upload_batch_01.zip"),
  code("  ├─ questions.csv"),
  code("  └─ images/"),
  code("       ├─ q001_question.png"),
  code("       ├─ q001_opt_b.png"),
  code("       ├─ q001_explanation.png"),
  code("       └─ g01_passage.png"),
  bl("CSV _image_ref values must match paths relative to the ZIP root."),
  bl("Example: images/q001_question.png"),
  bl("Image referenced in CSV but missing from ZIP → WARNING during preview."),
  sep(),

  h2("8. Admin Editor — Direct Paste Support"),
  goodNote("In the admin Question Bank editor, you can paste images and screenshots directly into any field using Ctrl+V (or Cmd+V on Mac)."),
  bl("The editor captures the pasted image automatically and stores it inline."),
  bl("No need to upload separately — paste directly into the Question, Option, or Explanation field."),
  bl("Use the ∑ Equation button in the editor toolbar to insert equations using LaTeX notation."),
  bl("Use the 📷 Image button to upload an image file from your computer."),
  note("The paste-direct feature works for screenshots taken with any tool — browser screenshot, OS snipping tool, or any image from the clipboard.", C.greenBg, C.green),
], "saphala_image_equation_guide_UPDATED.docx");

console.log("\n✅ All 6 UPDATED files generated in public/downloads/");
