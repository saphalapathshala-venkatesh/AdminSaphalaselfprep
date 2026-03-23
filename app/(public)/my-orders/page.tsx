"use client";
/**
 * Student "My Orders" page — /my-orders
 *
 * Shows the authenticated student's PAID orders and allows them to
 * submit a refund request for eligible orders.
 *
 * Eligibility (enforced on the server too):
 * - Order status must be PAID
 * - No currently open refund request (REQUESTED / UNDER_REVIEW / APPROVED)
 */
import { useEffect, useState } from "react";

const REASON_CATEGORIES = [
  { value: "CHANGED_MIND",             label: "Changed My Mind" },
  { value: "TECHNICAL_ISSUE",          label: "Technical Issue" },
  { value: "CONTENT_NOT_AS_DESCRIBED", label: "Content Not As Described" },
  { value: "DUPLICATE_PURCHASE",       label: "Duplicate Purchase" },
  { value: "COURSE_NOT_STARTED",       label: "Course Not Started Yet" },
  { value: "OTHER",                    label: "Other" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  REQUESTED:    { label: "Refund Requested",    bg: "#fef9c3", color: "#854d0e" },
  UNDER_REVIEW: { label: "Under Review",        bg: "#dbeafe", color: "#1d4ed8" },
  APPROVED:     { label: "Approved",            bg: "#dcfce7", color: "#15803d" },
  REJECTED:     { label: "Rejected",            bg: "#fee2e2", color: "#dc2626" },
  PROCESSED:    { label: "Refund Processed",    bg: "#f0fdf4", color: "#166534" },
  FAILED:       { label: "Processing Failed",   bg: "#fce7f3", color: "#9d174d" },
  CANCELLED:    { label: "Cancelled",           bg: "#f1f5f9", color: "#475569" },
};

const paise   = (p: number | null | undefined) => p == null ? "—" : `₹${(p / 100).toFixed(2)}`;
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—";

type Order = {
  orderId: string;
  status: string;
  amountPaise: number;
  currency: string;
  paidAt: string | null;
  package: { id: string; name: string } | null;
  existingRefundRequest?: { id: string; status: string } | null;
};

const inp: React.CSSProperties = { width: "100%", padding: "0.55rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "7px", fontSize: "0.9rem", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.35rem" };

export default function MyOrdersPage() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Refund form state
  const [refundOrder, setRefundOrder]    = useState<Order | null>(null);
  const [reasonCategory, setReasonCategory] = useState("CHANGED_MIND");
  const [reasonText, setReasonText]      = useState("");
  const [submitting, setSubmitting]      = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      // Load paid orders
      const res = await fetch("/api/student/orders?status=PAID&limit=50");
      if (!res.ok) { setError("Failed to load orders"); setLoading(false); return; }
      const d = await res.json();
      const paidOrders: Order[] = (d.data || []);

      // Load refund requests to annotate each order
      const rrRes = await fetch("/api/student/refund-requests?limit=50");
      const rrData = rrRes.ok ? await rrRes.json() : { data: [] };
      const rrMap: Record<string, { id: string; status: string }> = {};
      for (const rr of (rrData.data || [])) {
        if (rr.paymentOrder?.id) rrMap[rr.paymentOrder.id] = { id: rr.id, status: rr.status };
      }

      setOrders(paidOrders.map((o: Order) => ({ ...o, existingRefundRequest: rrMap[o.orderId] ?? null })));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const openRefundForm = (order: Order) => {
    setRefundOrder(order);
    setReasonCategory("CHANGED_MIND");
    setReasonText("");
  };

  const handleSubmitRefund = async () => {
    if (!refundOrder) return;
    if (!reasonText.trim()) { showToast("Please describe your reason", false); return; }
    setSubmitting(true);
    const res = await fetch("/api/student/refund-requests", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        paymentOrderId: refundOrder.orderId,
        reasonCategory,
        reasonText: reasonText.trim(),
      }),
    });
    const d = await res.json();
    setSubmitting(false);
    if (!res.ok) { showToast(d.error || "Failed to submit refund request", false); return; }
    setRefundOrder(null);
    showToast("Refund request submitted. We'll review it within 3-5 business days.");
    loadOrders();
  };

  const OPEN_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED"];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {toast && (
          <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: toast.ok ? "#15803d" : "#dc2626", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "10px", fontWeight: 600, fontSize: "0.875rem", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}>
            {toast.msg}
          </div>
        )}

        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" }}>My Orders</h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1.75rem" }}>
          Your completed purchases. You can request a refund within our refund policy window.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>Loading your orders…</div>
        ) : error ? (
          <div style={{ background: "#fee2e2", borderRadius: "10px", padding: "1.25rem", color: "#dc2626" }}>{error}</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            No completed purchases yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {orders.map(order => {
              const rr = order.existingRefundRequest;
              const hasOpenRefund = rr && OPEN_STATUSES.includes(rr.status);
              const rrCfg = rr ? STATUS_CONFIG[rr.status] : null;

              return (
                <div key={order.orderId} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>
                        {order.package?.name || "Package"}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                        Paid {paise(order.amountPaise)} on {fmtDate(order.paidAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {rrCfg && (
                        <span style={{ padding: "0.25rem 0.7rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 700, background: rrCfg.bg, color: rrCfg.color }}>
                          {rrCfg.label}
                        </span>
                      )}
                      {!hasOpenRefund && (
                        <button
                          onClick={() => openRefundForm(order)}
                          style={{ padding: "0.4rem 1rem", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: "7px", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600, color: "#475569" }}
                        >
                          Request Refund
                        </button>
                      )}
                    </div>
                  </div>
                  {rr && rr.status === "REJECTED" && (
                    <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "#fee2e2", borderRadius: "6px", fontSize: "0.8125rem", color: "#dc2626" }}>
                      Your previous refund request was rejected. You may submit a new request if applicable.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Refund Request Modal */}
      {refundOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Request Refund</h2>
              <button onClick={() => setRefundOrder(null)} style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.125rem" }}>
              <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "0.875rem", border: "1px solid #e2e8f0", fontSize: "0.875rem" }}>
                <div style={{ fontWeight: 700, color: "#0f172a" }}>{refundOrder.package?.name}</div>
                <div style={{ color: "#64748b", marginTop: "0.25rem" }}>Amount paid: <strong>{paise(refundOrder.amountPaise)}</strong></div>
              </div>

              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "7px", padding: "0.75rem", fontSize: "0.8125rem", color: "#92400e" }}>
                <strong>Refund Policy:</strong> Refunds are eligible within 3 days of purchase with ≤10% content consumed. Approved refunds will be processed within 5–7 business days. Final decisions are at the institution's discretion.
              </div>

              <div>
                <label style={lbl}>Reason Category</label>
                <select value={reasonCategory} onChange={e => setReasonCategory(e.target.value)} style={inp}>
                  {REASON_CATEGORIES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label style={lbl}>Please explain your situation <span style={{ color: "#dc2626" }}>*</span></label>
                <textarea
                  value={reasonText}
                  onChange={e => setReasonText(e.target.value)}
                  rows={4}
                  style={{ ...inp, resize: "vertical" }}
                  placeholder="Describe why you're requesting a refund. Be as specific as possible."
                />
              </div>
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setRefundOrder(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>
                Cancel
              </button>
              <button
                onClick={handleSubmitRefund}
                disabled={submitting}
                style={{ padding: "0.5rem 1.5rem", borderRadius: "7px", border: "none", background: "#7c3aed", color: "#fff", cursor: submitting ? "not-allowed" : "pointer", fontSize: "0.875rem", fontWeight: 700, opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
