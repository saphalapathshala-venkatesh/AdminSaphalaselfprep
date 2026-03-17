"use client";
import React, { useRef, useState, useCallback } from "react";

const PURPLE = "#7c3aed";
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export interface AdminImageUploaderProps {
  /** Current image URL (from form state / DB). Null means no image. */
  value: string | null | undefined;
  /** Called with the new public URL after upload, or null when image is removed. */
  onChange: (url: string | null) => void;
  /** Optional label shown above the uploader. */
  label?: string;
  /** Disabled while parent form is saving. */
  disabled?: boolean;
  /** Preview container height in px. Default 140. */
  previewHeight?: number;
}

/**
 * Reusable admin image uploader.
 *
 * Drop zone / click-to-browse → client-side validation → presigned URL request →
 * direct PUT to GCS → publicUrl returned via onChange().
 *
 * Preserves backward compatibility: if `value` is already a URL (previously saved
 * records), it renders the preview with Replace / Remove options.
 */
export default function AdminImageUploader({
  value,
  onChange,
  label,
  disabled = false,
  previewHeight = 140,
}: AdminImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reset = () => { setError(null); setProgress(0); };

  const processFile = useCallback(async (file: File) => {
    reset();

    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`File too large. Maximum size is ${MAX_BYTES / 1024 / 1024} MB.`);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      // Step 1: Request presigned URL from our API
      const metaRes = await fetch("/api/admin/upload/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, contentType: file.type, size: file.size }),
      });
      const metaJson = await metaRes.json();
      if (!metaRes.ok) {
        setError(metaJson.error || "Failed to get upload URL");
        return;
      }

      setProgress(30);

      // Step 2: PUT file bytes directly to GCS presigned URL (bypasses our server)
      const uploadRes = await fetch(metaJson.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) {
        setError("Upload failed. Please try again.");
        return;
      }

      setProgress(100);
      onChange(metaJson.publicUrl);
    } catch (err) {
      setError("Upload failed. Check your connection and try again.");
      console.error("[AdminImageUploader]", err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const open = () => { if (!disabled && !uploading) inputRef.current?.click(); };

  // ── Styles ─────────────────────────────────────────────────────────────────

  const zoneStyle: React.CSSProperties = {
    border: `2px dashed ${dragOver ? PURPLE : "#cbd5e1"}`,
    borderRadius: 10,
    background: dragOver ? "#f5f3ff" : "#fafafa",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: previewHeight,
    cursor: disabled || uploading ? "not-allowed" : "pointer",
    transition: "border-color 0.15s, background 0.15s",
    position: "relative",
    overflow: "hidden",
  };

  const previewStyle: React.CSSProperties = {
    width: "100%",
    height: previewHeight,
    objectFit: "cover",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    display: "block",
  };

  const overlayStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
    display: "flex",
    gap: 8,
    padding: "10px 12px 12px",
    justifyContent: "flex-end",
    borderRadius: "0 0 10px 10px",
  };

  const btnStyle = (color: string): React.CSSProperties => ({
    fontSize: "0.72rem",
    fontWeight: 600,
    color: "#fff",
    background: color,
    border: "none",
    borderRadius: 5,
    padding: "4px 10px",
    cursor: disabled || uploading ? "not-allowed" : "pointer",
    letterSpacing: "0.02em",
  });

  const progressBarStyle: React.CSSProperties = {
    height: 3,
    background: "#e2e8f0",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  };

  const progressFillStyle: React.CSSProperties = {
    height: "100%",
    width: `${progress}%`,
    background: PURPLE,
    transition: "width 0.3s ease",
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontSize: "0.875rem" }}>
      {label && (
        <div style={{ marginBottom: 6, fontWeight: 500, color: "#374151" }}>{label}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        style={{ display: "none" }}
        onChange={handleFileInput}
        disabled={disabled || uploading}
      />

      {/* Current image preview */}
      {value ? (
        <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", height: previewHeight }}>
          <img
            src={value}
            alt="Preview"
            style={previewStyle}
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
          />
          <div style={overlayStyle}>
            <button
              type="button"
              style={btnStyle("rgba(255,255,255,0.2)")}
              onClick={open}
              disabled={disabled || uploading}
            >
              ↺ Replace
            </button>
            <button
              type="button"
              style={btnStyle("rgba(220,38,38,0.8)")}
              onClick={() => { reset(); onChange(null); }}
              disabled={disabled || uploading}
            >
              ✕ Remove
            </button>
          </div>
        </div>
      ) : (
        /* Drop zone (no image yet) */
        <div
          style={zoneStyle}
          onClick={open}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && open()}
          aria-label="Upload image"
        >
          {uploading ? (
            <>
              <div style={{ fontSize: "1.5rem" }}>⏳</div>
              <div style={{ color: PURPLE, fontWeight: 500 }}>Uploading…</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "1.6rem", opacity: 0.5 }}>🖼</div>
              <div style={{ color: "#6b7280", textAlign: "center", lineHeight: 1.4 }}>
                <span style={{ color: PURPLE, fontWeight: 600 }}>Click to upload</span>
                {" "}or drag &amp; drop
              </div>
              <div style={{ color: "#9ca3af", fontSize: "0.75rem" }}>
                JPG, PNG, WebP · max 5 MB
              </div>
            </>
          )}
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div style={progressBarStyle}>
          <div style={progressFillStyle} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 6, fontSize: "0.78rem", color: "#dc2626",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 5, padding: "5px 10px",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
