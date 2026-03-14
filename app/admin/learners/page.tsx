"use client";

import { useState, useEffect, useCallback } from "react";

const ENTITLEMENT_OPTIONS = ["SELFPREP_HTML", "TESTHUB", "FLASHCARDS", "PDF_ACCESS", "SMART_PRACTICE", "AI_ADDON"];

interface Learner {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  totalXp: number;
  lastActiveAt: string | null;
  activeEntitlements: number;
}

interface Entitlement {
  id: string;
  productCode: string;
  status: string;
  validUntil: string | null;
  createdAt: string;
}

interface AttemptItem {
  id: string;
  testId: string;
  scorePct: number;
  startedAt: string;
  submittedAt: string | null;
  correctCount: number;
  wrongCount: number;
  test: { title: string } | null;
}

interface XpEntry {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
}

interface PurchaseItem {
  id: string;
  grossPaise: number;
  feePaise: number;
  netPaise: number;
  stream: string;
  createdAt: string;
  package: { code: string; name: string } | null;
  coupon: { code: string } | null;
}

interface LearnerProfile {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  totalXp: number;
  entitlements: Entitlement[];
  attempts: AttemptItem[];
  xpHistory: XpEntry[];
  purchases: PurchaseItem[];
}

export default function LearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileTab, setProfileTab] = useState<"overview" | "attempts" | "xp" | "purchases">("overview");

  const [grantCode, setGrantCode] = useState("");
  const [grantUntil, setGrantUntil] = useState("");

  const [pwResetOpen, setPwResetOpen] = useState(false);
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "", mustChangePassword: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const fetchLearners = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", filter });
      if (search) params.set("search", search);
      const res = await fetch(`/api/learners?${params}`);
      const json = await res.json();
      setLearners(json.data || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch { setLearners([]); }
    setLoading(false);
  }, [page, search, filter]);

  useEffect(() => { fetchLearners(); }, [fetchLearners]);

  const fetchProfile = async (id: string) => {
    setSelectedId(id);
    setLoadingProfile(true);
    setProfileTab("overview");
    try {
      const res = await fetch(`/api/learners/${id}`);
      const json = await res.json();
      setProfile(json.data || null);
    } catch { setProfile(null); }
    setLoadingProfile(false);
  };

  const grantEntitlement = async () => {
    if (!selectedId || !grantCode) { showToast("Select an entitlement code", "error"); return; }
    try {
      const res = await fetch(`/api/learners/${selectedId}/entitlements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GRANT", productCode: grantCode, validUntil: grantUntil || null }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Entitlement granted", "success");
      setGrantCode("");
      setGrantUntil("");
      fetchProfile(selectedId);
      fetchLearners();
    } catch { showToast("Failed to grant", "error"); }
  };

  const revokeEntitlement = async (productCode: string) => {
    if (!selectedId) return;
    if (!confirm(`Revoke ${productCode}?`)) return;
    try {
      const res = await fetch(`/api/learners/${selectedId}/entitlements`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REVOKE", productCode }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast("Entitlement revoked", "success");
      fetchProfile(selectedId);
      fetchLearners();
    } catch { showToast("Failed to revoke", "error"); }
  };

  const toggleStatus = async () => {
    if (!selectedId || !profile) return;
    try {
      const res = await fetch(`/api/learners/${selectedId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !profile.isActive }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed", "error"); return; }
      showToast(profile.isActive ? "User deactivated" : "User activated", "success");
      fetchProfile(selectedId);
      fetchLearners();
    } catch { showToast("Failed to update status", "error"); }
  };

  const archiveUser = async () => {
    if (!selectedId || !profile) return;
    setArchiveSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error || "Failed to archive user", "error"); setArchiveSaving(false); return; }
      setArchiveOpen(false);
      setSelectedId(null);
      setProfile(null);
      showToast("Learner archived. Their data is preserved and all sessions have been revoked.", "success");
      fetchLearners();
    } catch { showToast("Failed to archive user", "error"); }
    setArchiveSaving(false);
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.5rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.875rem" };
  const btnPrimary: React.CSSProperties = { padding: "0.5rem 1rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 };
  const btnDanger: React.CSSProperties = { padding: "0.25rem 0.75rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem" };
  const btnSecondary: React.CSSProperties = { padding: "0.25rem 0.75rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem" };
  const thStyle: React.CSSProperties = { padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #e5e7eb", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" };
  const tdStyle: React.CSSProperties = { padding: "0.75rem", borderBottom: "1px solid #f3f4f6", fontSize: "0.875rem" };

  return (
    <div style={{ display: "flex", gap: "1.5rem" }}>
      {toast && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", color: "#fff", background: toast.type === "success" ? "#22c55e" : "#ef4444", zIndex: 1000, fontSize: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          {toast.msg}
        </div>
      )}

      {/* LEFT: Learner List */}
      <div style={{ flex: selectedId ? "0 0 50%" : "1 1 100%", minWidth: 0 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#111", marginBottom: "1rem" }}>Learners</h1>

        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Search name, email, mobile..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ ...inputStyle, maxWidth: "260px" }} />
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, maxWidth: "140px" }}>
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
          </select>
        </div>

        {loading ? <p style={{ color: "#999" }}>Loading...</p> : learners.length === 0 ? <p style={{ color: "#999" }}>No learners found.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "0.5rem", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>XP</th>
                  <th style={thStyle}>Last Active</th>
                  <th style={thStyle}>Entitlements</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map(l => (
                  <tr key={l.id} style={{ background: selectedId === l.id ? "#eff6ff" : undefined, cursor: "pointer" }} onClick={() => fetchProfile(l.id)}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{l.name || "—"}</td>
                    <td style={{ ...tdStyle, fontSize: "0.75rem" }}>
                      {l.email && <div>{l.email}</div>}
                      {l.mobile && <div>{l.mobile}</div>}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "#7c3aed" }}>{l.totalXp}</td>
                    <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>
                      {l.lastActiveAt ? new Date(l.lastActiveAt).toLocaleDateString() : "Never"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", background: l.activeEntitlements > 0 ? "#dbeafe" : "#f3f4f6", color: l.activeEntitlements > 0 ? "#1e40af" : "#6b7280" }}>
                        {l.activeEntitlements}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500, background: l.isActive ? "#dcfce7" : "#fee2e2", color: l.isActive ? "#166534" : "#991b1b" }}>
                        {l.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={e => { e.stopPropagation(); fetchProfile(l.id); }} style={btnSecondary}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1rem" }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>Prev</button>
            <span style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>Next</button>
          </div>
        )}
      </div>

      {/* RIGHT: Profile Panel */}
      {selectedId && (
        <div style={{ flex: "0 0 48%", background: "#fff", borderRadius: "0.75rem", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", maxHeight: "calc(100vh - 120px)", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>Learner Profile</h2>
            <button onClick={() => { setSelectedId(null); setProfile(null); }} style={btnSecondary}>Close</button>
          </div>

          {loadingProfile ? <p style={{ color: "#999" }}>Loading...</p> : !profile ? <p style={{ color: "#999" }}>Not found.</p> : (
            <div>
              {/* Basic Info */}
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f9fafb", borderRadius: "0.375rem" }}>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>{profile.name || "Unnamed"}</div>
                <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>{profile.email}{profile.mobile && ` | ${profile.mobile}`}</div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", fontSize: "0.8rem" }}>
                  <span>XP: <strong style={{ color: "#7c3aed" }}>{profile.totalXp}</strong></span>
                  <span style={{ padding: "0.125rem 0.5rem", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 500, background: profile.isActive ? "#dcfce7" : "#fee2e2", color: profile.isActive ? "#166534" : "#991b1b" }}>
                    {profile.isActive ? "Active" : "Inactive"}
                  </span>
                  <button onClick={toggleStatus} style={{ ...btnSecondary, fontSize: "0.7rem" }}>
                    {profile.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => { setPwForm({ newPassword: "", confirmPassword: "", mustChangePassword: false }); setPwError(""); setPwResetOpen(true); }} style={{ ...btnSecondary, fontSize: "0.7rem", borderColor: "#7c3aed", color: "#7c3aed" }}>
                    Reset Password
                  </button>
                  <button onClick={() => setArchiveOpen(true)} style={{ ...btnSecondary, fontSize: "0.7rem", borderColor: "#dc2626", color: "#dc2626" }}>
                    Archive
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: "0", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb" }}>
                {(["overview", "attempts", "xp", "purchases"] as const).map(t => (
                  <button key={t} onClick={() => setProfileTab(t)} style={{ padding: "0.5rem 1rem", border: "none", background: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: profileTab === t ? 600 : 400, color: profileTab === t ? "#2563eb" : "#6b7280", borderBottom: profileTab === t ? "2px solid #2563eb" : "2px solid transparent", marginBottom: "-2px" }}>
                    {t === "overview" ? "Overview" : t === "attempts" ? "Attempts" : t === "xp" ? "XP History" : "Purchases"}
                  </button>
                ))}
              </div>

              {/* OVERVIEW TAB */}
              {profileTab === "overview" && (
                <div>
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>Entitlements</h3>
                  {profile.entitlements.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No entitlements.</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "1rem" }}>
                      {profile.entitlements.map(e => (
                        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem", background: "#f9fafb", borderRadius: "0.375rem", fontSize: "0.8rem" }}>
                          <div>
                            <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{e.productCode}</span>
                            <span style={{ marginLeft: "0.5rem", padding: "0.125rem 0.375rem", borderRadius: "9999px", fontSize: "0.65rem", fontWeight: 500, background: e.status === "ACTIVE" ? "#dcfce7" : e.status === "REVOKED" ? "#fee2e2" : "#fef3c7", color: e.status === "ACTIVE" ? "#166534" : e.status === "REVOKED" ? "#991b1b" : "#92400e" }}>
                              {e.status}
                            </span>
                            {e.validUntil && <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "#6b7280" }}>until {new Date(e.validUntil).toLocaleDateString()}</span>}
                          </div>
                          {e.status === "ACTIVE" && (
                            <button onClick={() => revokeEntitlement(e.productCode)} style={{ ...btnDanger, fontSize: "0.65rem", padding: "0.125rem 0.5rem" }}>Revoke</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grant Entitlement */}
                  <div style={{ padding: "0.75rem", background: "#f0fdf4", borderRadius: "0.375rem", border: "1px solid #bbf7d0" }}>
                    <h4 style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.5rem" }}>Grant Entitlement</h4>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                      <select value={grantCode} onChange={e => setGrantCode(e.target.value)} style={{ ...inputStyle, maxWidth: "180px" }}>
                        <option value="">Select...</option>
                        {ENTITLEMENT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <input type="date" value={grantUntil} onChange={e => setGrantUntil(e.target.value)} style={{ ...inputStyle, maxWidth: "150px" }} placeholder="Valid until" />
                      <button onClick={grantEntitlement} style={{ ...btnPrimary, fontSize: "0.75rem", padding: "0.5rem 0.75rem" }}>Grant</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ATTEMPTS TAB */}
              {profileTab === "attempts" && (
                <div>
                  {profile.attempts.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No attempts.</p> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead><tr><th style={thStyle}>Test</th><th style={thStyle}>Score</th><th style={thStyle}>Correct</th><th style={thStyle}>Wrong</th><th style={thStyle}>Date</th></tr></thead>
                      <tbody>
                        {profile.attempts.map(a => (
                          <tr key={a.id}>
                            <td style={tdStyle}>{a.test?.title || a.testId}</td>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{a.scorePct.toFixed(1)}%</td>
                            <td style={{ ...tdStyle, color: "#16a34a" }}>{a.correctCount}</td>
                            <td style={{ ...tdStyle, color: "#dc2626" }}>{a.wrongCount}</td>
                            <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>{new Date(a.startedAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* XP HISTORY TAB */}
              {profileTab === "xp" && (
                <div>
                  {profile.xpHistory.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No XP history.</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {profile.xpHistory.map(x => (
                        <div key={x.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem", background: "#f9fafb", borderRadius: "0.25rem", fontSize: "0.8rem" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: x.delta >= 0 ? "#16a34a" : "#dc2626" }}>{x.delta >= 0 ? "+" : ""}{x.delta}</span>
                            <span style={{ marginLeft: "0.5rem", color: "#374151" }}>{x.reason}</span>
                          </div>
                          <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>{new Date(x.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PURCHASES TAB */}
              {profileTab === "purchases" && (
                <div>
                  {profile.purchases.length === 0 ? <p style={{ fontSize: "0.8rem", color: "#999" }}>No purchases.</p> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead><tr><th style={thStyle}>Package</th><th style={thStyle}>Amount</th><th style={thStyle}>Coupon</th><th style={thStyle}>Date</th></tr></thead>
                      <tbody>
                        {profile.purchases.map(p => (
                          <tr key={p.id}>
                            <td style={tdStyle}>{p.package?.name || "—"}</td>
                            <td style={tdStyle}>₹{(p.grossPaise / 100).toFixed(2)}</td>
                            <td style={tdStyle}>{p.coupon?.code || "—"}</td>
                            <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#6b7280" }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    {/* ── Archive Confirmation Modal ────────────────────────────────────────── */}
    {archiveOpen && profile && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "1.75rem", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.0625rem", fontWeight: 700, color: "#dc2626" }}>Archive Learner</h2>
          <p style={{ margin: "0 0 0.75rem", color: "#475569", fontSize: "0.875rem", lineHeight: 1.5 }}>
            <strong>{profile.name || profile.email || "This learner"}</strong> will be soft-deleted:
          </p>
          <ul style={{ margin: "0 0 1.25rem", paddingLeft: "1.25rem", color: "#475569", fontSize: "0.8125rem", lineHeight: 1.8 }}>
            <li>Their account will be flagged as archived and hidden from active lists</li>
            <li>All active sessions will be immediately revoked — they cannot log in</li>
            <li>All related data (purchases, test attempts, progress, entitlements, XP) is preserved</li>
            <li>This action can be reversed by a SUPER_ADMIN via the Users page</li>
          </ul>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={archiveUser}
              disabled={archiveSaving}
              style={{ padding: "0.5625rem 1.25rem", borderRadius: "7px", border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: archiveSaving ? "not-allowed" : "pointer", fontSize: "0.9rem", opacity: archiveSaving ? 0.7 : 1 }}
            >
              {archiveSaving ? "Archiving…" : "Archive Learner"}
            </button>
            <button onClick={() => setArchiveOpen(false)} style={{ padding: "0.5625rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Password Reset Modal ──────────────────────────────────────────────── */}
    {pwResetOpen && selectedId && profile && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "1.75rem", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a" }}>Reset Password</h2>
          <p style={{ margin: "0 0 1.25rem", color: "#64748b", fontSize: "0.8125rem" }}>
            Set a new password for <strong>{profile.name || profile.email || "this learner"}</strong>.
          </p>

          {pwError && (
            <div style={{ marginBottom: "0.875rem", padding: "0.5rem 0.75rem", background: "#fee2e2", borderRadius: "6px", color: "#dc2626", fontSize: "0.8125rem", fontWeight: 600 }}>{pwError}</div>
          )}

          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}>New Password</label>
          <input
            type="password"
            value={pwForm.newPassword}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box", marginBottom: "0.75rem" }}
            placeholder="Min 8 characters"
            autoComplete="new-password"
          />

          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem" }}>Confirm New Password</label>
          <input
            type="password"
            value={pwForm.confirmPassword}
            onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
            style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box", marginBottom: "0.75rem" }}
            placeholder="Re-enter password"
            autoComplete="new-password"
          />

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "#374151", cursor: "pointer", marginBottom: "1.5rem" }}>
            <input
              type="checkbox"
              checked={pwForm.mustChangePassword}
              onChange={e => setPwForm(f => ({ ...f, mustChangePassword: e.target.checked }))}
              style={{ width: 15, height: 15, accentColor: "#7c3aed" }}
            />
            Require password change on next login
          </label>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={async () => {
                setPwError("");
                if (!pwForm.newPassword || !pwForm.confirmPassword) { setPwError("Both fields are required"); return; }
                if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError("Passwords do not match"); return; }
                if (pwForm.newPassword.length < 8) { setPwError("Password must be at least 8 characters"); return; }
                setPwSaving(true);
                const res = await fetch(`/api/users/${selectedId}/password`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ newPassword: pwForm.newPassword, confirmPassword: pwForm.confirmPassword, mustChangePassword: pwForm.mustChangePassword }),
                });
                const json = await res.json();
                setPwSaving(false);
                if (!res.ok) { setPwError(json.error || "Failed to reset password"); return; }
                setPwResetOpen(false);
                showToast("Password reset successfully", "success");
              }}
              disabled={pwSaving}
              style={{ padding: "0.5625rem 1.25rem", borderRadius: "7px", border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, cursor: pwSaving ? "not-allowed" : "pointer", fontSize: "0.9rem", opacity: pwSaving ? 0.7 : 1 }}
            >
              {pwSaving ? "Saving…" : "Reset Password"}
            </button>
            <button onClick={() => setPwResetOpen(false)} style={{ padding: "0.5625rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
