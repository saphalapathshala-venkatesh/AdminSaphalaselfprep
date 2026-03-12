"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

type Video = {
  id: string; title: string; status: string; accessType: string;
  thumbnailUrl: string | null; durationSeconds: number | null;
  provider: string; faculty?: { name: string } | null;
  course?: { name: string } | null; createdAt: string;
};

function fmtDuration(s: number | null) {
  if (!s) return "";
  const m = Math.floor(s / 60), ss = s % 60;
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "#15803d", DRAFT: "#64748b", PROCESSING: "#b45309",
  READY: "#1d4ed8", FAILED: "#991b1b", ARCHIVED: "#475569", UPLOADING: "#0284c7",
};

export default function VideoLibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [accessFilter, setAccessFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 24;

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, ...(statusFilter ? { status: statusFilter } : {}), ...(accessFilter ? { accessType: accessFilter } : {}) });
    const res = await fetch(`/api/videos?${p}`);
    const json = await res.json();
    setVideos(json.data || []);
    setTotal(json.pagination?.total || 0);
    setLoading(false);
  }, [page, search, statusFilter, accessFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/videos" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Videos</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Library</h1>
          <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>({total})</span>
        </div>
        <Link href="/admin/videos/new" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
          + New Video
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" style={{ padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none", width: 220 }} />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none" }}>
          <option value="">All Statuses</option>
          {["DRAFT","UPLOADING","PROCESSING","READY","PUBLISHED","ARCHIVED","FAILED"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={accessFilter} onChange={e => { setAccessFilter(e.target.value); setPage(1); }} style={{ padding: "0.4rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "0.875rem", outline: "none" }}>
          <option value="">All Access</option>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "1rem" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <div style={{ height: 124, background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
              <div style={{ padding: "0.75rem" }}>
                <div style={{ height: 14, background: "#f1f5f9", borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 12, background: "#f8fafc", borderRadius: 4, width: "60%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8", background: "#fff", borderRadius: "12px" }}>
          No videos found. <Link href="/admin/videos/new" style={{ color: PURPLE }}>Add one</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "1rem" }}>
          {videos.map(v => (
            <Link key={v.id} href={`/admin/videos/${v.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "#fff", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", transition: "box-shadow 0.2s, transform 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.07)"; (e.currentTarget as HTMLDivElement).style.transform = ""; }}
              >
                <div style={{ height: 124, background: v.thumbnailUrl ? `url(${v.thumbnailUrl}) center/cover` : "linear-gradient(135deg,#7c3aed22,#3b82f622)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {!v.thumbnailUrl && <span style={{ fontSize: "2rem", opacity: 0.4 }}>🎬</span>}
                  {v.durationSeconds && (
                    <span style={{ position: "absolute", bottom: 6, right: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "0.7rem", padding: "1px 6px", borderRadius: "4px" }}>
                      {fmtDuration(v.durationSeconds)}
                    </span>
                  )}
                  <span style={{ position: "absolute", top: 6, left: 8, fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#fff", color: STATUS_COLORS[v.status] || "#64748b" }}>
                    {v.status}
                  </span>
                </div>
                <div style={{ padding: "0.75rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{v.faculty?.name || "—"} · <span style={{ color: v.accessType === "FREE" ? "#1d4ed8" : PURPLE, fontWeight: 600 }}>{v.accessType}</span></div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "1.5rem", justifyContent: "center" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>← Prev</button>
          <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}>Next →</button>
        </div>
      )}
    </div>
  );
}
