"use client";
import { useEffect, useState, useCallback } from "react";

const PURPLE = "#7c3aed";
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:            { label: "Pending",            bg: "#fef9c3", color: "#854d0e" },
  APPROVED:           { label: "Approved",           bg: "#dcfce7", color: "#15803d" },
  PARTIALLY_APPROVED: { label: "Partial",            bg: "#dbeafe", color: "#1d4ed8" },
  REJECTED:           { label: "Rejected",           bg: "#fee2e2", color: "#dc2626" },
  REFUNDED:           { label: "Refunded",           bg: "#f0fdf4", color: "#166534" },
};

type Purchase = { id: string; grossPaise: number; netPaise?: number; feePaise?: number; createdAt: string; package?: { code: string; name: string } | null; coupon?: { code: string } | null };
type RefundUser = { id: string; name: string | null; email: string | null; mobile?: string | null };
type Refund = {
  id: string; purchaseId: string; userId: string; amountPaidPaise: number;
  requestedAt: string; reason: string; consumptionPct: number | null;
  adminRemarks: string | null; approvedPaise: number | null; refundPct: number | null;
  status: string; processedById: string | null; processedAt: string | null;
  createdAt: string; updatedAt: string;
  user: RefundUser;
  processedBy: RefundUser | null;
  purchase: Purchase;
};

const paise = (p: number | null | undefined) => p == null ? "—" : `₹${(p / 100).toFixed(2)}`;
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

const inp: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.25rem" };

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "#f1f5f9", color: "#475569" };
  return <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}

