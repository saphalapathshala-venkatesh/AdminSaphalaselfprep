"use client";

import { useState, useEffect, useCallback } from "react";

const ENTITLEMENT_OPTIONS = [
  "SELFPREP_HTML", "TESTHUB", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON",
];

type ProductCat = { code: string; label: string; isFree: boolean; sortOrder: number };
type ExamCat   = { id: string; name: string };

interface CouponProductScope { productCategory: string }
interface CouponExamScope    { categoryId: string; category?: { id: string; name: string } }

interface Coupon {
  id: string;
  code: string;
  discountType: "PERCENT" | "FLAT";
  discountValue: number;
  validFrom: string | null;
  validUntil: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  applicableEntitlements: string[];
  appliesToAllPaidProductCategories: boolean;
  appliesToAllExamCategories: boolean;
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number };
  productCategoryScopes?: CouponProductScope[];
  examCategoryScopes?: CouponExamScope[];
}

interface CouponUsage {
  totalUses: number;
  uniqueUsers: number;
  recentPurchases: any[];
}

const EMPTY_FORM = {
  code: "",
  discountType: "PERCENT" as "PERCENT" | "FLAT",
  discountValue: "",
  validFrom: "",
  validUntil: "",
  usageLimit: "",
  perUserLimit: "",
  applicableEntitlements: [] as string[],
  appliesToAllPaidProductCategories: true,
  productCategories: [] as string[],
  appliesToAllExamCategories: true,
  examCategoryIds: [] as string[],
  isActive: true,
};

