"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const PURPLE = "#7c3aed";
const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };
const inputStyle: React.CSSProperties = { padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff" };

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT:      { bg: "#f1f5f9", color: "#64748b" },
  SCHEDULED:  { bg: "#dbeafe", color: "#1d4ed8" },
  PUBLISHED:  { bg: "#dcfce7", color: "#15803d" },
  COMPLETED:  { bg: "#e0e7ff", color: "#4338ca" },
  CANCELLED:  { bg: "#fee2e2", color: "#991b1b" },
};

type LiveClass = {
  id: string; title: string; status: string; platform: string;
  sessionDate: string | null; startTime: string | null; endTime: string | null;
  accessType: string; faculty?: { name: string } | null;
  course?: { name: string } | null; notifyLearners: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.DRAFT;
  return <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function LiveClassesPage() {
  const [sessions, setSessions] = useState<LiveClass[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pageSize = 20;

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, ...(statusFilter ? { status: statusFilter } : {}), ...(platformFilter ? { platform: platformFilter } : {}) });
    const res = await fetch(`/api/live-classes?${p}`);
    const json = await res.json();
    setSessions(json.data || []);
    setTotal(json.pagination?.total || 0);
    setLoading(false);
  }, [page, search, statusFilter, platformFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await fetch(`/api/live-classes/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) { showToast("Session deleted"); setConfirmId(null); load(); }
    else showToast(json.error || "Failed", false);
    setDeleting(false);
  }

  const totalPages = Math.ceil(total / pageSize);

  const statusCounts = {
    upcoming: sessions.filter(s => s.status === "SCHEDULED" || s.status === "PUBLISHED").length,
    completed: sessions.filter(s => s.status === "COMPLETED").length,
    draft: sessions.filter(s => s.status === "DRAFT").length,
  };

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}

      {confirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Delete Session?</h3>
            <p style={{ margin: "0 0 1.5rem", color: "#64748b", fontSize: "0.875rem" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmId(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(confirmId)} disabled={deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Live Classes</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>{total} session{total !== 1 ? "s" : ""} total</p>
        </div>
        <Link href="/admin/live-classes/new" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
          + New Session
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Upcoming / Live", value: statusCounts.upcoming, color: "#1d4ed8" },
          { label: "Completed", value: statusCounts.completed, color: "#4338ca" },
          { label: "Draft", value: statusCounts.draft, color: "#64748b" },
        ].map(card => (
          <div key={card.label} style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: card.color, marginTop: "0.25rem" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search sessions…" style={{ ...inputStyle, width: 240 }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">All statuses</option>
            {["DRAFT","SCHEDULED","PUBLISHED","COMPLETED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={platformFilter} onChange={e => { setPlatformFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">All platforms</option>
            {["ZOOM","YOUTUBE_LIVE","OTHER"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
            <Link href="/admin/live-classes/calendar" style={{ ...inputStyle, textDecoration: "none", color: "#475569", display: "flex", alignItems: "center" }}>Calendar</Link>
            <Link href="/admin/live-classes/faculty" style={{ ...inputStyle, textDecoration: "none", color: "#475569", display: "flex", alignItems: "center" }}>Faculty</Link>
            <Link href="/admin/live-classes/recordings" style={{ ...inputStyle, textDecoration: "none", color: "#475569", display: "flex", alignItems: "center" }}>Recordings</Link>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            No sessions found.{" "}
            <Link href="/admin/live-classes/new" style={{ color: PURPLE }}>Schedule one</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Title","Status","Date","Time","Platform","Faculty","Course","Access","Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 260 }}>
                      <Link href={`/admin/live-classes/${s.id}`} style={{ color: "#0f172a", textDecoration: "none" }}>{s.title}</Link>
                      {s.notifyLearners && <span style={{ marginLeft: 6, fontSize: "0.65rem", padding: "1px 5px", borderRadius: "3px", background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>NOTIFY</span>}
                    </td>
                    <td style={tdStyle}><StatusBadge status={s.status} /></td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{formatDate(s.sessionDate)}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime || "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{s.platform.replace("_", " ")}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{s.faculty?.name || "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{s.course?.name || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: s.accessType === "FREE" ? "#1d4ed8" : PURPLE }}>{s.accessType}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link href={`/admin/live-classes/${s.id}`} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>Edit</Link>
                        <button onClick={() => setConfirmId(s.id)} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Delete</button>
                      </div>
                    </td>
                  </tr>
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
