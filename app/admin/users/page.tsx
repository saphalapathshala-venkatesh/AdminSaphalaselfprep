"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  maxWebDevices: number;
  deletedAt: string | null;
  createdAt: string;
  activeDeviceCount: number;
  lastActiveAt: string | null;
  _count: { devices: number; sessions: number; activities: number };
}

interface EditForm {
  name: string;
  email: string;
  mobile: string;
  role: string;
  maxWebDevices: number;
  isActive: boolean;
}

interface CreateForm {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: string;
}

const ROLE_OPTS = ["STUDENT", "ADMIN", "SUPER_ADMIN"];

function roleBadge(role: string) {
  const map: Record<string, { bg: string; color: string }> = {
    SUPER_ADMIN: { bg: "#fef3c7", color: "#92400e" },
    ADMIN:       { bg: "#ede9fe", color: "#5b21b6" },
    STUDENT:     { bg: "#f0fdf4", color: "#15803d" },
  };
  const s = map[role] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "2px 8px", borderRadius: "9px", fontSize: "0.7rem", fontWeight: 700, ...s }}>
      {role.replace("_", " ")}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [blockedFilter, setBlockedFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", email: "", mobile: "", password: "", role: "STUDENT" });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", mobile: "", role: "STUDENT", maxWebDevices: 1, isActive: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [blockUser, setBlockUser] = useState<UserRow | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockSaving, setBlockSaving] = useState(false);

  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetSaving, setResetSaving] = useState(false);

  const [globalResetOpen, setGlobalResetOpen] = useState(false);
  const [globalResetSaving, setGlobalResetSaving] = useState(false);

  const [pwResetUser, setPwResetUser] = useState<UserRow | null>(null);
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "", mustChangePassword: false });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (search)       p.set("search",  search);
    if (roleFilter)   p.set("role",    roleFilter);
    if (blockedFilter) p.set("blocked", blockedFilter);
    if (showDeleted)  p.set("deleted", "true");
    const res = await fetch(`/api/users?${p}`);
    const json = await res.json();
    setUsers(json.data || []);
    setTotalPages(json.pagination?.totalPages || 1);
    setTotal(json.pagination?.total || 0);
    setLoading(false);
  }, [search, roleFilter, blockedFilter, showDeleted, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, roleFilter, blockedFilter, showDeleted]);

  // ── Create User ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setCreateForm({ name: "", email: "", mobile: "", password: "", role: "STUDENT" });
    setCreateError("");
    setCreateOpen(true);
  };
  const saveCreate = async () => {
    setCreateSaving(true); setCreateError("");
    const res = await fetch("/api/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });
    const json = await res.json();
    setCreateSaving(false);
    if (!res.ok) { setCreateError(json.error || "Failed to create user"); return; }
    setCreateOpen(false);
    showToast("User created");
    load();
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({ name: u.name || "", email: u.email || "", mobile: u.mobile || "", role: u.role, maxWebDevices: u.maxWebDevices, isActive: u.isActive });
    setEditError("");
  };
  const saveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true); setEditError("");
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const json = await res.json();
    setEditSaving(false);
    if (!res.ok) { setEditError(json.error || "Failed"); return; }
    setEditUser(null);
    showToast("User updated");
    load();
  };

  // ── Block / Unblock ───────────────────────────────────────────────────────
  const openBlock = (u: UserRow) => { setBlockUser(u); setBlockReason(""); };
  const saveBlock = async (blocking: boolean) => {
    if (!blockUser) return;
    setBlockSaving(true);
    const res = await fetch(`/api/users/${blockUser.id}/block`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ block: blocking, reason: blockReason }),
    });
    setBlockSaving(false);
    if (!res.ok) { showToast("Failed", false); return; }
    setBlockUser(null);
    showToast(blocking ? "User blocked" : "User unblocked");
    load();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteUser) return;
    setDeleteSaving(true);
    const res = await fetch(`/api/users/${deleteUser.id}`, { method: "DELETE" });
    setDeleteSaving(false);
    if (!res.ok) { showToast("Failed to delete", false); return; }
    setDeleteUser(null);
    showToast("User archived");
    load();
  };

  // ── Device reset ──────────────────────────────────────────────────────────
  const confirmReset = async () => {
    if (!resetUser) return;
    setResetSaving(true);
    const res = await fetch(`/api/users/${resetUser.id}/devices`, { method: "DELETE" });
    setResetSaving(false);
    if (!res.ok) { showToast("Failed to reset devices", false); return; }
    setResetUser(null);
    showToast("Devices reset");
    load();
  };

  // ── Global device reset ───────────────────────────────────────────────────
  const confirmGlobalReset = async () => {
    setGlobalResetSaving(true);
    const res = await fetch("/api/users/devices/reset-all", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revokeSessions: true }),
    });
    setGlobalResetSaving(false);
    if (!res.ok) { showToast("Failed", false); return; }
    const json = await res.json();
    setGlobalResetOpen(false);
    showToast(`All devices reset (${json.devicesReset} devices cleared)`);
    load();
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "—";
  const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString() : "—";

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>Users</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.875rem" }}>
            Manage learners and admin accounts, device limits, and access controls.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={openCreate}
            style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}
          >
            + Create User
          </button>
          <button
            onClick={() => setGlobalResetOpen(true)}
            style={{ padding: "0.5rem 1rem", borderRadius: "7px", border: "1px solid #fca5a5", color: "#dc2626", background: "#fff", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 600 }}
          >
            🔄 Reset All Devices
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, mobile…"
          style={{ flex: 1, minWidth: 220, padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "7px", fontSize: "0.875rem" }}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "7px", fontSize: "0.875rem", background: "#fff" }}>
          <option value="">All Roles</option>
          {ROLE_OPTS.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
        </select>
        <select value={blockedFilter} onChange={e => setBlockedFilter(e.target.value)}
          style={{ padding: "0.5rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "7px", fontSize: "0.875rem", background: "#fff" }}>
          <option value="">All Status</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)} />
          Show archived
        </label>
        <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>{total} users</span>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Name / Contact", "Role", "Status", "Devices", "Max Devices", "Last Active", "Actions"].map(h => (
                <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={{ padding: "0.875rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ height: 14, background: "#f1f5f9", borderRadius: 4, width: `${50 + (j * 15) % 50}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "4rem", textAlign: "center", color: "#94a3b8" }}>No users found.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0f172a" }}>{u.name || <span style={{ color: "#94a3b8" }}>Unnamed</span>}</div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{u.email || u.mobile || "—"}</div>
                  {u.deletedAt && <span style={{ fontSize: "0.65rem", background: "#fee2e2", color: "#dc2626", padding: "1px 6px", borderRadius: 6, fontWeight: 700 }}>ARCHIVED</span>}
                </td>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>{roleBadge(u.role)}</td>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  {u.isBlocked ? (
                    <span style={{ padding: "2px 8px", borderRadius: "9px", fontSize: "0.7rem", fontWeight: 700, background: "#fee2e2", color: "#dc2626" }} title={u.blockedReason || ""}>🚫 Blocked</span>
                  ) : (
                    <span style={{ padding: "2px 8px", borderRadius: "9px", fontSize: "0.7rem", fontWeight: 700, background: "#f0fdf4", color: "#15803d" }}>✓ Active</span>
                  )}
                </td>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#475569" }}>
                  <span style={{ fontWeight: 600, color: u.activeDeviceCount >= u.maxWebDevices ? "#dc2626" : "#0f172a" }}>{u.activeDeviceCount}</span>
                  <span style={{ color: "#94a3b8" }}> active</span>
                </td>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", textAlign: "center", fontSize: "0.875rem", color: "#475569" }}>{u.maxWebDevices}</td>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.75rem", color: "#94a3b8" }}>{formatDateTime(u.lastActiveAt)}</td>
                <td style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    <button onClick={() => openEdit(u)} style={btnStyle(PURPLE)}>Edit</button>
                    <button onClick={() => openBlock(u)} style={btnStyle(u.isBlocked ? "#15803d" : "#dc2626")}>{u.isBlocked ? "Unblock" : "Block"}</button>
                    <button onClick={() => { setPwResetUser(u); setPwForm({ newPassword: "", confirmPassword: "", mustChangePassword: false }); setPwError(""); }} style={btnStyle("#7c3aed")}>Reset Password</button>
                    <button onClick={() => setResetUser(u)} style={btnStyle("#b45309")}>Reset Devices</button>
                    <Link href={`/admin/users/${u.id}/devices`} style={{ ...btnStyle("#0369a1"), textDecoration: "none" }}>Devices</Link>
                    <Link href={`/admin/users/${u.id}/activity`} style={{ ...btnStyle("#475569"), textDecoration: "none" }}>Activity</Link>
                    {!u.deletedAt && <button onClick={() => setDeleteUser(u)} style={btnStyle("#ef4444")}>Archive</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn(page !== 1)}>← Prev</button>
          <span style={{ padding: "0.4rem 0.75rem", fontSize: "0.875rem", color: "#64748b" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn(page !== totalPages)}>Next →</button>
        </div>
      )}

      {/* ── Create User Modal ─────────────────────────────────────────────────── */}
      {createOpen && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.125rem", fontWeight: 700 }}>Create User</h2>
            {createError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.875rem" }}>{createError}</div>}
            <label style={label}>Name *</label>
            <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} style={input} placeholder="Full name" />
            <label style={label}>Email</label>
            <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} style={input} placeholder="user@example.com" autoComplete="off" />
            <label style={label}>Mobile</label>
            <input type="tel" value={createForm.mobile} onChange={e => setCreateForm(f => ({ ...f, mobile: e.target.value }))} style={input} placeholder="+91XXXXXXXXXX" autoComplete="off" />
            <label style={label}>Password *</label>
            <input type="password" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} style={input} placeholder="Min 8 characters" autoComplete="new-password" />
            <label style={label}>Role</label>
            <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} style={input}>
              {ROLE_OPTS.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button onClick={saveCreate} disabled={createSaving} style={primaryBtn}>{createSaving ? "Creating…" : "Create User"}</button>
              <button onClick={() => setCreateOpen(false)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      {editUser && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.125rem", fontWeight: 700 }}>Edit User</h2>
            {editError && <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.5rem 0.75rem", borderRadius: "6px", marginBottom: "0.75rem", fontSize: "0.875rem" }}>{editError}</div>}
            <label style={label}>Name</label>
            <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={input} placeholder="Full name" />
            <label style={label}>Email</label>
            <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} style={input} placeholder="user@example.com" autoComplete="off" />
            <label style={label}>Mobile</label>
            <input type="tel" value={editForm.mobile} onChange={e => setEditForm(f => ({ ...f, mobile: e.target.value }))} style={input} placeholder="+91XXXXXXXXXX" autoComplete="off" />
            <label style={label}>Role</label>
            <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} style={input}>
              {ROLE_OPTS.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
            </select>
            <label style={label}>Max Web Devices (1–5)</label>
            <input type="number" min={1} max={5} value={editForm.maxWebDevices}
              onChange={e => setEditForm(f => ({ ...f, maxWebDevices: parseInt(e.target.value) || 1 }))} style={input} />
            <label style={{ ...label, display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} />
              Account active
            </label>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button onClick={saveEdit} disabled={editSaving} style={primaryBtn}>{editSaving ? "Saving…" : "Save Changes"}</button>
              <button onClick={() => setEditUser(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Block/Unblock Modal ───────────────────────────────────────────────── */}
      {blockUser && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>
              {blockUser.isBlocked ? "Unblock User" : "Block User"}
            </h2>
            <p style={{ margin: "0 0 1rem", color: "#475569", fontSize: "0.875rem" }}>
              {blockUser.isBlocked
                ? `Restore access for ${blockUser.name || blockUser.email}?`
                : `Block ${blockUser.name || blockUser.email} from logging in? Their active sessions will be revoked.`}
            </p>
            {!blockUser.isBlocked && (
              <>
                <label style={label}>Reason (optional)</label>
                <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="e.g. Violation of terms" style={input} />
              </>
            )}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button onClick={() => saveBlock(!blockUser.isBlocked)} disabled={blockSaving}
                style={{ ...primaryBtn, background: blockUser.isBlocked ? "#15803d" : "#dc2626" }}>
                {blockSaving ? "Saving…" : (blockUser.isBlocked ? "Unblock" : "Block User")}
              </button>
              <button onClick={() => setBlockUser(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Device Reset Modal ────────────────────────────────────────────────── */}
      {resetUser && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>Reset Devices</h2>
            <p style={{ margin: "0 0 1.25rem", color: "#475569", fontSize: "0.875rem" }}>
              This will deactivate all trusted devices for <strong>{resetUser.name || resetUser.email}</strong> and revoke their active sessions. They will need to log in again.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={confirmReset} disabled={resetSaving} style={{ ...primaryBtn, background: "#dc2626" }}>{resetSaving ? "Resetting…" : "Reset Devices"}</button>
              <button onClick={() => setResetUser(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archive Modal ─────────────────────────────────────────────────────── */}
      {deleteUser && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700 }}>Archive User</h2>
            <p style={{ margin: "0 0 1.25rem", color: "#475569", fontSize: "0.875rem" }}>
              <strong>{deleteUser.name || deleteUser.email}</strong> will be soft-deleted. Their data is preserved but they cannot log in. This can be reversed by a SUPER_ADMIN.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={confirmDelete} disabled={deleteSaving} style={{ ...primaryBtn, background: "#dc2626" }}>{deleteSaving ? "Archiving…" : "Archive User"}</button>
              <button onClick={() => setDeleteUser(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ──────────────────────────────────────────────── */}
      {pwResetUser && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 420 }}>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.0625rem", fontWeight: 700, color: "#0f172a" }}>Reset Password</h2>
            <p style={{ margin: "0 0 1.25rem", color: "#64748b", fontSize: "0.8125rem" }}>
              Set a new password for <strong>{pwResetUser.name || pwResetUser.email || "this user"}</strong>. The current password will be immediately replaced.
            </p>

            {pwError && <div style={{ marginBottom: "0.875rem", padding: "0.5rem 0.75rem", background: "#fee2e2", borderRadius: "6px", color: "#dc2626", fontSize: "0.8125rem", fontWeight: 600 }}>{pwError}</div>}

            <label style={label}>New Password</label>
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
              style={input}
              placeholder="Min 8 characters"
              autoComplete="new-password"
            />

            <label style={label}>Confirm New Password</label>
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
              style={input}
              placeholder="Re-enter password"
              autoComplete="new-password"
            />

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem", cursor: "pointer", fontSize: "0.8125rem", color: "#374151" }}>
              <input
                type="checkbox"
                checked={pwForm.mustChangePassword}
                onChange={e => setPwForm(f => ({ ...f, mustChangePassword: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: PURPLE }}
              />
              Require password change on next login
            </label>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button
                onClick={async () => {
                  setPwError("");
                  if (!pwForm.newPassword || !pwForm.confirmPassword) { setPwError("Both fields are required"); return; }
                  if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError("Passwords do not match"); return; }
                  if (pwForm.newPassword.length < 8) { setPwError("Password must be at least 8 characters"); return; }
                  setPwSaving(true);
                  const res = await fetch(`/api/users/${pwResetUser!.id}/password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newPassword: pwForm.newPassword, confirmPassword: pwForm.confirmPassword, mustChangePassword: pwForm.mustChangePassword }),
                  });
                  const json = await res.json();
                  setPwSaving(false);
                  if (!res.ok) { setPwError(json.error || "Failed to reset password"); return; }
                  setPwResetUser(null);
                  showToast("Password reset successfully");
                }}
                disabled={pwSaving}
                style={{ ...primaryBtn, background: PURPLE, opacity: pwSaving ? 0.7 : 1 }}
              >
                {pwSaving ? "Saving…" : "Reset Password"}
              </button>
              <button onClick={() => setPwResetUser(null)} style={cancelBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global Reset Modal ────────────────────────────────────────────────── */}
      {globalResetOpen && (
        <div style={overlay}>
          <div style={modal}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 700, color: "#dc2626" }}>⚠ Reset All Devices</h2>
            <p style={{ margin: "0 0 1.25rem", color: "#475569", fontSize: "0.875rem" }}>
              This will deactivate <strong>all trusted devices for every user</strong> and revoke all active sessions. Every user will need to log in again. This action requires SUPER_ADMIN privileges.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={confirmGlobalReset} disabled={globalResetSaving} style={{ ...primaryBtn, background: "#dc2626" }}>{globalResetSaving ? "Resetting…" : "Reset All Devices"}</button>
              <button onClick={() => setGlobalResetOpen(false)} style={cancelBtn}>Cancel</button>
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

// ── Styles ────────────────────────────────────────────────────────────────────
function btnStyle(color: string): React.CSSProperties {
  return { padding: "0.2rem 0.6rem", borderRadius: "5px", border: `1px solid ${color}`, color, background: "#fff", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" };
}
function pageBtn(enabled: boolean): React.CSSProperties {
  return { padding: "0.4rem 0.875rem", borderRadius: "6px", border: "1px solid #e2e8f0", background: enabled ? "#fff" : "#f8fafc", color: enabled ? "#374151" : "#cbd5e1", cursor: enabled ? "pointer" : "default", fontSize: "0.8125rem" };
}
const label: React.CSSProperties = { display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem", marginTop: "0.75rem" };
const input: React.CSSProperties = { width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "0.875rem", boxSizing: "border-box" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modal: React.CSSProperties = { background: "#fff", borderRadius: "12px", padding: "1.75rem", width: "100%", maxWidth: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" };
const primaryBtn: React.CSSProperties = { padding: "0.5625rem 1.25rem", borderRadius: "7px", border: "none", background: PURPLE, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" };
const cancelBtn:  React.CSSProperties = { padding: "0.5625rem 1.25rem", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem" };