export default function CouponsPage() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [coupons, setCoupons]         = useState<Coupon[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState<Coupon | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [couponUsage, setCouponUsage] = useState<Record<string, CouponUsage>>({});
  const [showUsageId, setShowUsageId] = useState<string | null>(null);

  // Reference data for applicability section
  const [productCats, setProductCats] = useState<ProductCat[]>([]);
  const [examCats, setExamCats]       = useState<ExamCat[]>([]);

  // Fetch product categories and exam categories once on mount
  useEffect(() => {
    fetch("/api/admin/product-categories")
      .then(r => r.json())
      .then(j => setProductCats(j.data || []))
      .catch(() => {});
    fetch("/api/taxonomy?level=category")
      .then(r => r.json())
      .then(j => setExamCats(j.data || []))
      .catch(() => {});
  }, []);

  const paidProductCats = productCats.filter(c => !c.isFree);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search)       params.set("search", search);
      if (activeFilter) params.set("active", activeFilter);
      const res  = await fetch(`/api/coupons?${params}`);
      const json = await res.json();
      setCoupons(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { setCoupons([]); }
    setLoading(false);
  }, [page, search, activeFilter]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue:
        c.discountType === "FLAT"
          ? String(c.discountValue / 100)
          : String(c.discountValue),
      validFrom:  c.validFrom  ? c.validFrom.slice(0, 16)  : "",
      validUntil: c.validUntil ? c.validUntil.slice(0, 16) : "",
      usageLimit:   c.usageLimit   ? String(c.usageLimit)   : "",
      perUserLimit: c.perUserLimit ? String(c.perUserLimit) : "",
      applicableEntitlements: c.applicableEntitlements || [],
      appliesToAllPaidProductCategories: c.appliesToAllPaidProductCategories ?? true,
      productCategories: (c.productCategoryScopes || []).map(s => s.productCategory),
      appliesToAllExamCategories: c.appliesToAllExamCategories ?? true,
      examCategoryIds: (c.examCategoryScopes || []).map(s => s.categoryId),
      isActive: c.isActive,
    });
    setShowModal(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        discountType: form.discountType,
        discountValue:
          form.discountType === "FLAT"
            ? Math.round(parseFloat(form.discountValue || "0") * 100)
            : parseInt(form.discountValue) || 0,
        validFrom:  form.validFrom  || null,
        validUntil: form.validUntil || null,
        usageLimit:   form.usageLimit   ? parseInt(form.usageLimit)   : null,
        perUserLimit: form.perUserLimit ? parseInt(form.perUserLimit) : null,
        applicableEntitlements: form.applicableEntitlements,
        appliesToAllPaidProductCategories: form.appliesToAllPaidProductCategories,
        productCategories: form.appliesToAllPaidProductCategories ? [] : form.productCategories,
        appliesToAllExamCategories: form.appliesToAllExamCategories,
        examCategoryIds: form.appliesToAllExamCategories ? [] : form.examCategoryIds,
        isActive: form.isActive,
      };
      if (editing) payload.id = editing.id;

      const res  = await fetch("/api/coupons", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editing ? "Coupon updated" : "Coupon created", "success");
      setShowModal(false);
      fetchCoupons();
    } catch { showToast("Failed to save coupon", "error"); }
    finally { setSaving(false); }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    try {
      const res  = await fetch(`/api/coupons?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Coupon deleted", "success");
      fetchCoupons();
    } catch { showToast("Failed to delete", "error"); }
  };

  const fetchUsage = async (id: string) => {
    if (showUsageId === id) { setShowUsageId(null); return; }
    try {
      const res  = await fetch(`/api/coupons/${id}/usage`);
      const json = await res.json();
      setCouponUsage(prev => ({ ...prev, [id]: json.data }));
      setShowUsageId(id);
    } catch { showToast("Failed to load usage", "error"); }
  };

  const toggleItem = (val: string, list: string[]): string[] =>
    list.includes(val) ? list.filter(x => x !== val) : [...list, val];

  const scopeSummary = (c: Coupon): string => {
    const prod = c.appliesToAllPaidProductCategories
      ? "All paid categories"
      : `${(c.productCategoryScopes || []).length} category(ies)`;
    const exam = c.appliesToAllExamCategories
      ? "All exams"
      : `${(c.examCategoryScopes || []).length} exam(s)`;
    return `${prod} · ${exam}`;
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem", border: "1px solid #d1d5db",
    borderRadius: "0.375rem", fontSize: "0.875rem",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem",
    fontWeight: 500,
  };
  const sectionHeadStyle: React.CSSProperties = {
    fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.05em", color: "#6b7280", marginBottom: "0.5rem",
    borderBottom: "1px solid #e5e7eb", paddingBottom: "0.25rem",
  };
  const radioRowStyle: React.CSSProperties = {
    display: "flex", gap: "1.25rem", alignItems: "center", marginBottom: "0.5rem",
  };
  const checkGridStyle: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem",
    marginTop: "0.375rem",
  };
  const btnPrimary: React.CSSProperties = {
    padding: "0.5rem 1rem", background: "#7c3aed", color: "#fff", border: "none",
    borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500,
  };
  const btnDanger: React.CSSProperties = {
    padding: "0.25rem 0.75rem", background: "#ef4444", color: "#fff", border: "none",
    borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem",
  };
  const btnSecondary: React.CSSProperties = {
    padding: "0.25rem 0.75rem", background: "#f3f4f6", color: "#374151",
    border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer",
    fontSize: "0.75rem",
  };
  const thStyle: React.CSSProperties = {
    padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #e5e7eb",
    fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase",
  };
  const tdStyle: React.CSSProperties = {
    padding: "0.75rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.875rem",
  };

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: "1rem", right: "1rem", padding: "0.75rem 1.5rem",
          borderRadius: "0.5rem", color: "#fff",
          background: toast.type === "success" ? "#22c55e" : "#ef4444",
          zIndex: 1000, fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111" }}>Coupons</h1>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder="Search by code..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ ...inputStyle, maxWidth: "260px" }}
        />
        <select
          value={activeFilter}
          onChange={e => { setActiveFilter(e.target.value); setPage(1); }}
          style={{ ...inputStyle, maxWidth: "160px" }}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={openCreate} style={btnPrimary}>+ New Coupon</button>
      </div>

      {loading ? (
        <p style={{ color: "#999" }}>Loading...</p>
      ) : coupons.length === 0 ? (
        <p style={{ color: "#999" }}>No coupons found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", background: "#fff",
            borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Discount</th>
                <th style={thStyle}>Validity</th>
                <th style={thStyle}>Limits</th>
                <th style={thStyle}>Applicability</th>
                <th style={thStyle}>Uses</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "monospace" }}>{c.code}</td>
                  <td style={tdStyle}>
                    {c.discountType === "PERCENT"
                      ? `${c.discountValue}%`
                      : `₹${(c.discountValue / 100).toFixed(2)}`}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                    {c.validFrom  ? new Date(c.validFrom).toLocaleDateString()  : "—"} →{" "}
                    {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                    {c.usageLimit ? `${c.usageLimit} total` : "∞"}
                    {c.perUserLimit ? `, ${c.perUserLimit}/user` : ""}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.7rem", color: "#6b7280" }}>
                    {scopeSummary(c)}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => fetchUsage(c.id)}
                      style={{ ...btnSecondary, fontSize: "0.75rem" }}
                    >
                      {c._count?.purchases || 0} uses {showUsageId === c.id ? "▲" : "▼"}
                    </button>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "0.125rem 0.5rem", borderRadius: "9999px",
                      fontSize: "0.75rem", fontWeight: 500,
                      background: c.isActive ? "#dcfce7" : "#fee2e2",
                      color: c.isActive ? "#166534" : "#991b1b",
                    }}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => openEdit(c)} style={btnSecondary}>Edit</button>
                      <button onClick={() => deleteCoupon(c.id)} style={btnDanger}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {showUsageId && couponUsage[showUsageId] && (
            <div style={{
              margin: "0.75rem 0", padding: "1rem", background: "#f0f9ff",
              borderRadius: "0.5rem", fontSize: "0.8rem",
            }}>
              <strong>Usage Summary:</strong>{" "}
              {couponUsage[showUsageId].totalUses} total uses,{" "}
              {couponUsage[showUsageId].uniqueUsers} unique users
              {couponUsage[showUsageId].recentPurchases.length > 0 && (
                <table style={{ width: "100%", marginTop: "0.5rem", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, fontSize: "0.7rem" }}>User</th>
                      <th style={{ ...thStyle, fontSize: "0.7rem" }}>Package</th>
                      <th style={{ ...thStyle, fontSize: "0.7rem" }}>Amount</th>
                      <th style={{ ...thStyle, fontSize: "0.7rem" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couponUsage[showUsageId].recentPurchases.slice(0, 5).map((p: any) => (
                      <tr key={p.id}>
                        <td style={tdStyle}>{p.user?.name || p.user?.email || p.userId}</td>
                        <td style={tdStyle}>{p.package?.code || "—"}</td>
                        <td style={tdStyle}>₹{(p.grossPaise / 100).toFixed(2)}</td>
                        <td style={tdStyle}>{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>Prev</button>
          <span style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>Next</button>
        </div>
      )}

      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div style={{
            background: "#fff", borderRadius: "0.75rem", padding: "1.5rem",
            width: "100%", maxWidth: "580px", maxHeight: "90vh", overflow: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1.25rem" }}>
              {editing ? "Edit Coupon" : "New Coupon"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>

              {/* ── Basic Info ── */}
              <div>
                <p style={sectionHeadStyle}>Basic Info</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  <div>
                    <label style={labelStyle}>Code *</label>
                    <input
                      value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                      style={inputStyle}
                      placeholder="SUMMER_SALE"
                    />
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Discount Type *</label>
                      <select
                        value={form.discountType}
                        onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "PERCENT" | "FLAT" }))}
                        style={inputStyle}
                      >
                        <option value="PERCENT">Percent (%)</option>
                        <option value="FLAT">Flat (₹)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>
                        Value * {form.discountType === "PERCENT" ? "(1–100)" : "(₹)"}
                      </label>
                      <input
                        type="number"
                        value={form.discountValue}
                        onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Valid From</label>
                      <input
                        type="datetime-local"
                        value={form.validFrom}
                        onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Valid Until</label>
                      <input
                        type="datetime-local"
                        value={form.validUntil}
                        onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Usage Limit (total)</label>
                      <input
                        type="number"
                        value={form.usageLimit}
                        onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))}
                        style={inputStyle}
                        placeholder="Unlimited"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Per User Limit</label>
                      <input
                        type="number"
                        value={form.perUserLimit}
                        onChange={e => setForm(f => ({ ...f, perUserLimit: e.target.value }))}
                        style={inputStyle}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Applicability ── */}
              <div style={{ background: "#f8fafc", borderRadius: "0.5rem", padding: "0.875rem", border: "1px solid #e2e8f0" }}>
                <p style={{ ...sectionHeadStyle, color: "#7c3aed" }}>Applicability</p>

                {/* Layer 1: Product Categories */}
                <div style={{ marginBottom: "0.875rem" }}>
                  <label style={{ ...labelStyle, marginBottom: "0.375rem" }}>
                    Layer 1 — Product Categories
                  </label>
                  <div style={radioRowStyle}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="prodCatMode"
                        checked={form.appliesToAllPaidProductCategories}
                        onChange={() => setForm(f => ({ ...f, appliesToAllPaidProductCategories: true, productCategories: [] }))}
                      />
                      All Paid Product Categories
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="prodCatMode"
                        checked={!form.appliesToAllPaidProductCategories}
                        onChange={() => setForm(f => ({ ...f, appliesToAllPaidProductCategories: false }))}
                      />
                      Specific Categories
                    </label>
                  </div>
                  {!form.appliesToAllPaidProductCategories && (
                    <div style={checkGridStyle}>
                      {paidProductCats.length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#9ca3af", gridColumn: "span 2" }}>
                          Loading categories…
                        </p>
                      ) : (
                        paidProductCats.map(cat => (
                          <label
                            key={cat.code}
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={form.productCategories.includes(cat.code)}
                              onChange={() =>
                                setForm(f => ({ ...f, productCategories: toggleItem(cat.code, f.productCategories) }))
                              }
                            />
                            {cat.label}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  {!form.appliesToAllPaidProductCategories && form.productCategories.length === 0 && (
                    <p style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "0.25rem" }}>
                      Select at least one paid product category.
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div style={{ borderTop: "1px dashed #e2e8f0", margin: "0.5rem 0" }} />

                {/* Layer 2: Exam Categories */}
                <div>
                  <label style={{ ...labelStyle, marginBottom: "0.375rem" }}>
                    Layer 2 — Exam Categories
                    <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: "0.25rem" }}>
                      (fetched from DB)
                    </span>
                  </label>
                  <div style={radioRowStyle}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="examCatMode"
                        checked={form.appliesToAllExamCategories}
                        onChange={() => setForm(f => ({ ...f, appliesToAllExamCategories: true, examCategoryIds: [] }))}
                      />
                      All Exam Categories
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="examCatMode"
                        checked={!form.appliesToAllExamCategories}
                        onChange={() => setForm(f => ({ ...f, appliesToAllExamCategories: false }))}
                      />
                      Specific Exam Categories
                    </label>
                  </div>
                  {!form.appliesToAllExamCategories && (
                    <div style={checkGridStyle}>
                      {examCats.length === 0 ? (
                        <p style={{ fontSize: "0.75rem", color: "#9ca3af", gridColumn: "span 2" }}>
                          Loading exam categories…
                        </p>
                      ) : (
                        examCats.map(cat => (
                          <label
                            key={cat.id}
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={form.examCategoryIds.includes(cat.id)}
                              onChange={() =>
                                setForm(f => ({ ...f, examCategoryIds: toggleItem(cat.id, f.examCategoryIds) }))
                              }
                            />
                            {cat.name}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                  {!form.appliesToAllExamCategories && form.examCategoryIds.length === 0 && (
                    <p style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "0.25rem" }}>
                      Select at least one exam category.
                    </p>
                  )}
                </div>

                <p style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "0.625rem", fontStyle: "italic" }}>
                  Coupon applies only when <strong>both</strong> conditions match the selected package.
                </p>
              </div>

              {/* ── Legacy Entitlements ── */}
              <div>
                <p style={sectionHeadStyle}>Legacy Entitlement Filter (optional)</p>
                <label style={{ ...labelStyle, fontWeight: 400, marginBottom: "0.375rem" }}>
                  Leave empty to apply to all entitlements
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {ENTITLEMENT_OPTIONS.map(opt => (
                    <label
                      key={opt}
                      style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={form.applicableEntitlements.includes(opt)}
                        onChange={() =>
                          setForm(f => ({ ...f, applicableEntitlements: toggleItem(opt, f.applicableEntitlements) }))
                        }
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Status ── */}
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
