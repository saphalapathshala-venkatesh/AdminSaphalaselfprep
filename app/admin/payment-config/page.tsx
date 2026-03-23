"use client";
import { useEffect, useState } from "react";

const PURPLE = "#7c3aed";
const RED    = "#dc2626";
const GREEN  = "#16a34a";
const GRAY   = "#6b7280";

type Config = {
  id: string; provider: string; displayName: string; environment: string;
  appId: string; secretKey: string; webhookSecret: string;
  isActive: boolean; notes: string | null; createdAt: string;
  createdBy: { email: string } | null;
};

const empty = {
  displayName: "", environment: "TEST",
  appId: "", secretKey: "", webhookSecret: "",
  notes: "", isActive: false,
};

/** Eye icon — open */
function IconEye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

/** Eye-off icon — closed */
function IconEyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function PaymentConfigPage() {
  const [configs, setConfigs]       = useState<Config[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...empty });
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  // Per-card reveal state: key = `${configId}-sk` | `${configId}-wh`
  const [revealed, setRevealed]     = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/payment-config");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setConfigs(j.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm({ ...empty }); setEditId(null); setSaveErr(""); setShowForm(true);
  }
  function openEdit(c: Config) {
    setForm({
      displayName: c.displayName, environment: c.environment,
      appId: c.appId,
      // Leave secrets blank so admin must consciously re-enter to change
      secretKey: "", webhookSecret: "",
      notes: c.notes || "", isActive: c.isActive,
    });
    setEditId(c.id); setSaveErr(""); setShowForm(true);
  }

  async function handleSave() {
    setSaving(true); setSaveErr("");
    try {
      const method = editId ? "PUT" : "POST";
      const body   = editId ? { id: editId, ...form } : form;
      const r = await fetch("/api/payment-config", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { setSaveErr(j.error || "Failed to save"); return; }
      setShowForm(false); await load();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleSetActive(id: string) {
    setActivating(id);
    try {
      const r = await fetch("/api/payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, setActive: true }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "Failed to activate"); return; }
      await load();
    } finally { setActivating(null); }
  }

  async function handleDelete(c: Config) {
    if (!confirm(`Delete config "${c.displayName}"? This cannot be undone.`)) return;
    setDeleting(c.id);
    try {
      const r = await fetch(`/api/payment-config?id=${c.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) { alert(j.error || "Failed to delete"); return; }
      await load();
    } finally { setDeleting(null); }
  }

  function toggleReveal(key: string) {
    setRevealed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111", margin: 0 }}>Payment Configuration</h1>
          <p style={{ color: GRAY, marginTop: 4, fontSize: "0.875rem", maxWidth: 560 }}>
            Manage Cashfree merchant account credentials. Only one config can be active at a time.
            Secrets are always masked — only SUPER_ADMIN can add or edit.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem", whiteSpace: "nowrap" }}
        >
          + Add Config
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: GRAY, padding: "2rem", textAlign: "center" }}>Loading…</div>
      ) : configs.length === 0 ? (
        <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 12, padding: "3rem", textAlign: "center" }}>
          <p style={{ color: GRAY, marginBottom: "1rem" }}>No payment configs yet. Add your first Cashfree account to enable checkout.</p>
          <button onClick={openCreate} style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer" }}>+ Add Config</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {configs.map(c => {
            const skKey = `${c.id}-sk`;
            const whKey = `${c.id}-wh`;
            return (
              <div
                key={c.id}
                style={{ background: c.isActive ? "#f5f3ff" : "#fff", border: `1.5px solid ${c.isActive ? PURPLE : "#e5e7eb"}`, borderRadius: 12, padding: "1.25rem 1.5rem" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111" }}>{c.displayName}</span>
                      {c.isActive && (
                        <span style={{ background: GREEN, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.03em" }}>ACTIVE</span>
                      )}
                      <span style={{ background: c.environment === "PROD" ? "#fef3c7" : "#dbeafe", color: c.environment === "PROD" ? "#92400e" : "#1e40af", borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 600 }}>
                        {c.environment}
                      </span>
                      <span style={{ background: "#f3f4f6", color: GRAY, borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem" }}>
                        {c.provider}
                      </span>
                    </div>

                    {/* Credential rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.8125rem" }}>

                      {/* CASHFREE_APP_ID */}
                      <CredRow
                        label="CASHFREE_APP_ID"
                        hint="Cashfree Client / App ID"
                        value={c.appId}
                        sensitive={false}
                      />

                      {/* CASHFREE_SECRET_KEY */}
                      <CredRow
                        label="CASHFREE_SECRET_KEY"
                        hint="Cashfree Client Secret / Secret Key"
                        value={c.secretKey}
                        sensitive
                        revealed={!!revealed[skKey]}
                        onToggle={() => toggleReveal(skKey)}
                      />

                      {/* CASHFREE_WEBHOOK_SECRET */}
                      <CredRow
                        label="CASHFREE_WEBHOOK_SECRET"
                        hint="Secret used for webhook signature verification"
                        value={c.webhookSecret}
                        sensitive
                        revealed={!!revealed[whKey]}
                        onToggle={() => toggleReveal(whKey)}
                      />

                      {/* Meta */}
                      <div style={{ display: "flex", gap: "2rem", marginTop: 2, color: GRAY, fontSize: "0.75rem" }}>
                        <span>Created {new Date(c.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} by {c.createdBy?.email || "—"}</span>
                        {c.notes && <span>Note: {c.notes}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end", flexShrink: 0 }}>
                    {!c.isActive && (
                      <button
                        onClick={() => handleSetActive(c.id)}
                        disabled={activating === c.id}
                        style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", opacity: activating === c.id ? 0.6 : 1 }}
                      >
                        {activating === c.id ? "Setting…" : "Set Active"}
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(c)}
                      style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", cursor: "pointer" }}
                    >
                      Edit
                    </button>
                    {!c.isActive && (
                      <button
                        onClick={() => handleDelete(c)}
                        disabled={deleting === c.id}
                        style={{ background: "#fef2f2", color: RED, border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", cursor: "pointer", opacity: deleting === c.id ? 0.6 : 1 }}
                      >
                        {deleting === c.id ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111" }}>
              {editId ? "Edit Payment Config" : "Add Payment Config"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Field label="Display Name *" hint="A friendly label for this config, e.g. Main Cashfree (Production)">
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  style={input}
                  placeholder="Main Cashfree Account"
                />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Field label="Provider">
                  <select disabled style={{ ...input, background: "#f9fafb", color: GRAY }}>
                    <option>CASHFREE</option>
                  </select>
                </Field>
                <Field label="Environment *">
                  <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))} style={input}>
                    <option value="TEST">TEST (Sandbox)</option>
                    <option value="PROD">PROD (Live)</option>
                  </select>
                </Field>
              </div>

              {/* CASHFREE_APP_ID */}
              <Field
                label="CASHFREE_APP_ID *"
                hint="Cashfree Client / App ID — found in Cashfree Dashboard → Developers → API Keys"
              >
                <input
                  value={form.appId}
                  onChange={e => setForm(f => ({ ...f, appId: e.target.value }))}
                  style={input}
                  placeholder="CF_TEST_xxxxxxxxxx"
                  autoComplete="off"
                />
              </Field>

              {/* CASHFREE_SECRET_KEY */}
              <Field
                label={editId ? "CASHFREE_SECRET_KEY (leave blank to keep existing)" : "CASHFREE_SECRET_KEY *"}
                hint="Cashfree Client Secret / Secret Key — backend-only, never sent to the browser"
              >
                <input
                  type="password"
                  value={form.secretKey}
                  onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
                  style={input}
                  placeholder={editId ? "Leave blank to keep current value" : "Enter secret key"}
                  autoComplete="new-password"
                />
              </Field>

              {/* CASHFREE_WEBHOOK_SECRET */}
              <Field
                label={editId ? "CASHFREE_WEBHOOK_SECRET (leave blank to keep existing)" : "CASHFREE_WEBHOOK_SECRET *"}
                hint="Secret used for webhook signature verification — must match the value set in Cashfree Dashboard → Webhooks"
              >
                <input
                  type="password"
                  value={form.webhookSecret}
                  onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))}
                  style={input}
                  placeholder={editId ? "Leave blank to keep current value" : "Enter webhook secret"}
                  autoComplete="new-password"
                />
              </Field>

              <Field label="Notes (optional)" hint="Internal note, e.g. date of rotation or who created it">
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={input}
                  placeholder="e.g. Rotated 2025-01-15"
                />
              </Field>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                <span>Set as active (will deactivate any currently active config)</span>
              </label>
            </div>

            {saveErr && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.625rem 1rem", borderRadius: 8, marginTop: "1rem", fontSize: "0.875rem" }}>
                {saveErr}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.5rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : (editId ? "Save Changes" : "Add Config")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook URL helper */}
      <div style={{ marginTop: "2rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.8125rem", color: "#92400e" }}>
        <strong>Cashfree Webhook URL:</strong>{" "}
        <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>
          https://your-domain.com/api/webhooks/cashfree
        </code>
        <br />
        Configure this in <strong>Cashfree Dashboard → Developers → Webhooks</strong>.
        Set event types: <code>PAYMENT_SUCCESS_WEBHOOK</code> and <code>PAYMENT_FAILED_WEBHOOK</code>.
        The <code>CASHFREE_WEBHOOK_SECRET</code> above must match the webhook secret configured there.
      </div>
    </div>
  );
}

/* ── Credential row component ── */

type CredRowProps = {
  label: string;
  hint: string;
  value: string;
  sensitive?: boolean;
  revealed?: boolean;
  onToggle?: () => void;
};

function CredRow({ label, hint, value, sensitive = false, revealed = false, onToggle }: CredRowProps) {
  const displayed = sensitive && !revealed
    ? (value ? "••••••••••••" : "—")
    : (value || "—");

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
      <span style={{ fontFamily: "monospace", fontSize: "0.75rem", background: "#f1f5f9", color: "#475569", padding: "1px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ color: GRAY, fontSize: "0.7rem" }}>{hint}</span>
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <code style={{ fontSize: "0.8rem", color: sensitive && !revealed ? "#9ca3af" : "#111", letterSpacing: sensitive && !revealed ? "0.1em" : undefined }}>
          {displayed}
        </code>
        {sensitive && onToggle && (
          <button
            onClick={onToggle}
            title={revealed ? "Hide" : "Show masked value"}
            style={{ background: "none", border: "none", cursor: "pointer", color: GRAY, padding: "2px", display: "flex", alignItems: "center" }}
          >
            {revealed ? <IconEyeOff /> : <IconEye />}
          </button>
        )}
        {sensitive && (
          <span style={{ fontSize: "0.65rem", color: "#9ca3af", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 4, padding: "1px 5px" }}>
            masked
          </span>
        )}
      </span>
    </div>
  );
}

/* ── Field wrapper ── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: 2 }}>{label}</label>
      {hint && <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0 0 4px 0", lineHeight: 1.4 }}>{hint}</p>}
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem",
  border: "1px solid #d1d5db", borderRadius: 8,
  fontSize: "0.875rem", color: "#111", background: "#fff",
  outline: "none", boxSizing: "border-box",
};
