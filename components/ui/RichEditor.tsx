"use client";

/**
 * RichEditor — contenteditable rich text editor for question content.
 *
 * Features:
 *  - Insert image by URL (inline dialog) — class auto-detected: rich-img-inline / rich-img-block
 *  - Insert equations via $$LaTeX$$ markers (inline dialog)
 *  - Bold / italic toolbar
 *  - Outputs HTML via onChange callback
 *  - Backward compatible: existing base64 img src values continue to render
 *
 * Phase 1 hardening:
 *  - Clipboard image paste is BLOCKED. User sees a clear inline message.
 *  - File-based image upload is BLOCKED. Same reason.
 *  - All new images must enter via the "🖼 Image URL" dialog.
 *  - Images get class="rich-img rich-img-inline" or "rich-img rich-img-block"
 *    automatically based on cursor context — no manual dimensions required.
 */

import { useRef, useEffect, useCallback, useState, useId } from "react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  /** When true, shows the extended toolbar: colour, font, size, underline, lists, align, table */
  extended?: boolean;
}

// ── Extended toolbar constants ─────────────────────────────────────────────
const FONT_FAMILIES = [
  "Default", "Arial", "Georgia", "Times New Roman", "Courier New",
  "Verdana", "Trebuchet MS", "Comic Sans MS",
];
const FONT_SIZES = [
  { label: "Small",    value: "2" },
  { label: "Normal",   value: "3" },
  { label: "Large",    value: "4" },
  { label: "X-Large",  value: "5" },
  { label: "XX-Large", value: "6" },
];
const TEXT_COLORS = [
  "#000000", "#374151", "#6b7280", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#fef9c3",
];
const SELECT_STYLE: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  padding: "0.125rem 0.25rem",
  fontSize: "0.72rem",
  color: "#374151",
  background: "#fff",
  cursor: "pointer",
  height: "24px",
};

const TOOLBAR_BTN: React.CSSProperties = {
  background: "none",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  padding: "0.1875rem 0.4375rem",
  cursor: "pointer",
  fontSize: "0.75rem",
  color: "#374151",
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};

