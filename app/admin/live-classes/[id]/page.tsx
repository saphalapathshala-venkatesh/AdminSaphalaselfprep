"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AdminImageUploader from "@/components/admin/AdminImageUploader";

const PURPLE = "#7c3aed";
const BLUE   = "#1d4ed8";

function toISTDatetimeLocal(utcStr: string): string {
  const d = new Date(utcStr);
  const istMs = d.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 16);
}
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

  // Multi-course selection
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");

  // Add Faculty inline modal
  const [showAddFaculty, setShowAddFaculty] = useState(false);
  const [addFacultyForm, setAddFacultyForm] = useState({ name: "", title: "" });
  const [addFacultyLoading, setAddFacultyLoading] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", facultyId: "",
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

  // Zoom Polls
  type PollQuestion = { name: string; type: "single" | "multiple"; answers: string[] };
  type ZoomPoll = { id: string; title: string; questions: PollQuestion[] };
  const [polls, setPolls] = useState<ZoomPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [editingPollId, setEditingPollId] = useState<string | null>(null);
  const [pollForm, setPollForm] = useState<{ title: string; questions: PollQuestion[] }>({
    title: "",
    questions: [{ name: "", type: "single", answers: ["", ""] }],
  });
  const [pollSaving, setPollSaving] = useState(false);

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
        if (lc.unlockAt) unlockAt = toISTDatetimeLocal(lc.unlockAt);
        setForm({
          title: lc.title || "", description: lc.description || "",
          facultyId: lc.facultyId || "",
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
        // Populate selected courses from junction table
        const junctionIds: string[] = (lc.courses || []).map((c: any) => c.courseId);
        // Also include legacy courseId if not already in junction
        if (lc.courseId && !junctionIds.includes(lc.courseId)) junctionIds.push(lc.courseId);
        setSelectedCourseIds(junctionIds);

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

  function toggleCourse(courseId: string) {
    setSelectedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(i => i !== courseId) : [...prev, courseId]
    );
  }

  async function handleAddFaculty() {
    if (!addFacultyForm.name.trim()) return;
    setAddFacultyLoading(true);
    try {
      const res = await fetch("/api/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addFacultyForm.name.trim(), title: addFacultyForm.title.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed to create faculty", false); return; }
      const newFaculty = json.data;
      setFaculties(prev => [...prev, { id: newFaculty.id, name: newFaculty.name, title: newFaculty.title }].sort((a, b) => a.name.localeCompare(b.name)));
      set("facultyId", newFaculty.id);
      setShowAddFaculty(false);
      setAddFacultyForm({ name: "", title: "" });
      showToast(`Faculty "${newFaculty.name}" added`);
    } catch {
      showToast("Failed to create faculty", false);
    } finally {
      setAddFacultyLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { showToast("Title is required", false); return; }
    setSaving(true);
    const payload = {
      ...form,
      facultyId: form.facultyId || null,
      courseIds: selectedCourseIds,
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
    if (!res.ok) { showToast(json.error || "Zoom error", false); return; }
    if (action === "create") {
      const d = json.data;
      setZoom({ meetingId: d.zoomMeetingId, password: d.password, startUrl: d.startUrl });
      setForm(f => ({ ...f, joinUrl: d.joinUrl, sessionCode: d.password }));
      showToast("Zoom meeting created!");
    } else if (action === "delete") {
      setZoom({ meetingId: null, password: null, startUrl: null });
      setPolls([]);
      setForm(f => ({ ...f, joinUrl: "", sessionCode: "" }));
      showToast("Zoom meeting removed");
    } else if (action === "update") {
      showToast("Zoom meeting updated");
    }
  }

  // ─── Zoom Poll handlers ──────────────────────────────────────────────────────

  async function loadPolls(meetingId: string) {
    setPollsLoading(true);
    try {
      const res = await fetch(`/api/live-classes/${id}/polls`);
      const json = await res.json();
      setPolls(json.polls || []);
    } catch { /* ignore */ }
    finally { setPollsLoading(false); }
  }

  // Load polls whenever zoom.meetingId is set (on page load or after meeting creation)
  useEffect(() => {
    if (zoom.meetingId) loadPolls(zoom.meetingId);
    else setPolls([]);
  }, [zoom.meetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetPollForm() {
    setPollForm({ title: "", questions: [{ name: "", type: "single", answers: ["", ""] }] });
    setShowPollForm(false);
    setEditingPollId(null);
  }

  async function handleSavePoll() {
    const trimmedTitle = pollForm.title.trim();
    if (!trimmedTitle) { showToast("Poll title is required", false); return; }
    for (const q of pollForm.questions) {
      if (!q.name.trim()) { showToast("Question text is required", false); return; }
      if (q.answers.filter(a => a.trim()).length < 2) { showToast("Each question needs at least 2 non-empty answers", false); return; }
    }
    setPollSaving(true);
    try {
      const method = editingPollId ? "PUT" : "POST";
      const url = editingPollId
        ? `/api/live-classes/${id}/polls/${editingPollId}`
        : `/api/live-classes/${id}/polls`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          questions: pollForm.questions.map(q => ({
            name: q.name.trim(),
            type: q.type,
            answers: q.answers.filter(a => a.trim()),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed to save poll", false); return; }
      showToast(editingPollId ? "Poll updated!" : "Poll created!");
      resetPollForm();
      if (zoom.meetingId) await loadPolls(zoom.meetingId);
    } catch { showToast("Failed to save poll", false); }
    finally { setPollSaving(false); }
  }

  async function handleDeletePoll(pollId: string) {
    if (!confirm("Delete this poll?")) return;
    const res = await fetch(`/api/live-classes/${id}/polls/${pollId}`, { method: "DELETE" });
    if (res.ok) { setPolls(prev => prev.filter(p => p.id !== pollId)); showToast("Poll deleted"); }
    else showToast("Failed to delete poll", false);
  }

  function startEditPoll(poll: { id: string; title: string; questions: { name: string; type: "single" | "multiple"; answers: string[] }[] }) {
    setPollForm({ title: poll.title, questions: poll.questions.map(q => ({ ...q, answers: [...q.answers] })) });
    setEditingPollId(poll.id);
    setShowPollForm(true);
    setTimeout(() => document.getElementById("poll-form-top")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function updateQuestion(qi: number, field: string, value: any) {
    setPollForm(f => { const qs = [...f.questions]; qs[qi] = { ...qs[qi], [field]: value }; return { ...f, questions: qs }; });
  }
  function updateAnswer(qi: number, ai: number, value: string) {
    setPollForm(f => { const qs = [...f.questions]; const ans = [...qs[qi].answers]; ans[ai] = value; qs[qi] = { ...qs[qi], answers: ans }; return { ...f, questions: qs }; });
  }
  function addAnswer(qi: number) {
    setPollForm(f => { const qs = [...f.questions]; if (qs[qi].answers.length >= 10) return f; qs[qi] = { ...qs[qi], answers: [...qs[qi].answers, ""] }; return { ...f, questions: qs }; });
  }
  function removeAnswer(qi: number, ai: number) {
    setPollForm(f => { const qs = [...f.questions]; if (qs[qi].answers.length <= 2) return f; qs[qi] = { ...qs[qi], answers: qs[qi].answers.filter((_, i) => i !== ai) }; return { ...f, questions: qs }; });
  }
  function addQuestion() {
    setPollForm(f => ({ ...f, questions: [...f.questions, { name: "", type: "single" as const, answers: ["", ""] }] }));
  }
  function removeQuestion(qi: number) {
    setPollForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }));
  }

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>;

  const hasZoomMeeting = Boolean(zoom.meetingId);
  const isZoomPlatform = form.platform === "ZOOM";
  const filteredCourses = courses.filter(c =>
    !courseSearch || c.name.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 860 }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      {/* Add Faculty Modal */}
      {showAddFaculty && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "1.75rem", width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Add New Faculty</h3>
            <div style={{ marginBottom: "0.875rem" }}>
              <label style={labelStyle}>Name *</label>
              <input
                autoFocus
                value={addFacultyForm.name}
                onChange={e => setAddFacultyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Dr. Ramesh Kumar"
                style={inputStyle}
                onKeyDown={e => e.key === "Enter" && handleAddFaculty()}
              />
            </div>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>Title / Designation <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label>
              <input
                value={addFacultyForm.title}
                onChange={e => setAddFacultyForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Maths Expert · 15 yrs experience"
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setShowAddFaculty(false); setAddFacultyForm({ name: "", title: "" }); }}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", color: "#475569" }}>
                Cancel
              </button>
              <button type="button" onClick={handleAddFaculty} disabled={addFacultyLoading || !addFacultyForm.name.trim()}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", cursor: (!addFacultyForm.name.trim() || addFacultyLoading) ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.875rem", opacity: !addFacultyForm.name.trim() ? 0.6 : 1 }}>
                {addFacultyLoading ? "Adding…" : "Add Faculty"}
              </button>
            </div>
          </div>
        </div>
      )}

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

          {/* Faculty row with Add Faculty button */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Faculty</label>
              <button type="button" onClick={() => setShowAddFaculty(true)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.25rem 0.625rem", borderRadius: "6px", border: `1px solid ${PURPLE}`, background: "#f5f3ff", color: PURPLE, cursor: "pointer", fontSize: "0.75rem", fontWeight: 700 }}>
                + Add Faculty
              </button>
            </div>
            <select value={form.facultyId} onChange={e => set("facultyId", e.target.value)} style={inputStyle}>
              <option value="">— Select Faculty —</option>
              {faculties.map(f => <option key={f.id} value={f.id}>{f.name}{f.title ? ` (${f.title})` : ""}</option>)}
            </select>
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

        {/* Courses section — multi-checkbox */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>
              Courses
              {selectedCourseIds.length > 0 && (
                <span style={{ marginLeft: 8, background: PURPLE, color: "#fff", borderRadius: "999px", padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700 }}>
                  {selectedCourseIds.length} selected
                </span>
              )}
            </div>
            {selectedCourseIds.length > 0 && (
              <button type="button" onClick={() => setSelectedCourseIds([])}
                style={{ fontSize: "0.75rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                Clear all
              </button>
            )}
          </div>
          <p style={{ margin: "0 0 0.875rem", fontSize: "0.8rem", color: "#64748b" }}>
            Check any number of courses to include this live class. Changes take effect on Save.
          </p>
          <input
            value={courseSearch}
            onChange={e => setCourseSearch(e.target.value)}
            placeholder="Search courses…"
            style={{ ...inputStyle, marginBottom: "0.75rem" }}
          />
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            {filteredCourses.length === 0 && (
              <div style={{ padding: "1rem", color: "#94a3b8", fontSize: "0.8rem", textAlign: "center" }}>
                {courseSearch ? `No courses matching "${courseSearch}"` : "No courses available"}
              </div>
            )}
            {filteredCourses.map((c, i) => (
              <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem 0.875rem", cursor: "pointer", background: selectedCourseIds.includes(c.id) ? "#f5f3ff" : i % 2 === 0 ? "#fafafa" : "#fff", borderBottom: i < filteredCourses.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <input
                  type="checkbox"
                  checked={selectedCourseIds.includes(c.id)}
                  onChange={() => toggleCourse(c.id)}
                  style={{ width: 16, height: 16, accentColor: PURPLE, flexShrink: 0 }}
                />
                <span style={{ fontSize: "0.875rem", color: selectedCourseIds.includes(c.id) ? PURPLE : "#374151", fontWeight: selectedCourseIds.includes(c.id) ? 600 : 400 }}>
                  {c.name}
                </span>
              </label>
            ))}
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

        {/* Zoom Polls — only shown when a Zoom meeting is active */}
        {isZoomPlatform && hasZoomMeeting && (
          <div style={sectionStyle} id="poll-form-top">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", paddingBottom: "0.75rem", borderBottom: "1px solid #f1f5f9" }}>
              <div>
                <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0f172a" }}>
                  Zoom Polls
                  {polls.length > 0 && (
                    <span style={{ marginLeft: 8, background: "#f5f3ff", color: PURPLE, borderRadius: "999px", padding: "0.1rem 0.5rem", fontSize: "0.7rem", fontWeight: 700, border: `1px solid #ede9fe` }}>
                      {polls.length} poll{polls.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                  Prepare polls in advance — the host launches them from the Zoom app during the session.
                </div>
              </div>
              {!showPollForm && (
                <button type="button" onClick={() => { resetPollForm(); setShowPollForm(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.375rem 0.875rem", borderRadius: "8px", border: `1.5px solid ${PURPLE}`, background: "#f5f3ff", color: PURPLE, cursor: "pointer", fontSize: "0.8125rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                  + Add Poll
                </button>
              )}
            </div>

            {/* Existing polls list */}
            {pollsLoading && <div style={{ color: "#94a3b8", fontSize: "0.8rem", padding: "0.5rem 0" }}>Loading polls…</div>}
            {!pollsLoading && polls.length === 0 && !showPollForm && (
              <div style={{ padding: "1.25rem", background: "#fafafa", borderRadius: "8px", border: "1px dashed #e2e8f0", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>📊</div>
                <div style={{ fontSize: "0.825rem", color: "#64748b" }}>No polls yet. Add one to engage your students during the session.</div>
              </div>
            )}
            {!pollsLoading && polls.map((poll, pi) => (
              <div key={poll.id} style={{ background: "#fafafa", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "1rem 1.125rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a", marginBottom: "0.5rem" }}>
                      Poll {pi + 1}: {poll.title}
                    </div>
                    {poll.questions.map((q, qi) => (
                      <div key={qi} style={{ marginBottom: "0.5rem" }}>
                        <div style={{ fontSize: "0.8rem", color: "#374151", fontWeight: 600, marginBottom: "0.25rem" }}>
                          Q{qi + 1}: {q.name}
                          <span style={{ marginLeft: 6, fontSize: "0.7rem", color: "#7c3aed", fontWeight: 500, background: "#f5f3ff", borderRadius: 4, padding: "1px 5px" }}>
                            {q.type === "single" ? "Single choice" : "Multiple choice"}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                          {q.answers.map((ans, ai) => (
                            <span key={ai} style={{ fontSize: "0.75rem", color: "#475569", background: "#f1f5f9", borderRadius: 6, padding: "2px 8px", border: "1px solid #e2e8f0" }}>
                              {String.fromCharCode(65 + ai)}. {ans}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                    <button type="button" onClick={() => startEditPoll(poll)}
                      style={{ padding: "0.3rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDeletePoll(poll.id)}
                      style={{ padding: "0.3rem 0.75rem", borderRadius: "6px", border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, color: "#dc2626" }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add / Edit Poll form */}
            {showPollForm && (
              <div style={{ background: "#f8f7ff", borderRadius: "10px", border: `1.5px solid ${PURPLE}`, padding: "1.25rem", marginTop: polls.length > 0 ? "0.75rem" : 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: PURPLE, marginBottom: "1rem" }}>
                  {editingPollId ? "Edit Poll" : "New Poll"}
                </div>

                {/* Poll title */}
                <div style={{ marginBottom: "1rem" }}>
                  <label style={labelStyle}>Poll Title *</label>
                  <input
                    value={pollForm.title}
                    onChange={e => setPollForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Quick Check — Chapter 5"
                    style={inputStyle}
                  />
                  <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 3 }}>The title identifies the poll in Zoom — it may or may not be visible to students depending on Zoom settings.</div>
                </div>

                {/* Questions */}
                {pollForm.questions.map((q, qi) => (
                  <div key={qi} style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "1rem", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#374151" }}>Question {qi + 1}</div>
                      {pollForm.questions.length > 1 && (
                        <button type="button" onClick={() => removeQuestion(qi)}
                          style={{ fontSize: "0.7rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                          Remove question
                        </button>
                      )}
                    </div>

                    <div style={{ marginBottom: "0.625rem" }}>
                      <input
                        value={q.name}
                        onChange={e => updateQuestion(qi, "name", e.target.value)}
                        placeholder="e.g. What is the speed of light?"
                        style={{ ...inputStyle, marginBottom: "0.5rem" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {(["single", "multiple"] as const).map(t => (
                          <label key={t} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "0.8rem", color: q.type === t ? PURPLE : "#64748b", fontWeight: q.type === t ? 700 : 400 }}>
                            <input type="radio" checked={q.type === t} onChange={() => updateQuestion(qi, "type", t)} style={{ accentColor: PURPLE }} />
                            {t === "single" ? "Single choice" : "Multiple choice"}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: "0.5rem" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem" }}>Answer Options * <span style={{ fontWeight: 400, color: "#94a3b8" }}>(2 – 10)</span></div>
                      {q.answers.map((ans, ai) => (
                        <div key={ai} style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", width: 18, textAlign: "center", flexShrink: 0 }}>{String.fromCharCode(65 + ai)}</span>
                          <input
                            value={ans}
                            onChange={e => updateAnswer(qi, ai, e.target.value)}
                            placeholder={`Option ${String.fromCharCode(65 + ai)}`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          {q.answers.length > 2 && (
                            <button type="button" onClick={() => removeAnswer(qi, ai)}
                              style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", color: "#dc2626", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      {q.answers.length < 10 && (
                        <button type="button" onClick={() => addAnswer(qi)}
                          style={{ fontSize: "0.75rem", color: PURPLE, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "0.25rem 0", marginTop: 2 }}>
                          + Add option
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {pollForm.questions.length < 10 && (
                  <button type="button" onClick={addQuestion}
                    style={{ fontSize: "0.8rem", color: "#374151", background: "#fff", border: "1px dashed #d1d5db", borderRadius: "8px", cursor: "pointer", fontWeight: 600, padding: "0.5rem 1rem", width: "100%", marginBottom: "1rem" }}>
                    + Add another question
                  </button>
                )}

                <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
                  <button type="button" onClick={resetPollForm}
                    style={{ padding: "0.5rem 1.125rem", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem", color: "#475569" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSavePoll} disabled={pollSaving}
                    style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", cursor: pollSaving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.875rem", opacity: pollSaving ? 0.7 : 1 }}>
                    {pollSaving ? "Saving…" : editingPollId ? "Update Poll" : "Save Poll"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
