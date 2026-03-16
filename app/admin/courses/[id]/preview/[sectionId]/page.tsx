"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSubjectColor } from "@/lib/subjectColors";
import { ContentTypeIcon, contentTypeLabel } from "@/components/ui/ContentTypeIcon";
import FlashcardPlayer from "@/components/ui/FlashcardPlayer";
import EBookViewer from "@/components/ui/EBookViewer";

type LessonItem = { id: string; itemType: string; sourceId: string; titleSnapshot: string | null; sortOrder: number; unlockAt: string | null; effectiveUnlockAt: string | null; isLocked: boolean };
type Lesson = { id: string; title: string; description: string | null; status: string; sortOrder: number; items: LessonItem[] };
type Chapter = { id: string; title: string; description: string | null; sortOrder: number; lessons: Lesson[] };
type Subject = { id: string; name: string };
type Section = { id: string; subjectId: string; label: string | null; subtitle: string | null; subject: Subject | null; chapters: Chapter[] };
type ProgressMap = { [lessonItemId: string]: boolean };

export default function SubjectLearningPage() {
  const { id: courseId, sectionId } = useParams<{ id: string; sectionId: string }>();

  const [section, setSection] = useState<Section | null>(null);
  const [courseName, setCourseName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<ProgressMap>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [flashcardItem, setFlashcardItem] = useState<LessonItem | null>(null);
  const [ebookItem, setEbookItem] = useState<LessonItem | null>(null);
  const [ebookHtml, setEbookHtml] = useState<string>("");
  const [ebookLoading, setEbookLoading] = useState(false);

  async function openEbook(item: LessonItem) {
    if (item.isLocked) return;
    setEbookLoading(true);
    setEbookItem(item);
    try {
      const res = await fetch(`/api/content-pages/${item.sourceId}`);
      const data = await res.json();
      setEbookHtml(data.data?.body || "<p><em>No content available.</em></p>");
    } catch {
      setEbookHtml("<p><em>Failed to load content.</em></p>");
    } finally {
      setEbookLoading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [currRes, progressRes] = await Promise.all([
        fetch(`/api/courses/${courseId}/curriculum`),
        fetch(`/api/progress/${courseId}`),
      ]);
      const currData = await currRes.json();
      setCourseName(currData.course?.name || "");

      const found: Section | undefined = currData.sections?.find((s: Section) => s.id === sectionId);
      if (found) {
        setSection(found);
        // Auto-expand all chapters and select first lesson
        const allChapterIds = new Set(found.chapters.map((c: Chapter) => c.id));
        setExpandedChapters(allChapterIds);
        const firstLesson = found.chapters[0]?.lessons[0];
        if (firstLesson) setActiveLesson(firstLesson);
      }

      if (progressRes.ok) {
        const progressData = await progressRes.json();
        const map: ProgressMap = {};
        for (const sec of progressData.sections || []) {
          for (const ch of sec.chapters || []) {
            for (const les of ch.lessons || []) {
              // We only have lessonId-level progress here, need item-level from a different approach
              // For now, just use top-level item completion data
            }
          }
        }
        setCompleted(map);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [courseId, sectionId]);

  useEffect(() => { load(); }, [load]);

  async function markComplete(itemId: string) {
    await fetch("/api/progress/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonItemId: itemId }),
    });
    setCompleted((prev) => ({ ...prev, [itemId]: true }));
  }

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function totalItems(s: Section) {
    return s.chapters.reduce((a, ch) => a + ch.lessons.reduce((b, les) => b + les.items.length, 0), 0);
  }

  function completedItemCount(s: Section) {
    let count = 0;
    for (const ch of s.chapters) {
      for (const les of ch.lessons) {
        for (const item of les.items) {
          if (completed[item.id]) count++;
        }
      }
    }
    return count;
  }

  function lessonCompleted(les: Lesson): boolean {
    if (les.items.length === 0) return false;
    return les.items.every((item) => completed[item.id]);
  }

  function lessonProgress(les: Lesson): number {
    if (les.items.length === 0) return 0;
    return les.items.filter((item) => completed[item.id]).length;
  }

  if (loading) return <div style={{ padding: "2rem", color: "#64748b", fontFamily: "system-ui, sans-serif" }}>Loading…</div>;
  if (!section) return <div style={{ padding: "2rem", color: "#dc2626", fontFamily: "system-ui, sans-serif" }}>Subject not found.</div>;

  const color = getSubjectColor(section.subject?.name);
  const subjectName = section.label || section.subject?.name || "Subject";
  const total = totalItems(section);
  const done = completedItemCount(section);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
      {/* FlashcardPlayer Modal */}
      {flashcardItem && (
        <FlashcardPlayer
          deckId={flashcardItem.sourceId}
          subjectColor={color}
          onComplete={() => { markComplete(flashcardItem.id); setFlashcardItem(null); }}
          onExit={() => setFlashcardItem(null)}
        />
      )}

      {/* EBookViewer Modal */}
      {ebookItem && !ebookLoading && (
        <EBookViewer
          contentId={ebookItem.sourceId}
          htmlContent={ebookHtml}
          title={ebookItem.titleSnapshot || "E-Book"}
          subjectColor={color}
          onClose={() => { setEbookItem(null); setEbookHtml(""); }}
        />
      )}
      {ebookLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "2rem 3rem", fontWeight: 700, color: "#374151" }}>Loading E-Book…</div>
        </div>
      )}
      {/* ── Left Sidebar ── */}
      <div style={{
        width: sidebarOpen ? 320 : 0,
        minWidth: sidebarOpen ? 320 : 0,
        overflow: "hidden",
        transition: "width 0.25s ease, min-width 0.25s ease",
        background: "#fff",
        borderRight: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}>
        {/* Sidebar header */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", background: color + "08", borderLeft: `4px solid ${color}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.25rem" }}>📖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "1.0rem", color: color, lineHeight: 1.3 }}>{subjectName}</div>
              {section.subtitle && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{section.subtitle}</div>}
            </div>
          </div>
          {/* Subject progress */}
          <div style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b", marginBottom: "0.375rem" }}>
              <span>{done} / {total} completed</span>
              <span style={{ fontWeight: 700, color: color }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: "#f1f5f9", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: 10, transition: "width 0.5s ease" }} />
            </div>
          </div>
        </div>

        {/* Back link */}
        <div style={{ padding: "0.625rem 1.25rem", borderBottom: "1px solid #f8fafc" }}>
          <Link href={`/admin/courses/${courseId}/preview`} style={{ fontSize: "0.8rem", color: "#64748b", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.375rem" }}>← All Subjects</Link>
        </div>

        {/* Chapter accordion */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {section.chapters.map((chapter) => {
            const chExpanded = expandedChapters.has(chapter.id);
            const chTotal = chapter.lessons.reduce((a, l) => a + l.items.length, 0);
            const chDone = chapter.lessons.reduce((a, l) => a + lessonProgress(l), 0);

            return (
              <div key={chapter.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                {/* Chapter header */}
                <button
                  onClick={() => toggleChapter(chapter.id)}
                  style={{ width: "100%", textAlign: "left", padding: "0.875rem 1.25rem", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.625rem" }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#1e293b" }}>{chapter.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{chDone}/{chTotal} items</div>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: "0.75rem", transition: "transform 0.2s", display: "inline-block", transform: chExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                </button>

                {/* Lessons */}
                {chExpanded && (
                  <div style={{ paddingBottom: "0.375rem" }}>
                    {chapter.lessons.map((lesson) => {
                      const isActive = activeLesson?.id === lesson.id;
                      const isDone = lessonCompleted(lesson);
                      const lessonDone = lessonProgress(lesson);

                      return (
                        <button
                          key={lesson.id}
                          onClick={() => setActiveLesson(lesson)}
                          style={{
                            width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                            padding: "0.625rem 1.25rem 0.625rem 2rem",
                            background: isActive ? color + "14" : "transparent",
                            borderLeft: `3px solid ${isActive ? color : "transparent"}`,
                            display: "flex", alignItems: "center", gap: "0.625rem",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
                          onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                        >
                          {/* Status icon */}
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                            background: isDone ? "#22c55e" : isActive ? color + "33" : "#f1f5f9",
                            border: `2px solid ${isDone ? "#22c55e" : isActive ? color : "#e2e8f0"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.65rem", color: isDone ? "#fff" : "#94a3b8",
                          }}>
                            {isDone ? "✓" : isActive ? "▶" : ""}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: isActive ? 700 : 500, fontSize: "0.825rem", color: isActive ? color : isDone ? "#22c55e" : "#1e293b", lineHeight: 1.3 }}>
                              {lesson.title}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{lesson.items.length} item{lesson.items.length !== 1 ? "s" : ""}{lesson.items.length > 0 ? ` · ${lessonDone}/${lesson.items.length}` : ""}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right Content Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0.875rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button onClick={() => setSidebarOpen((v) => !v)} style={{ padding: "0.375rem 0.625rem", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.85rem" }}>
            {sidebarOpen ? "← Hide nav" : "→ Show nav"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            <Link href="/admin/courses" style={{ color: "#94a3b8", textDecoration: "none" }}>{courseName || "Course"}</Link>
            <span>›</span>
            <Link href={`/admin/courses/${courseId}/preview`} style={{ color: "#94a3b8", textDecoration: "none" }}>{subjectName}</Link>
            {activeLesson && <><span>›</span><span style={{ color: "#1e293b", fontWeight: 600 }}>{activeLesson.title}</span></>}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem", maxWidth: 860, margin: "0 auto", width: "100%" }}>
          {!activeLesson && (
            <div style={{ textAlign: "center", padding: "4rem 2rem", color: "#94a3b8" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📝</div>
              <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#374151", marginBottom: "0.5rem" }}>Select a lesson</div>
              <div>Choose a lesson from the left sidebar to view its content.</div>
            </div>
          )}

          {activeLesson && (
            <>
              {/* Lesson header */}
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", marginBottom: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", color: color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>Lesson</div>
                    <h2 style={{ fontSize: "1.625rem", fontWeight: 900, color: "#0f172a", margin: "0 0 0.375rem" }}>{activeLesson.title}</h2>
                    {activeLesson.description && <p style={{ color: "#64748b", margin: 0, fontSize: "0.9rem" }}>{activeLesson.description}</p>}
                  </div>
                </div>
                <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: 4 }} />
              </div>

              {/* Content items */}
              {activeLesson.items.length === 0 && (
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "2rem", textAlign: "center", color: "#94a3b8", border: "1.5px dashed #e2e8f0" }}>
                  No content added to this lesson yet.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {activeLesson.items.map((item, idx) => {
                  const isDone = !!completed[item.id];
                  const isLocked = item.isLocked;
                  const unlockDate = item.effectiveUnlockAt ? new Date(item.effectiveUnlockAt) : null;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isLocked ? "#faf5ff" : "#fff",
                        borderRadius: 14,
                        border: `1.5px solid ${isLocked ? "#ddd6fe" : isDone ? "#86efac" : "#e2e8f0"}`,
                        boxShadow: isLocked ? "0 2px 12px rgba(124,58,237,0.06)" : isDone ? "0 2px 12px rgba(34,197,94,0.08)" : "0 2px 12px rgba(0,0,0,0.04)",
                        overflow: "hidden",
                        transition: "border-color 0.2s, box-shadow 0.2s",
                        opacity: isLocked ? 0.85 : 1,
                      }}
                    >
                      {/* Locked banner */}
                      {isLocked && (
                        <div style={{ background: "#ede9fe", borderBottom: "1px solid #ddd6fe", padding: "0.4rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.875rem" }}>🔒</span>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#5b21b6" }}>
                            Locked — Unlocks on {unlockDate?.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      )}

                      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                        <div style={{ flexShrink: 0, filter: isLocked ? "grayscale(0.5)" : "none" }}>
                          <ContentTypeIcon type={item.itemType as "VIDEO"} size={44} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.7rem", background: isDone ? "#dcfce7" : isLocked ? "#ede9fe" : "#f1f5f9", color: isDone ? "#16a34a" : isLocked ? "#7c3aed" : "#64748b", borderRadius: 5, padding: "2px 7px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{contentTypeLabel(item.itemType as "VIDEO")}</span>
                            {isDone && <span style={{ fontSize: "0.7rem", background: "#dcfce7", color: "#16a34a", borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>✓ Completed</span>}
                            {isLocked && <span style={{ fontSize: "0.7rem", background: "#ede9fe", color: "#7c3aed", borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>🔒 Not yet available</span>}
                          </div>
                          <div style={{ fontWeight: 700, fontSize: "1.0rem", color: isLocked ? "#64748b" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.titleSnapshot || `Item ${idx + 1}`}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
                          {!isLocked && item.itemType === "FLASHCARD_DECK" && (
                            <button
                              onClick={() => setFlashcardItem(item)}
                              style={{ padding: "0.4rem 0.875rem", borderRadius: 8, background: "#ede9fe", border: "1.5px solid #ddd6fe", color: "#5b21b6", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}
                            >
                              🃏 Open Player
                            </button>
                          )}
                          {!isLocked && item.itemType === "HTML_PAGE" && (
                            <button
                              onClick={() => openEbook(item)}
                              style={{ padding: "0.4rem 0.875rem", borderRadius: 8, background: "#dbeafe", border: "1.5px solid #bfdbfe", color: "#1d4ed8", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}
                            >
                              📖 Open E-Book
                            </button>
                          )}
                          {!isLocked && !isDone && (
                            <button
                              onClick={() => markComplete(item.id)}
                              style={{ padding: "0.4rem 0.875rem", borderRadius: 9, background: "#fff", border: `1.5px solid ${color}`, color: color, cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}
                            >
                              Mark Done
                            </button>
                          )}
                          {isLocked && (
                            <div style={{ padding: "0.4rem 0.875rem", borderRadius: 9, background: "#ede9fe", border: "1.5px solid #ddd6fe", color: "#7c3aed", fontWeight: 700, fontSize: "0.8rem", cursor: "not-allowed", userSelect: "none" }}>
                              🔒 Locked
                            </div>
                          )}
                        </div>
                        {isDone && !isLocked && (
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1.125rem", flexShrink: 0 }}>✓</div>
                        )}
                      </div>

                      {/* Anti-copy protected content area */}
                      {!isLocked && (
                        <div
                          style={{
                            padding: "0.875rem 1.25rem",
                            background: "#f9fafb",
                            borderTop: "1px solid #f1f5f9",
                            position: "relative",
                            userSelect: "none",
                          }}
                          onContextMenu={(e) => e.preventDefault()}
                        >
                          <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontStyle: "italic" }}>
                            {item.itemType === "VIDEO" && "▶ Video content — opens in player"}
                            {item.itemType === "HTML_PAGE" && "📖 E-Book — opens in protected viewer"}
                            {item.itemType === "PDF" && "📋 PDF Document — opens in protected PDF viewer"}
                            {item.itemType === "FLASHCARD_DECK" && "🃏 Flashcard Deck — opens in card player"}
                            {item.itemType === "LIVE_CLASS" && "🔴 Live Class — view schedule and join link"}
                          </div>
                          {/* Subtle watermark */}
                          <div style={{
                            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none", opacity: 0.035,
                            fontSize: "0.7rem", fontWeight: 900, color: "#000", letterSpacing: "0.2em",
                            textTransform: "uppercase", userSelect: "none",
                          }}>
                            SAPHALA PATHSHALA · PROTECTED CONTENT
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Next lesson navigation */}
              {(() => {
                let nextLesson: Lesson | null = null;
                let found = false;
                for (const ch of section.chapters) {
                  for (const les of ch.lessons) {
                    if (found) { nextLesson = les; break; }
                    if (les.id === activeLesson.id) found = true;
                  }
                  if (nextLesson) break;
                }
                return nextLesson ? (
                  <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Next lesson:</span>
                    <button onClick={() => setActiveLesson(nextLesson!)} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, background: color, color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}>
                      {nextLesson.title} →
                    </button>
                  </div>
                ) : null;
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
