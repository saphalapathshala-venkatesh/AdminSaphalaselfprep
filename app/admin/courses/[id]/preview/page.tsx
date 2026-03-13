"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSubjectColor } from "@/lib/subjectColors";

type Subject = { id: string; name: string };
type LessonItem = { id: string };
type Lesson = { id: string; items: LessonItem[] };
type Chapter = { id: string; lessons: Lesson[] };
type Section = { id: string; subjectId: string; label: string | null; subtitle: string | null; subject: Subject | null; chapters: Chapter[] };
type Course = { id: string; name: string };

export default function CoursePreviewPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${courseId}/curriculum`)
      .then((r) => r.json())
      .then((d) => { setCourse(d.course); setSections(d.sections); })
      .finally(() => setLoading(false));
  }, [courseId]);

  function totalItems(sec: Section) {
    return sec.chapters.reduce((a, ch) => a + ch.lessons.reduce((b, les) => b + les.items.length, 0), 0);
  }

  if (loading) return <div style={{ padding: "2rem", color: "#64748b" }}>Loading…</div>;
  if (!course) return <div style={{ padding: "2rem", color: "#dc2626" }}>Course not found.</div>;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(226,232,240,0.6)", padding: "1rem 1.5rem", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/admin/courses" style={{ color: "#7c3aed", textDecoration: "none", fontSize: "0.875rem", fontWeight: 600 }}>← Courses</Link>
          <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
          <div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Course Preview</div>
            <div style={{ fontWeight: 800, fontSize: "1.125rem", color: "#0f172a" }}>{course.name}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <Link href={`/admin/courses/${courseId}/curriculum`} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1.5px solid #7c3aed", color: "#7c3aed", textDecoration: "none", fontSize: "0.85rem", fontWeight: 700, background: "#f5f3ff" }}>
              Edit Curriculum
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Course title hero */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 900, color: "#0f172a", margin: "0 0 0.5rem" }}>{course.name}</h1>
          <div style={{ color: "#64748b", fontSize: "0.95rem" }}>{sections.length} subject{sections.length !== 1 ? "s" : ""} · {sections.reduce((a, s) => a + totalItems(s), 0)} total items</div>
        </div>

        {sections.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📚</div>
            <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#374151", marginBottom: "0.5rem" }}>No subjects added yet</div>
            <div style={{ fontSize: "0.9rem" }}>Build the curriculum first to see the learning view.</div>
            <Link href={`/admin/courses/${courseId}/curriculum`} style={{ display: "inline-block", marginTop: "1.25rem", padding: "0.625rem 1.5rem", background: "#7c3aed", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: "0.9rem" }}>
              Build Curriculum →
            </Link>
          </div>
        )}

        {/* Subject grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {sections.map((section, idx) => {
            const color = getSubjectColor(section.subject?.name);
            const subjectName = section.label || section.subject?.name || "Subject";
            const total = totalItems(section);
            const chapterCount = section.chapters.length;

            return (
              <Link
                key={section.id}
                href={`/admin/courses/${courseId}/preview/${section.id}`}
                style={{ textDecoration: "none", display: "block" }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    border: "1px solid rgba(226,232,240,0.8)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.14)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)"; }}
                >
                  {/* Color accent bar */}
                  <div style={{ height: 5, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />

                  <div style={{ padding: "1.25rem" }}>
                    {/* Icon + title row */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem", marginBottom: "1rem" }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 12,
                        background: color + "18",
                        border: `2px solid ${color}33`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.5rem", flexShrink: 0,
                      }}>
                        📖
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "#0f172a", lineHeight: 1.3, marginBottom: "0.25rem" }}>{subjectName}</div>
                        {section.subtitle && <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{section.subtitle}</div>}
                      </div>
                      <div style={{ fontSize: "1.25rem", color: color, flexShrink: 0 }}>→</div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "0.875rem" }}>
                      <div style={{ textAlign: "center", flex: 1, background: "#f8fafc", borderRadius: 8, padding: "0.5rem" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.125rem", color: color }}>{chapterCount}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Chapters</div>
                      </div>
                      <div style={{ textAlign: "center", flex: 1, background: "#f8fafc", borderRadius: 8, padding: "0.5rem" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.125rem", color: color }}>{total}</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Items</div>
                      </div>
                      <div style={{ textAlign: "center", flex: 1, background: "#f8fafc", borderRadius: 8, padding: "0.5rem" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.125rem", color: "#94a3b8" }}>0%</div>
                        <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>Done</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: 6, background: "#f1f5f9", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: "0%", background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: 10, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.375rem" }}>0 / {total} items completed</div>
                  </div>

                  {/* Footer CTA */}
                  <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid #f1f5f9", background: color + "08", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: color }}>Start Learning</span>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: "0.875rem" }}>→</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
