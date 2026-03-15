"use client";

import { useState, useEffect, useCallback } from "react";

interface TestSeries {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  subjectIds: string[];
  pricePaise: number;
  discountPaise: number;
  currency: string;
  thumbnailUrl: string | null;
  scheduleJson: any;
  isPublished: boolean;
  createdAt: string;
  _count?: { tests: number };
}

interface Category {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  categoryId: string;
}

interface Exam {
  id: string;
  name: string;
  categoryId: string;
}

export default function TestSeriesPage() {
  const [items, setItems] = useState<TestSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pubFilter, setPubFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TestSeries | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", categoryId: "", examId: "", subjectIds: [] as string[],
    priceRupees: "0", discountRupees: "0", currency: "INR",
    thumbnailUrl: "", scheduleJson: "", isPublished: false,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (pubFilter) params.set("published", pubFilter);
      const res = await fetch(`/api/test-series?${params}`);
      const d = await res.json();
      setItems(d.data || []);
      setTotalPages(d.pagination?.totalPages || 1);
    } catch { showToast("Failed to load", "error"); }
    finally { setLoading(false); }
  }, [page, search, pubFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    fetch("/api/taxonomy?tree=true").then((r) => r.json()).then((d) => {
      const cats: Category[] = [];
      const subs: Subject[] = [];
      if (d.data) {
        for (const c of d.data) {
          cats.push({ id: c.id, name: c.name });
          if (c.subjects) {
            for (const s of c.subjects) {
              subs.push({ id: s.id, name: s.name, categoryId: c.id });
            }
          }
        }
      }
      setCategories(cats);
      setSubjects(subs);
    }).catch(() => {});
    fetch("/api/exams").then(r => r.json()).then(d => setExams(d.exams || [])).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ title: "", description: "", categoryId: "", examId: "", subjectIds: [], priceRupees: "0", discountRupees: "0", currency: "INR", thumbnailUrl: "", scheduleJson: "", isPublished: false });
    setShowForm(true);
  }

  function openEdit(item: TestSeries & { examId?: string | null }) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description || "",
      categoryId: item.categoryId || "",
      examId: item.examId || "",
      subjectIds: item.subjectIds || [],
      priceRupees:    String(item.pricePaise    / 100),
      discountRupees: String(item.discountPaise / 100),
      currency: item.currency,
      thumbnailUrl: item.thumbnailUrl || "",
      scheduleJson: item.scheduleJson ? JSON.stringify(item.scheduleJson) : "",
      isPublished: item.isPublished,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    setSaving(true);
    try {
      let scheduleJson = null;
      if (form.scheduleJson.trim()) {
        try { scheduleJson = JSON.parse(form.scheduleJson); }
        catch { showToast("Invalid schedule JSON", "error"); setSaving(false); return; }
      }

      const payload: any = {
        title: form.title, description: form.description, categoryId: form.categoryId || null,
        examId: form.examId || null,
        subjectIds: form.subjectIds,
        pricePaise:    Math.round(parseFloat(form.priceRupees    || "0") * 100),
        discountPaise: Math.round(parseFloat(form.discountRupees || "0") * 100),
        currency: form.currency,
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        scheduleJson, isPublished: form.isPublished,
      };

      const method = editing ? "PUT" : "POST";
      if (editing) payload.id = editing.id;

      const res = await fetch("/api/test-series", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      showToast(editing ? "Updated" : "Created", "success");
      setShowForm(false);
      fetchItems();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  }

  async function handleDelete(item: TestSeries) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      const res = await fetch(`/api/test-series?id=${item.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || "Failed", "error"); return; }
      showToast("Deleted", "success");
      fetchItems();
    } catch { showToast("Failed to delete", "error"); }
  }

  async function togglePublish(item: TestSeries) {
    try {
      const res = await fetch("/api/test-series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isPublished: !item.isPublished }),
      });
      if (!res.ok) { const d = await res.json(); showToast(d.error || "Failed", "error"); return; }
      showToast(item.isPublished ? "Unpublished" : "Published", "success");
      fetchItems();
    } catch { showToast("Failed", "error"); }
  }

  const filteredSubs = subjects.filter((s) => s.categoryId === form.categoryId);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", margin: 0 }}>Test Series</h1>
        <button onClick={openCreate} style={{ ...btnPrimary }}>+ New Series</button>
      </div>

      {toast && (
        <div style={{ padding: "0.5rem 1rem", marginBottom: "1rem", borderRadius: "4px", backgroundColor: toast.type === "success" ? "#ecfdf5" : "#fef2f2", color: toast.type === "success" ? "#059669" : "#dc2626", border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`, fontSize: "0.875rem" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input placeholder="Search by title..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={inputStyle} />
        <select value={pubFilter} onChange={(e) => { setPubFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: "140px" }}>
          <option value="">All</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
      </div>

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
              <th style={thStyle}>Thumb</th>
              <th style={thStyle}>Title</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Tests</th>
              <th style={thStyle}>Price</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>No test series found.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ ...tdStyle, width: 44 }}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                  ) : (
                    <div style={{ width: 38, height: 38, borderRadius: 6, background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", color: "#a5b4fc" }}>📋</div>
                  )}
                </td>
                <td style={tdStyle}><strong>{item.title}</strong></td>
                <td style={tdStyle}>
                  {item.categoryId ? (
                    <span style={{ fontSize: "0.75rem", background: "#f0f4ff", color: "#3730a3", padding: "1px 7px", borderRadius: "9999px", fontWeight: 500 }}>
                      {categories.find(c => c.id === item.categoryId)?.name || item.categoryId.substring(0, 8)}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#dc2626" }}>⚠ None</span>
                  )}
                </td>
                <td style={tdStyle}>{item._count?.tests ?? 0}</td>
                <td style={tdStyle}>{item.pricePaise > 0 ? `₹${(item.pricePaise / 100).toFixed(2)}` : "Free"}</td>
                <td style={tdStyle}>
                  <span style={{ ...badge, backgroundColor: item.isPublished ? "#d1fae5" : "#fee2e2", color: item.isPublished ? "#065f46" : "#991b1b" }}>
                    {item.isPublished ? "Published" : "Draft"}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button onClick={() => openEdit(item)} style={{ ...btnSmall, backgroundColor: "#7c3aed" }}>Edit</button>
                    <button onClick={() => togglePublish(item)} style={{ ...btnSmall, backgroundColor: item.isPublished ? "#f59e0b" : "#059669" }}>
                      {item.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button onClick={() => handleDelete(item)} style={{ ...btnSmall, backgroundColor: "#dc2626" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...btnSmall, backgroundColor: page <= 1 ? "#e2e8f0" : "#7c3aed", color: page <= 1 ? "#94a3b8" : "#fff" }}>Prev</button>
            <span style={{ fontSize: "0.8125rem", color: "#666", lineHeight: "1.8" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...btnSmall, backgroundColor: page >= totalPages ? "#e2e8f0" : "#7c3aed", color: page >= totalPages ? "#94a3b8" : "#fff" }}>Next</button>
          </div>
        )}
      </div>

      {showForm && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: "560px", maxHeight: "85vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>
              {editing ? "Edit Series" : "New Series"}
            </h3>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, examId: "", subjectIds: [] })} style={inputStyle}>
                    <option value="">-- Select Category (optional) --</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Exam <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.75rem" }}>(filtered by category)</span></label>
                  <select value={form.examId} onChange={(e) => setForm({ ...form, examId: e.target.value })} style={inputStyle}>
                    <option value="">-- No exam (optional) --</option>
                    {exams.filter(e => !form.categoryId || e.categoryId === form.categoryId).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Subjects</label>
                  <select multiple value={form.subjectIds} onChange={(e) => { const vals = Array.from(e.target.selectedOptions, (o) => o.value); setForm({ ...form, subjectIds: vals }); }} style={{ ...inputStyle, minHeight: "60px" }}>
                    {filteredSubs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>Hold Ctrl/Cmd to select multiple</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={labelStyle}>Price (₹)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={form.priceRupees} onChange={(e) => setForm({ ...form, priceRupees: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Discount (₹)</label>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={form.discountRupees} onChange={(e) => setForm({ ...form, discountRupees: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Thumbnail URL</label>
                <input
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                  placeholder="https://..."
                  style={inputStyle}
                />
                {form.thumbnailUrl && (
                  <div style={{ marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <img src={form.thumbnailUrl} alt="preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button type="button" onClick={() => setForm({ ...form, thumbnailUrl: "" })} style={{ fontSize: "0.75rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Schedule (JSON)</label>
                <textarea value={form.scheduleJson} onChange={(e) => setForm({ ...form, scheduleJson: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "0.75rem" }} placeholder='[{"date": "2026-03-01", "testId": "..."}]' />
              </div>
              <div>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                  Published
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setShowForm(false)} style={{ ...btnPrimary, backgroundColor: "#6b7280" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: "0.375rem 0.75rem", backgroundColor: "#7c3aed", color: "#fff", border: "none", borderRadius: "4px", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" };
const btnSmall: React.CSSProperties = { padding: "0.1875rem 0.5rem", color: "#fff", border: "none", borderRadius: "3px", fontSize: "0.75rem", cursor: "pointer" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.375rem 0.5rem", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", outline: "none", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: "0.125rem", color: "#374151" };
const cardStyle: React.CSSProperties = { border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", backgroundColor: "#fff" };
const thStyle: React.CSSProperties = { textAlign: "left", padding: "0.5rem 0.625rem", fontSize: "0.75rem", fontWeight: 600, color: "#475569", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "0.5rem 0.625rem", verticalAlign: "middle" };
const badge: React.CSSProperties = { display: "inline-block", padding: "0.125rem 0.375rem", borderRadius: "9999px", fontSize: "0.6875rem", fontWeight: 500 };
const modalOverlay: React.CSSProperties = { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalBox: React.CSSProperties = { backgroundColor: "#fff", borderRadius: "8px", padding: "1.5rem", width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" };
