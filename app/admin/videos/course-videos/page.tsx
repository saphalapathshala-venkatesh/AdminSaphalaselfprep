"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

type Course = { id: string; name: string; isActive: boolean; _count: { videos: number; liveClasses: number } };
type Video = { id: string; title: string; status: string; lessonOrder: number | null; durationSeconds: number | null; faculty?: { name: string } | null };

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export default function CourseVideosPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    fetch("/api/courses?pageSize=100").then(r => r.json()).then(j => {
      setCourses(j.data || []);
      setLoadingCourses(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) { setVideos([]); return; }
    setLoadingVideos(true);
    fetch(`/api/videos?courseId=${selected}&pageSize=100`).then(r => r.json()).then(j => {
      const vids = (j.data || []).sort((a: Video, b: Video) => (a.lessonOrder ?? 999) - (b.lessonOrder ?? 999));
      setVideos(vids);
      setLoadingVideos(false);
    });
  }, [selected]);

  async function handleCreateCourse() {
    if (!courseName.trim()) return;
    setSavingCourse(true);
    const res = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: courseName.trim() }) });
    const json = await res.json();
    setSavingCourse(false);
    if (res.ok) {
      setCourseName(""); setShowCourseModal(false);
      fetch("/api/courses?pageSize=100").then(r => r.json()).then(j => setCourses(j.data || []));
      showToast("Course created!");
    } else {
      showToast(json.error || "Failed to create", false);
    }
  }

  const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" };
  const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem" }}>{toast.msg}</div>}

      {showCourseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.1rem" }}>New Course</h3>
            <input value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Course name" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", marginBottom: "1.25rem" }} autoFocus />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCourseModal(false)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleCreateCourse} disabled={savingCourse || !courseName.trim()} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {savingCourse ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/videos" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Videos</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Course Videos</h1>
        </div>
        <button onClick={() => setShowCourseModal(true)} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", border: "none", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}>
          + New Course
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.5rem" }}>
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.8125rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Courses</div>
          {loadingCourses ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
          ) : courses.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No courses yet</div>
          ) : (
            courses.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)} style={{ display: "block", width: "100%", padding: "0.75rem 1rem", background: selected === c.id ? "#f5f3ff" : "transparent", border: "none", borderLeft: `3px solid ${selected === c.id ? PURPLE : "transparent"}`, textAlign: "left", cursor: "pointer", transition: "background 0.1s" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: selected === c.id ? PURPLE : "#1e293b" }}>{c.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>{c._count.videos} videos · {c._count.liveClasses} sessions</div>
              </button>
            ))
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          {!selected ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>Select a course to view its videos</div>
          ) : loadingVideos ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading videos…</div>
          ) : videos.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
              No videos in this course.{" "}
              <Link href={`/admin/videos/new`} style={{ color: PURPLE }}>Add one</Link>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["#","Title","Status","Duration","Faculty"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {videos.map((v, i) => (
                  <tr key={v.id}>
                    <td style={{ ...tdStyle, color: "#94a3b8", width: 40 }}>{i + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>
                      <Link href={`/admin/videos/${v.id}`} style={{ color: "#0f172a", textDecoration: "none" }}>{v.title}</Link>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: v.status === "PUBLISHED" ? "#15803d" : "#64748b" }}>{v.status}</span>
                    </td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{fmtDuration(v.durationSeconds)}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{v.faculty?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
