"use client";
import { useState, useEffect, useCallback } from "react";
import { BRAND, adminCard, adminTable } from "@/lib/adminStyles";

type Tab = "profile" | "payment" | "audit" | "admins" | "platform" | "danger";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile & Security" },
  { id: "payment", label: "Payments" },
  { id: "audit", label: "Audit Logs" },
  { id: "admins", label: "Admin Access" },
  { id: "platform", label: "Platform" },
  { id: "danger", label: "Danger Zone" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.375rem",
  fontSize: "0.875rem",
  boxSizing: "border-box",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.25rem",
  display: "block",
};

function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", margin: 0 }}>{title}</h2>
      {desc && <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginTop: "0.25rem", marginBottom: 0 }}>{desc}</p>}
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div style={{
      position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 9999,
      background: type === "ok" ? "#d1fae5" : "#fee2e2",
      color: type === "ok" ? "#065f46" : "#991b1b",
      border: `1px solid ${type === "ok" ? "#6ee7b7" : "#fca5a5"}`,
      borderRadius: "0.5rem", padding: "0.75rem 1.25rem",
      fontSize: "0.875rem", fontWeight: 500, boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
      maxWidth: "360px",
    }}>{msg}</div>
  );
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const show = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}

// ─── Profile & Security ───────────────────────────────────────────────────────
function ProfileTab({ show }: { show: (m: string, t?: "ok" | "err") => void }) {
  const [profile, setProfile] = useState<{
    id: string; email: string | null; name: string | null; role: string;
    createdAt: string; lastLogin: string | null; activeSessions: number;
  } | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", new: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((d) => { setProfile(d); setNameInput(d.name ?? ""); });
  }, []);

  async function saveName() {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const r = await fetch("/api/settings/profile", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput }),
    });
    const d = await r.json();
    setSavingName(false);
    if (r.ok) { setProfile((p) => p ? { ...p, name: d.name } : p); setEditingName(false); show("Display name updated"); }
    else show(d.error ?? "Update failed", "err");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwForm.current || !pwForm.new || !pwForm.confirm) { show("All fields are required", "err"); return; }
    if (pwForm.new !== pwForm.confirm) { show("New passwords do not match", "err"); return; }
    if (pwForm.new.length < 8) { show("Password must be at least 8 characters", "err"); return; }
    setPwSaving(true);
    const r = await fetch("/api/settings/password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new, confirmPassword: pwForm.confirm }),
    });
    const d = await r.json();
    setPwSaving(false);
    if (r.ok) { setPwForm({ current: "", new: "", confirm: "" }); setShowPw(false); show("Password changed successfully"); }
    else show(d.error ?? "Password change failed", "err");
  }

  if (!profile) return <div style={{ padding: "2rem", color: "#888", textAlign: "center" }}>Loading profile…</div>;

  const fmt = (dt: string | null) => dt
    ? new Date(dt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  const readonlyField: React.CSSProperties = {
    fontSize: "0.875rem", padding: "0.5rem 0.75rem",
    background: "#f9fafb", border: "1px solid #e5e7eb",
    borderRadius: "0.375rem", color: "#374151",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "0.5rem 0.875rem", background: BRAND.purple, color: "#fff",
    border: "none", borderRadius: "0.375rem", cursor: "pointer",
    fontSize: "0.8125rem", fontWeight: 500,
  };
  const btnSecondary: React.CSSProperties = {
    padding: "0.5rem 0.875rem", background: "#f3f4f6", color: "#374151",
    border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer",
    fontSize: "0.8125rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Profile details */}
      <div style={adminCard}>
        <SectionHead title="Profile Details" desc="Your admin account information." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <div style={labelStyle}>Email</div>
            <div style={readonlyField}>{profile.email ?? "—"}</div>
          </div>
          <div>
            <div style={labelStyle}>Role</div>
            <div style={{ ...readonlyField, display: "flex", alignItems: "center" }}>
              <span style={{ background: profile.role === "SUPER_ADMIN" ? "#fef3c7" : "#ede9fe", color: profile.role === "SUPER_ADMIN" ? "#92400e" : "#5b21b6", padding: "2px 10px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700 }}>{profile.role}</span>
            </div>
          </div>
          <div>
            <div style={labelStyle}>Display Name</div>
            {editingName ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus onKeyDown={(e) => e.key === "Enter" && saveName()} />
                <button onClick={saveName} disabled={savingName} style={btnPrimary}>{savingName ? "Saving…" : "Save"}</button>
                <button onClick={() => { setEditingName(false); setNameInput(profile.name ?? ""); }} style={btnSecondary}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div style={{ ...readonlyField, flex: 1 }}>{profile.name || <span style={{ color: "#9ca3af" }}>Not set</span>}</div>
                <button onClick={() => setEditingName(true)} style={btnSecondary}>Edit</button>
              </div>
            )}
          </div>
          <div>
            <div style={labelStyle}>Member Since</div>
            <div style={readonlyField}>{fmt(profile.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Session info */}
      <div style={adminCard}>
        <SectionHead title="Session & Login Info" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <div style={labelStyle}>Last Login (previous)</div>
            <div style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "0.375rem", color: "#374151" }}>{fmt(profile.lastLogin)}</div>
          </div>
          <div>
            <div style={labelStyle}>Active Sessions</div>
            <div style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "0.375rem", color: "#374151" }}>
              {profile.activeSessions} session{profile.activeSessions !== 1 ? "s" : ""}
              <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: "0.5rem" }}>(To revoke others, see Danger Zone)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div style={adminCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: showPw ? "1.25rem" : "0.25rem" }}>
          <SectionHead
            title="Change Password"
            desc={showPw ? "Enter your current password to verify, then set a new one." : "Update your admin account password."}
          />
          <button
            onClick={() => { setShowPw((v) => !v); setPwForm({ current: "", new: "", confirm: "" }); }}
            style={{ ...showPw ? { ...btnSecondary } : { ...btnPrimary }, whiteSpace: "nowrap", marginLeft: "1rem" }}
          >
            {showPw ? "Cancel" : "Change Password"}
          </button>
        </div>
        {showPw && (
          <form onSubmit={changePassword} style={{ display: "flex", flexDirection: "column", gap: "0.875rem", maxWidth: "400px" }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} style={inputStyle} autoComplete="current-password" required />
            </div>
            <div>
              <label style={labelStyle}>New Password</label>
              <input type="password" value={pwForm.new} onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })} style={inputStyle} autoComplete="new-password" required minLength={8} />
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>Minimum 8 characters</div>
            </div>
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <input
                type="password" value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                style={{ ...inputStyle, borderColor: pwForm.confirm && pwForm.confirm !== pwForm.new ? "#fca5a5" : "#d1d5db" }}
                autoComplete="new-password" required
              />
              {pwForm.confirm && pwForm.confirm !== pwForm.new && (
                <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>Passwords do not match</div>
              )}
            </div>
            <button type="submit" disabled={pwSaving} style={{ ...btnPrimary, alignSelf: "flex-start", padding: "0.5rem 1.25rem" }}>
              {pwSaving ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Payment Settings ─────────────────────────────────────────────────────────
type PaymentCfg = {
  razorpay: { configured: boolean; mode: string; keyId: string; keySecret: string | null; webhookSecret: string | null };
};

function PaymentTab() {
  const [cfg, setCfg] = useState<PaymentCfg | null>(null);

  useEffect(() => {
    fetch("/api/settings/payment").then((r) => r.json()).then(setCfg);
  }, []);

  if (!cfg) return <div style={{ padding: "2rem", color: "#888", textAlign: "center" }}>Loading payment config…</div>;

  const rz = cfg.razorpay;
  const modeColors: Record<string, { bg: string; text: string }> = {
    live: { bg: "#d1fae5", text: "#065f46" },
    test: { bg: "#fef3c7", text: "#92400e" },
    not_configured: { bg: "#fee2e2", text: "#991b1b" },
    unknown: { bg: "#f3f4f6", text: "#374151" },
  };
  const mc = modeColors[rz.mode] ?? modeColors.unknown;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={adminCard}>
        <SectionHead title="Razorpay" desc="Payment gateway configuration and status." />

        <div style={{
          display: "flex", alignItems: "center", gap: "0.875rem",
          padding: "1rem", background: rz.configured ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${rz.configured ? "#bbf7d0" : "#fecaca"}`,
          borderRadius: "0.5rem", marginBottom: "1.25rem",
        }}>
          <span style={{ fontSize: "1.375rem" }}>{rz.configured ? "✓" : "✗"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: rz.configured ? "#15803d" : "#dc2626" }}>
              {rz.configured ? "Razorpay is configured" : "Razorpay is not configured"}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
              {rz.configured
                ? "API keys are present in the environment."
                : "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your environment variables."}
            </div>
          </div>
          <span style={{ background: mc.bg, color: mc.text, padding: "3px 12px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" as const }}>
            {rz.mode.replace("_", " ")}
          </span>
        </div>

        {rz.configured && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", marginBottom: "1rem" }}>
            <tbody>
              {[
                { label: "Key ID", value: rz.keyId, note: rz.mode === "live" ? "Live key active" : "Test key active" },
                { label: "Key Secret", value: rz.keySecret ?? "—" },
                { label: "Webhook Secret", value: rz.webhookSecret ?? "Not configured" },
              ].map(({ label, value, note }) => (
                <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ ...adminTable.td, color: "#6b7280", fontWeight: 600, width: "160px" }}>{label}</td>
                  <td style={{ ...adminTable.td, fontFamily: "monospace", fontSize: "0.8125rem", color: "#374151" }}>{value}</td>
                  {note && <td style={{ ...adminTable.td, color: "#9ca3af", fontSize: "0.75rem" }}>{note}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ padding: "0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: 0 }}>
            Credentials are loaded from environment variables and shown masked. To switch between test and live keys, update{" "}
            <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: "3px" }}>RAZORPAY_KEY_ID</code> and{" "}
            <code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: "3px" }}>RAZORPAY_KEY_SECRET</code>{" "}
            in your deployment environment.
          </p>
        </div>
      </div>

      <div style={{ ...adminCard, opacity: 0.55 }}>
        <SectionHead title="Additional Gateways" desc="Staged for future integration." />
        <div style={{ fontSize: "0.8125rem", color: "#9ca3af" }}>Cashfree and other payment providers can be configured here in a future release.</div>
      </div>
    </div>
  );
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
type AuditEntry = {
  id: string; action: string; entityType: string; entityId: string | null;
  createdAt: string; ip: string | null;
  actor: { id: string; name: string | null; email: string | null; role: string } | null;
};

function AuditTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [actors, setActors] = useState<{ id: string | null; name: string | null; email: string | null }[]>([]);
  const [actionsList, setActionsList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ action: "", actorId: "", entityType: "", from: "", to: "" });

  async function load(f = filters, p = 1) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.action) params.set("action", f.action);
    if (f.actorId) params.set("actorId", f.actorId);
    if (f.entityType) params.set("entityType", f.entityType);
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    params.set("page", String(p));
    const r = await fetch("/api/settings/audit-logs?" + params.toString());
    const d = await r.json();
    setLogs(d.logs ?? []);
    setTotal(d.total ?? 0);
    setPage(d.page ?? 1);
    setPages(d.pages ?? 1);
    if (d.actors?.length) setActors(d.actors);
    if (d.actions?.length) setActionsList(d.actions);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const applyFilters = () => load(filters, 1);
  const clearFilters = () => { const f = { action: "", actorId: "", entityType: "", from: "", to: "" }; setFilters(f); load(f, 1); };

  const actionBadge = (a: string) => {
    if (a.includes("DELETE") || a.includes("DISABLED") || a.includes("BLOCKED")) return { bg: "#fee2e2", text: "#991b1b" };
    if (a.includes("CREATE") || a.includes("ENABLED") || a.includes("COMMIT")) return { bg: "#d1fae5", text: "#065f46" };
    if (a.includes("LOGIN") || a.includes("LOGOUT")) return { bg: "#dbeafe", text: "#1e40af" };
    if (a.includes("UPDATE") || a.includes("CHANGED") || a.includes("EDITED")) return { bg: "#fef3c7", text: "#92400e" };
    if (a.includes("PUBLISH") || a.includes("UNPUBLISH")) return { bg: "#ede9fe", text: "#5b21b6" };
    return { bg: "#f3f4f6", text: "#374151" };
  };

  const fmtDt = (dt: string) => new Date(dt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const selStyle = { ...inputStyle, background: "#fff" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={adminCard}>
        <SectionHead title="Audit Log Viewer" desc={`${total.toLocaleString()} record${total !== 1 ? "s" : ""} matching current filters`} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr) auto auto", gap: "0.5rem", alignItems: "flex-end", marginBottom: "1rem" }}>
          <div>
            <label style={labelStyle}>Action</label>
            <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} style={selStyle}>
              <option value="">All actions</option>
              {actionsList.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Admin</label>
            <select value={filters.actorId} onChange={(e) => setFilters({ ...filters, actorId: e.target.value })} style={selStyle}>
              <option value="">All admins</option>
              {actors.filter((a) => a.id).map((a) => <option key={a.id!} value={a.id!}>{a.name ?? a.email ?? a.id}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Module</label>
            <input placeholder="e.g. Question" value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })} style={selStyle} />
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} style={selStyle} />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} style={selStyle} />
          </div>
          <button onClick={applyFilters} style={{ padding: "0.5rem 0.875rem", background: BRAND.purple, color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, height: "36px" }}>
            Filter
          </button>
          <button onClick={clearFilters} style={{ padding: "0.5rem 0.875rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", height: "36px" }}>
            Clear
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#888" }}>Loading…</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    {["Time", "Admin", "Action", "Module", "Entity ID", "IP"].map((h) => (
                      <th key={h} style={adminTable.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#888" }}>No logs found for the current filters.</td></tr>
                  ) : logs.map((l) => {
                    const ab = actionBadge(l.action);
                    return (
                      <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ ...adminTable.td, whiteSpace: "nowrap", color: "#6b7280" }}>{fmtDt(l.createdAt)}</td>
                        <td style={adminTable.td}>
                          {l.actor ? (
                            <>
                              <div style={{ fontWeight: 500 }}>{l.actor.name ?? "—"}</div>
                              <div style={{ fontSize: "0.725rem", color: "#9ca3af" }}>{l.actor.email}</div>
                            </>
                          ) : <span style={{ color: "#9ca3af" }}>System</span>}
                        </td>
                        <td style={adminTable.td}>
                          <span style={{ background: ab.bg, color: ab.text, padding: "2px 8px", borderRadius: "9999px", fontSize: "0.725rem", fontWeight: 600, whiteSpace: "nowrap" }}>{l.action}</span>
                        </td>
                        <td style={{ ...adminTable.td, color: "#374151" }}>{l.entityType}</td>
                        <td style={{ ...adminTable.td, fontFamily: "monospace", fontSize: "0.75rem", color: "#6b7280" }}>
                          {l.entityId ? l.entityId.slice(0, 14) + "…" : "—"}
                        </td>
                        <td style={{ ...adminTable.td, fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af" }}>{l.ip ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.8125rem", color: "#6b7280" }}>
                <span>Page {page} of {pages} · {total.toLocaleString()} total</span>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => load(filters, page - 1)} disabled={page <= 1} style={{ padding: "0.25rem 0.75rem", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>← Prev</button>
                  <button onClick={() => load(filters, page + 1)} disabled={page >= pages} style={{ padding: "0.25rem 0.75rem", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: page >= pages ? "default" : "pointer", opacity: page >= pages ? 0.4 : 1 }}>Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Admin Access ─────────────────────────────────────────────────────────────
type AdminUser = { id: string; email: string | null; name: string | null; role: string; isActive: boolean; createdAt: string };

function AdminsTab({ currentId, currentRole, show }: { currentId: string; currentRole: string; show: (m: string, t?: "ok" | "err") => void }) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "ADMIN" });
  const isSuperAdmin = currentRole === "SUPER_ADMIN";

  useEffect(() => {
    fetch("/api/settings/admins").then((r) => r.json()).then((d) => { setAdmins(d.admins ?? []); setLoading(false); });
  }, []);

  async function toggleStatus(id: string, current: boolean) {
    const r = await fetch("/api/settings/admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive: !current }) });
    const d = await r.json();
    if (r.ok) { setAdmins((prev) => prev.map((a) => a.id === id ? { ...a, isActive: !current } : a)); show(!current ? "Admin enabled" : "Admin disabled"); }
    else show(d.error ?? "Update failed", "err");
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const r = await fetch("/api/settings/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json();
    setSaving(false);
    if (r.ok) { setAdmins((prev) => [...prev, d.admin]); setForm({ email: "", name: "", password: "", role: "ADMIN" }); setShowForm(false); show("Admin account created"); }
    else show(d.error ?? "Failed to create admin", "err");
  }

  const fmtDate = (dt: string) => new Date(dt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={adminCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <SectionHead title="Admin Users" desc={`${admins.length} admin account${admins.length !== 1 ? "s" : ""} in this console`} />
          {isSuperAdmin && (
            <button onClick={() => setShowForm((v) => !v)} style={{ padding: "0.4375rem 0.875rem", background: showForm ? "#f3f4f6" : BRAND.purple, color: showForm ? "#374151" : "#fff", border: showForm ? "1px solid #d1d5db" : "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500 }}>
              {showForm ? "Cancel" : "+ Add Admin"}
            </button>
          )}
        </div>

        {!isSuperAdmin && (
          <div style={{ padding: "0.75rem 1rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "0.5rem", marginBottom: "1rem", fontSize: "0.8125rem", color: "#92400e" }}>
            Creating or enabling/disabling admin accounts requires SUPER_ADMIN access.
          </div>
        )}

        {showForm && isSuperAdmin && (
          <form onSubmit={createAdmin} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem", marginBottom: "1.25rem" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Full Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} required placeholder="e.g. Priya Sharma" />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} required placeholder="admin@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Role *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ ...inputStyle, background: "#fff" }}>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Temporary Password * (min 8 characters)</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} required minLength={8} placeholder="They should change this after first login" />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" disabled={saving} style={{ padding: "0.5rem 1.25rem", background: BRAND.purple, color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}>
                {saving ? "Creating…" : "Create Admin Account"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "1.5rem", color: "#888" }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Name / Email", "Role", "Status", "Joined", ...(isSuperAdmin ? ["Actions"] : [])].map((h) => (
                  <th key={h} style={adminTable.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={adminTable.td}>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {a.name ?? "—"}
                      {a.id === currentId && <span style={{ fontSize: "0.7rem", background: BRAND.purpleLight, color: BRAND.purple, padding: "1px 6px", borderRadius: "9999px", fontWeight: 700 }}>YOU</span>}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{a.email ?? "—"}</div>
                  </td>
                  <td style={adminTable.td}>
                    <span style={{ background: a.role === "SUPER_ADMIN" ? "#fef3c7" : "#ede9fe", color: a.role === "SUPER_ADMIN" ? "#92400e" : "#5b21b6", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 700 }}>{a.role}</span>
                  </td>
                  <td style={adminTable.td}>
                    <span style={{ background: a.isActive ? "#d1fae5" : "#fee2e2", color: a.isActive ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600 }}>
                      {a.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ ...adminTable.td, color: "#9ca3af" }}>{fmtDate(a.createdAt)}</td>
                  {isSuperAdmin && (
                    <td style={adminTable.td}>
                      {a.id !== currentId ? (
                        <button onClick={() => toggleStatus(a.id, a.isActive)} style={{ padding: "0.25rem 0.625rem", background: a.isActive ? "#fff" : "#fff", color: a.isActive ? "#dc2626" : "#16a34a", border: `1px solid ${a.isActive ? "#fca5a5" : "#86efac"}`, borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600 }}>
                          {a.isActive ? "Disable" : "Enable"}
                        </button>
                      ) : <span style={{ color: "#d1d5db", fontSize: "0.75rem" }}>—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Platform ─────────────────────────────────────────────────────────────────
function PlatformTab() {
  const rows = [
    { label: "Platform", value: "Saphala Self Prep Admin Console" },
    { label: "Framework", value: "Next.js 14 (App Router)" },
    { label: "Database ORM", value: "Prisma v5 · PostgreSQL (Neon)" },
    { label: "Auth", value: "Session-based · httpOnly cookie · 7-day expiry" },
    { label: "Tenant", value: "default" },
    { label: "Currency", value: "INR (₹) — amounts stored as integer paise" },
    { label: "Environment", value: process.env.NODE_ENV ?? "unknown" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={adminCard}>
        <SectionHead title="Platform Info" desc="Read-only environment overview." />
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <tbody>
            {rows.map(({ label, value }) => (
              <tr key={label} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ ...adminTable.td, color: "#6b7280", fontWeight: 600, width: "200px" }}>{label}</td>
                <td style={{ ...adminTable.td, color: "#374151" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={adminCard}>
        <SectionHead title="Contact & Business Details" desc="Managed via environment variables." />
        <div style={{ padding: "0.875rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 0.5rem" }}>
            Business name, support email, and similar details are read from deployment environment variables — no schema storage required. Set the following in your environment to surface them in the app:
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "#374151", lineHeight: "1.8" }}>
            {[["SITE_NAME", "Platform display name"], ["SUPPORT_EMAIL", "Support contact email"], ["BUSINESS_ADDRESS", "Registered business address"]].map(([k, v]) => (
              <li key={k}><code style={{ background: "#e2e8f0", padding: "1px 5px", borderRadius: "3px" }}>{k}</code> — {v}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────
function DangerTab({ show }: { show: (m: string, t?: "ok" | "err") => void }) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function revokeOtherSessions() {
    setRevoking(true);
    const r = await fetch("/api/settings/sessions", { method: "DELETE" });
    const d = await r.json();
    setRevoking(false);
    setConfirmRevoke(false);
    if (r.ok) show(`Revoked ${d.revoked} other session${d.revoked !== 1 ? "s" : ""}. You remain signed in.`);
    else show(d.error ?? "Failed to revoke sessions", "err");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ padding: "0.875rem 1rem", background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: "0.5rem", fontSize: "0.8125rem", color: "#991b1b", fontWeight: 500 }}>
        ⚠ Actions in this section are sensitive or irreversible. Proceed carefully.
      </div>

      {/* Revoke sessions card */}
      <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: "#111827", marginBottom: "0.375rem" }}>Revoke All Other Sessions</div>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: 0 }}>
              Signs your account out of all other active admin sessions. Your current session stays active. Use this if you suspect unauthorised access to your account.
            </p>
          </div>
          {!confirmRevoke && (
            <button onClick={() => setConfirmRevoke(true)} style={{ marginLeft: "1.5rem", padding: "0.4375rem 0.875rem", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600, whiteSpace: "nowrap" }}>
              Revoke Sessions
            </button>
          )}
        </div>

        {confirmRevoke && (
          <div style={{ marginTop: "1rem", padding: "0.875rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem" }}>
            <p style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "0.75rem", fontWeight: 500 }}>
              Confirm: all other active admin sessions for your account will be signed out immediately. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={revokeOtherSessions} disabled={revoking} style={{ padding: "0.4375rem 1rem", background: "#dc2626", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>
                {revoking ? "Revoking…" : "Yes, Revoke All Other Sessions"}
              </button>
              <button onClick={() => setConfirmRevoke(false)} style={{ padding: "0.4375rem 0.875rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root Settings Page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => { if (d.user) setMe({ id: d.user.id, role: d.user.role }); });
  }, []);

  return (
    <div style={{ maxWidth: "960px" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.375rem", fontWeight: 700, color: "#111827", margin: 0 }}>Settings</h1>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem", marginBottom: 0 }}>
          Account, security, payments, audit logs, and admin access.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: "1.5rem", overflowX: "auto", gap: 0 }}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          const isDanger = t.id === "danger";
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "0.625rem 1.125rem",
                background: "none", border: "none",
                borderBottom: active ? `2px solid ${isDanger ? "#dc2626" : "#2563eb"}` : "2px solid transparent",
                marginBottom: "-2px",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                color: active ? (isDanger ? "#dc2626" : "#2563eb") : isDanger ? "#dc2626" : "#6b7280",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "profile" && <ProfileTab show={show} />}
      {activeTab === "payment" && <PaymentTab />}
      {activeTab === "audit" && <AuditTab />}
      {activeTab === "admins" && me && <AdminsTab currentId={me.id} currentRole={me.role} show={show} />}
      {activeTab === "admins" && !me && <div style={{ padding: "2rem", color: "#888", textAlign: "center" }}>Loading…</div>}
      {activeTab === "platform" && <PlatformTab />}
      {activeTab === "danger" && <DangerTab show={show} />}
    </div>
  );
}
