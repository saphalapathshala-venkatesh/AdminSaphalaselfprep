"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";

const REPORT_TYPES = [
  { value: "attempts", label: "Attempts" },
  { value: "xp", label: "XP" },
  { value: "revenue", label: "Revenue" },
  { value: "category-performance", label: "Category Performance" },
];

const STREAMS = [
  { value: "all", label: "All Streams" },
  { value: "TESTHUB", label: "TestHub" },
  { value: "SELFPREP_HTML", label: "SelfPrep HTML" },
  { value: "FLASHCARDS", label: "Flashcards" },
  { value: "PDF_ACCESS", label: "PDF Access" },
  { value: "SMART_PRACTICE", label: "Smart Practice" },
  { value: "AI_ADDON", label: "AI Add-on" },
];

const PRESETS: Record<string, () => [string, string]> = {
  "7 Days": () => { const e = new Date(); const s = new Date(e.getTime() - 6 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
  "30 Days": () => { const e = new Date(); const s = new Date(e.getTime() - 29 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
  "90 Days": () => { const e = new Date(); const s = new Date(e.getTime() - 89 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
  "1 Year": () => { const e = new Date(); const s = new Date(e.getTime() - 364 * 86400000); return [s.toISOString().slice(0, 10), e.toISOString().slice(0, 10)]; },
};

export default function AnalyticsPage() {
  const defaultRange = PRESETS["30 Days"]();
  const [tab, setTab] = useState("attempts");
  const [start, setStart] = useState(defaultRange[0]);
  const [end, setEnd] = useState(defaultRange[1]);
  const [stream, setStream] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab, start, end, stream });
      const res = await fetch(`/api/analytics/report?${params}`);
      const json = await res.json();
      setRows(json.data || []);
    } catch { setRows([]); }
    setLoading(false);
  }, [tab, start, end, stream]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const exportCsv = () => {
    const params = new URLSearchParams({ type: tab, start, end, stream });
    window.open(`/api/analytics/export?${params}`, "_blank");
  };

  const applyPreset = (name: string) => {
    const [s, e] = PRESETS[name]();
    setStart(s);
    setEnd(e);
  };

  const inputStyle: React.CSSProperties = { padding: "0.375rem 0.5rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.8rem" };
  const thStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: "0.7rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" };
  const tdStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.8rem" };

  const getColumns = (): { key: string; label: string; format?: (v: any) => string }[] => {
    switch (tab) {
      case "attempts": return [
        { key: "date", label: "Date" },
        { key: "count", label: "Attempts" },
        { key: "uniqueUsers", label: "Unique Users" },
      ];
      case "xp": return [
        { key: "date", label: "Date" },
        { key: "points", label: "XP Points" },
        { key: "events", label: "Events" },
      ];
      case "revenue": return [
        { key: "date", label: "Date" },
        { key: "grossPaise", label: "Gross (₹)", format: (v: number) => `₹${(v / 100).toFixed(2)}` },
        { key: "netPaise", label: "Net (₹)", format: (v: number) => `₹${(v / 100).toFixed(2)}` },
        { key: "transactions", label: "Transactions" },
      ];
      case "category-performance": return [
        { key: "categoryName", label: "Category" },
        { key: "attempts", label: "Attempts" },
        { key: "avgScore", label: "Avg Score (%)" },
      ];
      default: return [];
    }
  };

  const columns = getColumns();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111" }}>Analytics</h1>
        <button onClick={exportCsv} style={{ padding: "0.5rem 1rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}>
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center", padding: "0.75rem", background: "#f9fafb", borderRadius: "0.5rem" }}>
        {Object.keys(PRESETS).map(name => (
          <button key={name} onClick={() => applyPreset(name)} style={{ padding: "0.25rem 0.625rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", background: "#fff", cursor: "pointer", fontSize: "0.75rem", color: "#374151" }}>{name}</button>
        ))}
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>to</span>
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        {tab === "revenue" && (
          <select value={stream} onChange={e => setStream(e.target.value)} style={inputStyle}>
            {STREAMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb" }}>
        {REPORT_TYPES.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)} style={{ padding: "0.5rem 1rem", border: "none", background: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: tab === t.value ? 600 : 400, color: tab === t.value ? "#2563eb" : "#6b7280", borderBottom: tab === t.value ? "2px solid #2563eb" : "2px solid transparent", marginBottom: "-2px" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Report Table */}
      {loading ? <p style={{ color: "#999" }}>Loading...</p> : rows.length === 0 ? <p style={{ color: "#999", fontSize: "0.875rem" }}>No data for the selected period.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {columns.map(col => <th key={col.key} style={thStyle}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map(col => (
                    <td key={col.key} style={tdStyle}>
                      {col.format ? col.format(row[col.key]) : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Row */}
          {tab !== "category-performance" && rows.length > 0 && (
            <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", background: "#f9fafb", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: 500 }}>
              Total: {columns.slice(1).map(col => {
                const sum = rows.reduce((acc, r) => acc + (Number(r[col.key]) || 0), 0);
                return <span key={col.key} style={{ marginRight: "1rem" }}>{col.label}: {col.format ? col.format(sum) : sum.toLocaleString()}</span>;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
