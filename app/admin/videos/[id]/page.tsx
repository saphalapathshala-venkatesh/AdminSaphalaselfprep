"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const PURPLE = "#7c3aed";
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" };
const sectionStyle: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: "1.5rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" };
const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" };

type SelectOption = { id: string; name: string };
type TaxOption = { id: string; name: string };
type ExamOption = { id: string; name: string; categoryId: string };

export default function EditVideoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [faculties, setFaculties] = useState<SelectOption[]>([]);
  const [courses, setCourses] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<TaxOption[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);

  const [form, setForm] = useState({
    title: "", description: "", facultyId: "", courseId: "",
    categoryId: "", examId: "",
    accessType: "FREE", status: "DRAFT", provider: "MANUAL",
    providerVideoId: "", hlsUrl: "", playbackUrl: "", thumbnailUrl: "",
    durationSeconds: "", lessonOrder: "0", allowPreview: false,
    tags: "", unlockAt: "",
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/videos/${id}`).then(r => r.json()),
      fetch("/api/faculty?all=true").then(r => r.json()),
      fetch("/api/courses?all=true").then(r => r.json()),
      fetch("/api/taxonomy?level=category").then(r => r.json()),
      fetch("/api/exams").then(r => r.json()),
    ]).then(([vj, fj, cj, taxj, examj]) => {
      const v = vj.data;
      if (v) {
        setForm({
          title: v.title || "", description: v.description || "",
          facultyId: v.facultyId || "", courseId: v.courseId || "",
          categoryId: v.categoryId || "", examId: v.examId || "",
          accessType: v.accessType || "FREE", status: v.status || "DRAFT",
          provider: v.provider || "MANUAL",
          providerVideoId: v.providerVideoId || "", hlsUrl: v.hlsUrl || "",
          playbackUrl: v.playbackUrl || "", thumbnailUrl: v.thumbnailUrl || "",
          durationSeconds: v.durationSeconds != null ? String(v.durationSeconds) : "",
          lessonOrder: v.lessonOrder != null ? String(v.lessonOrder) : "0",
          allowPreview: Boolean(v.allowPreview),
          tags: Array.isArray(v.tags) ? v.tags.join(", ") : "",
          unlockAt: v.unlockAt ? v.unlockAt.slice(0, 16) : "",
        });
      }
      setFaculties(fj.data || []);
      setCourses(cj.data || []);
      setCategories(taxj.data || []);
      setExams(examj.exams || []);
      setLoading(false);
    });
  }, [id]);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { showToast("Title is required", false); return; }

    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      durationSeconds: form.durationSeconds ? parseInt(form.durationSeconds) : null,
      lessonOrder: parseInt(form.lessonOrder) || 0,
      facultyId: form.facultyId || null,
      courseId: form.courseId || null,
      categoryId: form.categoryId || null,
      examId: form.examId || null,
    };

    const res = await fetch(`/api/videos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    setSaving(false);

    if (res.ok) showToast("Video updated!");
    else showToast(json.error || "Failed to update", false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) router.push("/admin/videos");
    else { showToast(json.error || "Failed to delete", false); setDeleting(false); setConfirmDelete(false); }
  }

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 860 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Delete Video?</h3>
            <p style={{ margin: "0 0 1.5rem", color: "#64748b", fontSize: "0.875rem" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/videos" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Videos</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Edit Video</h1>
        </div>
        <Link href="/admin/content-flow" style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #c4b5fd", color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>Content Flow ↗</Link>
        <button onClick={() => setConfirmDelete(true)} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Delete</button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={sectionTitle}>Basic Info</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} style={inputStyle} required />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Faculty</label>
              <select value={form.facultyId} onChange={e => set("facultyId", e.target.value)} style={inputStyle}>
                <option value="">— Select Faculty —</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Course</label>
              <select value={form.courseId} onChange={e => set("courseId", e.target.value)} style={inputStyle}>
                <option value="">— Select Course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value, examId: "" }))} style={inputStyle}>
                <option value="">— No Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Exam <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.75rem" }}>(filtered by category)</span></label>
              <select value={form.examId} onChange={e => set("examId", e.target.value)} style={inputStyle}>
                <option value="">— No Exam —</option>
                {exams.filter(ex => !form.categoryId || ex.categoryId === form.categoryId).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
              </select>
            </div>
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Access Type</label>
              <select value={form.accessType} onChange={e => set("accessType", e.target.value)} style={inputStyle}>
                <option value="FREE">Free</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle}>
                {["DRAFT","UPLOADING","PROCESSING","READY","PUBLISHED","ARCHIVED","FAILED"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Video Source</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Provider</label>
            <select value={form.provider} onChange={e => set("provider", e.target.value)} style={inputStyle}>
              <option value="MANUAL">Manual / Upload</option>
              <option value="BUNNY">Bunny Stream</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Provider Video ID</label>
              <input value={form.providerVideoId} onChange={e => set("providerVideoId", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Thumbnail URL</label>
              <input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>HLS Manifest URL (.m3u8)</label>
            <input value={form.hlsUrl} onChange={e => set("hlsUrl", e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Playback / Embed URL</label>
            <input value={form.playbackUrl} onChange={e => set("playbackUrl", e.target.value)} style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Duration (seconds)</label>
              <input type="number" min="0" value={form.durationSeconds} onChange={e => set("durationSeconds", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Lesson Order</label>
              <input type="number" min="0" value={form.lessonOrder} onChange={e => set("lessonOrder", e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Settings</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => set("tags", e.target.value)} style={inputStyle} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.allowPreview} onChange={e => set("allowPreview", e.target.checked)} style={{ width: 16, height: 16, accentColor: PURPLE }} />
            <span style={{ fontSize: "0.875rem", color: "#374151" }}>Allow free preview</span>
          </label>
          <div style={{ marginTop: "1rem" }}>
            <label style={labelStyle}>Unlock At <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label>
            <input type="datetime-local" value={form.unlockAt} onChange={e => set("unlockAt", e.target.value)} style={inputStyle} />
            {form.unlockAt && <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#7c3aed" }}>Students can access from {new Date(form.unlockAt).toLocaleString()} onwards.</p>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Link href="/admin/videos" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", textDecoration: "none", color: "#475569", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
