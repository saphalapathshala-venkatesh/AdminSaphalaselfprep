"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { parseRupees, validatePricing, calculateDiscount, formatRupee } from "@/lib/pricing";

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
  validityType?: string | null;
  validityDays?: number | null;
  validityMonths?: number | null;
  validUntil?: string | null;
  isFree?: boolean;
  mrp?: number | null;
  sellingPrice?: number | null;
  _count?: { videos: number; liveClasses: number };
};

type TaxOption = { id: string; name: string };
type ExamOption = { id: string; name: string; categoryId: string };

type LinkedItem = {
  rowId?: string;
  tempId: string;
  contentType: string;
  sourceId: string;
  title: string;
};

type PickerItem = {
  id: string;
  title: string;
  meta: Record<string, unknown>;
};

const LINKED_TYPE_CONFIG: Record<string, { label: string; short: string; bg: string; color: string; courseKey?: keyof ProductTypes }> = {
  TEST_SERIES:    { label: "Test Series",     short: "Tests",  bg: "#dcfce7", color: "#15803d", courseKey: "hasTestSeries"      },
  PDF:            { label: "PDF Course",       short: "PDF",    bg: "#fef3c7", color: "#b45309", courseKey: "hasPdfCourse"       },
  EBOOK:          { label: "E-Book Course",    short: "E-Book", bg: "#dbeafe", color: "#1d4ed8", courseKey: "hasHtmlCourse"      },
  VIDEO:          { label: "Video Course",     short: "Video",  bg: "#f3e8ff", color: "#7c3aed", courseKey: "hasVideoCourse"     },
  FLASHCARD_DECK: { label: "Flashcard Deck",   short: "Flash",  bg: "#fce7f3", color: "#9d174d", courseKey: "hasFlashcardDecks" },
  LIVE_CLASS:     { label: "Live Class",       short: "Live",   bg: "#e0f2fe", color: "#0284c7"                                  },
};

function linkedTypesForForm(form: ProductTypes): string[] {
  const out: string[] = [];
  if (form.hasTestSeries)     out.push("TEST_SERIES");
  if (form.hasPdfCourse)      out.push("PDF");
  if (form.hasHtmlCourse)     out.push("EBOOK");
  if (form.hasVideoCourse)    out.push("VIDEO");
  if (form.hasFlashcardDecks) out.push("FLASHCARD_DECK");
  // LIVE_CLASS has no course-type checkbox — always available
  out.push("LIVE_CLASS");
  return out;
}

type FormData = {
  name: string; description: string; courseType: CourseType;
  productCategory: string;
  categoryId: string; examId: string;
  isActive: boolean; featured: boolean; thumbnailUrl: string;
  xpRedemptionEnabled: boolean;
  xpRedemptionMaxPercent: number;
  validityType: string;
  validityDays: string;
  validityMonths: string;
  validUntil: string;
  isFree: boolean;
  mrpRupees: string;
  sellingPriceRupees: string;
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
  name: "", description: "", courseType: "STANDARD", productCategory: "",
  categoryId: "", examId: "",
  isActive: true, featured: false, thumbnailUrl: "",
  hasHtmlCourse: false, hasVideoCourse: false, hasPdfCourse: false, hasTestSeries: false, hasFlashcardDecks: false,
  xpRedemptionEnabled: false, xpRedemptionMaxPercent: 1,
  validityType: "", validityDays: "", validityMonths: "", validUntil: "",
  isFree: false, mrpRupees: "", sellingPriceRupees: "",
});

