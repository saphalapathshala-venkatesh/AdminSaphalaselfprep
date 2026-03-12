"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

const TYPE_CONFIG = [
  { key: "hasHtmlCourse"  as const, label: "HTML",  bg: "#dbeafe", color: "#1d4ed8" },
  { key: "hasVideoCourse" as const, label: "Video", bg: "#f3e8ff", color: PURPLE    },
  { key: "hasPdfCourse"   as const, label: "PDF",   bg: "#fef3c7", color: "#b45309" },
  { key: "hasTestSeries"  as const, label: "Tests", bg: "#dcfce7", color: "#15803d" },
];

type ProductTypes = { hasHtmlCourse: boolean; hasVideoCourse: boolean; hasPdfCourse: boolean; hasTestSeries: boolean };
type Course = { id: string; name: string; isActive: boolean } & ProductTypes & { _count: { videos: number; liveClasses: number } };
type Video  = { id: string; title: string; status: string; lessonOrder: number | null; durationSeconds: number | null; faculty?: { name: string } | null };

function TypeBadges({ c }: { c: ProductTypes }) {
  const active = TYPE_CONFIG.filter(t => c[t.key]);
  if (!active.length) return null;
  return (
    <span style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
      {active.map(t => <span key={t.key} style={{ padding: "1px 6px", borderRadius: "8px", fontSize: "0.6875rem", fontWeight: 700, background: t.bg, color: t.color }}>{t.label}</span>)}
    </span>
  );
}

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

const defaultTypes = (): ProductTypes => ({ hasHtmlCourse: false, hasVideoCourse: true, hasPdfCourse: false, hasTestSeries: false });

export default function CourseVideosPage() {
  const [courses,      setCourses]      = useState<Course[]>([]);
  const [selected,     setSelected]     = useState<string | null>(null);
  const [videos,       setVideos]       = useState<Video[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingVideos,  setLoadingVideos]  = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseTypes, setCourseTypes] = useState<ProductTypes>(defaultTypes());
  const [typeError, setTypeError] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  function loadCourses() {
    setLoadingCourses(true);
    fetch("/api/courses?pageSize=100").then(r => r.json()).then(j => {
      setCourses(j.data || []);
      setLoadingCourses(false);
    });
  }

  useEffect(() => { loadCourses(); }, []);

  useEffect(() => {
    if (!selected) { setVideos([]); return; }
    setLoadingVideos(true);
    fetch(`/api/videos?courseId=${selected}&pageSize=100`).then(r => r.json()).then(j => {
      const vids = (j.data || []).sort((a: Video, b: Video) => (a.lessonOrder ?? 999) - (b.lessonOrder ?? 999));
      setVideos(vids);
      setLoadingVideos(false);
    });
  }, [selected]);

  function openNewCourse() {
    setCourseName(""); setCourseTypes(defaultTypes()); setTypeError("");
    setShowCourseModal(true);
  }

  async function handleCreateCourse() {
    if (!courseName.trim()) return;
    const t = courseTypes;
    if (!t.hasHtmlCourse && !t.hasVideoCourse && !t.hasPdfCourse && !t.hasTestSeries) {
      setTypeError("Select at least one product type"); return;
    }
    setTypeError("");
    setSavingCourse(true);
    const res  = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: courseName.trim(), ...t }) });
    const json = await res.json();
    setSavingCourse(false);
    if (res.ok) {
      setShowCourseModal(false);
      loadCourses();
      showToast("Course created!");
    } else {
      setTypeError(json.error || "Failed to create");
    }
  }

  const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" };
  const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      {/* New Course modal */}
      {showCourseModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "1.75rem", width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.0625rem", fontWeight: 700 }}>New Course</h3>

            <input value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Course name" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", boxSizing: "border-box", marginBottom: "1.125rem" }} autoFocus
              onKeyDown={e => e.key === "Enter" && handleCreateCourse()} />

            <div style={{ marginBottom: "0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "#374151" }}>
              Product Types <span style={{ color: "#dc2626" }}>*</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {TYPE_CONFIG.map(t => {
                const checked = courseTypes[t.key];
                return (
                  <label key={t.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.75rem", borderRadius: "7px", border: `2px solid ${checked ? t.color : "#e2e8f0"}`, background: checked ? t.bg : "#f8fafc", cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={checked} onChange={e => setCourseTypes(prev => ({ ...prev, [t.key]: e.target.checked }))} style={{ width: 14, height: 14, accentColor: t.color }} />
                    <span style={{ fontSize: "0.8125rem", fontWeight: checked ? 700 : 500, color: checked ? t.color : "#374151" }}>{t.label}</span>
                  </label>
                );
              })}
            </div>

            {typeError && <div style={{ fontSize: "0.8125rem", color: "#dc2626", marginBottom: "0.75rem" }}>{typeError}</div>}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCourseModal(false)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreateCourse} disabled={savingCourse || !courseName.trim()} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 700, opacity: savingCourse || !courseName.trim() ? 0.6 : 1 }}>
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
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <Link href="/admin/courses" style={{ padding: "0.4375rem 1rem", borderRadius: "7px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>Manage Courses ↗</Link>
          <button onClick={openNewCourse} style={{ padding: "0.4375rem 1.125rem", borderRadius: "7px", background: PURPLE, color: "#fff", border: "none", fontWeight: 700, fontSize: "0.8125rem", cursor: "pointer" }}>
            + New Course
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "272px 1fr", gap: "1.5rem" }}>
        {/* Course list panel */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Courses</div>
          {loadingCourses ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
          ) : courses.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No courses yet</div>
          ) : (
            courses.map(c => (
              <button key={c.id} onClick={() => setSelected(c.id)} style={{ display: "block", width: "100%", padding: "0.75rem 1rem", background: selected === c.id ? "#f5f3ff" : "transparent", border: "none", borderLeft: `3px solid ${selected === c.id ? PURPLE : "transparent"}`, textAlign: "left", cursor: "pointer", transition: "background 0.1s" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: selected === c.id ? PURPLE : "#1e293b", marginBottom: "0.25rem" }}>{c.name}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.375rem" }}>
                  <TypeBadges c={c} />
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8", flexShrink: 0 }}>{c._count.videos}v</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Videos panel */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          {!selected ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>Select a course to view its videos</div>
          ) : loadingVideos ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading videos…</div>
          ) : videos.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
              No videos in this course.{" "}
              <Link href="/admin/videos/new" style={{ color: PURPLE }}>Add one</Link>
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
