"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const PURPLE = "#7c3aed";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProductTypes = { hasHtmlCourse: boolean; hasVideoCourse: boolean; hasPdfCourse: boolean; hasTestSeries: boolean; hasFlashcardDecks: boolean };
type Course = ProductTypes & { id: string; name: string; categoryId: string | null; isActive: boolean };
type CourseFolder = { id: string; courseId: string; parentId: string | null; title: string; description: string | null; sortOrder: number };
type CourseItem = {
  id: string; courseId: string; folderId: string | null; itemType: string; sourceId: string;
  sortOrder: number; resolvedTitle: string | null; titleSnapshot: string | null; thumbnailUrl: string | null;
  durationSeconds?: number; status?: string; sessionDate?: string | null; isPublished?: boolean; cardCount?: number;
  sourceMissing?: boolean;
};
type Entry = { entryType: "folder" | "item"; id: string; sortOrder: number; folder?: CourseFolder; item?: CourseItem };

// Taxonomy
type TaxCategory = { id: string; name: string; subjects: TaxSubject[] };
type TaxSubject  = { id: string; name: string; topics: TaxTopic[] };
type TaxTopic    = { id: string; name: string; subtopics: { id: string; name: string }[] };

// Candidates
type Candidate = { id: string; title: string; thumbnailUrl?: string | null; status?: string; isPublished?: boolean; sessionDate?: string | null; platform?: string; durationSeconds?: number | null; cardCount?: number; _count?: { cards: number } };