export default function RichEditor({
  value,
  onChange,
  placeholder = "Type here or use toolbar to insert images/equations…",
  minHeight = 72,
  disabled = false,
  extended = false,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const lastValue = useRef(value);

  // Equation dialog state
  const [eqDialogOpen, setEqDialogOpen] = useState(false);
  const [eqInput, setEqInput] = useState("");

  // Image URL dialog state
  const [imgDialogOpen, setImgDialogOpen] = useState(false);
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [imgUrlError, setImgUrlError] = useState("");

  // Paste-blocked notice state
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const pasteBlockedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image dialog tab: "url" | "upload"
  const [imgTab, setImgTab] = useState<"url" | "upload">("url");

  // File upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  // Saved selection for both dialogs
  const savedRange = useRef<Range | null>(null);

  // ── Mount: set initial innerHTML ──────────────────────────────────────────
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value;
      lastValue.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync from parent (e.g. form reset) ───────────────────────────────────
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (lastValue.current === value) return;
    lastValue.current = value;
    el.innerHTML = value;
  }, [value]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    isInternalChange.current = true;
    lastValue.current = html;
    onChange(html);
  }, [onChange]);

  // ── Paste handler: block image paste, allow text paste normally ───────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const hasImage = items.some((it) => it.type.startsWith("image/"));
      if (!hasImage) return; // let browser handle text paste normally

      e.preventDefault();

      // Show the "paste blocked" message for 4 seconds
      if (pasteBlockedTimer.current) clearTimeout(pasteBlockedTimer.current);
      setPasteBlocked(true);
      pasteBlockedTimer.current = setTimeout(() => setPasteBlocked(false), 4000);
    },
    []
  );

  // ── Determine inline vs block based on cursor context ────────────────────
  function detectImageClass(): "rich-img rich-img-inline" | "rich-img rich-img-block" {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return "rich-img rich-img-block";

    const range = sel.getRangeAt(0);
    let container: Node = range.startContainer;

    // Walk up to the nearest block-level element inside the editor
    while (container && container !== editorRef.current) {
      if (container.nodeType === Node.ELEMENT_NODE) {
        const tag = (container as Element).tagName.toLowerCase();
        if (["p", "div", "li", "blockquote", "td", "th"].includes(tag)) {
          break;
        }
      }
      container = container.parentNode as Node;
    }

    // Check if the block has any meaningful text content (excluding whitespace)
    const blockText = container?.textContent?.trim() ?? "";
    return blockText.length === 0 ? "rich-img rich-img-block" : "rich-img rich-img-inline";
  }

  // ── Insert <img> at cursor with auto-detected class ───────────────────────
  function insertImageAtCursor(src: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const imgClass = detectImageClass();

    // Restore saved range if selection was lost when dialog opened
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }

    const currentSel = window.getSelection();
    const img = document.createElement("img");
    img.src = src;
    img.alt = "image";
    img.className = imgClass;

    if (currentSel && currentSel.rangeCount > 0) {
      const range = currentSel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      const after = range.cloneRange();
      after.setStartAfter(img);
      after.collapse(true);
      currentSel.removeAllRanges();
      currentSel.addRange(after);
    } else {
      el.appendChild(img);
    }

    savedRange.current = null;
    emitChange();
  }

  // ── Image dialog (URL + Upload tabs) ─────────────────────────────────────
  function openImgDialog() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    setImgUrlInput("");
    setImgUrlError("");
    setImgTab("url");
    setUploadFile(null);
    setUploadStatus("idle");
    setUploadError("");
    setImgDialogOpen(true);
  }

  async function handleFileUpload() {
    if (!uploadFile) return;
    setUploadStatus("uploading");
    setUploadError("");
    try {
      const res = await fetch("/api/admin/upload/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: uploadFile.name, contentType: uploadFile.type, size: uploadFile.size }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(j.error ?? "Failed to get upload URL");
      }
      const { uploadUrl, publicUrl } = await res.json();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadFile.type },
        body: uploadFile,
      });
      if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);
      setImgDialogOpen(false);
      setUploadFile(null);
      setUploadStatus("idle");
      insertImageAtCursor(publicUrl);
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function insertImageFromUrl() {
    const url = imgUrlInput.trim();
    if (!url) {
      setImgUrlError("Please enter an image URL.");
      return;
    }
    // Basic URL validation — must be http/https
    if (!/^https?:\/\//i.test(url)) {
      setImgUrlError("URL must start with https:// or http://");
      return;
    }
    // Block base64 data URIs — they should not be inserted here
    if (/^data:/i.test(url)) {
      setImgUrlError("Base64 data URIs are not allowed. Use a hosted image URL instead.");
      return;
    }
    setImgDialogOpen(false);
    insertImageAtCursor(url);
  }

  // ── Equation dialog ────────────────────────────────────────────────────────
  function openEqDialog() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
    setEqInput("");
    setEqDialogOpen(true);
  }

  function insertEquation() {
    const latex = eqInput.trim();
    if (!latex) { setEqDialogOpen(false); return; }

    const el = editorRef.current;
    if (!el) { setEqDialogOpen(false); return; }
    el.focus();

    const sel = window.getSelection();
    const range = savedRange.current ?? (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);

    const span = document.createElement("span");
    span.className = "math-eq";
    span.setAttribute("data-latex", latex);
    span.setAttribute("contenteditable", "false");
    span.style.cssText =
      "background:#f0f4ff;border:1px solid #c7d2fe;border-radius:4px;padding:0 4px;font-family:monospace;font-size:0.875em;white-space:nowrap;cursor:default;";
    span.textContent = `$$${latex}$$`;

    if (range) {
      range.deleteContents();
      range.insertNode(span);
      const after = range.cloneRange();
      after.setStartAfter(span);
      after.collapse(true);
      if (sel) { sel.removeAllRanges(); sel.addRange(after); }
    } else {
      el.appendChild(span);
    }

    savedRange.current = null;
    setEqDialogOpen(false);
    emitChange();
  }

  // ── Toolbar commands ───────────────────────────────────────────────────────
  function execCmd(cmd: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    emitChange();
  }

  const isEmpty = !value || value === "<br>" || value === "<div><br></div>";
  const anyDialogOpen = eqDialogOpen || imgDialogOpen;

  return (
    <div style={{ position: "relative" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          flexWrap: "wrap",
          padding: "0.25rem",
          background: "#f8fafc",
          border: "1px solid #d1d5db",
          borderBottom: "none",
          borderRadius: "6px 6px 0 0",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }}
          style={TOOLBAR_BTN}
          title="Bold"
          disabled={disabled}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }}
          style={{ ...TOOLBAR_BTN, fontStyle: "italic" }}
          title="Italic"
          disabled={disabled}
        >
          <em>I</em>
        </button>

        <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); openImgDialog(); }}
          style={TOOLBAR_BTN}
          title="Insert image (URL or upload)"
          disabled={disabled}
        >
          🖼 Image
        </button>

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); openEqDialog(); }}
          style={TOOLBAR_BTN}
          title="Insert equation (LaTeX)"
          disabled={disabled}
        >
          ∑ Equation
        </button>

        <span style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "#94a3b8", paddingRight: "0.25rem" }}>
          Use 🖼 to insert images
        </span>
      </div>

      {/* Paste-blocked notice */}
      {pasteBlocked && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "4px",
            padding: "0.375rem 0.625rem",
            fontSize: "0.8125rem",
            color: "#92400e",
            margin: "0 0 0.25rem",
          }}
        >
          Image paste is disabled. Use the <strong>🖼 Image URL</strong> button to insert images by URL.
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emitChange}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        style={{
          minHeight,
          padding: "0.5rem 0.625rem",
          border: "1px solid #d1d5db",
          borderRadius: "0 0 6px 6px",
          outline: "none",
          fontFamily: "system-ui, sans-serif",
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          color: "#111827",
          background: disabled ? "#f9fafb" : "#fff",
          overflowY: "auto",
          wordBreak: "break-word",
        }}
      />

      {/* Placeholder */}
      {isEmpty && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(2rem + 0.5rem)",
            left: "0.625rem",
            color: "#9ca3af",
            fontSize: "0.9375rem",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {placeholder}
        </div>
      )}

      {/* Hidden file input for upload tab */}
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setUploadFile(f);
          setUploadStatus("idle");
          setUploadError("");
          e.target.value = "";
        }}
      />

      {/* Image dialog — URL tab | Upload tab */}
      {imgDialogOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #86efac",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "0.75rem",
          }}
        >
          {/* Tab strip */}
          <div style={{ display: "flex", gap: "0", marginBottom: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>
            {(["url", "upload"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setImgTab(tab); setUploadError(""); setImgUrlError(""); }}
                style={{
                  padding: "0.3125rem 0.75rem",
                  fontSize: "0.8rem",
                  fontWeight: imgTab === tab ? 700 : 400,
                  color: imgTab === tab ? "#16a34a" : "#6b7280",
                  background: "none",
                  border: "none",
                  borderBottom: imgTab === tab ? "2px solid #16a34a" : "2px solid transparent",
                  cursor: "pointer",
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                {tab === "url" ? "By URL" : "Upload File"}
              </button>
            ))}
          </div>

          {/* URL tab */}
          {imgTab === "url" && (
            <>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                Paste a hosted image URL (https://…). Position (inline or block) is detected automatically.
              </div>
              <input
                autoFocus
                type="url"
                value={imgUrlInput}
                onChange={(e) => { setImgUrlInput(e.target.value); setImgUrlError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); insertImageFromUrl(); }
                  if (e.key === "Escape") setImgDialogOpen(false);
                }}
                placeholder="https://cdn.example.com/image.png"
                style={{
                  width: "100%",
                  padding: "0.375rem 0.5rem",
                  border: `1px solid ${imgUrlError ? "#ef4444" : "#d1d5db"}`,
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                  fontFamily: "system-ui, sans-serif",
                  marginBottom: "0.375rem",
                  boxSizing: "border-box",
                }}
              />
              {imgUrlError && (
                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginBottom: "0.375rem" }}>
                  {imgUrlError}
                </div>
              )}
              {imgUrlInput && /^https?:\/\//i.test(imgUrlInput) && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "0.6875rem", color: "#6b7280", marginBottom: "0.25rem" }}>Preview:</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrlInput}
                    alt="preview"
                    style={{ maxWidth: "100%", maxHeight: "120px", objectFit: "contain", borderRadius: "4px", border: "1px solid #e5e7eb" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: "0.375rem" }}>
                <button
                  type="button"
                  onClick={insertImageFromUrl}
                  style={{ padding: "0.3125rem 0.75rem", background: "#16a34a", color: "#fff", border: "none", borderRadius: "4px", fontSize: "0.8125rem", cursor: "pointer" }}
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => setImgDialogOpen(false)}
                  style={{ padding: "0.3125rem 0.75rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Upload tab */}
          {imgTab === "upload" && (
            <>
              <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                Upload a JPG, PNG, or WebP image (max 5 MB). It will be stored on the CDN and inserted at cursor.
              </div>

              {/* File picker area */}
              <div
                style={{
                  border: "2px dashed #d1d5db",
                  borderRadius: "6px",
                  padding: "0.75rem",
                  textAlign: "center",
                  marginBottom: "0.5rem",
                  background: "#f9fafb",
                  cursor: "pointer",
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadFile ? (
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.125rem" }}>
                      {uploadFile.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      {(uploadFile.size / 1024).toFixed(1)} KB · {uploadFile.type}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
                    Click to choose an image file
                  </div>
                )}
              </div>

              {uploadError && (
                <div style={{ fontSize: "0.75rem", color: "#ef4444", marginBottom: "0.375rem" }}>
                  {uploadError}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.375rem" }}>
                <button
                  type="button"
                  disabled={!uploadFile || uploadStatus === "uploading"}
                  onClick={handleFileUpload}
                  style={{
                    padding: "0.3125rem 0.75rem",
                    background: !uploadFile || uploadStatus === "uploading" ? "#a7f3d0" : "#16a34a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8125rem",
                    cursor: !uploadFile || uploadStatus === "uploading" ? "default" : "pointer",
                  }}
                >
                  {uploadStatus === "uploading" ? "Uploading…" : "Upload & Insert"}
                </button>
                <button
                  type="button"
                  onClick={() => setImgDialogOpen(false)}
                  style={{ padding: "0.3125rem 0.75rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Equation dialog */}
      {eqDialogOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #c7d2fe",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "0.75rem",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.375rem" }}>
            Insert Equation (LaTeX)
          </div>
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.5rem" }}>
            Examples: <code>x^2 + 3x - 4 = 0</code> · <code>\frac{"{a}"}{"{b}"}</code> · <code>\sqrt{"{16}"}</code>
          </div>
          <input
            autoFocus
            type="text"
            value={eqInput}
            onChange={(e) => setEqInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); insertEquation(); }
              if (e.key === "Escape") setEqDialogOpen(false);
            }}
            placeholder="Type LaTeX here…"
            style={{
              width: "100%",
              padding: "0.375rem 0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "0.875rem",
              fontFamily: "monospace",
              marginBottom: "0.5rem",
              boxSizing: "border-box",
            }}
          />
          {eqInput.trim() && (
            <div style={{ fontSize: "0.75rem", color: "#4b5563", marginBottom: "0.5rem", background: "#f8f9ff", padding: "0.25rem 0.5rem", borderRadius: "4px" }}>
              Preview: <code>$${ eqInput }$$</code>
            </div>
          )}
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button
              type="button"
              onClick={insertEquation}
              style={{
                padding: "0.3125rem 0.75rem",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setEqDialogOpen(false)}
              style={{
                padding: "0.3125rem 0.75rem",
                background: "#f3f4f6",
                color: "#374151",
                border: "1px solid #d1d5db",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
