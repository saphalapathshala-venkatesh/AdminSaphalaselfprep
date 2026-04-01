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

  // Extended toolbar state
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [activeColor, setActiveColor] = useState("#000000");
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");

  // Table cell context menu state
  const [cellMenu, setCellMenu] = useState<{
    x: number; y: number;
    cell: HTMLTableCellElement;
    canMergeRight: boolean;
    canMergeDown: boolean;
    canSplit: boolean;
  } | null>(null);

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

  function execCmdVal(cmd: string, val: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    emitChange();
  }

  function applyColor(color: string) {
    setActiveColor(color);
    setColorPickerOpen(false);
    execCmdVal("foreColor", color);
  }

  function openTableDialog() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
    setTableRows("3");
    setTableCols("3");
    setTableDialogOpen(true);
  }

  function insertTable() {
    const rows = Math.max(1, Math.min(20, parseInt(tableRows) || 3));
    const cols = Math.max(1, Math.min(10, parseInt(tableCols) || 3));
    const el = editorRef.current;
    if (!el) { setTableDialogOpen(false); return; }
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }

    const cellStyle = "border:1px solid #94a3b8;padding:6px 8px;min-width:60px;";
    let html = `<table style="border-collapse:collapse;width:100%;margin:0.5em 0;">`;
    // Header row
    html += "<thead><tr>";
    for (let c = 0; c < cols; c++) html += `<th style="${cellStyle}background:#f1f5f9;font-weight:600;">Header ${c + 1}</th>`;
    html += "</tr></thead><tbody>";
    for (let r = 0; r < rows - 1; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) html += `<td style="${cellStyle}"></td>`;
      html += "</tr>";
    }
    html += "</tbody></table><p><br></p>";

    const currentSel = window.getSelection();
    if (currentSel && currentSel.rangeCount > 0) {
      const range = currentSel.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(html);
      range.insertNode(frag);
      const after = range.cloneRange();
      after.collapse(false);
      currentSel.removeAllRanges();
      currentSel.addRange(after);
    } else {
      el.insertAdjacentHTML("beforeend", html);
    }

    savedRange.current = null;
    setTableDialogOpen(false);
    emitChange();
  }

  // ── Table cell merge helpers ───────────────────────────────────────────────
  function handleCellContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const target = e.target as HTMLElement;
    const cell = target.closest("td, th") as HTMLTableCellElement | null;
    if (!cell) return;
    e.preventDefault();
    const colspan = parseInt(cell.getAttribute("colspan") || "1");
    const rowspan = parseInt(cell.getAttribute("rowspan") || "1");
    const nextCell = cell.nextElementSibling as HTMLTableCellElement | null;
    const row = cell.closest("tr") as HTMLTableRowElement | null;
    const nextRow = row?.nextElementSibling as HTMLTableRowElement | null;
    const cellIndex = row ? Array.from(row.cells).indexOf(cell) : -1;
    const belowCell = nextRow && cellIndex >= 0 ? nextRow.cells[cellIndex] : null;
    setCellMenu({
      x: e.clientX,
      y: e.clientY,
      cell,
      canMergeRight: !!(nextCell && ["TD", "TH"].includes(nextCell.tagName)),
      canMergeDown: !!belowCell,
      canSplit: colspan > 1 || rowspan > 1,
    });
  }

  function mergeRight() {
    if (!cellMenu) return;
    const { cell } = cellMenu;
    const next = cell.nextElementSibling as HTMLTableCellElement | null;
    if (!next || !["TD", "TH"].includes(next.tagName)) return;
    const cs = parseInt(cell.getAttribute("colspan") || "1") + parseInt(next.getAttribute("colspan") || "1");
    cell.setAttribute("colspan", String(cs));
    while (next.firstChild) cell.appendChild(next.firstChild);
    next.remove();
    setCellMenu(null);
    emitChange();
  }

  function mergeDown() {
    if (!cellMenu) return;
    const { cell } = cellMenu;
    const row = cell.closest("tr") as HTMLTableRowElement | null;
    if (!row) return;
    const cellIndex = Array.from(row.cells).indexOf(cell);
    const nextRow = row.nextElementSibling as HTMLTableRowElement | null;
    if (!nextRow) return;
    const below = nextRow.cells[cellIndex] as HTMLTableCellElement | undefined;
    if (!below) return;
    const rs = parseInt(cell.getAttribute("rowspan") || "1") + parseInt(below.getAttribute("rowspan") || "1");
    cell.setAttribute("rowspan", String(rs));
    while (below.firstChild) cell.appendChild(below.firstChild);
    below.remove();
    setCellMenu(null);
    emitChange();
  }

  function splitCell() {
    if (!cellMenu) return;
    const { cell } = cellMenu;
    const colspan = parseInt(cell.getAttribute("colspan") || "1");
    const rowspan = parseInt(cell.getAttribute("rowspan") || "1");
    const CELL_STYLE = "border:1px solid #94a3b8;padding:6px 8px;min-width:60px;";
    if (colspan > 1) {
      cell.removeAttribute("colspan");
      for (let i = 1; i < colspan; i++) {
        const nc = document.createElement(cell.tagName.toLowerCase());
        nc.setAttribute("style", CELL_STYLE);
        cell.after(nc);
      }
    }
    if (rowspan > 1) {
      cell.removeAttribute("rowspan");
      const row = cell.closest("tr") as HTMLTableRowElement | null;
      if (row) {
        const idx = Array.from(row.cells).indexOf(cell);
        let nr = row.nextElementSibling as HTMLTableRowElement | null;
        for (let i = 1; i < rowspan && nr; i++) {
          const nc = document.createElement(cell.tagName.toLowerCase());
          nc.setAttribute("style", CELL_STYLE);
          if (nr.cells[idx]) nr.insertBefore(nc, nr.cells[idx]);
          else nr.appendChild(nc);
          nr = nr.nextElementSibling as HTMLTableRowElement | null;
        }
      }
    }
    setCellMenu(null);
    emitChange();
  }

  const isEmpty = !value || value === "<br>" || value === "<div><br></div>";
  const anyDialogOpen = eqDialogOpen || imgDialogOpen || tableDialogOpen;

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
        {/* ── Row 1: always-visible controls ── */}
        <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }} style={TOOLBAR_BTN} title="Bold" disabled={disabled}><strong>B</strong></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }} style={{ ...TOOLBAR_BTN, fontStyle: "italic" }} title="Italic" disabled={disabled}><em>I</em></button>

        {extended && (<>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("underline"); }} style={{ ...TOOLBAR_BTN, textDecoration: "underline" }} title="Underline" disabled={disabled}>U</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("strikeThrough"); }} style={{ ...TOOLBAR_BTN, textDecoration: "line-through" }} title="Strikethrough" disabled={disabled}>S</button>

          <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />

          {/* Font family */}
          <select
            title="Font family"
            style={SELECT_STYLE}
            disabled={disabled}
            defaultValue=""
            onChange={(e) => { if (e.target.value) { execCmdVal("fontName", e.target.value); e.target.value = ""; } }}
          >
            <option value="" disabled>Font</option>
            {FONT_FAMILIES.map(f => <option key={f} value={f === "Default" ? "system-ui,sans-serif" : f}>{f}</option>)}
          </select>

          {/* Font size */}
          <select
            title="Font size"
            style={{ ...SELECT_STYLE, width: "70px" }}
            disabled={disabled}
            defaultValue=""
            onChange={(e) => { if (e.target.value) { execCmdVal("fontSize", e.target.value); e.target.value = ""; } }}
          >
            <option value="" disabled>Size</option>
            {FONT_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />

          {/* Text colour */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              title="Text colour"
              disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); setColorPickerOpen(p => !p); setTableDialogOpen(false); }}
              style={{ ...TOOLBAR_BTN, display: "flex", flexDirection: "column", alignItems: "center", gap: "1px", padding: "2px 6px" }}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: activeColor === "#ffffff" ? "#374151" : activeColor }}>A</span>
              <span style={{ display: "block", width: "14px", height: "3px", background: activeColor, borderRadius: "1px", border: "1px solid #d1d5db" }} />
            </button>
            {colorPickerOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid #d1d5db", borderRadius: "6px", padding: "0.4rem", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", display: "grid", gridTemplateColumns: "repeat(6, 18px)", gap: "3px" }}>
                {TEXT_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
                    style={{ width: "18px", height: "18px", background: c, border: c === activeColor ? "2px solid #7c3aed" : "1px solid #d1d5db", borderRadius: "3px", cursor: "pointer", padding: 0 }}
                  />
                ))}
                {/* Custom colour input */}
                <input
                  type="color"
                  title="Custom colour"
                  value={activeColor}
                  style={{ width: "18px", height: "18px", padding: 0, border: "1px solid #d1d5db", borderRadius: "3px", cursor: "pointer", gridColumn: "span 1" }}
                  onChange={(e) => applyColor(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />

          {/* Alignment */}
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("justifyLeft"); }} style={TOOLBAR_BTN} title="Align left" disabled={disabled}>≡←</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("justifyCenter"); }} style={TOOLBAR_BTN} title="Align centre" disabled={disabled}>≡</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("justifyRight"); }} style={TOOLBAR_BTN} title="Align right" disabled={disabled}>→≡</button>

          <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />

          {/* Lists */}
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }} style={TOOLBAR_BTN} title="Bullet list" disabled={disabled}>• List</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }} style={TOOLBAR_BTN} title="Numbered list" disabled={disabled}>1. List</button>

          <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />

          {/* Table */}
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setTableDialogOpen(p => !p); setColorPickerOpen(false); }}
            style={TOOLBAR_BTN}
            title="Insert table"
            disabled={disabled}
          >
            ⊞ Table
          </button>
        </>)}

        {!extended && (<>
          <div style={{ width: "1px", background: "#d1d5db", height: "20px", margin: "0 0.125rem" }} />
          <button type="button" onMouseDown={(e) => { e.preventDefault(); openImgDialog(); }} style={TOOLBAR_BTN} title="Insert image (URL or upload)" disabled={disabled}>🖼 Image</button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); openEqDialog(); }} style={TOOLBAR_BTN} title="Insert equation (LaTeX)" disabled={disabled}>∑ Equation</button>
          <span style={{ marginLeft: "auto", fontSize: "0.6875rem", color: "#94a3b8", paddingRight: "0.25rem" }}>Use 🖼 to insert images</span>
        </>)}
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
        onContextMenu={handleCellContextMenu}
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

      {/* Table insert dialog (extended only) */}
      {tableDialogOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 60,
            background: "#fff",
            border: "1px solid #e0e7ff",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: "0.75rem",
            minWidth: "200px",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Insert Table</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.625rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "0.2rem" }}>Rows</label>
              <input
                type="number" min="1" max="20" value={tableRows}
                onChange={(e) => setTableRows(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") insertTable(); if (e.key === "Escape") setTableDialogOpen(false); }}
                style={{ width: "100%", padding: "0.25rem 0.375rem", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", boxSizing: "border-box" }}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#6b7280", display: "block", marginBottom: "0.2rem" }}>Columns</label>
              <input
                type="number" min="1" max="10" value={tableCols}
                onChange={(e) => setTableCols(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") insertTable(); if (e.key === "Escape") setTableDialogOpen(false); }}
                style={{ width: "100%", padding: "0.25rem 0.375rem", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", boxSizing: "border-box" }}
              />
            </div>
          </div>
          <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginBottom: "0.5rem" }}>
            A header row is added automatically. First row = headers.
          </div>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button
              type="button"
              onClick={insertTable}
              style={{ padding: "0.3125rem 0.75rem", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "4px", fontSize: "0.8125rem", cursor: "pointer" }}
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setTableDialogOpen(false)}
              style={{ padding: "0.3125rem 0.75rem", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "4px", fontSize: "0.8125rem", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table cell context menu */}
      {cellMenu && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 70 }}
            onMouseDown={() => setCellMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              top: cellMenu.y,
              left: cellMenu.x,
              zIndex: 80,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "7px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              minWidth: "180px",
              overflow: "hidden",
              fontSize: "0.8125rem",
            }}
          >
            <div style={{ padding: "0.35rem 0.65rem", fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9" }}>
              Table Cell
            </div>
            {cellMenu.canMergeRight && (
              <button
                type="button"
                onMouseDown={(e) => { e.stopPropagation(); mergeRight(); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.45rem 0.75rem", background: "none", border: "none", cursor: "pointer", color: "#1e293b" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                ⟶ Merge with right cell
              </button>
            )}
            {cellMenu.canMergeDown && (
              <button
                type="button"
                onMouseDown={(e) => { e.stopPropagation(); mergeDown(); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.45rem 0.75rem", background: "none", border: "none", cursor: "pointer", color: "#1e293b" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                ⟓ Merge with cell below
              </button>
            )}
            {cellMenu.canSplit && (
              <button
                type="button"
                onMouseDown={(e) => { e.stopPropagation(); splitCell(); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.45rem 0.75rem", background: "none", border: "none", cursor: "pointer", color: "#7c3aed" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f3ff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                ✦ Split merged cell
              </button>
            )}
            {!cellMenu.canMergeRight && !cellMenu.canMergeDown && !cellMenu.canSplit && (
              <div style={{ padding: "0.45rem 0.75rem", color: "#94a3b8" }}>No merge options available</div>
            )}
            <div style={{ borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                onMouseDown={(e) => { e.stopPropagation(); setCellMenu(null); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "0.45rem 0.75rem", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                ✕ Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
