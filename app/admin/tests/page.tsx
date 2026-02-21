"use client";

import { useState, useEffect, useCallback } from "react";

interface TestItem {
  id: string;
  title: string;
  mode: string;
  isTimed: boolean;
  durationSec: number | null;
  allowPause: boolean;
  strictSectionMode: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  seriesId: string | null;
  createdAt: string;
  series?: { id: string; title: string } | null;
  _count?: { questions: number; sections: number };
}

interface TestDetail {
  id: string;
  title: string;
  instructions: string | null;
  mode: string;
  isTimed: boolean;
  durationSec: number | null;
  allowPause: boolean;
  strictSectionMode: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  seriesId: string | null;
  sections: Section[];
  questions: TestQuestion[];
}

interface Section {
  id: string;
  title: string;
  order: number;
  durationSec: number | null;
}

interface TestQuestion {
  id: string;
  questionId: string;
  sectionId: string | null;
  order: number;
  question: {
    id: string;
    type: string;
    stem: string;
    difficulty: string;
    status: string;
  };
}

interface QuestionItem {
  id: string;
  type: string;
  stem: string;
  difficulty: string;
  status: string;
}

interface SeriesOption {
  id: string;
  title: string;
}

const MODES = ["TIMED", "SECTIONAL", "MULTI_SECTION"];

