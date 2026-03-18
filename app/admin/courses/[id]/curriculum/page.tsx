"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSubjectColor } from "@/lib/subjectColors";
import { ContentTypeIcon, contentTypeLabel } from "@/components/ui/ContentTypeIcon";

const PURPLE = "#7c3aed";

type Subject = { id: string; name: string; categoryId: string };
type LessonItem = { id: string; itemType: string; sourceId: string | null; titleSnapshot: string | null; sortOrder: number; unlockAt: string | null; effectiveUnlockAt: string | null; isLocked: boolean; externalUrl?: string | null; description?: string | null };
type Lesson = { id: string; title: string; description: string | null; status: string; sortOrder: number; items: LessonItem[] };
type Chapter = { id: string; title: string; description: string | null; sortOrder: number; lessons: Lesson[] };
type Section = { id: string; subjectId: string; label: string | null; subtitle: string | null; sortOrder: number; subject: Subject | null; chapters: Chapter[] };
type Course = { id: string; name: string; categoryId: string | null; hasHtmlCourse: boolean; hasVideoCourse: boolean; hasPdfCourse: boolean; hasTestSeries: boolean; hasFlashcardDecks: boolean };
type Candidate = { id: string; title: string; itemType: string; meta?: Record<string, unknown> };

export default function CurriculumPage() {
  const { id: courseId } = useParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Panel states
  const [addSubjectOpen, setAddSubjectOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Expanded state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Modal states
  const [chapterModal, setChapterModal] = useState<{ sectionId: string; chapter?: Chapter } | null>(null);
  const [lessonModal, setLessonModal] = useState<{ chapterId: string; lesson?: Lesson } | null>(null);
  const [editSectionId, setEditSectionId] = useState<string | null>(null);
  const [editSectionLabel, setEditSectionLabel] = useState("");
  const [editSectionSubtitle, setEditSectionSubtitle] = useState("");

  // Add item panel
  const [addItemPanel, setAddItemPanel] = useState<{ lessonId: string; categoryId: string | null; subjectId: string | null } | null>(null);
  const [addItemType, setAddItemType] = useState<string>("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  // External link form (used when addItemType === "EXTERNAL_LINK")
  const [extLinkForm, setExtLinkForm] = useState({ title: "", url: "", description: "", unlockAt: "" });
  const [extLinkSaving, setExtLinkSaving] = useState(false);
  const [extLinkError, setExtLinkError] = useState("");

  // Form helpers
  const [chapterForm, setChapterForm] = useState({ title: "", description: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", status: "PUBLISHED" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [unlockEditItem, setUnlockEditItem] = useState<{ id: string; lessonId: string; value: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/courses/${courseId}/curriculum`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCourse(data.course);
      setSections(data.sections);
      if (data.sections.length > 0) {
        setExpandedSections(new Set(data.sections.map((s: Section) => s.id)));
      }
    } catch {
      setError("Failed to load curriculum");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const loadSubjects = useCallback(async () => {
    if (!course?.categoryId) return;
    setSubjectsLoading(true);
    try {
      const res = await fetch(`/api/taxonomy?level=subject&parentId=${course.categoryId}`);
      if (!res.ok) return;
      const data = await res.json();
      const subjects: Subject[] = Array.isArray(data) ? data : (data.data || data.items || []);
      const existing = new Set(sections.map((s) => s.subjectId));
      setAvailableSubjects(subjects.filter((s: Subject) => !existing.has(s.id)));
    } catch { /* ignore */ }
    finally { setSubjectsLoading(false); }
  }, [course?.categoryId, sections]);

  useEffect(() => { if (addSubjectOpen) loadSubjects(); }, [addSubjectOpen, loadSubjects]);

  const loadCandidates = useCallback(async () => {
    if (!addItemPanel || !addItemType) return;
    setCandidatesLoading(true);
    try {
      const params = new URLSearchParams({
        itemType: addItemType,
        search: candidateSearch,
        ...(addItemPanel.categoryId ? { categoryId: addItemPanel.categoryId } : {}),
        ...(addItemPanel.subjectId ? { subjectId: addItemPanel.subjectId } : {}),
      });
      const res = await fetch(`/api/lessons/${addItemPanel.lessonId}/candidates?${params}`);
      if (!res.ok) return;
      setCandidates(await res.json());
    } catch { /* ignore */ }
    finally { setCandidatesLoading(false); }
  }, [addItemPanel, addItemType, candidateSearch]);

  useEffect(() => { if (addItemPanel && addItemType) loadCandidates(); }, [addItemPanel, addItemType, candidateSearch, loadCandidates]);

  // ─── Actions ──────────────────────────────────────────────

  async function addSection(subjectId: string, subjectName: string) {
    await fetch(`/api/courses/${courseId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId }),
    });
    setAddSubjectOpen(false);
    await load();
  }

  async function deleteSection(sectionId: string) {
    await fetch(`/api/courses/${courseId}/sections/${sectionId}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  async function updateSectionLabel(sectionId: string) {
    await fetch(`/api/courses/${courseId}/sections/${sectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editSectionLabel, subtitle: editSectionSubtitle }),
    });
    setEditSectionId(null);
    await load();
  }

  async function moveSectionUp(idx: number) {
    if (idx === 0) return;
    const ids = sections.map((s) => s.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await fetch(`/api/courses/${courseId}/sections/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    await load();
  }

  async function moveSectionDown(idx: number) {
    if (idx >= sections.length - 1) return;
    const ids = sections.map((s) => s.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    await fetch(`/api/courses/${courseId}/sections/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    });
    await load();
  }

  async function saveChapter() {
    if (!chapterModal || !chapterForm.title.trim()) return;
    setSaving(true);
    if (chapterModal.chapter) {
      await fetch(`/api/chapters/${chapterModal.chapter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chapterForm),
      });
    } else {
      await fetch(`/api/sections/${chapterModal.sectionId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chapterForm),
      });
    }
    setSaving(false);
    setChapterModal(null);
    await load();
  }

  async function deleteChapter(chapterId: string) {
    await fetch(`/api/chapters/${chapterId}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  async function moveChapterUp(section: Section, idx: number) {
    if (idx === 0) return;
    const ids = section.chapters.map((c) => c.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await fetch(`/api/sections/${section.id}/chapters`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    }).catch(() => {});
    await load();
  }

  async function saveLesson() {
    if (!lessonModal || !lessonForm.title.trim()) return;
    setSaving(true);
    if (lessonModal.lesson) {
      await fetch(`/api/lessons/${lessonModal.lesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lessonForm),
      });
    } else {
      await fetch(`/api/chapters/${lessonModal.chapterId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lessonForm),
      });
    }
    setSaving(false);
    setLessonModal(null);
    await load();
  }

  async function deleteLesson(lessonId: string) {
    await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    setConfirmDelete(null);
    await load();
  }

  async function moveLessonUp(chapter: Chapter, idx: number) {
    if (idx === 0) return;
    const ids = chapter.lessons.map((l) => l.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await fetch(`/api/chapters/${chapter.id}/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    }).catch(() => {});
    await load();
  }

  async function addLessonItem(candidate: Candidate) {
    if (!addItemPanel) return;
    await fetch(`/api/lessons/${addItemPanel.lessonId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: candidate.itemType, sourceId: candidate.id, titleSnapshot: candidate.title }),
    });
    setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
    await load();
  }

  async function removeLessonItem(lessonId: string, itemId: string) {
    await fetch(`/api/lessons/${lessonId}/items/${itemId}`, { method: "DELETE" });
    await load();
  }

  async function moveLessonItemUp(lesson: Lesson, idx: number) {
    if (idx === 0) return;
    const ids = lesson.items.map((i) => i.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    await fetch(`/api/lessons/${lesson.id}/items/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    }).catch(() => {});
    await load();
  }

  async function saveItemUnlockAt(lessonId: string, itemId: string, unlockAt: string) {
    await fetch(`/api/lessons/${lessonId}/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlockAt: unlockAt ? unlockAt + ":00+05:30" : null }),
    });
    setUnlockEditItem(null);
    await load();
  }

  // ─── Helpers ──────────────────────────────────────────────

  function getSubjectColorForSection(sec: Section): string {
    return getSubjectColor(sec.subject?.name);
  }

  function availableItemTypes(c: Course) {
    const types: string[] = [];
    if (c.hasVideoCourse) types.push("VIDEO");
    if (c.hasHtmlCourse) types.push("HTML_PAGE");
    if (c.hasPdfCourse) types.push("PDF");
    if (c.hasFlashcardDecks) types.push("FLASHCARD_DECK");
    // EXTERNAL_LINK is always available — it doesn't depend on course product flags
    types.push("EXTERNAL_LINK");
    return types;
  }

  async function addExternalLinkItem() {
    if (!addItemPanel) return;
    setExtLinkError("");
    if (!extLinkForm.url.trim()) { setExtLinkError("URL is required"); return; }
    try { new URL(extLinkForm.url.trim()); } catch { setExtLinkError("Invalid URL — must be a valid absolute URL (e.g. https://example.com)"); return; }
    if (!extLinkForm.title.trim()) { setExtLinkError("Title is required"); return; }
    setExtLinkSaving(true);
    const res = await fetch(`/api/lessons/${addItemPanel.lessonId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "EXTERNAL_LINK",
        titleSnapshot: extLinkForm.title.trim(),
        externalUrl: extLinkForm.url.trim(),
        description: extLinkForm.description.trim() || null,
        unlockAt: extLinkForm.unlockAt ? extLinkForm.unlockAt + ":00+05:30" : null,
      }),
    });
    const d = await res.json();
    setExtLinkSaving(false);
    if (!res.ok) { setExtLinkError(d.error || "Failed to add external link"); return; }
    setExtLinkForm({ title: "", url: "", description: "", unlockAt: "" });
    setAddItemPanel(null);
    await load();
  }

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ─── Render ───────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: "2rem", color: "#64748b" }}>Loading curriculum…</div>
  );

  if (error) return (
    <div style={{ padding: "2rem", color: "#dc2626" }}>{error}</div>
  );

  if (!course) return null;

  const itemTypes = availableItemTypes(course);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <Link href="/admin/courses" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>Courses</Link>
            <span style={{ color: "#cbd5e1" }}>›</span>
            <span style={{ color: "#374151", fontSize: "0.875rem", fontWeight: 600 }}>{course.name}</span>
            <span style={{ color: "#cbd5e1" }}>›</span>
            <span style={{ color: PURPLE, fontSize: "0.875rem", fontWeight: 700 }}>Curriculum</span>
          </div>
          <h1 style={{ fontSize: "1.375rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>📚 Curriculum Builder</h1>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.625rem" }}>
          <Link href={`/admin/courses/${courseId}/preview`} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1.5px solid #7c3aed", color: "#7c3aed", textDecoration: "none", fontWeight: 700, fontSize: "0.875rem", background: "#f5f3ff" }}>
            👁 Preview
          </Link>
          <button
            onClick={() => setAddSubjectOpen(true)}
            style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1rem", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}
          >
            + Add Subject Section
          </button>
        </div>
      </div>

      {/* Product type badge row */}
      <div style={{ padding: "0.625rem 1.5rem", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600, marginRight: "0.25rem" }}>ENABLED TYPES:</span>
        {itemTypes.map((t) => (
          <span key={t} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "0.2rem 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#374151" }}>
            <ContentTypeIcon type={t as "VIDEO"} size={18} />
            {contentTypeLabel(t as "VIDEO")}
          </span>
        ))}
        {itemTypes.length === 0 && <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>No item types enabled — edit course to add product types.</span>}
      </div>

      <div style={{ padding: "1.5rem", maxWidth: 920, margin: "0 auto" }}>
        {sections.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1.5px dashed #e2e8f0", padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📚</div>
            <div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#374151", marginBottom: "0.375rem" }}>No subjects yet</div>
            <div style={{ fontSize: "0.9rem" }}>Add a subject section to start building this course's curriculum.</div>
            <button onClick={() => setAddSubjectOpen(true)} style={{ marginTop: "1.25rem", background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 700, cursor: "pointer" }}>+ Add Subject Section</button>
          </div>
        )}

        {sections.map((section, sIdx) => {
          const color = getSubjectColorForSection(section);
          const expanded = expandedSections.has(section.id);
          const totalItems = section.chapters.reduce((a, ch) => a + ch.lessons.reduce((b, les) => b + les.items.length, 0), 0);

          return (
            <div key={section.id} style={{ marginBottom: "1.25rem", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
              {/* Section header */}
              <div style={{ background: "#fff", borderLeft: `5px solid ${color}`, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.875rem" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "1.375rem" }}>📖</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editSectionId === section.id ? (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <input value={editSectionLabel} onChange={(e) => setEditSectionLabel(e.target.value)} placeholder={section.subject?.name || "Label"} style={{ padding: "0.3rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", width: 180 }} />
                      <input value={editSectionSubtitle} onChange={(e) => setEditSectionSubtitle(e.target.value)} placeholder="Subtitle (optional)" style={{ padding: "0.3rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.875rem", width: 200 }} />
                      <button onClick={() => updateSectionLabel(section.id)} style={{ padding: "0.3rem 0.75rem", background: PURPLE, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Save</button>
                      <button onClick={() => setEditSectionId(null)} style={{ padding: "0.3rem 0.625rem", background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 800, fontSize: "1.05rem", color: color }}>{section.label || section.subject?.name || "Subject"}</div>
                      {section.subtitle && <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 1 }}>{section.subtitle}</div>}
                      <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>{section.chapters.length} chapters · {totalItems} items</div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                  <button onClick={() => moveSectionUp(sIdx)} disabled={sIdx === 0} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", opacity: sIdx === 0 ? 0.35 : 1 }}>↑</button>
                  <button onClick={() => moveSectionDown(sIdx)} disabled={sIdx === sections.length - 1} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", opacity: sIdx === sections.length - 1 ? 0.35 : 1 }}>↓</button>
                  <button onClick={() => { setEditSectionId(section.id); setEditSectionLabel(section.label || ""); setEditSectionSubtitle(section.subtitle || ""); }} style={{ padding: "0 0.5rem", height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.75rem", color: "#374151" }}>Edit</button>
                  <button onClick={() => { setChapterModal({ sectionId: section.id }); setChapterForm({ title: "", description: "" }); }} style={{ padding: "0 0.625rem", height: 28, borderRadius: 6, border: `1px solid ${color}`, background: color + "11", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, color: color }}>+ Chapter</button>
                  <button onClick={() => setConfirmDelete({ type: "section", id: section.id, name: section.label || section.subject?.name || "Subject" })} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #fca5a5", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "1rem" }}>×</button>
                  <button onClick={() => toggleSection(section.id)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.85rem", fontWeight: 700 }}>{expanded ? "▲" : "▼"}</button>
                </div>
              </div>

              {/* Chapters */}
              {expanded && (
                <div style={{ background: "#fafbfc" }}>
                  {section.chapters.length === 0 && (
                    <div style={{ padding: "1rem 1.5rem", color: "#94a3b8", fontSize: "0.875rem", fontStyle: "italic" }}>No chapters yet — add one above.</div>
                  )}
                  {section.chapters.map((chapter, cIdx) => {
                    const chExpanded = expandedChapters.has(chapter.id);
                    const chItemCount = chapter.lessons.reduce((a, l) => a + l.items.length, 0);

                    return (
                      <div key={chapter.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        {/* Chapter row */}
                        <div style={{ padding: "0.75rem 1.5rem 0.75rem 2rem", display: "flex", alignItems: "center", gap: "0.75rem", background: "#fff" }}>
                          <span style={{ fontSize: "1rem" }}>📑</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>{chapter.title}</div>
                            {chapter.description && <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{chapter.description}</div>}
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{chapter.lessons.length} lessons · {chItemCount} items</div>
                          </div>
                          <div style={{ display: "flex", gap: "0.3rem" }}>
                            <button onClick={() => moveSectionUp(cIdx)} disabled={cIdx === 0} style={{ width: 26, height: 26, borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.8rem", opacity: cIdx === 0 ? 0.35 : 1 }}>↑</button>
                            <button onClick={() => { setChapterModal({ sectionId: section.id, chapter }); setChapterForm({ title: chapter.title, description: chapter.description || "" }); }} style={{ padding: "0 0.5rem", height: 26, borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.75rem", color: "#374151" }}>Edit</button>
                            <button onClick={() => { setLessonModal({ chapterId: chapter.id }); setLessonForm({ title: "", description: "", status: "PUBLISHED" }); }} style={{ padding: "0 0.5rem", height: 26, borderRadius: 5, border: `1px solid ${color}`, background: color + "11", cursor: "pointer", fontSize: "0.75rem", fontWeight: 700, color: color }}>+ Lesson</button>
                            <button onClick={() => setConfirmDelete({ type: "chapter", id: chapter.id, name: chapter.title })} style={{ width: 26, height: 26, borderRadius: 5, border: "1px solid #fca5a5", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "1rem" }}>×</button>
                            <button onClick={() => toggleChapter(chapter.id)} style={{ width: 26, height: 26, borderRadius: 5, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.8rem" }}>{chExpanded ? "▲" : "▼"}</button>
                          </div>
                        </div>

                        {/* Lessons */}
                        {chExpanded && (
                          <div style={{ background: "#f8fafc" }}>
                            {chapter.lessons.length === 0 && (
                              <div style={{ padding: "0.75rem 3.5rem", color: "#94a3b8", fontSize: "0.8rem", fontStyle: "italic" }}>No lessons yet.</div>
                            )}
                            {chapter.lessons.map((lesson, lIdx) => (
                              <div key={lesson.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                                {/* Lesson row */}
                                <div style={{ padding: "0.625rem 1.5rem 0.625rem 3.5rem", display: "flex", alignItems: "center", gap: "0.625rem", background: "#fff", borderLeft: `3px solid ${color}33` }}>
                                  <span style={{ fontSize: "0.95rem" }}>📝</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                                      {lesson.title}
                                      {lesson.status === "DRAFT" && <span style={{ marginLeft: 6, fontSize: "0.7rem", background: "#fef3c7", color: "#92400e", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>DRAFT</span>}
                                    </div>
                                    {lesson.description && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{lesson.description}</div>}
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{lesson.items.length} item{lesson.items.length !== 1 ? "s" : ""}</div>
                                  </div>
                                  <div style={{ display: "flex", gap: "0.25rem" }}>
                                    <button onClick={() => moveLessonUp(chapter, lIdx)} disabled={lIdx === 0} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.75rem", opacity: lIdx === 0 ? 0.35 : 1 }}>↑</button>
                                    <button onClick={() => { setLessonModal({ chapterId: chapter.id, lesson }); setLessonForm({ title: lesson.title, description: lesson.description || "", status: lesson.status }); }} style={{ padding: "0 0.4rem", height: 24, borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.72rem", color: "#374151" }}>Edit</button>
                                    <button
                                      onClick={() => {
                                        setAddItemPanel({ lessonId: lesson.id, categoryId: course.categoryId, subjectId: section.subjectId });
                                        setAddItemType(itemTypes[0] || "");
                                        setCandidateSearch("");
                                        setCandidates([]);
                                      }}
                                      style={{ padding: "0 0.4rem", height: 24, borderRadius: 4, border: `1px solid ${color}`, background: color + "11", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700, color: color }}
                                    >+ Item</button>
                                    <button onClick={() => setConfirmDelete({ type: "lesson", id: lesson.id, name: lesson.title })} style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #fca5a5", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "0.875rem" }}>×</button>
                                  </div>
                                </div>

                                {/* Lesson items */}
                                {lesson.items.length > 0 && (
                                  <div style={{ paddingLeft: "4.5rem", paddingRight: "1.5rem", paddingBottom: "0.5rem", background: "#f9fafb" }}>
                                    {lesson.items.map((item, iIdx) => {
                                      const isEditingUnlock = unlockEditItem?.id === item.id;
                                      const hasItemLock = !!item.unlockAt;
                                      const hasEffectiveLock = !!item.effectiveUnlockAt;
                                      return (
                                        <div key={item.id} style={{ marginBottom: "0.25rem", background: "#fff", borderRadius: 8, border: `1px solid ${hasEffectiveLock ? "#ddd6fe" : "#f1f5f9"}` }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.625rem" }}>
                                            <ContentTypeIcon type={item.itemType as "VIDEO"} size={28} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                              <div style={{ fontWeight: 600, fontSize: "0.825rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.titleSnapshot || (item.itemType === "EXTERNAL_LINK" ? item.externalUrl : item.sourceId)}</div>
                                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                                                {contentTypeLabel(item.itemType as "VIDEO")}
                                                {item.itemType === "EXTERNAL_LINK" && item.externalUrl && (
                                                  <span style={{ color: "#0369a1", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160, display: "inline-block", verticalAlign: "middle" }}>{item.externalUrl}</span>
                                                )}
                                                {hasEffectiveLock && (
                                                  <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                                                    · 🔒 {hasItemLock ? "Item unlock:" : "Content unlock:"} {new Date(item.effectiveUnlockAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <button
                                              title="Set unlock date for this course item"
                                              onClick={() => setUnlockEditItem(isEditingUnlock ? null : { id: item.id, lessonId: lesson.id, value: item.unlockAt ? item.unlockAt.slice(0, 16) : "" })}
                                              style={{ width: 22, height: 22, borderRadius: 4, border: `1px solid ${hasItemLock ? "#7c3aed" : "#e2e8f0"}`, background: hasItemLock ? "#ede9fe" : "#f8fafc", cursor: "pointer", color: hasItemLock ? "#7c3aed" : "#64748b", fontSize: "0.65rem" }}
                                            >📅</button>
                                            <button onClick={() => moveLessonItemUp(lesson, iIdx)} disabled={iIdx === 0} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.7rem", opacity: iIdx === 0 ? 0.35 : 1 }}>↑</button>
                                            <button onClick={() => removeLessonItem(lesson.id, item.id)} style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #fca5a5", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "0.75rem" }}>×</button>
                                          </div>
                                          {isEditingUnlock && unlockEditItem && (
                                            <div style={{ padding: "0.375rem 0.625rem 0.5rem", borderTop: "1px solid #f1f5f9", background: "#faf5ff", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#7c3aed", whiteSpace: "nowrap" }}>🔒 Unlock on</span>
                                              <input
                                                type="datetime-local"
                                                value={unlockEditItem.value}
                                                onChange={(e) => setUnlockEditItem({ ...unlockEditItem, value: e.target.value })}
                                                style={{ padding: "0.2rem 0.5rem", border: "1px solid #ddd6fe", borderRadius: 5, fontSize: "0.8rem", background: "#fff" }}
                                              />
                                              <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Overrides content-level date for this course item</span>
                                              <button onClick={() => saveItemUnlockAt(lesson.id, item.id, unlockEditItem.value)} style={{ padding: "0.2rem 0.625rem", background: PURPLE, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontWeight: 700, fontSize: "0.75rem" }}>Save</button>
                                              <button onClick={() => saveItemUnlockAt(lesson.id, item.id, "")} style={{ padding: "0.2rem 0.5rem", background: "#f8fafc", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 5, cursor: "pointer", fontSize: "0.75rem" }}>Clear</button>
                                              <button onClick={() => setUnlockEditItem(null)} style={{ padding: "0.2rem 0.5rem", background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 5, cursor: "pointer", fontSize: "0.75rem" }}>Cancel</button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Subject Panel ── */}
      {addSubjectOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
          <div style={{ background: "#fff", width: 360, height: "100vh", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>Add Subject Section</div>
              <button onClick={() => setAddSubjectOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1.125rem", color: "#64748b" }}>×</button>
            </div>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
              <input
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder="Search subjects…"
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
              {!course.categoryId && <div style={{ color: "#94a3b8", fontSize: "0.875rem", padding: "0.75rem" }}>Course has no category assigned. Edit the course to set a category first.</div>}
              {subjectsLoading && <div style={{ color: "#94a3b8", fontSize: "0.875rem", padding: "0.75rem" }}>Loading subjects…</div>}
              {!subjectsLoading && availableSubjects.filter((s) => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase())).map((subj) => {
                const c = getSubjectColor(subj.name);
                return (
                  <button
                    key={subj.id}
                    onClick={() => addSection(subj.id, subj.name)}
                    style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%", textAlign: "left", padding: "0.75rem", borderRadius: 10, border: `1.5px solid ${c}33`, background: c + "0d", cursor: "pointer", marginBottom: "0.5rem" }}
                  >
                    <div style={{ width: 10, height: 32, borderRadius: 4, background: c, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 700, color: c, fontSize: "0.9rem" }}>{subj.name}</div>
                    </div>
                  </button>
                );
              })}
              {!subjectsLoading && course.categoryId && availableSubjects.filter((s) => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase())).length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: "0.875rem", padding: "0.75rem" }}>No more subjects available for this category.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Chapter Modal ── */}
      {chapterModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>{chapterModal.chapter ? "Edit Chapter" : "Add Chapter"}</div>
              <button onClick={() => setChapterModal(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1.125rem", color: "#64748b" }}>×</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.375rem" }}>Chapter Title *</label>
                <input value={chapterForm.title} onChange={(e) => setChapterForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Fundamental Rights" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.375rem" }}>Description (optional)</label>
                <textarea value={chapterForm.description} onChange={(e) => setChapterForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Short description" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
              <button onClick={() => setChapterModal(null)} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={saveChapter} disabled={saving || !chapterForm.title.trim()} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, background: PURPLE, color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : chapterModal.chapter ? "Save Changes" : "Add Chapter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lesson Modal ── */}
      {lessonModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>{lessonModal.lesson ? "Edit Lesson" : "Add Lesson"}</div>
              <button onClick={() => setLessonModal(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1.125rem", color: "#64748b" }}>×</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.375rem" }}>Lesson Title *</label>
                <input value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Introduction to Fundamental Rights" style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.375rem" }}>Description (optional)</label>
                <textarea value={lessonForm.description} onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))} rows={2} style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", color: "#374151", marginBottom: "0.375rem" }}>Status</label>
                <select value={lessonForm.status} onChange={(e) => setLessonForm((f) => ({ ...f, status: e.target.value }))} style={{ padding: "0.45rem 0.75rem", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", background: "#fff" }}>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
              <button onClick={() => setLessonModal(null)} style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={saveLesson} disabled={saving || !lessonForm.title.trim()} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, background: PURPLE, color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : lessonModal.lesson ? "Save Changes" : "Add Lesson"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Item Panel ── */}
      {addItemPanel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
          <div style={{ background: "#fff", width: 400, height: "100vh", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>Add Content Item</div>
              <button onClick={() => setAddItemPanel(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1.125rem", color: "#64748b" }}>×</button>
            </div>

            {/* Type selector */}
            <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {itemTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => { setAddItemType(t); setCandidateSearch(""); }}
                  style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.625rem", borderRadius: 8, border: addItemType === t ? `2px solid ${PURPLE}` : "1.5px solid #e2e8f0", background: addItemType === t ? "#f5f3ff" : "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: addItemType === t ? 700 : 500, color: addItemType === t ? PURPLE : "#374151" }}
                >
                  <ContentTypeIcon type={t as "VIDEO"} size={20} />
                  {contentTypeLabel(t as "VIDEO")}
                </button>
              ))}
              {itemTypes.length === 0 && <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>No types enabled for this course.</div>}
            </div>

            {/* Search (only for content types that use the candidate picker) */}
            {addItemType && addItemType !== "EXTERNAL_LINK" && (
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                <input
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder={`Search ${contentTypeLabel(addItemType as "VIDEO")}…`}
                  style={{ width: "100%", padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", boxSizing: "border-box" }}
                />
              </div>
            )}

            {/* External Link form */}
            {addItemType === "EXTERNAL_LINK" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "1rem" }}>
                  Attach any external resource (article, YouTube, report, etc.) directly inside this lesson.
                </div>
                {extLinkError && (
                  <div style={{ background: "#fee2e2", color: "#991b1b", padding: "0.5rem 0.75rem", borderRadius: 6, fontSize: "0.8rem", marginBottom: "0.75rem" }}>
                    {extLinkError}
                  </div>
                )}
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>Title *</label>
                  <input value={extLinkForm.title} onChange={e => setExtLinkForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Official NCERT Chapter 5"
                    style={{ width: "100%", padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>URL *</label>
                  <input value={extLinkForm.url} onChange={e => setExtLinkForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://example.com/resource"
                    style={{ width: "100%", padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>Description (optional)</label>
                  <textarea value={extLinkForm.description} onChange={e => setExtLinkForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What will students find here?"
                    style={{ width: "100%", padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", boxSizing: "border-box", minHeight: 70, resize: "vertical" }} />
                </div>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#374151", marginBottom: "0.25rem" }}>Unlock Date (optional)</label>
                  <input type="datetime-local" value={extLinkForm.unlockAt} onChange={e => setExtLinkForm(f => ({ ...f, unlockAt: e.target.value }))}
                    style={{ width: "100%", padding: "0.45rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem", boxSizing: "border-box" }} />
                </div>
                <button onClick={addExternalLinkItem} disabled={extLinkSaving}
                  style={{ width: "100%", padding: "0.625rem", borderRadius: 8, background: PURPLE, color: "#fff", border: "none", cursor: extLinkSaving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.9rem", opacity: extLinkSaving ? 0.6 : 1 }}>
                  {extLinkSaving ? "Adding…" : "🌐 Add External Link"}
                </button>
              </div>
            )}

            {/* Candidate list (all types except EXTERNAL_LINK) */}
            {addItemType !== "EXTERNAL_LINK" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                {!addItemType && <div style={{ color: "#94a3b8", fontSize: "0.875rem", padding: "0.75rem" }}>Select a content type above.</div>}
                {addItemType && candidatesLoading && <div style={{ color: "#94a3b8", fontSize: "0.875rem", padding: "0.75rem" }}>Loading…</div>}
                {addItemType && !candidatesLoading && candidates.length === 0 && (
                  <div style={{ color: "#94a3b8", fontSize: "0.875rem", padding: "0.75rem" }}>No available {contentTypeLabel(addItemType as "VIDEO")} items found.</div>
                )}
                {addItemType && !candidatesLoading && candidates.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.625rem", borderRadius: 10, border: "1px solid #f1f5f9", background: "#fff", marginBottom: "0.375rem" }}>
                    <ContentTypeIcon type={c.itemType as "VIDEO"} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{contentTypeLabel(c.itemType as "VIDEO")}</div>
                    </div>
                    <button
                      onClick={() => addLessonItem(c)}
                      style={{ padding: "0.3rem 0.625rem", borderRadius: 7, background: PURPLE, color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm Delete ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "1.75rem", maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#0f172a", marginBottom: "0.5rem" }}>Delete {confirmDelete.type}?</div>
            <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Delete "<strong>{confirmDelete.name}</strong>"? This will also delete all nested content inside it.
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#374151", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                onClick={() => {
                  if (confirmDelete.type === "section") deleteSection(confirmDelete.id);
                  else if (confirmDelete.type === "chapter") deleteChapter(confirmDelete.id);
                  else if (confirmDelete.type === "lesson") deleteLesson(confirmDelete.id);
                }}
                style={{ padding: "0.5rem 1.25rem", borderRadius: 8, background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
