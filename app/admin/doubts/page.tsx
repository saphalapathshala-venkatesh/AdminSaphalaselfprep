"use client";

import React, { useState, useEffect, useCallback } from "react";

const PURPLE = "#7c3aed";

type Doubt = {
  id: string;
  question: string;
  answer: string | null;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  createdAt: string;
  student: { id: string; name: string | null; email: string | null; mobile: string | null };
  video: { id: string; title: string } | null;
  course: { id: string; name: string } | null;
  answeredBy: { id: string; name: string | null; email: string | null } | null;
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  OPEN:     { bg: "#fff7ed", color: "#b45309" },
  ANSWERED: { bg: "#dcfce7", color: "#15803d" },
  CLOSED:   { bg: "#f1f5f9", color: "#64748b" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.OPEN;
  return (
    <span style={{ padding: "2px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };
const inputStyle: React.CSSProperties = { padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff" };

export default function DoubtsPage() {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyStatus, setReplyStatus] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const pageSize = 20;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({
      page: String(page), pageSize: String(pageSize), search,
      ...(statusFilter ? { status: statusFilter } : {}),
    });
    try {
      const res = await fetch(`/api/admin/doubts?${p}`);
      const json = await res.json();
      const data: Doubt[] = json.data || [];
      setDoubts(data);
      setTotal(json.pagination?.total || 0);
      setReplyText(prev => {
        const next = { ...prev };
        data.forEach(d => { if (!(d.id in next)) next[d.id] = d.answer || ""; });
        return next;
      });
      setReplyStatus(prev => {
        const next = { ...prev };
        data.forEach(d => { if (!(d.id in next)) next[d.id] = d.status; });
        return next;
      });
    } catch {
      setDoubts([]);
    }
    setLoading(false);
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(id: string) {
    setSaving(id);
    const answer = replyText[id] ?? "";
    const status = replyStatus[id];
    const res = await fetch(`/api/admin/doubts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, status }),
    });
    const json = await res.json();
    if (res.ok) {
      showToast("Doubt updated");
      setDoubts(prev => prev.map(d => d.id === id ? { ...d, ...json.data } : d));
      setExpanded(null);
    } else {
      showToast(json.error || "Failed to save", false);
    }
    setSaving(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this doubt permanently?")) return;
    const res = await fetch(`/api/admin/doubts/${id}`, { method: "DELETE" });
    if (res.ok) { showToast("Doubt deleted"); load(); }
    else showToast("Failed to delete", false);
  }

  const totalPages = Math.ceil(total / pageSize);

  const openCount = doubts.filter(d => d.status === "OPEN").length;
  const answeredCount = doubts.filter(d => d.status === "ANSWERED").length;

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Student Doubts</h1>
        <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>{total} total doubts</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Open", value: total && statusFilter === "" ? doubts.filter(d => d.status === "OPEN").length : (statusFilter === "OPEN" ? total : openCount), color: "#b45309", bg: "#fff7ed" },
          { label: "Answered", value: statusFilter === "ANSWERED" ? total : answeredCount, color: "#15803d", bg: "#dcfce7" },
          { label: "This Page", value: doubts.length, color: "#475569", bg: "#f1f5f9" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: "10px", padding: "1rem 1.25rem", border: `1px solid ${c.color}22` }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: c.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.color, marginTop: "0.2rem" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search questions…"
            style={{ ...inputStyle, flex: "1 1 200px", minWidth: 160 }}
          />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ANSWERED">Answered</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : doubts.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            No doubts found{statusFilter ? ` with status "${statusFilter}"` : ""}.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Status", "Student", "Question", "Context", "Date", "Actions"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doubts.map(d => (
                  <React.Fragment key={d.id}>
                    <tr
                      style={{ cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = expanded === d.id ? "#f0f4ff" : "")}
                    >
                      <td style={tdStyle}><StatusBadge status={d.status} /></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{d.student.name || "—"}</div>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{d.student.email || d.student.mobile || "—"}</div>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 320 }}>
                        <div style={{ color: "#0f172a", lineHeight: 1.4 }}>
                          {d.question.length > 120 ? d.question.slice(0, 120) + "…" : d.question}
                        </div>
                        {d.answer && (
                          <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "#64748b", fontStyle: "italic" }}>
                            ↳ {d.answer.slice(0, 80)}{d.answer.length > 80 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: "#64748b" }}>
                        {d.video && <div style={{ fontSize: "0.8rem" }}>🎬 {d.video.title}</div>}
                        {d.course && <div style={{ fontSize: "0.8rem" }}>📚 {d.course.name}</div>}
                        {!d.video && !d.course && <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: "#64748b", whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                        {new Date(d.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                            style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}
                          >
                            {expanded === d.id ? "Collapse" : "Reply"}
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expanded === d.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: "1.25rem 1.5rem", background: "#f0f4ff", borderBottom: "1px solid #e2e8f0" }}>
                          <div style={{ maxWidth: 720 }}>
                            <div style={{ marginBottom: "0.75rem" }}>
                              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>Full Question</div>
                              <p style={{ margin: 0, lineHeight: 1.6, color: "#0f172a", whiteSpace: "pre-wrap" }}>{d.question}</p>
                            </div>
                            <div style={{ marginBottom: "0.75rem" }}>
                              <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.35rem" }}>
                                Admin Reply
                              </label>
                              <textarea
                                value={replyText[d.id] ?? d.answer ?? ""}
                                onChange={e => setReplyText(prev => ({ ...prev, [d.id]: e.target.value }))}
                                rows={4}
                                placeholder="Type your answer here…"
                                style={{ width: "100%", padding: "0.625rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                              />
                            </div>
                            <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                              <div>
                                <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "0.25rem" }}>Status</label>
                                <select
                                  value={replyStatus[d.id] ?? d.status}
                                  onChange={e => setReplyStatus(prev => ({ ...prev, [d.id]: e.target.value }))}
                                  style={{ ...inputStyle, fontSize: "0.8125rem" }}
                                >
                                  <option value="OPEN">Open</option>
                                  <option value="ANSWERED">Answered</option>
                                  <option value="CLOSED">Closed</option>
                                </select>
                              </div>
                              <div style={{ marginTop: "auto" }}>
                                <button
                                  onClick={() => handleSave(d.id)}
                                  disabled={saving === d.id}
                                  style={{ padding: "0.5rem 1.5rem", borderRadius: "6px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: saving === d.id ? "not-allowed" : "pointer", opacity: saving === d.id ? 0.7 : 1 }}
                                >
                                  {saving === d.id ? "Saving…" : "Save Reply"}
                                </button>
                              </div>
                              {d.answeredBy && (
                                <div style={{ marginTop: "auto", fontSize: "0.78rem", color: "#64748b" }}>
                                  Answered by {d.answeredBy.name || d.answeredBy.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "1rem 1.25rem", borderTop: "1px solid #f1f5f9", justifyContent: "flex-end" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>← Prev</button>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
