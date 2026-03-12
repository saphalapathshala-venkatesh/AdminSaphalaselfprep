"use client";

import { useState, useEffect, useCallback } from "react";

interface XpRule {
  id: string;
  key: string;
  value: number;
  isEnabled: boolean;
  dailyCap: number | null;
  multiplier: number;
  updatedAt: string;
  updatedBy?: { id: string; name: string | null; email: string | null } | null;
}

interface AuditEntry {
  id: string;
  action: string;
  before: any;
  after: any;
  createdAt: string;
  actor?: { name: string | null; email: string | null } | null;
}

const KEY_LABELS: Record<string, string> = {
  LOGIN_XP:                    "Daily Login XP",
  TEST_XP:                     "Test XP (legacy global)",
  IMPROVEMENT_BONUS_XP:        "Improvement Bonus XP",
  FLASHCARD_XP:                "Flashcard XP (legacy global)",
  RR_XP:                       "Rapid Revision XP",
  VIDEO_SHORT_XP:              "Video XP — short (≤45 min)",
  VIDEO_LONG_XP:               "Video XP — long (>45 min)",
  HTML_XP:                     "HTML Lesson XP (global default)",
  STREAK_7_BONUS:              "Streak Bonus — 7 days",
  STREAK_30_BONUS:             "Streak Bonus — 30 days",
  STREAK_50_BONUS:             "Streak Bonus — 50 days",
  STREAK_100_BONUS:            "Streak Bonus — 100 days",
  REDEMPTION_UNLOCK_THRESHOLD: "Redemption Unlock Threshold (XP)",
  REDEMPTION_CONVERSION_RATE:  "Redemption Conversion (XP per ₹1)",
};

const KEY_GROUPS: Record<string, string[]> = {
  "Daily Login & Streaks": ["LOGIN_XP", "STREAK_7_BONUS", "STREAK_30_BONUS", "STREAK_50_BONUS", "STREAK_100_BONUS"],
  "Content XP": ["VIDEO_SHORT_XP", "VIDEO_LONG_XP", "HTML_XP", "TEST_XP", "FLASHCARD_XP", "RR_XP", "IMPROVEMENT_BONUS_XP"],
  "Redemption": ["REDEMPTION_UNLOCK_THRESHOLD", "REDEMPTION_CONVERSION_RATE"],
};

