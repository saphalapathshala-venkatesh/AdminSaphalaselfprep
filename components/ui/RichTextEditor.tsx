"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

/* ─── Callout Presets ─── */
const CALLOUT_PRESETS = [
  { key: "tip",        icon: "💡", label: "TIP",         headerBg: "#16a34a", bodyBg: "#f0fdf4", accent: "#86efac" },
  { key: "important",  icon: "❗", label: "IMPORTANT",    headerBg: "#dc2626", bodyBg: "#fff1f2", accent: "#fca5a5" },
  { key: "remember",   icon: "🔖", label: "REMEMBER",     headerBg: "#d97706", bodyBg: "#fffbeb", accent: "#fde68a" },
  { key: "example",    icon: "📝", label: "EXAMPLE",      headerBg: "#0284c7", bodyBg: "#f0f9ff", accent: "#bae6fd" },
  { key: "concept",    icon: "💎", label: "CONCEPT",      headerBg: "#7c3aed", bodyBg: "#faf5ff", accent: "#ddd6fe" },
  { key: "definition", icon: "📖", label: "DEFINITION",   headerBg: "#ea580c", bodyBg: "#fff7ed", accent: "#fed7aa" },
  { key: "warning",    icon: "⚠️", label: "WARNING",      headerBg: "#ca8a04", bodyBg: "#fefce8", accent: "#fef08a" },
  { key: "examfocus",  icon: "🎯", label: "EXAM FOCUS",   headerBg: "#b45309", bodyBg: "#fffbeb", accent: "#fde68a" },
  { key: "formula",    icon: "🔢", label: "FORMULA",      headerBg: "#6d28d9", bodyBg: "#f5f3ff", accent: "#c4b5fd" },
  { key: "casestudy",  icon: "🔍", label: "CASE STUDY",   headerBg: "#0f766e", bodyBg: "#f0fdfa", accent: "#99f6e4" },
  { key: "note",       icon: "ℹ️", label: "NOTE",          headerBg: "#2563eb", bodyBg: "#eff6ff", accent: "#bfdbfe" },
] as const;

const CUSTOM_COLORS = [
  "#2563eb","#7c3aed","#dc2626","#d97706","#16a34a",
  "#0891b2","#db2777","#475569","#0f766e","#b45309",
];

/* ─── Styles ─── */
const TBTN: React.CSSProperties = {
  padding: "3px 7px", fontSize: "0.78rem", fontFamily: "inherit",
  background: "none", border: "1px solid transparent", borderRadius: "4px",
  cursor: "pointer", color: "#374151",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 28, height: 26, lineHeight: 1, flexShrink: 0,
  transition: "background 0.1s, border-color 0.1s",
};
const TBTN_ON: React.CSSProperties = { ...TBTN, background: "#ede9fe", borderColor: "#c4b5fd", color: "#7c3aed" };
const SEP: React.CSSProperties = { width: 1, height: 20, background: "#e5e7eb", margin: "0 3px", display: "inline-block", flexShrink: 0 };
const COLORS = ["#111827","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#7c3aed","#6b7280"];
const HIGHLIGHTS = ["#fef9c3","#dcfce7","#dbeafe","#fce7f3","#fff7ed"];

/* ─── Build callout HTML ─── */
function buildCallout(icon: string, label: string, headerBg: string, bodyBg: string, accent: string, key: string): string {
  return (
    `<div data-callout="${key}" style="background:${bodyBg};border-radius:8px;margin:14px 0;overflow:hidden;border:1.5px solid ${accent};">`
    + `<div data-callout-header style="background:${headerBg};padding:7px 13px;font-weight:700;font-size:0.75rem;color:#fff;letter-spacing:0.07em;display:flex;align-items:center;gap:7px;">${icon}&nbsp;${label}</div>`
    + `<div data-callout-body data-ph="Type content here…" style="padding:11px 14px;font-size:0.875rem;min-height:38px;color:#1f2937;line-height:1.65;"><br></div>`
    + `</div><p><br></p>`
  );
}

