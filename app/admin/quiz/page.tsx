"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef } from "react";

const PURPLE = "#7c3aed";

// ── Types ──────────────────────────────────────────────────────────────────
interface QuizItem {
  id: string;
  title: string;
  instructions: string | null;
  mode: string;
  isTimed: boolean;
  durationSec: number | null;
  totalQuestions: number | null;
  marksPerQuestion: number | null;
  negativeMarksPerQuestion: number | null;
  allowPause: boolean;
  strictSectionMode: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  xpEnabled: boolean;
  xpValue: number;
  categoryId: string | null;
  examId: string | null;
  unlockAt: string | null;
  isPublished: boolean;
  isQuiz: boolean;
  createdAt: string;
  _count?: { questions: number; sections: number };
  sections?: SectionItem[];
  questions?: TestQuestion[];
}

interface SectionItem {
  id?: string;
  title: string;
  order: number;
  durationSec: string;
  targetCount: string;
}

interface TestQuestion {
  questionId: string;
  sectionIndex: number | null;
  marks: number;
  negativeMarks: number;
  question: {
    id: string;
    type: string;
    stem: string;
    difficulty: string;
    options: { id: string; text: string; isCorrect: boolean; order: number }[];
  };
}

interface TaxoNode { id: string; name: string; }
interface QuestionRow {
  id: string; type: string; stem: string; difficulty: string;
  options: { id: string; text: string; isCorrect: boolean; order: number }[];
}

