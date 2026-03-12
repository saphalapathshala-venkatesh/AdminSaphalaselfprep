"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

// ─── Types ────────────────────────────────────────────────────────────────────
type FlowItem = {
  id: string; contentType: "VIDEO" | "PDF" | "FLASHCARD"; contentId: string;
  displayOrder: number; titleSnapshot: string | null;
  currentTitle: string | null; thumbnailUrl: string | null;
  durationSeconds?: number | null; cardCount?: number;
  status?: string; isPublished?: boolean; contentMissing?: boolean;
};

type TaxCategory = { id: string; name: string; subjects: TaxSubject[] };
type TaxSubject  = { id: string; name: string; topics: TaxTopic[] };
type TaxTopic    = { id: string; name: string; subtopics: TaxSubtopic[] };
type TaxSubtopic = { id: string; name: string };
type Course      = { id: string; name: string };
type AddItem     = { id: string; title: string; isPublished?: boolean; thumbnailUrl?: string | null; durationSeconds?: number | null; cardCount?: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  VIDEO:     { label: "Video",    bg: "#dbeafe", color: "#1d4ed8", icon: "▶" },
  PDF:       { label: "PDF",      bg: "#fef3c7", color: "#b45309", icon: "📄" },
  FLASHCARD: { label: "Flashcard",bg: "#f3e8ff", color: PURPLE,    icon: "🃏" },
} as const;

