"use client";

import { useState, useEffect, useCallback } from "react";

const PURPLE = "#7c3aed";

interface InfringementUser {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  infringementWarnings: number;
  infringementBlocked: boolean;
  isBlocked: boolean;
}

interface InfringementEvent {
  id: string;
  contentType: string;
  contentId: string;
  courseId: string | null;
  lessonId: string | null;
  eventType: string;
  userAgent: string | null;
  ipAddress: string | null;
  warningCountAt: number;
  actionTaken: string;
  createdAt: string;
  user: InfringementUser;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  COPY_ATTEMPT: "Copy Attempt",
  RIGHT_CLICK_ATTEMPT: "Right-Click",
  SELECTION_ATTEMPT: "Selection",
  KEYBOARD_COPY_ATTEMPT: "Keyboard Copy",
};

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  LOGGED:       { bg: "#f3f4f6", color: "#374151" },
  WARNING_1:    { bg: "#fef3c7", color: "#92400e" },
  WARNING_2:    { bg: "#ffedd5", color: "#c2410c" },
  AUTO_BLOCKED: { bg: "#fee2e2", color: "#991b1b" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const inputStyle: React.CSSProperties = { border: "1px solid #d1d5db", borderRadius: "6px", padding: "6px 10px", fontSize: "0.8rem", background: "#fff", outline: "none" };
const btnSmall: React.CSSProperties = { padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: "5px", cursor: "pointer", fontSize: "0.78rem", background: "#fff" };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", background: PURPLE, color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 };

export default function InfringementPage() {
  const [events, setEvents] = useState<InfringementEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [contentType, setContentType] = useState("");
  const [blocked, setBlocked] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (eventType) params.set("eventType", eventType);
    if (contentType) params.set("contentType", contentType);
    if (blocked) params.set("blocked", blocked);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/admin/infringement?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      showToast("Failed to load infringement events", "error");
    } finally {
      setLoading(false);
    }
  }, [page, search, eventType, contentType, blocked, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = async (userId: string, resetWarnings: boolean) => {
    try {
      const res = await fetch(`/api/admin/infringement/${userId}/unblock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetWarnings }),
      });
      if (!res.ok) throw new Error();
      showToast("User unblocked successfully", "success");
      load();
    } catch {
      showToast("Failed to unblock user", "error");
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, padding: "12px 20px", borderRadius: "8px", zIndex: 9999,
          background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
          color: toast.type === "success" ? "#166534" : "#991b1b",
          boxShadow: "0 4px 12px rgba(0,0,0,.15)", fontWeight: 500, fontSize: "0.875rem",
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111", margin: "0 0 4px" }}>Detected Infringement Activity</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.875rem" }}>
          Monitoring copy/right-click/selection attempts on protected content. Total: {total} events.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px", padding: "12px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", alignItems: "center" }}>
        <input type="text" placeholder="Search learner…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, minWidth: 180 }} />
        <select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">All Event Types</option>
          <option value="COPY_ATTEMPT">Copy Attempt</option>
          <option value="RIGHT_CLICK_ATTEMPT">Right-Click</option>
          <option value="SELECTION_ATTEMPT">Selection</option>
          <option value="KEYBOARD_COPY_ATTEMPT">Keyboard Copy</option>
        </select>
        <select value={contentType} onChange={(e) => { setContentType(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">All Content Types</option>
          <option value="ebook">E-Book</option>
          <option value="pdf">PDF</option>
          <option value="flashcard_deck">Flashcard Deck</option>
        </select>
        <select value={blocked} onChange={(e) => { setBlocked(e.target.value); setPage(1); }} style={inputStyle}>
          <option value="">All Statuses</option>
          <option value="true">Blocked Only</option>
          <option value="false">Not Blocked</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} title="From date" />
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} title="To date" />
        <button style={btnSmall} onClick={() => { setSearch(""); setEventType(""); setContentType(""); setBlocked(""); setDateFrom(""); setDateTo(""); setPage(1); }}>Clear</button>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px" }}>Loading…</p>
      ) : events.length === 0 ? (
        <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px" }}>No infringement events found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Learner</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Event Type</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Content</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Action Taken</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Warnings</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Date</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const actionStyle = ACTION_COLORS[ev.actionTaken] || ACTION_COLORS.LOGGED;
                const isExpanded = expandedRow === ev.id;
                return (
                  <>
                    <tr key={ev.id} style={{ borderBottom: "1px solid #f3f4f6", background: ev.user.infringementBlocked ? "#fff5f5" : "#fff", cursor: "pointer" }}
                      onClick={() => setExpandedRow(isExpanded ? null : ev.id)}>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>{ev.user.name || "—"}</div>
                        <div style={{ color: "#6b7280", fontSize: "0.75rem" }}>{ev.user.email || ev.user.mobile || "—"}</div>
                        {ev.user.infringementBlocked && (
                          <span style={{ fontSize: "0.65rem", background: "#fee2e2", color: "#991b1b", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>BLOCKED</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "3px 8px", background: "#f3f4f6", borderRadius: 4, fontWeight: 500, color: "#374151" }}>
                          {EVENT_TYPE_LABELS[ev.eventType] || ev.eventType}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 500, color: "#374151", textTransform: "capitalize" }}>{ev.contentType.replace(/_/g, " ")}</div>
                        <div style={{ color: "#9ca3af", fontSize: "0.7rem", fontFamily: "monospace" }}>{ev.contentId.slice(0, 12)}…</div>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "3px 8px", background: actionStyle.bg, color: actionStyle.color, borderRadius: 4, fontWeight: 600, fontSize: "0.75rem" }}>
                          {ev.actionTaken.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontWeight: 700, color: ev.user.infringementWarnings >= 3 ? "#ef4444" : ev.user.infringementWarnings >= 2 ? "#f97316" : "#374151" }}>
                          {ev.user.infringementWarnings}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>{formatDate(ev.createdAt)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {(ev.user.infringementBlocked || ev.user.isBlocked) && (
                          <div style={{ display: "flex", gap: "4px", flexDirection: "column" }}>
                            <button style={{ ...btnSmall, color: "#15803d", borderColor: "#86efac", fontSize: "0.72rem" }}
                              onClick={(e) => { e.stopPropagation(); handleUnblock(ev.user.id, false); }}>
                              Unblock
                            </button>
                            <button style={{ ...btnSmall, color: "#0369a1", borderColor: "#bae6fd", fontSize: "0.72rem" }}
                              onClick={(e) => { e.stopPropagation(); handleUnblock(ev.user.id, true); }}>
                              Unblock + Reset
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${ev.id}-exp`} style={{ background: "#f9fafb" }}>
                        <td colSpan={7} style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
                          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                            <div><span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600 }}>MOBILE</span><br /><span style={{ fontSize: "0.8rem" }}>{ev.user.mobile || "—"}</span></div>
                            <div><span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600 }}>IP ADDRESS</span><br /><span style={{ fontSize: "0.8rem" }}>{ev.ipAddress || "—"}</span></div>
                            <div><span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600 }}>WARNING COUNT AT EVENT</span><br /><span style={{ fontSize: "0.8rem" }}>{ev.warningCountAt}</span></div>
                            <div><span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600 }}>CONTENT ID</span><br /><span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#6b7280" }}>{ev.contentId}</span></div>
                            {ev.courseId && <div><span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600 }}>COURSE</span><br /><span style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#6b7280" }}>{ev.courseId}</span></div>}
                            <div style={{ flex: 1, minWidth: 200 }}><span style={{ fontSize: "0.7rem", color: "#9ca3af", fontWeight: 600 }}>USER AGENT</span><br /><span style={{ fontSize: "0.7rem", color: "#6b7280" }}>{ev.userAgent || "—"}</span></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "16px" }}>
          <button style={btnSmall} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: "0.8rem", color: "#6b7280", lineHeight: "28px" }}>Page {page} of {totalPages}</span>
          <button style={btnSmall} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
