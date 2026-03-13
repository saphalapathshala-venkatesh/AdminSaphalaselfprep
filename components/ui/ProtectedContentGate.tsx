"use client";

import { useState } from "react";

export type ProtectedContentType = "flashcard_deck" | "html_material" | "pdf_material";

const CONTENT_TYPE_LABELS: Record<ProtectedContentType, string> = {
  flashcard_deck: "Flashcard Deck",
  html_material:  "HTML Learning Material",
  pdf_material:   "PDF Document",
};

interface Props {
  contentType: ProtectedContentType;
  contentId: string;
  contentTitle?: string;
  onAccepted: () => void;
  onDeclined?: () => void;
}

export default function ProtectedContentGate({ contentType, contentId, contentTitle, onAccepted, onDeclined }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!agreed) { setError("Please check the box to agree before continuing."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId, accepted: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Failed to record consent. Please try again.");
        return;
      }
      onAccepted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, contentId, accepted: false }),
    }).catch(() => {});
    onDeclined?.();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, backdropFilter: "blur(2px)",
    }}>
      <div style={{
        background: "#fff", borderRadius: "12px", padding: "32px",
        width: "520px", maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "8px",
            background: "#7c3aed", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontSize: "1.1rem", flexShrink: 0,
          }}>🔒</div>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#111" }}>
              Protected Content Notice
            </h2>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>
              {CONTENT_TYPE_LABELS[contentType]}{contentTitle ? ` — ${contentTitle}` : ""}
            </p>
          </div>
        </div>

        {/* Notice body */}
        <div style={{
          background: "#fefce8", border: "1px solid #fde68a", borderRadius: "8px",
          padding: "16px", marginBottom: "20px",
        }}>
          <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#374151", lineHeight: 1.6 }}>
            This content belongs to <strong>Saphala Pathshala</strong> and is provided only for your
            personal learning use.
          </p>
          <p style={{ margin: "0 0 12px", fontSize: "0.875rem", color: "#374151", lineHeight: 1.6 }}>
            Copying, sharing, recording, downloading, redistributing, or publishing this content
            without permission is <strong>prohibited</strong>.
          </p>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#374151", lineHeight: 1.6 }}>
            All your activities inside Saphala may be monitored for security and content protection
            purposes. If misuse or redistribution is detected, your account may be suspended or
            blocked as per platform policy.
          </p>
        </div>

        {/* Checkbox */}
        <label style={{
          display: "flex", alignItems: "flex-start", gap: "10px",
          cursor: "pointer", marginBottom: "20px",
        }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => { setAgreed(e.target.checked); setError(null); }}
            style={{ marginTop: "2px", width: "16px", height: "16px", cursor: "pointer", accentColor: "#7c3aed" }}
          />
          <span style={{ fontSize: "0.875rem", color: "#374151", lineHeight: 1.5 }}>
            I have read and agree to the{" "}
            <strong>Terms &amp; Conditions</strong> for accessing this protected content.
          </span>
        </label>

        {error && (
          <p style={{
            margin: "0 0 12px", padding: "10px 14px", background: "#fee2e2",
            color: "#991b1b", borderRadius: "6px", fontSize: "0.8rem",
          }}>{error}</p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={handleDecline}
            disabled={loading}
            style={{
              padding: "10px 20px", background: "#f3f4f6", color: "#374151",
              border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer",
              fontSize: "0.875rem", fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={loading || !agreed}
            style={{
              padding: "10px 24px", background: agreed ? "#7c3aed" : "#c4b5fd",
              color: "#fff", border: "none", borderRadius: "8px",
              cursor: agreed ? "pointer" : "not-allowed",
              fontSize: "0.875rem", fontWeight: 600, minWidth: "140px",
            }}
          >
            {loading ? "Recording…" : "Accept and Continue"}
          </button>
        </div>

        {/* Watermark-ready footer */}
        <div style={{
          marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #f3f4f6",
          display: "flex", justifyContent: "center",
        }}>
          <span style={{ fontSize: "0.7rem", color: "#d1d5db", letterSpacing: "0.05em" }}>
            Saphala Pathshala · Protected Content · content_protection_terms_v1
          </span>
        </div>
      </div>
    </div>
  );
}
