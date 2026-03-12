"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const PURPLE = "#7c3aed";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProductFlags = { hasHtmlCourse: boolean; hasVideoCourse: boolean; hasPdfCourse: boolean; hasTestSeries: boolean };
type CourseRef = ProductFlags & { id: string; name: string; description: string | null; categoryId: string | null; courseType: string; isActive: boolean; _count?: { videos: number; liveClasses: number } };
type PackageItem = { id: string; packageCourseId: string; childCourseId: string; sortOrder: number; childCourse: CourseRef | null };

// ─── Product type config ──────────────────────────────────────────────────────
const TYPE_CFG = [
  { key: "hasHtmlCourse"   as const, short: "HTML",  bg: "#dbeafe", color: "#1d4ed8" },
  { key: "hasVideoCourse"  as const, short: "Video", bg: "#f3e8ff", color: PURPLE    },
  { key: "hasPdfCourse"    as const, short: "PDF",   bg: "#fef3c7", color: "#b45309" },
  { key: "hasTestSeries"   as const, short: "Tests", bg: "#dcfce7", color: "#15803d" },
];

const inputSt: React.CSSProperties = { width: "100%", padding: "0.4375rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.8125rem", outline: "none", background: "#fff", boxSizing: "border-box" };

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProductBadges({ course }: { course: ProductFlags }) {
  const active = TYPE_CFG.filter(t => course[t.key]);
  if (active.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
      {active.map(t => (
        <span key={t.key} style={{ padding: "2px 7px", borderRadius: "10px", fontSize: "0.6875rem", fontWeight: 700, background: t.bg, color: t.color }}>
          {t.short}
        </span>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function PackageBuilderPage() {
  const { id: courseId } = useParams<{ id: string }>();

  const [course,    setCourse]    = useState<CourseRef | null>(null);
  const [items,     setItems]     = useState<PackageItem[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Reorder state
  const [localItems,  setLocalItems]  = useState<PackageItem[]>([]);
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Import dialog
  const [showImport,    setShowImport]    = useState(false);
  const [importSearch,  setImportSearch]  = useState("");
  const [candidates,    setCandidates]    = useState<CourseRef[]>([]);
  const [candLoading,   setCandLoading]   = useState(false);
  const [addingId,      setAddingId]      = useState<string | null>(null);
  const [incInactive,   setIncInactive]   = useState(false);
  const [ptFilter,      setPtFilter]      = useState({ hasVideoCourse: false, hasPdfCourse: false, hasHtmlCourse: false, hasTestSeries: false });

  // Remove confirm
  const [removeConfirm, setRemoveConfirm] = useState<{ itemId: string; name: string } | null>(null);
  const [removing,      setRemoving]      = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  // ─── Load ─────────────────────────────────────────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/courses/${courseId}/package`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCourse(json.course);
      setItems(json.data || []);
    } catch (e: any) { showToast(e.message || "Failed to load", false); }
    setLoading(false);
  }, [courseId]);

  useEffect(() => { reload(); }, [reload]);

  // Sync local items when server items change
  useEffect(() => { setLocalItems(items); setDirty(false); }, [items]);

  // ─── Load candidates ──────────────────────────────────────────────────────────
  const fetchCandidates = useCallback(async () => {
    if (!showImport) return;
    setCandLoading(true); setCandidates([]);
    const p = new URLSearchParams({ search: importSearch });
    if (incInactive) p.set("includeInactive", "true");
    (Object.keys(ptFilter) as (keyof typeof ptFilter)[]).forEach(k => { if (ptFilter[k]) p.set(k, "true"); });
    const res  = await fetch(`/api/courses/${courseId}/package/candidates?${p}`);
    const json = await res.json();
    setCandidates(json.data || []);
    setCandLoading(false);
  }, [courseId, showImport, importSearch, incInactive, ptFilter]);

  useEffect(() => {
    const t = setTimeout(fetchCandidates, 250);
    return () => clearTimeout(t);
  }, [fetchCandidates]);

  // ─── Reorder ──────────────────────────────────────────────────────────────────
  function moveItem(idx: number, dir: -1 | 1) {
    const to = idx + dir;
    if (to < 0 || to >= localItems.length) return;
    const updated = [...localItems];
    [updated[idx], updated[to]] = [updated[to], updated[idx]];
    setLocalItems(updated);
    setDirty(true);
  }

  async function saveOrder() {
    setSaving(true);
    const res  = await fetch(`/api/courses/${courseId}/package/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: localItems.map(i => i.id) }),
    });
    const json = await res.json();
    setSaving(false);
    if (res.ok) { showToast("Order saved"); setDirty(false); reload(); }
    else showToast(json.error || "Failed to save order", false);
  }

  // ─── Import ───────────────────────────────────────────────────────────────────
  async function handleImport(candidate: CourseRef) {
    setAddingId(candidate.id);
    const res  = await fetch(`/api/courses/${courseId}/package`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childCourseId: candidate.id }),
    });
    const json = await res.json();
    setAddingId(null);
    if (res.ok) { showToast(`"${candidate.name}" imported`); reload(); fetchCandidates(); }
    else showToast(json.error || "Failed to import", false);
  }

  // ─── Remove ───────────────────────────────────────────────────────────────────
  async function handleRemove() {
    if (!removeConfirm) return;
    setRemoving(true);
    const res  = await fetch(`/api/courses/${courseId}/package/${removeConfirm.itemId}`, { method: "DELETE" });
    const json = await res.json();
    setRemoving(false);
    setRemoveConfirm(null);
    if (res.ok) { showToast("Course removed from package"); reload(); }
    else showToast(json.error || "Failed to remove", false);
  }

  // ─── Guards ───────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading package…</div>;

  if (!course) return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <div style={{ color: "#dc2626", fontWeight: 600 }}>Course not found.</div>
      <Link href="/admin/courses" style={{ color: PURPLE }}>← Back to Courses</Link>
    </div>
  );

  if (course.courseType !== "PACKAGE") return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⚠️</div>
      <div style={{ fontWeight: 700, marginBottom: "0.5rem" }}>This is a Standard course</div>
      <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>Only Package/Combo courses have a package builder. Standard courses use the Content Builder.</div>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
        <Link href={`/admin/courses/${courseId}/content`} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontWeight: 700 }}>Open Content Builder</Link>
        <Link href="/admin/courses" style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", color: "#374151", textDecoration: "none", fontWeight: 600 }}>← Courses</Link>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Remove confirm modal ───────────────────────────────────────────────── */}
      {removeConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", width: 420, padding: "2rem", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📦</div>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.5rem" }}>Remove from package?</div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              <strong>"{removeConfirm.name}"</strong> will be removed from this package. The original course is not affected.
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button onClick={() => setRemoveConfirm(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</button>
              <button onClick={handleRemove} disabled={removing} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "none", background: "#dc2626", color: "#fff", cursor: removing ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.875rem", opacity: removing ? 0.7 : 1 }}>
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import side panel ─────────────────────────────────────────────────── */}
      {showImport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 9000, display: "flex", alignItems: "stretch", justifyContent: "flex-end" }}>
          <div style={{ width: 540, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,.15)" }}>
            {/* Header */}
            <div style={{ padding: "1.125rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>📦 Import Existing Course</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                  Showing STANDARD courses
                  {course.categoryId && <span style={{ marginLeft: "0.5rem", padding: "1px 6px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", fontSize: "0.7rem" }}>📍 Same category</span>}
                </div>
              </div>
              <button onClick={() => { setShowImport(false); setImportSearch(""); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1rem" }}>×</button>
            </div>

            {/* Search + filters */}
            <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <input value={importSearch} onChange={e => setImportSearch(e.target.value)} placeholder="Search by course name…" style={{ ...inputSt }} autoFocus />

              {/* Product type filter pills */}
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {TYPE_CFG.map(t => {
                  const k = t.key as keyof typeof ptFilter;
                  const on = ptFilter[k as keyof typeof ptFilter];
                  return (
                    <button key={t.key} onClick={() => setPtFilter(prev => ({ ...prev, [k]: !prev[k as keyof typeof ptFilter] }))}
                      style={{ padding: "2px 10px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 700, border: `1.5px solid ${on ? t.color : "#e2e8f0"}`, background: on ? t.bg : "#fff", color: on ? t.color : "#94a3b8", cursor: "pointer", transition: "all 0.1s" }}>
                      {t.short}
                    </button>
                  );
                })}
                <button onClick={() => setIncInactive(prev => !prev)}
                  style={{ padding: "2px 10px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 700, border: `1.5px solid ${incInactive ? "#6d28d9" : "#e2e8f0"}`, background: incInactive ? "#ede9fe" : "#fff", color: incInactive ? "#6d28d9" : "#94a3b8", cursor: "pointer" }}>
                  Include inactive
                </button>
              </div>
            </div>

            {/* Candidate list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {candLoading ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
              ) : candidates.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                  {importSearch ? `No matches for "${importSearch}"` : "No importable courses found"}
                  {course.categoryId && !importSearch && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>Filtered to same category. All matching courses may already be imported.</div>
                  )}
                </div>
              ) : candidates.map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.875rem 1.25rem", borderBottom: "1px solid #f8fafc" }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}>
                  {/* Course icon */}
                  <div style={{ width: 36, height: 36, borderRadius: "8px", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", flexShrink: 0 }}>📘</div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ marginTop: "0.25rem" }}><ProductBadges course={c} /></div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem", display: "flex", gap: "0.5rem" }}>
                      {c._count && <span>{c._count.videos} videos · {c._count.liveClasses} live</span>}
                      <span style={{ color: c.isActive ? "#15803d" : "#94a3b8", fontWeight: 600 }}>{c.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </div>

                  {/* Add button */}
                  <button onClick={() => handleImport(c)} disabled={!!addingId}
                    style={{ padding: "0.3125rem 0.875rem", borderRadius: "6px", border: `1px solid ${PURPLE}`, background: addingId === c.id ? "#ede9fe" : "#fff", color: PURPLE, cursor: addingId ? "not-allowed" : "pointer", fontSize: "0.8125rem", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {addingId === c.id ? "Importing…" : "+ Import"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Link href="/admin/courses" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Courses</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <span style={{ fontWeight: 700, fontSize: "1.0625rem", color: "#0f172a" }}>{course.name}</span>
          <span style={{ padding: "2px 9px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 700, background: "#fde68a", color: "#92400e" }}>PACKAGE</span>
        </div>
        <Link href={`/admin/courses`} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>↗ Edit Course</Link>
      </div>

      {/* ── Course info banner ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "10px", background: "#fde68a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>📦</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>Package / Combo Course</div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Imports standard courses by reference — no content duplication</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ProductBadges course={course} />
          <span style={{ padding: "2px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, background: course.isActive ? "#dcfce7" : "#f1f5f9", color: course.isActive ? "#15803d" : "#64748b" }}>
            {course.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
        <div style={{ fontSize: "0.8125rem", color: "#64748b" }}>
          <strong style={{ color: "#0f172a" }}>{localItems.length}</strong> course{localItems.length !== 1 ? "s" : ""} in this package
        </div>
        <div style={{ display: "flex", gap: "0.625rem", alignItems: "center" }}>
          {dirty && (
            <button onClick={saveOrder} disabled={saving}
              style={{ padding: "0.4375rem 1rem", borderRadius: "7px", border: "none", background: "#15803d", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.8125rem", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "💾 Save Order"}
            </button>
          )}
          <button onClick={() => { setShowImport(true); setImportSearch(""); setPtFilter({ hasVideoCourse: false, hasPdfCourse: false, hasHtmlCourse: false, hasTestSeries: false }); }}
            style={{ padding: "0.4375rem 1.125rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.875rem" }}>
            + Import Existing Course
          </button>
        </div>
      </div>

      {/* ── Package items list ────────────────────────────────────────────────── */}
      {localItems.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "14px", padding: "5rem 2rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.5rem", color: "#0f172a" }}>No courses in this package yet</div>
          <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.75rem" }}>
            Use "Import Existing Course" to add standard courses to this combo package.
          </div>
          <button onClick={() => setShowImport(true)}
            style={{ padding: "0.625rem 1.5rem", borderRadius: "8px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.9375rem" }}>
            + Import Existing Course
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {localItems.map((item, idx) => {
            const child = item.childCourse;
            return (
              <div key={item.id} style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,.07)", display: "flex", alignItems: "center", gap: "0.875rem", padding: "0.875rem 1.125rem", border: !child ? "1.5px solid #fca5a5" : "1.5px solid transparent" }}>
                {/* Sequence number */}
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", flexShrink: 0 }}>
                  {idx + 1}
                </div>

                {/* Order controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
                  <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} title="Move up" style={{ width: 24, height: 20, border: "1px solid #e2e8f0", borderRadius: "3px", background: "#fff", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                  <button onClick={() => moveItem(idx, 1)} disabled={idx === localItems.length - 1} title="Move down" style={{ width: 24, height: 20, border: "1px solid #e2e8f0", borderRadius: "3px", background: "#fff", cursor: idx === localItems.length - 1 ? "not-allowed" : "pointer", opacity: idx === localItems.length - 1 ? 0.3 : 1, fontSize: "0.55rem", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                </div>

                {/* Course icon */}
                <div style={{ width: 44, height: 44, borderRadius: "10px", background: child ? "#ede9fe" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.375rem", flexShrink: 0 }}>
                  {child ? "📘" : "⚠️"}
                </div>

                {/* Course info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {child ? (
                    <>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{child.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem", flexWrap: "wrap" }}>
                        <ProductBadges course={child} />
                        <span style={{ padding: "2px 9px", borderRadius: "10px", fontSize: "0.65rem", fontWeight: 700, background: child.isActive ? "#dcfce7" : "#f1f5f9", color: child.isActive ? "#15803d" : "#64748b" }}>
                          {child.isActive ? "Active" : "Inactive"}
                        </span>
                        {child._count && (
                          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                            {child._count.videos} videos · {child._count.liveClasses} live
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, color: "#dc2626", fontSize: "0.875rem" }}>Source course deleted</div>
                      <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.125rem" }}>ID: {item.childCourseId}</div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0, alignItems: "center" }}>
                  {child && (
                    <Link href={`/admin/courses/${child.id}/content`} target="_blank" rel="noopener"
                      title="Open source course" style={{ padding: "0.3125rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#374151", textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>
                      ↗ Open
                    </Link>
                  )}
                  <button onClick={() => setRemoveConfirm({ itemId: item.id, name: child?.name ?? item.childCourseId })}
                    title="Remove from package"
                    style={{ width: 30, height: 30, borderRadius: "6px", border: "1px solid #fca5a5", background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "#dc2626", fontWeight: 700 }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dirty save bar ─────────────────────────────────────────────────────── */}
      {dirty && (
        <div style={{ marginTop: "1rem", padding: "0.875rem 1.25rem", borderRadius: "10px", background: "#fffbeb", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.8125rem", color: "#92400e" }}>You have unsaved order changes</span>
          <button onClick={saveOrder} disabled={saving} style={{ padding: "0.4375rem 1.125rem", borderRadius: "7px", border: "none", background: "#15803d", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8125rem" }}>
            {saving ? "Saving…" : "Save Order"}
          </button>
        </div>
      )}
    </div>
  );
}
