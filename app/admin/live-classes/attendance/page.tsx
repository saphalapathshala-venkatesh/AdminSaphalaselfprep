"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

type Session = {
  id: string; title: string; status: string;
  sessionDate: string | null; startTime: string | null;
  faculty?: { name: string } | null;
};

export default function AttendancePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Session | null>(null);

  useEffect(() => {
    fetch("/api/live-classes?status=COMPLETED&pageSize=100").then(r => r.json()).then(j => {
      setSessions(j.data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <Link href="/admin/live-classes" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Live Classes</Link>
        <span style={{ color: "#e2e8f0" }}>/</span>
        <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Attendance</h1>
      </div>

      <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "1.25rem" }}>ℹ️</span>
        <div>
          <div style={{ fontWeight: 600, color: "#92400e", fontSize: "0.875rem" }}>Attendance Tracking — Coming Soon</div>
          <div style={{ color: "#b45309", fontSize: "0.8125rem", marginTop: "0.125rem" }}>
            Real-time attendance will require integration with your live streaming platform (Zoom / YouTube Live). The schema is ready — this page will be wired up once the platform webhooks are configured.
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem" }}>
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.8125rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Completed Sessions
          </div>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No completed sessions yet</div>
          ) : (
            sessions.map(s => (
              <button key={s.id} onClick={() => setSelected(s)} style={{ display: "block", width: "100%", padding: "0.75rem 1rem", background: selected?.id === s.id ? "#f5f3ff" : "transparent", border: "none", borderLeft: `3px solid ${selected?.id === s.id ? PURPLE : "transparent"}`, textAlign: "left", cursor: "pointer" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: selected?.id === s.id ? PURPLE : "#1e293b" }}>{s.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>
                  {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  {s.faculty ? ` · ${s.faculty.name}` : ""}
                </div>
              </button>
            ))
          )}
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
          {!selected ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "#475569" }}>Select a session</div>
              <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>Choose a completed session to view attendance data</div>
            </div>
          ) : (
            <div style={{ padding: "1.5rem" }}>
              <div style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>{selected.title}</h2>
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {selected.sessionDate ? new Date(selected.sessionDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date unknown"}
                  {selected.startTime ? ` · ${selected.startTime}` : ""}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Registered", value: "—", color: "#1d4ed8" },
                  { label: "Attended", value: "—", color: "#15803d" },
                  { label: "Attendance %", value: "—%", color: PURPLE },
                ].map(card => (
                  <div key={card.label} style={{ background: "#f8fafc", borderRadius: "10px", padding: "1rem", textAlign: "center" }}>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{card.label}</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: card.color, marginTop: "0.25rem" }}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "2rem", textAlign: "center", background: "#f8fafc", borderRadius: "10px", color: "#94a3b8" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🔌</div>
                <div style={{ fontWeight: 600, color: "#64748b" }}>Platform integration required</div>
                <div style={{ fontSize: "0.8125rem", marginTop: "0.375rem" }}>Connect your streaming platform to pull real attendance data automatically.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
