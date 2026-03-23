"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AdminImageUploader from "@/components/admin/AdminImageUploader";

const PURPLE = "#7c3aed";
const BLUE   = "#1d4ed8";
const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.375rem" };
const sectionStyle: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: "1.5rem" };
const sectionTitle: React.CSSProperties = { fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" };
const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" };

type SelectOption = { id: string; name: string; title?: string };
type TaxOption = { id: string; name: string };
type ExamOption = { id: string; name: string; categoryId: string };

export default function EditLiveClassPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [zoomWorking, setZoomWorking] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [faculties, setFaculties] = useState<SelectOption[]>([]);
  const [courses, setCourses] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<TaxOption[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [subjects, setSubjects] = useState<TaxOption[]>([]);
  const [topics, setTopics] = useState<TaxOption[]>([]);
  const [subtopics, setSubtopics] = useState<TaxOption[]>([]);
  const [videos, setVideos] = useState<{ id: string; title: string }[]>([]);

  const [form, setForm] = useState({
    title: "", description: "", facultyId: "", courseId: "",
    categoryId: "", examId: "", subjectId: "", topicId: "", subtopicId: "",
    sessionDate: "", startTime: "", endTime: "",
    accessType: "FREE", status: "DRAFT",
    platform: "ZOOM", joinUrl: "", sessionCode: "",
    thumbnailUrl: "", notifyLearners: false,
    recordingPolicy: "NO_RECORD", replayVideoId: "", unlockAt: "",
  });

  const [zoom, setZoom] = useState<{
    meetingId: string | null;
    password: string | null;
    startUrl: string | null;
  }>({ meetingId: null, password: null, startUrl: null });

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    Promise.all([
      fetch(`/api/live-classes/${id}`).then(r => r.json()),
      fetch("/api/faculty?all=true").then(r => r.json()),
      fetch("/api/courses?all=true").then(r => r.json()),
      fetch("/api/taxonomy?level=category").then(r => r.json()),
      fetch("/api/exams").then(r => r.json()),
      fetch("/api/videos?pageSize=200&status=PUBLISHED").then(r => r.json()),
    ]).then(([lj, fj, cj, taxj, examj, vj]) => {
      const lc = lj.data;
      if (lc) {
        let sessionDate = "";
        if (lc.sessionDate) sessionDate = new Date(lc.sessionDate).toISOString().split("T")[0];
        let unlockAt = "";
        if (lc.unlockAt) unlockAt = new Date(lc.unlockAt).toISOString().slice(0, 16);
        setForm({
          title: lc.title || "", description: lc.description || "",
          facultyId: lc.facultyId || "", courseId: lc.courseId || "",
          categoryId: lc.categoryId || "", examId: lc.examId || "",
          subjectId: lc.subjectId || "", topicId: lc.topicId || "", subtopicId: lc.subtopicId || "",
          sessionDate, startTime: lc.startTime || "", endTime: lc.endTime || "",
          accessType: lc.accessType || "FREE", status: lc.status || "DRAFT",
          platform: lc.platform || "ZOOM",
          joinUrl: lc.joinUrl || "", sessionCode: lc.sessionCode || "",
          thumbnailUrl: lc.thumbnailUrl || "",
          notifyLearners: Boolean(lc.notifyLearners),
          recordingPolicy: lc.recordingPolicy || "NO_RECORD",
          replayVideoId: lc.replayVideoId || "",
          unlockAt,
        });
        setZoom({ meetingId: lc.zoomMeetingId || null, password: lc.zoomPassword || null, startUrl: lc.zoomStartUrl || null });
        if (lc.categoryId) fetch(`/api/taxonomy?level=subject&parentId=${lc.categoryId}`).then(r => r.json()).then(j => setSubjects(j.data || []));
        if (lc.subjectId) fetch(`/api/taxonomy?level=topic&parentId=${lc.subjectId}`).then(r => r.json()).then(j => setTopics(j.data || []));
        if (lc.topicId) fetch(`/api/taxonomy?level=subtopic&parentId=${lc.topicId}`).then(r => r.json()).then(j => setSubtopics(j.data || []));
      }
      setFaculties(fj.data || []);
      setCourses(cj.data || []);
      setCategories(taxj.data || []);
      setExams(examj.exams || []);
      setVideos(vj.data || []);
      setLoading(false);
    });
  }, [id]);

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
    setSaving(true);
    const payload = {
      ...form,
      facultyId: form.facultyId || null,
      courseId: form.courseId || null,
      categoryId: form.categoryId || null,
      examId: form.examId || null,
      replayVideoId: form.replayVideoId || null,
      unlockAt: form.unlockAt ? form.unlockAt + ":00+05:30" : null,
    };
    const res = await fetch(`/api/live-classes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    setSaving(false);
    if (res.ok) showToast("Session updated!");
    else showToast(json.error || "Failed to update", false);
  }

  async function handleDelete() {
    setDeleting(true);
    if (zoom.meetingId) {
      await fetch("/api/live-classes/zoom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ liveClassId: id, action: "delete" }) }).catch(() => {});
    }
    const res = await fetch(`/api/live-classes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) router.push("/admin/live-classes");
    else { showToast(json.error || "Failed to delete", false); setDeleting(false); setConfirmDelete(false); }
  }

  async function quickStatus(status: string) {
    const res = await fetch(`/api/live-classes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { setForm(f => ({ ...f, status })); showToast(`Status → ${status}`); }
    else showToast("Failed", false);
  }

  async function handleZoomAction(action: "create" | "delete" | "update") {
    setZoomWorking(true);
    const res = await fetch("/api/live-classes/zoom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liveClassId: id, action }),
    });
    const json = await res.json();
    setZoomWorking(false);
    if (!res.ok) {
      showToast(json.error || "Zoom error", false);
      return;
    }
    if (action === "create") {
      const d = json.data;
      setZoom({ meetingId: d.zoomMeetingId, password: d.password, startUrl: d.startUrl });
      setForm(f => ({ ...f, joinUrl: d.joinUrl, sessionCode: d.password }));
      showToast("Zoom meeting created!");
    } else if (action === "delete") {
      setZoom({ meetingId: null, password: null, startUrl: null });
      setForm(f => ({ ...f, joinUrl: "", sessionCode: "" }));
      showToast("Zoom meeting removed");
    } else if (action === "update") {
      showToast("Zoom meeting updated");
    }
  }

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>;

  const hasZoomMeeting = Boolean(zoom.meetingId);
  const isZoomPlatform = form.platform === "ZOOM";

  return (
    <div style={{ maxWidth: 860 }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Delete Session?</h3>
            <p style={{ margin: "0 0 0.5rem", color: "#64748b", fontSize: "0.875rem" }}>This cannot be undone.</p>
            {hasZoomMeeting && <p style={{ margin: "0 0 1.25rem", color: "#b45309", fontSize: "0.8125rem", background: "#fef3c7", borderRadius: "6px", padding: "0.5rem 0.75rem" }}>The linked Zoom meeting will also be deleted.</p>}
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
          <Link href="/admin/live-classes" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Live Classes</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Edit Session</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {form.status === "DRAFT" && <button onClick={() => quickStatus("SCHEDULED")} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #93c5fd", color: BLUE, background: "#eff6ff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Schedule</button>}
          {form.status === "SCHEDULED" && <button onClick={() => quickStatus("PUBLISHED")} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #86efac", color: "#15803d", background: "#f0fdf4", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Publish</button>}
          {form.status === "PUBLISHED" && <button onClick={() => quickStatus("COMPLETED")} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #a5b4fc", color: "#4338ca", background: "#eef2ff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Mark Complete</button>}
          <button onClick={() => setConfirmDelete(true)} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Delete</button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={sectionStyle}>
          <div style={sectionTitle}>Session Details</div>
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
                <label style={labelStyle}>Start Time (IST)</label>
                <input type="time" value={form.startTime} onChange={e => set("startTime", e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Time (IST)</label>
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
                {["DRAFT","SCHEDULED","PUBLISHED","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
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

          {isZoomPlatform && (
            <div style={{ background: hasZoomMeeting ? "#f0fdf4" : "#eff6ff", border: `1px solid ${hasZoomMeeting ? "#86efac" : "#93c5fd"}`, borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasZoomMeeting ? "0.75rem" : 0 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: hasZoomMeeting ? "#15803d" : BLUE }}>
                    {hasZoomMeeting ? "✅ Zoom Meeting Active" : "📹 No Zoom Meeting Yet"}
                  </div>
                  {hasZoomMeeting && (
                    <div style={{ fontSize: "0.75rem", color: "#374151", marginTop: "0.25rem" }}>
                      Meeting ID: <strong>{zoom.meetingId}</strong> · Password: <strong>{zoom.password}</strong>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {!hasZoomMeeting && (
                    <button type="button" onClick={() => handleZoomAction("create")} disabled={zoomWorking || !form.sessionDate || !form.startTime}
                      style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "none", background: BLUE, color: "#fff", cursor: (zoomWorking || !form.sessionDate || !form.startTime) ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.8125rem", opacity: (!form.sessionDate || !form.startTime) ? 0.6 : 1 }}>
                      {zoomWorking ? "Creating…" : "Create Zoom Meeting"}
                    </button>
                  )}
                  {hasZoomMeeting && <>
                    <button type="button" onClick={() => handleZoomAction("update")} disabled={zoomWorking}
                      title="Saves the current title and schedule to Zoom. Save your form changes first before syncing."
                      style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #86efac", color: "#15803d", background: "#fff", cursor: zoomWorking ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.8125rem" }}>
                      {zoomWorking ? "Syncing…" : "Sync to Zoom"}
                    </button>
                    <button type="button" onClick={() => handleZoomAction("delete")} disabled={zoomWorking}
                      style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", cursor: zoomWorking ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.8125rem" }}>
                      Remove
                    </button>
                  </>}
                </div>
              </div>

              {hasZoomMeeting && zoom.startUrl && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <a href={zoom.startUrl} target="_blank" rel="noopener noreferrer" style={{ color: BLUE, textDecoration: "none", fontWeight: 600 }}>🎙 Host Start URL ↗</a>
                  <span style={{ color: "#94a3b8" }}>· Save changes before clicking Sync to Zoom</span>
                </div>
              )}

              {!form.sessionDate && <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>Set a session date and start time first to create a Zoom meeting.</p>}
            </div>
          )}

          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Join URL {isZoomPlatform && hasZoomMeeting && <span style={{ fontWeight: 400, color: "#15803d", fontSize: "0.75rem" }}>(auto-filled)</span>}</label>
              <input value={form.joinUrl} onChange={e => set("joinUrl", e.target.value)} placeholder={isZoomPlatform ? "Auto-filled by Zoom" : "https://…"} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Meeting Code / Password {isZoomPlatform && hasZoomMeeting && <span style={{ fontWeight: 400, color: "#15803d", fontSize: "0.75rem" }}>(auto-filled)</span>}</label>
              <input value={form.sessionCode} onChange={e => set("sessionCode", e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <AdminImageUploader
              label="Thumbnail"
              value={form.thumbnailUrl || null}
              onChange={(url) => set("thumbnailUrl", url || "")}
              disabled={saving}
              base64
            />
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitle}>Settings & Replay</div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Recording Policy</label>
            <select value={form.recordingPolicy} onChange={e => set("recordingPolicy", e.target.value)} style={inputStyle}>
              <option value="NO_RECORD">Do not record</option>
              <option value="RECORD">Record (internal only)</option>
              <option value="RECORD_AND_SHARE">Record and share with learners</option>
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Replay Recording <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.75rem" }}>(link a published video as the replay)</span></label>
            <select value={form.replayVideoId} onChange={e => set("replayVideoId", e.target.value)} style={inputStyle}>
              <option value="">— No Replay Video —</option>
              {videos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Unlock At <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label>
            <input type="datetime-local" value={form.unlockAt} onChange={e => set("unlockAt", e.target.value)} style={inputStyle} />
            {form.unlockAt && <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: PURPLE }}>Students can access from {new Date(form.unlockAt + ":00+05:30").toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST onwards.</p>}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}>
            <input type="checkbox" checked={form.notifyLearners} onChange={e => set("notifyLearners", e.target.checked)} style={{ width: 16, height: 16, accentColor: PURPLE }} />
            <span style={{ fontSize: "0.875rem", color: "#374151" }}>Notify eligible learners when published</span>
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <Link href="/admin/live-classes" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", textDecoration: "none", color: "#475569", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
