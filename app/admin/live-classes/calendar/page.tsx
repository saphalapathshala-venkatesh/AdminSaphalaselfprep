"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

type Session = {
  id: string; title: string; status: string; platform: string;
  sessionDate: string | null; startTime: string | null; endTime: string | null;
  faculty?: { name: string } | null; accessType: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", SCHEDULED: "#3b82f6", PUBLISHED: "#22c55e",
  COMPLETED: "#8b5cf6", CANCELLED: "#ef4444",
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/live-classes?pageSize=200").then(r => r.json()).then(j => {
      setSessions(j.data || []);
      setLoading(false);
    });
  }, []);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function sessionsOnDay(day: number) {
    return sessions.filter(s => {
      if (!s.sessionDate) return false;
      const d = new Date(s.sessionDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const selectedSessions = selected
    ? sessions.filter(s => s.id === selected)
    : sessions.filter(s => {
        if (!s.sessionDate) return false;
        const d = new Date(s.sessionDate);
        return d.getFullYear() === year && d.getMonth() === month;
      });

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/admin/live-classes" style={{ color: "#64748b", textDecoration: "none", fontSize: "0.875rem" }}>← Live Classes</Link>
          <span style={{ color: "#e2e8f0" }}>/</span>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Calendar</h1>
        </div>
        <Link href="/admin/live-classes/new" style={{ padding: "0.5rem 1.25rem", borderRadius: "8px", background: PURPLE, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
          + New Session
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "1.5rem" }}>
        <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
            <button onClick={prevMonth} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>←</button>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{ padding: "0.375rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}>→</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid #f1f5f9" }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: "0.5rem", textAlign: "center", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} style={{ minHeight: 80, borderBottom: "1px solid #f8fafc", borderRight: "1px solid #f8fafc" }} />;
              const daySessions = sessionsOnDay(day);
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              return (
                <div key={day} onClick={() => setSelected(null)} style={{ minHeight: 80, padding: "0.375rem", borderBottom: "1px solid #f8fafc", borderRight: "1px solid #f8fafc", cursor: "pointer" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: isToday ? PURPLE : "transparent", color: isToday ? "#fff" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: isToday ? 700 : 400, marginBottom: "0.25rem" }}>
                    {day}
                  </div>
                  {daySessions.map(s => (
                    <Link key={s.id} href={`/admin/live-classes/${s.id}`} onClick={e => e.stopPropagation()} style={{ display: "block", fontSize: "0.625rem", fontWeight: 600, padding: "1px 4px", borderRadius: "3px", background: `${STATUS_COLORS[s.status] || "#94a3b8"}22`, color: STATUS_COLORS[s.status] || "#94a3b8", marginBottom: "2px", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.startTime ? `${s.startTime} ` : ""}{s.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.8125rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Sessions in {MONTHS[month]}
            </div>
            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
            ) : selectedSessions.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.875rem" }}>No sessions this month</div>
            ) : (
              selectedSessions
                .sort((a, b) => (a.sessionDate || "").localeCompare(b.sessionDate || ""))
                .map(s => (
                  <Link key={s.id} href={`/admin/live-classes/${s.id}`} style={{ display: "block", padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9", textDecoration: "none", transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{s.title}</span>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "2px 6px", borderRadius: "3px", background: `${STATUS_COLORS[s.status] || "#94a3b8"}22`, color: STATUS_COLORS[s.status] || "#94a3b8" }}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No date"}{" · "}
                      {s.startTime || "TBD"}{" · "}{s.platform.replace("_"," ")}
                    </div>
                    {s.faculty && <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.125rem" }}>{s.faculty.name}</div>}
                  </Link>
                ))
            )}
          </div>

          <div style={{ marginTop: "1rem", background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", padding: "1rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Legend</div>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: "0.75rem", color: "#475569" }}>{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
