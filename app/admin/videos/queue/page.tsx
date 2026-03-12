"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

type Video = {
  id: string; title: string; status: string; processingStatus: string | null;
  processingError: string | null; provider: string; providerVideoId: string | null;
  createdAt: string; updatedAt: string;
};

const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

function StatusPill({ status }: { status: string }) {
  const m: Record<string, { bg: string; color: string }> = {
    UPLOADING: { bg: "#dbeafe", color: "#1d4ed8" },
    PROCESSING: { bg: "#fef3c7", color: "#b45309" },
    FAILED: { bg: "#fee2e2", color: "#991b1b" },
    READY: { bg: "#d1fae5", color: "#065f46" },
  };
  const s = m[status] || { bg: "#f1f5f9", color: "#64748b" };
  return <span style={{ padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
}

export default function EncodingQueuePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/videos?status=UPLOADING&pageSize=50");
    const res2 = await fetch("/api/videos?status=PROCESSING&pageSize=50");
    const res3 = await fetch("/api/videos?status=FAILED&pageSize=50");
    const [j1, j2, j3] = await Promise.all([res.json(), res2.json(), res3.json()]);
    const all = [...(j1.data || []), ...(j2.data || []), ...(j3.data || [])];
    all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setVideos(all);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  async function markReady(id: string) {
    const res = await fetch(`/api/videos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "READY" }) });
    if (res.ok) { showToast("Marked as Ready"); load(); }
    else showToast("Failed", false);
  }

  async function markFailed(id: string) {
    const res = await fetch(`/api/videos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "FAILED" }) });
    if (res.ok) { showToast("Marked as Failed"); load(); }
    else showToast("Failed", false);
  }

  return (
    <div>
      {toast && <div style={{ position: "fixed", top: 20, right: 24, zIndex: 9999, background: toast.ok ? "#15803d" : "#991b1b", color: "#fff", padding: "0.625rem 1.25rem", borderRadius: "8px", fontSize: "0.875rem" }}>{toast.msg}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/videos" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Videos</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Encoding Queue</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString()}</span>
          <button onClick={load} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>↻ Refresh</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Uploading", status: "UPLOADING", color: "#1d4ed8", bg: "#dbeafe" },
          { label: "Processing", status: "PROCESSING", color: "#b45309", bg: "#fef3c7" },
          { label: "Failed", status: "FAILED", color: "#991b1b", bg: "#fee2e2" },
        ].map(card => {
          const count = videos.filter(v => v.status === card.status).length;
          return (
            <div key={card.label} style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: "10px", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>
                {card.status === "UPLOADING" ? "⬆️" : card.status === "PROCESSING" ? "⚙️" : "❌"}
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: card.color }}>{count}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading queue…</div>
        ) : videos.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>✅</div>
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "#475569" }}>Queue is clear</div>
            <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>No videos currently uploading, processing, or in a failed state.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Title","Status","Provider","Provider ID","Processing Note","Updated","Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {videos.map(v => (
                <tr key={v.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 240 }}>
                    <Link href={`/admin/videos/${v.id}`} style={{ color: "#0f172a", textDecoration: "none" }}>{v.title}</Link>
                  </td>
                  <td style={tdStyle}><StatusPill status={v.status} /></td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{v.provider}</td>
                  <td style={{ ...tdStyle, color: "#64748b", fontFamily: "monospace", fontSize: "0.75rem" }}>{v.providerVideoId || "—"}</td>
                  <td style={{ ...tdStyle, color: v.processingError ? "#991b1b" : "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {v.processingError || v.processingStatus || "—"}
                  </td>
                  <td style={{ ...tdStyle, color: "#94a3b8", fontSize: "0.75rem" }}>
                    {new Date(v.updatedAt).toLocaleString()}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={() => markReady(v.id)} style={{ padding: "0.25rem 0.625rem", borderRadius: "5px", border: "1px solid #86efac", color: "#15803d", background: "transparent", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>→ Ready</button>
                      {v.status !== "FAILED" && (
                        <button onClick={() => markFailed(v.id)} style={{ padding: "0.25rem 0.625rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "transparent", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>→ Failed</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
