"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

// ─── Product Category ─────────────────────────────────────────────────────────
const PRODUCT_CATEGORY_OPTIONS = [
  { value: "FREE_DEMO",          label: "Free (Demo) Courses and Tests",  color: "#15803d", bg: "#dcfce7" },
  { value: "COMPLETE_PREP_PACK", label: "Complete Prep Packs",            color: "#7c3aed", bg: "#f3e8ff" },
  { value: "VIDEO_ONLY",         label: "Video Only Courses",             color: "#0284c7", bg: "#e0f2fe" },
  { value: "SELF_PREP",          label: "Self Prep Courses",              color: "#b45309", bg: "#fef3c7" },
  { value: "PDF_ONLY",           label: "PDF Courses",                    color: "#c2410c", bg: "#fff7ed" },
  { value: "TEST_SERIES",        label: "Test Series",                    color: "#0f766e", bg: "#ccfbf1" },
  { value: "FLASHCARDS_ONLY",    label: "Flash Cards",                    color: "#9333ea", bg: "#faf5ff" },
  { value: "CURRENT_AFFAIRS",    label: "Current Affairs",               color: "#1d4ed8", bg: "#dbeafe" },
] as const;

function getProductCategoryMeta(value: string | null | undefined) {
  return PRODUCT_CATEGORY_OPTIONS.find(o => o.value === value) ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductTypes = {
  hasHtmlCourse:     boolean;
  hasVideoCourse:    boolean;
  hasPdfCourse:      boolean;
  hasTestSeries:     boolean;
  hasFlashcardDecks: boolean;
};

type CourseType = "STANDARD" | "PACKAGE";

type Course = ProductTypes & {
  id: string; name: string; description: string | null;
  courseType: CourseType; isActive: boolean; featured: boolean; createdAt: string;
  thumbnailUrl?: string | null;
  productCategory?: string | null;
  xpRedemptionEnabled?: boolean;
  xpRedemptionMaxPercent?: number;
  _count?: { videos: number; liveClasses: number };
};

type FormData = {
  name: string; description: string; courseType: CourseType;
  productCategory: string;
  isActive: boolean; featured: boolean; thumbnailUrl: string;
  xpRedemptionEnabled: boolean;
  xpRedemptionMaxPercent: number;
} & ProductTypes;

// ─── Product type config ──────────────────────────────────────────────────────
const TYPE_CONFIG = [
  { key: "hasHtmlCourse"     as const, label: "E-Book Course",  short: "E-Book", bg: "#dbeafe", color: "#1d4ed8" },
  { key: "hasVideoCourse"    as const, label: "Video Course",   short: "Video",  bg: "#f3e8ff", color: PURPLE    },
  { key: "hasPdfCourse"      as const, label: "PDF Course",     short: "PDF",    bg: "#fef3c7", color: "#b45309" },
  { key: "hasTestSeries"     as const, label: "Test Series",    short: "Tests",  bg: "#dcfce7", color: "#15803d" },
  { key: "hasFlashcardDecks" as const, label: "Flashcard Decks",short: "Flash",  bg: "#fce7f3", color: "#9d174d" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const defaultForm = (): FormData => ({
  name: "", description: "", courseType: "STANDARD", productCategory: "", isActive: true, featured: false, thumbnailUrl: "",
  hasHtmlCourse: false, hasVideoCourse: false, hasPdfCourse: false, hasTestSeries: false, hasFlashcardDecks: false,
  xpRedemptionEnabled: false, xpRedemptionMaxPercent: 1,
});

function courseToForm(c: Course): FormData {
  return {
    name: c.name, description: c.description || "", courseType: c.courseType || "STANDARD",
    productCategory: c.productCategory || "",
    isActive: c.isActive,
    featured: c.featured ?? false,
    thumbnailUrl: c.thumbnailUrl || "",
    hasHtmlCourse: c.hasHtmlCourse, hasVideoCourse: c.hasVideoCourse,
    hasPdfCourse: c.hasPdfCourse, hasTestSeries: c.hasTestSeries,
    hasFlashcardDecks: c.hasFlashcardDecks,
    xpRedemptionEnabled: c.xpRedemptionEnabled || false,
    xpRedemptionMaxPercent: c.xpRedemptionMaxPercent || 1,
  };
}

function hasAnyType(f: FormData | ProductTypes) {
  return f.hasHtmlCourse || f.hasVideoCourse || f.hasPdfCourse || f.hasTestSeries || f.hasFlashcardDecks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypeBadges({ course }: { course: ProductTypes }) {
  const active = TYPE_CONFIG.filter(t => course[t.key]);
  if (active.length === 0) return <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>None</span>;
  return (
    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
      {active.map(t => (
        <span key={t.key} style={{ padding: "2px 7px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 700, background: t.bg, color: t.color, whiteSpace: "nowrap" }}>
          {t.short}
        </span>
      ))}
    </div>
  );
}

const inputSt: React.CSSProperties = { width: "100%", padding: "0.4375rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff", boxSizing: "border-box" };
const labelSt: React.CSSProperties = { fontSize: "0.8125rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.25rem" };

// ─── Course form (shared for create + edit) ───────────────────────────────────
function CourseForm({ form, onChange, error, isEdit }: {
  form: FormData;
  onChange: (f: FormData) => void;
  error: string | null;
  isEdit?: boolean;
}) {
  const set = (patch: Partial<FormData>) => onChange({ ...form, ...patch });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "0.625rem 0.875rem", fontSize: "0.875rem", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* Course type selector */}
      <div>
        <label style={{ ...labelSt, marginBottom: "0.5rem" }}>Course Type <span style={{ color: "#dc2626" }}>*</span></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {([
            { value: "STANDARD" as const, label: "Standard Course", desc: "Own folders & content", icon: "📘", bg: "#f0f9ff", color: "#0369a1" },
            { value: "PACKAGE"  as const, label: "Package / Combo",  desc: "Imports existing courses", icon: "📦", bg: "#fefce8", color: "#92400e" },
          ]).map(opt => {
            const active = form.courseType === opt.value;
            return (
              <label key={opt.value} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", padding: "0.75rem", borderRadius: "8px", border: `2px solid ${active ? opt.color : "#e2e8f0"}`, background: active ? opt.bg : "#f8fafc", cursor: "pointer", userSelect: "none", transition: "border-color 0.15s" }}>
                <input type="radio" name="courseType" value={opt.value} checked={active} onChange={() => set({ courseType: opt.value })} style={{ accentColor: opt.color, marginTop: "2px" }} />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: active ? 700 : 500, color: active ? opt.color : "#374151" }}>{opt.icon} {opt.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>{opt.desc}</div>
                </div>
              </label>
            );
          })}
        </div>
        {isEdit && (
          <div style={{ marginTop: "0.375rem", fontSize: "0.75rem", color: "#92400e", background: "#fefce8", borderRadius: "5px", padding: "0.375rem 0.625rem" }}>
            ⚠️ Changing course type on an existing course is blocked if it already has content or package mappings.
          </div>
        )}
      </div>

      <div>
        <label style={labelSt}>Course Name <span style={{ color: "#dc2626" }}>*</span></label>
        <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. NEET 2026 Foundation" style={inputSt} />
      </div>

      <div>
        <label style={labelSt}>Description</label>
        <textarea value={form.description} onChange={e => set({ description: e.target.value })} rows={3}
          placeholder="Optional short description…"
          style={{ ...inputSt, resize: "vertical", lineHeight: 1.5 }} />
      </div>

      {/* Product Category */}
      <div>
        <label style={labelSt}>
          Product Category
          <span style={{ marginLeft: "0.5rem", fontSize: "0.73rem", fontWeight: 400, color: "#94a3b8" }}>Controls where this course appears in the student app</span>
        </label>
        <select
          value={form.productCategory}
          onChange={e => set({ productCategory: e.target.value })}
          style={{ ...inputSt, cursor: "pointer" }}
        >
          <option value="">— Not set —</option>
          {PRODUCT_CATEGORY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {form.productCategory && (() => {
          const meta = getProductCategoryMeta(form.productCategory);
          return meta ? (
            <div style={{ marginTop: "0.375rem", display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "3px 10px", borderRadius: "12px", background: meta.bg, color: meta.color, fontSize: "0.75rem", fontWeight: 700 }}>
              {meta.label}
            </div>
          ) : null;
        })()}
      </div>

      <div>
        <label style={labelSt}>Thumbnail URL</label>
        <input
          value={form.thumbnailUrl}
          onChange={e => set({ thumbnailUrl: e.target.value })}
          placeholder="https://..."
          style={inputSt}
        />
        {form.thumbnailUrl && (
          <div style={{ marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <img src={form.thumbnailUrl} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <button type="button" onClick={() => set({ thumbnailUrl: "" })} style={{ fontSize: "0.75rem", color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
          </div>
        )}
      </div>

      {/* Product type checkboxes */}
      <div>
        <label style={{ ...labelSt, marginBottom: "0.5rem" }}>
          Product Types <span style={{ color: "#dc2626" }}>*</span>
          <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 400, color: "#94a3b8" }}>(select at least one)</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          {TYPE_CONFIG.map(t => {
            const checked = form[t.key];
            return (
              <label key={t.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 0.875rem", borderRadius: "8px", border: `2px solid ${checked ? t.color : "#e2e8f0"}`, background: checked ? t.bg : "#f8fafc", cursor: "pointer", userSelect: "none", transition: "border-color 0.15s, background 0.15s" }}>
                <input type="checkbox" checked={checked} onChange={e => set({ [t.key]: e.target.checked } as any)} style={{ width: 16, height: 16, accentColor: t.color, cursor: "pointer" }} />
                <span style={{ fontSize: "0.8125rem", fontWeight: checked ? 700 : 500, color: checked ? t.color : "#374151" }}>{t.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" checked={form.isActive} onChange={e => set({ isActive: e.target.checked })} style={{ width: 16, height: 16, accentColor: PURPLE }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#374151" }}>Active (visible in dropdowns)</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", padding: "0.25rem 0.75rem", borderRadius: "8px", background: form.featured ? "#fefce8" : "#f8fafc", border: `2px solid ${form.featured ? "#d97706" : "#e2e8f0"}`, transition: "border-color 0.15s, background 0.15s" }}>
          <input type="checkbox" checked={form.featured} onChange={e => set({ featured: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#d97706" }} />
          <span style={{ fontSize: "0.875rem", fontWeight: form.featured ? 700 : 500, color: form.featured ? "#92400e" : "#374151" }}>⭐ Featured</span>
          <span style={{ fontSize: "0.72rem", color: "#b45309", marginLeft: "0.25rem" }}>shows in homepage featured section</span>
        </label>
      </div>

      {/* XP Redemption */}
      <div style={{ padding: "0.875rem", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: form.xpRedemptionEnabled ? "0.75rem" : 0 }}>
          <input type="checkbox" checked={form.xpRedemptionEnabled} onChange={e => set({ xpRedemptionEnabled: e.target.checked })} style={{ width: 16, height: 16, accentColor: "#0369a1" }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0369a1" }}>XP Redemption Enabled</span>
        </label>
        {form.xpRedemptionEnabled && (
          <div>
            <label style={{ ...labelSt, color: "#0369a1" }}>Max discount via XP (1–3% of course price)</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {[1, 2, 3].map(pct => (
                <label key={pct} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.375rem 0.75rem", borderRadius: "6px", border: `2px solid ${form.xpRedemptionMaxPercent === pct ? "#0369a1" : "#e2e8f0"}`, background: form.xpRedemptionMaxPercent === pct ? "#e0f2fe" : "#f8fafc", cursor: "pointer", fontSize: "0.8125rem", fontWeight: form.xpRedemptionMaxPercent === pct ? 700 : 400 }}>
                  <input type="radio" checked={form.xpRedemptionMaxPercent === pct} onChange={() => set({ xpRedemptionMaxPercent: pct })} style={{ accentColor: "#0369a1" }} />
                  {pct}%
                </label>
              ))}
            </div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#64748b" }}>
              Students with ≥25,000 lifetime XP can redeem up to {form.xpRedemptionMaxPercent}% of the course price. Rate: 100 XP = ₹1.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const [courses,  setCourses]  = useState<Course[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Course | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Active filter
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  const pageSize = 20;

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search });
    if (activeFilter) p.set("isActive", activeFilter);
    const res  = await fetch(`/api/courses?${p}`);
    const json = await res.json();
    setCourses(json.data || []);
    setTotal(json.pagination?.total || 0);
    setLoading(false);
  }, [page, search, activeFilter]);

  useEffect(() => { load(); }, [load]);

  // ─── Create ──────────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(defaultForm());
    setFormError(null);
    setEditTarget(null);
    setModalMode("create");
  }

  // ─── Edit ────────────────────────────────────────────────────────────────────
  function openEdit(course: Course) {
    setForm(courseToForm(course));
    setFormError(null);
    setEditTarget(course);
    setModalMode("edit");
  }

  // ─── Save (create or edit) ────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { setFormError("Course name is required"); return; }
    if (!hasAnyType(form)) { setFormError("Select at least one product type"); return; }
    setSaving(true); setFormError(null);

    const isEdit = modalMode === "edit" && editTarget;
    const url    = isEdit ? `/api/courses/${editTarget!.id}` : "/api/courses";
    const method = isEdit ? "PUT" : "POST";

    const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) { setFormError(json.error || "Failed to save"); return; }

    setModalMode(null);
    showToast(isEdit ? "Course updated" : "Course created");
    load();
  }

  // ─── Toggle active ────────────────────────────────────────────────────────────
  async function handleToggleActive(course: Course) {
    const res  = await fetch(`/api/courses/${course.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !course.isActive }) });
    const json = await res.json();
    if (res.ok) { showToast(`Course ${json.data.isActive ? "activated" : "deactivated"}`); load(); }
    else showToast(json.error || "Failed to update", false);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    const res  = await fetch(`/api/courses/${confirmDeleteId}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    if (res.ok) { setConfirmDeleteId(null); showToast("Course deleted"); load(); }
    else showToast(json.error || "Failed to delete", false);
  }

  const totalPages = Math.ceil(total / pageSize);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Create/Edit modal ────────────────────────────────────────────────── */}
      {modalMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a" }}>
                {modalMode === "create" ? "New Course" : `Edit: ${editTarget?.name}`}
              </h2>
              <button onClick={() => setModalMode(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1.125rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>×</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <CourseForm form={form} onChange={setForm} error={formError} isEdit={modalMode === "edit"} />
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
              <button onClick={() => setModalMode(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.875rem", color: "#374151", fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : modalMode === "create" ? "Create Course" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 420, padding: "2rem", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🗑️</div>
            <div style={{ fontWeight: 700, fontSize: "1.0625rem", marginBottom: "0.5rem", color: "#0f172a" }}>Delete this course?</div>
            <div style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
              This will permanently delete the course and unlink all associated videos and live classes.
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "none", background: "#dc2626", color: "#fff", cursor: deleting ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.875rem", opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Courses</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
            Define courses and their product type mix — Videos, HTML, PDF, Test Series, or any combination.
          </p>
        </div>
        <button onClick={openCreate} style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", border: "none", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer" }}>
          + New Course
        </button>
      </div>

      {/* ── Product type legend ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {TYPE_CONFIG.map(t => (
          <span key={t.key} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: t.bg, color: t.color }}>
            {t.label}
          </span>
        ))}
        <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "flex", alignItems: "center", marginLeft: "0.25rem" }}>— product type badges</span>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search courses…"
          style={{ flex: "1 1 200px", padding: "0.4375rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", minWidth: 160 }}
        />
        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value as any); setPage(1); }} style={{ padding: "0.4375rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff" }}>
          <option value="">All statuses</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["", "Course Name", "Type", "Product Types", "Videos", "Live Classes", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ height: 16, borderRadius: 4, background: `linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", width: j === 0 ? "60%" : j === 1 ? "80%" : "40%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
                  {search ? `No courses matching "${search}"` : "No courses yet. Create the first one."}
                </td>
              </tr>
            ) : courses.map(course => (
              <tr key={course.id} style={{ transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", width: 48 }}>
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", display: "block" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem" }}>📘</div>
                  )}
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{course.name}</span>
                    {course.featured && (
                      <span title="Featured" style={{ display: "inline-flex", alignItems: "center", gap: "2px", padding: "1px 6px", borderRadius: "8px", background: "#fefce8", color: "#92400e", fontSize: "0.68rem", fontWeight: 700, border: "1px solid #fde68a", flexShrink: 0 }}>⭐ Featured</span>
                    )}
                  </div>
                  {course.description && <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{course.description}</div>}
                  {(() => {
                    const meta = getProductCategoryMeta(course.productCategory);
                    return meta ? (
                      <span style={{ display: "inline-flex", alignItems: "center", marginTop: "0.25rem", padding: "1px 7px", borderRadius: "10px", background: meta.bg, color: meta.color, fontSize: "0.68rem", fontWeight: 700 }}>
                        {meta.label}
                      </span>
                    ) : null;
                  })()}
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  {course.courseType === "PACKAGE" ? (
                    <span style={{ padding: "2px 9px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 700, background: "#fefce8", color: "#92400e", whiteSpace: "nowrap" }}>📦 Package</span>
                  ) : (
                    <span style={{ padding: "2px 9px", borderRadius: "10px", fontSize: "0.7rem", fontWeight: 700, background: "#f0f9ff", color: "#0369a1", whiteSpace: "nowrap" }}>📘 Standard</span>
                  )}
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <TypeBadges course={course} />
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#475569" }}>
                  {course._count ? (
                    <Link href={`/admin/videos?courseId=${course.id}`} style={{ color: PURPLE, textDecoration: "none", fontWeight: 600 }}>{course._count.videos}</Link>
                  ) : "—"}
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#475569" }}>
                  {course._count?.liveClasses ?? "—"}
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <button onClick={() => handleToggleActive(course)} style={{ padding: "2px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, border: "none", cursor: "pointer", background: course.isActive ? "#dcfce7" : "#f1f5f9", color: course.isActive ? "#15803d" : "#64748b" }}>
                    {course.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                    {course.courseType === "PACKAGE" ? (
                      <Link href={`/admin/courses/${course.id}/package`} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #92400e", color: "#92400e", background: "#fefce8", textDecoration: "none", fontSize: "0.8125rem", fontWeight: 700, whiteSpace: "nowrap" }}>📦 Package</Link>
                    ) : (
                      <><Link href={`/admin/courses/${course.id}/content`} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #0369a1", color: "#0369a1", background: "#f0f9ff", textDecoration: "none", fontSize: "0.8125rem", fontWeight: 700, whiteSpace: "nowrap" }}>📂 Content</Link>
                      <Link href={`/admin/courses/${course.id}/curriculum`} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #7c3aed", color: "#7c3aed", background: "#f5f3ff", textDecoration: "none", fontSize: "0.8125rem", fontWeight: 700, whiteSpace: "nowrap" }}>📚 Curriculum</Link></>
                    )}
                    <button onClick={() => openEdit(course)} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Edit</button>
                    <button onClick={() => setConfirmDeleteId(course.id)} style={{ padding: "0.25rem 0.625rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Pagination ────────────────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1rem", borderTop: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
              {total} course{total !== 1 ? "s" : ""} · page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: "0.375rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.3125rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1, fontSize: "0.8125rem" }}>← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "0.3125rem 0.75rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1, fontSize: "0.8125rem" }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}
