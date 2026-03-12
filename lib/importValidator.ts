import { computeContentHash } from "./questionHash";
import { hasVisibleText, stripHtml } from "./htmlUtils";

// ── Valid enum values ─────────────────────────────────────────────────────────
const VALID_TYPES = [
  "MCQ_SINGLE", "MCQ_MULTIPLE", "DRAG_REORDER", "DRAG_DROP",
  "FILL_BLANKS", "TRUE_FALSE",
];
const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "FOUNDATIONAL", "PROFICIENT", "MASTERY"];
const VALID_STATUSES = ["DRAFT", "APPROVED"];
const MCQ_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE"];

// ── Public interfaces ─────────────────────────────────────────────────────────
export interface RawRow {
  type?: string;
  stem?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  option5?: string;
  option6?: string;
  option7?: string;
  option8?: string;
  correct?: string;
  explanation?: string;
  difficulty?: string;
  status?: string;
  tags?: string;
  category?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
  marks?: string;
  negative_marks?: string;
  [key: string]: any;
}

export interface ValidationResult {
  isValid: boolean;
  errorField: string | null;
  errorMsg: string | null;
  normalizedRow: NormalizedRow | null;
}

export interface NormalizedRow {
  type: string;
  stem: string;
  options: { text: string; isCorrect: boolean; order: number }[];
  explanation: string | null;
  difficulty: string;
  status: string;
  tags: string[];
  category: string | null;
  subject: string | null;
  topic: string | null;
  subtopic: string | null;
  contentHash: string;
}

// ── Column-name normaliser (maps UPDATED template names → internal RawRow) ────
export function normalizeColumnNames(raw: Record<string, any>): RawRow {
  if (raw.stem !== undefined) return raw as RawRow; // already in internal format

  const r: RawRow = { ...raw };

  if (raw.question_rich_text !== undefined) r.stem = raw.question_rich_text;
  if (raw.question_text !== undefined && r.stem === undefined) r.stem = raw.question_text;

  if (raw.option_a_rich_text !== undefined) r.option1 = raw.option_a_rich_text;
  if (raw.option_b_rich_text !== undefined) r.option2 = raw.option_b_rich_text;
  if (raw.option_c_rich_text !== undefined) r.option3 = raw.option_c_rich_text;
  if (raw.option_d_rich_text !== undefined) r.option4 = raw.option_d_rich_text;
  if (raw.option_a_text !== undefined && r.option1 === undefined) r.option1 = raw.option_a_text;
  if (raw.option_b_text !== undefined && r.option2 === undefined) r.option2 = raw.option_b_text;
  if (raw.option_c_text !== undefined && r.option3 === undefined) r.option3 = raw.option_c_text;
  if (raw.option_d_text !== undefined && r.option4 === undefined) r.option4 = raw.option_d_text;

  if (raw.explanation_rich_text !== undefined) r.explanation = raw.explanation_rich_text;
  if (raw.explanation_text !== undefined && r.explanation === undefined) r.explanation = raw.explanation_text;

  if (raw.question_type !== undefined) r.type = raw.question_type;
  if (raw.source_tag !== undefined) {
    const existing = (raw.tags || "").trim();
    const sourceVal = raw.source_tag.trim();
    if (sourceVal) {
      r.tags = existing
        ? `${existing},source:${sourceVal}`
        : `source:${sourceVal}`;
    }
  }
  if (raw.marks !== undefined) r.marks = raw.marks;
  if (raw.negative_marks !== undefined) r.negative_marks = raw.negative_marks;

  if (raw.correct_answer !== undefined) {
    const letters = String(raw.correct_answer)
      .split(",")
      .map((s) => s.trim().toUpperCase());
    const indexes = letters
      .map((l) => {
        const code = l.charCodeAt(0) - 64;
        return code >= 1 && code <= 8 ? code : NaN;
      })
      .filter((n) => !isNaN(n));
    if (indexes.length > 0) r.correct = indexes.join(",");
  }

  return r;
}

