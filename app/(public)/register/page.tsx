"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PURPLE = "#7c3aed";

interface BoardOption { id: string; name: string; code: string; }
interface GradeOption { id: string; name: string; }

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    boardId: "",
    categoryId: "",
    legalAccepted: false,
  });

  const [boards, setBoards] = useState<BoardOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/public/boards")
      .then(r => r.json())
      .then(j => setBoards(j.data || []))
      .finally(() => setLoadingBoards(false));
  }, []);

  useEffect(() => {
    if (!form.boardId) { setGrades([]); return; }
    setLoadingGrades(true);
    setForm(f => ({ ...f, categoryId: "" }));
    fetch(`/api/public/grades?boardId=${form.boardId}`)
      .then(r => r.json())
      .then(j => setGrades(j.data || []))
      .finally(() => setLoadingGrades(false));
  }, [form.boardId]);

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match"); return;
    }
    if (!form.boardId) { setError("Please select a board"); return; }
    if (!form.categoryId) { setError("Please select a grade"); return; }
    if (!form.legalAccepted) { setError("You must accept the Terms & Conditions to register"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/student-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email || undefined,
          mobile: form.mobile || undefined,
          password: form.password,
          boardId: form.boardId,
          categoryId: form.categoryId,
          legalAccepted: form.legalAccepted,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✓</div>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.375rem", fontWeight: 700, color: "#0f172a" }}>
              Registration Successful
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.9375rem", marginBottom: "1.5rem" }}>
              Your account has been created. You can now log in.
            </p>
            <Link href="/login" style={{ display: "inline-block", padding: "0.625rem 1.5rem", background: PURPLE, color: "#fff", borderRadius: "8px", textDecoration: "none", fontWeight: 700, fontSize: "0.9375rem" }}>
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.625rem 0.75rem", border: "1px solid #d1d5db",
    borderRadius: "7px", fontSize: "0.9375rem", boxSizing: "border-box", outline: "none",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: "0.3rem",
  };
  const row: React.CSSProperties = { marginBottom: "1rem" };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 800, color: "#0f172a" }}>Create Account</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Join Saphala to start learning</p>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", color: "#dc2626", padding: "0.625rem 0.875rem", borderRadius: "7px", marginBottom: "1rem", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={row}>
            <label style={lbl}>Full Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)} required style={inp} placeholder="Your full name" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} style={inp} placeholder="you@example.com" />
            </div>
            <div>
              <label style={lbl}>Mobile</label>
              <input type="tel" value={form.mobile} onChange={e => set("mobile", e.target.value)} style={inp} placeholder="10-digit number" />
            </div>
          </div>
          <p style={{ margin: "-0.5rem 0 1rem", fontSize: "0.75rem", color: "#94a3b8" }}>Provide at least one of email or mobile.</p>

          {/* Board + Grade */}
          <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "1rem", marginBottom: "1rem", border: "1px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", fontWeight: 700, color: "#374151" }}>Education Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={lbl}>Board *</label>
                <select value={form.boardId} onChange={e => set("boardId", e.target.value)} required style={{ ...inp, background: "#fff" }}>
                  <option value="">{loadingBoards ? "Loading…" : "Select board"}</option>
                  {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Grade *</label>
                <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)} required disabled={!form.boardId} style={{ ...inp, background: "#fff", opacity: !form.boardId ? 0.6 : 1 }}>
                  <option value="">
                    {!form.boardId ? "Select board first" : loadingGrades ? "Loading…" : grades.length === 0 ? "No grades available" : "Select grade"}
                  </option>
                  {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Password */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={lbl}>Password *</label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required style={inp} placeholder="Min. 8 chars" />
            </div>
            <div>
              <label style={lbl}>Confirm Password *</label>
              <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required style={inp} placeholder="Repeat password" />
            </div>
          </div>
          <p style={{ margin: "-0.5rem 0 1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
            Must be at least 8 characters, with one uppercase letter and one number.
          </p>

          {/* Legal */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <input
              type="checkbox"
              id="legal"
              checked={form.legalAccepted}
              onChange={e => set("legalAccepted", e.target.checked)}
              style={{ marginTop: "0.15rem", flexShrink: 0 }}
            />
            <label htmlFor="legal" style={{ fontSize: "0.8125rem", color: "#374151", lineHeight: 1.5, cursor: "pointer" }}>
              I agree to the{" "}
              <a href="/terms" target="_blank" style={{ color: PURPLE }}>Terms & Conditions</a>
              {" "}and{" "}
              <a href="/refund-policy" target="_blank" style={{ color: PURPLE }}>Refund Policy</a>.
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              width: "100%", padding: "0.75rem", background: saving ? "#a78bfa" : PURPLE,
              color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "1rem",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748b" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: PURPLE, fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#f1f5f9", padding: "1.5rem",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: "12px", padding: "2rem",
  width: "100%", maxWidth: "520px", boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
};
