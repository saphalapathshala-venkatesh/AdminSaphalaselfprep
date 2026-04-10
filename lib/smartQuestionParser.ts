/**
 * lib/smartQuestionParser.ts
 *
 * Tolerant DOCX question parser.
 *
 * Handles imperfectly-formatted files where mammoth concatenates multiple
 * fields into a single <p> paragraph, producing text like:
 *
 *   QUESTIONQuestion: text...Option A: ...Option B: ...Correct Answer: B
 *
 * Strategy
 * ────────
 * 1. normalizeImportedQuestionText() — inserts \n before every known field
 *    label whenever the label appears mid-line (not already at line start).
 * 2. splitQuestionBlocks()           — splits on QUESTION … END_QUESTION
 *    boundaries.
 * 3. parseQuestionBlock()            — line-by-line field extraction producing
 *    a RawRow compatible with the existing validateRow() pipeline.
 * 4. smartParseDocxText()            — orchestrates the above and returns a
 *    SmartParseResult including diagnostics for the UI.
 */

import type { RawRow } from "./importValidator";

// ── Known field markers ────────────────────────────────────────────────────
// Ordered longest-first so that partial-match labels (e.g. "Explanation:")
// never steal the prefix of "Explanation Secondary:".

const FIELD_MARKERS_ORDERED: Array<[string, string]> = [
  ["Explanation Secondary:", "explanation_secondary"],
  ["Question Secondary:",    "stem_secondary"],
  ["Passage Secondary:",     "_passage_secondary"],
  ["Option A Secondary:",    "option1_secondary"],
  ["Option B Secondary:",    "option2_secondary"],
  ["Option C Secondary:",    "option3_secondary"],
  ["Option D Secondary:",    "option4_secondary"],
  ["Option E Secondary:",    "option5_secondary"],
  ["Option F Secondary:",    "option6_secondary"],
  ["Option G Secondary:",    "option7_secondary"],
  ["Option H Secondary:",    "option8_secondary"],
  ["Correct Answer:",        "_correct_raw"],
  ["Negative Marks:",        "negative_marks"],
  ["Passage:",               "_passage"],
  ["Question:",              "stem"],
  ["Option A:",              "option1"],
  ["Option B:",              "option2"],
  ["Option C:",              "option3"],
  ["Option D:",              "option4"],
  ["Option E:",              "option5"],
  ["Option F:",              "option6"],
  ["Option G:",              "option7"],
  ["Option H:",              "option8"],
  ["Explanation:",           "explanation"],
  ["Difficulty:",            "difficulty"],
  ["Category:",              "category"],
  ["Subject:",               "subject"],
  ["Subtopic:",              "subtopic"],
  ["Status:",                "status"],
  ["Topic:",                 "topic"],
  ["Marks:",                 "marks"],
  ["Tags:",                  "tags"],
  ["Type:",                  "type"],
];

// ── Pre-built fast lookup map (lowercase label → key) ─────────────────────
const MARKER_MAP = new Map<string, string>(
  FIELD_MARKERS_ORDERED.map(([label, key]) => [label.toLowerCase(), key])
);

// Longest label length — used for O(n) scanning without full regex per line
const MAX_LABEL_LEN = Math.max(...FIELD_MARKERS_ORDERED.map(([l]) => l.length));

// ── Block boundary patterns ────────────────────────────────────────────────
const RE_QUESTION_START = /^QUESTION\s*:?\s*$/i;
const RE_QUESTION_END   = /^END_QUESTION\b/i;
const RE_GROUP_START    = /^GROUP_START\b/i;
const RE_GROUP_END      = /^GROUP_END\b/i;

// ── 1. Normalization ───────────────────────────────────────────────────────

/**
 * Insert a newline before every known field marker that appears mid-line
 * (i.e. preceded by a non-newline character).
 *
 * This recovers questions from DOCX files where mammoth outputs the entire
 * question as a single <p> element.
 */