// ─── Constants ─────────────────────────────────────────────────────────────────
const ITEM_CFG: Record<string, { label: string; short: string; icon: string; bg: string; color: string; btnBg: string }> = {
  VIDEO:         { label: "Video",        short: "Video", icon: "▶",  bg: "#f3e8ff", color: PURPLE,    btnBg: PURPLE },
  LIVE_CLASS:    { label: "Live Class",   short: "Live",  icon: "📡", bg: "#dbeafe", color: "#1d4ed8", btnBg: "#1d4ed8" },
  PDF:           { label: "PDF",          short: "PDF",   icon: "📄", bg: "#fef3c7", color: "#b45309", btnBg: "#b45309" },
  FLASHCARD_DECK:{ label: "Flashcards",   short: "Flash", icon: "🃏", bg: "#f0fdf4", color: "#15803d", btnBg: "#15803d" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildBreadcrumb(id: string | null, folders: CourseFolder[]): CourseFolder[] {
  if (!id) return [];
  const f = folders.find(x => x.id === id);
  if (!f) return [];
  return [...buildBreadcrumb(f.parentId, folders), f];
}

function fmtDur(s?: number | null) {
  if (!s) return null;
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const inputSt: React.CSSProperties = { width: "100%", padding: "0.4375rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.8125rem", outline: "none", background: "#fff", boxSizing: "border-box" };

// ─── Folder node (recursive) ───────────────────────────────────────────────────
function FolderNode({
  folder, depth, allFolders, selectedId, expandedIds,
  onSelect, onToggle, onAddSub, onRename, onDelete,
}: {
  folder: CourseFolder; depth: number; allFolders: CourseFolder[]; selectedId: string | null;
  expandedIds: string[];
  onSelect: (id: string) => void; onToggle: (id: string) => void;
  onAddSub: (parentId: string) => void; onRename: (folder: CourseFolder) => void; onDelete: (folder: CourseFolder) => void;
}) {
  const children = allFolders.filter(f => f.parentId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const expanded  = expandedIds.includes(folder.id);
  const selected  = selectedId === folder.id;

  return (
    <div>
      <div
        style={{ display: "flex", alignItems: "center", paddingLeft: depth * 14 + 6, paddingRight: 4, gap: 0, background: selected ? "#ede9fe" : "transparent", borderLeft: `3px solid ${selected ? PURPLE : "transparent"}`, cursor: "pointer" }}
        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "#f1f0ff"; }}
        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      >
        {/* Expand caret */}
        <button onClick={e => { e.stopPropagation(); onToggle(folder.id); }} style={{ width: 18, height: 28, border: "none", background: "transparent", cursor: "pointer", fontSize: "0.65rem", color: "#94a3b8", padding: 0, flexShrink: 0 }}>
          {children.length > 0 ? (expanded ? "▾" : "▸") : " "}
        </button>

        {/* Folder label */}
        <button onClick={() => onSelect(folder.id)} style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.375rem", border: "none", background: "transparent", cursor: "pointer", padding: "0.35rem 0.25rem", textAlign: "left", overflow: "hidden" }}>
          <span style={{ fontSize: "0.875rem" }}>📁</span>
          <span style={{ fontSize: "0.8125rem", fontWeight: selected ? 700 : 500, color: selected ? PURPLE : "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{folder.title}</span>
        </button>

        {/* Quick-action dots */}
        <div className="folder-actions" style={{ display: "flex", gap: 0, opacity: 0, transition: "opacity 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
          onMouseLeave={e => e.currentTarget.style.opacity = "0"}
        >
          <button onClick={e => { e.stopPropagation(); onAddSub(folder.id); }} title="Add subfolder" style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", fontSize: "0.7rem", color: "#94a3b8" }}>+</button>
          <button onClick={e => { e.stopPropagation(); onRename(folder); }} title="Rename" style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", fontSize: "0.65rem", color: "#94a3b8" }}>✎</button>
          <button onClick={e => { e.stopPropagation(); onDelete(folder); }} title="Delete" style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", fontSize: "0.65rem", color: "#fca5a5" }}>×</button>
        </div>
      </div>

      {expanded && children.map(child => (
        <FolderNode key={child.id} folder={child} depth={depth + 1} allFolders={allFolders}
          selectedId={selectedId} expandedIds={expandedIds}
          onSelect={onSelect} onToggle={onToggle} onAddSub={onAddSub} onRename={onRename} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function CourseContentBuilderPage() {
  const { id: courseId } = useParams<{ id: string }>();

  // Core data
  const [course,  setCourse]  = useState<Course | null>(null);
  const [folders, setFolders] = useState<CourseFolder[]>([]);
  const [items,   setItems]   = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Taxonomy (for add-dialog filters)
  const [taxonomy, setTaxonomy] = useState<TaxCategory[]>([]);

  // Navigation
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // Reorder
  const [localEntries, setLocalEntries] = useState<Entry[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Folder modal
  const [folderModal, setFolderModal] = useState<{ mode: "create" | "rename"; parentId?: string | null; target?: CourseFolder } | null>(null);
  const [folderTitle, setFolderTitle] = useState("");
  const [folderSaving, setFolderSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "folder" | "item"; id: string; title: string; hasChildren?: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add content panel
  const [addType, setAddType] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState("");
  const [addSubjectId, setAddSubjectId] = useState("");
  const [addTopicId, setAddTopicId] = useState("");
  const [addSubtopicId, setAddSubtopicId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  // ─── Load everything ──────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/courses/${courseId}/content`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCourse(json.course);
      setFolders(json.folders || []);
      setItems(json.items || []);
    } catch (e: any) {
      showToast(e.message || "Failed to load", false);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { reload(); }, [reload]);

  // Load taxonomy once
  useEffect(() => {
    fetch("/api/taxonomy?tree=true").then(r => r.json()).then(j => setTaxonomy(j.data || []));
  }, []);

  // ─── Derived current entries (sorted, merged folders+items) ───────────────────
  const currentEntries = useMemo((): Entry[] => {
    const subFolders = folders
      .filter(f => (f.parentId ?? null) === (selectedFolderId ?? null))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(f => ({ entryType: "folder" as const, id: f.id, sortOrder: f.sortOrder, folder: f }));
    const folderItems = items
      .filter(i => (i.folderId ?? null) === (selectedFolderId ?? null))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(i => ({ entryType: "item" as const, id: i.id, sortOrder: i.sortOrder, item: i }));
    return [...subFolders, ...folderItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [folders, items, selectedFolderId]);

  // Sync localEntries when currentEntries changes (reset dirty)
  useEffect(() => {
    setLocalEntries(currentEntries);
    setDirty(false);
  }, [currentEntries]);

  // ─── Taxonomy cascade for add-dialog ──────────────────────────────────────────
  const courseCategory = course?.categoryId ? taxonomy.find(c => c.id === course.categoryId) : null;
  const subjects  = courseCategory?.subjects || [];
  const topics    = subjects.find(s => s.id === addSubjectId)?.topics || [];
  const subtopics = topics.find(t => t.id === addTopicId)?.subtopics || [];

  // ─── Load candidates whenever add panel changes ────────────────────────────────
  const fetchCandidates = useCallback(async () => {
    if (!addType) return;
    setCandidatesLoading(true); setCandidates([]);
    const p = new URLSearchParams({ type: addType, search: addSearch, pageSize: "40" });
    if (addSubjectId)  p.set("subjectId",  addSubjectId);
    if (addTopicId)    p.set("topicId",    addTopicId);
    if (addSubtopicId) p.set("subtopicId", addSubtopicId);
    const res  = await fetch(`/api/courses/${courseId}/candidates?${p}`);
    const json = await res.json();
    setCandidates(json.data || []);
    setCandidatesLoading(false);
  }, [courseId, addType, addSearch, addSubjectId, addTopicId, addSubtopicId]);

  useEffect(() => {
    const t = setTimeout(fetchCandidates, 250);
    return () => clearTimeout(t);
  }, [fetchCandidates]);

  // ─── Reorder helpers ──────────────────────────────────────────────────────────
  function moveEntry(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= localEntries.length) return;
    const updated = [...localEntries];
    [updated[index], updated[to]] = [updated[to], updated[index]];
    setLocalEntries(updated);
    setDirty(true);
  }

  async function saveOrder() {
    setSaving(true);
    const orderedEntries = localEntries.map(e => ({ entryType: e.entryType, id: e.id }));
    const res  = await fetch(`/api/courses/${courseId}/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentFolderId: selectedFolderId, orderedEntries }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) { showToast("Order saved"); setDirty(false); reload(); }
    else showToast(json.error || "Failed to save", false);
  }

  // ─── Add content ──────────────────────────────────────────────────────────────
  async function handleAddItem(candidate: Candidate) {
    if (!addType) return;
    setAddingId(candidate.id);
    const res  = await fetch(`/api/courses/${courseId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: selectedFolderId, itemType: addType, sourceId: candidate.id, titleSnapshot: candidate.title }),
    });
    const json = await res.json();
    setAddingId(null);
    if (res.ok) { showToast(`"${candidate.title}" added`); reload(); fetchCandidates(); }
    else showToast(json.error || "Failed to add", false);
  }

  // ─── Remove item ──────────────────────────────────────────────────────────────
  async function handleRemoveItem(itemId: string) {
    setDeleting(true);
    const res  = await fetch(`/api/courses/${courseId}/items/${itemId}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    setDeleteConfirm(null);
    if (res.ok) { showToast("Removed from course"); reload(); }
    else showToast(json.error || "Failed to remove", false);
  }

  // ─── Folder create/rename ─────────────────────────────────────────────────────
  async function handleFolderSave() {
    if (!folderTitle.trim() || !folderModal) return;
    setFolderSaving(true);
    let res: Response;
    if (folderModal.mode === "create") {
      res = await fetch(`/api/courses/${courseId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: folderTitle.trim(), parentId: folderModal.parentId ?? null }),
      });
    } else {
      res = await fetch(`/api/courses/${courseId}/folders/${folderModal.target!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: folderTitle.trim() }),
      });
    }
    const json = await res.json();
    setFolderSaving(false);
    if (res.ok) {
      setFolderModal(null); setFolderTitle("");
      showToast(folderModal.mode === "create" ? "Folder created" : "Folder renamed");
      reload();
      if (folderModal.mode === "create" && json.data?.id) {
        const pid = json.data?.parentId; if (pid) setExpandedIds(prev => prev.includes(pid) ? prev : [...prev, pid]);
      }
    } else {
      showToast(json.error || "Failed", false);
    }
  }

  // ─── Folder delete ────────────────────────────────────────────────────────────
  async function handleFolderDelete(force: boolean) {
    if (!deleteConfirm) return;
    setDeleting(true);
    const url = `/api/courses/${courseId}/folders/${deleteConfirm.id}${force ? "?force=true" : ""}`;
    const res  = await fetch(url, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    if (res.ok) {
      setDeleteConfirm(null);
      if (selectedFolderId === deleteConfirm.id) setSelectedFolderId(null);
      showToast("Folder deleted");
      reload();
    } else if (res.status === 409) {
      setDeleteConfirm(prev => prev ? { ...prev, hasChildren: true } : null);
    } else {
      showToast(json.error || "Failed to delete", false);
    }
  }

  // ─── Conditional add buttons ──────────────────────────────────────────────────
  const addButtons = useMemo(() => {
    if (!course) return [];
    const btns = [];
    if (course.hasVideoCourse) {
      btns.push({ type: "VIDEO",      label: "Add Video",      icon: "▶",  color: PURPLE,    bg: "#ede9fe" });
      btns.push({ type: "LIVE_CLASS", label: "Add Live Class", icon: "📡", color: "#1d4ed8", bg: "#dbeafe" });
    }
    if (course.hasPdfCourse) {
      btns.push({ type: "PDF",        label: "Add PDF",        icon: "📄", color: "#b45309", bg: "#fef3c7" });
    }
    // Flashcards: only shown when the course has the flashcard decks capability
    if (course.hasFlashcardDecks) {
      btns.push({ type: "FLASHCARD_DECK", label: "Add Flashcards", icon: "🃏", color: "#15803d", bg: "#dcfce7" });
    }
    return btns;
  }, [course]);

  // ─── Breadcrumb ───────────────────────────────────────────────────────────────
  const breadcrumb = useMemo(() => buildBreadcrumb(selectedFolderId, folders), [selectedFolderId, folders]);

  // ─── Root-level folder list ───────────────────────────────────────────────────
  const rootFolders = useMemo(() => folders.filter(f => f.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder), [folders]);

  if (loading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
        Loading course content…
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <div style={{ color: "#dc2626", fontWeight: 600 }}>Course not found.</div>
        <Link href="/admin/courses" style={{ color: PURPLE }}>← Back to Courses</Link>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 5rem)", gap: 0 }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Folder modal ─────────────────────────────────────────────────────── */}
      {folderModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", width: 400, padding: "1.75rem", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <h3 style={{ margin: "0 0 1.25rem", fontSize: "1.0625rem", fontWeight: 700 }}>
              {folderModal.mode === "create" ? (folderModal.parentId ? "New Subfolder" : "New Root Folder") : `Rename: ${folderModal.target?.title}`}
            </h3>
            <input value={folderTitle} onChange={e => setFolderTitle(e.target.value)} placeholder="Folder name"
              style={{ ...inputSt, marginBottom: "1.25rem", fontSize: "0.9375rem" }} autoFocus
              onKeyDown={e => e.key === "Enter" && handleFolderSave()} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
              <button onClick={() => { setFolderModal(null); setFolderTitle(""); }} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleFolderSave} disabled={!folderTitle.trim() || folderSaving} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 700, opacity: !folderTitle.trim() || folderSaving ? 0.6 : 1 }}>
                {folderSaving ? "Saving…" : folderModal.mode === "create" ? "Create" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", width: 420, padding: "2rem", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: "1.75rem", marginBottom: "0.75rem" }}>{deleteConfirm.type === "folder" ? "📁" : "🗑️"}</div>
            {deleteConfirm.type === "folder" && deleteConfirm.hasChildren ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>Folder has contents</div>
                <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Move all subfolders and items to the parent folder, then delete?</div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                  <button onClick={() => setDeleteConfirm(null)} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</button>
                  <button onClick={() => handleFolderDelete(true)} disabled={deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}>Move up & Delete</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>
                  {deleteConfirm.type === "folder" ? "Delete this folder?" : "Remove from course?"}
                </div>
                <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
                  {deleteConfirm.type === "folder"
                    ? `"${deleteConfirm.title}" will be permanently deleted.`
                    : `"${deleteConfirm.title}" will be removed from this course. The original content is not affected.`}
                </div>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                  <button onClick={() => setDeleteConfirm(null)} style={{ padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</button>
                  <button onClick={() => deleteConfirm.type === "folder" ? handleFolderDelete(false) : handleRemoveItem(deleteConfirm.id)} disabled={deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}>
                    {deleting ? "Deleting…" : deleteConfirm.type === "folder" ? "Delete" : "Remove"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add content side panel ──────────────────────────────────────────────── */}
      {addType && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
          <div style={{ width: 520, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,.15)" }}>
            {/* Panel header */}
            <div style={{ padding: "1.125rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {ITEM_CFG[addType]?.icon} {ITEM_CFG[addType]?.label}s
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                  Adding to: {breadcrumb.length > 0 ? breadcrumb.map(b => b.title).join(" › ") : "Root"}
                  {course.categoryId && courseCategory && (
                    <span style={{ marginLeft: "0.5rem", padding: "1px 6px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", fontSize: "0.7rem" }}>
                      📍 {courseCategory.name}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { setAddType(null); setAddSearch(""); setAddSubjectId(""); setAddTopicId(""); setAddSubtopicId(""); }}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1rem" }}>×</button>
            </div>

            {/* Taxonomy filters */}
            <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder={`Search ${ITEM_CFG[addType]?.label?.toLowerCase() ?? ""}s…`} style={{ ...inputSt }} autoFocus />
              {subjects.length > 0 && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select value={addSubjectId} onChange={e => { setAddSubjectId(e.target.value); setAddTopicId(""); setAddSubtopicId(""); }} style={{ ...inputSt, flex: 1 }}>
                    <option value="">All subjects</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {topics.length > 0 && (
                    <select value={addTopicId} onChange={e => { setAddTopicId(e.target.value); setAddSubtopicId(""); }} style={{ ...inputSt, flex: 1 }}>
                      <option value="">All topics</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Candidate list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {candidatesLoading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
              ) : candidates.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                  {addSearch ? `No matches for "${addSearch}"` : `No ${ITEM_CFG[addType]?.label?.toLowerCase() ?? "items"} found`}
                  {course.categoryId && !addSearch && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>Filtered to this course's category. Clear search to browse all.</div>
                  )}
                </div>
              ) : candidates.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid #f8fafc" }}>
                  {/* Thumb/icon */}
                  {addType === "VIDEO" || addType === "LIVE_CLASS" ? (
                    <div style={{ width: 48, height: 32, borderRadius: "5px", background: c.thumbnailUrl ? `url(${c.thumbnailUrl}) center/cover` : ITEM_CFG[addType].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem" }}>
                      {!c.thumbnailUrl && ITEM_CFG[addType]?.icon}
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "8px", background: ITEM_CFG[addType]?.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>
                      {ITEM_CFG[addType]?.icon}
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                      {addType === "VIDEO" && fmtDur(c.durationSeconds) && <span>{fmtDur(c.durationSeconds)} · </span>}
                      {addType === "LIVE_CLASS" && c.sessionDate && <span>{fmtDate(c.sessionDate)} · </span>}
                      {addType === "FLASHCARD_DECK" && c._count && <span>{c._count.cards} cards · </span>}
                      <span style={{ color: (c.status === "PUBLISHED" || c.isPublished) ? "#15803d" : "#94a3b8", fontWeight: 600 }}>
                        {c.status || (c.isPublished ? "Published" : "Draft")}
                      </span>
                    </div>
                  </div>

                  {/* Add button */}
                  <button onClick={() => handleAddItem(c)} disabled={!!addingId}
                    style={{ padding: "0.3125rem 0.875rem", borderRadius: "6px", border: `1px solid ${ITEM_CFG[addType]?.color}`, background: addingId === c.id ? ITEM_CFG[addType]?.bg : "#fff", color: ITEM_CFG[addType]?.color, cursor: addingId ? "not-allowed" : "pointer", fontSize: "0.8125rem", fontWeight: 700, flexShrink: 0 }}>
                    {addingId === c.id ? "Adding…" : "+ Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Link href="/admin/courses" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Courses</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <span style={{ fontWeight: 700, fontSize: "1.0625rem", color: "#0f172a" }}>{course.name}</span>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Content Builder</span>
        </div>
        <Link href={`/admin/courses`} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>
          ↗ Edit Course
        </Link>
      </div>

      {/* ── Split panel layout ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr", gap: "1rem", minHeight: 0 }}>

        {/* ── LEFT: Folder tree ─────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,.07)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tree header */}
          <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Folders</span>
            <button onClick={() => { setFolderTitle(""); setFolderModal({ mode: "create", parentId: null }); }} title="New root folder"
              style={{ width: 22, height: 22, borderRadius: "5px", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: "0.875rem", fontWeight: 700, color: "#64748b" }}>+</button>
          </div>

          {/* Root entry */}
          <button onClick={() => setSelectedFolderId(null)} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", border: "none", borderLeft: `3px solid ${selectedFolderId === null ? PURPLE : "transparent"}`, background: selectedFolderId === null ? "#ede9fe" : "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}>
            <span style={{ fontSize: "0.875rem" }}>🏠</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: selectedFolderId === null ? 700 : 500, color: selectedFolderId === null ? PURPLE : "#374151" }}>Course Root</span>
          </button>

          {/* Folder tree */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {rootFolders.map(f => (
              <FolderNode key={f.id} folder={f} depth={0} allFolders={folders}
                selectedId={selectedFolderId} expandedIds={expandedIds}
                onSelect={id => setSelectedFolderId(id)}
                onToggle={id => setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                onAddSub={parentId => { setFolderTitle(""); setFolderModal({ mode: "create", parentId }); setExpandedIds(prev => prev.includes(parentId) ? prev : [...prev, parentId]); }}
                onRename={folder => { setFolderTitle(folder.title); setFolderModal({ mode: "rename", target: folder }); }}
                onDelete={folder => setDeleteConfirm({ type: "folder", id: folder.id, title: folder.title })}
              />
            ))}
          </div>

          {/* Counts */}
          <div style={{ padding: "0.625rem 1rem", borderTop: "1px solid #f1f5f9", fontSize: "0.75rem", color: "#94a3b8" }}>
            {folders.length} folder{folders.length !== 1 ? "s" : ""} · {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* ── RIGHT: Content panel ───────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,.07)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Toolbar */}
          <div style={{ padding: "0.875rem 1.125rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: "1 1 auto", minWidth: 0 }}>
              <button onClick={() => setSelectedFolderId(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", color: selectedFolderId ? "#64748b" : "#0f172a", fontWeight: selectedFolderId ? 400 : 700, padding: "0.125rem 0" }}>Root</button>
              {breadcrumb.map((b, i) => (
                <span key={b.id} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <span style={{ color: "#e2e8f0" }}>›</span>
                  <button onClick={() => setSelectedFolderId(b.id)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", color: i === breadcrumb.length - 1 ? "#0f172a" : "#64748b", fontWeight: i === breadcrumb.length - 1 ? 700 : 400, padding: "0.125rem 0" }}>
                    {b.title}
                  </button>
                </span>
              ))}
            </div>

            {/* Add subfolder button */}
            <button onClick={() => { setFolderTitle(""); setFolderModal({ mode: "create", parentId: selectedFolderId }); }}
              style={{ padding: "0.375rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
              📁 Add Folder
            </button>

            {/* Add content buttons (conditional) */}
            {addButtons.map(btn => (
              <button key={btn.type} onClick={() => setAddType(btn.type)}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: `1px solid ${btn.color}33`, background: btn.bg, color: btn.color, cursor: "pointer", fontSize: "0.8125rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                {btn.icon} {btn.label}
              </button>
            ))}

            {/* Coming soon: HTML, Test Series */}
            {course.hasHtmlCourse && (
              <button disabled title="Coming soon" style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "not-allowed", fontSize: "0.8125rem", fontWeight: 600 }}>
                🌐 Add HTML <span style={{ fontSize: "0.65rem" }}>(soon)</span>
              </button>
            )}
            {course.hasTestSeries && (
              <button disabled title="Coming soon" style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8", cursor: "not-allowed", fontSize: "0.8125rem", fontWeight: 600 }}>
                📝 Add Tests <span style={{ fontSize: "0.65rem" }}>(soon)</span>
              </button>
            )}

            {/* Reorder save */}
            {dirty && (
              <button onClick={saveOrder} disabled={saving}
                style={{ padding: "0.375rem 1rem", borderRadius: "6px", border: "none", background: "#15803d", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.8125rem", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "💾 Save Order"}
              </button>
            )}
          </div>

          {/* Content list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {localEntries.length === 0 ? (
              <div style={{ padding: "5rem 2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📂</div>
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "#475569", marginBottom: "0.5rem" }}>
                  {selectedFolderId ? "This folder is empty" : "No content yet"}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
                  Use the buttons above to add folders or content items.
                </div>
              </div>
            ) : localEntries.map((entry, idx) => {
              if (entry.entryType === "folder") {
                const f = entry.folder!;
                const childCount = folders.filter(x => x.parentId === f.id).length + items.filter(x => x.folderId === f.id).length;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.125rem", borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                    {/* Order controls */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1px", flexShrink: 0 }}>
                      <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0} style={{ width: 22, height: 18, border: "1px solid #e2e8f0", borderRadius: "3px", background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                      <button onClick={() => moveEntry(idx, 1)} disabled={idx === localEntries.length - 1} style={{ width: 22, height: 18, border: "1px solid #e2e8f0", borderRadius: "3px", background: "#fff", cursor: idx === localEntries.length - 1 ? "not-allowed" : "pointer", opacity: idx === localEntries.length - 1 ? 0.3 : 1, fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                    </div>

                    {/* Folder icon */}
                    <span style={{ fontSize: "1.25rem", flexShrink: 0 }}>📁</span>

                    {/* Folder info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button onClick={() => { setSelectedFolderId(f.id); setExpandedIds(prev => prev.includes(f.id) ? prev : [...prev, f.id]); }}
                        style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", padding: 0, textAlign: "left" }}>
                        {f.title} →
                      </button>
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                        {childCount} item{childCount !== 1 ? "s" : ""} inside
                        {f.description && <span style={{ marginLeft: "0.5rem" }}>· {f.description}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                      <button onClick={() => { setFolderTitle(""); setFolderModal({ mode: "create", parentId: f.id }); setExpandedIds(prev => prev.includes(f.id) ? prev : [...prev, f.id]); }}
                        title="Add subfolder" style={{ width: 28, height: 28, borderRadius: "5px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.75rem", color: "#64748b" }}>📁+</button>
                      <button onClick={() => { setFolderTitle(f.title); setFolderModal({ mode: "rename", target: f }); }}
                        title="Rename" style={{ width: 28, height: 28, borderRadius: "5px", border: `1px solid ${PURPLE}33`, background: "#fff", cursor: "pointer", fontSize: "0.75rem", color: PURPLE }}>✎</button>
                      <button onClick={() => setDeleteConfirm({ type: "folder", id: f.id, title: f.title })}
                        title="Delete" style={{ width: 28, height: 28, borderRadius: "5px", border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "#dc2626", fontWeight: 700 }}>×</button>
                    </div>
                  </div>
                );
              }

              // Content item
              const item = entry.item!;
              const cfg  = ITEM_CFG[item.itemType] ?? ITEM_CFG.VIDEO;
              const displayTitle = item.resolvedTitle || item.titleSnapshot || "Untitled";

              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.125rem", borderBottom: "1px solid #f1f5f9", background: item.sourceMissing ? "#fff8f8" : "transparent" }}
                  onMouseEnter={e => { if (!item.sourceMissing) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = item.sourceMissing ? "#fff8f8" : "transparent"; }}>
                  {/* Order controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", flexShrink: 0 }}>
                    <button onClick={() => moveEntry(idx, -1)} disabled={idx === 0} style={{ width: 22, height: 18, border: "1px solid #e2e8f0", borderRadius: "3px", background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                    <button onClick={() => moveEntry(idx, 1)} disabled={idx === localEntries.length - 1} style={{ width: 22, height: 18, border: "1px solid #e2e8f0", borderRadius: "3px", background: "#fff", cursor: idx === localEntries.length - 1 ? "not-allowed" : "pointer", opacity: idx === localEntries.length - 1 ? 0.3 : 1, fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                  </div>

                  {/* Type badge */}
                  <span style={{ padding: "2px 7px", borderRadius: "10px", fontSize: "0.6875rem", fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                    {cfg.icon} {cfg.short}
                  </span>

                  {/* Thumbnail */}
                  {(item.itemType === "VIDEO" || item.itemType === "LIVE_CLASS") ? (
                    <div style={{ width: 52, height: 34, borderRadius: "5px", background: item.thumbnailUrl ? `url(${item.thumbnailUrl}) center/cover` : cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1rem" }}>
                      {!item.thumbnailUrl && cfg.icon}
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: "8px", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>{cfg.icon}</div>
                  )}

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: item.sourceMissing ? "#dc2626" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayTitle}
                      {item.sourceMissing && <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "#dc2626", fontWeight: 700 }}>SOURCE DELETED</span>}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.125rem", display: "flex", gap: "0.5rem" }}>
                      {item.itemType === "VIDEO" && fmtDur(item.durationSeconds) && <span>{fmtDur(item.durationSeconds)}</span>}
                      {item.itemType === "LIVE_CLASS" && item.sessionDate && <span>{fmtDate(item.sessionDate)}</span>}
                      {item.itemType === "FLASHCARD_DECK" && item.cardCount !== undefined && <span>{item.cardCount} cards</span>}
                      {item.status && <span style={{ color: item.status === "PUBLISHED" ? "#15803d" : "#94a3b8", fontWeight: 600 }}>{item.status}</span>}
                      {item.isPublished !== undefined && item.itemType !== "VIDEO" && item.itemType !== "LIVE_CLASS" && (
                        <span style={{ color: item.isPublished ? "#15803d" : "#94a3b8", fontWeight: 600 }}>{item.isPublished ? "Published" : "Draft"}</span>
                      )}
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => setDeleteConfirm({ type: "item", id: item.id, title: displayTitle })}
                    title="Remove from course"
                    style={{ width: 28, height: 28, borderRadius: "5px", border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "#dc2626", fontWeight: 700, flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>

          {/* Dirty save bar */}
          {dirty && (
            <div style={{ padding: "0.75rem 1.125rem", borderTop: "1px solid #fde68a", background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8125rem", color: "#92400e" }}>Unsaved order changes</span>
              <button onClick={saveOrder} disabled={saving} style={{ padding: "0.375rem 1rem", borderRadius: "6px", border: "none", background: "#15803d", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8125rem" }}>
                {saving ? "Saving…" : "Save Order"}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .folder-actions { opacity: 0 !important; }
        div:hover > .folder-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
