"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const PURPLE = "#7c3aed";

type StatusBadgeProps = { status: string };
function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<string, { bg: string; color: string }> = {
    DRAFT:      { bg: "#f1f5f9", color: "#64748b" },
    UPLOADING:  { bg: "#dbeafe", color: "#1d4ed8" },
    PROCESSING: { bg: "#fef3c7", color: "#b45309" },
    READY:      { bg: "#d1fae5", color: "#065f46" },
    PUBLISHED:  { bg: "#dcfce7", color: "#15803d" },
    ARCHIVED:   { bg: "#f1f5f9", color: "#475569" },
    FAILED:     { bg: "#fee2e2", color: "#991b1b" },
  };
  const s = map[status] || map.DRAFT;
  return (
    <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

type Video = {
  id: string; title: string; status: string; accessType: string;
  provider: string; durationSeconds: number | null;
  xpEnabled: boolean; xpValue: number;
  faculty?: { name: string } | null; course?: { name: string } | null;
  createdAt: string;
};

type XpEdit = { enabled: boolean; value: string; dirty: boolean; saving: boolean };

const inputStyle: React.CSSProperties = { padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", background: "#fff" };
const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [xpEdits, setXpEdits] = useState<Record<string, XpEdit>>({});
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
      ...(providerFilter ? { provider: providerFilter } : {}),
    });
    const res = await fetch(`/api/videos?${p}`);
    const json = await res.json();
    const data: Video[] = json.data || [];
    setVideos(data);
    setTotal(json.pagination?.total || 0);
    setXpEdits(prev => {
      const next = { ...prev };
      data.forEach(v => {
        if (!next[v.id]) next[v.id] = { enabled: v.xpEnabled, value: String(v.xpValue), dirty: false, saving: false };
      });
      return next;
    });
    setLoading(false);
  }, [page, search, statusFilter, providerFilter]);

  function updateXp(id: string, patch: Partial<XpEdit>) {
    setXpEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true } }));
  }

  async function saveXp(id: string) {
    const edit = xpEdits[id];
    if (!edit || !edit.dirty) return;
    setXpEdits(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }));
    const res = await fetch(`/api/videos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xpEnabled: edit.enabled, xpValue: parseInt(edit.value) || 0 }),
    });
    const json = await res.json();
    if (res.ok) {
      showToast("XP settings saved");
      setXpEdits(prev => ({ ...prev, [id]: { ...prev[id], dirty: false, saving: false } }));
    } else {
      showToast(json.error || "Failed to save XP", false);
      setXpEdits(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }));
    }
  }

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) { showToast("Video deleted"); setConfirmId(null); load(); }
    else showToast(json.error || "Failed to delete", false);
    setDeleting(null);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {confirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "2rem", width: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>Delete Video?</h3>
            <p style={{ margin: "0 0 1.5rem", color: "#64748b", fontSize: "0.875rem" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmId(null)} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(confirmId)} disabled={!!deleting} style={{ padding: "0.5rem 1.25rem", borderRadius: "6px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Videos</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>{total} video{total !== 1 ? "s" : ""} in library</p>
        </div>
        <Link href="/admin/videos/new" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
          + New Video
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Published", value: videos.filter(v => v.status === "PUBLISHED").length, color: "#15803d" },
          { label: "Draft", value: videos.filter(v => v.status === "DRAFT").length, color: "#64748b" },
          { label: "Processing", value: videos.filter(v => v.status === "PROCESSING").length, color: "#b45309" },
          { label: "Free Access", value: videos.filter(v => v.accessType === "FREE").length, color: "#1d4ed8" },
        ].map(card => (
          <div key={card.label} style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: card.color, marginTop: "0.25rem" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9", flexWrap: "wrap" }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search videos…" style={{ ...inputStyle, width: 240 }} />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">All statuses</option>
            {["DRAFT","UPLOADING","PROCESSING","READY","PUBLISHED","ARCHIVED","FAILED"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={providerFilter} onChange={e => { setProviderFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">All providers</option>
            {["BUNNY","YOUTUBE","MANUAL","OTHER"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
            <Link href="/admin/videos/library" style={{ ...inputStyle, textDecoration: "none", color: "#475569", fontSize: "0.875rem", display: "flex", alignItems: "center" }}>Library View</Link>
            <Link href="/admin/videos/queue" style={{ ...inputStyle, textDecoration: "none", color: "#475569", fontSize: "0.875rem", display: "flex", alignItems: "center" }}>Encoding Queue</Link>
            <Link href="/admin/videos/course-videos" style={{ ...inputStyle, textDecoration: "none", color: "#475569", fontSize: "0.875rem", display: "flex", alignItems: "center" }}>By Course</Link>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : videos.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
            No videos found.{" "}
            <Link href="/admin/videos/new" style={{ color: PURPLE }}>Add one</Link>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Title","Status","Access","Provider","Duration","XP","Faculty","Course","Actions"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {videos.map(v => {
                  const xp = xpEdits[v.id] || { enabled: v.xpEnabled, value: String(v.xpValue), dirty: false, saving: false };
                  return (
                    <tr key={v.id} style={{ transition: "background 0.1s" }} onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 280 }}>
                        <Link href={`/admin/videos/${v.id}`} style={{ color: "#0f172a", textDecoration: "none" }}>{v.title}</Link>
                      </td>
                      <td style={tdStyle}><StatusBadge status={v.status} /></td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: v.accessType === "FREE" ? "#1d4ed8" : "#7c3aed" }}>{v.accessType}</span>
                      </td>
                      <td style={{ ...tdStyle, color: "#64748b" }}>{v.provider}</td>
                      <td style={{ ...tdStyle, color: "#64748b" }}>{fmtDuration(v.durationSeconds)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", userSelect: "none" }}>
                            <input
                              type="checkbox"
                              checked={xp.enabled}
                              onChange={e => updateXp(v.id, { enabled: e.target.checked })}
                              style={{ accentColor: PURPLE, width: 14, height: 14 }}
                            />
                            <span style={{ fontSize: "0.7rem", color: xp.enabled ? PURPLE : "#94a3b8", fontWeight: 600 }}>
                              {xp.enabled ? "ON" : "OFF"}
                            </span>
                          </label>
                          {xp.enabled && (
                            <input
                              type="number"
                              min="0"
                              value={xp.value}
                              onChange={e => updateXp(v.id, { value: e.target.value })}
                              style={{ width: 54, padding: "0.15rem 0.35rem", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "0.8rem", outline: "none" }}
                            />
                          )}
                          {xp.dirty && (
                            <button
                              onClick={() => saveXp(v.id)}
                              disabled={xp.saving}
                              style={{ padding: "0.15rem 0.45rem", borderRadius: "4px", border: "none", background: PURPLE, color: "#fff", fontSize: "0.7rem", fontWeight: 700, cursor: xp.saving ? "not-allowed" : "pointer", opacity: xp.saving ? 0.7 : 1 }}
                            >
                              {xp.saving ? "…" : "Save"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: "#64748b" }}>{v.faculty?.name || "—"}</td>
                      <td style={{ ...tdStyle, color: "#64748b" }}>{v.course?.name || "—"}</td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <Link href={`/admin/videos/${v.id}`} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>Edit</Link>
                          <button onClick={() => setConfirmId(v.id)} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
