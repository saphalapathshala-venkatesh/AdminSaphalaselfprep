"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

// Which target statuses are available from each current status
const NEXT_STATUSES: Record<string, string[]> = {
  REQUESTED:    ["UNDER_REVIEW", "REJECTED", "CANCELLED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED:     ["PROCESSED", "FAILED", "CANCELLED"],
  FAILED:       ["APPROVED"],
  PROCESSED:    [],
  REJECTED:     [],
  CANCELLED:    [],
};

const TERMINAL = ["PROCESSED", "REJECTED", "CANCELLED"];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: 700, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

const paise   = (p: number | null | undefined) => p == null ? "—" : `₹${(p / 100).toFixed(2)}`;
const fmtDate = (s: string | null | undefined) => s ? new Date(s).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" }) : "—";
const inp: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box" };
const lbl: React.CSSProperties = { fontSize: "0.75rem", fontWeight: 700, color: "#64748b", display: "block", marginBottom: "0.35rem" };

type RR = {
  id: string; status: string; reasonCategory: string; reasonText: string;
  paidPaise: number; requestedPaise: number | null; approvedPaise: number | null;
  packageId: string | null; packageName: string | null; packageCode: string | null;
  adminNote: string | null;
  reviewedAt: string | null; processedAt: string | null;
  createdAt: string; updatedAt: string;
  user:         { id: string; name: string | null; email: string | null; mobile: string | null };
  reviewedBy:   { id: string; name: string | null; email: string | null } | null;
  processedBy:  { id: string; name: string | null; email: string | null } | null;
  paymentOrder: {
    id: string; finalAmountPaise: number; grossPaise: number; discountPaise: number;
    paidAt: string | null; providerOrderId: string | null; providerPaymentId: string | null; currency: string;
    package: { id: string; name: string; code: string } | null;
  };
};

export default function RefundRequestDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [rr, setRr]         = useState<RR | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    status:        "",
    adminNote:     "",
    approvedPaise: "",
  });

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/refund-requests/${id}`);
    const d   = await res.json();
    setLoading(false);
    if (!res.ok) { showToast(d.error || "Failed to load", false); return; }
    const r: RR = d.data;
    setRr(r);
    setForm({
      status:        r.status,
      adminNote:     r.adminNote || "",
      approvedPaise: r.approvedPaise != null ? String(r.approvedPaise / 100) : "",
    });
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!rr) return;
    setSaving(true);
    const payload: any = {
      status:    form.status,
      adminNote: form.adminNote,
    };
    if (form.approvedPaise) payload.approvedPaise = Math.round(parseFloat(form.approvedPaise) * 100);

    const res = await fetch(`/api/admin/refund-requests/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { showToast(d.error || "Failed to save", false); return; }
    showToast("Decision saved");
    setRr(d.data);
    setForm({
      status:        d.data.status,
      adminNote:     d.data.adminNote || "",
      approvedPaise: d.data.approvedPaise != null ? String(d.data.approvedPaise / 100) : "",
    });
  };

  const isTerminal    = rr ? TERMINAL.includes(rr.status) : false;
  const nextStatuses  = rr ? (NEXT_STATUSES[rr.status] ?? []) : [];
  const needsApproval = ["APPROVED", "PROCESSED"].includes(form.status);

  if (loading) return <div style={{ padding: "2rem", color: "#64748b" }}>Loading…</div>;
  if (!rr)     return <div style={{ padding: "2rem", color: "#dc2626" }}>Refund request not found.</div>;

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999, background: toast.ok ? "#15803d" : "#dc2626", color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "10px", fontWeight: 600, fontSize: "0.875rem", boxShadow: "0 4px 20px rgba(0,0,0,0.18)" }}>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem", fontSize: "0.8125rem", color: "#64748b" }}>
        <button onClick={() => router.push("/admin/refund-requests")} style={{ background: "none", border: "none", cursor: "pointer", color: PURPLE, fontWeight: 600, padding: 0, fontSize: "0.8125rem" }}>
          ← Refund Requests
        </button>
        <span>/</span>
        <span>{rr.id.slice(-8)}</span>
      </div>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800, color: "#0f172a" }}>Refund Request</h1>
        <StatusBadge status={rr.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Student info */}
          <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learner</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>NAME</span><div style={{ fontWeight: 600, color: "#0f172a" }}>{rr.user.name || "—"}</div></div>
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>EMAIL</span><div style={{ color: "#475569" }}>{rr.user.email || "—"}</div></div>
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>MOBILE</span><div style={{ color: "#475569" }}>{rr.user.mobile || "—"}</div></div>
            </div>
          </section>

          {/* Payment order info */}
          <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>PACKAGE</span><div style={{ fontWeight: 600, color: "#0f172a" }}>{rr.packageName || rr.paymentOrder.package?.name || "—"}</div></div>
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>AMOUNT PAID</span><div style={{ fontWeight: 700, fontSize: "1.125rem", color: "#0f172a" }}>{paise(rr.paidPaise)}</div></div>
              {rr.paymentOrder.discountPaise > 0 && (
                <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>GROSS / DISCOUNT</span><div style={{ color: "#475569" }}>{paise(rr.paymentOrder.grossPaise)} − {paise(rr.paymentOrder.discountPaise)}</div></div>
              )}
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>PAID ON</span><div style={{ color: "#475569" }}>{fmtDate(rr.paymentOrder.paidAt)}</div></div>
              {rr.paymentOrder.providerOrderId && (
                <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>GATEWAY ORDER</span><div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#64748b" }}>{rr.paymentOrder.providerOrderId}</div></div>
              )}
              {rr.paymentOrder.providerPaymentId && (
                <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>GATEWAY PAYMENT</span><div style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#64748b" }}>{rr.paymentOrder.providerPaymentId}</div></div>
              )}
              <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>REQUEST SUBMITTED</span><div style={{ color: "#475569" }}>{fmtDate(rr.createdAt)}</div></div>
            </div>
          </section>

          {/* Student reason */}
          <section style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>Student Reason</h3>
            <div style={{ marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e" }}>CATEGORY</span>
              <div style={{ fontWeight: 600, color: "#78350f", marginTop: "0.15rem" }}>
                {REASON_LABELS[rr.reasonCategory] || rr.reasonCategory}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400e" }}>EXPLANATION</span>
              <div style={{ marginTop: "0.25rem", color: "#0f172a", lineHeight: 1.65, fontSize: "0.875rem" }}>{rr.reasonText}</div>
            </div>
            {rr.requestedPaise != null && (
              <div style={{ marginTop: "0.75rem", padding: "0.5rem 0.75rem", background: "#fef3c7", borderRadius: "6px", fontSize: "0.8125rem" }}>
                Student requested: <strong>{paise(rr.requestedPaise)}</strong>
              </div>
            )}
          </section>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Admin decision panel */}
          <section style={{ background: isTerminal ? "#f8fafc" : "#f0fdf4", border: `1px solid ${isTerminal ? "#e2e8f0" : "#bbf7d0"}`, borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 700, color: isTerminal ? "#475569" : "#15803d", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {isTerminal ? "Decision (finalised)" : "Admin Decision"}
            </h3>

            {isTerminal ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>STATUS</span><div style={{ marginTop: "0.15rem" }}><StatusBadge status={rr.status} /></div></div>
                {rr.approvedPaise != null && <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>APPROVED AMOUNT</span><div style={{ fontWeight: 700, color: "#15803d" }}>{paise(rr.approvedPaise)}</div></div>}
                {rr.adminNote && <div><span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700 }}>ADMIN NOTE</span><div style={{ color: "#0f172a", fontSize: "0.875rem", lineHeight: 1.6 }}>{rr.adminNote}</div></div>}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={lbl}>Update Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    style={inp}
                    disabled={isTerminal}
                  >
                    <option value={rr.status}>{STATUS_CONFIG[rr.status]?.label || rr.status} (current)</option>
                    {nextStatuses.map(s => (
                      <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                    ))}
                  </select>
                </div>

                {needsApproval && (
                  <div>
                    <label style={lbl}>Approved Amount (₹) <span style={{ color: "#dc2626" }}>*</span></label>
                    <input
                      type="number" min="0" step="0.01"
                      max={(rr.paidPaise / 100).toFixed(2)}
                      value={form.approvedPaise}
                      onChange={e => setForm({ ...form, approvedPaise: e.target.value })}
                      style={inp}
                      placeholder={`max ₹${(rr.paidPaise / 100).toFixed(2)}`}
                    />
                  </div>
                )}

                <div>
                  <label style={lbl}>Admin Note</label>
                  <textarea
                    value={form.adminNote}
                    onChange={e => setForm({ ...form, adminNote: e.target.value })}
                    rows={4}
                    style={{ ...inp, resize: "vertical" }}
                    placeholder="Internal note — visible to admin only. Explain the decision."
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: "0.6rem 1.5rem", background: PURPLE, color: "#fff", border: "none", borderRadius: "8px", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: "0.875rem", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Saving…" : "Save Decision"}
                </button>
              </div>
            )}
          </section>

          {/* Audit trail */}
          <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "0.875rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Timeline</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.8125rem" }}>
              <div>
                <div style={{ fontWeight: 600, color: "#0f172a" }}>Submitted by student</div>
                <div style={{ color: "#64748b", marginTop: "0.1rem" }}>{fmtDate(rr.createdAt)}</div>
              </div>
              {rr.reviewedAt && (
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>Reviewed by {rr.reviewedBy?.name || rr.reviewedBy?.email || "admin"}</div>
                  <div style={{ color: "#64748b", marginTop: "0.1rem" }}>{fmtDate(rr.reviewedAt)}</div>
                </div>
              )}
              {rr.processedAt && (
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>Processed by {rr.processedBy?.name || rr.processedBy?.email || "admin"}</div>
                  <div style={{ color: "#64748b", marginTop: "0.1rem" }}>{fmtDate(rr.processedAt)}</div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
