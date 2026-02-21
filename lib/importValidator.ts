import { computeContentHash } from "./questionHash";

const VALID_TYPES = [
  "MCQ_SINGLE",
  "MCQ_MULTIPLE",
  "DRAG_REORDER",
  "DRAG_DROP",
  "FILL_BLANKS",
  "TRUE_FALSE",
];
const VALID_DIFFICULTIES = ["FOUNDATIONAL", "PROFICIENT", "MASTERY"];
const VALID_STATUSES = ["DRAFT", "APPROVED"];
const MCQ_TYPES = ["MCQ_SINGLE", "MCQ_MULTIPLE"];

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

export function validateRow(raw: RawRow): ValidationResult {
  const type = (raw.type || "").trim().toUpperCase();
  if (!type) {
    return { isValid: false, errorField: "type", errorMsg: "Type is required", normalizedRow: null };
  }
  if (!VALID_TYPES.includes(type)) {
    return { isValid: false, errorField: "type", errorMsg: `Invalid type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}`, normalizedRow: null };
  }

  const stem = (raw.stem || "").trim();
  if (!stem) {
    return { isValid: false, errorField: "stem", errorMsg: "Stem is required", normalizedRow: null };
  }

  const difficulty = (raw.difficulty || "").trim().toUpperCase();
  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    return { isValid: false, errorField: "difficulty", errorMsg: `Invalid difficulty. Must be: ${VALID_DIFFICULTIES.join(", ")}`, normalizedRow: null };
  }

  const status = (raw.status || "DRAFT").trim().toUpperCase();
  if (!VALID_STATUSES.includes(status)) {
    return { isValid: false, errorField: "status", errorMsg: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}`, normalizedRow: null };
  }

  const isMCQ = MCQ_TYPES.includes(type);
  const options: { text: string; isCorrect: boolean; order: number }[] = [];

  if (isMCQ) {
    const optTexts: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const val = (raw[`option${i}`] || "").trim();
      if (val) optTexts.push(val);
    }
    if (optTexts.length < 2) {
      return { isValid: false, errorField: "options", errorMsg: "MCQ questions require at least 2 options", normalizedRow: null };
    }

    const correctStr = (raw.correct || "").trim();
    if (!correctStr) {
      return { isValid: false, errorField: "correct", errorMsg: "Correct answer index(es) required for MCQ", normalizedRow: null };
    }

    const correctIndexes = correctStr.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    if (correctIndexes.length === 0) {
      return { isValid: false, errorField: "correct", errorMsg: "Invalid correct answer format. Use comma-separated indexes (e.g., 1 or 1,3)", normalizedRow: null };
    }

    for (const idx of correctIndexes) {
      if (idx < 1 || idx > optTexts.length) {
        return { isValid: false, errorField: "correct", errorMsg: `Correct index ${idx} out of range (1-${optTexts.length})`, normalizedRow: null };
      }
    }

    if (type === "MCQ_SINGLE" && correctIndexes.length !== 1) {
      return { isValid: false, errorField: "correct", errorMsg: "MCQ_SINGLE must have exactly 1 correct answer", normalizedRow: null };
    }

    for (let i = 0; i < optTexts.length; i++) {
      options.push({
        text: optTexts[i],
        isCorrect: correctIndexes.includes(i + 1),
        order: i,
      });
    }
  }

  const tags = (raw.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const contentHash = computeContentHash(stem, options, type);

  return {
    isValid: true,
    errorField: null,
    errorMsg: null,
    normalizedRow: {
      type,
      stem,
      options,
      explanation: (raw.explanation || "").trim() || null,
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

export function parseDocxText(text: string): RawRow[] {
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  const rows: RawRow[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const row: RawRow = {};
    let currentOptions: string[] = [];
    let stemLines: string[] = [];
    let parsedStem = false;

    for (const line of lines) {
      const qMatch = line.match(/^Q:\s*(.+)/i);
      if (qMatch) {
        row.stem = qMatch[1].trim();
        parsedStem = true;
        continue;
      }

      const optMatch = line.match(/^([A-H])\)\s*(.+)/i);
      if (optMatch) {
        currentOptions.push(optMatch[2].trim());
        continue;
      }

      const correctMatch = line.match(/^Correct:\s*(.+)/i);
      if (correctMatch) {
        const val = correctMatch[1].trim();
        const letters = val.split(",").map((s) => s.trim().toUpperCase());
        const indexes = letters.map((l) => l.charCodeAt(0) - 64);
        row.correct = indexes.join(",");
        continue;
      }

      const explMatch = line.match(/^Explanation:\s*(.+)/i);
      if (explMatch) {
        row.explanation = explMatch[1].trim();
        continue;
      }

      const taxMatch = line.match(/^Taxonomy:\s*(.+)/i);
      if (taxMatch) {
        const parts = taxMatch[1].split(">").map((p) => p.trim());
        if (parts[0]) row.category = parts[0];
        if (parts[1]) row.subject = parts[1];
        if (parts[2]) row.topic = parts[2];
        if (parts[3]) row.subtopic = parts[3];
        continue;
      }

      const diffMatch = line.match(/^Difficulty:\s*(.+)/i);
      if (diffMatch) {
        row.difficulty = diffMatch[1].trim();
        continue;
      }

      const statusMatch = line.match(/^Status:\s*(.+)/i);
      if (statusMatch) {
        row.status = statusMatch[1].trim();
        continue;
      }

      const tagsMatch = line.match(/^Tags:\s*(.+)/i);
      if (tagsMatch) {
        row.tags = tagsMatch[1].trim();
        continue;
      }

      const typeMatch = line.match(/^Type:\s*(.+)/i);
      if (typeMatch) {
        row.type = typeMatch[1].trim();
        continue;
      }

      if (!parsedStem) {
        stemLines.push(line);
      }
    }

    if (!row.stem && stemLines.length > 0) {
      row.stem = stemLines.join(" ");
    }

    if (currentOptions.length > 0) {
      currentOptions.forEach((o, i) => {
        row[`option${i + 1}`] = o;
      });
      if (!row.type) {
        if (row.correct) {
          const idxs = row.correct.split(",").filter(Boolean);
          row.type = idxs.length > 1 ? "MCQ_MULTIPLE" : "MCQ_SINGLE";
        } else {
          row.type = "MCQ_SINGLE";
        }
      }
    }

    if (row.stem) {
      if (!row.difficulty) row.difficulty = "FOUNDATIONAL";
      if (!row.status) row.status = "DRAFT";
      rows.push(row);
    }
  }

  return rows;
}
