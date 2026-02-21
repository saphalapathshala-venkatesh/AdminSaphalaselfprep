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
  isActive: boolean;
  createdAt: string;
  _count?: { purchases: number };
}

interface CouponUsage {
  totalUses: number;
  uniqueUsers: number;
  recentPurchases: any[];
}

interface SimResult {
  purchase: any;
  entitlements: any[];
}

export default function CouponsPage() {
  const [tab, setTab] = useState<"coupons" | "products">("coupons");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // --- COUPONS STATE ---
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);
  const [couponSearch, setCouponSearch] = useState("");
  const [couponActiveFilter, setCouponActiveFilter] = useState("");
  const [couponPage, setCouponPage] = useState(1);
  const [couponTotalPages, setCouponTotalPages] = useState(1);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponForm, setCouponForm] = useState({ code: "", discountType: "PERCENT" as "PERCENT" | "FLAT", discountValue: "", validFrom: "", validUntil: "", usageLimit: "", perUserLimit: "", applicableEntitlements: [] as string[], isActive: true });
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponUsage, setCouponUsage] = useState<Record<string, CouponUsage>>({});
  const [showUsageId, setShowUsageId] = useState<string | null>(null);

  // --- PRODUCTS STATE ---
  const [products, setProducts] = useState<ProductPackage[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productSearch, setProductSearch] = useState("");
  const [productActiveFilter, setProductActiveFilter] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductPackage | null>(null);
  const [productForm, setProductForm] = useState({ code: "", name: "", description: "", entitlementCodes: [] as string[], priceRupees: "", isActive: true });
  const [savingProduct, setSavingProduct] = useState(false);
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [simPkgId, setSimPkgId] = useState("");
  const [simUserId, setSimUserId] = useState("");
  const [simCouponCode, setSimCouponCode] = useState("");
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // --- FETCH COUPONS ---
  const fetchCoupons = useCallback(async () => {
    setLoadingCoupons(true);
    try {
      const params = new URLSearchParams({ page: String(couponPage), pageSize: "20" });
      if (couponSearch) params.set("search", couponSearch);
      if (couponActiveFilter) params.set("active", couponActiveFilter);
      const res = await fetch(`/api/coupons?${params}`);
      const json = await res.json();
      setCoupons(json.data || []);
      setCouponTotalPages(json.pagination?.totalPages || 1);
    } catch { setCoupons([]); }
    setLoadingCoupons(false);
  }, [couponPage, couponSearch, couponActiveFilter]);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  // --- FETCH PRODUCTS ---
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ page: String(productPage), pageSize: "20" });
      if (productSearch) params.set("search", productSearch);
      if (productActiveFilter) params.set("active", productActiveFilter);
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setProducts(json.data || []);
      setProductTotalPages(json.pagination?.totalPages || 1);
    } catch { setProducts([]); }
    setLoadingProducts(false);
  }, [productPage, productSearch, productActiveFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // --- COUPON CRUD ---
  const openCouponCreate = () => {
    setEditingCoupon(null);
    setCouponForm({ code: "", discountType: "PERCENT", discountValue: "", validFrom: "", validUntil: "", usageLimit: "", perUserLimit: "", applicableEntitlements: [], isActive: true });
    setShowCouponModal(true);
  };

  const openCouponEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setCouponForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      validFrom: c.validFrom ? c.validFrom.slice(0, 16) : "",
      validUntil: c.validUntil ? c.validUntil.slice(0, 16) : "",
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
      perUserLimit: c.perUserLimit ? String(c.perUserLimit) : "",
      applicableEntitlements: c.applicableEntitlements || [],
      isActive: c.isActive,
    });
    setShowCouponModal(true);
  };

  const saveCoupon = async () => {
    setSavingCoupon(true);
    try {
      const payload: any = {
        code: couponForm.code,
        discountType: couponForm.discountType,
        discountValue: parseInt(couponForm.discountValue) || 0,
        validFrom: couponForm.validFrom || null,
        validUntil: couponForm.validUntil || null,
        usageLimit: couponForm.usageLimit ? parseInt(couponForm.usageLimit) : null,
        perUserLimit: couponForm.perUserLimit ? parseInt(couponForm.perUserLimit) : null,
        applicableEntitlements: couponForm.applicableEntitlements,
        isActive: couponForm.isActive,
      };
      if (editingCoupon) payload.id = editingCoupon.id;

      const res = await fetch("/api/coupons", {
        method: editingCoupon ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editingCoupon ? "Coupon updated" : "Coupon created", "success");
      setShowCouponModal(false);
      fetchCoupons();
    } catch { showToast("Failed to save coupon", "error"); }
    finally { setSavingCoupon(false); }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    try {
      const res = await fetch(`/api/coupons?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Coupon deleted", "success");
      fetchCoupons();
    } catch { showToast("Failed to delete", "error"); }
  };

  const fetchUsage = async (id: string) => {
    if (showUsageId === id) { setShowUsageId(null); return; }
    try {
      const res = await fetch(`/api/coupons/${id}/usage`);
      const json = await res.json();
      setCouponUsage(prev => ({ ...prev, [id]: json.data }));
      setShowUsageId(id);
    } catch { showToast("Failed to load usage", "error"); }
  };

  // --- PRODUCT CRUD ---
  const openProductCreate = () => {
    setEditingProduct(null);
    setProductForm({ code: "", name: "", description: "", entitlementCodes: [], priceRupees: "", isActive: true });
    setShowProductModal(true);
  };

  const openProductEdit = (p: ProductPackage) => {
    setEditingProduct(p);
    setProductForm({
      code: p.code,
      name: p.name,
      description: p.description || "",
      entitlementCodes: p.entitlementCodes || [],
      priceRupees: String(p.pricePaise / 100),
      isActive: p.isActive,
    });
    setShowProductModal(true);
  };

  const saveProduct = async () => {
    setSavingProduct(true);
    try {
      const payload: any = {
        code: productForm.code,
        name: productForm.name,
        description: productForm.description || null,
        entitlementCodes: productForm.entitlementCodes,
        pricePaise: Math.round(parseFloat(productForm.priceRupees || "0") * 100),
        currency: "INR",
        isActive: productForm.isActive,
      };
      if (editingProduct) payload.id = editingProduct.id;

      const res = await fetch("/api/products", {
        method: editingProduct ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(editingProduct ? "Package updated" : "Package created", "success");
      setShowProductModal(false);
      fetchProducts();
    } catch { showToast("Failed to save package", "error"); }
    finally { setSavingProduct(false); }
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
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111" }}>Coupons & Products</h1>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "0", marginBottom: "1.5rem", borderBottom: "2px solid #e5e7eb" }}>
        {(["coupons", "products"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "0.75rem 1.5rem", border: "none", background: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: tab === t ? 600 : 400, color: tab === t ? "#2563eb" : "#6b7280", borderBottom: tab === t ? "2px solid #2563eb" : "2px solid transparent", marginBottom: "-2px" }}>
            {t === "coupons" ? "Coupons" : "Product Builder"}
          </button>
        ))}
      </div>

      {/* ===== COUPONS TAB ===== */}
      {tab === "coupons" && (
        <div>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search by code..." value={couponSearch} onChange={e => { setCouponSearch(e.target.value); setCouponPage(1); }} style={{ ...inputStyle, maxWidth: "260px" }} />
            <select value={couponActiveFilter} onChange={e => { setCouponActiveFilter(e.target.value); setCouponPage(1); }} style={{ ...inputStyle, maxWidth: "160px" }}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button onClick={openCouponCreate} style={btnPrimary}>+ New Coupon</button>
          </div>

          {loadingCoupons ? <p style={{ color: "#999" }}>Loading...</p> : coupons.length === 0 ? <p style={{ color: "#999" }}>No coupons found.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={thStyle}>Code</th>
                    <th style={thStyle}>Discount</th>
                    <th style={thStyle}>Validity</th>
                    <th style={thStyle}>Limits</th>
                    <th style={thStyle}>Uses</th>
                    <th style={thStyle}>Active</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map(c => (
                    <tr key={c.id}>
                      <td style={{ ...tdStyle, fontWeight: 600, fontFamily: "monospace" }}>{c.code}</td>
                      <td style={tdStyle}>{c.discountType === "PERCENT" ? `${c.discountValue}%` : `₹${(c.discountValue / 100).toFixed(2)}`}</td>
                      <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                        {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : "—"} → {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                        {c.usageLimit ? `${c.usageLimit} total` : "∞"}{c.perUserLimit ? `, ${c.perUserLimit}/user` : ""}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => fetchUsage(c.id)} style={{ ...btnSecondary, fontSize: "0.75rem" }}>
                          {c._count?.purchases || 0} uses {showUsageId === c.id ? "▲" : "▼"}
                        </button>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, background: c.isActive ? "#dcfce7" : "#fee2e2", color: c.isActive ? "#166534" : "#991b1b" }}>
                          {c.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          <button onClick={() => openCouponEdit(c)} style={btnSecondary}>Edit</button>
                          <button onClick={() => deleteCoupon(c.id)} style={btnDanger}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Usage detail row */}
              {showUsageId && couponUsage[showUsageId] && (
                <div style={{ margin: "0.75rem 0", padding: "1rem", background: "#f0f9ff", borderRadius: "0.5rem", fontSize: "0.8rem" }}>
                  <strong>Usage Summary:</strong> {couponUsage[showUsageId].totalUses} total uses, {couponUsage[showUsageId].uniqueUsers} unique users
                  {couponUsage[showUsageId].recentPurchases.length > 0 && (
                    <table style={{ width: "100%", marginTop: "0.5rem", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                      <thead><tr><th style={{ ...thStyle, fontSize: "0.7rem" }}>User</th><th style={{ ...thStyle, fontSize: "0.7rem" }}>Package</th><th style={{ ...thStyle, fontSize: "0.7rem" }}>Amount</th><th style={{ ...thStyle, fontSize: "0.7rem" }}>Date</th></tr></thead>
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

          {couponTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
              <button disabled={couponPage <= 1} onClick={() => setCouponPage(p => p - 1)} style={btnSecondary}>Prev</button>
              <span style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>Page {couponPage} of {couponTotalPages}</span>
              <button disabled={couponPage >= couponTotalPages} onClick={() => setCouponPage(p => p + 1)} style={btnSecondary}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* ===== PRODUCT BUILDER TAB ===== */}
      {tab === "products" && (
        <div>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Search by name or code..." value={productSearch} onChange={e => { setProductSearch(e.target.value); setProductPage(1); }} style={{ ...inputStyle, maxWidth: "260px" }} />
            <select value={productActiveFilter} onChange={e => { setProductActiveFilter(e.target.value); setProductPage(1); }} style={{ ...inputStyle, maxWidth: "160px" }}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button onClick={openProductCreate} style={btnPrimary}>+ New Package</button>
            <button onClick={() => { setShowSimPanel(!showSimPanel); setSimResult(null); }} style={{ ...btnPrimary, background: "#7c3aed" }}>Simulate Purchase</button>
          </div>

          {/* Simulate Purchase Panel */}
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

          {loadingProducts ? <p style={{ color: "#999" }}>Loading...</p> : products.length === 0 ? <p style={{ color: "#999" }}>No packages found.</p> : (
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
                          <button onClick={() => openProductEdit(p)} style={btnSecondary}>Edit</button>
                          <button onClick={() => deleteProduct(p.id)} style={btnDanger}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {productTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
              <button disabled={productPage <= 1} onClick={() => setProductPage(p => p - 1)} style={btnSecondary}>Prev</button>
              <span style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>Page {productPage} of {productTotalPages}</span>
              <button disabled={productPage >= productTotalPages} onClick={() => setProductPage(p => p + 1)} style={btnSecondary}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* ===== COUPON MODAL ===== */}
      {showCouponModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", padding: "1.5rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>{editingCoupon ? "Edit Coupon" : "New Coupon"}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Code *</label>
                <input value={couponForm.code} onChange={e => setCouponForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} placeholder="SUMMER_SALE" />
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Discount Type *</label>
                  <select value={couponForm.discountType} onChange={e => setCouponForm(f => ({ ...f, discountType: e.target.value as "PERCENT" | "FLAT" }))} style={inputStyle}>
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FLAT">Flat (Paise)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Value * {couponForm.discountType === "PERCENT" ? "(1-100)" : "(paise)"}</label>
                  <input type="number" value={couponForm.discountValue} onChange={e => setCouponForm(f => ({ ...f, discountValue: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Valid From</label>
                  <input type="datetime-local" value={couponForm.validFrom} onChange={e => setCouponForm(f => ({ ...f, validFrom: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Valid Until</label>
                  <input type="datetime-local" value={couponForm.validUntil} onChange={e => setCouponForm(f => ({ ...f, validUntil: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Usage Limit (total)</label>
                  <input type="number" value={couponForm.usageLimit} onChange={e => setCouponForm(f => ({ ...f, usageLimit: e.target.value }))} style={inputStyle} placeholder="Unlimited" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Per User Limit</label>
                  <input type="number" value={couponForm.perUserLimit} onChange={e => setCouponForm(f => ({ ...f, perUserLimit: e.target.value }))} style={inputStyle} placeholder="Unlimited" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Applicable Entitlements (empty = all)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {ENTITLEMENT_OPTIONS.map(opt => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", cursor: "pointer" }}>
                      <input type="checkbox" checked={couponForm.applicableEntitlements.includes(opt)} onChange={() => toggleEntitlement(opt, couponForm.applicableEntitlements, v => setCouponForm(f => ({ ...f, applicableEntitlements: v })))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                <input type="checkbox" checked={couponForm.isActive} onChange={e => setCouponForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setShowCouponModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveCoupon} disabled={savingCoupon} style={btnPrimary}>{savingCoupon ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PRODUCT MODAL ===== */}
      {showProductModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", padding: "1.5rem", width: "100%", maxWidth: "520px", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>{editingProduct ? "Edit Package" : "New Package"}</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Code *</label>
                <input value={productForm.code} onChange={e => setProductForm(f => ({ ...f, code: e.target.value }))} style={inputStyle} placeholder="PREMIUM_BUNDLE" />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Name *</label>
                <input value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Premium Bundle" />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Description</label>
                <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: "60px" }} />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Price (₹ Rupees) *</label>
                <input type="number" step="0.01" value={productForm.priceRupees} onChange={e => setProductForm(f => ({ ...f, priceRupees: e.target.value }))} style={inputStyle} placeholder="499.00" />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.5rem" }}>Entitlement Codes *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {ENTITLEMENT_OPTIONS.map(opt => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", cursor: "pointer", padding: "0.375rem 0.5rem", background: productForm.entitlementCodes.includes(opt) ? "#e0e7ff" : "#f9fafb", borderRadius: "0.375rem", border: productForm.entitlementCodes.includes(opt) ? "1px solid #818cf8" : "1px solid #e5e7eb" }}>
                      <input type="checkbox" checked={productForm.entitlementCodes.includes(opt)} onChange={() => toggleEntitlement(opt, productForm.entitlementCodes, v => setProductForm(f => ({ ...f, entitlementCodes: v })))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                <input type="checkbox" checked={productForm.isActive} onChange={e => setProductForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setShowProductModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveProduct} disabled={savingProduct} style={btnPrimary}>{savingProduct ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
