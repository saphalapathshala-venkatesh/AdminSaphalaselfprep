"use client";

import { useState, useEffect, useCallback } from "react";

const ENTITLEMENT_OPTIONS = [
  "SELFPREP_HTML", "TESTHUB", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON",
];

interface ProductPackage {
  id: string;
  code: string;
  name: string;
  description: string | null;
  entitlementCodes: string[];
  pricePaise: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number };
}

interface SimResult {
  purchase: any;
  entitlements: any[];
}

export default function ProductsPage() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const [products, setProducts] = useState<ProductPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ProductPackage | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", entitlementCodes: [] as string[], priceRupees: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [simPkgId, setSimPkgId] = useState("");
  const [simUserId, setSimUserId] = useState("");
  const [simCouponCode, setSimCouponCode] = useState("");
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      if (activeFilter) params.set("active", activeFilter);
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setProducts(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { setProducts([]); }
    setLoading(false);
  }, [page, search, activeFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", description: "", entitlementCodes: [], priceRupees: "", isActive: true });
    setShowModal(true);
  };

  const openEdit = (p: ProductPackage) => {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description || "",
      entitlementCodes: p.entitlementCodes || [],
      priceRupees: String(p.pricePaise / 100),
      isActive: p.isActive,
    });
    setShowModal(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        entitlementCodes: form.entitlementCodes,
        pricePaise: Math.round(parseFloat(form.priceRupees || "0") * 100),
        currency: "INR",
        isActive: form.isActive,
      };
      if (editing) payload.id = editing.id;
      const res = await fetch("/api/products", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editing ? "Package updated" : "Package created", "success");
      setShowModal(false);
      fetchProducts();
    } catch { showToast("Failed to save package", "error"); }
    finally { setSaving(false); }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this package?")) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Package deleted", "success");
      fetchProducts();
    } catch { showToast("Failed to delete", "error"); }
  };

  const simulatePurchase = async () => {
    if (!simPkgId || !simUserId.trim()) { showToast("Select a package and enter a user ID", "error"); return; }
    setSimLoading(true);
    setSimResult(null);
    try {
      const res = await fetch(`/api/products/${simPkgId}/simulate-purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: simUserId.trim(), couponCode: simCouponCode.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      setSimResult(json.data);
      showToast("Purchase simulated", "success");
      fetchProducts();
    } catch { showToast("Simulation failed", "error"); }
    finally { setSimLoading(false); }
  };

  const toggleEntitlement = (code: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(code) ? list.filter(c => c !== code) : [...list, code]);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.875rem" };
  const btnPrimary: React.CSSProperties = { padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 };
  const btnDanger: React.CSSProperties = { padding: "0.25rem 0.75rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem" };
  const btnSecondary: React.CSSProperties = { padding: "0.25rem 0.75rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem" };
  const thStyle: React.CSSProperties = { padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" };
  const tdStyle: React.CSSProperties = { padding: "0.75rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.875rem" };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", color: "#fff", background: toast.type === "success" ? "#22c55e" : "#ef4444", zIndex: 1000, fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111" }}>Products</h1>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Search by name or code..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, maxWidth: "260px" }} />
        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, maxWidth: "160px" }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <button onClick={openCreate} style={btnPrimary}>+ New Package</button>
        <button onClick={() => { setShowSimPanel(!showSimPanel); setSimResult(null); }} style={{ ...btnPrimary, background: "#7c3aed" }}>Simulate Purchase</button>
      </div>

      {showSimPanel && (
        <div style={{ padding: "1rem", background: "#faf5ff", borderRadius: "0.5rem", marginBottom: "1rem", border: "1px solid #e9d5ff" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>Simulate Purchase</h3>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#6b7280", display: "block", marginBottom: "0.25rem" }}>Package</label>
              <select value={simPkgId} onChange={e => setSimPkgId(e.target.value)} style={{ ...inputStyle, maxWidth: "220px" }}>
                <option value="">Select package...</option>
                {products.filter(p => p.isActive).map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#6b7280", display: "block", marginBottom: "0.25rem" }}>User ID</label>
              <input value={simUserId} onChange={e => setSimUserId(e.target.value)} placeholder="Enter user ID..." style={{ ...inputStyle, maxWidth: "220px" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.75rem", color: "#6b7280", display: "block", marginBottom: "0.25rem" }}>Coupon Code (optional)</label>
              <input value={simCouponCode} onChange={e => setSimCouponCode(e.target.value)} placeholder="COUPON_CODE" style={{ ...inputStyle, maxWidth: "180px" }} />
            </div>
            <button onClick={simulatePurchase} disabled={simLoading} style={{ ...btnPrimary, background: "#7c3aed" }}>
              {simLoading ? "Processing..." : "Simulate"}
            </button>
          </div>
          {simResult && (
            <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#fff", borderRadius: "0.375rem", fontSize: "0.8rem" }}>
              <p><strong>Purchase created:</strong> ID {simResult.purchase.id}</p>
              <p>Gross: ₹{(simResult.purchase.grossPaise / 100).toFixed(2)} | Fee: ₹{(simResult.purchase.feePaise / 100).toFixed(2)} | Net: ₹{(simResult.purchase.netPaise / 100).toFixed(2)}</p>
              <p><strong>Entitlements granted:</strong> {simResult.entitlements.map((e: any) => e.productCode).join(", ")}</p>
            </div>
          )}
        </div>
      )}

      {loading ? <p style={{ color: "#999" }}>Loading...</p> : products.length === 0 ? <p style={{ color: "#999" }}>No packages found.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Price</th>
                <th style={thStyle}>Entitlements</th>
                <th style={thStyle}>Purchases</th>
                <th style={thStyle}>Active</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "monospace" }}>{p.code}</td>
                  <td style={tdStyle}>{p.name}</td>
                  <td style={tdStyle}>₹{(p.pricePaise / 100).toFixed(2)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      {p.entitlementCodes.map(e => (
                        <span key={e} style={{ padding: "0.125rem 0.375rem", background: "#e0e7ff", color: "#3730a3", borderRadius: "0.25rem", fontSize: "0.65rem", fontFamily: "monospace" }}>{e}</span>
                      ))}
                    </div>
                  </td>
                  <td style={tdStyle}>{p._count?.purchases || 0}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, background: p.isActive ? "#dcfce7" : "#fee2e2", color: p.isActive ? "#166534" : "#991b1b" }}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      <button onClick={() => openEdit(p)} style={btnSecondary}>Edit</button>
                      <button onClick={() => deleteProduct(p.id)} style={btnDanger}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>Prev</button>
          <span style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>Next</button>
        </div>
      )}

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", padding: "1.5rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>{editing ? "Edit Package" : "New Package"}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Code *</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} placeholder="PREMIUM_BUNDLE" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Premium Bundle" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: "60px" }} />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Price (₹ Rupees) *</label>
                <input type="number" step="0.01" value={form.priceRupees} onChange={e => setForm(f => ({ ...f, priceRupees: e.target.value }))} style={inputStyle} placeholder="499.00" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.5rem" }}>Entitlement Codes *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {ENTITLEMENT_OPTIONS.map(opt => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer", padding: "0.375rem 0.5rem", background: form.entitlementCodes.includes(opt) ? "#e0e7ff" : "#f9fafb", borderRadius: "0.375rem", border: form.entitlementCodes.includes(opt) ? "1px solid #818cf8" : "1px solid #e5e7eb" }}>
                      <input type="checkbox" checked={form.entitlementCodes.includes(opt)} onChange={() => toggleEntitlement(opt, form.entitlementCodes, v => setForm(f => ({ ...f, entitlementCodes: v })))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
