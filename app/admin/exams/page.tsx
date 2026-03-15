"use client";
import { useEffect, useState, useCallback } from "react";

const PURPLE = "#7c3aed";

type Category = { id: string; name: string };
type Exam = { id: string; name: string; slug: string; categoryId: string; category: { id: string; name: string }; createdAt: string };

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Exam | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Exam | null>(null);

  const [form, setForm] = useState({ name: "", slug: "", categoryId: "" });
  const [slugManual, setSlugManual] = useState(false);

  const show = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eRes, cRes] = await Promise.all([
        fetch("/api/exams"),
        fetch("/api/taxonomy?level=category"),
      ]);
      if (eRes.ok) {
        const { exams: data } = await eRes.json();
        setExams(data);
      }
      if (cRes.ok) {
        const { data } = await cRes.json();
        setCategories(data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", slug: "", categoryId: "" });
    setSlugManual(false);
    setShowModal(true);
  };

  const openEdit = (exam: Exam) => {
    setEditTarget(exam);
    setForm({ name: exam.name, slug: exam.slug, categoryId: exam.categoryId });
    setSlugManual(true);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); };

  const handleNameChange = (val: string) => {
    setForm(f => ({ ...f, name: val, slug: slugManual ? f.slug : slugify(val) }));
  };

  const handleSlugChange = (val: string) => {
    setSlugManual(true);
    setForm(f => ({ ...f, slug: slugify(val) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { show("Name is required", "err"); return; }
    if (!form.categoryId) { show("Category is required", "err"); return; }
    setSaving(true);
    try {
      const url = editTarget ? `/api/exams/${editTarget.id}` : "/api/exams";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { show(data.error || "Save failed", "err"); return; }
      show(editTarget ? "Exam updated" : "Exam created");
      closeModal();
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exam: Exam) => {
    const res = await fetch(`/api/exams/${exam.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { show(data.error || "Delete failed", "err"); return; }
    show("Exam deleted");
    setDeleteConfirm(null);
    load();
  };

  const filtered = filterCat ? exams.filter(e => e.categoryId === filterCat) : exams;

  const labelStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px", display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "14px", boxSizing: "border-box" };
  const btnPurple: React.CSSProperties = { background: PURPLE, color: "#fff", border: "none", borderRadius: "6px", padding: "8px 16px", fontWeight: 600, fontSize: "14px", cursor: "pointer" };
  const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 14px", fontSize: "14px", cursor: "pointer", color: "#374151" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: "960px" }}>
      {toast && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: toast.type === "ok" ? "#22c55e" : "#ef4444", color: "#fff", padding: "12px 20px", borderRadius: "8px", fontWeight: 600, fontSize: "14px", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>Exams</h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>Manage exam targets for content tagging and learner discovery.</p>
        </div>
        <button style={btnPurple} onClick={openCreate}>+ Add Exam</button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <select style={{ ...inputStyle, width: "260px" }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: "14px" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#f8fafc", border: "1px dashed #e2e8f0", borderRadius: "10px", padding: "48px", textAlign: "center", color: "#94a3b8" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎯</div>
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>No exams yet</div>
          <div style={{ fontSize: "13px" }}>Create your first exam to start tagging content.</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Exam Name", "Slug", "Category", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: "12px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam, i) => (
                <tr key={exam.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>{exam.name}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "12px", padding: "2px 8px", borderRadius: "4px", fontFamily: "monospace" }}>{exam.slug}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ background: "#ede9fe", color: PURPLE, fontSize: "12px", padding: "2px 10px", borderRadius: "20px", fontWeight: 600 }}>{exam.category.name}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={{ ...btnGhost, fontSize: "12px", padding: "5px 12px" }} onClick={() => openEdit(exam)}>Edit</button>
                      <button style={{ ...btnGhost, fontSize: "12px", padding: "5px 12px", color: "#ef4444", borderColor: "#fecaca" }} onClick={() => setDeleteConfirm(exam)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "440px", maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>{editTarget ? "Edit Exam" : "Create Exam"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelStyle}>Category *</label>
                <select style={inputStyle} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Select category…</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Exam Name *</label>
                <input style={inputStyle} placeholder="e.g. UPSC CSE" value={form.name} onChange={e => handleNameChange(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Slug <span style={{ fontWeight: 400, color: "#94a3b8" }}>(auto-generated, editable)</span></label>
                <input style={{ ...inputStyle, fontFamily: "monospace", background: "#f8fafc" }} placeholder="upsc-cse" value={form.slug} onChange={e => handleSlugChange(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button style={btnGhost} onClick={closeModal}>Cancel</button>
              <button style={{ ...btnPurple, opacity: saving ? 0.7 : 1 }} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editTarget ? "Save Changes" : "Create Exam"}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "400px", maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>Delete Exam?</h2>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#64748b" }}>
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will fail if any content is still tagged with this exam.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button style={btnGhost} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ ...btnPurple, background: "#ef4444" }} onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