function courseToForm(c: Course & { categoryId?: string | null; examId?: string | null }): FormData {
  return {
    name: c.name, description: c.description || "", courseType: c.courseType || "STANDARD",
    productCategory: c.productCategory || "",
    categoryId: c.categoryId || "",
    examId: c.examId || "",
    isActive: c.isActive,
    featured: c.featured ?? false,
    thumbnailUrl: c.thumbnailUrl || "",
    hasHtmlCourse: c.hasHtmlCourse, hasVideoCourse: c.hasVideoCourse,
    hasPdfCourse: c.hasPdfCourse, hasTestSeries: c.hasTestSeries,
    hasFlashcardDecks: c.hasFlashcardDecks,
    xpRedemptionEnabled: c.xpRedemptionEnabled || false,
    xpRedemptionMaxPercent: c.xpRedemptionMaxPercent || 1,
    validityType: c.validityType || "",
    validityDays: c.validityDays != null ? String(c.validityDays) : "",
    validityMonths: c.validityMonths != null ? String(c.validityMonths) : "",
    validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
    isFree: c.isFree ?? false,
    mrpRupees: c.mrp != null ? String(Number(c.mrp)) : "",
    sellingPriceRupees: c.sellingPrice != null ? String(Number(c.sellingPrice)) : "",
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
function CourseForm({ form, onChange, error, isEdit, categories, exams, disabled }: {
  form: FormData;
  onChange: (f: FormData) => void;
  error: string | null;
  isEdit?: boolean;
  categories: TaxOption[];
  exams: ExamOption[];
  disabled?: boolean;
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

      {/* Category + Exam */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelSt}>Category</label>
          <select value={form.categoryId} onChange={e => set({ categoryId: e.target.value, examId: "" })} style={inputSt}>
            <option value="">— No Category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Exam <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.75rem" }}>(filtered by category)</span></label>
          <select value={form.examId} onChange={e => set({ examId: e.target.value })} style={inputSt}>
            <option value="">— No Exam —</option>
            {exams.filter(ex => !form.categoryId || ex.categoryId === form.categoryId).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
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
          type="url"
          value={form.thumbnailUrl || ""}
          onChange={e => set({ thumbnailUrl: e.target.value })}
          placeholder="https://example.com/course-thumbnail.jpg"
          disabled={disabled}
          style={inputSt}
        />
        {form.thumbnailUrl && (
          <div style={{ marginTop: "0.5rem", position: "relative", borderRadius: 10, overflow: "hidden", height: 120 }}>
            <img
              src={form.thumbnailUrl}
              alt="Thumbnail preview"
              style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0", display: "block" }}
              onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
            />
            <button
              type="button"
              onClick={() => set({ thumbnailUrl: "" })}
              disabled={disabled}
              style={{ position: "absolute", top: 6, right: 6, background: "rgba(220,38,38,0.85)", border: "none", color: "#fff", borderRadius: 5, padding: "3px 9px", fontSize: "0.72rem", fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer" }}
            >
              ✕ Clear
            </button>
          </div>
        )}
        <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", color: "#94a3b8" }}>
          Paste a direct image link (JPG, PNG, WebP). The preview updates automatically.
        </div>
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

      {/* Course Validity */}
      <div style={{ padding: "0.875rem", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
        <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#15803d", display: "block", marginBottom: "0.625rem" }}>
          Course Validity
          <span style={{ fontWeight: 400, color: "#64748b", marginLeft: "0.5rem", fontSize: "0.75rem" }}>Leave unset for unlimited access</span>
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.625rem" }}>
          {[
            { value: "",      label: "Unlimited" },
            { value: "days",  label: "Days" },
            { value: "months",label: "Months" },
            { value: "date",  label: "Fixed End Date" },
          ].map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.75rem", borderRadius: "6px", border: `2px solid ${form.validityType === opt.value ? "#15803d" : "#e2e8f0"}`, background: form.validityType === opt.value ? "#dcfce7" : "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: form.validityType === opt.value ? 700 : 400 }}>
              <input type="radio" name="validityType" checked={form.validityType === opt.value} onChange={() => set({ validityType: opt.value, validityDays: "", validityMonths: "", validUntil: "" })} style={{ accentColor: "#15803d" }} />
              {opt.label}
            </label>
          ))}
        </div>
        {form.validityType === "days" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="number" min="1" value={form.validityDays} onChange={e => set({ validityDays: e.target.value })} placeholder="e.g. 90" style={{ ...inputSt, width: "120px" }} />
            <span style={{ fontSize: "0.8125rem", color: "#15803d" }}>days from purchase date</span>
          </div>
        )}
        {form.validityType === "months" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="number" min="1" value={form.validityMonths} onChange={e => set({ validityMonths: e.target.value })} placeholder="e.g. 6" style={{ ...inputSt, width: "120px" }} />
            <span style={{ fontSize: "0.8125rem", color: "#15803d" }}>months from purchase date</span>
          </div>
        )}
        {form.validityType === "date" && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="date" value={form.validUntil} onChange={e => set({ validUntil: e.target.value })} style={{ ...inputSt, width: "180px" }} />
            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Fixed date — applies to all students regardless of purchase date</span>
          </div>
        )}
        {(form.validityType === "days" || form.validityType === "months") && (
          <div style={{ marginTop: "0.375rem", fontSize: "0.72rem", color: "#15803d", background: "#dcfce7", padding: "0.3rem 0.625rem", borderRadius: "5px" }}>
            ✓ Validity is calculated from each student's individual purchase date
          </div>
        )}
      </div>

      {/* Pricing */}
      <div style={{ padding: "0.875rem", background: "#faf5ff", borderRadius: "8px", border: "1px solid #ddd6fe" }}>
        <label style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#6d28d9", display: "block", marginBottom: "0.625rem" }}>Pricing</label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", marginBottom: "0.75rem" }}>
          <input type="checkbox" checked={form.isFree} onChange={e => set({ isFree: e.target.checked, mrpRupees: "", sellingPriceRupees: "" })} style={{ width: 16, height: 16, accentColor: PURPLE }} />
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>This course is free</span>
        </label>
        {!form.isFree && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ ...labelSt }}>MRP (₹)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.875rem" }}>₹</span>
                <input
                  type="number" min="0" step="0.01"
                  value={form.mrpRupees}
                  onChange={e => set({ mrpRupees: e.target.value })}
                  placeholder="e.g. 999"
                  style={{ ...inputSt, paddingLeft: "1.5rem" }}
                  disabled={disabled}
                />
              </div>
            </div>
            <div>
              <label style={{ ...labelSt }}>Selling Price (₹)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "0.625rem", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: "0.875rem" }}>₹</span>
                <input
                  type="number" min="0" step="0.01"
                  value={form.sellingPriceRupees}
                  onChange={e => set({ sellingPriceRupees: e.target.value })}
                  placeholder="e.g. 799"
                  style={{ ...inputSt, paddingLeft: "1.5rem" }}
                  disabled={disabled}
                />
              </div>
            </div>
            {(() => {
              const mrpVal = parseRupees(form.mrpRupees);
              const spVal  = parseRupees(form.sellingPriceRupees);
              const disc   = calculateDiscount(mrpVal, spVal);
              if (!disc || disc <= 0 || mrpVal === null || spVal === null) return null;
              return (
                <div style={{ gridColumn: "1/-1", display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "3px 10px", borderRadius: "12px", background: "#dcfce7", color: "#15803d", fontSize: "0.75rem", fontWeight: 700 }}>
                  {disc}% off — saves {formatRupee(mrpVal - spVal)}
                </div>
              );
            })()}
          </div>
        )}
        {form.isFree && (
          <div style={{ fontSize: "0.75rem", color: "#6d28d9", background: "#ede9fe", padding: "0.3rem 0.625rem", borderRadius: "5px", display: "inline-block" }}>
            This course will be listed as Free to students
          </div>
        )}
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

  const [categories, setCategories] = useState<TaxOption[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);

  // ── Linked content state ─────────────────────────────────────────────────────
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [removedLinkedIds, setRemovedLinkedIds] = useState<string[]>([]);

  // Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<string>("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [pickerCategoryId, setPickerCategoryId] = useState<string>("");

  const pageSize = 20;

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    fetch("/api/taxonomy?level=category").then(r => r.json()).then(j => setCategories(j.data || [])).catch(() => {});
    fetch("/api/exams").then(r => r.json()).then(j => setExams(j.exams || [])).catch(() => {});
  }, []);

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
    setLinkedItems([]);
    setRemovedLinkedIds([]);
    setModalMode("create");
  }

  // ─── Edit ────────────────────────────────────────────────────────────────────
  async function openEdit(course: Course) {
    setForm(courseToForm(course));
    setFormError(null);
    setEditTarget(course);
    setLinkedItems([]);
    setRemovedLinkedIds([]);
    setModalMode("edit");
    // Load existing linked items
    try {
      const r = await fetch(`/api/admin/courses/${course.id}/linked-content`);
      if (r.ok) {
        const d = await r.json();
        setLinkedItems((d.items || []).map((i: any) => ({
          rowId: i.id,
          tempId: i.id,
          contentType: i.contentType,
          sourceId: i.sourceId,
          title: i.titleSnapshot,
        })));
      }
    } catch { /* ignore */ }
  }

  // ─── Linked content handlers ─────────────────────────────────────────────────
  async function openPicker(contentType: string, categoryId: string) {
    setPickerType(contentType);
    setPickerCategoryId(categoryId);
    setPickerSearch("");
    setPickerSelected(new Set());
    setPickerItems([]);
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const p = new URLSearchParams({ type: contentType });
      if (categoryId) p.set("categoryId", categoryId);
      const r = await fetch(`/api/admin/courses/reusable-content?${p}`);
      if (r.ok) { const d = await r.json(); setPickerItems(d.items || []); }
    } catch { /* ignore */ }
    finally { setPickerLoading(false); }
  }

  async function reloadPickerWithSearch(contentType: string, categoryId: string, search: string) {
    setPickerLoading(true);
    try {
      const p = new URLSearchParams({ type: contentType, search });
      if (categoryId) p.set("categoryId", categoryId);
      const r = await fetch(`/api/admin/courses/reusable-content?${p}`);
      if (r.ok) { const d = await r.json(); setPickerItems(d.items || []); }
    } catch { /* ignore */ }
    finally { setPickerLoading(false); }
  }

  function confirmPickerSelection() {
    const alreadyLinked = new Set(linkedItems.map(i => `${i.contentType}::${i.sourceId}`));
    const newItems: LinkedItem[] = pickerItems
      .filter(i => pickerSelected.has(i.id) && !alreadyLinked.has(`${pickerType}::${i.id}`))
      .map(i => ({
        tempId: `temp_${Date.now()}_${i.id}`,
        contentType: pickerType,
        sourceId: i.id,
        title: i.title,
      }));
    setLinkedItems(prev => [...prev, ...newItems]);
    setPickerOpen(false);
  }

  function removeLinkedItem(tempId: string) {
    const item = linkedItems.find(i => i.tempId === tempId);
    if (item?.rowId) setRemovedLinkedIds(prev => [...prev, item.rowId!]);
    setLinkedItems(prev => prev.filter(i => i.tempId !== tempId));
  }

  function moveLinkedUp(idx: number) {
    if (idx === 0) return;
    setLinkedItems(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a; });
  }

  function moveLinkedDown(idx: number) {
    setLinkedItems(prev => { if (idx >= prev.length - 1) return prev; const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a; });
  }

  // ─── Save (create or edit) ────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { setFormError("Course name is required"); return; }
    if (!hasAnyType(form)) { setFormError("Select at least one product type"); return; }

    // Parse and validate pricing in rupees (Decimal)
    const mrp         = parseRupees(form.mrpRupees);
    const sellingPrice = parseRupees(form.sellingPriceRupees);
    const pricingErr  = validatePricing(form.isFree, mrp, sellingPrice);
    if (pricingErr) { setFormError(pricingErr); return; }

    setSaving(true); setFormError(null);

    const isEdit = modalMode === "edit" && editTarget;
    const url    = isEdit ? `/api/courses/${editTarget!.id}` : "/api/courses";
    const method = isEdit ? "PUT" : "POST";

    const payload = { ...form, mrp, sellingPrice };
    const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();

    if (!res.ok) { setSaving(false); setFormError(json.error || "Failed to save"); return; }

    const courseId = isEdit ? editTarget!.id : (json.data?.id || json.id);

    // Sync linked content — only when there is something to sync
    const hasLinkedChanges = removedLinkedIds.length > 0 || linkedItems.length > 0;
    if (courseId && hasLinkedChanges) {
      // DELETE removed items
      if (removedLinkedIds.length > 0) {
        await Promise.all(
          removedLinkedIds.map(rid => fetch(`/api/admin/courses/${courseId}/linked-content/${rid}`, { method: "DELETE" }).catch(() => {}))
        );
      }
      // POST new items (those without a rowId = freshly added)
      const newItems = linkedItems.filter(i => !i.rowId);
      if (newItems.length > 0) {
        await fetch(`/api/admin/courses/${courseId}/linked-content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: newItems.map(i => ({ contentType: i.contentType, sourceId: i.sourceId })) }),
        }).catch(() => {});
      }
      // PATCH reorder: re-fetch to get fresh IDs (includes newly created rows), then sort by UI order
      if (linkedItems.length > 1) {
        try {
          const lr = await fetch(`/api/admin/courses/${courseId}/linked-content`);
          if (lr.ok) {
            const ld = await lr.json();
            const orderedIds = (ld.items as { id: string; sourceId: string; contentType: string }[])
              .sort((a, b) => {
                const ai = linkedItems.findIndex(x => x.sourceId === a.sourceId && x.contentType === a.contentType);
                const bi = linkedItems.findIndex(x => x.sourceId === b.sourceId && x.contentType === b.contentType);
                return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
              })
              .map(i => i.id);
            if (orderedIds.length > 1) {
              await fetch(`/api/admin/courses/${courseId}/linked-content/reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderedIds }),
              }).catch(() => {});
            }
          }
        } catch { /* non-fatal */ }
      }
    }

    setSaving(false);
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

      {/* ── Content Picker Modal ─────────────────────────────────────────────── */}
      {pickerOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 580, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
            {/* Header */}
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>
                  Select {LINKED_TYPE_CONFIG[pickerType]?.label ?? pickerType}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "1px" }}>
                  {pickerCategoryId ? "Showing items for the selected category." : "No category filter — showing all."}
                </div>
              </div>
              <button onClick={() => setPickerOpen(false)} style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1rem", color: "#64748b" }}>×</button>
            </div>

            {/* Search */}
            <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
              <input
                value={pickerSearch}
                onChange={e => {
                  setPickerSearch(e.target.value);
                  reloadPickerWithSearch(pickerType, pickerCategoryId, e.target.value);
                }}
                placeholder={`Search ${LINKED_TYPE_CONFIG[pickerType]?.label ?? pickerType}…`}
                style={{ width: "100%", padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "7px", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Item list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
              {pickerLoading && (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>Loading…</div>
              )}
              {!pickerLoading && pickerItems.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>
                  {pickerSearch ? `No results for "${pickerSearch}"` : `No ${LINKED_TYPE_CONFIG[pickerType]?.label ?? pickerType} found for this category.`}
                </div>
              )}
              {!pickerLoading && pickerItems.map(item => {
                const alreadyLinked = linkedItems.some(l => l.sourceId === item.id && l.contentType === pickerType);
                const selected = pickerSelected.has(item.id);
                return (
                  <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 1.25rem", cursor: alreadyLinked ? "not-allowed" : "pointer", background: selected ? "#f5f3ff" : "transparent", opacity: alreadyLinked ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      disabled={alreadyLinked}
                      checked={selected}
                      onChange={e => {
                        setPickerSelected(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(item.id); else next.delete(item.id);
                          return next;
                        });
                      }}
                      style={{ width: 15, height: 15, accentColor: PURPLE, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                      <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "1px" }}>
                        {Object.entries(item.meta)
                          .filter(([k]) => !["categoryId"].includes(k))
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                        {alreadyLinked && " · Already linked"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>
                {pickerSelected.size > 0 ? `${pickerSelected.size} selected` : "Select items to add"}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => setPickerOpen(false)} style={{ padding: "0.4rem 1rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" }}>Cancel</button>
                <button
                  onClick={confirmPickerSelection}
                  disabled={pickerSelected.size === 0}
                  style={{ padding: "0.4rem 1.25rem", borderRadius: "7px", border: "none", background: pickerSelected.size === 0 ? "#e2e8f0" : PURPLE, color: pickerSelected.size === 0 ? "#94a3b8" : "#fff", cursor: pickerSelected.size === 0 ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.875rem" }}
                >
                  Add Selected ({pickerSelected.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create/Edit modal ────────────────────────────────────────────────── */}
      {modalMode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 8000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3vh 1rem 2rem", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a" }}>
                {modalMode === "create" ? "New Course" : `Edit: ${editTarget?.name}`}
              </h2>
              <button onClick={() => setModalMode(null)} style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "1.125rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>×</button>
            </div>
            <div style={{ padding: "1.5rem" }}>
              <CourseForm form={form} onChange={setForm} error={formError} isEdit={modalMode === "edit"} categories={categories} exams={exams} disabled={saving} />

              {/* ── Linked Content Section ─────────────────────────────── */}
              {hasAnyType(form) && (
                <div style={{ marginTop: "1.25rem", padding: "1rem", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#374151", marginBottom: "0.625rem" }}>
                    📎 Attach Existing Content
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.73rem", fontWeight: 400, color: "#94a3b8" }}>link existing items — no duplication</span>
                  </div>

                  {/* Selector buttons per enabled type */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: linkedItems.length > 0 ? "0.875rem" : 0 }}>
                    {linkedTypesForForm(form).map(type => {
                      const cfg = LINKED_TYPE_CONFIG[type];
                      const btnDisabled = saving || !form.categoryId;
                      return (
                        <button
                          key={type}
                          disabled={btnDisabled}
                          onClick={() => openPicker(type, form.categoryId)}
                          title={!form.categoryId ? "Select a category first to enable this selector" : `Browse and select ${cfg.label}`}
                          style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "7px", border: `1.5px solid ${btnDisabled ? "#d1d5db" : cfg.color}`, background: btnDisabled ? "#f8fafc" : cfg.bg, color: btnDisabled ? "#9ca3af" : cfg.color, fontWeight: 700, fontSize: "0.8rem", cursor: btnDisabled ? "not-allowed" : "pointer", opacity: btnDisabled ? 0.6 : 1 }}
                        >
                          + {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Category warning if not set */}
                  {!form.categoryId && (
                    <div style={{ fontSize: "0.78rem", color: "#92400e", background: "#fef3c7", padding: "0.375rem 0.625rem", borderRadius: "6px", marginTop: "0.5rem" }}>
                      ⚠ Set a category above — selectors are disabled until a category is chosen (results are filtered by category).
                    </div>
                  )}

                  {/* Selected linked items */}
                  {linkedItems.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", marginBottom: "0.375rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Selected Included Products ({linkedItems.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                        {linkedItems.map((item, idx) => {
                          const cfg = LINKED_TYPE_CONFIG[item.contentType] ?? { label: item.contentType, bg: "#f1f5f9", color: "#374151" };
                          return (
                            <div key={item.tempId} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.4rem 0.625rem" }}>
                              <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "0.68rem", fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                                {cfg.short ?? cfg.label}
                              </span>
                              <span style={{ flex: 1, fontSize: "0.8125rem", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                              {!item.rowId && <span style={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700, flexShrink: 0 }}>NEW</span>}
                              <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0 }}>
                                <button onClick={() => moveLinkedUp(idx)} disabled={idx === 0 || saving} title="Move up" style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.7rem", opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                                <button onClick={() => moveLinkedDown(idx)} disabled={idx === linkedItems.length - 1 || saving} title="Move down" style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", color: "#64748b", fontSize: "0.7rem", opacity: idx === linkedItems.length - 1 ? 0.3 : 1 }}>↓</button>
                                <button onClick={() => removeLinkedItem(item.tempId)} disabled={saving} title="Remove" style={{ width: 22, height: 22, borderRadius: 4, border: "1px solid #fca5a5", background: "#fff5f5", cursor: "pointer", color: "#dc2626", fontSize: "0.8rem" }}>×</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {linkedItems.length === 0 && form.categoryId && (
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.375rem" }}>
                      No items linked yet. Click a selector above to browse and attach existing content.
                    </div>
                  )}
                </div>
              )}
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
              {["", "Course Name", "Type", "Product Types", "Price", "Videos", "Live Classes", "Status", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ height: 16, borderRadius: 4, background: `linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", width: j === 0 ? "60%" : j === 1 ? "80%" : "40%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
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
                <td style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                  {course.isFree ? (
                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "0.72rem", fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>Free</span>
                  ) : course.sellingPrice != null ? (
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{formatRupee(course.sellingPrice)}</span>
                      {course.mrp != null && Number(course.mrp) > Number(course.sellingPrice) && (
                        <>
                          <span style={{ marginLeft: "0.3rem", textDecoration: "line-through", color: "#94a3b8", fontSize: "0.75rem" }}>{formatRupee(course.mrp)}</span>
                          <span style={{ marginLeft: "0.3rem", padding: "1px 5px", borderRadius: "6px", fontSize: "0.68rem", fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>
                            {calculateDiscount(course.mrp, course.sellingPrice)}% off
                          </span>
                        </>
                      )}
                    </div>
                  ) : course.mrp != null ? (
                    <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{formatRupee(course.mrp)}</span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}>—</span>
                  )}
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