// ── AddQuestionsModal ──────────────────────────────────────────────────────
function AddQuestionsModal({
  quizId, sectionId, sectionIndex, sectionTitle,
  onClose, onCommitted,
}: {
  quizId: string;
  sectionId: string | null;
  sectionIndex: number | null;
  sectionTitle: string;
  onClose: () => void;
  onCommitted: (sections: any[], questions: any[], sectionIndex: number | null) => void;
}) {
  type Stage = "qbank" | "review" | "committing" | "done";
  const [stage, setStage] = useState<Stage>("qbank");

  // QB search state
  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState("");
  const [type, setType] = useState("");
  const [catId, setCatId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [categories, setCategories] = useState<TaxoNode[]>([]);
  const [subjects, setSubjects] = useState<TaxoNode[]>([]);
  const [topics, setTopics] = useState<TaxoNode[]>([]);
  const [results, setResults] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Review state
  interface ReviewRow { questionId: string; stem: string; type: string; difficulty: string; marks: number; negativeMarks: number; }
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);

  // Commit state
  const [commitResult, setCommitResult] = useState<{ committed: number; skipped: number } | null>(null);

  useEffect(() => {
    fetch("/api/taxonomy?level=category").then(r => r.json())
      .then(d => setCategories((d.data || []).map((c: any) => ({ id: c.id, name: c.name }))));
  }, []);

  useEffect(() => {
    if (!catId) { setSubjects([]); setSubjectId(""); return; }
    fetch(`/api/taxonomy?level=subject&parentId=${catId}`).then(r => r.json())
      .then(d => setSubjects((d.data || []).map((s: any) => ({ id: s.id, name: s.name }))));
  }, [catId]);

  useEffect(() => {
    if (!subjectId) { setTopics([]); setTopicId(""); return; }
    fetch(`/api/taxonomy?level=topic&parentId=${subjectId}`).then(r => r.json())
      .then(d => setTopics((d.data || []).map((t: any) => ({ id: t.id, name: t.name }))));
  }, [subjectId]);

  const fetchQ = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20", status: "APPROVED" });
    if (search) params.set("search", search);
    if (diff) params.set("difficulty", diff);
    if (type) params.set("type", type);
    if (catId) params.set("categoryId", catId);
    if (subjectId) params.set("subjectId", subjectId);
    if (topicId) params.set("topicId", topicId);
    const d = await fetch(`/api/questions?${params}`).then(r => r.json());
    setResults(d.data || []);
    setTotalPages(d.pagination?.totalPages || 1);
    setLoading(false);
  }, [search, diff, type, catId, subjectId, topicId]);

  useEffect(() => { fetchQ(1); setPage(1); }, [fetchQ]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function proceedToReview() {
    const rows = results.filter(q => selected.has(q.id)).map(q => ({
      questionId: q.id, stem: q.stem, type: q.type, difficulty: q.difficulty, marks: 1, negativeMarks: 0,
    }));
    setReviewRows(rows);
    setStage("review");
  }

  async function handleCommit() {
    setStage("committing");
    try {
      const res = await fetch("/api/tests/add-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: quizId,
          sectionId: sectionId || null,
          questions: reviewRows.map(r => ({
            questionId: r.questionId, type: r.type, difficulty: r.difficulty,
            marks: r.marks, negativeMarks: r.negativeMarks,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || "Commit failed"); setStage("review"); return; }
      setCommitResult({ committed: d.data.committed, skipped: d.data.skipped });
      onCommitted(d.data.sections, d.data.questions, sectionIndex);
      setStage("done");
    } catch { setStage("review"); alert("Network error"); }
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const modal: React.CSSProperties = {
    background: "#fff", borderRadius: "12px", width: "min(900px, 96vw)",
    maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
  };
  const hdr: React.CSSProperties = {
    padding: "1rem 1.5rem", borderBottom: "1px solid #e2e8f0",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  };

  if (stage === "done") {
    return (
      <div style={overlay}>
        <div style={{ ...modal, maxWidth: 400, padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem" }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", margin: "0.5rem 0" }}>Questions Added</div>
          {commitResult && <div style={{ color: "#6b7280", fontSize: "0.875rem" }}>{commitResult.committed} added, {commitResult.skipped} skipped (already in quiz).</div>}
          <button onClick={onClose} style={{ marginTop: "1.5rem", padding: "0.5rem 1.5rem", background: PURPLE, color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    );
  }

  if (stage === "committing") {
    return (
      <div style={overlay}>
        <div style={{ ...modal, maxWidth: 300, padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem" }}>⏳</div>
          <div style={{ marginTop: "0.5rem", color: "#6b7280" }}>Adding questions…</div>
        </div>
      </div>
    );
  }

  if (stage === "review") {
    return (
      <div style={overlay}>
        <div style={modal}>
          <div style={hdr}>
            <span style={{ fontWeight: 700 }}>Review &amp; confirm — {reviewRows.length} questions</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem" }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Question</th>
                  <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", width: 80 }}>Marks</th>
                  <th style={{ padding: "0.5rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", width: 80 }}>Neg.</th>
                  <th style={{ padding: "0.5rem", width: 50, borderBottom: "1px solid #e2e8f0" }}></th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((r, i) => (
                  <tr key={r.questionId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem" }}>{r.stem.slice(0, 100)}{r.stem.length > 100 ? "…" : ""}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <input type="number" min="0" step="0.5" value={r.marks}
                        onChange={e => { const next = [...reviewRows]; next[i].marks = parseFloat(e.target.value) || 0; setReviewRows(next); }}
                        style={{ width: 60, border: "1px solid #d1d5db", borderRadius: 4, padding: "0.2rem 0.4rem" }} />
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <input type="number" min="0" step="0.25" value={r.negativeMarks}
                        onChange={e => { const next = [...reviewRows]; next[i].negativeMarks = parseFloat(e.target.value) || 0; setReviewRows(next); }}
                        style={{ width: 60, border: "1px solid #d1d5db", borderRadius: 4, padding: "0.2rem 0.4rem" }} />
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "center" }}>
                      <button onClick={() => setReviewRows(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "1rem" }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button onClick={() => setStage("qbank")} style={{ padding: "0.5rem 1rem", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "#fff" }}>← Back</button>
            <button onClick={handleCommit} disabled={reviewRows.length === 0}
              style={{ padding: "0.5rem 1.25rem", background: PURPLE, color: "#fff", border: "none", borderRadius: 6, cursor: reviewRows.length === 0 ? "not-allowed" : "pointer", opacity: reviewRows.length === 0 ? 0.5 : 1 }}>
              Add {reviewRows.length} Question{reviewRows.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QB stage
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={hdr}>
          <span style={{ fontWeight: 700 }}>Add Questions {sectionTitle !== "All" ? `→ ${sectionTitle}` : ""}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem" }}>×</button>
        </div>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <input placeholder="Search questions…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "0.4rem 0.75rem", fontSize: "0.875rem", minWidth: 200, flex: 1 }} />
          <select value={diff} onChange={e => setDiff(e.target.value)} style={selStyle}>
            <option value="">All Difficulty</option>
            {["EASY","MODERATE","HARD","VERY_HARD"].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} style={selStyle}>
            <option value="">All Types</option>
            {["MCQ_SINGLE","MCQ_MULTI","TRUE_FALSE","SHORT_ANSWER","NUMERICAL"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={catId} onChange={e => { setCatId(e.target.value); setSubjectId(""); setTopicId(""); }} style={selStyle}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {subjects.length > 0 && (
            <select value={subjectId} onChange={e => { setSubjectId(e.target.value); setTopicId(""); }} style={selStyle}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {topics.length > 0 && (
            <select value={topicId} onChange={e => setTopicId(e.target.value)} style={selStyle}>
              <option value="">All Topics</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>No approved questions found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "0.5rem 0.75rem", width: 32 }}></th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Question</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", width: 90 }}>Type</th>
                  <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", width: 90 }}>Difficulty</th>
                </tr>
              </thead>
              <tbody>
                {results.map(q => (
                  <tr key={q.id} onClick={() => toggleSelect(q.id)}
                    style={{ cursor: "pointer", background: selected.has(q.id) ? "#f3f0ff" : "transparent", borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{q.stem.replace(/<[^>]*>/g, "").slice(0, 120)}{q.stem.length > 120 ? "…" : ""}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{q.type}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{q.difficulty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: "0.75rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button disabled={page <= 1} onClick={() => { fetchQ(page - 1); setPage(p => p - 1); }}
              style={{ padding: "0.3rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 4, cursor: page <= 1 ? "not-allowed" : "pointer", background: "#fff" }}>‹</button>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Page {page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => { fetchQ(page + 1); setPage(p => p + 1); }}
              style={{ padding: "0.3rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 4, cursor: page >= totalPages ? "not-allowed" : "pointer", background: "#fff" }}>›</button>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{selected.size} selected</span>
            <button disabled={selected.size === 0} onClick={proceedToReview}
              style={{ padding: "0.4rem 1rem", background: PURPLE, color: "#fff", border: "none", borderRadius: 6, cursor: selected.size === 0 ? "not-allowed" : "pointer", opacity: selected.size === 0 ? 0.5 : 1, fontSize: "0.875rem" }}>
              Review →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = {
  border: "1px solid #d1d5db", borderRadius: 6, padding: "0.4rem 0.5rem", fontSize: "0.8rem", background: "#fff",
};

// ── Main Page ──────────────────────────────────────────────────────────────
export default function QuizPage() {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Panel state
  type PanelMode = "list" | "create" | "edit";
  const [panelMode, setPanelMode] = useState<PanelMode>("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Form
  const emptyForm = {
    title: "", instructions: "", mode: "TIMED", isTimed: true,
    durationSec: "", totalQuestions: "", marksPerQuestion: "", negativeMarksPerQuestion: "",
    allowPause: false, strictSectionMode: false, shuffleQuestions: false, shuffleOptions: false,
    xpEnabled: false, xpValue: "0", categoryId: "", examId: "", unlockAt: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [isPublished, setIsPublished] = useState(false);

  // Add questions modal
  const [addQModal, setAddQModal] = useState<{ sectionId: string | null; sectionIndex: number | null; sectionTitle: string } | null>(null);

  // Taxonomy
  const [categories, setCategories] = useState<TaxoNode[]>([]);
  const [exams, setExams] = useState<TaxoNode[]>([]);

  useEffect(() => {
    fetch("/api/taxonomy?level=category").then(r => r.json()).then(d => setCategories(d.data || []));
    fetch("/api/exams?limit=100").then(r => r.json()).then(d => setExams((d.data || []).map((e: any) => ({ id: e.id, name: e.name }))));
  }, []);

  const showToast = useCallback((msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchQuizzes = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "20", quiz: "true" });
    if (q) params.set("search", q);
    const d = await fetch(`/api/tests?${params}`).then(r => r.json());
    setQuizzes(d.data || []);
    setTotal(d.pagination?.total || 0);
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchQuizzes(page); }, [page]);

  function openCreate() {
    setForm(emptyForm);
    setSections([]);
    setQuestions([]);
    setIsPublished(false);
    setEditId(null);
    setPanelMode("create");
  }

  async function openEdit(quiz: QuizItem) {
    setEditId(quiz.id);
    setIsPublished(quiz.isPublished);
    setForm({
      title: quiz.title,
      instructions: quiz.instructions || "",
      mode: quiz.mode,
      isTimed: quiz.isTimed,
      durationSec: quiz.durationSec ? String(Math.round(quiz.durationSec / 60)) : "",
      totalQuestions: quiz.totalQuestions ? String(quiz.totalQuestions) : "",
      marksPerQuestion: quiz.marksPerQuestion != null ? String(quiz.marksPerQuestion) : "",
      negativeMarksPerQuestion: quiz.negativeMarksPerQuestion != null ? String(quiz.negativeMarksPerQuestion) : "",
      allowPause: quiz.allowPause,
      strictSectionMode: quiz.strictSectionMode,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      xpEnabled: quiz.xpEnabled,
      xpValue: String(quiz.xpValue || 0),
      categoryId: quiz.categoryId || "",
      examId: quiz.examId || "",
      unlockAt: quiz.unlockAt ? quiz.unlockAt.slice(0, 16) : "",
    });

    // Fetch full quiz detail
    const d = await fetch(`/api/tests/${quiz.id}`).then(r => r.json());
    const t = d.data;
    if (t) {
      setSections((t.sections || []).map((s: any) => ({
        id: s.id, title: s.title, order: s.order,
        durationSec: s.durationSec ? String(Math.round(s.durationSec / 60)) : "",
        targetCount: s.targetCount ? String(s.targetCount) : "",
      })));
      setQuestions((t.questions || []).map((tq: any) => ({
        questionId: tq.questionId,
        sectionIndex: tq.sectionId ? (t.sections || []).findIndex((s: any) => s.id === tq.sectionId) : null,
        marks: tq.marks,
        negativeMarks: tq.negativeMarks,
        question: tq.question,
      })));
    }
    setPanelMode("edit");
  }

  async function saveQuiz() {
    if (!form.title.trim()) { showToast("Title is required", "err"); return; }
    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      instructions: form.instructions.trim() || null,
      mode: form.mode,
      isTimed: form.isTimed,
      durationSec: form.isTimed && form.durationSec ? String(parseInt(form.durationSec) * 60) : null,
      totalQuestions: form.totalQuestions ? parseInt(form.totalQuestions) : null,
      marksPerQuestion: form.marksPerQuestion !== "" ? parseFloat(form.marksPerQuestion) : null,
      negativeMarksPerQuestion: form.negativeMarksPerQuestion !== "" ? parseFloat(form.negativeMarksPerQuestion) : null,
      allowPause: form.allowPause,
      strictSectionMode: form.strictSectionMode,
      shuffleQuestions: form.shuffleQuestions,
      shuffleOptions: form.shuffleOptions,
      xpEnabled: form.xpEnabled,
      xpValue: parseInt(form.xpValue) || 0,
      categoryId: form.categoryId || null,
      examId: form.examId || null,
      unlockAt: form.unlockAt ? form.unlockAt + ":00+05:30" : null,
      isQuiz: true,
      sections: sections.map((s, i) => ({
        title: s.title || `Section ${i + 1}`,
        durationSec: form.isTimed && s.durationSec ? String(parseInt(s.durationSec) * 60) : null,
        targetCount: s.targetCount ? parseInt(s.targetCount) : null,
        parentIndex: null,
      })),
      questions: questions.map(q => ({
        questionId: q.questionId, sectionIndex: q.sectionIndex, marks: q.marks, negativeMarks: q.negativeMarks,
      })),
    };

    const isEdit = panelMode === "edit" && editId;
    if (isEdit) payload.id = editId;

    const res = await fetch("/api/tests", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { showToast(d.error || "Save failed", "err"); return; }

    const saved = d.data;
    if (!isEdit) setEditId(saved.id);
    // Refresh sections/questions from response
    if (saved) {
      setSections((saved.sections || []).map((s: any) => ({
        id: s.id, title: s.title, order: s.order,
        durationSec: s.durationSec ? String(Math.round(s.durationSec / 60)) : "",
        targetCount: s.targetCount ? String(s.targetCount) : "",
      })));
      setQuestions((saved.questions || []).map((tq: any) => ({
        questionId: tq.questionId,
        sectionIndex: tq.sectionId ? (saved.sections || []).findIndex((s: any) => s.id === tq.sectionId) : null,
        marks: tq.marks, negativeMarks: tq.negativeMarks, question: tq.question,
      })));
    }
    setPanelMode("edit");
    showToast("Quiz saved", "ok");
    fetchQuizzes(page);
  }

  async function handlePublish() {
    if (!editId) return;
    setPublishing(true);
    const endpoint = isPublished ? "unpublish" : "publish";
    const res = await fetch(`/api/tests/${editId}/${endpoint}`, { method: "POST" });
    const d = await res.json();
    setPublishing(false);
    if (!res.ok) { showToast(d.error || "Failed", "err"); return; }
    setIsPublished(!isPublished);
    showToast(isPublished ? "Quiz unpublished" : "Quiz published", "ok");
    fetchQuizzes(page);
  }

  async function deleteQuiz(id: string, title: string) {
    if (!confirm(`Delete quiz "${title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/tests/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json(); showToast(d.error || "Delete failed", "err"); return; }
    showToast("Quiz deleted", "ok");
    if (editId === id) { setPanelMode("list"); setEditId(null); }
    fetchQuizzes(page);
  }

  function addSection() {
    setSections(prev => [...prev, { title: `Section ${prev.length + 1}`, order: prev.length, durationSec: "", targetCount: "" }]);
  }

  function removeSection(idx: number) {
    setSections(prev => prev.filter((_, i) => i !== idx));
    setQuestions(prev => prev.filter(q => q.sectionIndex !== idx).map(q => ({
      ...q,
      sectionIndex: q.sectionIndex !== null && q.sectionIndex > idx ? q.sectionIndex - 1 : q.sectionIndex,
    })));
  }

  function removeQuestion(idx: number) {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  }

  function handleQuestionsAdded(newSections: any[], newQuestions: any[], sectionIdx: number | null) {
    setSections(newSections.map((s: any) => ({
      id: s.id, title: s.title, order: s.order,
      durationSec: s.durationSec ? String(Math.round(s.durationSec / 60)) : "",
      targetCount: s.targetCount ? String(s.targetCount) : "",
    })));
    setQuestions(newQuestions.map((tq: any) => ({
      questionId: tq.questionId,
      sectionIndex: tq.sectionId ? newSections.findIndex((s: any) => s.id === tq.sectionId) : null,
      marks: tq.marks, negativeMarks: tq.negativeMarks, question: tq.question,
    })));
    setAddQModal(null);
  }

  const countInSection = (idx: number | null) =>
    questions.filter(q => q.sectionIndex === idx).length;

  const field = (label: string, children: React.ReactNode, hint?: string) => (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.2rem" }}>{hint}</div>}
    </div>
  );

  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width: "100%", border: "1px solid #d1d5db", borderRadius: 6,
    padding: "0.5rem 0.75rem", fontSize: "0.875rem", boxSizing: "border-box", ...style,
  });

  const btn = (bg: string, fg = "#fff", extra?: React.CSSProperties): React.CSSProperties => ({
    padding: "0.5rem 1rem", background: bg, color: fg, border: "none",
    borderRadius: 6, cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, ...extra,
  });

  const checkRow = (label: string, checked: boolean, onChange: () => void) => (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem", color: "#374151" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 14, height: 14 }} />
      {label}
    </label>
  );

  const badgeStyle = (published: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: "999px", fontSize: "0.7rem",
    fontWeight: 700, background: published ? "#dcfce7" : "#f3f4f6", color: published ? "#166534" : "#6b7280",
  });

  const totalPages = Math.ceil(total / 20);

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "0.75rem 1.25rem", borderRadius: 8, fontWeight: 600,
          background: toast.type === "ok" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "ok" ? "#166534" : "#991b1b",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>{toast.msg}</div>
      )}

      {/* AddQuestionsModal */}
      {addQModal && editId && (
        <AddQuestionsModal
          quizId={editId}
          sectionId={addQModal.sectionId}
          sectionIndex={addQModal.sectionIndex}
          sectionTitle={addQModal.sectionTitle}
          onClose={() => setAddQModal(null)}
          onCommitted={handleQuestionsAdded}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Quiz</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#6b7280", fontSize: "0.875rem" }}>
            Standalone quizzes — no Test Series required. Assignable to course lessons.
          </p>
        </div>
        <button onClick={openCreate} style={btn(PURPLE)}>+ New Quiz</button>
      </div>

      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
        {/* ── List pane ── */}
        <div style={{ flex: panelMode !== "list" ? "0 0 380px" : 1, minWidth: 0 }}>
          {/* Search */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <input placeholder="Search quizzes…" value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setPage(1); fetchQuizzes(1, search); } }}
              style={{ ...inp(), flex: 1 }} />
            <button onClick={() => { setPage(1); fetchQuizzes(1, search); }} style={btn("#475569")}>Search</button>
          </div>

          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading…</div>
          ) : quizzes.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6b7280", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📝</div>
              <div style={{ fontWeight: 600 }}>No quizzes yet</div>
              <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>Create your first quiz to get started.</div>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Title</th>
                    {panelMode === "list" && <>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Mode</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Questions</th>
                    </>}
                    <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 600, color: "#374151" }}>Status</th>
                    <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: 600, color: "#374151" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map(q => (
                    <tr key={q.id}
                      style={{ borderBottom: "1px solid #f1f5f9", background: editId === q.id ? "#faf5ff" : "transparent" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>
                        {q.title}
                        {q.unlockAt && <div style={{ fontSize: "0.7rem", color: "#7c3aed", marginTop: "0.1rem" }}>🔓 {new Date(q.unlockAt).toLocaleDateString()}</div>}
                      </td>
                      {panelMode === "list" && <>
                        <td style={{ padding: "0.75rem", color: "#6b7280" }}>{q.mode}</td>
                        <td style={{ padding: "0.75rem", color: "#6b7280" }}>{q._count?.questions ?? "—"}</td>
                      </>}
                      <td style={{ padding: "0.75rem" }}><span style={badgeStyle(q.isPublished)}>{q.isPublished ? "Published" : "Draft"}</span></td>
                      <td style={{ padding: "0.75rem", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
                          <button onClick={() => openEdit(q)} style={btn("#ede9fe", PURPLE, { fontSize: "0.75rem", padding: "0.3rem 0.6rem" })}>Edit</button>
                          <button onClick={() => deleteQuiz(q.id, q.title)} style={btn("#fee2e2", "#dc2626", { fontSize: "0.75rem", padding: "0.3rem 0.6rem" })}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button disabled={page <= 1} onClick={() => setPage(p => { const n = p - 1; fetchQuizzes(n); return n; })}
                    style={{ ...btn("#f1f5f9", "#374151"), opacity: page <= 1 ? 0.4 : 1 }}>‹ Prev</button>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280", flex: 1, textAlign: "center" }}>Page {page} of {totalPages} — {total} total</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(p => { const n = p + 1; fetchQuizzes(n); return n; })}
                    style={{ ...btn("#f1f5f9", "#374151"), opacity: page >= totalPages ? 0.4 : 1 }}>Next ›</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Builder pane ── */}
        {panelMode !== "list" && (
          <div style={{ flex: 1, minWidth: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            {/* Builder header */}
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#faf5ff" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: PURPLE }}>
                  {panelMode === "create" ? "New Quiz" : form.title || "Edit Quiz"}
                </div>
                {editId && <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: 2 }}>ID: {editId}</div>}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {panelMode === "edit" && editId && (
                  <button onClick={handlePublish} disabled={publishing}
                    style={btn(isPublished ? "#fef3c7" : "#dcfce7", isPublished ? "#92400e" : "#166534", { opacity: publishing ? 0.6 : 1 })}>
                    {publishing ? "…" : isPublished ? "Unpublish" : "Publish"}
                  </button>
                )}
                <button onClick={saveQuiz} disabled={saving}
                  style={btn(PURPLE, "#fff", { opacity: saving ? 0.6 : 1 })}>
                  {saving ? "Saving…" : panelMode === "create" ? "Create Quiz" : "Save Changes"}
                </button>
                <button onClick={() => { setPanelMode("list"); setEditId(null); }}
                  style={btn("#f1f5f9", "#374151")}>✕ Close</button>
              </div>
            </div>

            <div style={{ padding: "1.5rem", overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
              {/* Basic info */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Basic Info</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    {field("Quiz Title *",
                      <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp()} placeholder="e.g. Chapter 3 Practice Quiz" />
                    )}
                  </div>
                  {field("Instructions",
                    <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                      style={{ ...inp(), height: 80, resize: "vertical" }} placeholder="Optional instructions shown to students…" />,
                    undefined
                  )}
                  <div>
                    {field("Category",
                      <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} style={inp()}>
                        <option value="">— None —</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    {field("Exam",
                      <select value={form.examId} onChange={e => setForm(f => ({ ...f, examId: e.target.value }))} style={inp()}>
                        <option value="">— None —</option>
                        {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Timing & Scoring */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Timing &amp; Scoring</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  {field("Mode",
                    <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} style={inp()}>
                      <option value="TIMED">Timed</option>
                      <option value="SECTIONAL">Sectional</option>
                    </select>
                  )}
                  {field("Duration (minutes)",
                    <input type="number" min="1" value={form.durationSec}
                      onChange={e => setForm(f => ({ ...f, durationSec: e.target.value }))} style={inp()}
                      placeholder="e.g. 30" />,
                    "Leave blank for untimed"
                  )}
                  {field("Total Questions",
                    <input type="number" min="1" value={form.totalQuestions}
                      onChange={e => setForm(f => ({ ...f, totalQuestions: e.target.value }))} style={inp()} placeholder="e.g. 20" />
                  )}
                  {field("Marks per Question",
                    <input type="number" min="0" step="0.5" value={form.marksPerQuestion}
                      onChange={e => setForm(f => ({ ...f, marksPerQuestion: e.target.value }))} style={inp()} placeholder="e.g. 1" />,
                    "Default; overridable per question"
                  )}
                  {field("Negative Marks",
                    <input type="number" min="0" step="0.25" value={form.negativeMarksPerQuestion}
                      onChange={e => setForm(f => ({ ...f, negativeMarksPerQuestion: e.target.value }))} style={inp()} placeholder="e.g. 0.25" />,
                    "Default; overridable per question"
                  )}
                  {field("Unlock At",
                    <input type="datetime-local" value={form.unlockAt}
                      onChange={e => setForm(f => ({ ...f, unlockAt: e.target.value }))} style={inp()} />,
                    "Students cannot access before this time"
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "0.5rem" }}>
                  {checkRow("Allow Pause", form.allowPause, () => setForm(f => ({ ...f, allowPause: !f.allowPause })))}
                  {checkRow("Strict Section Mode", form.strictSectionMode, () => setForm(f => ({ ...f, strictSectionMode: !f.strictSectionMode })))}
                  {checkRow("Shuffle Questions", form.shuffleQuestions, () => setForm(f => ({ ...f, shuffleQuestions: !f.shuffleQuestions })))}
                  {checkRow("Shuffle Options", form.shuffleOptions, () => setForm(f => ({ ...f, shuffleOptions: !f.shuffleOptions })))}
                </div>
              </div>

              {/* XP */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>XP Reward</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  {checkRow("Award XP on completion", form.xpEnabled, () => setForm(f => ({ ...f, xpEnabled: !f.xpEnabled })))}
                  {form.xpEnabled && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151" }}>XP Value</label>
                      <input type="number" min="0" value={form.xpValue}
                        onChange={e => setForm(f => ({ ...f, xpValue: e.target.value }))}
                        style={{ width: 80, border: "1px solid #d1d5db", borderRadius: 6, padding: "0.4rem 0.6rem", fontSize: "0.875rem" }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Sections (only for SECTIONAL mode or if quiz already has sections) */}
              {(form.mode === "SECTIONAL" || sections.length > 0) && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sections</div>
                    <button onClick={addSection} style={btn(PURPLE, "#fff", { fontSize: "0.75rem", padding: "0.3rem 0.75rem" })}>+ Add Section</button>
                  </div>
                  {sections.length === 0 ? (
                    <div style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No sections yet. Click "+ Add Section" to create one.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {sections.map((sec, i) => (
                        <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.75rem 1rem", background: "#faf5ff" }}>
                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                            <div style={{ flex: 1 }}>
                              <input value={sec.title} onChange={e => setSections(prev => { const n = [...prev]; n[i].title = e.target.value; return n; })}
                                style={{ ...inp(), marginBottom: "0.5rem" }} placeholder={`Section ${i + 1} title`} />
                              <div style={{ display: "flex", gap: "0.5rem" }}>
                                <input type="number" min="1" value={sec.durationSec} placeholder="Duration (min)"
                                  onChange={e => setSections(prev => { const n = [...prev]; n[i].durationSec = e.target.value; return n; })}
                                  style={{ ...inp(), flex: 1 }} />
                                <input type="number" min="1" value={sec.targetCount} placeholder="Target Qs"
                                  onChange={e => setSections(prev => { const n = [...prev]; n[i].targetCount = e.target.value; return n; })}
                                  style={{ ...inp(), flex: 1 }} />
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                              {editId && (
                                <button onClick={() => setAddQModal({ sectionId: sec.id || null, sectionIndex: i, sectionTitle: sec.title })}
                                  style={btn(PURPLE, "#fff", { fontSize: "0.75rem", padding: "0.3rem 0.65rem", whiteSpace: "nowrap" })}>
                                  + Questions ({countInSection(i)})
                                </button>
                              )}
                              <button onClick={() => removeSection(i)} style={btn("#fee2e2", "#dc2626", { fontSize: "0.75rem", padding: "0.3rem 0.65rem" })}>Remove</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Questions */}
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Questions ({questions.length})
                  </div>
                  {editId ? (
                    <button onClick={() => setAddQModal({ sectionId: null, sectionIndex: null, sectionTitle: "All" })}
                      style={btn(PURPLE, "#fff", { fontSize: "0.8rem", padding: "0.4rem 0.85rem" })}>
                      + Add Questions
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Save quiz first to add questions</span>
                  )}
                </div>

                {questions.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", color: "#9ca3af", background: "#f8fafc", borderRadius: 8, border: "1px dashed #e2e8f0", fontSize: "0.875rem" }}>
                    No questions yet. {editId ? "Click \"+ Add Questions\" to pick from the question bank." : "Save the quiz first, then add questions."}
                  </div>
                ) : (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>#</th>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}>Question</th>
                          <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", width: 60 }}>Section</th>
                          <th style={{ padding: "0.5rem 0.75rem", width: 70 }}>Marks</th>
                          <th style={{ padding: "0.5rem 0.75rem", width: 70 }}>Neg.</th>
                          <th style={{ padding: "0.5rem 0.75rem", width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((tq, i) => (
                          <tr key={tq.questionId + i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "0.5rem 0.75rem", color: "#9ca3af" }}>{i + 1}</td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <div style={{ fontSize: "0.8rem" }}>
                                {(tq.question?.stem || "").replace(/<[^>]*>/g, "").slice(0, 100)}
                                {(tq.question?.stem || "").length > 100 ? "…" : ""}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "#9ca3af", marginTop: "0.1rem" }}>
                                {tq.question?.type} · {tq.question?.difficulty}
                              </div>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <select value={tq.sectionIndex !== null ? String(tq.sectionIndex) : ""}
                                onChange={e => {
                                  const val = e.target.value !== "" ? parseInt(e.target.value) : null;
                                  setQuestions(prev => { const n = [...prev]; n[i] = { ...n[i], sectionIndex: val }; return n; });
                                }}
                                style={{ fontSize: "0.75rem", border: "1px solid #d1d5db", borderRadius: 4, padding: "0.2rem" }}>
                                <option value="">None</option>
                                {sections.map((s, si) => <option key={si} value={String(si)}>{s.title}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <input type="number" min="0" step="0.5" value={tq.marks}
                                onChange={e => { setQuestions(prev => { const n = [...prev]; n[i].marks = parseFloat(e.target.value) || 0; return n; }); }}
                                style={{ width: 55, border: "1px solid #d1d5db", borderRadius: 4, padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} />
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem" }}>
                              <input type="number" min="0" step="0.25" value={tq.negativeMarks}
                                onChange={e => { setQuestions(prev => { const n = [...prev]; n[i].negativeMarks = parseFloat(e.target.value) || 0; return n; }); }}
                                style={{ width: 55, border: "1px solid #d1d5db", borderRadius: 4, padding: "0.2rem 0.4rem", fontSize: "0.8rem" }} />
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                              <button onClick={() => removeQuestion(i)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: "0.9rem" }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Save bar */}
              <div style={{ paddingTop: "1rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.75rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                {panelMode === "edit" && editId && (
                  <button onClick={handlePublish} disabled={publishing}
                    style={btn(isPublished ? "#fef3c7" : "#dcfce7", isPublished ? "#92400e" : "#166534", { opacity: publishing ? 0.6 : 1 })}>
                    {publishing ? "…" : isPublished ? "Unpublish" : "Publish"}
                  </button>
                )}
                <button onClick={saveQuiz} disabled={saving} style={btn(PURPLE, "#fff", { opacity: saving ? 0.6 : 1 })}>
                  {saving ? "Saving…" : panelMode === "create" ? "Create Quiz" : "Save Changes"}
                </button>
                {panelMode === "edit" && editId && (
                  <button onClick={() => deleteQuiz(editId, form.title)} style={btn("#fee2e2", "#dc2626")}>Delete Quiz</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
