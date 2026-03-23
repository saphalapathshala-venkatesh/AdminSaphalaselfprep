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

const empty = { displayName: "", environment: "TEST", appId: "", secretKey: "", webhookSecret: "", notes: "", isActive: false };

export default function PaymentConfigPage() {
  const [configs, setConfigs]     = useState<Config[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...empty });
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState("");
  const [editId, setEditId]       = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/payment-config"); const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed to load");
      setConfigs(j.data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() { setForm({ ...empty }); setEditId(null); setSaveErr(""); setShowForm(true); }
  function openEdit(c: Config) {
    setForm({ displayName: c.displayName, environment: c.environment, appId: c.appId, secretKey: "", webhookSecret: "", notes: c.notes || "", isActive: c.isActive });
    setEditId(c.id); setSaveErr(""); setShowForm(true);
  }

  async function handleSave() {
    setSaving(true); setSaveErr("");
    try {
      const url = "/api/payment-config";
      const method = editId ? "PUT" : "POST";
      const body = editId ? { id: editId, ...form } : form;
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) { setSaveErr(j.error || "Failed to save"); return; }
      setShowForm(false); await load();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleSetActive(id: string) {
    setActivating(id);
    try {
      const r = await fetch("/api/payment-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, setActive: true }) });
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

  return (
    <div style={{ padding: "2rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#111", margin: 0 }}>Payment Configuration</h1>
          <p style={{ color: GRAY, marginTop: 4, fontSize: "0.875rem" }}>Manage Cashfree merchant account credentials. Only one config can be active at a time.</p>
        </div>
        <button onClick={openCreate} style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer", fontSize: "0.875rem" }}>
          + Add Config
        </button>
      </div>

      {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1rem" }}>{error}</div>}

      {loading ? (
        <div style={{ color: GRAY, padding: "2rem", textAlign: "center" }}>Loading…</div>
      ) : configs.length === 0 ? (
        <div style={{ background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 12, padding: "3rem", textAlign: "center" }}>
          <p style={{ color: GRAY, marginBottom: "1rem" }}>No payment configs yet. Add your first Cashfree account to enable checkout.</p>
          <button onClick={openCreate} style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer" }}>+ Add Config</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {configs.map(c => (
            <div key={c.id} style={{ background: c.isActive ? "#f5f3ff" : "#fff", border: `1.5px solid ${c.isActive ? PURPLE : "#e5e7eb"}`, borderRadius: 12, padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: "1rem", color: "#111" }}>{c.displayName}</span>
                    {c.isActive && <span style={{ background: GREEN, color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>ACTIVE</span>}
                    <span style={{ background: c.environment === "PROD" ? "#fef3c7" : "#dbeafe", color: c.environment === "PROD" ? "#92400e" : "#1e40af", borderRadius: 999, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>{c.environment}</span>
                    <span style={{ background: "#f3f4f6", color: GRAY, borderRadius: 999, padding: "2px 10px", fontSize: "0.75rem" }}>{c.provider}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 1.5rem", fontSize: "0.8125rem", color: "#374151" }}>
                    <div><span style={{ color: GRAY }}>App ID: </span>{c.appId}</div>
                    <div>
                      <span style={{ color: GRAY }}>Secret Key: </span>
                      {showSecrets[c.id + "sk"] ? c.secretKey : c.secretKey}
                    </div>
                    <div><span style={{ color: GRAY }}>Webhook Secret: </span>{c.webhookSecret}</div>
                    {c.notes && <div style={{ gridColumn: "1 / -1" }}><span style={{ color: GRAY }}>Notes: </span>{c.notes}</div>}
                    <div><span style={{ color: GRAY }}>Created: </span>{new Date(c.createdAt).toLocaleDateString()} by {c.createdBy?.email || "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
                  {!c.isActive && (
                    <button onClick={() => handleSetActive(c.id)} disabled={activating === c.id}
                      style={{ background: GREEN, color: "#fff", border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer", opacity: activating === c.id ? 0.6 : 1 }}>
                      {activating === c.id ? "Setting…" : "Set Active"}
                    </button>
                  )}
                  <button onClick={() => openEdit(c)}
                    style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.8125rem", cursor: "pointer" }}>
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
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "2rem", width: "100%", maxWidth: 540, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111" }}>
              {editId ? "Edit Payment Config" : "Add Payment Config"}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Field label="Display Name *" hint="e.g. Main Cashfree (Production)">
                <input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} style={input} placeholder="Main Cashfree Account" />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Field label="Provider">
                  <select value="CASHFREE" disabled style={{ ...input, background: "#f9fafb", color: GRAY }}>
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

              <Field label="App ID *" hint="From Cashfree Dashboard → Developers → API Keys">
                <input value={form.appId} onChange={e => setForm(f => ({ ...f, appId: e.target.value }))} style={input} placeholder="CF_TEST_xxxxxxxxxx" />
              </Field>

              <Field label={editId ? "Secret Key (leave blank to keep existing)" : "Secret Key *"} hint="Never shared with the frontend">
                <input type="password" value={form.secretKey} onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))} style={input} placeholder={editId ? "••••••••" : "Enter secret key"} />
              </Field>

              <Field label={editId ? "Webhook Secret (leave blank to keep existing)" : "Webhook Secret *"} hint="Used to verify Cashfree webhook signatures">
                <input type="password" value={form.webhookSecret} onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))} style={input} placeholder={editId ? "••••••••" : "Enter webhook secret"} />
              </Field>

              <Field label="Notes (optional)">
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={input} placeholder="e.g. Switched on 2024-01-15" />
              </Field>

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                <span>Set as active (will deactivate any currently active config)</span>
              </label>
            </div>

            {saveErr && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: RED, padding: "0.625rem 1rem", borderRadius: 8, marginTop: "1rem", fontSize: "0.875rem" }}>{saveErr}</div>}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 1.5rem", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : (editId ? "Save Changes" : "Add Config")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: "2rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "1rem 1.25rem", fontSize: "0.8125rem", color: "#92400e" }}>
        <strong>Cashfree Webhook URL:</strong>{" "}
        <code style={{ background: "#fef3c7", padding: "2px 6px", borderRadius: 4 }}>https://your-domain.com/api/webhooks/cashfree</code>
        <br />
        Configure this in Cashfree Dashboard → Developers → Webhooks. Set event type: <code>PAYMENT_SUCCESS_WEBHOOK</code> and <code>PAYMENT_FAILED_WEBHOOK</code>.
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: 4 }}>{label}</label>
      {hint && <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: 4, marginTop: 0 }}>{hint}</p>}
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db",
  borderRadius: 8, fontSize: "0.875rem", color: "#111", background: "#fff",
  outline: "none", boxSizing: "border-box",
};