export default function RefundsPage() {
  const [refunds, setRefunds]   = useState<Refund[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [detailModal, setDetailModal]   = useState<Refund | null>(null);
  const [createModal, setCreateModal]   = useState(false);
  const [saving, setSaving]             = useState(false);

  const [editForm, setEditForm] = useState({ status: "", adminRemarks: "", approvedPaise: "", refundPct: "" });
  const [createForm, setCreateForm] = useState({ purchaseId: "", reason: "", consumptionPct: "" });
  const [purchaseLookup, setPurchaseLookup] = useState<Purchase | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupErr, setLookupErr] = useState("");

  const pageSize = 20;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/refunds?${params}`);
    const d = await res.json();
    setLoading(false);
    if (res.ok) { setRefunds(d.data); setTotal(d.meta.total); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openDetail(r: Refund) {
    setDetailModal(r);
    setEditForm({
      status: r.status,
      adminRemarks: r.adminRemarks || "",
      approvedPaise: r.approvedPaise != null ? String(r.approvedPaise / 100) : "",
      refundPct: r.refundPct != null ? String(r.refundPct) : "",
    });
  }

  async function handleLookupPurchase() {
    setLookupErr(""); setPurchaseLookup(null);
    if (!lookupId.trim()) { setLookupErr("Enter a purchase ID"); return; }
    const res = await fetch(`/api/refunds`);
    const existing = await res.json();
    if (existing.data?.some((r: Refund) => r.purchaseId === lookupId.trim())) {
      setLookupErr("A refund already exists for this purchase"); return;
    }
    const r2 = await fetch(`/api/learners/${lookupId.trim().split("-")[0]}`).catch(() => null);
    setPurchaseLookup({ id: lookupId.trim(), grossPaise: 0, createdAt: new Date().toISOString() });
  }

  async function handleCreate() {
    if (!createForm.purchaseId.trim() || !createForm.reason.trim()) {
      showToast("Purchase ID and reason are required", false); return;
    }
    setSaving(true);
    const res = await fetch("/api/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseId: createForm.purchaseId.trim(),
        reason: createForm.reason.trim(),
        consumptionPct: createForm.consumptionPct ? parseFloat(createForm.consumptionPct) : null,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { showToast(d.error || "Failed to create refund", false); return; }
    setCreateModal(false);
    setCreateForm({ purchaseId: "", reason: "", consumptionPct: "" });
    setPurchaseLookup(null); setLookupId(""); setLookupErr("");
    showToast("Refund request created");
    load();
  }

  async function handleUpdate() {
    if (!detailModal) return;
    setSaving(true);
    const res = await fetch(`/api/refunds/${detailModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: editForm.status,
        adminRemarks: editForm.adminRemarks,
        approvedPaise: editForm.approvedPaise ? Math.round(parseFloat(editForm.approvedPaise) * 100) : null,
        refundPct: editForm.refundPct ? parseFloat(editForm.refundPct) : null,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { showToast(d.error || "Failed to update", false); return; }
    setDetailModal(null);
    showToast("Refund updated");
    load();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: toast.ok ? "#15803d" : "#dc2626", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "10px", fontWeight: 600, fontSize: "0.875rem", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Refund Requests</h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>Track and process refund requests. Refund policy: within 3 days of purchase, ≤10% content consumed.</p>
        </div>
        <button onClick={() => setCreateModal(true)} style={{ padding: "0.5rem 1.25rem", background: PURPLE, color: "#fff", border: "none", borderRadius: "7px", cursor: "pointer", fontSize: "0.875rem", fontWeight: 700 }}>
          + Log Refund Request
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ ...inp, width: "auto", minWidth: 160 }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>{total} request{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Learner", "Package", "Paid", "Requested", "Consumption", "Status", "Action"].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
            ) : refunds.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>No refund requests found</td></tr>
            ) : refunds.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{r.user.name || "—"}</div>
                  <div style={{ color: "#64748b", fontSize: "0.72rem" }}>{r.user.email || r.user.mobile || "—"}</div>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{r.purchase.package?.name || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{paise(r.amountPaidPaise)}</td>
                <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{fmtDate(r.requestedAt)}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  {r.consumptionPct != null ? (
                    <span style={{ color: r.consumptionPct > 10 ? "#dc2626" : "#15803d", fontWeight: 600 }}>{r.consumptionPct.toFixed(1)}%</span>
                  ) : <span style={{ color: "#94a3b8" }}>Unknown</span>}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}><StatusBadge status={r.status} /></td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <button onClick={() => openDetail(r)} style={{ padding: "0.3rem 0.75rem", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "#0f172a" }}>
                    Review
                  </button>
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

      {/* ── Detail / Review Modal ────────────────────────────────────────────────── */}
      {detailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 8000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3vh 1rem 2rem", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Refund Request <StatusBadge status={detailModal.status} /></h2>
              <button onClick={() => setDetailModal(null)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Info grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", background: "#f8fafc", borderRadius: "8px", padding: "1rem", border: "1px solid #e2e8f0" }}>
                {[
                  ["Learner",     detailModal.user.name || "—"],
                  ["Email",       detailModal.user.email || detailModal.user.mobile || "—"],
                  ["Package",     detailModal.purchase.package?.name || "—"],
                  ["Amount Paid", paise(detailModal.amountPaidPaise)],
                  ["Purchased On",fmtDate(detailModal.purchase.createdAt)],
                  ["Requested",   fmtDate(detailModal.requestedAt)],
                  ["Consumption", detailModal.consumptionPct != null ? `${detailModal.consumptionPct.toFixed(1)}%` : "Unknown"],
                  ["Legal",       detailModal.purchase.package?.code || "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{k}</div>
                    <div style={{ fontSize: "0.875rem", color: "#0f172a", fontWeight: 500, marginTop: "0.15rem" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Reason */}
              <div style={{ background: "#fffbeb", borderRadius: "8px", padding: "0.875rem", border: "1px solid #fde68a" }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", marginBottom: "0.35rem" }}>Learner Reason</div>
                <div style={{ fontSize: "0.875rem", color: "#0f172a", lineHeight: 1.6 }}>{detailModal.reason}</div>
              </div>

              {/* Admin decision form */}
              {detailModal.status !== "REFUNDED" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", background: "#f0fdf4", borderRadius: "8px", padding: "1rem", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#15803d" }}>Admin Decision</div>

                  <div>
                    <label style={lbl}>Status</label>
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={inp}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  {["APPROVED", "PARTIALLY_APPROVED"].includes(editForm.status) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                      <div>
                        <label style={lbl}>Approved Amount (₹)</label>
                        <input type="number" min="0" step="0.01" value={editForm.approvedPaise} onChange={e => setEditForm({ ...editForm, approvedPaise: e.target.value })} style={inp} placeholder={`max ${(detailModal.amountPaidPaise / 100).toFixed(2)}`} />
                      </div>
                      <div>
                        <label style={lbl}>Refund %</label>
                        <input type="number" min="0" max="100" step="1" value={editForm.refundPct} onChange={e => setEditForm({ ...editForm, refundPct: e.target.value })} style={inp} placeholder="e.g. 80" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={lbl}>Admin Remarks</label>
                    <textarea value={editForm.adminRemarks} onChange={e => setEditForm({ ...editForm, adminRemarks: e.target.value })} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Internal notes (visible to admin only)" />
                  </div>
                </div>
              )}

              {/* Processed info */}
              {detailModal.processedBy && (
                <div style={{ fontSize: "0.72rem", color: "#64748b", padding: "0.5rem", background: "#f8fafc", borderRadius: "6px" }}>
                  Processed by <strong>{detailModal.processedBy.name || detailModal.processedBy.email}</strong> on {fmtDate(detailModal.processedAt)}
                </div>
              )}
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setDetailModal(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>Close</button>
              {detailModal.status !== "REFUNDED" && (
                <button onClick={handleUpdate} disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving…" : "Save Decision"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Refund Modal ──────────────────────────────────────────────────── */}
      {createModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 8000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3vh 1rem 2rem", overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Log Refund Request</h2>
              <button onClick={() => setCreateModal(false)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ padding: "0.75rem", background: "#fffbeb", borderRadius: "7px", border: "1px solid #fde68a", fontSize: "0.8rem", color: "#92400e" }}>
                <strong>Refund Policy Reminder:</strong> Eligible within 3 days of purchase and ≤10% content consumed. Final decision remains at the institution's sole discretion.
              </div>

              <div>
                <label style={lbl}>Purchase ID</label>
                <input value={createForm.purchaseId} onChange={e => setCreateForm({ ...createForm, purchaseId: e.target.value })} style={inp} placeholder="Paste the purchase ID from the learner's profile" />
              </div>

              <div>
                <label style={lbl}>Reason for Refund Request</label>
                <textarea value={createForm.reason} onChange={e => setCreateForm({ ...createForm, reason: e.target.value })} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Describe the reason stated by the learner" />
              </div>

              <div>
                <label style={lbl}>Content Consumption % <span style={{ fontWeight: 400 }}>(at time of request)</span></label>
                <input type="number" min="0" max="100" step="0.1" value={createForm.consumptionPct} onChange={e => setCreateForm({ ...createForm, consumptionPct: e.target.value })} style={{ ...inp, width: "140px" }} placeholder="e.g. 4.5" />
              </div>
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setCreateModal(false)} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ padding: "0.5rem 1.5rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? "Creating…" : "Create Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