export default function TestsPage() {
  const [view, setView] = useState<"list" | "builder">("list");
  const [items, setItems] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [seriesList, setSeriesList] = useState<SeriesOption[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [testId, setTestId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", instructions: "", mode: "TIMED", isTimed: true,
    durationSec: "", allowPause: false, strictSectionMode: false, seriesId: "",
  });
  const [sections, setSections] = useState<{ title: string; durationSec: string }[]>([]);
  const [testQuestions, setTestQuestions] = useState<{ questionId: string; sectionIndex: number | null; question: QuestionItem }[]>([]);
  const [saving, setSaving] = useState(false);

  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [validating, setValidating] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSectionIdx, setPickerSectionIdx] = useState<number | null>(null);
  const [qSearch, setQSearch] = useState("");
  const [qResults, setQResults] = useState<QuestionItem[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qPage, setQPage] = useState(1);
  const [qTotalPages, setQTotalPages] = useState(1);

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
    fetch("/api/test-series?limit=100").then((r) => r.json()).then((d) => {
      setSeriesList((d.data || []).map((s: any) => ({ id: s.id, title: s.title })));
    }).catch(() => {});
  }, []);

  function openCreate() {
    setTestId(null);
    setForm({ title: "", instructions: "", mode: "TIMED", isTimed: true, durationSec: "", allowPause: false, strictSectionMode: false, seriesId: "" });
    setSections([]);
    setTestQuestions([]);
    setValidation(null);
    setView("builder");
  }

  async function openEdit(id: string) {
    try {
      const res = await fetch(`/api/tests/${id}`);
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      const t: TestDetail = d.data;
      setTestId(t.id);
      setForm({
        title: t.title, instructions: t.instructions || "", mode: t.mode,
        isTimed: t.isTimed, durationSec: t.durationSec ? String(t.durationSec) : "",
        allowPause: t.allowPause, strictSectionMode: t.strictSectionMode, seriesId: t.seriesId || "",
      });
      setSections(t.sections.map((s) => ({ title: s.title, durationSec: s.durationSec ? String(s.durationSec) : "" })));
      setTestQuestions(t.questions.map((tq) => ({
        questionId: tq.questionId,
        sectionIndex: tq.sectionId ? t.sections.findIndex((s) => s.id === tq.sectionId) : null,
        question: tq.question,
      })));
      setValidation(null);
      setView("builder");
    } catch { showToast("Failed to load test", "error"); }
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title, instructions: form.instructions, mode: form.mode,
        isTimed: form.isTimed, durationSec: form.durationSec || null,
        allowPause: form.allowPause, strictSectionMode: form.strictSectionMode,
        seriesId: form.seriesId || null,
        sections: sections.map((s) => ({ title: s.title, durationSec: s.durationSec || null })),
        questions: testQuestions.map((q) => ({ questionId: q.questionId, sectionIndex: q.sectionIndex })),
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
      setTestId(newTest.id);
      setSections(newTest.sections.map((s: Section) => ({ title: s.title, durationSec: s.durationSec ? String(s.durationSec) : "" })));
      setTestQuestions(newTest.questions.map((tq: TestQuestion) => ({
        questionId: tq.questionId,
        sectionIndex: tq.sectionId ? newTest.sections.findIndex((s: Section) => s.id === tq.sectionId) : null,
        question: tq.question,
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
      if (!res.ok) {
        showToast(d.error || "Cannot publish", "error");
        if (d.data?.errors) setValidation({ valid: false, errors: d.data.errors, warnings: [] });
        return;
      }
      showToast("Published!", "success");
      setView("list");
      fetchList();
    } catch { showToast("Publish failed", "error"); }
  }

  async function handleUnpublish() {
    if (!testId) return;
    try {
      const res = await fetch(`/api/tests/${testId}/unpublish`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
      showToast("Unpublished", "success");
      setView("list");
      fetchList();
    } catch { showToast("Failed", "error"); }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/tests?id=${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      showToast("Deleted", "success");
      fetchList();
    } catch { showToast("Failed", "error"); }
  }

  async function searchQuestions(pg: number = 1) {
    setQLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "20" });
      if (qSearch) params.set("search", qSearch);
      const res = await fetch(`/api/questions?${params}`);
      const d = await res.json();
      setQResults(d.data || []);
      setQTotalPages(d.pagination?.totalPages || 1);
      setQPage(pg);
    } catch { showToast("Failed to search questions", "error"); }
    finally { setQLoading(false); }
  }

  function openQuestionPicker(sectionIdx: number | null) {
    setPickerSectionIdx(sectionIdx);
    setShowPicker(true);
    setQSearch("");
    setQResults([]);
    setQPage(1);
    searchQuestions(1);
  }

  function addQuestion(q: QuestionItem) {
    if (testQuestions.some((tq) => tq.questionId === q.id)) {
      showToast("Question already added", "error");
      return;
    }
    setTestQuestions([...testQuestions, { questionId: q.id, sectionIndex: pickerSectionIdx, question: q }]);
  }

  function removeQuestion(idx: number) {
    setTestQuestions(testQuestions.filter((_, i) => i !== idx));
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    const arr = [...testQuestions];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setTestQuestions(arr);
  }

  const hasSections = ["SECTIONAL", "MULTI_SECTION"].includes(form.mode);

  if (view === "builder") {
    return (
      <div style={{ fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>
            {testId ? "Edit Test" : "New Test"}
          </h1>
          <button onClick={() => { setView("list"); fetchList(); }} style={{ ...btnPrimary, backgroundColor: "#6b7280" }}>Back to List</button>
        </div>

        {toast && (
          <div style={{ padding: "0.5rem 1rem", marginBottom: "1rem", borderRadius: "4px", backgroundColor: toast.type === "success" ? "#ecfdf5" : "#fef2f2", color: toast.type === "success" ? "#059669" : "#dc2626", border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`, fontSize: "0.875rem" }}>
            {toast.msg}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1rem" }}>
          <div>
            <div style={{ ...cardStyle, marginBottom: "1rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Test Details</h3>
              <div style={{ display: "grid", gap: "0.625rem" }}>
                <div>
                  <label style={labelStyle}>Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Instructions</label>
                  <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Mode</label>
                    <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} style={inputStyle}>
                      {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Duration (sec)</label>
                    <input type="number" value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: e.target.value })} style={inputStyle} placeholder="e.g. 3600" />
                  </div>
                  <div>
                    <label style={labelStyle}>Series</label>
                    <select value={form.seriesId} onChange={(e) => setForm({ ...form, seriesId: e.target.value })} style={inputStyle}>
                      <option value="">-- None --</option>
                      {seriesList.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem" }}>
                    <input type="checkbox" checked={form.isTimed} onChange={(e) => setForm({ ...form, isTimed: e.target.checked })} /> Timed
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem" }}>
                    <input type="checkbox" checked={form.allowPause} onChange={(e) => setForm({ ...form, allowPause: e.target.checked })} /> Allow Pause
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem" }}>
                    <input type="checkbox" checked={form.strictSectionMode} onChange={(e) => setForm({ ...form, strictSectionMode: e.target.checked })} /> Strict Section Mode
                  </label>
                </div>
              </div>
            </div>

            {hasSections && (
              <div style={{ ...cardStyle, marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Sections</h3>
                  <button onClick={() => setSections([...sections, { title: `Section ${sections.length + 1}`, durationSec: "" }])} style={{ ...btnSmall, backgroundColor: "#2563eb" }}>+ Add Section</button>
                </div>
                {sections.length === 0 ? (
                  <p style={{ color: "#888", fontSize: "0.8125rem" }}>No sections yet.</p>
                ) : (
                  sections.map((sec, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.375rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "#888", width: "1.5rem" }}>{i + 1}</span>
                      <input value={sec.title} onChange={(e) => { const s = [...sections]; s[i].title = e.target.value; setSections(s); }} style={{ ...inputStyle, flex: 1 }} />
                      <input type="number" value={sec.durationSec} onChange={(e) => { const s = [...sections]; s[i].durationSec = e.target.value; setSections(s); }} style={{ ...inputStyle, width: "80px" }} placeholder="sec" />
                      <button onClick={() => openQuestionPicker(i)} style={{ ...btnSmall, backgroundColor: "#059669" }}>+ Q</button>
                      <button onClick={() => { const s = [...sections]; s.splice(i, 1); setSections(s); setTestQuestions(testQuestions.filter((q) => q.sectionIndex !== i).map((q) => ({ ...q, sectionIndex: q.sectionIndex !== null && q.sectionIndex > i ? q.sectionIndex - 1 : q.sectionIndex }))); }} style={{ ...btnSmall, backgroundColor: "#dc2626" }}>X</button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                  Questions ({testQuestions.length})
                </h3>
                <button onClick={() => openQuestionPicker(null)} style={{ ...btnSmall, backgroundColor: "#2563eb" }}>+ Add Questions</button>
              </div>
              {testQuestions.length === 0 ? (
                <p style={{ color: "#888", fontSize: "0.8125rem" }}>No questions added yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Stem</th>
                      <th style={thStyle}>Diff</th>
                      <th style={thStyle}>Status</th>
                      {hasSections && <th style={thStyle}>Section</th>}
                      <th style={thStyle}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testQuestions.map((tq, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={tdStyle}>{tq.question.type}</td>
                        <td style={{ ...tdStyle, maxWidth: "250px" }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tq.question.stem}</span>
                        </td>
                        <td style={tdStyle}>{tq.question.difficulty}</td>
                        <td style={tdStyle}>
                          <span style={{ ...badgeStyle, backgroundColor: tq.question.status === "APPROVED" ? "#d1fae5" : "#fee2e2", color: tq.question.status === "APPROVED" ? "#065f46" : "#991b1b" }}>
                            {tq.question.status}
                          </span>
                        </td>
                        {hasSections && (
                          <td style={tdStyle}>
                            <select value={tq.sectionIndex !== null ? String(tq.sectionIndex) : ""} onChange={(e) => { const arr = [...testQuestions]; arr[i].sectionIndex = e.target.value ? parseInt(e.target.value) : null; setTestQuestions(arr); }} style={{ ...inputStyle, width: "110px", padding: "0.125rem 0.25rem", fontSize: "0.75rem" }}>
                              <option value="">-- None --</option>
                              {sections.map((s, si) => <option key={si} value={String(si)}>{s.title}</option>)}
                            </select>
                          </td>
                        )}
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: "0.125rem" }}>
                            <button onClick={() => moveQuestion(i, -1)} disabled={i === 0} style={{ ...btnSmall, backgroundColor: i === 0 ? "#e2e8f0" : "#6b7280", color: i === 0 ? "#94a3b8" : "#fff", fontSize: "0.625rem" }}>Up</button>
                            <button onClick={() => moveQuestion(i, 1)} disabled={i === testQuestions.length - 1} style={{ ...btnSmall, backgroundColor: i === testQuestions.length - 1 ? "#e2e8f0" : "#6b7280", color: i === testQuestions.length - 1 ? "#94a3b8" : "#fff", fontSize: "0.625rem" }}>Dn</button>
                            <button onClick={() => removeQuestion(i)} style={{ ...btnSmall, backgroundColor: "#dc2626", fontSize: "0.625rem" }}>X</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div>
            <div style={{ ...cardStyle, marginBottom: "1rem" }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Actions</h3>
              <div style={{ display: "grid", gap: "0.375rem" }}>
                <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, width: "100%" }}>{saving ? "Saving..." : "Save Test"}</button>
                <button onClick={handleValidate} disabled={validating || !testId} style={{ ...btnPrimary, width: "100%", backgroundColor: "#7c3aed" }}>{validating ? "Validating..." : "Validate"}</button>
                <button onClick={handlePublish} disabled={!testId} style={{ ...btnPrimary, width: "100%", backgroundColor: "#059669" }}>Publish</button>
                {testId && (
                  <button onClick={handleUnpublish} style={{ ...btnPrimary, width: "100%", backgroundColor: "#f59e0b" }}>Unpublish</button>
                )}
              </div>
            </div>

            {validation && (
              <div style={cardStyle}>
                <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600, color: validation.valid ? "#059669" : "#dc2626" }}>
                  {validation.valid ? "Ready to Publish" : "Validation Errors"}
                </h3>
                {validation.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: "0.75rem", color: "#dc2626", padding: "0.25rem 0", borderBottom: "1px solid #fecaca" }}>{e}</div>
                ))}
                {validation.warnings.map((w, i) => (
                  <div key={i} style={{ fontSize: "0.75rem", color: "#f59e0b", padding: "0.25rem 0" }}>{w}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showPicker && (
          <div style={modalOverlay}>
            <div style={{ ...modalBox, maxWidth: "640px", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                  Add Questions {pickerSectionIdx !== null && sections[pickerSectionIdx] ? `to ${sections[pickerSectionIdx].title}` : ""}
                </h3>
                <button onClick={() => setShowPicker(false)} style={{ ...btnSmall, backgroundColor: "#6b7280" }}>Close</button>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input value={qSearch} onChange={(e) => setQSearch(e.target.value)} placeholder="Search questions..." style={{ ...inputStyle, flex: 1 }} onKeyDown={(e) => e.key === "Enter" && searchQuestions(1)} />
                <button onClick={() => searchQuestions(1)} style={{ ...btnPrimary }}>Search</button>
              </div>
              {qLoading ? (
                <p style={{ textAlign: "center", color: "#888" }}>Loading...</p>
              ) : qResults.length === 0 ? (
                <p style={{ textAlign: "center", color: "#888", fontSize: "0.8125rem" }}>No questions found. Try a search.</p>
              ) : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Stem</th>
                        <th style={thStyle}>Diff</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Add</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qResults.map((q) => {
                        const alreadyAdded = testQuestions.some((tq) => tq.questionId === q.id);
                        return (
                          <tr key={q.id} style={{ borderBottom: "1px solid #f1f5f9", opacity: alreadyAdded ? 0.5 : 1 }}>
                            <td style={tdStyle}>{q.type}</td>
                            <td style={{ ...tdStyle, maxWidth: "250px" }}>
                              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.stem}</span>
                            </td>
                            <td style={tdStyle}>{q.difficulty}</td>
                            <td style={tdStyle}>
                              <span style={{ ...badgeStyle, backgroundColor: q.status === "APPROVED" ? "#d1fae5" : "#fee2e2", color: q.status === "APPROVED" ? "#065f46" : "#991b1b" }}>{q.status}</span>
                            </td>
                            <td style={tdStyle}>
                              <button onClick={() => addQuestion(q)} disabled={alreadyAdded} style={{ ...btnSmall, backgroundColor: alreadyAdded ? "#e2e8f0" : "#059669", color: alreadyAdded ? "#94a3b8" : "#fff" }}>
                                {alreadyAdded ? "Added" : "+ Add"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {qTotalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
                      <button onClick={() => searchQuestions(qPage - 1)} disabled={qPage <= 1} style={{ ...btnSmall, backgroundColor: qPage <= 1 ? "#e2e8f0" : "#2563eb", color: qPage <= 1 ? "#94a3b8" : "#fff" }}>Prev</button>
                      <span style={{ fontSize: "0.8125rem", color: "#666", lineHeight: "1.8" }}>Page {qPage}/{qTotalPages}</span>
                      <button onClick={() => searchQuestions(qPage + 1)} disabled={qPage >= qTotalPages} style={{ ...btnSmall, backgroundColor: qPage >= qTotalPages ? "#e2e8f0" : "#2563eb", color: qPage >= qTotalPages ? "#94a3b8" : "#fff" }}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>Tests</h1>
        <button onClick={openCreate} style={btnPrimary}>+ New Test</button>
      </div>

      {toast && (
        <div style={{ padding: "0.5rem 1rem", marginBottom: "1rem", borderRadius: "4px", backgroundColor: toast.type === "success" ? "#ecfdf5" : "#fef2f2", color: toast.type === "success" ? "#059669" : "#dc2626", border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`, fontSize: "0.875rem" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <input placeholder="Search by title..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, maxWidth: "300px" }} />
      </div>

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Mode</th>
              <th style={thStyle}>Questions</th>
              <th style={thStyle}>Series</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>No tests found.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={tdStyle}><strong>{item.title}</strong></td>
                <td style={tdStyle}>{item.mode}</td>
                <td style={tdStyle}>{item._count?.questions ?? 0}</td>
                <td style={{ ...tdStyle, fontSize: "0.75rem" }}>{item.series?.title || "-"}</td>
                <td style={tdStyle}>
                  <span style={{ ...badgeStyle, backgroundColor: item.isPublished ? "#d1fae5" : "#fee2e2", color: item.isPublished ? "#065f46" : "#991b1b" }}>
                    {item.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button onClick={() => openEdit(item.id)} style={{ ...btnSmall, backgroundColor: "#2563eb" }}>Edit</button>
                    <button onClick={() => handleDelete(item.id, item.title)} style={{ ...btnSmall, backgroundColor: "#dc2626" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...btnSmall, backgroundColor: page <= 1 ? "#e2e8f0" : "#2563eb", color: page <= 1 ? "#94a3b8" : "#fff" }}>Prev</button>
            <span style={{ fontSize: "0.8125rem", color: "#666", lineHeight: "1.8" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...btnSmall, backgroundColor: page >= totalPages ? "#e2e8f0" : "#2563eb", color: page >= totalPages ? "#94a3b8" : "#fff" }}>Next</button>
          </div>
        )}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: "0.375rem 0.75rem", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" };
const btnSmall: React.CSSProperties = { padding: "0.1875rem 0.5rem", color: "#fff", border: "none", borderRadius: "3px", fontSize: "0.75rem", cursor: "pointer" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.375rem 0.5rem", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", outline: "none", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: "0.125rem", color: "#374151" };
const cardStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", backgroundColor: "#fff" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "0.5rem 0.625rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 0.625rem", verticalAlign: "middle" };
const badgeStyle: React.CSSProperties = { display: "inline-block", padding: "0.125rem 0.375rem", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 500 };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalBox: React.CSSProperties = { backgroundColor: "#fff", borderRadius: "8px", padding: "1.5rem", width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" };
