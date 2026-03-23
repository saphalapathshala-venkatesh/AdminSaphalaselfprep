"use client";
import { useEffect, useRef, useState } from "react";

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

const EMPTY_FORM = {
  displayName: "", environment: "TEST",
  appId: "", secretKey: "", webhookSecret: "",
  notes: "", isActive: false,
};

/* ─── SVG icons ─────────────────────────────────────────────────────────── */
function IconEye({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function IconEyeOff({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function IconCopy({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

/* ─── SecretInput — text input with inline show/hide toggle ─────────────── */
type SecretInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  error?: boolean;
};
function SecretInput({ value, onChange, placeholder, error }: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        style={{
          ...monoInput,
          border: `1px solid ${error ? RED : "#d1d5db"}`,
          paddingRight: "2.75rem",
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        title={visible ? "Hide" : "Show"}
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: "2.5rem", background: "none", border: "none",
          cursor: "pointer", color: GRAY, display: "flex",
          alignItems: "center", justifyContent: "center",
          borderRadius: "0 8px 8px 0",
        }}
      >
        {visible ? <IconEyeOff size={15} /> : <IconEye size={15} />}
      </button>
    </div>
  );
}

/* ─── CopyButton — copies text, shows brief "Copied!" flash ────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        background: copied ? "#f0fdf4" : "#f3f4f6",
        color: copied ? GREEN : GRAY,
        border: `1px solid ${copied ? "#bbf7d0" : "#e5e7eb"}`,
        borderRadius: 5, padding: "2px 7px", fontSize: "0.7rem",
        cursor: "pointer", display: "flex", alignItems: "center",
        gap: 3, whiteSpace: "nowrap", fontWeight: 500,
      }}
    >
      <IconCopy size={12} />
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/* ─── CredRow — credential display row in the config card ──────────────── */
type CredRowProps = {
  label: string;
  hint: string;
  value: string;       // already server-masked for sensitive fields
  sensitive?: boolean;
  revealed?: boolean;
  onToggle?: () => void;
};
function CredRow({ label, hint, value, sensitive = false, revealed = false, onToggle }: CredRowProps) {
  const isEmpty = !value;
  const displayed = sensitive && !revealed
    ? (isEmpty ? "—" : "••••••••••••")
    : (value || "—");

  return (
    <div style={{
      background: "#f8fafc", border: "1px solid #e2e8f0",
      borderRadius: 8, padding: "0.6rem 0.875rem",
      display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap",
    }}>
      {/* Label badge */}
      <code style={{
        fontFamily: "monospace", fontSize: "0.72rem",
        background: "#ede9fe", color: "#5b21b6",
        padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", fontWeight: 600,
      }}>
        {label}
      </code>

      {/* Value */}
      <code style={{
        flex: 1, fontFamily: "monospace", fontSize: "0.82rem",
        color: sensitive && !revealed ? "#94a3b8" : "#111",
        letterSpacing: sensitive && !revealed ? "0.08em" : undefined,
        wordBreak: "break-all",
      }}>
        {displayed}
      </code>

      {/* Hint */}
      <span style={{ fontSize: "0.68rem", color: "#94a3b8", flexBasis: "100%", marginTop: -4, paddingLeft: 2 }}>
        {hint}
      </span>

      {/* Actions */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        {/* Non-sensitive: copy button */}
        {!sensitive && value && <CopyButton text={value} />}

        {/* Sensitive: reveal toggle + masked badge */}
        {sensitive && (
          <>
            {onToggle && (
              <button
                onClick={onToggle}
                title={revealed ? "Hide" : "Show masked value from server"}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: GRAY, padding: "2px", display: "flex", alignItems: "center",
                }}
              >
                {revealed ? <IconEyeOff size={14} /> : <IconEye size={14} />}
              </button>
            )}
            <span style={{
              fontSize: "0.65rem", color: "#94a3b8",
              background: "#f1f5f9", border: "1px solid #e2e8f0",
              borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap",
            }}>
              {revealed ? "server-masked" : "hidden"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Field wrapper ─────────────────────────────────────────────────────── */
function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#374151", marginBottom: 3, fontFamily: "monospace" }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "0 0 5px 0", lineHeight: 1.45, fontFamily: "sans-serif", fontWeight: 400 }}>
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p style={{ fontSize: "0.72rem", color: RED, margin: "4px 0 0 0" }}>{error}</p>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function PaymentConfigPage() {
  const [configs, setConfigs]       = useState<Config[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState("");
  const [editId, setEditId]         = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
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

  function f(key: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }));
    setFieldErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM }); setEditId(null);
    setSaveErr(""); setFieldErrors({}); setShowForm(true);
  }
  function openEdit(c: Config) {
    setForm({
      displayName: c.displayName, environment: c.environment,
      appId: c.appId,
      secretKey: "",    // admin must explicitly re-enter to change
      webhookSecret: "",
      notes: c.notes || "", isActive: c.isActive,
    });
    setEditId(c.id); setSaveErr(""); setFieldErrors({}); setShowForm(true);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.displayName.trim())  errs.displayName = "Display name is required";
    if (!form.appId.trim())        errs.appId       = "CASHFREE_APP_ID is required";
    if (!editId && !form.secretKey.trim())
                                   errs.secretKey   = "CASHFREE_SECRET_KEY is required for a new config";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true); setSaveErr("");
    try {
      const method = editId ? "PUT" : "POST";
      const body   = editId ? { id: editId, ...form } : form;
      const r = await fetch("/api/payment-config", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
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
        method: "PUT", headers: { "Content-Type": "application/json" },
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111", margin: 0 }}>Payment Configuration</h1>
          <p style={{ color: GRAY, marginTop: 4, fontSize: "0.875rem", maxWidth: 560, margin: "4px 0 0" }}>
            Manage Cashfree merchant credentials. Only one config can be active at a time.
            Secret values are always server-masked — only SUPER_ADMIN can add or edit.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          + Add Config
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Config cards */}
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
              <div key={c.id} style={{
                background: c.isActive ? "#f5f3ff" : "#fff",
                border: `1.5px solid ${c.isActive ? PURPLE : "#e5e7eb"}`,
                borderRadius: 12, padding: "1.25rem 1.5rem",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: 12, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111" }}>{c.displayName}</span>
                      {c.isActive && (
                        <span style={{ background: GREEN, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 700 }}>ACTIVE</span>
                      )}
                      <span style={{ background: c.environment === "PROD" ? "#fef3c7" : "#dbeafe", color: c.environment === "PROD" ? "#92400e" : "#1e40af", borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem", fontWeight: 600 }}>
                        {c.environment}
                      </span>
                      <span style={{ background: "#f3f4f6", color: GRAY, borderRadius: 999, padding: "2px 10px", fontSize: "0.7rem" }}>
                        {c.provider}
                      </span>
                    </div>

                    {/* Credential rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      <CredRow
                        label="CASHFREE_APP_ID"
                        hint="Cashfree App ID (Client ID) from Dashboard → Developers → API Keys"
                        value={c.appId}
                        sensitive={false}
                      />
                      <CredRow
                        label="CASHFREE_SECRET_KEY"
                        hint="Cashfree Secret Key (Client Secret) — keep this secure"
                        value={c.secretKey}
                        sensitive
                        revealed={!!revealed[skKey]}
                        onToggle={() => toggleReveal(skKey)}
                      />
                      <CredRow
                        label="CASHFREE_WEBHOOK_SECRET"
                        hint="Used to verify Cashfree webhook signatures (usually same as Secret Key)"
                        value={c.webhookSecret}
                        sensitive
                        revealed={!!revealed[whKey]}
                        onToggle={() => toggleReveal(whKey)}
                      />

                      {/* Meta */}
                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4, paddingLeft: 2 }}>
                        Created {new Date(c.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} by {c.createdBy?.email || "—"}
                        {c.notes && <> &nbsp;·&nbsp; Note: {c.notes}</>}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end", flexShrink: 0 }}>
                    {!c.isActive && (
                      <button onClick={() => handleSetActive(c.id)} disabled={activating === c.id}
                        style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", opacity: activating === c.id ? 0.6 : 1 }}>
                        {activating === c.id ? "Setting…" : "Set Active"}
                      </button>
                    )}
                    <button onClick={() => openEdit(c)}
                      style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                      Edit
                    </button>
                    {!c.isActive && (
                      <button onClick={() => handleDelete(c)} disabled={deleting === c.id}
                        style={{ background: "#fef2f2", color: RED, border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", cursor: "pointer", opacity: deleting === c.id ? 0.6 : 1 }}>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 580, boxShadow: "0 24px 64px rgba(0,0,0,0.25)", maxHeight: "92vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111" }}>
              {editId ? "Edit Payment Config" : "Add Payment Config"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

              {/* Display Name */}
              <Field label="Display Name *" hint="A friendly internal label, e.g. Main Cashfree (Production)" error={fieldErrors.displayName}>
                <input
                  value={form.displayName}
                  onChange={e => f("displayName", e.target.value)}
                  style={{ ...monoInput, border: `1px solid ${fieldErrors.displayName ? RED : "#d1d5db"}` }}
                  placeholder="Main Cashfree Account"
                  autoComplete="off"
                />
              </Field>

              {/* Provider + Environment */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Field label="Provider">
                  <select disabled style={{ ...monoInput, background: "#f9fafb", color: GRAY }}>
                    <option>CASHFREE</option>
                  </select>
                </Field>
                <Field label="Environment *">
                  <select value={form.environment} onChange={e => f("environment", e.target.value)} style={monoInput}>
                    <option value="TEST">TEST (Sandbox)</option>
                    <option value="PROD">PROD (Live)</option>
                  </select>
                </Field>
              </div>

              {/* CASHFREE_APP_ID */}
              <Field
                label="CASHFREE_APP_ID *"
                hint="Cashfree App ID (Client ID) from Dashboard → Developers → API Keys"
                error={fieldErrors.appId}
              >
                <input
                  value={form.appId}
                  onChange={e => f("appId", e.target.value)}
                  style={{ ...monoInput, border: `1px solid ${fieldErrors.appId ? RED : "#d1d5db"}` }}
                  placeholder="CF_TEST_xxxxxxxxxxxxxxxxxx"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>

              {/* CASHFREE_SECRET_KEY */}
              <Field
                label={editId ? "CASHFREE_SECRET_KEY  (leave blank to keep existing)" : "CASHFREE_SECRET_KEY *"}
                hint="Cashfree Secret Key (Client Secret) — keep this secure"
                error={fieldErrors.secretKey}
              >
                <SecretInput
                  value={form.secretKey}
                  onChange={v => f("secretKey", v)}
                  placeholder={editId ? "Leave blank to keep current value" : "Paste secret key here"}
                  error={!!fieldErrors.secretKey}
                />
              </Field>

              {/* CASHFREE_WEBHOOK_SECRET */}
              <Field
                label={editId ? "CASHFREE_WEBHOOK_SECRET  (leave blank to keep existing)" : "CASHFREE_WEBHOOK_SECRET"}
                hint="Used to verify Cashfree webhook signatures (usually same as Secret Key)"
                error={fieldErrors.webhookSecret}
              >
                <SecretInput
                  value={form.webhookSecret}
                  onChange={v => f("webhookSecret", v)}
                  placeholder={editId ? "Leave blank to keep current value" : "Paste webhook secret here"}
                />
              </Field>

              {/* Notes */}
              <Field label="Notes (optional)" hint="Internal note, e.g. rotation date or who provisioned this key">
                <input
                  value={form.notes}
                  onChange={e => f("notes", e.target.value)}
                  style={monoInput}
                  placeholder="e.g. Rotated 2025-06-01 by admin@example.com"
                  autoComplete="off"
                />
              </Field>

              {/* Set Active */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => f("isActive", e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Set as active config
                  <span style={{ display: "block", fontSize: "0.75rem", color: GRAY, marginTop: 1 }}>
                    Will deactivate any currently active config.
                  </span>
                </span>
              </label>
            </div>

            {/* Validation summary (field-level errors shown inline above) */}
            {Object.keys(fieldErrors).length > 0 && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.625rem 1rem", borderRadius: 8, marginTop: "1rem", fontSize: "0.8125rem" }}>
                Please fix the highlighted fields before saving.
              </div>
            )}

            {saveErr && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.625rem 1rem", borderRadius: 8, marginTop: "1rem", fontSize: "0.8125rem" }}>
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
                style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.75rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : (editId ? "Save Changes" : "Add Config")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook URL helper */}
      <WebhookUrlPanel />
    </div>
  );
}

/* ─── WebhookUrlPanel ───────────────────────────────────────────────────── */
function WebhookUrlPanel() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied]         = useState(false);

  useEffect(() => {
    // NEXT_PUBLIC_APP_URL is embedded at build time (set it in production).
    // Fall back to window.location.origin so it always shows the real domain.
    const base =
      (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "") ||
      window.location.origin;
    setWebhookUrl(`${base}/api/webhooks/cashfree`);
  }, []);

  function handleCopy() {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  return (
    <div style={{ marginTop: "2rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "1.125rem 1.25rem", fontSize: "0.8125rem", color: "#92400e" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Cashfree Webhook URL</div>

      {/* URL row with copy button */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 7, padding: "0.5rem 0.75rem", marginBottom: 8 }}>
        <code style={{ flex: 1, fontFamily: "monospace", fontSize: "0.82rem", color: "#78350f", wordBreak: "break-all" }}>
          {webhookUrl || "Loading…"}
        </code>
        <button
          onClick={handleCopy}
          disabled={!webhookUrl}
          title="Copy webhook URL"
          style={{
            background: copied ? "#f0fdf4" : "#fff",
            color: copied ? GREEN : "#92400e",
            border: `1px solid ${copied ? "#bbf7d0" : "#fcd34d"}`,
            borderRadius: 5, padding: "3px 10px", fontSize: "0.72rem",
            cursor: webhookUrl ? "pointer" : "default",
            fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <IconCopy size={12} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <p style={{ margin: 0, lineHeight: 1.55 }}>
        Use this URL in <strong>Cashfree Dashboard → Developers → Webhooks</strong>.
        Set event types: <code>PAYMENT_SUCCESS_WEBHOOK</code> and <code>PAYMENT_FAILED_WEBHOOK</code>.
        The <code>CASHFREE_WEBHOOK_SECRET</code> above must match the secret configured in that webhook.
        {!process.env.NEXT_PUBLIC_APP_URL && (
          <span style={{ display: "block", marginTop: 6, color: "#b45309", fontSize: "0.75rem" }}>
            Tip: Set the <code>NEXT_PUBLIC_APP_URL</code> environment variable to your production domain to ensure
            the correct URL is shown and sent to Cashfree during order creation.
          </span>
        )}
      </p>
    </div>
  );
}

/* ─── Shared input style — monospace, large, paste-friendly ────────────── */
const monoInput: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  fontSize: "0.875rem",
  fontFamily: "monospace",
  color: "#111",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  letterSpacing: "0.01em",
};
