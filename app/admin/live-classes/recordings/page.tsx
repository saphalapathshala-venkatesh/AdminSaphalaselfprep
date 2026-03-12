"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";
const thStyle: React.CSSProperties = { padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0" };
const tdStyle: React.CSSProperties = { padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };

type Session = {
  id: string; title: string; status: string; recordingPolicy: string;
  sessionDate: string | null; startTime: string | null;
  replayVideoId: string | null; faculty?: { name: string } | null;
  course?: { name: string } | null;
};

export default function RecordingsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "has_recording" | "needs_recording">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/live-classes?status=COMPLETED&pageSize=100");
    const json = await res.json();
    setSessions(json.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = sessions.filter(s => {
    if (filter === "has_recording") return !!s.replayVideoId;
    if (filter === "needs_recording") return !s.replayVideoId && s.recordingPolicy !== "NO_RECORD";
    return true;
  });

  const withRecording = sessions.filter(s => !!s.replayVideoId).length;
  const needsRecording = sessions.filter(s => !s.replayVideoId && s.recordingPolicy !== "NO_RECORD").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/live-classes" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Live Classes</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Recordings</h1>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Completed", value: sessions.length, color: "#475569" },
          { label: "With Recording", value: withRecording, color: "#15803d" },
          { label: "Needs Recording", value: needsRecording, color: "#b45309" },
        ].map(card => (
          <div key={card.label} style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: card.color, marginTop: "0.25rem" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "0.5rem", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
          {([
            { key: "all", label: "All" },
            { key: "has_recording", label: "Has Recording" },
            { key: "needs_recording", label: "Needs Recording" },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} style={{ padding: "0.375rem 0.875rem", borderRadius: "20px", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600, background: filter === tab.key ? PURPLE : "#f1f5f9", color: filter === tab.key ? "#fff" : "#64748b", transition: "background 0.15s" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🎬</div>
            <div style={{ fontWeight: 600, color: "#475569" }}>No sessions found</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Session","Date","Faculty","Course","Policy","Replay","Actions"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 260 }}>
                    <Link href={`/admin/live-classes/${s.id}`} style={{ color: "#0f172a", textDecoration: "none" }}>{s.title}</Link>
                  </td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>
                    {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{s.faculty?.name || "—"}</td>
                  <td style={{ ...tdStyle, color: "#64748b" }}>{s.course?.name || "—"}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: s.recordingPolicy === "NO_RECORD" ? "#94a3b8" : s.recordingPolicy === "RECORD_AND_SHARE" ? "#15803d" : "#1d4ed8" }}>
                      {s.recordingPolicy === "NO_RECORD" ? "None" : s.recordingPolicy === "RECORD_AND_SHARE" ? "Share" : "Record"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {s.replayVideoId ? (
                      <Link href={`/admin/videos/${s.replayVideoId}`} style={{ color: PURPLE, fontWeight: 600, fontSize: "0.8125rem" }}>View →</Link>
                    ) : (
                      <span style={{ color: s.recordingPolicy === "NO_RECORD" ? "#94a3b8" : "#f59e0b", fontSize: "0.8125rem", fontWeight: 600 }}>
                        {s.recordingPolicy === "NO_RECORD" ? "N/A" : "Missing"}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <Link href={`/admin/live-classes/${s.id}`} style={{ padding: "0.25rem 0.75rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, textDecoration: "none", fontSize: "0.8125rem", fontWeight: 600 }}>Edit</Link>
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