/* ─── Props ─── */
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = "Write content here…", minHeight = "240px" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showCalloutPicker, setShowCalloutPicker] = useState(false);
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const [customTitle, setCustomTitle] = useState("");
  const [customIcon, setCustomIcon] = useState("📌");
  const [customColor, setCustomColor] = useState("#7c3aed");
  const initialized = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Init once */
  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  /* Debounced emit — avoids blocking UI thread on every keystroke */
  const emit = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    }, 80);
  }, [onChange]);

  /* Flush immediately (for toolbar actions) */
  const emitNow = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const closeAll = useCallback(() => {
    setShowColorPicker(false);
    setShowHighlightPicker(false);
    setShowTableModal(false);
    setShowCalloutPicker(false);
  }, []);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
    emitNow();
  }, [emitNow]);

  const insertHTML = useCallback((html: string) => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    emitNow();
  }, [emitNow]);

  const insertBlock = useCallback((tag: string) => {
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, tag);
    emitNow();
  }, [emitNow]);

  /* Table */
  const insertTable = useCallback(() => {
    const r = Math.max(1, parseInt(tableRows) || 3);
    const c = Math.max(1, parseInt(tableCols) || 3);
    let html = `<table style="border-collapse:collapse;width:100%;margin:12px 0;"><thead><tr>`;
    for (let j = 0; j < c; j++)
      html += `<th style="border:1.5px solid #d1d5db;padding:6px 10px;background:#f3f4f6;text-align:left;font-size:0.8125rem;">Header ${j + 1}</th>`;
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < r - 1; i++) {
      html += `<tr>`;
      for (let j = 0; j < c; j++)
        html += `<td style="border:1.5px solid #d1d5db;padding:6px 10px;font-size:0.8125rem;"> </td>`;
      html += `</tr>`;
    }
    html += `</tbody></table><p><br></p>`;
    insertHTML(html);
    setShowTableModal(false);
  }, [tableRows, tableCols, insertHTML]);

  /* Insert a preset callout */
  const insertPresetCallout = useCallback((preset: typeof CALLOUT_PRESETS[number]) => {
    insertHTML(buildCallout(preset.icon, preset.label, preset.headerBg, preset.bodyBg, preset.accent, preset.key));
    setShowCalloutPicker(false);
  }, [insertHTML]);

  /* Insert custom callout */
  const insertCustomCallout = useCallback(() => {
    const title = (customTitle.trim() || "Custom").toUpperCase();
    const shade = customColor + "22";
    const accentLight = customColor + "66";
    insertHTML(buildCallout(customIcon, title, customColor, shade, accentLight, "custom"));
    setShowCalloutPicker(false);
    setCustomTitle("");
  }, [customTitle, customIcon, customColor, insertHTML]);

  /* Image */
  const insertImage = useCallback(() => {
    const url = prompt("Enter image URL:");
    if (url) insertHTML(`<img src="${url}" style="max-width:100%;border-radius:6px;margin:8px 0;" alt="" /><p><br></p>`);
  }, [insertHTML]);

  /* ── Keyboard handler: Backspace on empty callout body removes whole block ── */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Backspace") return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return; // selection, not cursor — let browser handle

    const node = range.startContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const calloutBody = el?.closest("[data-callout-body]");
    if (!calloutBody) return;

    const bodyHtml = calloutBody.innerHTML.trim();
    const isEmpty = bodyHtml === "" || bodyHtml === "<br>" || (calloutBody.textContent?.trim() === "");
    if (isEmpty) {
      e.preventDefault();
      const callout = calloutBody.closest("[data-callout]");
      callout?.remove();
      emitNow();
    }
  }, [emitNow]);

  /* ─── Toolbar Button Component ─── */
  const Btn = ({ title, onClick, children, on }: { title: string; onClick: () => void; children: React.ReactNode; on?: boolean }) => (
    <button
      title={title}
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={on ? TBTN_ON : TBTN}
      onMouseEnter={(e) => { if (!on) (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; }}
      onMouseLeave={(e) => { if (!on) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
    >
      {children}
    </button>
  );

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", gap: "1px", flexWrap: "wrap" }}>{children}</div>
  );

  return (
    <div
      style={{ border: "1px solid #d1d5db", borderRadius: "8px", overflow: "visible", background: "#fff", position: "relative" }}
      onClick={() => closeAll()}
    >
      {/* ── Toolbar ── */}
      <div
        style={{ borderBottom: "1px solid #e5e7eb", padding: "4px 6px", background: "#fafafa", display: "flex", gap: "2px", flexWrap: "wrap", alignItems: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Format */}
        <Row>
          <Btn title="Bold (Ctrl+B)" onClick={() => exec("bold")}><b>B</b></Btn>
          <Btn title="Italic (Ctrl+I)" onClick={() => exec("italic")}><i>I</i></Btn>
          <Btn title="Underline (Ctrl+U)" onClick={() => exec("underline")}><u>U</u></Btn>
        </Row>
        <div style={SEP} />

        {/* Headings */}
        <Row>
          <Btn title="Heading 1" onClick={() => insertBlock("h1")}><span style={{ fontWeight: 700, fontSize: "0.7rem" }}>H1</span></Btn>
          <Btn title="Heading 2" onClick={() => insertBlock("h2")}><span style={{ fontWeight: 700, fontSize: "0.7rem" }}>H2</span></Btn>
          <Btn title="Heading 3" onClick={() => insertBlock("h3")}><span style={{ fontWeight: 700, fontSize: "0.7rem" }}>H3</span></Btn>
          <Btn title="Paragraph" onClick={() => insertBlock("p")}><span style={{ fontSize: "0.7rem" }}>P</span></Btn>
        </Row>
        <div style={SEP} />

        {/* Lists + Quote */}
        <Row>
          <Btn title="Bullet List" onClick={() => exec("insertUnorderedList")}>&#8226;—</Btn>
          <Btn title="Numbered List" onClick={() => exec("insertOrderedList")}>1—</Btn>
          <Btn title="Blockquote" onClick={() => insertBlock("blockquote")}><span style={{ fontSize: "0.9rem" }}>"</span></Btn>
        </Row>
        <div style={SEP} />

        {/* Text Color */}
        <div style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
          <Btn title="Text Color" onClick={() => { setShowColorPicker(p => !p); setShowHighlightPicker(false); setShowTableModal(false); setShowCalloutPicker(false); }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>A</span>
            <span style={{ display: "block", width: 12, height: 3, background: "#ef4444", marginTop: 1, borderRadius: 1 }} />
          </Btn>
          {showColorPicker && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, padding: 7, display: "flex", gap: 4, boxShadow: "0 6px 20px rgba(0,0,0,.14)" }}>
              {COLORS.map(c => (
                <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c); setShowColorPicker(false); }}
                  style={{ width: 20, height: 20, background: c, border: c === "#111827" ? "1px solid #d1d5db" : "none", borderRadius: 4, cursor: "pointer" }} />
              ))}
            </div>
          )}
        </div>

        {/* Highlight */}
        <div style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
          <Btn title="Highlight Color" onClick={() => { setShowHighlightPicker(p => !p); setShowColorPicker(false); setShowTableModal(false); setShowCalloutPicker(false); }}>
            <span style={{ fontSize: "0.7rem", background: "#fef9c3", padding: "1px 3px", borderRadius: 2 }}>HL</span>
          </Btn>
          {showHighlightPicker && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 7, padding: 7, display: "flex", gap: 4, boxShadow: "0 6px 20px rgba(0,0,0,.14)" }}>
              {HIGHLIGHTS.map(c => (
                <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); exec("backColor", c); setShowHighlightPicker(false); }}
                  style={{ width: 20, height: 20, background: c, border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer" }} />
              ))}
              <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("backColor", "transparent"); setShowHighlightPicker(false); }}
                style={{ width: 20, height: 20, background: "#fff", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", fontSize: "0.6rem", color: "#6b7280" }}>✕</button>
            </div>
          )}
        </div>
        <div style={SEP} />

        {/* ── Callout Box ── */}
        <div style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
          <Btn title="Insert Callout / Box" on={showCalloutPicker}
            onClick={() => { setShowCalloutPicker(p => !p); setShowColorPicker(false); setShowHighlightPicker(false); setShowTableModal(false); }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 600 }}>⬛ Box</span>
          </Btn>
          {showCalloutPicker && (
            <div style={{
              position: "absolute", top: "110%", left: 0, zIndex: 300,
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
              padding: "12px", boxShadow: "0 8px 32px rgba(0,0,0,.16)",
              minWidth: 310, maxHeight: 420, overflowY: "auto",
            }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Insert Callout Box</div>

              {/* Preset grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 12 }}>
                {CALLOUT_PRESETS.map(p => (
                  <button
                    key={p.key} type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertPresetCallout(p); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "5px 8px",
                      background: p.bodyBg, border: `1.5px solid ${p.accent}`,
                      borderRadius: 6, cursor: "pointer", fontSize: "0.72rem", fontWeight: 600,
                      color: "#1f2937", textAlign: "left",
                    }}
                  >
                    <span>{p.icon}</span>
                    <span style={{ color: p.headerBg, fontWeight: 700, fontSize: "0.68rem" }}>{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom divider */}
              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>Custom Box</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 7 }}>
                  <input
                    type="text" value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                    placeholder="Box title (e.g. Key Point)"
                    style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 5, padding: "4px 8px", fontSize: "0.78rem", outline: "none" }}
                    onMouseDown={e => e.stopPropagation()}
                  />
                  <input
                    type="text" value={customIcon} onChange={e => setCustomIcon(e.target.value)}
                    placeholder="🔑"
                    style={{ width: 42, border: "1px solid #d1d5db", borderRadius: 5, padding: "4px 6px", fontSize: "0.9rem", textAlign: "center", outline: "none" }}
                    onMouseDown={e => e.stopPropagation()}
                  />
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                  {CUSTOM_COLORS.map(c => (
                    <div key={c} onMouseDown={(e) => { e.preventDefault(); setCustomColor(c); }}
                      style={{ width: 18, height: 18, background: c, borderRadius: "50%", cursor: "pointer", border: c === customColor ? "2.5px solid #111" : "1.5px solid transparent" }} />
                  ))}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertCustomCallout(); }}
                  disabled={!customTitle.trim()}
                  style={{ width: "100%", padding: "5px 0", background: customTitle.trim() ? customColor : "#e5e7eb", color: customTitle.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 6, cursor: customTitle.trim() ? "pointer" : "default", fontWeight: 700, fontSize: "0.78rem" }}
                >
                  Insert Custom Box
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ position: "relative", display: "inline-block" }} onClick={(e) => e.stopPropagation()}>
          <Btn title="Insert Table" onClick={() => { setShowTableModal(p => !p); setShowColorPicker(false); setShowHighlightPicker(false); setShowCalloutPicker(false); }}>
            <span style={{ fontSize: "0.68rem" }}>⊞ Table</span>
          </Btn>
          {showTableModal && (
            <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, boxShadow: "0 6px 20px rgba(0,0,0,.14)", minWidth: 170 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 8 }}>Insert Table</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: "0.72rem", color: "#6b7280", width: 34 }}>Rows</label>
                <input type="number" min="1" max="20" value={tableRows} onChange={e => setTableRows(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ width: 50, border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 6px", fontSize: "0.8rem" }} />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: "0.72rem", color: "#6b7280", width: 34 }}>Cols</label>
                <input type="number" min="1" max="10" value={tableCols} onChange={e => setTableCols(e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  style={{ width: 50, border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 6px", fontSize: "0.8rem" }} />
              </div>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTable(); }}
                style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, padding: "4px 0", fontSize: "0.75rem", cursor: "pointer", width: "100%", fontWeight: 600 }}>
                Insert
              </button>
            </div>
          )}
        </div>

        {/* Image */}
        <Btn title="Insert Image (URL)" onClick={insertImage}><span style={{ fontSize: "0.68rem" }}>🖼 Img</span></Btn>

        {/* Divider */}
        <Btn title="Insert Divider" onClick={() => insertHTML("<hr style='border:none;border-top:2px solid #e5e7eb;margin:16px 0;'/><p><br></p>")}>
          <span style={{ fontSize: "0.68rem" }}>— Div</span>
        </Btn>

        <div style={{ flex: 1 }} />

        {/* Preview */}
        <Btn title="Toggle Preview" on={preview} onClick={() => { emitNow(); setPreview(p => !p); }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 600 }}>{preview ? "✏ Edit" : "👁 Preview"}</span>
        </Btn>
      </div>

      {/* ── Editor / Preview area ── */}
      {preview ? (
        <div
          className="rte-preview"
          style={{ minHeight, padding: "14px 16px", fontSize: "0.9rem", lineHeight: 1.7, color: "#1f2937", overflowY: "auto" }}
          dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML || value || "" }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emitNow}
          onKeyDown={handleKeyDown}
          data-placeholder={placeholder}
          style={{ minHeight, padding: "14px 16px", outline: "none", fontSize: "0.9rem", lineHeight: 1.7, color: "#1f2937", overflowY: "auto" }}
          onClick={() => closeAll()}
        />
      )}

      {/* ── Global styles for both edit and preview ── */}
      <style>{`
        /* Empty editor placeholder */
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }

        /* Callout body placeholder — shows when body only contains <br> */
        [data-callout-body]:has(> br:only-child)::before {
          content: attr(data-ph);
          color: #9ca3af;
          font-style: italic;
          pointer-events: none;
          display: block;
          margin: 0;
        }

        /* Heading / block styles (both edit and preview) */
        [contenteditable] h1, .rte-preview h1 { font-size: 1.5rem; font-weight: 700; margin: 12px 0 8px; line-height: 1.3; }
        [contenteditable] h2, .rte-preview h2 { font-size: 1.25rem; font-weight: 600; margin: 10px 0 6px; line-height: 1.35; }
        [contenteditable] h3, .rte-preview h3 { font-size: 1.05rem; font-weight: 600; margin: 8px 0 4px; }
        [contenteditable] blockquote, .rte-preview blockquote { border-left: 4px solid #d1d5db; margin: 10px 0; padding: 6px 14px; color: #6b7280; font-style: italic; background: #fafafa; border-radius: 0 6px 6px 0; }
        [contenteditable] ul, .rte-preview ul { padding-left: 24px; margin: 6px 0; }
        [contenteditable] ol, .rte-preview ol { padding-left: 24px; margin: 6px 0; }
        [contenteditable] table, .rte-preview table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        [contenteditable] th, .rte-preview th { border: 1.5px solid #d1d5db; padding: 6px 10px; background: #f3f4f6; font-weight: 600; text-align: left; }
        [contenteditable] td, .rte-preview td { border: 1.5px solid #d1d5db; padding: 6px 10px; }
        [contenteditable] hr, .rte-preview hr { border: none; border-top: 2px solid #e5e7eb; margin: 16px 0; }
        [contenteditable] img, .rte-preview img { max-width: 100%; border-radius: 6px; }
        [contenteditable] p, .rte-preview p { margin: 4px 0; }

        /* Callout box styles (edit + preview) */
        [contenteditable] [data-callout], .rte-preview [data-callout] { user-select: text; }
        [contenteditable] [data-callout-header], .rte-preview [data-callout-header] { user-select: text; }
        [contenteditable] [data-callout-body], .rte-preview [data-callout-body] { user-select: text; }
      `}</style>
    </div>
  );
}
