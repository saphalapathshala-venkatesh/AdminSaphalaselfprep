"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "idle" | "submitting" | "redirecting";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phase !== "idle") return;

    setError("");
    setPhase("submitting");

    // [Auth timing] login request start
    const t0 = Date.now();
    console.debug("[Auth] Login request start", new Date().toISOString());

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      console.debug("[Auth] API response received", Date.now() - t0, "ms");

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setPhase("idle");
        return;
      }

      // Success — transition immediately to redirecting state, never revert to idle
      setPhase("redirecting");
      console.debug("[Auth] Redirect triggered", Date.now() - t0, "ms");

      // Use replace so the back button doesn't return to login after entry
      router.replace("/admin/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("idle");
    }
  }

  const isDisabled = phase !== "idle";

  const btnLabel: Record<Phase, string> = {
    idle: "Sign In",
    submitting: "Signing in…",
    redirecting: "Redirecting…",
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Saphala Admin</h1>
        <p style={styles.subtitle}>Sign in to the admin console</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.error}>{error}</div>
          )}

          {phase === "redirecting" && (
            <div style={styles.success}>
              Successfully logged in. Redirecting to dashboard…
            </div>
          )}

          <label style={styles.label}>
            Email or Mobile
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              style={{ ...styles.input, ...(isDisabled ? styles.inputDisabled : {}) }}
              disabled={isDisabled}
              required
              autoComplete="username"
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...styles.input, ...(isDisabled ? styles.inputDisabled : {}) }}
              disabled={isDisabled}
              required
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              ...styles.button,
              ...(phase === "redirecting" ? styles.buttonSuccess : {}),
              ...(isDisabled ? styles.buttonDisabled : {}),
            }}
          >
            {btnLabel[phase]}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    backgroundColor: "#fff",
    padding: "2.5rem",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    width: "100%",
    maxWidth: "400px",
  },
  title: {
    margin: "0 0 0.25rem",
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "#111",
  },
  subtitle: {
    margin: "0 0 1.5rem",
    fontSize: "0.875rem",
    color: "#666",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#333",
  },
  input: {
    padding: "0.625rem",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "0.875rem",
    outline: "none",
    transition: "border-color 0.15s ease",
  },
  inputDisabled: {
    backgroundColor: "#f9fafb",
    color: "#9ca3af",
  },
  button: {
    padding: "0.75rem",
    backgroundColor: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "0.5rem",
    transition: "background-color 0.2s ease",
  },
  buttonSuccess: {
    backgroundColor: "#16a34a",
  },
  buttonDisabled: {
    opacity: 0.85,
    cursor: "not-allowed",
  },
  error: {
    padding: "0.625rem",
    backgroundColor: "#fef2f2",
    color: "#dc2626",
    borderRadius: "4px",
    fontSize: "0.8125rem",
    border: "1px solid #fecaca",
  },
  success: {
    padding: "0.625rem",
    backgroundColor: "#f0fdf4",
    color: "#166534",
    borderRadius: "4px",
    fontSize: "0.8125rem",
    border: "1px solid #bbf7d0",
  },
};
