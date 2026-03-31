"use client";
import React, { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { BRAND, adminBtn } from "@/lib/adminStyles";

const RichEditor = dynamic(() => import("@/components/ui/RichEditor"), { ssr: false });

function hasVisibleText(html: string): boolean {
  if (!html) return false;
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  return stripped.length > 0 || html.includes("<img");
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
type QuestionItem = {
  id: string; type: string; stem: string; stemSecondary?: string; difficulty: string; status: string;
  categoryId?: string; subjectId?: string; topicId?: string; subtopicId?: string;
  explanation?: string; explanationSecondary?: string; tags?: string[];
  options?: { id: string; text: string; textSecondary?: string; isCorrect: boolean; order: number }[];
};
type SectionState = {
  id?: string;
  title: string;
  durationSec: string;
  targetCount: string;
  parentIndex: number | null;
};
type TestQuestionState = {
  questionId: string;
  sectionIndex: number | null;
  question: QuestionItem;
  marks: number;
  negativeMarks: number;
};
type TestDetail = {
  id: string; title: string; instructions?: string; mode: string;
  isTimed: boolean; durationSec?: number; allowPause: boolean;
  strictSectionMode: boolean;
  shuffleQuestions: boolean; shuffleOptions: boolean;
  shuffleGroups: boolean; shuffleGroupChildren: boolean;
  seriesId?: string | null; categoryId?: string | null; examId?: string | null;
  isPublished: boolean; isFree: boolean;
  xpEnabled: boolean; xpValue: number;
  totalQuestions?: number | null;
  marksPerQuestion?: number | null;
  negativeMarksPerQuestion?: number | null;
  testStartTime?: string | null;
  series?: { id: string; title: string };
  sections: { id: string; title: string; order: number; durationSec?: number; targetCount?: number; parentSectionId?: string }[];
  questions: {
    id: string; questionId: string; sectionId?: string; order: number; marks?: number; negativeMarks?: number;
    question: QuestionItem;
  }[];
};
type SeriesOption = { id: string; title: string; categoryId?: string | null };

// Category-based section presets
const CATEGORY_SECTION_PRESETS: Record<string, string[]> = {
  banking: ["Quantitative Aptitude", "Reasoning Ability", "English Language", "General Awareness", "Computer Knowledge"],
  appsc: ["General Studies", "Mental Ability", "Current Affairs", "Telugu", "English"],
  "ap police": ["Arithmetic", "Reasoning", "General Studies", "Telugu", "English"],
  upsc: ["General Studies", "CSAT", "Essay", "Optional Paper I", "Optional Paper II"],
  ssc: ["Quantitative Aptitude", "English Language", "General Intelligence", "General Awareness"],
};

// Add Questions
type ReviewItem = {
  key: string;
  existingQuestionId?: string;
  isEdited: boolean;
  stem: string;
  stemSecondary?: string;
  type: string;
  difficulty: string;
  explanation: string;
  explanationSecondary?: string;
  categoryId: string;
  subjectId: string;
  topicId: string;
  subtopicId: string;
  sourceTag: string;
  marks: number;
  negativeMarks: number;
  options: { text: string; textSecondary?: string; isCorrect: boolean }[];
  passageText?: string;
  groupId?: string;
  status: "clean" | "warning" | "error";
  errors: string[];
  warnings: string[];
  selected: boolean;
};
type TaxoNode = { id: string; name: string };

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const MODES = ["TIMED", "SECTIONAL", "MULTI_SECTION"] as const;
const Q_TYPES = ["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "PASSAGE_BASED", "INTEGER", "DESCRIPTIVE"] as const;
const DIFFICULTIES = ["FOUNDATIONAL", "MODERATE", "ADVANCED"] as const;
const CORRECT_OPT_MAP: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem" };
const inp: React.CSSProperties = { width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "0.375rem 0.625rem", fontSize: "0.8125rem", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.2rem" };
const btn = (bg: string, fg = "#fff"): React.CSSProperties => ({ background: bg, color: fg, border: "none", borderRadius: "6px", padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer" });
const th: React.CSSProperties = { textAlign: "left", padding: "0.375rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, color: "#374151", borderBottom: "2px solid #e2e8f0" };
const td: React.CSSProperties = { padding: "0.3rem 0.5rem", fontSize: "0.8rem", verticalAlign: "middle" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, paddingTop: "3vh", overflowY: "auto" };
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: "10px", width: "min(96vw, 960px)", maxHeight: "94vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column" };
const statusColor = (s: ReviewItem["status"]) => s === "clean" ? "#059669" : s === "warning" ? "#d97706" : "#dc2626";
const statusBg = (s: ReviewItem["status"]) => s === "clean" ? "#d1fae5" : s === "warning" ? "#fef3c7" : "#fee2e2";

// ─────────────────────────────────────────────
// CSV PARSER
// ─────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    rows.push(cols);
  }
  return rows;
}

// Detect if header row uses new bilingual format (contains "question_primary" or "_primary" columns)
function isBilingualHeader(headerRow: string[]): boolean {
  return headerRow.some(h => h.toLowerCase().replace(/\s/g, "").includes("_primary"));
}

function parseCsvToReviewItems(text: string): { items: ReviewItem[]; parseErrors: string[] } {
  const rows = parseCSV(text);
  if (rows.length === 0) return { items: [], parseErrors: ["Empty file"] };

  const parseErrors: string[] = [];
  const items: ReviewItem[] = [];
  let passageText = "";
  let groupId = "";
  let groupOpen = false;
  let rowNum = 0;

  const HEADER_EXPECTED = "rowtype";
  const firstRowNorm = rows[0][0]?.toLowerCase().replace(/\s/g, "");
  const hasHeader = firstRowNorm === HEADER_EXPECTED;
  if (hasHeader) rowNum = 1;

  // Determine format: bilingual (new) or legacy (English-only)
  const bilingual = hasHeader && isBilingualHeader(rows[0]);

  for (let i = rowNum; i < rows.length; i++) {
    const r = rows[i];
    const get = (idx: number) => (r[idx] || "").trim();
    const rowType = get(0).toUpperCase() || "QUESTION";

    if (bilingual) {
      // ── BILINGUAL FORMAT ──────────────────────────────────────────────────
      // Col 0: RowType
      // Col 1: question_primary   Col 2: question_secondary
      // Col 3: optionA_primary    Col 4: optionA_secondary
      // Col 5: optionB_primary    Col 6: optionB_secondary
      // Col 7: optionC_primary    Col 8: optionC_secondary
      // Col 9: optionD_primary    Col 10: optionD_secondary
      // Col 11: CorrectOption
      // Col 12: explanation_primary  Col 13: explanation_secondary
      // Col 14: Category  Col 15: Subject  Col 16: Topic  Col 17: Subtopic
      // Col 18: Difficulty  Col 19: Marks  Col 20: NegativeMarks
      // Col 21: SourceTag  Col 22: GroupId
      if (rowType === "PASSAGE_START") {
        if (groupOpen) parseErrors.push(`Row ${i + 1}: PASSAGE_START before previous GROUP_END`);
        passageText = get(1);
        groupId = get(22) || `group_${i}`;
        groupOpen = true;
        continue;
      }
      if (rowType === "GROUP_END") { groupOpen = false; passageText = ""; groupId = ""; continue; }
      if (rowType !== "QUESTION" && rowType !== "") continue;

      const stem = get(1);
      const stemSecondary = get(2) || undefined;
      const optAPrimary = get(3), optASecondary = get(4) || undefined;
      const optBPrimary = get(5), optBSecondary = get(6) || undefined;
      const optCPrimary = get(7), optCSecondary = get(8) || undefined;
      const optDPrimary = get(9), optDSecondary = get(10) || undefined;
      const correctLetter = get(11).toUpperCase();
      const explanation = get(12);
      const explanationSecondary = get(13) || undefined;
      const category = get(14), subject = get(15), topic = get(16), subtopic = get(17);
      const diffRaw = get(18).toUpperCase();
      const marksRaw = get(19), negRaw = get(20);
      const sourceTag = get(21);
      const rowGroupId = get(22) || (groupOpen ? groupId : "");

      const errors: string[] = [];
      const warnings: string[] = [];
      if (!stem) errors.push("Missing question_primary (question stem)");
      if (!optAPrimary || !optBPrimary) errors.push("Missing required options (optionA_primary, optionB_primary)");
      if (!correctLetter || !CORRECT_OPT_MAP.hasOwnProperty(correctLetter)) errors.push(`Invalid CorrectOption "${get(11)}" — must be A, B, C, or D`);
      if (!explanation) warnings.push("No explanation_primary provided");
      if (!category) warnings.push("No category set");
      if (!diffRaw || !DIFFICULTIES.includes(diffRaw as any)) warnings.push("Difficulty not set — defaulting to FOUNDATIONAL");

      const primaryTexts = [optAPrimary, optBPrimary, optCPrimary, optDPrimary];
      const secondaryTexts = [optASecondary, optBSecondary, optCSecondary, optDSecondary];
      const correctIdx = CORRECT_OPT_MAP[correctLetter] ?? 0;
      const options = primaryTexts
        .map((text, idx) => ({ text, textSecondary: secondaryTexts[idx] || undefined, isCorrect: idx === correctIdx }))
        .filter(o => o.text);

      const difficulty = DIFFICULTIES.includes(diffRaw as any) ? diffRaw : "FOUNDATIONAL";
      const marks = parseFloat(marksRaw) > 0 ? parseFloat(marksRaw) : 1;
      const negativeMarks = parseFloat(negRaw) >= 0 ? parseFloat(negRaw) : 0;

      items.push({
        key: `csv_${i}_${Date.now()}`,
        isEdited: false,
        stem, stemSecondary, type: "MCQ_SINGLE", difficulty,
        explanation, explanationSecondary,
        categoryId: "", subjectId: "", topicId: "", subtopicId: "",
        sourceTag, marks, negativeMarks, options,
        passageText: groupOpen ? passageText : undefined,
        groupId: rowGroupId || undefined,
        status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "clean",
        errors, warnings, selected: false,
      });

    } else {
      // ── LEGACY FORMAT (English-only, backward compat) ─────────────────────
      // Col 0: RowType
      // Col 1: Stem  Col 2: OptionA  Col 3: OptionB  Col 4: OptionC  Col 5: OptionD
      // Col 6: CorrectOption  Col 7: Explanation
      // Col 8: Category  Col 9: Subject  Col 10: Topic  Col 11: Subtopic
      // Col 12: Difficulty  Col 13: Marks  Col 14: NegativeMarks
      // Col 15: SourceTag  Col 16: GroupId
      if (rowType === "PASSAGE_START") {
        if (groupOpen) parseErrors.push(`Row ${i + 1}: PASSAGE_START before previous GROUP_END`);
        passageText = get(1);
        groupId = get(16) || `group_${i}`;
        groupOpen = true;
        continue;
      }
      if (rowType === "GROUP_END") { groupOpen = false; passageText = ""; groupId = ""; continue; }
      if (rowType !== "QUESTION" && rowType !== "") continue;

      const stem = get(1);
      const optA = get(2), optB = get(3), optC = get(4), optD = get(5);
      const correctLetter = get(6).toUpperCase();
      const explanation = get(7);
      const category = get(8), subject = get(9), topic = get(10), subtopic = get(11);
      const diffRaw = get(12).toUpperCase();
      const marksRaw = get(13), negRaw = get(14);
      const sourceTag = get(15);
      const rowGroupId = get(16) || (groupOpen ? groupId : "");

      const errors: string[] = [];
      const warnings: string[] = [];
      if (!stem) errors.push("Missing question stem");
      if (!optA || !optB) errors.push("Missing required options (A, B)");
      if (!correctLetter || !CORRECT_OPT_MAP.hasOwnProperty(correctLetter)) errors.push(`Invalid CorrectOption "${get(6)}" — must be A, B, C, or D`);
      if (!explanation) warnings.push("No explanation provided");
      if (!category) warnings.push("No category set");
      if (!diffRaw || !DIFFICULTIES.includes(diffRaw as any)) warnings.push("Difficulty not set — defaulting to FOUNDATIONAL");

      const optTexts = [optA, optB, optC, optD].filter(Boolean);
      const correctIdx = CORRECT_OPT_MAP[correctLetter] ?? 0;
      const options = optTexts.map((text, idx) => ({ text, isCorrect: idx === correctIdx }));

      const difficulty = DIFFICULTIES.includes(diffRaw as any) ? diffRaw : "FOUNDATIONAL";
      const marks = parseFloat(marksRaw) > 0 ? parseFloat(marksRaw) : 1;
      const negativeMarks = parseFloat(negRaw) >= 0 ? parseFloat(negRaw) : 0;

      items.push({
        key: `csv_${i}_${Date.now()}`,
        isEdited: false,
        stem, type: "MCQ_SINGLE", difficulty,
        explanation, categoryId: "", subjectId: "", topicId: "", subtopicId: "",
        sourceTag, marks, negativeMarks, options,
        passageText: groupOpen ? passageText : undefined,
        groupId: rowGroupId || undefined,
        status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "clean",
        errors, warnings, selected: false,
      });
    }
  }

  if (groupOpen) parseErrors.push("Unclosed passage group — missing GROUP_END row");
  return { items, parseErrors };
}

// ─────────────────────────────────────────────
// ADD QUESTIONS MODAL
// ─────────────────────────────────────────────
type AddQuestionsModalProps = {
  testId: string;
  sectionId: string | null;
  sectionIndex: number | null;
  sectionTitle: string;
  targetCount: number;
  currentCount: number;
  onClose: () => void;
  onCommitted: (sections: any[], questions: any[], committedSectionIndex: number | null) => void;
};

function AddQuestionsModal({ testId, sectionId, sectionIndex, sectionTitle, targetCount, currentCount, onClose, onCommitted }: AddQuestionsModalProps) {
  type Stage = "source" | "upload" | "qbank" | "existingtest" | "create" | "review" | "committing" | "done";
  const [stage, setStage] = useState<Stage>("source");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [csvFilename, setCsvFilename] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // QB state
  const [qbSearch, setQbSearch] = useState("");
  const [qbDiff, setQbDiff] = useState("");
  const [qbType, setQbType] = useState("");
  const [qbCategoryId, setQbCategoryId] = useState("");
  const [qbSubjectId, setQbSubjectId] = useState("");
  const [qbCategories, setQbCategories] = useState<{ id: string; name: string }[]>([]);
  const [qbSubjects, setQbSubjects] = useState<{ id: string; name: string }[]>([]);
  const [qbSubjectsLoading, setQbSubjectsLoading] = useState(false);
  const [qbTopicId, setQbTopicId] = useState("");
  const [qbSubtopicId, setQbSubtopicId] = useState("");
  const [qbTopics, setQbTopics] = useState<{ id: string; name: string }[]>([]);
  const [qbSubtopics, setQbSubtopics] = useState<{ id: string; name: string }[]>([]);
  const [qbTopicsLoading, setQbTopicsLoading] = useState(false);
  const [qbSubtopicsLoading, setQbSubtopicsLoading] = useState(false);
  const [qbExpandedRow, setQbExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/taxonomy?level=category")
      .then(r => r.json())
      .then(d => setQbCategories((d.data || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);
  const [qbResults, setQbResults] = useState<QuestionItem[]>([]);
  const [qbLoading, setQbLoading] = useState(false);
  const [qbPage, setQbPage] = useState(1);
  const [qbTotalPages, setQbTotalPages] = useState(1);
  const [qbSelected, setQbSelected] = useState<Set<string>>(new Set());

  // Existing test state
  const [etList, setEtList] = useState<{ id: string; title: string }[]>([]);
  const [etSelected, setEtSelected] = useState("");
  const [etQuestions, setEtQuestions] = useState<QuestionItem[]>([]);
  const [etLoading, setEtLoading] = useState(false);
  const [etChosen, setEtChosen] = useState<Set<string>>(new Set());

  // Review state
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulk, setBulk] = useState({ type: "", difficulty: "", marks: "", negativeMarks: "", sourceTag: "" });

  // Commit state
  const [commitResult, setCommitResult] = useState<{ committed: number; skipped: number; errors: string[] } | null>(null);

  // Create-single-question state
  const [cqForm, setCqForm] = useState({
    type: "MCQ_SINGLE", stem: "", explanation: "", difficulty: "MODERATE",
    marks: "1", negativeMarks: "0",
    categoryId: "", subjectId: "", topicId: "", subtopicId: "",
  });
  const [cqOptions, setCqOptions] = useState<{ text: string; isCorrect: boolean }[]>([
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
    { text: "", isCorrect: false }, { text: "", isCorrect: false },
  ]);
  const [cqSubjects, setCqSubjects] = useState<TaxoNode[]>([]);
  const [cqTopics, setCqTopics] = useState<TaxoNode[]>([]);
  const [cqSubtopics, setCqSubtopics] = useState<TaxoNode[]>([]);
  const [cqSaving, setCqSaving] = useState(false);
  const [cqError, setCqError] = useState("");

  // Taxonomy for review editing
  const [taxoCategories, setTaxoCategories] = useState<TaxoNode[]>([]);
  const [taxoSubjects, setTaxoSubjects] = useState<TaxoNode[]>([]);
  const [taxoTopics, setTaxoTopics] = useState<TaxoNode[]>([]);
  const [taxoSubtopics, setTaxoSubtopics] = useState<TaxoNode[]>([]);

  // Load taxonomy once
  useEffect(() => {
    fetch("/api/taxonomy?tree=true").then(r => r.json()).then(d => {
      const cats: TaxoNode[] = [], subs: TaxoNode[] = [], tops: TaxoNode[] = [], subtops: TaxoNode[] = [];
      for (const cat of (d.data || [])) {
        cats.push({ id: cat.id, name: cat.name });
        for (const sub of (cat.subjects || [])) {
          subs.push({ id: sub.id, name: `${cat.name} > ${sub.name}` });
          for (const top of (sub.topics || [])) {
            tops.push({ id: top.id, name: `${sub.name} > ${top.name}` });
            for (const stop of (top.subtopics || [])) {
              subtops.push({ id: stop.id, name: `${top.name} > ${stop.name}` });
            }
          }
        }
      }
      setTaxoCategories(cats); setTaxoSubjects(subs); setTaxoTopics(tops); setTaxoSubtopics(subtops);
    }).catch(() => {});
  }, []);

  // Load existing tests list
  useEffect(() => {
    if (stage === "existingtest") {
      fetch("/api/tests?limit=100").then(r => r.json()).then(d => {
        setEtList((d.data || []).map((t: any) => ({ id: t.id, title: t.title })));
      }).catch(() => {});
    }
  }, [stage]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { items, parseErrors: pe } = parseCsvToReviewItems(text);
      setParseErrors(pe);
      setReviewItems(items);
      setStage("review");
    };
    reader.readAsText(file, "utf-8");
  }

  function openCreate() {
    setCqForm({ type: "MCQ_SINGLE", stem: "", explanation: "", difficulty: "MODERATE", marks: "1", negativeMarks: "0", categoryId: "", subjectId: "", topicId: "", subtopicId: "" });
    setCqOptions([{ text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }]);
    setCqSubjects([]); setCqTopics([]); setCqSubtopics([]);
    setCqError("");
    setStage("create");
  }

  async function cqLoadSubjects(categoryId: string) {
    if (!categoryId) { setCqSubjects([]); setCqTopics([]); setCqSubtopics([]); return; }
    const d = await fetch(`/api/taxonomy?level=subject&parentId=${categoryId}`).then(r => r.json());
    setCqSubjects((d.data || []).map((s: any) => ({ id: s.id, name: s.name })));
    setCqTopics([]); setCqSubtopics([]);
  }

  async function cqLoadTopics(subjectId: string) {
    if (!subjectId) { setCqTopics([]); setCqSubtopics([]); return; }
    const d = await fetch(`/api/taxonomy?level=topic&parentId=${subjectId}`).then(r => r.json());
    setCqTopics((d.data || []).map((t: any) => ({ id: t.id, name: t.name })));
    setCqSubtopics([]);
  }

  async function cqLoadSubtopics(topicId: string) {
    if (!topicId) { setCqSubtopics([]); return; }
    const d = await fetch(`/api/taxonomy?level=subtopic&parentId=${topicId}`).then(r => r.json());
    setCqSubtopics((d.data || []).map((s: any) => ({ id: s.id, name: s.name })));
  }

  async function handleCqSave() {
    setCqError("");
    const isMCQ = ["MCQ_SINGLE", "MCQ_MULTIPLE"].includes(cqForm.type);
    if (!hasVisibleText(cqForm.stem)) { setCqError("Question stem is required."); return; }
    if (isMCQ) {
      const filled = cqOptions.filter(o => o.text.trim());
      if (filled.length < 2) { setCqError("MCQ requires at least 2 options with text."); return; }
      const correctCount = cqOptions.filter(o => o.isCorrect).length;
      if (cqForm.type === "MCQ_SINGLE" && correctCount !== 1) { setCqError("MCQ_SINGLE must have exactly 1 correct option."); return; }
      if (cqForm.type === "MCQ_MULTIPLE" && correctCount < 1) { setCqError("MCQ_MULTIPLE must have at least 1 correct option."); return; }
    }
    setCqSaving(true);
    try {
      const payload: any = {
        type: cqForm.type,
        difficulty: cqForm.difficulty,
        stem: cqForm.stem,
        explanation: cqForm.explanation || null,
        status: "APPROVED",
        confirmNearDuplicate: true,
        categoryId: cqForm.categoryId || null,
        subjectId: cqForm.subjectId || null,
        topicId: cqForm.topicId || null,
        subtopicId: cqForm.subtopicId || null,
      };
      if (isMCQ) {
        payload.options = cqOptions.filter(o => o.text.trim()).map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect }));
      }
      const res = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { setCqError(d.error || "Failed to create question."); return; }
      const q = d.data;
      const reviewItem: ReviewItem = {
        key: `cq_${q.id}_${Date.now()}`,
        existingQuestionId: q.id,
        isEdited: false,
        stem: q.stem, type: q.type, difficulty: q.difficulty,
        explanation: q.explanation || "",
        categoryId: q.categoryId || "", subjectId: q.subjectId || "",
        topicId: q.topicId || "", subtopicId: q.subtopicId || "",
        sourceTag: "", marks: parseFloat(cqForm.marks) || 1, negativeMarks: parseFloat(cqForm.negativeMarks) || 0,
        options: (q.options || []).map((o: any) => ({ text: o.text, isCorrect: o.isCorrect })),
        status: "clean", errors: [], warnings: [], selected: false,
      };
      setReviewItems(prev => [...prev, reviewItem]);
      setStage("review");
    } catch { setCqError("Network error. Please try again."); }
    finally { setCqSaving(false); }
  }

  async function loadQBResults(pg = 1) {
    setQbLoading(true);
    try {
      const p = new URLSearchParams({ page: String(pg), limit: "20" });
      if (qbSearch) p.set("search", qbSearch);
      if (qbDiff) p.set("difficulty", qbDiff);
      if (qbType) p.set("type", qbType);
      if (qbSubtopicId) p.set("subtopicId", qbSubtopicId);
      else if (qbTopicId) p.set("topicId", qbTopicId);
      else if (qbSubjectId) p.set("subjectId", qbSubjectId);
      else if (qbCategoryId) p.set("categoryId", qbCategoryId);
      const d = await fetch(`/api/questions?${p}`).then(r => r.json());
      setQbResults(d.data || []);
      setQbTotalPages(d.pagination?.totalPages || 1);
      setQbPage(pg);
    } finally { setQbLoading(false); }
  }

  async function loadQbSubjects(categoryId: string) {
    if (!categoryId) { setQbSubjects([]); setQbTopics([]); setQbSubtopics([]); setQbTopicId(""); setQbSubtopicId(""); return; }
    setQbSubjectsLoading(true);
    setQbTopics([]); setQbSubtopics([]); setQbTopicId(""); setQbSubtopicId("");
    try {
      const d = await fetch(`/api/taxonomy?level=subject&parentId=${categoryId}`).then(r => r.json());
      setQbSubjects((d.data || []).map((s: any) => ({ id: s.id, name: s.name })));
    } catch { setQbSubjects([]); }
    finally { setQbSubjectsLoading(false); }
  }

  async function loadQbTopics(subjectId: string) {
    if (!subjectId) { setQbTopics([]); setQbSubtopics([]); setQbTopicId(""); setQbSubtopicId(""); return; }
    setQbTopicsLoading(true);
    setQbSubtopics([]); setQbTopicId(""); setQbSubtopicId("");
    try {
      const d = await fetch(`/api/taxonomy?level=topic&parentId=${subjectId}`).then(r => r.json());
      setQbTopics((d.data || []).map((t: any) => ({ id: t.id, name: t.name })));
    } catch { setQbTopics([]); }
    finally { setQbTopicsLoading(false); }
  }

  async function loadQbSubtopics(topicId: string) {
    if (!topicId) { setQbSubtopics([]); setQbSubtopicId(""); return; }
    setQbSubtopicsLoading(true);
    setQbSubtopicId("");
    try {
      const d = await fetch(`/api/taxonomy?level=subtopic&parentId=${topicId}`).then(r => r.json());
      setQbSubtopics((d.data || []).map((s: any) => ({ id: s.id, name: s.name })));
    } catch { setQbSubtopics([]); }
    finally { setQbSubtopicsLoading(false); }
  }

  function quickEditQBQuestion(q: QuestionItem) {
    const options = (q.options || []).map(o => ({ text: o.text, isCorrect: o.isCorrect }));
    const existingIdx = reviewItems.findIndex(r => r.existingQuestionId === q.id);
    if (existingIdx >= 0) {
      setEditingIdx(existingIdx);
      return;
    }
    const item: ReviewItem = {
      key: `qb_${q.id}_${Date.now()}`,
      existingQuestionId: q.id,
      isEdited: false,
      stem: q.stem, type: q.type, difficulty: q.difficulty,
      explanation: q.explanation || "", categoryId: q.categoryId || "",
      subjectId: q.subjectId || "", topicId: q.topicId || "", subtopicId: q.subtopicId || "",
      sourceTag: "", marks: 1, negativeMarks: 0, options,
      status: "clean" as const, errors: [], warnings: [], selected: false,
    };
    setReviewItems(prev => {
      const next = [...prev, item];
      setTimeout(() => setEditingIdx(next.length - 1), 0);
      return next;
    });
    setQbSelected(prev => { const s = new Set(prev); s.add(q.id); return s; });
  }

  function importQBSelected() {
    const items: ReviewItem[] = qbResults
      .filter(q => qbSelected.has(q.id))
      .map(q => {
        const options = (q.options || []).map(o => ({ text: o.text, isCorrect: o.isCorrect }));
        return {
          key: `qb_${q.id}_${Date.now()}`,
          existingQuestionId: q.id,
          isEdited: false,
          stem: q.stem, type: q.type, difficulty: q.difficulty,
          explanation: q.explanation || "", categoryId: q.categoryId || "",
          subjectId: q.subjectId || "", topicId: q.topicId || "", subtopicId: q.subtopicId || "",
          sourceTag: "", marks: 1, negativeMarks: 0, options,
          status: "clean" as const, errors: [], warnings: [], selected: false,
        };
      });
    setReviewItems(prev => [...prev, ...items]);
    setStage("review");
  }

  async function loadEtQuestions(id: string) {
    setEtLoading(true);
    setEtSelected(id);
    try {
      const d = await fetch(`/api/tests/${id}`).then(r => r.json());
      const qs = (d.data?.questions || []).map((tq: any) => tq.question).filter(Boolean);
      setEtQuestions(qs);
    } finally { setEtLoading(false); }
  }

  function importEtSelected() {
    const items: ReviewItem[] = etQuestions
      .filter(q => etChosen.has(q.id))
      .map(q => {
        const options = (q.options || []).map(o => ({ text: o.text, isCorrect: o.isCorrect }));
        return {
          key: `et_${q.id}_${Date.now()}`,
          existingQuestionId: q.id,
          isEdited: false,
          stem: q.stem, type: q.type, difficulty: q.difficulty,
          explanation: q.explanation || "", categoryId: q.categoryId || "",
          subjectId: q.subjectId || "", topicId: q.topicId || "", subtopicId: q.subtopicId || "",
          sourceTag: "", marks: 1, negativeMarks: 0, options,
          status: "clean" as const, errors: [], warnings: [], selected: false,
        };
      });
    setReviewItems(prev => [...prev, ...items]);
    setStage("review");
  }

  function revalidate(items: ReviewItem[]): ReviewItem[] {
    return items.map(item => {
      const errors: string[] = [];
      const warnings: string[] = [];
      if (!item.stem.trim()) errors.push("Missing stem");
      if (item.options.length < 2) errors.push("Need at least 2 options");
      if (!item.options.some(o => o.isCorrect)) errors.push("No correct answer selected");
      if (!item.explanation) warnings.push("No explanation");
      if (!item.categoryId) warnings.push("No category");
      return { ...item, errors, warnings, status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "clean" };
    });
  }

  function updateItem(idx: number, patch: Partial<ReviewItem>) {
    setReviewItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, isEdited: true };
      return revalidate(next);
    });
  }

  function removeItem(idx: number) {
    setReviewItems(prev => prev.filter((_, i) => i !== idx));
  }

  function applyBulkEdit() {
    setReviewItems(prev => {
      const next = prev.map(item => {
        if (!item.selected) return item;
        const patch: Partial<ReviewItem> = { isEdited: true };
        if (bulk.type) patch.type = bulk.type;
        if (bulk.difficulty) patch.difficulty = bulk.difficulty;
        if (bulk.marks) patch.marks = parseFloat(bulk.marks) || item.marks;
        if (bulk.negativeMarks !== "") patch.negativeMarks = parseFloat(bulk.negativeMarks) || 0;
        if (bulk.sourceTag) patch.sourceTag = bulk.sourceTag;
        return { ...item, ...patch };
      });
      return revalidate(next);
    });
    setBulk({ type: "", difficulty: "", marks: "", negativeMarks: "", sourceTag: "" });
    setBulkMode(false);
  }

  async function handleCommit() {
    const hasErrors = reviewItems.some(i => i.status === "error");
    if (hasErrors) { alert("Fix all errors before committing."); return; }
    setStage("committing");
    try {
      const res = await fetch("/api/tests/add-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, sectionId, questions: reviewItems }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || "Commit failed"); setStage("review"); return; }
      setCommitResult({ committed: d.data.committed, skipped: d.data.skipped, errors: d.data.errors });
      onCommitted(d.data.sections, d.data.questions, sectionIndex);
      setStage("done");
    } catch { setStage("review"); alert("Network error"); }
  }

  const allSelected = reviewItems.length > 0 && reviewItems.every(i => i.selected);
  const selectedCount = reviewItems.filter(i => i.selected).length;
  const errorCount = reviewItems.filter(i => i.status === "error").length;
  const warnCount = reviewItems.filter(i => i.status === "warning").length;

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBox}>
        {/* HEADER */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "#fafafa", borderRadius: "10px 10px 0 0" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "#111" }}>Add Questions</div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
              {sectionTitle} &nbsp;·&nbsp;
              <span style={{ color: currentCount > targetCount && targetCount > 0 ? "#dc2626" : "#059669", fontWeight: 700 }}>
                {currentCount + reviewItems.length}/{targetCount > 0 ? targetCount : "∞"}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={btn("#6b7280")}>✕ Close</button>
        </div>

        {/* STAGE: SOURCE */}
        {stage === "source" && (
          <div style={{ padding: "2rem 1.5rem" }}>
            <p style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "1.5rem", fontWeight: 600 }}>Choose a source to add questions from:</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
              {[
                { key: "upload", icon: "📂", title: "Upload CSV / DOCX", desc: "Parse a file, validate & review before committing" },
                { key: "qbank", icon: "🗃️", title: "From Question Bank", desc: "Search, filter and pick from existing questions" },
                { key: "existingtest", icon: "📋", title: "From Existing Test", desc: "Reuse questions from another test (edits create new records)" },
                { key: "create", icon: "✏️", title: "Create Single Question", desc: "Author one question directly and attach it to this test" },
              ].map(src => (
                <button key={src.key} onClick={() => { if (src.key === "create") { openCreate(); } else { setStage(src.key as Stage); if (src.key === "qbank") loadQBResults(1); } }}
                  style={{ border: "2px solid #e2e8f0", borderRadius: "10px", padding: "1.25rem 1rem", background: "#fff", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = BRAND.purple)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#e2e8f0")}>
                  <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>{src.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{src.title}</div>
                  <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{src.desc}</div>
                </button>
              ))}
            </div>
            {reviewItems.length > 0 && (
              <div style={{ padding: "0.75rem 1rem", background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "8px", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.875rem", color: "#065f46" }}>{reviewItems.length} questions already in review workspace</span>
                <button onClick={() => setStage("review")} style={btn(BRAND.purple)}>Back to Review</button>
              </div>
            )}

            {/* Templates section */}
            <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem" }}>📎 Templates & Import Rules</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <a href="/templates/question-import-sample.csv" download style={{ ...btn("#7c3aed"), textDecoration: "none", display: "inline-block" }}>⬇ Legacy CSV (English-only)</a>
                <a href="/templates/question-import-bilingual-sample.csv" download style={{ ...btn("#059669"), textDecoration: "none", display: "inline-block" }}>⬇ Bilingual CSV (Primary + Secondary)</a>
                <a href="/templates/import-rules.txt" download style={{ ...btn("#6b7280"), textDecoration: "none", display: "inline-block" }}>📋 Import Rules</a>
              </div>
              <p style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "0.5rem" }}>
                <strong>Legacy format</strong>: RowType, Stem, OptionA–D, CorrectOption, Explanation, Category, Subject, Topic, Subtopic, Difficulty, Marks, NegativeMarks, SourceTag, GroupId<br />
                <strong>Bilingual format</strong>: RowType, question_primary, question_secondary, optionA_primary, optionA_secondary, optionB_primary, optionB_secondary, optionC_primary, optionC_secondary, optionD_primary, optionD_secondary, CorrectOption, explanation_primary, explanation_secondary, Category, Subject, Topic, Subtopic, Difficulty, Marks, NegativeMarks, SourceTag, GroupId
              </p>
            </div>
          </div>
        )}

        {/* STAGE: UPLOAD CSV */}
        {stage === "upload" && (
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
              <button onClick={() => setStage("source")} style={btn("#6b7280")}>← Back</button>
            </div>
            <div style={{ border: "2px dashed #c4b5fd", borderRadius: "12px", padding: "2.5rem", textAlign: "center", background: "#faf5ff", marginBottom: "1.5rem", cursor: "pointer" }}
              onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📂</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#7c3aed" }}>
                {csvFilename || "Click to upload CSV file"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>UTF-8 CSV only · Max 5000 rows</div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={handleFileChange} />
            </div>
            {parseErrors.length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#dc2626" }}>Parse Errors</div>
                {parseErrors.map((e, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#dc2626" }}>• {e}</div>)}
              </div>
            )}
            <div style={{ padding: "1rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#0369a1", marginBottom: "0.5rem" }}>DOCX Upload</div>
              <div style={{ fontSize: "0.78rem", color: "#0369a1" }}>DOCX parsing is coming soon. For now, paste content into a CSV using the sample template.</div>
            </div>
          </div>
        )}

        {/* STAGE: QUESTION BANK */}
        {stage === "qbank" && (
          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
              <button onClick={() => setStage("source")} style={btn("#6b7280")}>← Back</button>
              <span style={{ fontSize: "0.875rem", color: "#374151", fontWeight: 600 }}>From Question Bank</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <select
                  value={qbCategoryId}
                  onChange={e => {
                    const catId = e.target.value;
                    setQbCategoryId(catId);
                    setQbSubjectId("");
                    loadQbSubjects(catId);
                  }}
                  style={inp}
                >
                  <option value="">All Categories</option>
                  {qbCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select
                  value={qbSubjectId}
                  onChange={e => { const v = e.target.value; setQbSubjectId(v); loadQbTopics(v); }}
                  style={inp}
                  disabled={!qbCategoryId || qbSubjectsLoading}
                >
                  <option value="">{qbSubjectsLoading ? "Loading…" : qbCategoryId ? "All Subjects" : "— Select Category first —"}</option>
                  {qbSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <select
                  value={qbTopicId}
                  onChange={e => { const v = e.target.value; setQbTopicId(v); loadQbSubtopics(v); }}
                  style={inp}
                  disabled={!qbSubjectId || qbTopicsLoading}
                >
                  <option value="">{qbTopicsLoading ? "Loading…" : qbSubjectId ? "All Topics" : "— Select Subject first —"}</option>
                  {qbTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select
                  value={qbSubtopicId}
                  onChange={e => setQbSubtopicId(e.target.value)}
                  style={inp}
                  disabled={!qbTopicId || qbSubtopicsLoading}
                >
                  <option value="">{qbSubtopicsLoading ? "Loading…" : qbTopicId ? "All Sub-topics" : "— Select Topic first —"}</option>
                  {qbSubtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.5rem" }}>
                <input value={qbSearch} onChange={e => setQbSearch(e.target.value)} placeholder="Search stem..." style={inp} onKeyDown={e => e.key === "Enter" && loadQBResults(1)} />
                <select value={qbType} onChange={e => setQbType(e.target.value)} style={inp}>
                  <option value="">All Types</option>
                  {Q_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={qbDiff} onChange={e => setQbDiff(e.target.value)} style={inp}>
                  <option value="">All Difficulties</option>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <button onClick={() => loadQBResults(1)} style={btn(BRAND.purple)}>Search</button>
              </div>
            </div>
            {qbLoading ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</div> : (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={th}></th><th style={th}>Type</th><th style={th}>Stem</th><th style={th}>Diff</th><th style={th}>Status</th><th style={th}>Actions</th>
                  </tr></thead>
                  <tbody>
                    {qbResults.map(q => (
                      <React.Fragment key={q.id}>
                        <tr style={{ borderBottom: qbExpandedRow === q.id ? "none" : "1px solid #f1f5f9", background: qbSelected.has(q.id) ? "#faf5ff" : undefined }}>
                          <td style={td}><input type="checkbox" checked={qbSelected.has(q.id)} onChange={e => {
                            const s = new Set(qbSelected);
                            e.target.checked ? s.add(q.id) : s.delete(q.id);
                            setQbSelected(s);
                          }} /></td>
                          <td style={td}><span style={{ fontSize: "0.7rem", background: "#e0e7ff", color: "#3730a3", padding: "1px 5px", borderRadius: "4px" }}>{q.type}</span></td>
                          <td style={{ ...td, maxWidth: "300px" }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.stem}</span></td>
                          <td style={td}>{q.difficulty}</td>
                          <td style={td}><span style={{ fontSize: "0.7rem", background: q.status === "APPROVED" ? "#d1fae5" : "#fee2e2", color: q.status === "APPROVED" ? "#065f46" : "#991b1b", padding: "1px 5px", borderRadius: "4px" }}>{q.status}</span></td>
                          <td style={td}>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              <button
                                onClick={() => setQbExpandedRow(qbExpandedRow === q.id ? null : q.id)}
                                style={{ ...btn(qbExpandedRow === q.id ? "#6b7280" : "#e0e7ff", qbExpandedRow === q.id ? "#fff" : "#3730a3"), fontSize: "0.68rem", padding: "2px 6px" }}
                                title="Preview options & explanation"
                              >{qbExpandedRow === q.id ? "▲ Hide" : "▼ Preview"}</button>
                              <button
                                onClick={() => quickEditQBQuestion(q)}
                                style={{ ...btn("#7c3aed"), fontSize: "0.68rem", padding: "2px 6px" }}
                                title="Select & open full editor"
                              >✎ Edit</button>
                            </div>
                          </td>
                        </tr>
                        {qbExpandedRow === q.id && (
                          <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fafbff" }}>
                            <td colSpan={6} style={{ padding: "0.625rem 1rem 0.75rem 2.5rem" }}>
                              {q.options && q.options.length > 0 && (
                                <div style={{ marginBottom: "0.5rem" }}>
                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginBottom: "0.25rem" }}>Options</div>
                                  {q.options.map((opt: any, oi: number) => (
                                    <div key={oi} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.2rem" }}>
                                      <span style={{ fontSize: "0.7rem", minWidth: "14px", color: opt.isCorrect ? "#059669" : "#94a3b8", fontWeight: 700 }}>{opt.isCorrect ? "✓" : String.fromCharCode(65 + oi)}</span>
                                      <span style={{ fontSize: "0.78rem", color: opt.isCorrect ? "#059669" : "#374151", fontWeight: opt.isCorrect ? 600 : 400 }}>{opt.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.explanation && (
                                <div>
                                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6b7280", marginBottom: "0.2rem" }}>Explanation</div>
                                  <div style={{ fontSize: "0.78rem", color: "#374151", whiteSpace: "pre-wrap" }}>{q.explanation}</div>
                                </div>
                              )}
                              {!q.explanation && (!q.options || q.options.length === 0) && (
                                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>No preview data available.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {qbResults.length === 0 && <div style={{ textAlign: "center", padding: "1.5rem", color: "#888", fontSize: "0.875rem" }}>No questions found. Try a different search.</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => loadQBResults(qbPage - 1)} disabled={qbPage <= 1} style={btn(qbPage <= 1 ? "#e2e8f0" : "#6b7280", qbPage <= 1 ? "#94a3b8" : "#fff")}>Prev</button>
                    <span style={{ fontSize: "0.8rem", color: "#666", lineHeight: "2" }}>Page {qbPage}/{qbTotalPages}</span>
                    <button onClick={() => loadQBResults(qbPage + 1)} disabled={qbPage >= qbTotalPages} style={btn(qbPage >= qbTotalPages ? "#e2e8f0" : "#6b7280", qbPage >= qbTotalPages ? "#94a3b8" : "#fff")}>Next</button>
                  </div>
                  <button onClick={importQBSelected} disabled={qbSelected.size === 0} style={btn(qbSelected.size === 0 ? "#e2e8f0" : BRAND.purple, qbSelected.size === 0 ? "#94a3b8" : "#fff")}>
                    → Import {qbSelected.size > 0 ? `${qbSelected.size} Selected` : ""}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STAGE: FROM EXISTING TEST */}
        {stage === "existingtest" && (
          <div style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
              <button onClick={() => setStage("source")} style={btn("#6b7280")}>← Back</button>
              <span style={{ fontSize: "0.875rem", color: "#374151", fontWeight: 600 }}>From Existing Test</span>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={lbl}>Select Test</label>
              <select value={etSelected} onChange={e => loadEtQuestions(e.target.value)} style={inp}>
                <option value="">-- Choose a test --</option>
                {etList.filter(t => t.id !== testId).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            {etLoading ? <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</div> : etQuestions.length > 0 && (
              <>
                <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                  ℹ️ Tweaked/edited questions will be saved as new Question Bank entries.
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={th}></th><th style={th}>Type</th><th style={th}>Stem</th><th style={th}>Diff</th>
                  </tr></thead>
                  <tbody>
                    {etQuestions.map(q => (
                      <tr key={q.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={td}><input type="checkbox" checked={etChosen.has(q.id)} onChange={e => {
                          const s = new Set(etChosen);
                          e.target.checked ? s.add(q.id) : s.delete(q.id);
                          setEtChosen(s);
                        }} /></td>
                        <td style={td}><span style={{ fontSize: "0.7rem", background: "#e0e7ff", color: "#3730a3", padding: "1px 5px", borderRadius: "4px" }}>{q.type}</span></td>
                        <td style={{ ...td, maxWidth: "360px" }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.stem}</span></td>
                        <td style={td}>{q.difficulty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                  <button onClick={importEtSelected} disabled={etChosen.size === 0} style={btn(etChosen.size === 0 ? "#e2e8f0" : BRAND.purple, etChosen.size === 0 ? "#94a3b8" : "#fff")}>
                    → Import {etChosen.size > 0 ? `${etChosen.size} Selected` : ""}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STAGE: REVIEW WORKSPACE */}
        {stage === "review" && (
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
            {/* Review header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={() => setStage("source")} style={btn("#6b7280")}>+ Add More</button>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#111" }}>{reviewItems.length} questions in workspace</span>
              {errorCount > 0 && <span style={{ fontSize: "0.78rem", background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: "4px" }}>⚠ {errorCount} errors</span>}
              {warnCount > 0 && <span style={{ fontSize: "0.78rem", background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "4px" }}>{warnCount} warnings</span>}
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                <button onClick={() => setBulkMode(b => !b)} style={btn(bulkMode ? BRAND.purple : "#e0e7ff", bulkMode ? "#fff" : "#3730a3")}>
                  {bulkMode ? "✓ Bulk Edit On" : "Bulk Edit"}
                </button>
                <button onClick={handleCommit} disabled={errorCount > 0 || reviewItems.length === 0}
                  style={btn(errorCount > 0 || reviewItems.length === 0 ? "#e2e8f0" : "#059669", errorCount > 0 || reviewItems.length === 0 ? "#94a3b8" : "#fff")}>
                  ✓ Commit {reviewItems.length} Questions
                </button>
              </div>
            </div>

            {parseErrors.length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.625rem 0.875rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#dc2626" }}>Parse Errors (questions still loaded):</div>
                {parseErrors.map((e, i) => <div key={i} style={{ fontSize: "0.78rem", color: "#dc2626" }}>• {e}</div>)}
              </div>
            )}

            {/* Bulk edit panel */}
            {bulkMode && selectedCount > 0 && (
              <div style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "0.875rem 1rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#065f46", marginBottom: "0.625rem" }}>Bulk Edit — {selectedCount} selected</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: "0.5rem", alignItems: "flex-end" }}>
                  <div>
                    <label style={lbl}>Type</label>
                    <select value={bulk.type} onChange={e => setBulk(b => ({ ...b, type: e.target.value }))} style={inp}>
                      <option value="">— keep —</option>
                      {Q_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Difficulty</label>
                    <select value={bulk.difficulty} onChange={e => setBulk(b => ({ ...b, difficulty: e.target.value }))} style={inp}>
                      <option value="">— keep —</option>
                      {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Marks</label>
                    <input type="number" step="0.25" value={bulk.marks} onChange={e => setBulk(b => ({ ...b, marks: e.target.value }))} placeholder="keep" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Neg Marks</label>
                    <input type="number" step="0.25" value={bulk.negativeMarks} onChange={e => setBulk(b => ({ ...b, negativeMarks: e.target.value }))} placeholder="keep" style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Source Tag</label>
                    <input value={bulk.sourceTag} onChange={e => setBulk(b => ({ ...b, sourceTag: e.target.value }))} placeholder="keep" style={inp} />
                  </div>
                  <button onClick={applyBulkEdit} style={{ ...btn("#059669"), whiteSpace: "nowrap" }}>Apply</button>
                </div>
              </div>
            )}

            {/* Review table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                    {bulkMode && <th style={th}><input type="checkbox" checked={allSelected} onChange={e => setReviewItems(prev => prev.map(i => ({ ...i, selected: e.target.checked })))} /></th>}
                    <th style={th}>#</th>
                    <th style={th}>Status</th>
                    <th style={{ ...th, minWidth: "220px" }}>Stem</th>
                    <th style={th}>Type</th>
                    <th style={th}>Diff</th>
                    <th style={th}>+Marks</th>
                    <th style={th}>−Marks</th>
                    <th style={th}>Group</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewItems.map((item, idx) => (
                    <tr key={item.key} style={{ borderBottom: "1px solid #f1f5f9", background: item.selected ? "#faf5ff" : undefined }}>
                      {bulkMode && <td style={td}><input type="checkbox" checked={item.selected} onChange={e => setReviewItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: e.target.checked } : it))} /></td>}
                      <td style={{ ...td, color: "#94a3b8" }}>{idx + 1}</td>
                      <td style={td}>
                        <span style={{ fontSize: "0.7rem", padding: "2px 6px", borderRadius: "10px", background: statusBg(item.status), color: statusColor(item.status), fontWeight: 700 }}>
                          {item.status === "clean" ? "✓ Clean" : item.status === "warning" ? "⚠ Warn" : "✕ Error"}
                          {item.isEdited && " •Edited"}
                        </span>
                        {item.errors.length > 0 && (
                          <div style={{ fontSize: "0.68rem", color: "#dc2626", marginTop: "2px" }}>{item.errors[0]}</div>
                        )}
                        {item.warnings.length > 0 && item.errors.length === 0 && (
                          <div style={{ fontSize: "0.68rem", color: "#d97706", marginTop: "2px" }}>{item.warnings[0]}</div>
                        )}
                      </td>
                      <td style={{ ...td, maxWidth: "220px" }}>
                        {item.passageText && <div style={{ fontSize: "0.68rem", background: "#e0f2fe", color: "#0369a1", padding: "1px 5px", borderRadius: "4px", marginBottom: "2px", display: "inline-block" }}>📖 Passage</div>}
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.stem}</span>
                      </td>
                      <td style={td}><span style={{ fontSize: "0.7rem", background: "#e0e7ff", color: "#3730a3", padding: "1px 5px", borderRadius: "4px" }}>{item.type}</span></td>
                      <td style={td}>{item.difficulty.slice(0, 3)}</td>
                      <td style={td}><span style={{ color: "#059669", fontWeight: 700 }}>+{item.marks}</span></td>
                      <td style={td}><span style={{ color: item.negativeMarks > 0 ? "#dc2626" : "#94a3b8" }}>−{item.negativeMarks}</span></td>
                      <td style={{ ...td, fontSize: "0.7rem", color: "#6b7280" }}>{item.groupId || "—"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <button onClick={() => setEditingIdx(idx)} style={btn("#7c3aed")}>Edit</button>
                          <button onClick={() => removeItem(idx)} style={btn("#dc2626")}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reviewItems.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "#888", fontSize: "0.875rem" }}>No questions yet. Go back to add from a source.</div>}
            </div>
          </div>
        )}

        {/* STAGE: CREATE SINGLE QUESTION */}
        {stage === "create" && (
          <div style={{ padding: "1.5rem", overflowY: "auto" }}>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "center" }}>
              <button onClick={() => setStage("source")} style={btn("#6b7280")}>← Back</button>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111" }}>Create Single Question</span>
            </div>

            {cqError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.625rem 0.875rem", marginBottom: "1rem", color: "#dc2626", fontSize: "0.8125rem" }}>
                {cqError}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={lbl}>Question Type *</label>
                <select value={cqForm.type} onChange={e => setCqForm(f => ({ ...f, type: e.target.value, }))} style={inp}>
                  <option value="MCQ_SINGLE">MCQ — Single Answer</option>
                  <option value="MCQ_MULTIPLE">MCQ — Multiple Answers</option>
                  <option value="TRUE_FALSE">True / False</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Difficulty *</label>
                <select value={cqForm.difficulty} onChange={e => setCqForm(f => ({ ...f, difficulty: e.target.value }))} style={inp}>
                  <option value="FOUNDATIONAL">Foundational</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={lbl}>Question Stem *</label>
              <RichEditor
                value={cqForm.stem}
                onChange={(html) => setCqForm(f => ({ ...f, stem: html }))}
                placeholder="Enter question text, paste an image, or insert an equation…"
                minHeight={80}
              />
            </div>

            {["MCQ_SINGLE", "MCQ_MULTIPLE"].includes(cqForm.type) && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={lbl}>Options * {cqForm.type === "MCQ_SINGLE" ? "(mark exactly 1 correct)" : "(mark at least 1 correct)"}</label>
                {cqOptions.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.375rem" }}>
                    <input type={cqForm.type === "MCQ_SINGLE" ? "radio" : "checkbox"}
                      name="cqCorrect"
                      checked={opt.isCorrect}
                      onChange={e => {
                        if (cqForm.type === "MCQ_SINGLE") {
                          setCqOptions(prev => prev.map((o, j) => ({ ...o, isCorrect: j === i })));
                        } else {
                          setCqOptions(prev => prev.map((o, j) => j === i ? { ...o, isCorrect: e.target.checked } : o));
                        }
                      }} />
                    <input value={opt.text} onChange={e => setCqOptions(prev => prev.map((o, j) => j === i ? { ...o, text: e.target.value } : o))}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`} style={{ ...inp, flex: 1 }} />
                    <span style={{ fontSize: "0.7rem", color: opt.isCorrect ? "#059669" : "#94a3b8", fontWeight: 700, minWidth: "40px" }}>
                      {opt.isCorrect ? "✓ Correct" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {cqForm.type === "TRUE_FALSE" && (
              <div style={{ marginBottom: "1rem", padding: "0.625rem 0.875rem", background: "#f0fdf4", border: "1px solid #a7f3d0", borderRadius: "6px", fontSize: "0.8125rem", color: "#065f46" }}>
                True / False — answer stored in explanation field below. No options needed.
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label style={lbl}>Explanation / Answer</label>
              <RichEditor
                value={cqForm.explanation}
                onChange={(html) => setCqForm(f => ({ ...f, explanation: html }))}
                placeholder="Explanation or correct answer — supports images and equations…"
                minHeight={60}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <label style={lbl}>Marks</label>
                <input type="number" min="0" step="0.5" value={cqForm.marks} onChange={e => setCqForm(f => ({ ...f, marks: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>Negative Marks</label>
                <input type="number" min="0" step="0.25" value={cqForm.negativeMarks} onChange={e => setCqForm(f => ({ ...f, negativeMarks: e.target.value }))} style={inp} />
              </div>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.875rem", marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#374151", marginBottom: "0.75rem" }}>Taxonomy (optional but recommended)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={lbl}>Category</label>
                  <select value={cqForm.categoryId}
                    onChange={e => { const v = e.target.value; setCqForm(f => ({ ...f, categoryId: v, subjectId: "", topicId: "", subtopicId: "" })); cqLoadSubjects(v); }}
                    style={inp}>
                    <option value="">— None —</option>
                    {taxoCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Subject</label>
                  <select value={cqForm.subjectId}
                    onChange={e => { const v = e.target.value; setCqForm(f => ({ ...f, subjectId: v, topicId: "", subtopicId: "" })); cqLoadTopics(v); }}
                    style={inp} disabled={!cqForm.categoryId || cqSubjects.length === 0}>
                    <option value="">— None —</option>
                    {cqSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Topic</label>
                  <select value={cqForm.topicId}
                    onChange={e => { const v = e.target.value; setCqForm(f => ({ ...f, topicId: v, subtopicId: "" })); cqLoadSubtopics(v); }}
                    style={inp} disabled={!cqForm.subjectId || cqTopics.length === 0}>
                    <option value="">— None —</option>
                    {cqTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Subtopic</label>
                  <select value={cqForm.subtopicId}
                    onChange={e => setCqForm(f => ({ ...f, subtopicId: e.target.value }))}
                    style={inp} disabled={!cqForm.topicId || cqSubtopics.length === 0}>
                    <option value="">— None —</option>
                    {cqSubtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setStage("source")} style={btn("#6b7280")} disabled={cqSaving}>Cancel</button>
              <button onClick={handleCqSave} style={btn(BRAND.purple)} disabled={cqSaving}>
                {cqSaving ? "Saving…" : "Save & Add to Review →"}
              </button>
            </div>
          </div>
        )}

        {/* STAGE: COMMITTING */}
        {stage === "committing" && (
          <div style={{ padding: "3rem", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#374151" }}>Saving questions...</div>
            <div style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>New questions are being saved to the Question Bank and attached to the section.</div>
          </div>
        )}

        {/* STAGE: DONE */}
        {stage === "done" && commitResult && (
          <div style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "#059669", marginBottom: "1rem" }}>Questions Added!</div>
            <div style={{ display: "inline-grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem", textAlign: "center" }}>
              <div style={{ background: "#f0fdf4", padding: "1rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#059669" }}>{commitResult.committed}</div>
                <div style={{ fontSize: "0.8rem", color: "#065f46" }}>Committed</div>
              </div>
              <div style={{ background: "#fef3c7", padding: "1rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#92400e" }}>{commitResult.skipped}</div>
                <div style={{ fontSize: "0.8rem", color: "#92400e" }}>Skipped (already in test)</div>
              </div>
              <div style={{ background: "#fef2f2", padding: "1rem", borderRadius: "8px" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#dc2626" }}>{commitResult.errors.length}</div>
                <div style={{ fontSize: "0.8rem", color: "#991b1b" }}>Errors</div>
              </div>
            </div>
            {commitResult.errors.length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem", marginBottom: "1rem", textAlign: "left" }}>
                {commitResult.errors.map((e, i) => <div key={i} style={{ fontSize: "0.8rem", color: "#dc2626" }}>• {e}</div>)}
              </div>
            )}
            <button onClick={onClose} style={{ ...btn("#059669"), fontSize: "1rem", padding: "0.625rem 2rem" }}>Done</button>
          </div>
        )}

        {/* SINGLE EDIT MODAL */}
        {editingIdx !== null && reviewItems[editingIdx] && (
          <SingleEditModal
            item={reviewItems[editingIdx]}
            taxoCategories={taxoCategories}
            taxoSubjects={taxoSubjects}
            taxoTopics={taxoTopics}
            taxoSubtopics={taxoSubtopics}
            qTypes={Q_TYPES as unknown as string[]}
            difficulties={DIFFICULTIES as unknown as string[]}
            onSave={(patch) => { updateItem(editingIdx, patch); setEditingIdx(null); }}
            onClose={() => setEditingIdx(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SINGLE EDIT MODAL
// ─────────────────────────────────────────────
type SingleEditProps = {
  item: ReviewItem;
  taxoCategories: TaxoNode[]; taxoSubjects: TaxoNode[]; taxoTopics: TaxoNode[]; taxoSubtopics: TaxoNode[];
  qTypes: string[]; difficulties: string[];
  onSave: (patch: Partial<ReviewItem>) => void;
  onClose: () => void;
};
function SingleEditModal({ item, taxoCategories, qTypes, difficulties, onSave, onClose }: Omit<SingleEditProps, "taxoSubjects" | "taxoTopics" | "taxoSubtopics"> & { taxoSubjects?: TaxoNode[]; taxoTopics?: TaxoNode[]; taxoSubtopics?: TaxoNode[] }) {
  const [f, setF] = useState({ ...item });
  const [localSubjects, setLocalSubjects] = useState<TaxoNode[]>([]);
  const [localTopics, setLocalTopics] = useState<TaxoNode[]>([]);
  const [localSubtopics, setLocalSubtopics] = useState<TaxoNode[]>([]);

  useEffect(() => {
    if (!f.categoryId) { setLocalSubjects([]); setLocalTopics([]); setLocalSubtopics([]); return; }
    fetch(`/api/taxonomy?level=subject&parentId=${f.categoryId}`).then(r => r.json()).then(d => setLocalSubjects(d.data || []));
  }, [f.categoryId]);

  useEffect(() => {
    if (!f.subjectId) { setLocalTopics([]); setLocalSubtopics([]); return; }
    fetch(`/api/taxonomy?level=topic&parentId=${f.subjectId}`).then(r => r.json()).then(d => setLocalTopics(d.data || []));
  }, [f.subjectId]);

  useEffect(() => {
    if (!f.topicId) { setLocalSubtopics([]); return; }
    fetch(`/api/taxonomy?level=subtopic&parentId=${f.topicId}`).then(r => r.json()).then(d => setLocalSubtopics(d.data || []));
  }, [f.topicId]);

  function setOpt(idx: number, field: "text" | "isCorrect", value: string | boolean) {
    const opts = [...f.options];
    if (field === "text") opts[idx] = { ...opts[idx], text: value as string };
    else {
      opts[idx] = { ...opts[idx], isCorrect: false };
      if (value) opts[idx] = { ...opts[idx], isCorrect: true };
      else {
        // unset all, set idx as correct
        opts.forEach((_, i) => opts[i] = { ...opts[i], isCorrect: i === idx });
      }
    }
    setF(prev => ({ ...prev, options: opts }));
  }

  return (
    <div style={{ ...overlay, zIndex: 1100 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width: "min(96vw, 700px)" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa", borderRadius: "10px 10px 0 0" }}>
          <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Edit Question</span>
          <button onClick={onClose} style={btn("#6b7280")}>✕</button>
        </div>
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          <div>
            <label style={lbl}>Stem *</label>
            <textarea value={f.stem} onChange={e => setF(p => ({ ...p, stem: e.target.value }))} rows={3} style={{ ...inp, resize: "vertical" }} />
          </div>
          {f.passageText !== undefined && (
            <div>
              <label style={lbl}>Passage Text</label>
              <textarea value={f.passageText || ""} onChange={e => setF(p => ({ ...p, passageText: e.target.value }))} rows={4} style={{ ...inp, resize: "vertical", background: "#f0f9ff" }} />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={lbl}>Question Type</label>
              <select value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value }))} style={inp}>
                {qTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Difficulty</label>
              <select value={f.difficulty} onChange={e => setF(p => ({ ...p, difficulty: e.target.value }))} style={inp}>
                {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Marks (+)</label>
              <input type="number" step="0.25" min="0" value={f.marks} onChange={e => setF(p => ({ ...p, marks: parseFloat(e.target.value) || 0 }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Negative Marks (−)</label>
              <input type="number" step="0.25" min="0" value={f.negativeMarks} onChange={e => setF(p => ({ ...p, negativeMarks: parseFloat(e.target.value) || 0 }))} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>Options (click radio to mark correct)</label>
            {f.options.map((opt, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.375rem" }}>
                <input type="radio" name="correct" checked={opt.isCorrect} onChange={() => setOpt(i, "isCorrect", true)} />
                <input value={opt.text} onChange={e => setOpt(i, "text", e.target.value)} style={{ ...inp, flex: 1 }} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
              </div>
            ))}
          </div>
          <div>
            <label style={lbl}>Explanation</label>
            <textarea value={f.explanation} onChange={e => setF(p => ({ ...p, explanation: e.target.value }))} rows={2} style={{ ...inp, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={lbl}>Category</label>
              <select value={f.categoryId} onChange={e => setF(p => ({ ...p, categoryId: e.target.value, subjectId: "", topicId: "", subtopicId: "" }))} style={inp}>
                <option value="">-- None --</option>
                {taxoCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Subject</label>
              <select value={f.subjectId} onChange={e => setF(p => ({ ...p, subjectId: e.target.value, topicId: "", subtopicId: "" }))} style={inp} disabled={!f.categoryId}>
                <option value="">-- None --</option>
                {localSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Topic</label>
              <select value={f.topicId} onChange={e => setF(p => ({ ...p, topicId: e.target.value, subtopicId: "" }))} style={inp} disabled={!f.subjectId}>
                <option value="">-- None --</option>
                {localTopics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Subtopic</label>
              <select value={f.subtopicId} onChange={e => setF(p => ({ ...p, subtopicId: e.target.value }))} style={inp} disabled={!f.topicId}>
                <option value="">-- None --</option>
                {localSubtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Source Tag</label>
            <input value={f.sourceTag} onChange={e => setF(p => ({ ...p, sourceTag: e.target.value }))} style={inp} placeholder="e.g. NCERT_9, PYQ_2023" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.25rem" }}>
            <button onClick={onClose} style={btn("#6b7280")}>Cancel</button>
            <button onClick={() => onSave(f)} style={btn(BRAND.purple)}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN TESTS PAGE
// ─────────────────────────────────────────────
export default function TestsPage() {
  type View = "list" | "builder";
  const [view, setView] = useState<View>("list");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [testId, setTestId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ title: "", instructions: "", mode: "TIMED", isTimed: true, durationSec: "", totalQuestions: "", marksPerQuestion: "", negativeMarksPerQuestion: "", allowPause: false, strictSectionMode: false, shuffleQuestions: false, shuffleOptions: false, shuffleGroups: false, shuffleGroupChildren: false, seriesId: "", categoryId: "", examId: "", xpEnabled: false, xpValue: "0", testStartTime: "", unlockAt: "", isFree: false });
  const [hasSectionsManual, setHasSectionsManual] = useState(false);
  const [sectionPresetOpen, setSectionPresetOpen] = useState<number | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [exams, setExams] = useState<{ id: string; name: string; categoryId: string }[]>([]);
  const [sections, setSections] = useState<SectionState[]>([]);
  const [testQuestions, setTestQuestions] = useState<TestQuestionState[]>([]);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [validating, setValidating] = useState(false);
  const [sectionTemplates, setSectionTemplates] = useState<{ sections: string[]; subsections: Record<string, string[]> }>({ sections: [], subsections: {} });

  // Add Questions modal state
  const [addQModal, setAddQModal] = useState<{ sectionId: string | null; sectionIndex: number | null; sectionTitle: string; targetCount: number; currentCount: number } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/tests?${params}`);
      const d = await res.json();
      setItems(d.data || []);
      setTotalPages(d.pagination?.totalPages || 1);
    } catch { showToast("Failed to load", "error"); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => {
    fetch("/api/test-series?limit=100").then(r => r.json()).then(d => {
      setSeriesList((d.data || []).map((s: any) => ({ id: s.id, title: s.title, categoryId: s.categoryId || null })));
    }).catch(() => {});
    fetch("/api/taxonomy?tree=true").then(r => r.json()).then(d => {
      setCategories((d.data || []).map((c: any) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
    fetch("/api/exams").then(r => r.json()).then(j => setExams(j.exams || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.categoryId) {
      setSectionTemplates({ sections: [], subsections: {} });
      return;
    }
    fetch(`/api/tests/section-templates?categoryId=${form.categoryId}`)
      .then(r => r.json())
      .then(d => setSectionTemplates({ sections: d.sections || [], subsections: d.subsections || {} }))
      .catch(() => {});
  }, [form.categoryId]);

  function openCreate() {
    setTestId(null); setIsPublished(false); setCreateStep(1);
    setForm({ title: "", instructions: "", mode: "TIMED", isTimed: true, durationSec: "", totalQuestions: "", marksPerQuestion: "", negativeMarksPerQuestion: "", allowPause: false, strictSectionMode: false, shuffleQuestions: false, shuffleOptions: false, shuffleGroups: false, shuffleGroupChildren: false, seriesId: "", categoryId: "", examId: "", xpEnabled: false, xpValue: "0", testStartTime: "", unlockAt: "", isFree: false });
    setHasSectionsManual(true);
    setSections([]); setTestQuestions([]); setValidation(null);
    setView("builder");
  }

  async function openEdit(id: string) {
    try {
      const res = await fetch(`/api/tests/${id}`);
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      const t: TestDetail = d.data;
      setTestId(t.id); setIsPublished(t.isPublished);
      setForm({ title: t.title, instructions: t.instructions || "", mode: t.mode, isTimed: t.isTimed, durationSec: t.durationSec ? String(Math.round(t.durationSec / 60)) : "", totalQuestions: t.totalQuestions ? String(t.totalQuestions) : "", marksPerQuestion: t.marksPerQuestion != null ? String(t.marksPerQuestion) : "", negativeMarksPerQuestion: t.negativeMarksPerQuestion != null ? String(t.negativeMarksPerQuestion) : "", allowPause: t.allowPause, strictSectionMode: t.strictSectionMode, shuffleQuestions: t.shuffleQuestions, shuffleOptions: t.shuffleOptions, shuffleGroups: t.shuffleGroups, shuffleGroupChildren: t.shuffleGroupChildren, seriesId: t.seriesId || "", categoryId: t.categoryId || "", examId: t.examId || "", xpEnabled: !!t.xpEnabled, xpValue: t.xpValue != null ? String(t.xpValue) : "0", testStartTime: t.testStartTime ? t.testStartTime.slice(0, 16) : "", unlockAt: (t as any).unlockAt ? (t as any).unlockAt.slice(0, 16) : "", isFree: !!t.isFree });
      setHasSectionsManual(t.sections.length > 0 || ["SECTIONAL", "MULTI_SECTION"].includes(t.mode));
      const flatSecs: SectionState[] = t.sections.map((s, i) => {
        const parentIndex = s.parentSectionId ? t.sections.findIndex(p => p.id === s.parentSectionId) : null;
        return { id: s.id, title: s.title, durationSec: s.durationSec ? String(Math.round(s.durationSec / 60)) : "", targetCount: s.targetCount ? String(s.targetCount) : "", parentIndex: parentIndex === -1 ? null : parentIndex };
      });
      setSections(flatSecs);
      setTestQuestions(t.questions.map(tq => ({
        questionId: tq.questionId,
        sectionIndex: tq.sectionId ? t.sections.findIndex(s => s.id === tq.sectionId) : null,
        question: tq.question,
        marks: tq.marks ?? 1,
        negativeMarks: tq.negativeMarks ?? 0,
      })));
      setValidation(null); setView("builder");
    } catch { showToast("Failed to load test", "error"); }
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title, instructions: form.instructions, mode: form.mode,
        isTimed: form.isTimed, durationSec: form.durationSec ? String(parseInt(form.durationSec) * 60) : null,
        totalQuestions: form.totalQuestions ? parseInt(form.totalQuestions) : null,
        marksPerQuestion: form.marksPerQuestion ? parseFloat(form.marksPerQuestion) : null,
        negativeMarksPerQuestion: form.negativeMarksPerQuestion ? parseFloat(form.negativeMarksPerQuestion) : null,
        allowPause: form.allowPause, strictSectionMode: form.strictSectionMode,
        shuffleQuestions: form.shuffleQuestions, shuffleOptions: form.shuffleOptions,
        shuffleGroups: form.shuffleGroups, shuffleGroupChildren: form.shuffleGroupChildren,
        seriesId: form.seriesId || null, categoryId: form.categoryId || null, examId: form.examId || null,
        xpEnabled: form.xpEnabled, xpValue: parseInt(form.xpValue) || 0,
        testStartTime: form.testStartTime || null,
        unlockAt: form.unlockAt ? form.unlockAt + ":00+05:30" : null,
        isFree: form.isFree,
        sections: sections.map(s => ({ title: s.title, durationSec: s.durationSec ? String(parseInt(s.durationSec) * 60) : null, targetCount: s.targetCount || null, parentIndex: s.parentIndex })),
        questions: testQuestions.map(q => ({ questionId: q.questionId, sectionIndex: q.sectionIndex, marks: q.marks, negativeMarks: q.negativeMarks })),
      };
      if (testId) payload.id = testId;
      const res = await fetch("/api/tests", {
        method: testId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      const newTest: TestDetail = d.data;
      setTestId(newTest.id); setIsPublished(newTest.isPublished);
      const flatSecs: SectionState[] = newTest.sections.map(s => {
        const parentIndex = s.parentSectionId ? newTest.sections.findIndex(p => p.id === s.parentSectionId) : null;
        return { id: s.id, title: s.title, durationSec: s.durationSec ? String(Math.round(s.durationSec / 60)) : "", targetCount: s.targetCount ? String(s.targetCount) : "", parentIndex: parentIndex === -1 ? null : parentIndex };
      });
      setSections(flatSecs);
      setTestQuestions(newTest.questions.map(tq => ({
        questionId: tq.questionId,
        sectionIndex: tq.sectionId ? newTest.sections.findIndex(s => s.id === tq.sectionId) : null,
        question: tq.question,
        marks: tq.marks ?? 1, negativeMarks: tq.negativeMarks ?? 0,
      })));
      showToast("Saved", "success");
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleValidate() {
    if (!testId) { showToast("Save the test first", "error"); return; }
    setValidating(true);
    try {
      const res = await fetch(`/api/tests/${testId}/validate`, { method: "POST" });
      const d = await res.json();
      setValidation(d.data);
    } catch { showToast("Validation failed", "error"); }
    finally { setValidating(false); }
  }

  async function handlePublish() {
    if (!testId) return;
    try {
      const res = await fetch(`/api/tests/${testId}/publish`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Cannot publish", "error"); if (d.data?.errors) setValidation({ valid: false, errors: d.data.errors, warnings: [] }); return; }
      showToast("Published!", "success"); setIsPublished(true); fetchList();
    } catch { showToast("Publish failed", "error"); }
  }

  async function handleUnpublish() {
    if (!testId) return;
    try {
      const res = await fetch(`/api/tests/${testId}/unpublish`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
      showToast("Unpublished", "success"); setIsPublished(false); fetchList();
    } catch { showToast("Failed", "error"); }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/tests?id=${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      showToast("Deleted", "success"); fetchList();
    } catch { showToast("Failed", "error"); }
  }

  function addTopLevelSection() {
    setSections(prev => {
      const topCount = prev.filter(s => s.parentIndex === null).length;
      return [...prev, { title: `Section ${topCount + 1}`, durationSec: "", targetCount: "", parentIndex: null }];
    });
  }

  function addSubsection(parentIdx: number) {
    setSections(prev => {
      const siblingCount = prev.filter(s => s.parentIndex === parentIdx).length;
      return [...prev, { title: `Subsection ${siblingCount + 1}`, durationSec: "", targetCount: "", parentIndex: parentIdx }];
    });
  }

  function updateSection(idx: number, patch: Partial<SectionState>) {
    setSections(prev => { const s = [...prev]; s[idx] = { ...s[idx], ...patch }; return s; });
  }

  function deleteSection(idx: number) {
    const childIndices = new Set<number>();
    childIndices.add(idx);
    sections.forEach((s, i) => { if (s.parentIndex === idx) childIndices.add(i); });
    const newSections = sections.filter((_, i) => !childIndices.has(i));
    const indexMap: Record<number, number> = {};
    let newI = 0;
    sections.forEach((_, oldI) => { if (!childIndices.has(oldI)) { indexMap[oldI] = newI++; } });
    const remapped = newSections.map(s => ({
      ...s,
      parentIndex: s.parentIndex !== null && indexMap[s.parentIndex] !== undefined ? indexMap[s.parentIndex] : null,
    }));
    setSections(remapped);
    setTestQuestions(prev => prev.filter(q => q.sectionIndex === null || !childIndices.has(q.sectionIndex)).map(q => ({
      ...q,
      sectionIndex: q.sectionIndex !== null && indexMap[q.sectionIndex] !== undefined ? indexMap[q.sectionIndex] : null,
    })));
  }

  function removeQuestion(idx: number) {
    setTestQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    const arr = [...testQuestions];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setTestQuestions(arr);
  }

  function openAddQ(sectionIdx: number | null) {
    if (!testId) { showToast("Save the test first before adding questions", "error"); return; }
    const sec = sectionIdx !== null ? sections[sectionIdx] : null;
    const sectionTitle = sec ? sec.title : "Unsectioned";
    const targetCount = sec ? parseInt(sec.targetCount || "0") : 0;
    const secId = sec?.id || null;
    const currentCount = testQuestions.filter(q => q.sectionIndex === sectionIdx).length;
    setAddQModal({ sectionId: secId, sectionIndex: sectionIdx, sectionTitle, targetCount, currentCount });
  }

  function handleAddQCommitted(newSections: any[], newQuestions: any[], committedSectionIndex: number | null) {
    const flatSecs: SectionState[] = newSections.map(s => {
      const parentIndex = s.parentSectionId ? newSections.findIndex((p: any) => p.id === s.parentSectionId) : null;
      return { id: s.id, title: s.title, durationSec: s.durationSec ? String(Math.round(s.durationSec / 60)) : "", targetCount: s.targetCount ? String(s.targetCount) : "", parentIndex: parentIndex === -1 ? null : parentIndex };
    });
    setSections(flatSecs);
    setTestQuestions(newQuestions.map((tq: any) => {
      let si: number | null = null;
      if (tq.sectionId) {
        const idx = newSections.findIndex((s: any) => s.id === tq.sectionId);
        si = idx >= 0 ? idx : committedSectionIndex;
      } else {
        si = committedSectionIndex;
      }
      return {
        questionId: tq.questionId,
        sectionIndex: si,
        question: tq.question,
        marks: tq.marks ?? 1,
        negativeMarks: tq.negativeMarks ?? 0,
      };
    }));
    showToast("Questions added!", "success");
  }

  // ─ Timer validation for subsections
  function timerInfo(sectionIdx: number): { timedTotal: number; sectionTotal: number; remaining: number; isOverrun: boolean } {
    const sec = sections[sectionIdx];
    const sectionTotal = parseInt(sec.durationSec || "0");
    const children = sections.filter((s, i) => s.parentIndex === sectionIdx && s.durationSec);
    const timedTotal = children.reduce((sum, s) => sum + parseInt(s.durationSec || "0"), 0);
    return { timedTotal, sectionTotal, remaining: sectionTotal - timedTotal, isOverrun: timedTotal > sectionTotal && sectionTotal > 0 };
  }

  function countForSection(sectionIdx: number): number {
    return testQuestions.filter(q => q.sectionIndex === sectionIdx).length;
  }

  function countBadge(sectionIdx: number | null): React.ReactNode {
    const current = sectionIdx !== null ? countForSection(sectionIdx) : testQuestions.filter(q => q.sectionIndex === null).length;
    const target = sectionIdx !== null ? parseInt(sections[sectionIdx]?.targetCount || "0") : 0;
    if (target === 0) return <span style={{ fontSize: "0.78rem", color: "#6b7280" }}>{current} Q</span>;
    const over = current > target;
    return (
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: over ? "#dc2626" : current === target ? "#059669" : "#374151", background: over ? "#fee2e2" : current === target ? "#d1fae5" : "#f1f5f9", padding: "1px 7px", borderRadius: "10px" }}>
        {current}/{target}
      </span>
    );
  }

  const hasSections = hasSectionsManual || ["SECTIONAL", "MULTI_SECTION"].includes(form.mode);
  const topLevelSections = sections.filter(s => s.parentIndex === null);
  const selectedCategoryName = categories.find(c => c.id === form.categoryId)?.name?.toLowerCase() || "";
  const sectionPresets = Object.entries(CATEGORY_SECTION_PRESETS).find(([key]) => selectedCategoryName.includes(key))?.[1] || [];

  // ─────────────────── BUILDER VIEW ───────────────────
  if (view === "builder") {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "1200px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111", margin: 0 }}>
            {testId
              ? <>Edit Test {isPublished && <span style={{ marginLeft: "0.625rem", fontSize: "0.75rem", background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: "10px", verticalAlign: "middle" }}>PUBLISHED</span>}</>
              : createStep === 1 ? "New Test — Step 1 of 2: Basic Details" : "New Test — Step 2 of 2: Define Sections"
            }
          </h1>
          <button onClick={() => { setView("list"); fetchList(); }} style={btn("#6b7280")}>← Back to List</button>
        </div>

        {!testId && (
          <div style={{ display: "flex", alignItems: "center", gap: "0", marginBottom: "1.25rem" }}>
            {[1, 2].map(step => (
              <div key={step} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: "0.8rem",
                  background: createStep >= step ? "#7c3aed" : "#e5e7eb",
                  color: createStep >= step ? "#fff" : "#6b7280",
                }}>{step}</div>
                <div style={{ marginLeft: "0.4rem", fontSize: "0.8rem", fontWeight: 600, color: createStep >= step ? "#7c3aed" : "#9ca3af" }}>
                  {step === 1 ? "Basic Details" : "Sections & Targets"}
                </div>
                {step < 2 && <div style={{ width: "48px", height: "2px", background: createStep > step ? "#7c3aed" : "#e5e7eb", margin: "0 0.75rem" }} />}
              </div>
            ))}
          </div>
        )}

        {toast && (
          <div style={{ padding: "0.5rem 1rem", marginBottom: "1rem", borderRadius: "6px", background: toast.type === "success" ? "#ecfdf5" : "#fef2f2", color: toast.type === "success" ? "#059669" : "#dc2626", border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`, fontSize: "0.875rem" }}>
            {toast.msg}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: testId ? "1fr 280px" : "1fr", gap: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* TEST DETAILS — shown in edit mode OR create step 1 */}
            {(!!testId || createStep === 1) && <div style={card}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>Test Details</h3>
              <div style={{ display: "grid", gap: "0.625rem" }}>
                <div>
                  <label style={lbl}>Title *</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Instructions</label>
                  <textarea value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={2} style={{ ...inp, resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={lbl}>Category *</label>
                    <select
                      value={form.categoryId}
                      onChange={e => {
                        const newCatId = e.target.value;
                        const selectedSeries = seriesList.find(s => s.id === form.seriesId);
                        if (selectedSeries?.categoryId && newCatId && newCatId !== selectedSeries.categoryId) {
                          showToast("Warning: this category does not match the selected series' category. The save will be blocked.", "error");
                        }
                        setForm({ ...form, categoryId: newCatId, examId: "" });
                      }}
                      style={inp}
                    >
                      <option value="">— Select Category —</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Exam <span style={{ fontWeight: 400, color: "#9ca3af" }}>(by category)</span></label>
                    <select value={form.examId} onChange={e => setForm({ ...form, examId: e.target.value })} style={inp}>
                      <option value="">— None —</option>
                      {exams.filter(ex => !form.categoryId || ex.categoryId === form.categoryId).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Series</label>
                    <select
                      value={form.seriesId}
                      onChange={e => {
                        const s = seriesList.find(x => x.id === e.target.value);
                        const newForm: typeof form = { ...form, seriesId: e.target.value };
                        if (s?.categoryId) newForm.categoryId = s.categoryId;
                        setForm(newForm);
                      }}
                      style={inp}
                    >
                      <option value="">— None —</option>
                      {seriesList.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                </div>
                {(() => {
                  const selectedSeries = seriesList.find(s => s.id === form.seriesId);
                  if (selectedSeries?.categoryId && form.categoryId && form.categoryId !== selectedSeries.categoryId) {
                    return (
                      <div style={{ padding: "0.375rem 0.75rem", borderRadius: "6px", background: "#fef2f2", color: "#dc2626", fontSize: "0.8125rem", border: "1px solid #fecaca" }}>
                        ⚠ Category mismatch — this test's category does not match the selected series. Please fix before saving.
                      </div>
                    );
                  }
                  return null;
                })()}
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.75rem", alignItems: "center", background: "#f5f3ff", borderRadius: "8px", padding: "0.75rem", border: "1px solid #ddd6fe" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 700, color: "#6d28d9", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={form.isFree} onChange={e => setForm({ ...form, isFree: e.target.checked })} />
                    Is Free Test
                  </label>
                  {form.isFree && (
                    <span style={{ fontSize: "0.75rem", color: "#6d28d9" }}>This test is accessible without purchase, even if the parent series is paid.</span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.75rem", alignItems: "center", background: "#f0f9ff", borderRadius: "8px", padding: "0.75rem", border: "1px solid #bae6fd" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={form.xpEnabled} onChange={e => setForm({ ...form, xpEnabled: e.target.checked })} />
                    XP Reward
                  </label>
                  {form.xpEnabled && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input type="number" min="0" value={form.xpValue} onChange={e => setForm({ ...form, xpValue: e.target.value })} style={{ ...inp, width: "90px" }} placeholder="XP" />
                      <span style={{ fontSize: "0.75rem", color: "#0369a1" }}>XP awarded on completion (1st attempt = 100%, 2nd = 50%, 3rd+ = 0)</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={lbl}>Scheduled Start Time <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(optional)</span></label>
                    <input type="datetime-local" value={form.testStartTime} onChange={e => setForm({ ...form, testStartTime: e.target.value })} style={inp} />
                  </div>
                  <div>
                    <label style={lbl}>Unlock At <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(optional — blocks access before this time)</span></label>
                    <input type="datetime-local" value={form.unlockAt} onChange={e => setForm({ ...form, unlockAt: e.target.value })} style={inp} />
                    {form.unlockAt && <p style={{ margin: "3px 0 0", fontSize: "0.7rem", color: "#7c3aed" }}>Access gated until {new Date(form.unlockAt).toLocaleString()}</p>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={lbl}>Mode</label>
                    <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })} style={inp}>
                      {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Total Time (min)</label>
                    <input type="number" value={form.durationSec} onChange={e => setForm({ ...form, durationSec: e.target.value })} style={inp} placeholder="e.g. 60" />
                  </div>
                  <div>
                    <label style={lbl}>Total Questions (target)</label>
                    <input type="number" value={form.totalQuestions} onChange={e => setForm({ ...form, totalQuestions: e.target.value })} style={inp} placeholder="e.g. 100" title="Planned total questions — used to validate section targets" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <div>
                    <label style={lbl}>Default Marks / Question <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(optional — applied as default when adding questions)</span></label>
                    <input type="number" min="0" step="0.25" value={form.marksPerQuestion} onChange={e => setForm({ ...form, marksPerQuestion: e.target.value })} style={inp} placeholder="e.g. 1" />
                  </div>
                  <div>
                    <label style={lbl}>Default Negative Marks / Question <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.72rem" }}>(optional)</span></label>
                    <input type="number" min="0" step="0.25" value={form.negativeMarksPerQuestion} onChange={e => setForm({ ...form, negativeMarksPerQuestion: e.target.value })} style={inp} placeholder="e.g. 0.25" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                    <input type="checkbox" checked={hasSectionsManual} onChange={e => { setHasSectionsManual(e.target.checked); if (!e.target.checked) setSections([]); }} />
                    Multiple Sections
                  </label>
                  {[["isTimed", "Timed"], ["allowPause", "Allow Pause"], ["strictSectionMode", "Strict Sections"]].map(([k, label]) => (
                    <label key={k} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem" }}>
                      <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} /> {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>}

            {/* Create step 1 navigation */}
            {!testId && createStep === 1 && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
                    if (!form.categoryId) { showToast("Category is required", "error"); return; }
                    setCreateStep(2);
                  }}
                  style={{ ...btn(BRAND.purple), padding: "0.6rem 1.5rem", fontSize: "0.9rem" }}
                >
                  Next: Add Sections →
                </button>
              </div>
            )}

            {/* SHUFFLE SETTINGS — edit mode only */}
            {!!testId && <div style={card}>
              <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>Shuffle Settings</h3>
              <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.75rem", color: "#6b7280" }}>
                Controls how questions and options are randomised at exam runtime. Hierarchy integrity is always preserved — questions never cross section or subsection boundaries.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" style={{ marginTop: "2px" }} checked={form.shuffleQuestions} onChange={e => setForm({ ...form, shuffleQuestions: e.target.checked, shuffleGroups: e.target.checked ? form.shuffleGroups : false, shuffleGroupChildren: e.target.checked ? form.shuffleGroupChildren : false })} />
                  <span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827" }}>Shuffle Questions</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#6b7280" }}>
                      Randomises question order within each section (or subsection, when present). Questions never cross section/subsection boundaries.
                    </span>
                  </span>
                </label>
                {form.shuffleQuestions && (
                  <div style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}>
                      <input type="checkbox" style={{ marginTop: "2px" }} checked={form.shuffleGroups} onChange={e => setForm({ ...form, shuffleGroups: e.target.checked })} />
                      <span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Shuffle Paragraph Groups as Blocks</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#6b7280" }}>
                          Paragraph / comprehension groups move as a single unit within the section. The shared passage stays attached to its child questions.
                        </span>
                      </span>
                    </label>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}>
                      <input type="checkbox" style={{ marginTop: "2px" }} checked={form.shuffleGroupChildren} onChange={e => setForm({ ...form, shuffleGroupChildren: e.target.checked })} />
                      <span>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>Shuffle Questions Within Groups</span>
                        <span style={{ display: "block", fontSize: "0.75rem", color: "#6b7280" }}>
                          Child questions inside each paragraph group are randomised. The passage remains at the top of the group.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer" }}>
                  <input type="checkbox" style={{ marginTop: "2px" }} checked={form.shuffleOptions} onChange={e => setForm({ ...form, shuffleOptions: e.target.checked })} />
                  <span>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#111827" }}>Shuffle Answer Options</span>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#6b7280" }}>
                      Randomises the order of A / B / C / D for each question. The correct answer is tracked by value — not position — so scoring and negative marking are always accurate.
                    </span>
                  </span>
                </label>
                {form.shuffleOptions && (
                  <div style={{ paddingLeft: "1.5rem", padding: "0.5rem 0.5rem 0.5rem 1.25rem", background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", fontSize: "0.75rem", color: "#92400e" }}>
                    ⚠ Evaluation uses stored answer value mapping. Static A/B/C/D letters are never used alone for scoring — answer integrity is preserved.
                  </div>
                )}
              </div>
            </div>}

            {/* SECTIONS + SUBSECTIONS */}
            {hasSections && (
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>
                    Sections & Subsections
                  </h3>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", position: "relative" }}>
                    {sectionPresets.length > 0 && (
                      <div style={{ position: "relative" }}>
                        <button
                          onClick={() => setSectionPresetOpen(sectionPresetOpen === -1 ? null : -1)}
                          style={{ ...btn("#6b7280"), fontSize: "0.75rem" }}
                          title="Add preset sections for this category"
                        >
                          ★ Preset Sections ▾
                        </button>
                        {sectionPresetOpen === -1 && (
                          <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 50, minWidth: "200px" }}>
                            {sectionPresets.map(preset => (
                              <button
                                key={preset}
                                onClick={() => {
                                  setSections(prev => [...prev, { title: preset, durationSec: "", targetCount: "", parentIndex: null }]);
                                  setSectionPresetOpen(null);
                                }}
                                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.375rem 0.75rem", background: "transparent", border: "none", borderBottom: "1px solid #f1f5f9", fontSize: "0.8125rem", cursor: "pointer", color: "#374151" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <button onClick={addTopLevelSection} style={btn(BRAND.purple)}>+ Add Section</button>
                  </div>
                </div>
                {sections.length === 0 && <p style={{ color: "#888", fontSize: "0.8rem" }}>No sections yet.</p>}
                {(() => {
                  if (topLevelSections.length === 0) return null;
                  const totalTargetQs = topLevelSections.reduce((sum, s) => sum + (parseInt(s.targetCount || "0") || 0), 0);
                  const totalTimedMin = topLevelSections.filter(s => s.durationSec).reduce((sum, s) => sum + (parseInt(s.durationSec || "0") || 0), 0);
                  const allSectionsTimed = topLevelSections.length > 0 && topLevelSections.every(s => s.durationSec);
                  const testTotalMin = parseInt(form.durationSec || "0") || 0;
                  const targetQs = parseInt(form.totalQuestions || "0") || 0;
                  const qsMismatch = targetQs > 0 && totalTargetQs > 0 && totalTargetQs !== targetQs;
                  const timeMismatch = allSectionsTimed && testTotalMin > 0 && totalTimedMin !== testTotalMin;
                  if (!qsMismatch && !timeMismatch) return null;
                  return (
                    <div style={{ marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", fontSize: "0.78rem", color: "#92400e", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {qsMismatch && <span>⚠ Section targets sum to <strong>{totalTargetQs} Q</strong> — expected <strong>{targetQs} Q</strong> (Total Questions field)</span>}
                      {timeMismatch && <span>⚠ Section times sum to <strong>{totalTimedMin} min</strong> — expected <strong>{testTotalMin} min</strong> (Total Time field)</span>}
                    </div>
                  );
                })()}
                {topLevelSections.map(sec => {
                  const idx = sections.indexOf(sec);
                  const children = sections.map((s, i) => ({ s, i })).filter(({ s }) => s.parentIndex === idx);
                  const info = sec.durationSec ? timerInfo(idx) : null;

                  return (
                    <div key={idx} style={{ marginBottom: "0.875rem", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
                      {/* Section header row */}
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem 0.75rem", background: "#f8fafc" }}>
                        <span style={{ fontSize: "0.75rem", color: "#6b7280", minWidth: "1.25rem" }}>§{topLevelSections.indexOf(sec) + 1}</span>
                        <input
                          list={`sec-tmpl-${idx}`}
                          value={sec.title}
                          onChange={e => updateSection(idx, { title: e.target.value })}
                          style={{ ...inp, flex: 1 }}
                          placeholder={sectionTemplates.sections.length ? "Pick saved or type new…" : "Section title"}
                        />
                        {sectionTemplates.sections.length > 0 && (
                          <datalist id={`sec-tmpl-${idx}`}>
                            {sectionTemplates.sections.map(name => <option key={name} value={name} />)}
                          </datalist>
                        )}
                        <div>
                          <input type="number" value={sec.durationSec} onChange={e => updateSection(idx, { durationSec: e.target.value })} style={{ ...inp, width: "80px" }} placeholder="min" title="Section total time (minutes)" />
                        </div>
                        <div>
                          <input type="number" value={sec.targetCount} onChange={e => updateSection(idx, { targetCount: e.target.value })} style={{ ...inp, width: "60px" }} placeholder="# Q" title="Target question count" />
                        </div>
                        {countBadge(idx)}
                        <button onClick={() => openAddQ(idx)} style={btn("#059669")} title="Add questions to this section">+ Q</button>
                        <button onClick={() => addSubsection(idx)} style={btn("#7c3aed")} title="Add subsection">+ Sub</button>
                        <button onClick={() => deleteSection(idx)} style={{ ...btn("#dc2626"), fontSize: "0.7rem" }} title="Remove this section from the test">✕ Remove</button>
                      </div>

                      {/* Timer pool display */}
                      {info && children.length > 0 && (
                        <div style={{ padding: "0.25rem 0.875rem 0.25rem", fontSize: "0.75rem", background: info.isOverrun ? "#fef2f2" : "#f0fdf4", color: info.isOverrun ? "#dc2626" : "#065f46", display: "flex", gap: "1.25rem" }}>
                          <span>Section: {info.sectionTotal} min</span>
                          <span>Timed subsections: {info.timedTotal} min</span>
                          <span style={{ fontWeight: 700 }}>
                            {info.isOverrun ? `⚠ Overrun by ${info.timedTotal - info.sectionTotal} min` : `Remaining shared pool: ${info.remaining} min`}
                          </span>
                        </div>
                      )}

                      {/* Subsections */}
                      {children.map(({ s: sub, i: subIdx }) => (
                        <div key={subIdx} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.375rem 0.75rem 0.375rem 2.5rem", borderTop: "1px solid #f1f5f9", background: "#fafbff" }}>
                          <span style={{ fontSize: "0.7rem", color: "#a78bfa" }}>└─</span>
                          <input
                            list={`sub-tmpl-${subIdx}`}
                            value={sub.title}
                            onChange={e => updateSection(subIdx, { title: e.target.value })}
                            style={{ ...inp, flex: 1 }}
                            placeholder={(sectionTemplates.subsections[sec.title] || []).length ? "Pick saved or type new…" : "Subsection title"}
                          />
                          {(sectionTemplates.subsections[sec.title] || []).length > 0 && (
                            <datalist id={`sub-tmpl-${subIdx}`}>
                              {(sectionTemplates.subsections[sec.title] || []).map(name => <option key={name} value={name} />)}
                            </datalist>
                          )}
                          <input type="number" value={sub.durationSec} onChange={e => updateSection(subIdx, { durationSec: e.target.value })} style={{ ...inp, width: "70px" }} placeholder="min" title="Subsection time in minutes (optional)" />
                          <input type="number" value={sub.targetCount} onChange={e => updateSection(subIdx, { targetCount: e.target.value })} style={{ ...inp, width: "55px" }} placeholder="# Q" title="Target question count" />
                          {countBadge(subIdx)}
                          <button onClick={() => openAddQ(subIdx)} style={btn("#059669")} title="Add questions to this subsection">+ Q</button>
                          <button onClick={() => deleteSection(subIdx)} style={{ ...btn("#dc2626"), fontSize: "0.7rem" }} title="Remove this subsection from the test">✕ Remove</button>
                        </div>
                      ))}
                      {(() => {
                        const secTarget = parseInt(sec.targetCount || "0") || 0;
                        if (children.length === 0 || secTarget === 0) return null;
                        const subSum = children.reduce((sum, { s }) => sum + (parseInt(s.targetCount || "0") || 0), 0);
                        if (subSum === secTarget) return null;
                        return (
                          <div style={{ padding: "0.25rem 0.875rem", fontSize: "0.75rem", background: "#fef2f2", color: "#dc2626", borderTop: "1px solid #fecaca" }}>
                            ⚠ Subsection targets sum to <strong>{subSum} Q</strong> — expected <strong>{secTarget} Q</strong>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create step 2 navigation */}
            {!testId && createStep === 2 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <button onClick={() => setCreateStep(1)} style={btn("#6b7280")}>← Back to Details</button>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                    {sections.length === 0 ? "Add at least one section to continue" : `${sections.length} section(s) defined`}
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={saving || sections.length === 0}
                    style={{ ...btn(BRAND.purple), padding: "0.6rem 1.5rem", fontSize: "0.9rem", opacity: sections.length === 0 ? 0.5 : 1 }}
                  >
                    {saving ? "Saving..." : "💾 Save as Draft →"}
                  </button>
                </div>
              </div>
            )}

            {/* QUESTIONS TABLE — edit mode only */}
            {!!testId && <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.625rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>
                  Questions ({testQuestions.length}){" "}
                  {!hasSections && countBadge(null)}
                </h3>
                {!hasSections && (
                  <button onClick={() => openAddQ(null)} style={btn(BRAND.purple)}>+ Add Questions</button>
                )}
              </div>
              {testQuestions.length === 0 ? (
                <p style={{ color: "#888", fontSize: "0.8rem" }}>
                  {hasSections ? 'Use the "+ Q" buttons on each section/subsection above to add questions.' : 'Click "+ Add Questions" to get started.'}
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                      <th style={th}>#</th>
                      <th style={th}>Type</th>
                      <th style={{ ...th, minWidth: "200px" }}>Stem</th>
                      <th style={th}>Diff</th>
                      <th style={th}>Status</th>
                      <th style={th}>+M</th>
                      <th style={th}>−M</th>
                      {hasSections && <th style={th}>Section</th>}
                      <th style={th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testQuestions.map((tq, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ ...td, color: "#94a3b8" }}>{i + 1}</td>
                        <td style={td}><span style={{ fontSize: "0.7rem", background: "#e0e7ff", color: "#3730a3", padding: "1px 5px", borderRadius: "4px" }}>{tq.question.type}</span></td>
                        <td style={{ ...td, maxWidth: "200px" }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tq.question.stem}</span></td>
                        <td style={td}>{tq.question.difficulty.slice(0, 3)}</td>
                        <td style={td}><span style={{ fontSize: "0.7rem", padding: "1px 5px", borderRadius: "4px", background: tq.question.status === "APPROVED" ? "#d1fae5" : "#fee2e2", color: tq.question.status === "APPROVED" ? "#065f46" : "#991b1b" }}>{tq.question.status}</span></td>
                        <td style={{ ...td, color: "#059669", fontWeight: 700 }}>+{tq.marks}</td>
                        <td style={{ ...td, color: tq.negativeMarks > 0 ? "#dc2626" : "#94a3b8" }}>−{tq.negativeMarks}</td>
                        {hasSections && (() => {
                          const assignedSec = tq.sectionIndex !== null ? sections[tq.sectionIndex] : null;
                          return (
                            <td style={{ ...td, minWidth: "160px" }}>
                              {assignedSec && (
                                <div style={{
                                  display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                  background: assignedSec.parentIndex !== null ? "#ede9fe" : "#ddd6fe",
                                  color: "#5b21b6", borderRadius: "4px",
                                  padding: "0.125rem 0.4rem", fontSize: "0.7rem", fontWeight: 700,
                                  marginBottom: "0.25rem", maxWidth: "100%",
                                }}>
                                  {assignedSec.parentIndex !== null ? "└─ " : "§"}{assignedSec.title}
                                </div>
                              )}
                              <select
                                value={tq.sectionIndex !== null ? String(tq.sectionIndex) : ""}
                                onChange={e => {
                                  const arr = [...testQuestions];
                                  arr[i].sectionIndex = e.target.value !== "" ? parseInt(e.target.value) : null;
                                  setTestQuestions(arr);
                                }}
                                style={{ ...inp, width: "100%", padding: "0.125rem 0.25rem", fontSize: "0.7rem", display: "block" }}
                              >
                                <option value="">— None —</option>
                                {sections.map((s, si) => (
                                  <option key={si} value={String(si)}>
                                    {s.parentIndex !== null ? "  └─ " : "§"}{s.title}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })()}
                        <td style={td}>
                          <div style={{ display: "flex", gap: "0.2rem" }}>
                            <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} style={btn(i === 0 ? "#e2e8f0" : "#6b7280", i === 0 ? "#94a3b8" : "#fff")}>↑</button>
                            <button onClick={() => moveQuestion(i, 1)} disabled={i === testQuestions.length - 1} style={btn(i === testQuestions.length - 1 ? "#e2e8f0" : "#6b7280", i === testQuestions.length - 1 ? "#94a3b8" : "#fff")}>↓</button>
                            <button onClick={() => removeQuestion(i)} style={{ ...btn("#dc2626"), fontSize: "0.75rem" }} title="Remove from test">Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>}
          </div>

          {/* SIDEBAR — edit mode only */}
          {!!testId && <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={card}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>Actions</h3>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btn(BRAND.purple), width: "100%" }}>{saving ? "Saving..." : "💾 Save Test"}</button>
                <button onClick={handleValidate} disabled={validating || !testId} style={{ ...btn("#7c3aed"), width: "100%" }}>{validating ? "Validating..." : "✓ Validate"}</button>
                <button onClick={handlePublish} disabled={!testId} style={{ ...btn("#059669"), width: "100%" }}>🚀 Publish</button>
                {testId && isPublished && <button onClick={handleUnpublish} style={{ ...btn("#f59e0b"), width: "100%" }}>Unpublish</button>}
              </div>
            </div>

            {/* Stats */}
            <div style={card}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 700, color: "#374151" }}>Stats</h3>
              <div style={{ fontSize: "0.8rem", display: "grid", gap: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Total Questions</span><span style={{ fontWeight: 700 }}>{testQuestions.length}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Sections</span><span style={{ fontWeight: 700 }}>{sections.filter(s => s.parentIndex === null).length}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Subsections</span><span style={{ fontWeight: 700 }}>{sections.filter(s => s.parentIndex !== null).length}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Max Score</span><span style={{ fontWeight: 700, color: "#059669" }}>+{testQuestions.reduce((s, q) => s + q.marks, 0)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#6b7280" }}>Max Neg</span><span style={{ fontWeight: 700, color: "#dc2626" }}>−{testQuestions.reduce((s, q) => s + q.negativeMarks, 0)}</span></div>
              </div>
            </div>

            {validation && (
              <div style={card}>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 700, color: validation.valid ? "#059669" : "#dc2626" }}>
                  {validation.valid ? "✓ Ready to Publish" : "✕ Validation Issues"}
                </h3>
                {validation.errors.map((e, i) => <div key={i} style={{ fontSize: "0.75rem", color: "#dc2626", padding: "0.2rem 0" }}>• {e}</div>)}
                {validation.warnings.map((w, i) => <div key={i} style={{ fontSize: "0.75rem", color: "#f59e0b", padding: "0.2rem 0" }}>⚠ {w}</div>)}
              </div>
            )}
          </div>}
        </div>

        {addQModal && testId && (
          <AddQuestionsModal
            testId={testId}
            sectionId={addQModal.sectionId}
            sectionIndex={addQModal.sectionIndex}
            sectionTitle={addQModal.sectionTitle}
            targetCount={addQModal.targetCount}
            currentCount={addQModal.currentCount}
            onClose={() => setAddQModal(null)}
            onCommitted={handleAddQCommitted}
          />
        )}
      </div>
    );
  }

  // ─────────────────── LIST VIEW ───────────────────
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111", margin: 0 }}>Tests</h1>
        <button onClick={openCreate} style={btn(BRAND.purple)}>+ New Test</button>
      </div>

      {toast && (
        <div style={{ padding: "0.5rem 1rem", marginBottom: "1rem", borderRadius: "6px", background: toast.type === "success" ? "#ecfdf5" : "#fef2f2", color: toast.type === "success" ? "#059669" : "#dc2626", border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`, fontSize: "0.875rem" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tests..." style={{ ...inp, maxWidth: "320px" }} onKeyDown={e => e.key === "Enter" && fetchList()} />
        <button onClick={() => fetchList()} style={btn(BRAND.purple)}>Search</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#888" }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#888", border: "2px dashed #e2e8f0", borderRadius: "12px" }}>
          No tests found. <button onClick={openCreate} style={{ ...btn(BRAND.purple), marginLeft: "0.5rem" }}>Create your first test</button>
        </div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
                <th style={th}>Title</th>
                <th style={th}>Mode</th>
                <th style={th}>Series</th>
                <th style={th}>Questions</th>
                <th style={th}>Status</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{item.title}</td>
                  <td style={td}><span style={{ fontSize: "0.7rem", background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: "4px" }}>{item.mode}</span></td>
                  <td style={{ ...td, color: "#6b7280" }}>{item.series?.title || "—"}</td>
                  <td style={td}>{item._count?.questions ?? 0}</td>
                  <td style={td}>
                    {(item as any).isFree && (
                      <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: "10px", background: "#ede9fe", color: "#6d28d9", fontWeight: 700, marginRight: "0.25rem" }}>FREE</span>
                    )}
                    <span style={{ fontSize: "0.7rem", padding: "2px 7px", borderRadius: "10px", background: item.isPublished ? "#d1fae5" : "#f3f4f6", color: item.isPublished ? "#065f46" : "#6b7280", fontWeight: 700 }}>
                      {item.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => openEdit(item.id)} style={btn(BRAND.purple)}>Edit</button>
                      <button onClick={() => handleDelete(item.id, item.title)} style={btn("#dc2626")}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btn(page <= 1 ? "#e2e8f0" : "#6b7280", page <= 1 ? "#94a3b8" : "#fff")}>Prev</button>
              <span style={{ fontSize: "0.875rem", color: "#666", lineHeight: "2" }}>Page {page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btn(page >= totalPages ? "#e2e8f0" : "#6b7280", page >= totalPages ? "#94a3b8" : "#fff")}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