// ── Validator ─────────────────────────────────────────────────────────────────
export function validateRow(rawInput: RawRow): ValidationResult {
  const raw = normalizeColumnNames(rawInput as Record<string, any>);

  const type = (raw.type || "").trim().toUpperCase();
  if (!type) {
    return { isValid: false, errorField: "type", errorMsg: "Type is required", normalizedRow: null };
  }
  if (!VALID_TYPES.includes(type)) {
    return {
      isValid: false,
      errorField: "type",
      errorMsg: `Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}`,
      normalizedRow: null,
    };
  }

  const stem = raw.stem || "";
  if (!hasVisibleText(stem)) {
    return { isValid: false, errorField: "stem", errorMsg: "Stem is required", normalizedRow: null };
  }

  const difficulty = (raw.difficulty || "").trim().toUpperCase();
  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    return {
      isValid: false,
      errorField: "difficulty",
      errorMsg: `Invalid difficulty. Must be: ${VALID_DIFFICULTIES.join(", ")}`,
      normalizedRow: null,
    };
  }

  const status = (raw.status || "DRAFT").trim().toUpperCase();
  if (!VALID_STATUSES.includes(status)) {
    return {
      isValid: false,
      errorField: "status",
      errorMsg: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}`,
      normalizedRow: null,
    };
  }

  const isMCQ = MCQ_TYPES.includes(type);
  const options: { text: string; isCorrect: boolean; order: number }[] = [];

  if (isMCQ) {
    const optTexts: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const val = raw[`option${i}`] || "";
      if (hasVisibleText(val)) optTexts.push(val);
    }
    if (optTexts.length < 2) {
      return {
        isValid: false,
        errorField: "options",
        errorMsg: "MCQ questions require at least 2 options",
        normalizedRow: null,
      };
    }

    const correctStr = (raw.correct || "").trim();
    if (!correctStr) {
      return {
        isValid: false,
        errorField: "correct",
        errorMsg: "Correct answer index(es) required for MCQ",
        normalizedRow: null,
      };
    }

    const correctIndexes = correctStr
      .split(",")
      .map((s: string) => parseInt(s.trim()))
      .filter((n: number) => !isNaN(n));
    if (correctIndexes.length === 0) {
      return {
        isValid: false,
        errorField: "correct",
        errorMsg: "Invalid correct answer format. Use comma-separated indexes (e.g., 1 or 1,3)",
        normalizedRow: null,
      };
    }

    for (const idx of correctIndexes) {
      if (idx < 1 || idx > optTexts.length) {
        return {
          isValid: false,
          errorField: "correct",
          errorMsg: `Correct index ${idx} out of range (1-${optTexts.length})`,
          normalizedRow: null,
        };
      }
    }

    if (type === "MCQ_SINGLE" && correctIndexes.length !== 1) {
      return {
        isValid: false,
        errorField: "correct",
        errorMsg: "MCQ_SINGLE must have exactly 1 correct answer",
        normalizedRow: null,
      };
    }

    for (let i = 0; i < optTexts.length; i++) {
      options.push({ text: optTexts[i], isCorrect: correctIndexes.includes(i + 1), order: i });
    }
  }

  const tags = (raw.tags || "")
    .split(",")
    .map((t: string) => t.trim())
    .filter(Boolean);

  const contentHash = computeContentHash(stem, options, type);

  const explanation = raw.explanation || "";

  return {
    isValid: true,
    errorField: null,
    errorMsg: null,
    normalizedRow: {
      type,
      stem,
      options,
      explanation: hasVisibleText(explanation) ? explanation : null,
      difficulty,
      status,
      tags,
      category: (raw.category || "").trim() || null,
      subject: (raw.subject || "").trim() || null,
      topic: (raw.topic || "").trim() || null,
      subtopic: (raw.subtopic || "").trim() || null,
      contentHash,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// HTML-AWARE DOCX PARSER
// ═════════════════════════════════════════════════════════════════════════════

/** Strip HTML tags and decode entities to plain text for label matching */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise mammoth's HTML to the same conventions used by RichEditor */
function normaliseMammothHtml(html: string): string {
  return html
    .replace(/<strong>/gi, "<b>")
    .replace(/<\/strong>/gi, "</b>")
    .replace(/<em>/gi, "<i>")
    .replace(/<\/em>/gi, "</i>")
    .replace(/ style="[^"]*"/gi, "")
    .replace(/ class="[^"]*"/gi, "");
}

/**
 * Find the first colon (':') that is NOT inside an HTML tag and return
 * everything after it, trimmed.  Returns the full string if no colon found.
 */
function extractValueHtml(innerHtml: string): string {
  let tagDepth = 0;
  for (let i = 0; i < innerHtml.length; i++) {
    const ch = innerHtml[i];
    if (ch === "<") { tagDepth++; continue; }
    if (ch === ">") { tagDepth--; continue; }
    if (tagDepth === 0 && ch === ":") {
      return innerHtml.substring(i + 1).trim();
    }
  }
  return innerHtml.trim();
}

interface HtmlSegment {
  text: string;   // plain text (for label matching)
  html: string;   // rich inner HTML (preserved)
  isTable: boolean;
}

/** Extract block-level segments: <p> paragraphs and <table> blocks */
function extractHtmlSegments(html: string): HtmlSegment[] {
  const segments: HtmlSegment[] = [];
  const norm = normaliseMammothHtml(html);

  // Split out <table> blocks as atomic units first
  const parts: { type: "html" | "table"; content: string }[] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tableRe.exec(norm)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: "html", content: norm.substring(lastIdx, m.index) });
    }
    parts.push({ type: "table", content: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < norm.length) {
    parts.push({ type: "html", content: norm.substring(lastIdx) });
  }

  for (const part of parts) {
    if (part.type === "table") {
      const t = textOf(part.content);
      if (t) segments.push({ text: t, html: part.content, isTable: true });
      continue;
    }

    // Extract <p> paragraphs
    const paraRe = /<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi;
    while ((m = paraRe.exec(part.content)) !== null) {
      const inner = m[0].replace(/^<p(?:[^>]*)?>/, "").replace(/<\/p>$/, "").trim();
      const t = textOf(inner);
      if (t) segments.push({ text: t, html: inner, isTable: false });
    }

    // Capture <li> items that mammoth does NOT wrap in <p>
    const liRe = /<li(?:\s[^>]*)?>(?![\s\S]*?<p)([\s\S]*?)<\/li>/gi;
    while ((m = liRe.exec(part.content)) !== null) {
      const inner = (m[1] || "").trim();
      const t = textOf(inner);
      if (t) segments.push({ text: t, html: inner, isTable: false });
    }
  }

  return segments;
}

// ── Known field labels (new UPDATED template format) ─────────────────────────
const FIELD_LABELS: { re: RegExp; key: keyof RawRow }[] = [
  { re: /^question rich text\s*:/i,        key: "stem" },
  { re: /^question\s*:/i,                  key: "stem" },
  { re: /^passage rich text\s*:/i,         key: "_passage" as any },
  { re: /^passage\s*:/i,                   key: "_passage" as any },
  { re: /^option a rich text\s*:/i,        key: "option1" },
  { re: /^option a\s*:/i,                  key: "option1" },
  { re: /^option b rich text\s*:/i,        key: "option2" },
  { re: /^option b\s*:/i,                  key: "option2" },
  { re: /^option c rich text\s*:/i,        key: "option3" },
  { re: /^option c\s*:/i,                  key: "option3" },
  { re: /^option d rich text\s*:/i,        key: "option4" },
  { re: /^option d\s*:/i,                  key: "option4" },
  { re: /^correct answer\s*:/i,            key: "correct" },
  { re: /^correct\s*:/i,                   key: "correct" },
  { re: /^explanation rich text\s*:/i,     key: "explanation" },
  { re: /^explanation\s*:/i,               key: "explanation" },
  { re: /^solution rich text\s*:/i,        key: "explanation" },
  { re: /^solution\s*:/i,                  key: "explanation" },
  { re: /^category\s*:/i,                  key: "category" },
  { re: /^subject\s*:/i,                   key: "subject" },
  { re: /^topic\s*:/i,                     key: "topic" },
  { re: /^subtopic\s*:/i,                  key: "subtopic" },
  { re: /^question type\s*:/i,             key: "type" },
  { re: /^type\s*:/i,                      key: "type" },
  { re: /^difficulty\s*:/i,               key: "difficulty" },
  { re: /^status\s*:/i,                    key: "status" },
  { re: /^source tag\s*:/i,               key: "_sourceTag" as any },
  { re: /^tags\s*:/i,                      key: "tags" },
  { re: /^marks\s*:/i,                     key: "marks" },
  { re: /^negative marks\s*:/i,           key: "negative_marks" },
];

/** Try to match a segment's text against a known field label.
 *  Returns { key, valueHtml } or null. */
function matchLabel(seg: HtmlSegment): { key: string; valueHtml: string } | null {
  for (const { re, key } of FIELD_LABELS) {
    if (re.test(seg.text)) {
      return { key: key as string, valueHtml: extractValueHtml(seg.html) };
    }
  }
  return null;
}

/** Convert "correct" field value from letter (A/B/C/D) to 1-based index string */
function normaliseCorrect(val: string): string {
  const parts = val.split(",").map((s) => s.trim().toUpperCase());
  const indexes = parts.map((p) => {
    const n = parseInt(p, 10);
    if (!isNaN(n)) return n;
    const code = p.charCodeAt(0) - 64;
    return code >= 1 && code <= 8 ? code : NaN;
  }).filter((n) => !isNaN(n));
  return indexes.length > 0 ? indexes.join(",") : val;
}

/** Finalise a RawRow built from a QUESTION block */
function finaliseRow(row: RawRow, passageHtml: string): RawRow {
  const out: RawRow = { ...row };

  // Normalise correct answer
  if (out.correct) out.correct = normaliseCorrect(out.correct);

  // Auto-detect type if missing
  if (!out.type) {
    if (out.correct) {
      const idxs = out.correct.split(",").filter(Boolean);
      out.type = idxs.length > 1 ? "MCQ_MULTIPLE" : "MCQ_SINGLE";
    } else {
      out.type = "MCQ_SINGLE";
    }
  }

  // Defaults
  if (!out.difficulty) out.difficulty = "EASY";
  if (!out.status) out.status = "DRAFT";

  // Inline source tag
  if ((out as any)._sourceTag) {
    const st = (out as any)._sourceTag.trim();
    if (st) {
      const existing = (out.tags || "").trim();
      out.tags = existing ? `${existing},source:${st}` : `source:${st}`;
    }
    delete (out as any)._sourceTag;
  }

  // Attach passage as tag
  if (passageHtml) {
    const existing = (out.tags || "").trim();
    const passageTag = `passage:${passageHtml}`;
    out.tags = existing ? `${existing},${passageTag}` : passageTag;
  }

  // Remove internal field
  delete (out as any)._passage;

  return out;
}

/** Parse DOCX HTML produced by mammoth.convertToHtml — preserves all formatting */
export function parseDocxHtml(rawHtml: string): RawRow[] {
  const segs = extractHtmlSegments(rawHtml);
  const rows: RawRow[] = [];

  type State = "IDLE" | "IN_GROUP" | "IN_PASSAGE" | "IN_QUESTION";

  let state: State = "IDLE";
  let currentRow: RawRow = {};
  let currentField: string | null = null;
  let passageHtml = "";
  let groupTaxonomy: Pick<RawRow, "category" | "subject" | "topic" | "subtopic"> = {};

  const pushRow = () => {
    if (currentRow.stem || currentRow.option1) {
      rows.push(finaliseRow(
        { ...groupTaxonomy, ...currentRow },
        passageHtml,
      ));
    }
    currentRow = {};
    currentField = null;
  };

  for (const seg of segs) {
    const t = seg.text;

    // ── Boundary markers ─────────────────────────────────────────────────────
    if (/^group_start/i.test(t)) {
      state = "IN_GROUP";
      passageHtml = "";
      groupTaxonomy = {};
      currentRow = {};
      currentField = null;
      continue;
    }
    if (/^group_end/i.test(t)) {
      if (state === "IN_QUESTION") pushRow();
      passageHtml = "";
      groupTaxonomy = {};
      state = "IDLE";
      continue;
    }
    if (/^question\s*$/i.test(t) || /^question\s*:\s*$/i.test(t)) {
      if (state === "IN_QUESTION") pushRow();
      state = "IN_QUESTION";
      currentField = null;
      continue;
    }
    if (/^end_question/i.test(t) || /^end question/i.test(t)) {
      pushRow();
      state = state === "IN_GROUP" ? "IN_GROUP" : "IDLE";
      continue;
    }

    // ── Group taxonomy (set once, inherited by all children) ─────────────────
    if (state === "IN_GROUP" && !/^question/i.test(t)) {
      const lbl = matchLabel(seg);
      if (lbl) {
        const v = textOf(lbl.valueHtml).trim();
        if (lbl.key === "category") { groupTaxonomy.category = v; continue; }
        if (lbl.key === "subject")  { groupTaxonomy.subject  = v; continue; }
        if (lbl.key === "topic")    { groupTaxonomy.topic    = v; continue; }
        if (lbl.key === "subtopic") { groupTaxonomy.subtopic = v; continue; }
        if (lbl.key === "_passage") { passageHtml = lbl.valueHtml; currentField = "_passage"; continue; }
      }
      // Continuation of passage
      if (currentField === "_passage" && passageHtml) {
        if (seg.isTable) passageHtml += seg.html;
        else passageHtml += " " + seg.html;
      }
      continue;
    }

    // ── Inside QUESTION block ────────────────────────────────────────────────
    if (state === "IN_QUESTION") {
      const lbl = matchLabel(seg);
      if (lbl) {
        currentField = lbl.key;
        const v = lbl.valueHtml;
        // Plain-text fields stored as trimmed text
        const plainFields = ["correct", "category", "subject", "topic", "subtopic",
          "type", "difficulty", "status", "tags", "marks", "negative_marks", "_sourceTag"];
        if (plainFields.includes(lbl.key)) {
          (currentRow as any)[lbl.key] = textOf(v).trim();
        } else {
          // Rich HTML fields: stem, options, explanation, passage
          (currentRow as any)[lbl.key] = v;
        }
      } else {
        // No label match — could be a table or continuation
        if (seg.isTable && currentField) {
          const prev = (currentRow as any)[currentField] || "";
          (currentRow as any)[currentField] = prev ? `${prev}${seg.html}` : seg.html;
        } else if (currentField && !seg.isTable) {
          // Continuation of the current field
          const prev = (currentRow as any)[currentField] || "";
          const richFields = ["stem", "option1", "option2", "option3", "option4", "explanation", "_passage"];
          if (richFields.includes(currentField) && prev) {
            (currentRow as any)[currentField] = `${prev}<br>${seg.html}`;
          }
        }
      }
      continue;
    }

    // ── IDLE — legacy single-block format (Q: / A) / B) / Correct:) ─────────
    if (state === "IDLE") {
      const lbl = matchLabel(seg);
      if (lbl) {
        if (!currentRow.stem && lbl.key !== "stem") {
          // Field appeared without an opening QUESTION: marker — start implicitly
        }
        const v = lbl.valueHtml;
        const plainFields = ["correct", "category", "subject", "topic", "subtopic",
          "type", "difficulty", "status", "tags", "marks", "negative_marks", "_sourceTag"];
        if (plainFields.includes(lbl.key)) {
          (currentRow as any)[lbl.key] = textOf(v).trim();
        } else {
          (currentRow as any)[lbl.key] = v;
        }
        currentField = lbl.key;
      } else {
        // Legacy: Q:, A), B), etc.
        const qm = t.match(/^q\s*:\s*(.+)/i);
        if (qm) { currentRow.stem = extractValueHtml(seg.html); currentField = "stem"; continue; }

        const om = t.match(/^([A-H])\)\s*(.+)/i);
        if (om) {
          const idx = om[1].toUpperCase().charCodeAt(0) - 64;
          const optKey = `option${idx}` as keyof RawRow;
          (currentRow as any)[optKey] = extractValueHtml(seg.html);
          currentField = optKey as string;
          continue;
        }

        const cm = t.match(/^correct\s*:\s*(.+)/i);
        if (cm) { currentRow.correct = normaliseCorrect(textOf(extractValueHtml(seg.html))); continue; }

        const em = t.match(/^explanation\s*:\s*(.+)/i);
        if (em) { currentRow.explanation = extractValueHtml(seg.html); currentField = "explanation"; continue; }

        const taxm = t.match(/^taxonomy\s*:\s*(.+)/i);
        if (taxm) {
          const parts = textOf(extractValueHtml(seg.html)).split(">").map((p) => p.trim());
          if (parts[0]) currentRow.category = parts[0];
          if (parts[1]) currentRow.subject   = parts[1];
          if (parts[2]) currentRow.topic     = parts[2];
          if (parts[3]) currentRow.subtopic  = parts[3];
          continue;
        }

        // Blank-line separator in legacy format → push accumulated row
        if (!t) {
          if (currentRow.stem) pushRow();
          continue;
        }

        // Continuation of current field
        if (currentField && currentRow.stem) {
          const richFields = ["stem", "option1", "option2", "option3", "option4", "explanation"];
          if (richFields.includes(currentField)) {
            const prev = (currentRow as any)[currentField] || "";
            if (prev) (currentRow as any)[currentField] = `${prev}<br>${seg.html}`;
          }
        }
      }
    }
  }

  // Flush last row if file ended without END_QUESTION
  if (currentRow.stem || currentRow.option1) pushRow();

  return rows;
}

// ── Legacy plain-text parser (kept for fallback / testing) ───────────────────
export function parseDocxText(text: string): RawRow[] {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  const rows: RawRow[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const row: RawRow = {};
    let currentOptions: string[] = [];
    let stemLines: string[] = [];
    let parsedStem = false;

    for (const line of lines) {
      const qMatch = line.match(/^Q:\s*(.+)/i);
      if (qMatch) { row.stem = qMatch[1].trim(); parsedStem = true; continue; }

      const optMatch = line.match(/^([A-H])\)\s*(.+)/i);
      if (optMatch) { currentOptions.push(optMatch[2].trim()); continue; }

      const correctMatch = line.match(/^Correct:\s*(.+)/i);
      if (correctMatch) {
        const val = correctMatch[1].trim();
        const letters = val.split(",").map((s) => s.trim().toUpperCase());
        const indexes = letters.map((l) => l.charCodeAt(0) - 64);
        row.correct = indexes.join(",");
        continue;
      }

      const explMatch = line.match(/^Explanation:\s*(.+)/i);
      if (explMatch) { row.explanation = explMatch[1].trim(); continue; }

      const taxMatch = line.match(/^Taxonomy:\s*(.+)/i);
      if (taxMatch) {
        const parts = taxMatch[1].split(">").map((p) => p.trim());
        if (parts[0]) row.category = parts[0];
        if (parts[1]) row.subject  = parts[1];
        if (parts[2]) row.topic    = parts[2];
        if (parts[3]) row.subtopic = parts[3];
        continue;
      }

      const diffMatch  = line.match(/^Difficulty:\s*(.+)/i);
      if (diffMatch)  { row.difficulty = diffMatch[1].trim();  continue; }

      const statusMatch = line.match(/^Status:\s*(.+)/i);
      if (statusMatch) { row.status = statusMatch[1].trim();   continue; }

      const tagsMatch  = line.match(/^Tags:\s*(.+)/i);
      if (tagsMatch)   { row.tags = tagsMatch[1].trim();       continue; }

      const typeMatch  = line.match(/^Type:\s*(.+)/i);
      if (typeMatch)   { row.type = typeMatch[1].trim();       continue; }

      if (!parsedStem) stemLines.push(line);
    }

    if (!row.stem && stemLines.length > 0) row.stem = stemLines.join(" ");

    if (currentOptions.length > 0) {
      currentOptions.forEach((o, i) => { row[`option${i + 1}`] = o; });
      if (!row.type) {
        row.type = row.correct && row.correct.split(",").length > 1
          ? "MCQ_MULTIPLE"
          : "MCQ_SINGLE";
      }
    }

    if (row.stem) {
      if (!row.difficulty) row.difficulty = "FOUNDATIONAL";
      if (!row.status)     row.status     = "DRAFT";
      rows.push(row);
    }
  }

  return rows;
}
