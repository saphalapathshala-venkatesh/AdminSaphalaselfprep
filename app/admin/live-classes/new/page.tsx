"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PURPLE = "#7c3aed";
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" };
const sectionStyle: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: "1.5rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" };
const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" };

type SelectOption = { id: string; name: string; title?: string };

export default function NewLiveClassPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [faculties, setFaculties] = useState<SelectOption[]>([]);
  const [courses, setCourses] = useState<SelectOption[]>([]);

  const [form, setForm] = useState({
    title: "", description: "", facultyId: "", courseId: "",
    sessionDate: "", startTime: "", endTime: "",
    accessType: "FREE", status: "DRAFT",
    platform: "ZOOM", joinUrl: "", sessionCode: "",
    thumbnailUrl: "", notifyLearners: false,
    recordingPolicy: "NO_RECORD",
  });

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    fetch("/api/faculty?all=true").then(r => r.json()).then(j => setFaculties(j.data || []));
    fetch("/api/courses?all=true").then(r => r.json()).then(j => setCourses(j.data || []));
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { showToast("Title is required", false); return; }

    setSaving(true);
    const payload = {
      ...form,
      facultyId: form.facultyId || null,
      courseId: form.courseId || null,
    };

    const res = await fetch("/api/live-classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    setSaving(false);

    if (res.ok) {
      showToast("Session created!");
      router.push(`/admin/live-classes/${json.data.id}`);
    } else {
      showToast(json.error || "Failed to create", false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
        <Link href="/admin/live-classes" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Live Classes</Link>
        <span style={{ color: "#e2e8f0" }}>/</span>
        <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>New Session</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={sectionTitle}>Session Details</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Title *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Live Doubt Clearing – Trigonometry" style={inputStyle} required />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="What will be covered in this session…" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Faculty</label>
              <select value={form.facultyId} onChange={e => set("facultyId", e.target.value)} style={inputStyle}>
                <option value="">— Select Faculty —</option>
                {faculties.map(f => <option key={f.id} value={f.id}>{f.name}{f.title ? ` (${f.title})` : ""}</option>)}
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
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Schedule</div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Session Date</label>
              <input type="date" value={form.sessionDate} onChange={e => set("sessionDate", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={labelStyle}>Start Time</label>
                <input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <input type="time" value={form.endTime} onChange={e => set("endTime", e.target.value)} style={inputStyle} />
              </div>
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
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Platform & Join Details</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Platform</label>
            <select value={form.platform} onChange={e => set("platform", e.target.value)} style={inputStyle}>
              <option value="ZOOM">Zoom</option>
              <option value="YOUTUBE_LIVE">YouTube Live</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Join URL</label>
              <input value={form.joinUrl} onChange={e => set("joinUrl", e.target.value)} placeholder="https://zoom.us/j/…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Session / Meeting Code</label>
              <input value={form.sessionCode} onChange={e => set("sessionCode", e.target.value)} placeholder="e.g. 123 456 789" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Thumbnail URL</label>
            <input value={form.thumbnailUrl} onChange={e => set("thumbnailUrl", e.target.value)} placeholder="https://…" style={inputStyle} />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Settings</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Recording Policy</label>
            <select value={form.recordingPolicy} onChange={e => set("recordingPolicy", e.target.value)} style={inputStyle}>
              <option value="NO_RECORD">Do not record</option>
              <option value="RECORD">Record (internal only)</option>
              <option value="RECORD_AND_SHARE">Record and share with learners</option>
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.notifyLearners} onChange={e => set("notifyLearners", e.target.checked)} style={{ width: 16, height: 16, accentColor: PURPLE }} />
            <span style={{ fontSize: "0.875rem", color: "#374151" }}>Notify eligible learners when published</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Link href="/admin/live-classes" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", textDecoration: "none", color: "#475569", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Creating…" : "Create Session"}
          </button>
        </div>
      </form>
    </div>
  );
}
