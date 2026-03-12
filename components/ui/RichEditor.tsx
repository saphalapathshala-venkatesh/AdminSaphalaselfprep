"use client";

/**
 * RichEditor — contenteditable rich text editor for question content.
 *
 * Features:
 *  - Paste images/screenshots directly from clipboard → stored as base64 data URIs
 *  - Upload images via file button
 *  - Insert equations via $$LaTeX$$ markers (inline dialog)
 *  - Bold / italic toolbar
 *  - Outputs HTML via onChange callback
 *  - Existing plain text renders correctly (backward compatible)
 */

import { useRef, useEffect, useCallback, useState } from "react";

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}

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

const TOOLBAR_BTN_ACTIVE: React.CSSProperties = {
  ...TOOLBAR_BTN,
  background: "#7c3aed",
  color: "#fff",
  borderColor: "#7c3aed",
};

export default function RichEditor({
  value,
  onChange,
  placeholder = "Type here, paste images, or use toolbar…",
  minHeight = 72,
  disabled = false,
}: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);
  const lastValue = useRef(value);

  const [eqDialogOpen, setEqDialogOpen] = useState(false);
  const [eqInput, setEqInput] = useState("");
  const savedRange = useRef<Range | null>(null);

  // Initialise / sync content from parent only when value changes externally
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

  // ── Paste handler: capture images from clipboard ───────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (!imageItem) return; // let browser handle text paste normally

      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        insertImageAtCursor(src);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // ── Insert <img> at cursor position ───────────────────────────────────────
  function insertImageAtCursor(src: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      el.innerHTML +=
        `<img src="${src}" style="max-width:100%;height:auto;display:block;margin:0.25rem 0;" alt="uploaded image" />`;
    } else {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const img = document.createElement("img");
      img.src = src;
      img.alt = "uploaded image";
      img.style.cssText = "max-width:100%;height:auto;display:block;margin:0.25rem 0;";
      range.insertNode(img);
      // Move cursor after image
      const after = range.cloneRange();
      after.setStartAfter(img);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    emitChange();
  }

  // ── File upload ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      insertImageAtCursor(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Equation insertion ─────────────────────────────────────────────────────
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
          onMouseDown={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
          style={TOOLBAR_BTN}
          title="Upload or paste image / screenshot"
          disabled={disabled}
        >
          📷 Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

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
          Paste image with Ctrl+V
        </span>
      </div>

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