function fmtDuration(s: number | null | undefined) {
  if (!s) return null;
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

function contextLabel(courseId: string, categoryId: string, subjectId: string, topicId: string, subtopicId: string,
  courses: Course[], taxonomy: TaxCategory[]) {
  if (courseId) {
    const c = courses.find(x => x.id === courseId);
    return c ? `Course: ${c.name}` : "Course";
  }
  const parts: string[] = [];
  if (categoryId) { const c = taxonomy.find(x => x.id === categoryId); if (c) parts.push(c.name); }
  if (subjectId) { for (const c of taxonomy) { const s = c.subjects.find(x => x.id === subjectId); if (s) { parts.push(s.name); break; } } }
  if (topicId) { for (const c of taxonomy) for (const s of c.subjects) { const t = s.topics.find(x => x.id === topicId); if (t) { parts.push(t.name); break; } } }
  if (subtopicId) { for (const c of taxonomy) for (const s of c.subjects) for (const t of s.topics) { const st = t.subtopics.find(x => x.id === subtopicId); if (st) { parts.push(st.name); break; } } }
  return parts.length ? parts.join(" › ") : "";
}

// ─── Style constants ──────────────────────────────────────────────────────────
const inputSt: React.CSSProperties = { width: "100%", padding: "0.4375rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.8125rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelSt: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.04em" };

// ─── Main component ───────────────────────────────────────────────────────────
export default function ContentFlowPage() {
  const [contextMode, setContextMode] = useState<"course" | "taxonomy">("course");

  // Context fields
  const [courseId,    setCourseId]    = useState("");
  const [categoryId,  setCategoryId]  = useState("");
  const [subjectId,   setSubjectId]   = useState("");
  const [topicId,     setTopicId]     = useState("");
  const [subtopicId,  setSubtopicId]  = useState("");

  // Reference data
  const [taxonomy, setTaxonomy] = useState<TaxCategory[]>([]);
  const [courses,  setCourses]  = useState<Course[]>([]);

  // Flow state
  const [flowItems,   setFlowItems]   = useState<FlowItem[]>([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowLoaded,  setFlowLoaded]  = useState(false);
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Add modal
  const [showAdd,    setShowAdd]    = useState(false);
  const [addTab,     setAddTab]     = useState<"VIDEO" | "PDF" | "FLASHCARD">("VIDEO");
  const [addSearch,  setAddSearch]  = useState("");
  const [addItems,   setAddItems]   = useState<AddItem[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addingId,   setAddingId]   = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Toast helper ───────────────────────────────────────────────────────────
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

  // ─── Load reference data once ───────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/taxonomy?tree=true").then(r => r.json()),
      fetch("/api/courses?all=true").then(r => r.json()),
    ]).then(([tj, cj]) => {
      setTaxonomy(tj.data || []);
      setCourses(cj.data || []);
    });
  }, []);

  // ─── Derived taxonomy cascades ──────────────────────────────────────────────
  const subjects  = taxonomy.find(c => c.id === categoryId)?.subjects || [];
  const topics    = subjects.find(s => s.id === subjectId)?.topics || [];
  const subtopics = topics.find(t => t.id === topicId)?.subtopics || [];

  // ─── Build context query params ─────────────────────────────────────────────
  const buildContextParams = useCallback((): URLSearchParams | null => {
    const p = new URLSearchParams();
    if (contextMode === "course") {
      if (!courseId) return null;
      p.set("courseId", courseId);
    } else {
      if (!categoryId && !subjectId && !topicId && !subtopicId) return null;
      if (courseId)    p.set("courseId",    courseId);
      if (categoryId)  p.set("categoryId",  categoryId);
      if (subjectId)   p.set("subjectId",   subjectId);
      if (topicId)     p.set("topicId",     topicId);
      if (subtopicId)  p.set("subtopicId",  subtopicId);
    }
    return p;
  }, [contextMode, courseId, categoryId, subjectId, topicId, subtopicId]);

  // ─── Load flow ──────────────────────────────────────────────────────────────
  const loadFlow = useCallback(async () => {
    const p = buildContextParams();
    if (!p) { setFlowItems([]); setFlowLoaded(false); return; }
    setFlowLoading(true); setDirty(false);
    const res = await fetch(`/api/content-flow?${p}`);
    const json = await res.json();
    setFlowItems(json.data || []);
    setFlowLoaded(true);
    setFlowLoading(false);
  }, [buildContextParams]);

  useEffect(() => { loadFlow(); }, [loadFlow]);

  // ─── Reorder helpers ─────────────────────────────────────────────────────────
  function moveItem(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= flowItems.length) return;
    const updated = [...flowItems];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((item, i) => { item.displayOrder = i; });
    setFlowItems(updated);
    setDirty(true);
  }

  async function saveOrder() {
    setSaving(true);
    const orderedIds = flowItems.map(i => i.id);
    const res = await fetch("/api/content-flow/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) { setDirty(false); showToast("Order saved!"); }
    else showToast(json.error || "Failed to save", false);
  }

  // ─── Remove item ─────────────────────────────────────────────────────────────
  async function removeItem(id: string) {
    const res = await fetch(`/api/content-flow/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) {
      setFlowItems(prev => prev.filter(i => i.id !== id).map((item, idx) => ({ ...item, displayOrder: idx })));
      setDirty(false);
      showToast("Removed from flow");
    } else {
      showToast(json.error || "Failed to remove", false);
    }
  }

  // ─── Add modal search ────────────────────────────────────────────────────────
  const fetchAddItems = useCallback(async (tab: string, search: string) => {
    setAddLoading(true); setAddItems([]);
    const q = new URLSearchParams({ search, pageSize: "40" });
    let url = "";
    if (tab === "VIDEO")     url = `/api/videos?${q}`;
    else if (tab === "PDF")  url = `/api/pdf-assets?${q}`;
    else                     url = `/api/flashcards/decks?${q}`;
    const res = await fetch(url);
    const json = await res.json();
    // APIs use different shapes: videos→data, pdfs→items, flashcards→items
    const raw = json.data || json.items || [];
    const mapped: AddItem[] = raw.map((item: any) => ({
      id:              item.id,
      title:           item.title,
      isPublished:     item.isPublished ?? item.status === "PUBLISHED",
      thumbnailUrl:    item.thumbnailUrl ?? null,
      durationSeconds: item.durationSeconds ?? null,
      cardCount:       item._count?.cards ?? undefined,
    }));
    setAddItems(mapped);
    setAddLoading(false);
  }, []);

  useEffect(() => {
    if (!showAdd) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchAddItems(addTab, addSearch), 250);
  }, [showAdd, addTab, addSearch, fetchAddItems]);

  async function handleAddItem(item: AddItem) {
    const p = buildContextParams();
    if (!p) return;
    setAddingId(item.id);
    const contextData = Object.fromEntries(p.entries());
    const res = await fetch("/api/content-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...contextData,
        contentType: addTab,
        contentId: item.id,
        titleSnapshot: item.title,
      }),
    });
    const json = await res.json();
    setAddingId(null);
    if (res.ok) {
      showToast(`"${item.title}" added to flow`);
      loadFlow(); // refresh
    } else {
      showToast(json.error || "Failed to add", false);
    }
  }

  // ─── Context handlers ────────────────────────────────────────────────────────
  function handleCategoryChange(v: string) { setCategoryId(v); setSubjectId(""); setTopicId(""); setSubtopicId(""); }
  function handleSubjectChange(v: string)  { setSubjectId(v);  setTopicId(""); setSubtopicId(""); }
  function handleTopicChange(v: string)    { setTopicId(v);    setSubtopicId(""); }

  const currentLabel = contextLabel(
    contextMode === "course" ? courseId : "",
    contextMode === "taxonomy" ? categoryId : "",
    contextMode === "taxonomy" ? subjectId : "",
    contextMode === "taxonomy" ? topicId : "",
    contextMode === "taxonomy" ? subtopicId : "",
    courses, taxonomy
  );
  const hasContext = contextMode === "course" ? !!courseId : !!(categoryId || subjectId || topicId || subtopicId);

  // ─── Already-in-flow set (for add modal) ─────────────────────────────────────
  const inFlowSet = new Set(flowItems.filter(i => i.contentType === addTab).map(i => i.contentId));

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", transition: "opacity 0.3s" }}>
          {toast.msg}
        </div>
      )}

      {/* Add Content Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
          <div style={{ width: 520, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.15)" }}>
            {/* Modal header */}
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>Add to Flow</div>
                {currentLabel && <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>{currentLabel}</div>}
              </div>
              <button onClick={() => { setShowAdd(false); setAddSearch(""); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Type tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
              {(["VIDEO","PDF","FLASHCARD"] as const).map(tab => (
                <button key={tab} onClick={() => { setAddTab(tab); setAddSearch(""); }} style={{ flex: 1, padding: "0.75rem", border: "none", borderBottom: `3px solid ${addTab === tab ? PURPLE : "transparent"}`, background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 700, color: addTab === tab ? PURPLE : "#64748b", transition: "color 0.15s" }}>
                  {TYPE_CONFIG[tab].icon} {TYPE_CONFIG[tab].label}s
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
              <input
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                placeholder={`Search ${TYPE_CONFIG[addTab].label.toLowerCase()}s…`}
                style={{ ...inputSt, fontSize: "0.875rem" }}
                autoFocus
              />
            </div>

            {/* Results */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
              {addLoading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
              ) : addItems.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                  {addSearch ? `No ${TYPE_CONFIG[addTab].label.toLowerCase()}s matching "${addSearch}"` : `No ${TYPE_CONFIG[addTab].label.toLowerCase()}s found`}
                </div>
              ) : (
                addItems.map(item => {
                  const alreadyIn = inFlowSet.has(item.id);
                  const isAdding  = addingId === item.id;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f8fafc", opacity: alreadyIn ? 0.5 : 1 }}>
                      {/* Thumb / icon */}
                      {addTab === "VIDEO" ? (
                        <div style={{ width: 52, height: 34, borderRadius: "5px", background: item.thumbnailUrl ? `url(${item.thumbnailUrl}) center/cover` : "linear-gradient(135deg,#7c3aed22,#3b82f622)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                          {!item.thumbnailUrl && <span style={{ opacity: 0.4 }}>▶</span>}
                        </div>
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: "8px", background: TYPE_CONFIG[addTab].bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", flexShrink: 0 }}>
                          {TYPE_CONFIG[addTab].icon}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                          {addTab === "VIDEO" && fmtDuration(item.durationSeconds) && `${fmtDuration(item.durationSeconds)} · `}
                          {addTab === "FLASHCARD" && item.cardCount !== undefined && `${item.cardCount} cards · `}
                          <span style={{ color: item.isPublished ? "#15803d" : "#94a3b8", fontWeight: 600 }}>{item.isPublished ? "Published" : "Draft"}</span>
                        </div>
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => !alreadyIn && handleAddItem(item)}
                        disabled={alreadyIn || !!addingId}
                        style={{ padding: "0.3125rem 0.875rem", borderRadius: "6px", border: `1px solid ${alreadyIn ? "#e2e8f0" : PURPLE}`, background: alreadyIn ? "#f8fafc" : isAdding ? `${PURPLE}dd` : "#fff", color: alreadyIn ? "#94a3b8" : PURPLE, cursor: alreadyIn ? "default" : "pointer", fontSize: "0.8125rem", fontWeight: 600, flexShrink: 0, transition: "background 0.15s" }}
                      >
                        {alreadyIn ? "In flow" : isAdding ? "Adding…" : "+ Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Content Flow</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
            Arrange Videos, PDFs, and Flashcard Decks into an exact, ordered learning sequence for any context.
          </p>
        </div>
        {hasContext && (
          <button
            onClick={() => { setShowAdd(true); setAddSearch(""); }}
            style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", border: "none", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
          >
            + Add Content
          </button>
        )}
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "272px 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Context selector ──────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden", position: "sticky", top: "1rem" }}>
          <div style={{ padding: "1rem 1.125rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Select Context</div>
            {/* Mode tabs */}
            <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: "1rem" }}>
              {(["course","taxonomy"] as const).map(m => (
                <button key={m} onClick={() => { setContextMode(m); setCourseId(""); setCategoryId(""); setSubjectId(""); setTopicId(""); setSubtopicId(""); }} style={{ flex: 1, padding: "0.4rem", border: "none", background: contextMode === m ? PURPLE : "#fff", color: contextMode === m ? "#fff" : "#64748b", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                  {m === "course" ? "Course" : "Taxonomy"}
                </button>
              ))}
            </div>

            {contextMode === "course" ? (
              <div>
                <label style={labelSt}>Course</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} style={inputSt}>
                  <option value="">— Select course —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <div>
                  <label style={labelSt}>Category</label>
                  <select value={categoryId} onChange={e => handleCategoryChange(e.target.value)} style={inputSt}>
                    <option value="">— Any —</option>
                    {taxonomy.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Subject</label>
                  <select value={subjectId} onChange={e => handleSubjectChange(e.target.value)} disabled={!subjects.length} style={{ ...inputSt, opacity: subjects.length ? 1 : 0.5 }}>
                    <option value="">— Any —</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Topic</label>
                  <select value={topicId} onChange={e => handleTopicChange(e.target.value)} disabled={!topics.length} style={{ ...inputSt, opacity: topics.length ? 1 : 0.5 }}>
                    <option value="">— Any —</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Subtopic</label>
                  <select value={subtopicId} onChange={e => setSubtopicId(e.target.value)} disabled={!subtopics.length} style={{ ...inputSt, opacity: subtopics.length ? 1 : 0.5 }}>
                    <option value="">— Any —</option>
                    {subtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Context summary */}
          {hasContext && (
            <div style={{ padding: "0.875rem 1.125rem", background: "#f5f3ff" }}>
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Active Context</div>
              <div style={{ fontSize: "0.8125rem", color: "#4c1d95", fontWeight: 600 }}>{currentLabel}</div>
              <div style={{ fontSize: "0.75rem", color: "#7c3aed", marginTop: "0.375rem" }}>{flowItems.length} item{flowItems.length !== 1 ? "s" : ""} in flow</div>
            </div>
          )}
        </div>

        {/* ── Flow editor ───────────────────────────────────────────────────────── */}
        <div>
          {!hasContext ? (
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", padding: "5rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem", color: "#475569", marginBottom: "0.5rem" }}>Select a context to get started</div>
              <div style={{ fontSize: "0.875rem", color: "#94a3b8", maxWidth: 420, margin: "0 auto" }}>
                Pick a Course or a Taxonomy node on the left, then build your ordered content flow — mix Videos, PDFs, and Flashcard Decks in exactly the sequence you want.
              </div>
            </div>
          ) : flowLoading ? (
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
              Loading flow…
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              {/* Flow header toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>{currentLabel}</span>
                  <span style={{ marginLeft: "0.625rem", fontSize: "0.8125rem", color: "#94a3b8" }}>{flowItems.length} item{flowItems.length !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
                  {dirty && (
                    <span style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600, background: "#fef3c7", padding: "0.25rem 0.625rem", borderRadius: "12px" }}>
                      Unsaved order
                    </span>
                  )}
                  {dirty && (
                    <button onClick={saveOrder} disabled={saving} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "none", background: "#15803d", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.8125rem", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                      {saving ? "Saving…" : "Save Order"}
                    </button>
                  )}
                  <button onClick={() => { setShowAdd(true); setAddSearch(""); }} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 700 }}>
                    + Add Content
                  </button>
                </div>
              </div>

              {/* Empty state */}
              {flowItems.length === 0 ? (
                <div style={{ padding: "5rem 2rem", textAlign: "center" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🗂️</div>
                  <div style={{ fontWeight: 600, fontSize: "1rem", color: "#475569", marginBottom: "0.5rem" }}>No items in this flow yet</div>
                  <div style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: "1.5rem" }}>Add Videos, PDFs, and Flashcard Decks to build the learning sequence for this context.</div>
                  <button onClick={() => { setShowAdd(true); setAddSearch(""); }} style={{ padding: "0.5rem 1.5rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}>
                    + Add First Item
                  </button>
                </div>
              ) : (
                <div>
                  {flowItems.map((item, index) => {
                    const cfg = TYPE_CONFIG[item.contentType];
                    const editHref = item.contentType === "VIDEO"
                      ? `/admin/videos/${item.contentId}`
                      : item.contentType === "PDF"
                      ? `/admin/content-library`
                      : `/admin/flashcards`;

                    return (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid #f1f5f9", background: item.contentMissing ? "#fff8f8" : "transparent", transition: "background 0.1s" }}
                        onMouseEnter={e => { if (!item.contentMissing) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = item.contentMissing ? "#fff8f8" : "transparent"; }}
                      >
                        {/* Order number */}
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                          {index + 1}
                        </div>

                        {/* Type badge */}
                        <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.6875rem", fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {cfg.icon} {cfg.label}
                        </span>

                        {/* Thumbnail / icon */}
                        {item.contentType === "VIDEO" ? (
                          <div style={{ width: 56, height: 36, borderRadius: "5px", flexShrink: 0, background: item.thumbnailUrl ? `url(${item.thumbnailUrl}) center/cover` : "linear-gradient(135deg,#7c3aed22,#3b82f622)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {!item.thumbnailUrl && <span style={{ opacity: 0.35, fontSize: "1rem" }}>▶</span>}
                          </div>
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: "8px", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>
                            {cfg.icon}
                          </div>
                        )}

                        {/* Title + meta */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem", color: item.contentMissing ? "#dc2626" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.currentTitle || item.titleSnapshot || <em style={{ color: "#94a3b8" }}>Untitled</em>}
                            {item.contentMissing && <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "#dc2626", fontWeight: 700 }}>CONTENT DELETED</span>}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.125rem", display: "flex", gap: "0.5rem" }}>
                            {item.contentType === "VIDEO" && fmtDuration(item.durationSeconds) && (
                              <span>{fmtDuration(item.durationSeconds)}</span>
                            )}
                            {item.contentType === "FLASHCARD" && item.cardCount !== undefined && (
                              <span>{item.cardCount} cards</span>
                            )}
                            {item.status && (
                              <span style={{ color: item.status === "PUBLISHED" ? "#15803d" : "#94a3b8", fontWeight: 600 }}>{item.status}</span>
                            )}
                            {item.isPublished !== undefined && item.contentType !== "VIDEO" && (
                              <span style={{ color: item.isPublished ? "#15803d" : "#94a3b8", fontWeight: 600 }}>{item.isPublished ? "Published" : "Draft"}</span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "0.375rem", alignItems: "center", flexShrink: 0 }}>
                          {/* Move up */}
                          <button
                            onClick={() => moveItem(index, -1)}
                            disabled={index === 0}
                            title="Move up"
                            style={{ width: 30, height: 30, borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: index === 0 ? "not-allowed" : "pointer", opacity: index === 0 ? 0.35 : 1, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >▲</button>

                          {/* Move down */}
                          <button
                            onClick={() => moveItem(index, 1)}
                            disabled={index === flowItems.length - 1}
                            title="Move down"
                            style={{ width: 30, height: 30, borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: index === flowItems.length - 1 ? "not-allowed" : "pointer", opacity: index === flowItems.length - 1 ? 0.35 : 1, fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >▼</button>

                          {/* Open in editor */}
                          <Link
                            href={editHref}
                            title="Open in editor"
                            style={{ width: 30, height: 30, borderRadius: "6px", border: `1px solid ${PURPLE}`, color: PURPLE, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: "0.8rem", fontWeight: 700 }}
                          >↗</Link>

                          {/* Remove from flow */}
                          <button
                            onClick={() => removeItem(item.id)}
                            title="Remove from flow"
                            style={{ width: 30, height: 30, borderRadius: "6px", border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
                          >×</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Bottom save bar (visible only when dirty) */}
                  {dirty && (
                    <div style={{ padding: "0.875rem 1.25rem", background: "#fffbeb", borderTop: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.8125rem", color: "#92400e" }}>You have unsaved reordering.</span>
                      <button onClick={saveOrder} disabled={saving} style={{ padding: "0.4rem 1.25rem", borderRadius: "6px", border: "none", background: "#15803d", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.8125rem", fontWeight: 700 }}>
                        {saving ? "Saving…" : "Save Order"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