export default function XpRulesPage() {
  const [rules, setRules] = useState<XpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<XpRule | null>(null);
  const [editForm, setEditForm] = useState({ value: "", isEnabled: true, dailyCap: "", multiplier: "" });
  const [saving, setSaving] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyKey, setHistoryKey] = useState("");
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/xp-rules");
      const json = await res.json();
      setRules(json.data || []);
    } catch { setRules([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openEdit = (r: XpRule) => {
    setEditingRule(r);
    setEditForm({ value: String(r.value), isEnabled: r.isEnabled, dailyCap: r.dailyCap !== null ? String(r.dailyCap) : "", multiplier: String(r.multiplier) });
    setShowEditModal(true);
  };

  const saveRule = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      const res = await fetch("/api/xp-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: editingRule.key,
          value: parseInt(editForm.value) || 0,
          isEnabled: editForm.isEnabled,
          dailyCap: editForm.dailyCap ? parseInt(editForm.dailyCap) : null,
          multiplier: parseFloat(editForm.multiplier) || 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Rule updated", "success");
      setShowEditModal(false);
      fetchRules();
    } catch { showToast("Failed to save", "error"); }
    finally { setSaving(false); }
  };

  const openHistory = async (key: string) => {
    setHistoryKey(key);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const res = await fetch(`/api/xp-rules/history?key=${key}`);
      const json = await res.json();
      setHistory(json.data || []);
    } catch { setHistory([]); }
    setLoadingHistory(false);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.875rem" };
  const btnPrimary: React.CSSProperties = { padding: "0.5rem 1rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 };
  const btnSecondary: React.CSSProperties = { padding: "0.25rem 0.75rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem" };
  const thStyle: React.CSSProperties = { padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" };
  const tdStyle: React.CSSProperties = { padding: "0.75rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.875rem" };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", color: "#fff", background: toast.type === "success" ? "#22c55e" : "#ef4444", zIndex: 1000, fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", marginBottom: "1.5rem" }}>XP Rule Engine</h1>

      {loading ? <p style={{ color: "#999" }}>Loading...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={thStyle}>Rule</th>
                <th style={thStyle}>Value</th>
                <th style={thStyle}>Enabled</th>
                <th style={thStyle}>Daily Cap</th>
                <th style={thStyle}>Multiplier</th>
                <th style={thStyle}>Last Updated</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(KEY_GROUPS).map(([groupName, keys]) => {
                const groupRules = keys.map(k => rules.find(r => r.key === k)).filter(Boolean) as typeof rules;
                if (groupRules.length === 0) return null;
                return [
                  <tr key={`group-${groupName}`}>
                    <td colSpan={7} style={{ padding: "0.5rem 0.75rem", background: "#f1f5f9", fontWeight: 700, fontSize: "0.75rem", color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      {groupName}
                    </td>
                  </tr>,
                  ...groupRules.map(r => (
                    <tr key={r.id}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{KEY_LABELS[r.key] || r.key}</td>
                      <td style={tdStyle}>{r.value}</td>
                      <td style={tdStyle}>
                        <span style={{ padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, background: r.isEnabled ? "#dcfce7" : "#fee2e2", color: r.isEnabled ? "#166534" : "#991b1b" }}>
                          {r.isEnabled ? "Yes" : "No"}
                        </span>
                      </td>
                      <td style={tdStyle}>{r.dailyCap !== null ? r.dailyCap : "None"}</td>
                      <td style={tdStyle}>{r.multiplier}x</td>
                      <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>
                        {new Date(r.updatedAt).toLocaleString()}
                        {r.updatedBy && <span style={{ display: "block", fontSize: "0.7rem" }}>by {r.updatedBy.name || r.updatedBy.email}</span>}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          <button onClick={() => openEdit(r)} style={btnSecondary}>Edit</button>
                          <button onClick={() => openHistory(r.key)} style={btnSecondary}>History</button>
                        </div>
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}

      {showEditModal && editingRule && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", padding: "1.5rem", width: "100%", maxWidth: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Edit: {KEY_LABELS[editingRule.key] || editingRule.key}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>XP Value</label>
                <input type="number" min="0" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Daily Cap (empty = no cap)</label>
                <input type="number" min="0" value={editForm.dailyCap} onChange={e => setEditForm(f => ({ ...f, dailyCap: e.target.value }))} style={inputStyle} placeholder="No cap" />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", color: "#374151", display: "block", marginBottom: "0.25rem" }}>Multiplier</label>
                <input type="number" min="0.1" step="0.1" value={editForm.multiplier} onChange={e => setEditForm(f => ({ ...f, multiplier: e.target.value }))} style={inputStyle} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.isEnabled} onChange={e => setEditForm(f => ({ ...f, isEnabled: e.target.checked }))} />
                Enabled
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setShowEditModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={saveRule} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "#fff", borderRadius: "0.75rem", padding: "1.5rem", width: "100%", maxWidth: "600px", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>History: {KEY_LABELS[historyKey] || historyKey}</h2>
              <button onClick={() => setShowHistoryModal(false)} style={btnSecondary}>Close</button>
            </div>
            {loadingHistory ? <p style={{ color: "#999" }}>Loading...</p> : history.length === 0 ? <p style={{ color: "#999" }}>No history found.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {history.map(h => (
                  <div key={h.id} style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: "0.375rem", fontSize: "0.8rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 500 }}>{h.actor?.name || h.actor?.email || "System"}</span>
                      <span style={{ color: "#6b7280", fontSize: "0.75rem" }}>{new Date(h.createdAt).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem" }}>
                      {h.before && <div><strong>Before:</strong> val={h.before.value}, cap={h.before.dailyCap ?? "none"}, mult={h.before.multiplier}, {h.before.isEnabled ? "on" : "off"}</div>}
                      {h.after && <div><strong>After:</strong> val={h.after.value}, cap={h.after.dailyCap ?? "none"}, mult={h.after.multiplier}, {h.after.isEnabled ? "on" : "off"}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
