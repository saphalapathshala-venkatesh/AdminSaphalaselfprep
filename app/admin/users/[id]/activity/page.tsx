"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const PURPLE = "#7c3aed";

interface ActivityEntry {
  id: string;
  source: "AUTH" | "TEST" | "XP";
  eventType: string;
  details: string | null;
  meta: string | null;
  createdAt: string;
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
}

const AUTH_CONFIG: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  LOGIN_SUCCESS:              { label: "Login",                icon: "✅", bg: "#f0fdf4", color: "#15803d" },
  LOGIN_BLOCKED_DEVICE_LIMIT: { label: "Blocked: Device Limit", icon: "🚫", bg: "#fff7ed", color: "#c2410c" },
  LOGIN_BLOCKED_USER:         { label: "Blocked: User",        icon: "🔴", bg: "#fee2e2", color: "#dc2626" },
  LOGOUT:                     { label: "Logout",               icon: "🔓", bg: "#f8fafc", color: "#475569" },
  DEVICE_REGISTERED:          { label: "Device Registered",    icon: "📱", bg: "#eff6ff", color: "#2563eb" },
  DEVICE_REMOVED:             { label: "Device Removed",       icon: "❌", bg: "#fef3f2", color: "#dc2626" },
  DEVICE_RESET:               { label: "Devices Reset",        icon: "🔄", bg: "#fff7ed", color: "#b45309" },
  GLOBAL_DEVICE_RESET:        { label: "Global Reset",         icon: "⚠️", bg: "#fef3c7", color: "#92400e" },
  USER_BLOCKED:               { label: "User Blocked",         icon: "🚫", bg: "#fee2e2", color: "#dc2626" },
  USER_UNBLOCKED:             { label: "User Unblocked",       icon: "✅", bg: "#f0fdf4", color: "#15803d" },
  USER_EDITED:                { label: "Profile Edited",       icon: "✏️", bg: "#f5f3ff", color: "#5b21b6" },
  USER_SOFT_DELETED:          { label: "Archived",             icon: "🗃", bg: "#fef2f2", color: "#991b1b" },
  USER_RESTORED:              { label: "Restored",             icon: "♻️", bg: "#f0fdf4", color: "#15803d" },
  SESSION_REVOKED:            { label: "Session Revoked",      icon: "🔒", bg: "#f1f5f9", color: "#64748b" },
};

const TEST_CONFIG: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  IN_PROGRESS:  { label: "Test Started",    icon: "▶️", bg: "#eff6ff", color: "#2563eb" },
  SUBMITTED:    { label: "Test Submitted",  icon: "✅", bg: "#f0fdf4", color: "#15803d" },
  PAUSED:       { label: "Test Paused",     icon: "⏸️", bg: "#fefce8", color: "#a16207" },
  EXPIRED:      { label: "Test Expired",    icon: "⏰", bg: "#fff7ed", color: "#c2410c" },
};

function eventBadge(entry: ActivityEntry) {
  if (entry.source === "XP") {
    const earned = entry.eventType === "XP_EARNED";
    return (
      <span style={{ padding: "2px 10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
        background: earned ? "#fdf4ff" : "#fef2f2", color: earned ? "#7e22ce" : "#dc2626", whiteSpace: "nowrap" }}>
        {earned ? "⭐" : "↩️"} {earned ? "XP Earned" : "XP Redeemed"}
      </span>
    );
  }
  if (entry.source === "TEST") {
    const cfg = TEST_CONFIG[entry.eventType] || { label: entry.eventType, icon: "📝", bg: "#f8fafc", color: "#475569" };
    return (
      <span style={{ padding: "2px 10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
        background: cfg.bg, color: cfg.color, whiteSpace: "nowrap" }}>
        {cfg.icon} {cfg.label}
      </span>
    );
  }
  const cfg = AUTH_CONFIG[entry.eventType] || { label: entry.eventType, icon: "•", bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "2px 10px", borderRadius: "10px", fontSize: "0.75rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color, whiteSpace: "nowrap" }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function sourcePill(source: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    AUTH: { label: "Auth",   bg: "#f1f5f9", color: "#475569" },
    TEST: { label: "Test",   bg: "#eff6ff", color: "#2563eb" },
    XP:   { label: "XP",    bg: "#fdf4ff", color: "#7e22ce" },
  };
  const s = map[source] || { label: source, bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "1px 7px", borderRadius: "8px", fontSize: "0.65rem", fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export default function UserActivityPage() {
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser]             = useState<UserInfo | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [uRes, aRes] = await Promise.all([
      fetch(`/api/users/${userId}`),
      fetch(`/api/users/${userId}/activity?page=${page}&pageSize=50`),
    ]);
    const [uJson, aJson] = await Promise.all([uRes.json(), aRes.json()]);
    setUser(uJson.data);
    setActivities(aJson.data || []);
    setTotalPages(aJson.pagination?.totalPages || 1);
    setTotal(aJson.pagination?.total || 0);
    setLoading(false);
  }, [userId, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const parseMeta = (meta: string | null): string => {
    if (!meta) return "";
    try {
      const obj = JSON.parse(meta);
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(" · ");
    } catch {
      return meta;
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1.25rem", display: "flex", gap: "0.375rem", alignItems: "center" }}>
        <Link href="/admin/users" style={{ color: PURPLE, textDecoration: "none" }}>Users</Link>
        <span>›</span>
        <span>{user?.name || user?.email || userId}</span>
        <span>›</span>
        <span style={{ color: "#0f172a", fontWeight: 600 }}>Activity</span>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Activity History</h1>
        {user && (
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
            {user.name || user.email} · {total} events (auth, tests & XP)
          </p>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading…</p>
      ) : activities.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "3rem", textAlign: "center", color: "#94a3b8", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
          No activity recorded yet.
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Source", "Event", "Details", "Time"].map(h => (
                    <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map(a => (
                  <tr key={a.id}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      {sourcePill(a.source)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      {eventBadge(a)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.75rem", color: "#64748b", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.details || parseMeta(a.meta) || "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "0.4rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: page !== 1 ? "#fff" : "#f8fafc", color: page !== 1 ? "#374151" : "#cbd5e1", cursor: page !== 1 ? "pointer" : "default", fontSize: "0.8125rem" }}>
                ← Prev
              </button>
              <span style={{ padding: "0.4rem 0.75rem", fontSize: "0.875rem", color: "#64748b" }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "0.4rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: page !== totalPages ? "#fff" : "#f8fafc", color: page !== totalPages ? "#374151" : "#cbd5e1", cursor: page !== totalPages ? "pointer" : "default", fontSize: "0.8125rem" }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
