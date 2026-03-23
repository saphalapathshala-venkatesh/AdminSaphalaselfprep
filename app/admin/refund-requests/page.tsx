"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  REQUESTED:    { label: "Requested",    bg: "#fef9c3", color: "#854d0e" },
  UNDER_REVIEW: { label: "Under Review", bg: "#dbeafe", color: "#1d4ed8" },
  APPROVED:     { label: "Approved",     bg: "#dcfce7", color: "#15803d" },
  REJECTED:     { label: "Rejected",     bg: "#fee2e2", color: "#dc2626" },
  PROCESSED:    { label: "Processed",    bg: "#f0fdf4", color: "#166534" },
  FAILED:       { label: "Failed",       bg: "#fce7f3", color: "#9d174d" },
  CANCELLED:    { label: "Cancelled",    bg: "#f1f5f9", color: "#475569" },
};

const REASON_LABELS: Record<string, string> = {
  CHANGED_MIND:              "Changed Mind",
  TECHNICAL_ISSUE:           "Technical Issue",
  CONTENT_NOT_AS_DESCRIBED:  "Content Mismatch",
  DUPLICATE_PURCHASE:        "Duplicate Purchase",
  COURSE_NOT_STARTED:        "Course Not Started",
  OTHER:                     "Other",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

const paise = (p: number | null | undefined) => p == null ? "—" : `₹${(p / 100).toFixed(2)}`;
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const inp: React.CSSProperties = { padding: "0.45rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem" };

type RR = {
  id: string; status: string; reasonCategory: string;
  paidPaise: number; approvedPaise: number | null; requestedPaise: number | null;
  packageName: string | null; packageCode: string | null;
  createdAt: string; reviewedAt: string | null; processedAt: string | null;
  user: { id: string; name: string | null; email: string | null; mobile: string | null };
  reviewedBy:  { id: string; name: string | null; email: string | null } | null;
  processedBy: { id: string; name: string | null; email: string | null } | null;
  paymentOrder: { id: string; finalAmountPaise: number; paidAt: string | null; providerOrderId: string | null };
};

export default function RefundRequestsListPage() {
  const [rows, setRows]         = useState<RR[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatus] = useState("");
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/admin/refund-requests?${params}`);
    const d   = await res.json();
    setLoading(false);
    if (res.ok) { setRows(d.data); setTotal(d.meta.total); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Refund Requests</h1>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
          Student-initiated refund requests. Click a row to review and take action.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
        <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ ...inp, minWidth: 160 }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>{total} request{total !== 1 ? "s" : ""}</span>
        <button onClick={load} style={{ ...inp, background: "#f1f5f9", border: "1px solid #e2e8f0", cursor: "pointer", fontWeight: 600 }}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Learner", "Package", "Paid Amount", "Reason", "Status", "Submitted", "Action"].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>No refund requests found</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.user.name || "—"}</div>
                  <div style={{ color: "#64748b", fontSize: "0.72rem" }}>{r.user.email || r.user.mobile || "—"}</div>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                  <div>{r.packageName || "—"}</div>
                  {r.packageCode && <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{r.packageCode}</div>}
                </td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>
                  {paise(r.paidPaise)}
                  {r.approvedPaise != null && (
                    <div style={{ fontSize: "0.72rem", color: "#15803d" }}>Approved: {paise(r.approvedPaise)}</div>
                  )}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                  {REASON_LABELS[r.reasonCategory] || r.reasonCategory}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: "0.75rem 1rem", color: "#64748b", fontSize: "0.75rem" }}>{fmtDate(r.createdAt)}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Link
                    href={`/admin/refund-requests/${r.id}`}
                    style={{ padding: "0.3rem 0.75rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 600, color: "#0f172a", textDecoration: "none", display: "inline-block" }}
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1.25rem" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.4rem 0.9rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>‹</button>
          <span style={{ padding: "0.4rem 0.75rem", fontSize: "0.8125rem", color: "#475569" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "0.4rem 0.9rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}>›</button>
        </div>
      )}
    </div>
  );
}
