"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" };
const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

type Faculty = { id: string; name: string; title: string | null; bio: string | null; avatarUrl: string | null; isActive: boolean; _count: { videos: number; liveClasses: number }; createdAt: string };

const emptyForm = { name: "", title: "", bio: "", avatarUrl: "", isActive: true };

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Faculty | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ pageSize: "50", ...(search ? { search } : {}) });
    const res = await fetch(`/api/faculty?${p}`);
    const json = await res.json();
    setFaculty(json.data || []);
    setTotal(json.pagination?.total || 0);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditTarget(null); setForm(emptyForm); setShowModal(true); }
  function openEdit(f: Faculty) { setEditTarget(f); setForm({ name: f.name, title: f.title || "", bio: f.bio || "", avatarUrl: f.avatarUrl || "", isActive: f.isActive }); setShowModal(true); }

  async function handleSave() {
    if (!form.name.trim()) { showToast("Name is required", false); return; }
    setSaving(true);
    const payload = { ...form, title: form.title || null, bio: form.bio || null, avatarUrl: form.avatarUrl || null };
    const res = editTarget
      ? await fetch(`/api/faculty/${editTarget.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/faculty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    setSaving(false);
    if (res.ok) { showToast(editTarget ? "Faculty updated!" : "Faculty created!"); setShowModal(false); load(); }
    else showToast(json.error || "Failed", false);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/faculty/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) { showToast("Faculty deleted"); setConfirmId(null); load(); }
    else showToast(json.error || "Failed to delete", false);
    setDeleting(false);
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem" }}>{toast.msg}</div>}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.1rem" }}>{editTarget ? "Edit Faculty" : "New Faculty"}</h3>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Full Name *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Dr. Priya Sharma" style={inputStyle} autoFocus />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Title / Designation</label>
              <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Senior Educator, Maths" style={inputStyle} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>Bio</label>
              <textarea value={form.bio} onChange={e => set("bio", e.target.value)} rows={3} placeholder="Short bio…" style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>Avatar URL</label>
              <input value={form.avatarUrl} onChange={e => set("avatarUrl", e.target.value)} placeholder="https://…" style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", marginBottom: "1.5rem" }}>
              <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)} style={{ width: 16, height: 16, accentColor: PURPLE }} />
              <span style={{ fontSize: "0.875rem", color: "#374151" }}>Active</span>
            </label>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {saving ? "Saving…" : editTarget ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Delete Faculty?</h3>
            <p style={{ margin: "0 0 1.5rem", color: "#64748b", fontSize: "0.875rem" }}>This will fail if the faculty has assigned videos or sessions.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmId(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(confirmId)} disabled={deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/live-classes" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Live Classes</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Faculty</h1>
          <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>({total})</span>
        </div>
        <button onClick={openCreate} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", border: "none", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>
          + Add Faculty
        </button>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search faculty…" style={{ padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", width: 280 }} />
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : faculty.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>No faculty found. <button onClick={openCreate} style={{ color: PURPLE, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Add one</button></div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Faculty","Title","Videos","Sessions","Status","Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {faculty.map(f => (
                <tr key={f.id} onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ ...tdStyle }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt={f.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${PURPLE}22`, display: "flex", alignItems: "center", justifyContent: "center", color: PURPLE, fontWeight: 700, fontSize: "0.875rem", flexShrink: 0 }}>
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 600 }}>{f.name}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{f.title || "—"}</td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{f._count.videos}</td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{f._count.liveClasses}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: f.isActive ? "#dcfce7" : "#f1f5f9", color: f.isActive ? "#15803d" : "#64748b" }}>
                      {f.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => openEdit(f)} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Edit</button>
                      <button onClick={() => setConfirmId(f.id)} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
