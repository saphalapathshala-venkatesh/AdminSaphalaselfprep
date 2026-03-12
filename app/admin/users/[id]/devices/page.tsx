"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const PURPLE = "#7c3aed";

interface UserDevice {
  id: string;
  deviceKey: string;
  deviceType: string;
  browser: string | null;
  os: string | null;
  userAgent: string | null;
  ipAddressLast: string | null;
  label: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
  isBlocked: boolean;
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  maxWebDevices: number;
}

function deviceTypeIcon(type: string) {
  if (type === "MOBILE")  return "📱";
  if (type === "TABLET")  return "🖥";
  if (type === "DESKTOP") return "💻";
  return "❓";
}

export default function UserDevicesPage() {
  const params   = useParams();
  const userId   = params.id as string;

  const [user, setUser]       = useState<UserInfo | null>(null);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const [labelDevice, setLabelDevice] = useState<UserDevice | null>(null);
  const [labelText, setLabelText]     = useState("");
  const [labelSaving, setLabelSaving] = useState(false);

  const [removeDevice, setRemoveDevice]   = useState<UserDevice | null>(null);
  const [removeSaving, setRemoveSaving]   = useState(false);
  const [resetAllOpen, setResetAllOpen]   = useState(false);
  const [resetAllSaving, setResetAllSaving] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [uRes, dRes] = await Promise.all([
      fetch(`/api/users/${userId}`),
      fetch(`/api/users/${userId}/devices`),
    ]);
    const [uJson, dJson] = await Promise.all([uRes.json(), dRes.json()]);
    setUser(uJson.data);
    setDevices(dJson.data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleBlock = async (d: UserDevice) => {
    await fetch(`/api/users/${userId}/devices/${d.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked: !d.isBlocked }),
    });
    showToast(d.isBlocked ? "Device unblocked" : "Device blocked");
    loadData();
  };

  const saveLabel = async () => {
    if (!labelDevice) return;
    setLabelSaving(true);
    await fetch(`/api/users/${userId}/devices/${labelDevice.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: labelText }),
    });
    setLabelSaving(false);
    setLabelDevice(null);
    showToast("Label saved");
    loadData();
  };

  const confirmRemove = async () => {
    if (!removeDevice) return;
    setRemoveSaving(true);
    const res = await fetch(`/api/users/${userId}/devices/${removeDevice.id}`, { method: "DELETE" });
    setRemoveSaving(false);
    if (!res.ok) { showToast("Failed", false); return; }
    setRemoveDevice(null);
    showToast("Device removed");
    loadData();
  };

  const confirmResetAll = async () => {
    setResetAllSaving(true);
    const res = await fetch(`/api/users/${userId}/devices`, { method: "DELETE" });
    setResetAllSaving(false);
    if (!res.ok) { showToast("Failed", false); return; }
    setResetAllOpen(false);
    showToast("All devices reset");
    loadData();
  };

  const fmt = (d: string) => new Date(d).toLocaleString();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "1.25rem", display: "flex", gap: "0.375rem", alignItems: "center" }}>
        <Link href="/admin/users" style={{ color: PURPLE, textDecoration: "none" }}>Users</Link>
        <span>›</span>
        <span>{user?.name || user?.email || userId}</span>
        <span>›</span>
        <span style={{ color: "#0f172a", fontWeight: 600 }}>Devices</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>Trusted Devices</h1>
          {user && (
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              {user.name || user.email} · Max allowed: <strong>{user.maxWebDevices}</strong>
            </p>
          )}
        </div>
        <button onClick={() => setResetAllOpen(true)}
          style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}>
          🔄 Reset All
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#94a3b8" }}>Loading…</p>
      ) : devices.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: "12px", padding: "3rem", textAlign: "center", color: "#94a3b8", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
          No trusted devices registered yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {devices.map(d => (
            <div key={d.id} style={{ background: "#fff", borderRadius: "10px", padding: "1rem 1.25rem", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: d.isBlocked ? "1px solid #fca5a5" : d.isActive ? "1px solid #e2e8f0" : "1px solid #f1f5f9", opacity: d.isActive ? 1 : 0.6 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.75rem", lineHeight: 1 }}>{deviceTypeIcon(d.deviceType)}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9375rem", color: "#0f172a" }}>
                      {d.label || `${d.browser || "Unknown"} on ${d.os || "Unknown"}`}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.125rem" }}>
                      {d.deviceType} · Key: <code style={{ background: "#f1f5f9", padding: "0 4px", borderRadius: 3 }}>{d.deviceKey.slice(0, 12)}…</code>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                      First seen: {fmt(d.firstSeenAt)} · Last active: {fmt(d.lastSeenAt)} · IP: {d.ipAddressLast || "—"}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0, flexWrap: "wrap" }}>
                  {d.isBlocked && <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#fee2e2", color: "#dc2626", padding: "2px 7px", borderRadius: 9 }}>Blocked</span>}
                  {!d.isActive && <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#f1f5f9", color: "#94a3b8", padding: "2px 7px", borderRadius: 9 }}>Inactive</span>}
                  <button onClick={() => { setLabelDevice(d); setLabelText(d.label || ""); }}
                    style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${PURPLE}`, color: PURPLE, background: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>
                    Label
                  </button>
                  <button onClick={() => toggleBlock(d)}
                    style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${d.isBlocked ? "#15803d" : "#dc2626"}`, color: d.isBlocked ? "#15803d" : "#dc2626", background: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>
                    {d.isBlocked ? "Unblock" : "Block"}
                  </button>
                  <button onClick={() => setRemoveDevice(d)}
                    style={{ padding: "0.2rem 0.6rem", borderRadius: "5px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", cursor: "pointer", fontSize: "0.75rem" }}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Label modal */}
      {labelDevice && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>Label Device</h2>
            <input value={labelText} onChange={e => setLabelText(e.target.value)} placeholder="e.g. Home laptop"
              style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button onClick={saveLabel} disabled={labelSaving}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {labelSaving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setLabelDevice(null)}
                style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove confirm modal */}
      {removeDevice && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>Remove Device</h2>
            <p style={{ margin: "0 0 1.25rem", color: "#475569", fontSize: "0.875rem" }}>
              Remove this device? The user may re-register it on next login if they have available slots.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={confirmRemove} disabled={removeSaving}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {removeSaving ? "Removing…" : "Remove"}
              </button>
              <button onClick={() => setRemoveDevice(null)}
                style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset all confirm */}
      {resetAllOpen && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>Reset All Devices</h2>
            <p style={{ margin: "0 0 1.25rem", color: "#475569", fontSize: "0.875rem" }}>
              All trusted devices for this user will be deactivated and their sessions revoked. They will need to log in again.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={confirmResetAll} disabled={resetAllSaving}
                style={{ padding: "0.5rem 1.25rem", borderRadius: "7px", border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                {resetAllSaving ? "Resetting…" : "Reset All"}
              </button>
              <button onClick={() => setResetAllOpen(false)}
                style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", padding: "0.75rem 1.25rem", borderRadius: "8px", background: toast.ok ? "#0f172a" : "#dc2626", color: "#fff", fontSize: "0.875rem", fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalStyle:   React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.75rem", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" };
