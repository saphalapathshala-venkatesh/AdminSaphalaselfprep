"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";

interface DashboardData {
  kpis: { totalUsers: number; grossRevenuePaise: number; netRevenuePaise: number; paidUsers: number; freeUsers: number };
  charts: {
    attemptsByDay: { date: string; count: number }[];
    activeUsersByDay: { date: string; count: number }[];
    xpByDay: { date: string; points: number }[];
    revenueByDay: { date: string; grossPaise: number; netPaise: number }[];
  };
  tables: {
    topXpEarners: { userId: string; name: string | null; email: string | null; totalXp: number }[];
    mostAttemptedTests: { testId: string; title: string; attempts: number }[];
    recentlyPublishedContent: { type: string; id: string; title: string; publishedAt: string | null }[];
  };
}

const PRESETS: Record<string, () => [string, string]> = {
  "Today": () => { const d = new Date().toISOString().slice(0, 10); return [d, d]; },
  "7 Days": () => { const e = new Date(); const s = new Date(e.getTime() - 6 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
  "30 Days": () => { const e = new Date(); const s = new Date(e.getTime() - 29 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
  "90 Days": () => { const e = new Date(); const s = new Date(e.getTime() - 89 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
  "1 Year": () => { const e = new Date(); const s = new Date(e.getTime() - 364 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
};

const STREAMS = [
  { value: "all", label: "All Streams" },
  { value: "TESTHUB", label: "TestHub" },
  { value: "SELFPREP_HTML", label: "SelfPrep HTML" },
  { value: "FLASHCARDS", label: "Flashcards" },
  { value: "PDF_ACCESS", label: "PDF Access" },
  { value: "SMART_PRACTICE", label: "Smart Practice" },
  { value: "AI_ADDON", label: "AI Add-on" },
];

export default function DashboardPage() {
  const defaultRange = PRESETS["30 Days"]();
  const [start, setStart] = useState(defaultRange[0]);
  const [end, setEnd] = useState(defaultRange[1]);
  const [learnerFilter, setLearnerFilter] = useState("all");
  const [stream, setStream] = useState("all");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start, end, learnerFilter, stream });
      const res = await fetch(`/api/analytics/dashboard?${params}`);
      const json = await res.json();
      setData(json.data || null);
    } catch { setData(null); }
    setLoading(false);
  }, [start, end, learnerFilter, stream]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const applyPreset = (name: string) => {
    const [s, e] = PRESETS[name]();
    setStart(s);
    setEnd(e);
  };

  const inputStyle: React.CSSProperties = { padding: "0.375rem 0.5rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.8rem" };
  const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" };
  const tdStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.8rem" };

  const maxVal = (arr: number[]) => Math.max(...arr, 1);

  const MiniBar = ({ items, valKey, labelKey, color }: { items: any[]; valKey: string; labelKey: string; color: string }) => {
    if (items.length === 0) return <p style={{ color: "#999", fontSize: "0.8rem" }}>No data for this period.</p>;
    const mv = maxVal(items.map(i => i[valKey]));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {items.slice(-14).map((item, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.7rem" }}>
            <span style={{ width: "70px", flexShrink: 0, color: "#6b7280" }}>{item[labelKey]?.slice(5) || ""}</span>
            <div style={{ flex: 1, background: "#f3f4f6", borderRadius: "2px", height: "14px" }}>
              <div style={{ width: `${(item[valKey] / mv) * 100}%`, background: color, height: "100%", borderRadius: "2px", minWidth: item[valKey] > 0 ? "2px" : "0" }} />
            </div>
            <span style={{ width: "50px", textAlign: "right", fontWeight: 500 }}>{item[valKey]}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", marginBottom: "1rem" }}>Dashboard</h1>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center", padding: "0.75rem", background: "#f9fafb", borderRadius: "0.5rem" }}>
        {Object.keys(PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name)} style={{ padding: "0.25rem 0.625rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", background: "#fff", cursor: "pointer", fontSize: "0.75rem", color: "#374151" }}>{name}</button>
        ))}
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>to</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        <select value={learnerFilter} onChange={e => setLearnerFilter(e.target.value)} style={inputStyle}>
          <option value="all">All Learners</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
        </select>
        <select value={stream} onChange={e => setStream(e.target.value)} style={inputStyle}>
          {STREAMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: "#999" }}>Loading dashboard...</p> : !data ? <p style={{ color: "#999" }}>Failed to load dashboard.</p> : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Total Users", value: data.kpis.totalUsers.toLocaleString(), color: "#2563eb" },
              { label: "Paid Users", value: data.kpis.paidUsers.toLocaleString(), color: "#16a34a" },
              { label: "Free Users", value: data.kpis.freeUsers.toLocaleString(), color: "#6b7280" },
              { label: "Gross Revenue", value: `₹${(data.kpis.grossRevenuePaise / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "#7c3aed" },
              { label: "Net Revenue", value: `₹${(data.kpis.netRevenuePaise / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: "#0891b2" },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderLeft: `4px solid ${kpi.color}` }}>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>{kpi.label}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111" }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>Attempts / Day</h3>
              <MiniBar items={data.charts.attemptsByDay} valKey="count" labelKey="date" color="#2563eb" />
            </div>
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>Active Users / Day</h3>
              <MiniBar items={data.charts.activeUsersByDay} valKey="count" labelKey="date" color="#16a34a" />
            </div>
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>XP / Day</h3>
              <MiniBar items={data.charts.xpByDay} valKey="points" labelKey="date" color="#7c3aed" />
            </div>
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.75rem" }}>Revenue / Day (Gross)</h3>
              <MiniBar items={data.charts.revenueByDay} valKey="grossPaise" labelKey="date" color="#0891b2" />
            </div>
          </div>

          {/* Tables */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Top XP Earners</h3>
              {data.tables.topXpEarners.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No data.</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={thStyle}>#</th><th style={thStyle}>User</th><th style={thStyle}>XP</th></tr></thead>
                  <tbody>
                    {data.tables.topXpEarners.map((u, i) => (
                      <tr key={u.userId}><td style={tdStyle}>{i + 1}</td><td style={tdStyle}>{u.name || u.email || u.userId}</td><td style={{ ...tdStyle, fontWeight: 600, color: "#7c3aed" }}>{u.totalXp}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Most Attempted Tests</h3>
              {data.tables.mostAttemptedTests.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No data.</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={thStyle}>#</th><th style={thStyle}>Test</th><th style={thStyle}>Attempts</th></tr></thead>
                  <tbody>
                    {data.tables.mostAttemptedTests.map((t, i) => (
                      <tr key={t.testId}><td style={tdStyle}>{i + 1}</td><td style={tdStyle}>{t.title}</td><td style={{ ...tdStyle, fontWeight: 600 }}>{t.attempts}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recently Published */}
          <div style={{ background: "#fff", borderRadius: "0.5rem", padding: "1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "1.5rem" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Recently Published Content</h3>
            {data.tables.recentlyPublishedContent.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No published content.</p> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={thStyle}>Type</th><th style={thStyle}>Title</th><th style={thStyle}>Published</th></tr></thead>
                <tbody>
                  {data.tables.recentlyPublishedContent.map(c => (
                    <tr key={c.id}>
                      <td style={tdStyle}><span style={{ padding: "0.125rem 0.375rem", borderRadius: "0.25rem", fontSize: "0.65rem", fontWeight: 500, background: c.type === "HTML" ? "#dbeafe" : "#fce7f3", color: c.type === "HTML" ? "#1e40af" : "#9d174d" }}>{c.type}</span></td>
                      <td style={tdStyle}>{c.title}</td>
                      <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>{c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { label: "Upload HTML Page", href: "/admin/content-library" },
              { label: "Upload PDF", href: "/admin/content-library" },
              { label: "Create Flashcards", href: "/admin/flashcards" },
              { label: "Create Test Series", href: "/admin/test-series" },
            ].map(a => (
              <a key={a.label} href={a.href} style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", borderRadius: "0.375rem", textDecoration: "none", fontSize: "0.8rem", fontWeight: 500 }}>{a.label}</a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
