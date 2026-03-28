"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminImageUploader from "@/components/admin/AdminImageUploader";

const PURPLE = "#7c3aed";
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" };
const sectionStyle: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: "1.5rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" };
const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" };

function parseDuration(val: string): number | null {
  const s = val.trim();
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || !Number.isInteger(n) || n < 0)) return null;
  if (parts.length === 2) {
    const [mm, ss] = nums;
    if (ss >= 60) return null;
    return mm * 60 + ss;
  }
  const [hh, mm, ss] = nums;
  if (mm >= 60 || ss >= 60) return null;
  return hh * 3600 + mm * 60 + ss;
}

type SelectOption = { id: string; name: string };
type TaxOption = { id: string; name: string };
type ExamOption = { id: string; name: string; categoryId: string };

export default function NewVideoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [faculties, setFaculties] = useState<SelectOption[]>([]);
  const [courses, setCourses] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<TaxOption[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [subjects, setSubjects] = useState<TaxOption[]>([]);
  const [topics, setTopics] = useState<TaxOption[]>([]);
  const [subtopics, setSubtopics] = useState<TaxOption[]>([]);

  const [form, setForm] = useState({
    title: "", description: "", facultyId: "", courseId: "",
    categoryId: "", examId: "", subjectId: "", topicId: "", subtopicId: "",
    accessType: "FREE", status: "DRAFT", provider: "MANUAL",
    providerVideoId: "", hlsUrl: "", playbackUrl: "", thumbnailUrl: "",
    durationSeconds: "", lessonOrder: "0", allowPreview: false,
    tags: "", unlockAt: "",
    xpEnabled: false, xpValue: "",
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetch("/api/faculty?all=true").then(r => r.json()).then(j => setFaculties(j.data || []));
    fetch("/api/courses?all=true").then(r => r.json()).then(j => setCourses(j.data || []));
    fetch("/api/taxonomy?level=category").then(r => r.json()).then(j => setCategories(j.data || []));
    fetch("/api/exams").then(r => r.json()).then(j => setExams(j.exams || []));
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleCategoryChange(val: string) {
    setForm(f => ({ ...f, categoryId: val, examId: "", subjectId: "", topicId: "", subtopicId: "" }));
    setSubjects([]); setTopics([]); setSubtopics([]);
    if (val) fetch(`/api/taxonomy?level=subject&parentId=${val}`).then(r => r.json()).then(j => setSubjects(j.data || []));
  }
  async function handleSubjectChange(val: string) {
    setForm(f => ({ ...f, subjectId: val, topicId: "", subtopicId: "" }));
    setTopics([]); setSubtopics([]);
    if (val) fetch(`/api/taxonomy?level=topic&parentId=${val}`).then(r => r.json()).then(j => setTopics(j.data || []));
  }
  async function handleTopicChange(val: string) {
    setForm(f => ({ ...f, topicId: val, subtopicId: "" }));
    setSubtopics([]);
    if (val) fetch(`/api/taxonomy?level=subtopic&parentId=${val}`).then(r => r.json()).then(j => setSubtopics(j.data || []));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { showToast("Title is required", false); return; }

    const parsedDuration = form.durationSeconds.trim() ? parseDuration(form.durationSeconds) : null;
    if (form.durationSeconds.trim() && parsedDuration === null) {
      setDurationError("Use mm:ss or hh:mm:ss format, e.g. 28:17 or 1:05:30");
      return;
    }

    const xpValueInt = parseInt(form.xpValue) || 0;
    if (form.xpEnabled && xpValueInt <= 0) {
      showToast("XP value must be set when XP is enabled", false);
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      durationSeconds: parsedDuration,
      lessonOrder: parseInt(form.lessonOrder) || 0,
      facultyId: form.facultyId || null,
      courseId: form.courseId || null,
      categoryId: form.categoryId || null,
      examId: form.examId || null,
      unlockAt: form.unlockAt ? form.unlockAt + ":00+05:30" : null,
      xpEnabled: form.xpEnabled,
      xpValue: xpValueInt,
    };

    const res = await fetch("/api/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    setSaving(false);

    if (res.ok) {
      showToast("Video created!");
      router.push(`/admin/videos/${json.data.id}`);
    } else {
      showToast(json.error || "Failed to create", false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <Link href="/admin/videos" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Videos</Link>
        <span style={{ color: "#e2e8f0" }}>/</span>
        <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>New Video</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={sectionTitle}>Basic Info</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Introduction to Algebra" style={inputStyle} required />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Short description of the video…" style={{ ...inputStyle, resize: "vertical" }} />
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
              <select value={form.categoryId} onChange={e => handleCategoryChange(e.target.value)} style={inputStyle}>
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
              <label style={labelStyle}>Subject</label>
              <select value={form.subjectId} onChange={e => handleSubjectChange(e.target.value)} style={inputStyle} disabled={!form.categoryId}>
                <option value="">— No Subject —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <select value={form.topicId} onChange={e => handleTopicChange(e.target.value)} style={inputStyle} disabled={!form.subjectId}>
                <option value="">— No Topic —</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Subtopic</label>
            <select value={form.subtopicId} onChange={e => set("subtopicId", e.target.value)} style={inputStyle} disabled={!form.topicId}>
              <option value="">— No Subtopic —</option>
              {subtopics.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
                <option value="DRAFT">Draft</option>
                <option value="READY">Ready</option>
                <option value="PUBLISHED">Published</option>
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
              <input value={form.providerVideoId} onChange={e => set("providerVideoId", e.target.value)} placeholder="e.g. Bunny GUID or YouTube ID" style={inputStyle} />
            </div>
            <div>
              <AdminImageUploader
                label="Thumbnail"
                value={form.thumbnailUrl || null}
                onChange={(url) => set("thumbnailUrl", url || "")}
                disabled={saving}
                base64
              />
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>HLS Manifest URL (.m3u8)</label>
            <input value={form.hlsUrl} onChange={e => set("hlsUrl", e.target.value)} placeholder="https://…/playlist.m3u8" style={inputStyle} />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Playback / Embed URL</label>
            <input value={form.playbackUrl} onChange={e => set("playbackUrl", e.target.value)} placeholder="https://…" style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Duration</label>
              <input
                type="text"
                value={form.durationSeconds}
                onChange={e => { set("durationSeconds", e.target.value); setDurationError(null); }}
                placeholder="e.g. 28:17 or 1:05:30"
                style={{ ...inputStyle, borderColor: durationError ? "#dc2626" : undefined }}
              />
              {durationError && <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#dc2626" }}>{durationError}</div>}
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
            <input value={form.tags} onChange={e => set("tags", e.target.value)} placeholder="algebra, basics, class-10" style={inputStyle} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.allowPreview} onChange={e => set("allowPreview", e.target.checked)} style={{ width: 16, height: 16, accentColor: PURPLE }} />
            <span style={{ fontSize: "0.875rem", color: "#374151" }}>Allow free preview (visible without entitlement)</span>
          </label>

          <div style={{ marginTop: "1.25rem", padding: "1rem", background: "#faf5ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#6d28d9", marginBottom: "0.75rem" }}>XP Rewards</div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={form.xpEnabled} onChange={e => set("xpEnabled", e.target.checked)} style={{ width: 16, height: 16, accentColor: PURPLE }} />
              <span style={{ fontSize: "0.875rem", color: "#374151", fontWeight: 600 }}>Enable XP for this video</span>
            </label>
            {form.xpEnabled && (
              <div>
                <label style={labelStyle}>XP Value <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.xpValue}
                  onChange={e => set("xpValue", e.target.value)}
                  placeholder="e.g. 50"
                  style={{ ...inputStyle, width: 160, borderColor: form.xpEnabled && !parseInt(form.xpValue) ? "#dc2626" : undefined }}
                />
                {form.xpEnabled && !parseInt(form.xpValue) && (
                  <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#dc2626" }}>XP value must be set when XP is enabled</div>
                )}
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#7c3aed" }}>
                  1st watch = {parseInt(form.xpValue) || 0} XP · 2nd watch = {Math.floor((parseInt(form.xpValue) || 0) * 0.5)} XP · 3rd+ = 0 XP
                </p>
              </div>
            )}
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label style={labelStyle}>Unlock At <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label>
            <input type="datetime-local" value={form.unlockAt} onChange={e => set("unlockAt", e.target.value)} style={inputStyle} />
            {form.unlockAt && <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#7c3aed" }}>Students can access from {new Date(form.unlockAt + ":00+05:30").toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST onwards.</p>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Link href="/admin/videos" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", textDecoration: "none", color: "#475569", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Creating…" : "Create Video"}
          </button>
        </div>
      </form>
    </div>
  );
}