export function normalizeImportedQuestionText(text: string): string {
  // Uniform line endings
  let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Collapse mid-line whitespace runs (leave newlines alone)
  out = out.replace(/[^\S\n]{2,}/g, " ");

  // Insert \n before block boundary words when they appear mid-line
  // We must NOT split "QUESTION" if it is already at the line start, and
  // we must NOT touch "QUESTION SECONDARY" (not a real marker).
  // The negative lookahead (?! SECONDARY) guards against the latter.
  const blockWords: RegExp[] = [
    /([^\n])(QUESTION)(?!\s+SECONDARY\b)(?=\s*(?:$|\n|:?\s*$))/gim,
    /([^\n])(END_QUESTION)/gi,
    /([^\n])(GROUP_START)/gi,
    /([^\n])(GROUP_END)/gi,
  ];
  for (const re of blockWords) {
    out = out.replace(re, "$1\n$2");
  }

  // Insert \n before each known field label when it appears mid-line.
  //
  // IMPORTANT: use a SINGLE combined alternation regex rather than individual
  // per-label passes.  The per-label loop had a critical bug: when the "Topic:"
  // pass ran after the "Subtopic:" pass had already split that line, the regex
  // `([^\n])(Topic:)` would match the "b" in "\nSubtopic: X" and corrupt it to
  // "\nSub\nTopic: X", causing the subtopic value to be stored as topic instead.
  //
  // With a single alternation regex the engine tries each alternative left-to-right
  // at every position and stops on the first match.  Because FIELD_MARKERS_ORDERED
  // is already longest-first, "Subtopic:" (9 chars) is always tried before
  // "Topic:" (6 chars) at the same position — so when "Subtopic:" appears
  // mid-line (e.g. "AlgebraSubtopic:"), it is matched as a whole unit and the
  // engine advances past it without ever trying "Topic:" inside.
  const allLabels = FIELD_MARKERS_ORDERED
    .map(([label]) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const labelRe = new RegExp(`([^\\n])(${allLabels})`, "gi");
  out = out.replace(labelRe, "$1\n$2");

  // Repair pass — handles the edge case where "Subtopic:" was already at the
  // START of its own line before normalization ran (e.g. a well-formatted DOCX).
  // In that case the character before "S" in "\nSubtopic:" is a newline, so the
  // combined regex above never fires the "Subtopic:" alternative.  But the engine
  // DOES find a match at position 2 inside the word: group1="b", group2="topic:",
  // producing the spurious split "\nSub\ntopic: X".  This single substitution
  // rejoin any such fragment regardless of capitalisation.
  out = out.replace(/(^|\n)Sub\n(topic:)/gi, "$1Subtopic:");

  return out.trim();
}

// ── 2. Block splitting ─────────────────────────────────────────────────────

/**
 * Split a normalized text string into individual question blocks.
 * A block is everything between a QUESTION marker (inclusive of content,
 * exclusive of the marker itself) and the next END_QUESTION / QUESTION marker.
 *
 * GROUP_START / GROUP_END lines are dropped — the smart parser does not
 * attempt to reconstruct paragraph groups (those are handled by the strict
 * HTML parser which supports the full group syntax).
 */
export function splitQuestionBlocks(normalizedText: string): string[] {
  const lines = normalizedText.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inQuestion = false;

  for (const line of lines) {
    const t = line.trim();

    if (RE_QUESTION_START.test(t)) {
      if (inQuestion && current.length > 0) blocks.push(current.join("\n"));
      current = [];
      inQuestion = true;
      continue;
    }

    if (RE_QUESTION_END.test(t)) {
      if (inQuestion && current.length > 0) blocks.push(current.join("\n"));
      current = [];
      inQuestion = false;
      continue;
    }

    // Skip group boundary lines — not part of individual question data
    if (RE_GROUP_START.test(t) || RE_GROUP_END.test(t)) continue;

    if (inQuestion) current.push(line);
  }

  // Flush if file ended without END_QUESTION
  if (inQuestion && current.length > 0) blocks.push(current.join("\n"));

  return blocks;
}

// ── 3. Field identification ────────────────────────────────────────────────

interface ParsedField {
  key: string;   // RawRow key
  value: string; // inline value (may be empty)
}

/**
 * Try to identify a field label at the start of `line`.
 * Returns null if the line does not start with any known marker.
 *
 * Uses a direct string comparison (lowercase) for speed instead of regex.
 */
function identifyField(line: string): ParsedField | null {
  const lower = line.trimStart().toLowerCase();
  // Check progressively shorter prefixes (start at max label length, shrink)
  const limit = Math.min(lower.length, MAX_LABEL_LEN);
  for (let len = limit; len >= 3; len--) {
    const prefix = lower.slice(0, len);
    const key = MARKER_MAP.get(prefix);
    if (key !== undefined) {
      const value = line.trimStart().slice(len).trim();
      return { key, value };
    }
  }
  return null;
}

// ── 4. Block parsing ───────────────────────────────────────────────────────

export interface BlockParseResult {
  row: RawRow;
  diagnostics: string[];
}

/**
 * Parse a single question block text into a RawRow.
 *
 * Multi-line field values (e.g. a long Explanation) are concatenated with a
 * space, preserving readability.
 */
export function parseQuestionBlock(
  blockText: string,
  blockIndex: number
): BlockParseResult {
  const lines = blockText.split("\n").map((l) => l.trim()).filter(Boolean);
  const raw: Record<string, string> = {};
  const diagnostics: string[] = [];

  let currentKey: string | null = null;
  let currentParts: string[] = [];

  const flush = () => {
    if (currentKey === null) return;
    const val = currentParts.join(" ").trim();
    if (val) {
      raw[currentKey] = raw[currentKey] ? `${raw[currentKey]} ${val}` : val;
    }
    currentKey = null;
    currentParts = [];
  };

  for (const line of lines) {
    const match = identifyField(line);
    if (match) {
      flush();
      currentKey = match.key;
      currentParts = match.value ? [match.value] : [];
    } else {
      if (currentKey !== null) {
        currentParts.push(line);
      } else {
        diagnostics.push(
          `Q${blockIndex + 1}: Unrecognised line ignored — "${line.slice(0, 70)}${line.length > 70 ? "…" : ""}"`
        );
      }
    }
  }
  flush();

  // Convert "Correct Answer: B" / "A,C" → numeric index string "2" / "1,3"
  // matching the existing RawRow convention used by validateRow().
  const correctRaw = (raw._correct_raw || "").trim();
  if (correctRaw) {
    const indexes = correctRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .map((l) => {
        const code = l.charCodeAt(0) - 64;
        return code >= 1 && code <= 8 ? code : NaN;
      })
      .filter((n) => !isNaN(n));
    if (indexes.length > 0) {
      raw.correct = indexes.join(",");
    } else {
      diagnostics.push(
        `Q${blockIndex + 1}: Could not parse Correct Answer "${correctRaw}" — expected a letter like A, B, C or A,C`
      );
    }
  }
  delete raw._correct_raw;

  // Drop internal passage keys (group passages — not stored on individual questions here)
  delete raw._passage;
  delete raw._passage_secondary;

  return { row: raw as RawRow, diagnostics };
}

// ── 5. Main entry point ────────────────────────────────────────────────────

export interface SmartParseResult {
  rows: RawRow[];
  diagnostics: string[];
  blocksFound: number;
  blocksParsed: number;
  blocksFailed: number;
  parserUsed: "strict" | "smart";
}

/**
 * Parse DOCX plain text using the smart normalizer + tolerant parser.
 *
 * Call this when the strict HTML-based parseDocxHtml() returns 0 rows.
 */
export function smartParseDocxText(rawText: string): SmartParseResult {
  const diagnostics: string[] = [];

  const normalized = normalizeImportedQuestionText(rawText);
  const blocks = splitQuestionBlocks(normalized);

  if (blocks.length === 0) {
    if (/QUESTION/i.test(rawText)) {
      diagnostics.push(
        "QUESTION markers were detected but no complete question blocks could be " +
        "extracted. Ensure each question starts with a standalone 'QUESTION' line " +
        "and that field labels (Question:, Option A:, etc.) appear as their own " +
        "paragraphs in Word."
      );
    } else {
      diagnostics.push(
        "No QUESTION markers found in the file. Each question must begin with a " +
        "line that contains only the word QUESTION. " +
        "Download the Single Question Template for the correct layout."
      );
    }
    return { rows: [], diagnostics, blocksFound: 0, blocksParsed: 0, blocksFailed: 0, parserUsed: "smart" };
  }

  const rows: RawRow[] = [];
  let blocksFailed = 0;

  for (let i = 0; i < blocks.length; i++) {
    const { row, diagnostics: blockDiag } = parseQuestionBlock(blocks[i], i);
    diagnostics.push(...blockDiag);

    if (!row.stem || !String(row.stem).trim()) {
      diagnostics.push(
        `Q${i + 1}: Missing 'Question:' field — block skipped. ` +
        `(First 80 chars: "${blocks[i].slice(0, 80).replace(/\n/g, " ")}")`
      );
      blocksFailed++;
      continue;
    }

    rows.push(row);
  }

  return {
    rows,
    diagnostics,
    blocksFound: blocks.length,
    blocksParsed: rows.length,
    blocksFailed,
    parserUsed: "smart",
  };
}
