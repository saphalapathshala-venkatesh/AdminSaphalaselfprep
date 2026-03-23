"use client";
import { useEffect, useState, useCallback } from "react";

const PURPLE = "#7c3aed";
const GRAY   = "#6b7280";

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PAID:      { bg: "#dcfce7", color: "#15803d", label: "Paid" },
  PENDING:   { bg: "#fef9c3", color: "#a16207", label: "Pending" },
  CREATED:   { bg: "#e0f2fe", color: "#0369a1", label: "Created" },
  FAILED:    { bg: "#fee2e2", color: "#b91c1c", label: "Failed" },
  CANCELLED: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelled" },
};

type Order = {
  id: string; status: string; provider: string;
  finalAmountPaise: number; grossPaise: number; discountPaise: number; currency: string;
  providerOrderId: string | null; providerPaymentId: string | null; purchaseId: string | null;
  paidAt: string | null; createdAt: string;
  user: { id: string; email: string; fullName: string | null; mobile: string | null };
  package: { id: string; name: string; code: string };
  coupon: { id: string; code: string } | null;
  paymentConfig: { id: string; displayName: string; environment: string } | null;
};

type Summary = { total: number; paid: number; pending: number; failed: number };

function formatAmount(paise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 0 }).format(paise / 100);
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || { bg: "#f3f4f6", color: "#6b7280", label: status };
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>{s.label}</span>;
}

export default function AdminOrdersPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]     = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async (page = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const r = await fetch(`/api/admin/orders?${params}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setOrders(j.data);
      setPagination(j.pagination);
      setSummary(j.summary);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(1); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111", marginBottom: "0.25rem" }}>Payment Orders</h1>
      <p style={{ color: GRAY, fontSize: "0.875rem", marginBottom: "1.5rem" }}>Full history of all payment attempts and their lifecycle status.</p>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total Orders", value: summary.total, color: "#111" },
            { label: "Paid", value: summary.paid, color: "#15803d" },
            { label: "Pending", value: summary.pending, color: "#a16207" },
            { label: "Failed", value: summary.failed, color: "#b91c1c" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: "0.8125rem", color: GRAY, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem" }}>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search by email, name, or order ID…"
            style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.875rem", width: 280 }} />
          <button type="submit" style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.4rem 1rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>Search</button>
          {search && <button type="button" onClick={() => { setSearch(""); setSearchInput(""); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.875rem", cursor: "pointer" }}>Clear</button>}
        </form>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "0.4rem 0.75rem", fontSize: "0.875rem", color: "#374151" }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem" }}>{error}</div>}

      {loading ? (
        <div style={{ color: GRAY, padding: "3rem", textAlign: "center" }}>Loading orders…</div>
      ) : orders.length === 0 ? (
        <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 12, padding: "3rem", textAlign: "center", color: GRAY }}>
          No orders found {statusFilter && `with status "${statusFilter}"`}{search && ` matching "${search}"`}.
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Order ID", "Learner", "Package", "Amount", "Status", "Provider / Config", "Created", "Paid At"].map(h => (
                    <th key={h} style={{ padding: "0.625rem 0.875rem", textAlign: "left", fontWeight: 600, color: GRAY, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "0.625rem 0.875rem", fontFamily: "monospace", color: "#6b7280", fontSize: "0.75rem" }}>
                      <span title={o.id}>{o.id.slice(0, 12)}…</span>
                      {o.providerOrderId && <div style={{ color: "#9ca3af", fontSize: "0.7rem" }} title={o.providerOrderId}>CF: {o.providerOrderId.slice(0, 14)}…</div>}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem" }}>
                      <div style={{ fontWeight: 600, color: "#111" }}>{o.user.fullName || o.user.email.split("@")[0]}</div>
                      <div style={{ color: GRAY, fontSize: "0.75rem" }}>{o.user.email}</div>
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem" }}>
                      <div style={{ fontWeight: 500, color: "#111" }}>{o.package.name}</div>
                      <div style={{ color: GRAY, fontSize: "0.75rem" }}>{o.package.code}</div>
                      {o.coupon && <div style={{ color: "#7c3aed", fontSize: "0.75rem", marginTop: 2 }}>Coupon: {o.coupon.code}</div>}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", whiteSpace: "nowrap" }}>
                      <div style={{ fontWeight: 700, color: "#111" }}>{formatAmount(o.finalAmountPaise, o.currency)}</div>
                      {o.discountPaise > 0 && <div style={{ color: "#16a34a", fontSize: "0.75rem" }}>−{formatAmount(o.discountPaise, o.currency)}</div>}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem" }}><StatusBadge status={o.status} /></td>
                    <td style={{ padding: "0.625rem 0.875rem" }}>
                      <div style={{ color: "#374151" }}>{o.provider}</div>
                      {o.paymentConfig && (
                        <div style={{ color: GRAY, fontSize: "0.75rem" }}>
                          {o.paymentConfig.displayName}
                          <span style={{ marginLeft: 4, background: o.paymentConfig.environment === "PROD" ? "#fef3c7" : "#dbeafe", color: o.paymentConfig.environment === "PROD" ? "#92400e" : "#1e40af", borderRadius: 4, padding: "1px 5px", fontSize: "0.7rem" }}>{o.paymentConfig.environment}</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.625rem 0.875rem", color: GRAY, whiteSpace: "nowrap" }}>{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td style={{ padding: "0.625rem 0.875rem", color: o.paidAt ? "#15803d" : GRAY, whiteSpace: "nowrap" }}>
                      {o.paidAt ? new Date(o.paidAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem" }}>
              <span style={{ color: GRAY, fontSize: "0.875rem" }}>
                Page {pagination.page} of {pagination.totalPages} — {pagination.total.toLocaleString()} orders
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => load(pagination.page - 1)} disabled={pagination.page <= 1}
                  style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "0.375rem 0.875rem", cursor: "pointer", opacity: pagination.page <= 1 ? 0.4 : 1 }}>← Prev</button>
                <button onClick={() => load(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
                  style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "0.375rem 0.875rem", cursor: "pointer", opacity: pagination.page >= pagination.totalPages ? 0.4 : 1 }}>Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
