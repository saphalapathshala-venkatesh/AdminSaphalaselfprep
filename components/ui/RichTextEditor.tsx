"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  label?: string;
}

const TOOLBAR_BTN: React.CSSProperties = {
  padding: "3px 7px",
  fontSize: "0.78rem",
  fontFamily: "inherit",
  background: "none",
  border: "1px solid transparent",
  borderRadius: "4px",
  cursor: "pointer",
  color: "#374151",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 28,
  height: 26,
  transition: "background 0.12s, border-color 0.12s",
};

const TOOLBAR_BTN_ACTIVE: React.CSSProperties = {
  ...TOOLBAR_BTN,
  background: "#ede9fe",
  borderColor: "#c4b5fd",
  color: "#7c3aed",
};

const SEP: React.CSSProperties = {
  width: 1,
  height: 20,
  background: "#e5e7eb",
  margin: "0 3px",
  display: "inline-block",
  verticalAlign: "middle",
};

const COLORS = ["#111827", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#7c3aed", "#6b7280"];
const HIGHLIGHTS = ["#fef9c3", "#dcfce7", "#dbeafe", "#fce7f3", "#fff7ed", "transparent"];

export default function RichTextEditor({ value, onChange, placeholder = "Write content here…", minHeight = "240px" }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableRows, setTableRows] = useState("3");
  const [tableCols, setTableCols] = useState("3");
  const initialized = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = value || "";
      initialized.current = true;
    }
  }, [value]);

  const emit = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val ?? undefined);
    emit();
  }, [emit]);

  const insertHTML = useCallback((html: string) => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  }, [emit]);

  const insertBlock = useCallback((tag: string) => {
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, tag);
    emit();
  }, [emit]);

  const insertTable = useCallback(() => {
    const r = parseInt(tableRows) || 3;
    const c = parseInt(tableCols) || 3;
    let html = `<table style="border-collapse:collapse;width:100%;margin:12px 0;"><thead><tr>`;
    for (let j = 0; j < c; j++) html += `<th style="border:1.5px solid #d1d5db;padding:6px 10px;background:#f3f4f6;text-align:left;font-size:0.8125rem;">Header ${j + 1}</th>`;
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < r - 1; i++) {
      html += `<tr>`;
      for (let j = 0; j < c; j++) html += `<td style="border:1.5px solid #d1d5db;padding:6px 10px;font-size:0.8125rem;">Cell</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table><p><br></p>`;
    insertHTML(html);
    setShowTableModal(false);
  }, [tableRows, tableCols, insertHTML]);

  const insertNoteBox = useCallback((type: "info" | "warning" | "tip") => {
    const cfg = {
      info:    { bg: "#eff6ff", border: "#bfdbfe", icon: "ℹ️", label: "Note" },
      warning: { bg: "#fffbeb", border: "#fde68a", icon: "⚠️", label: "Warning" },
      tip:     { bg: "#f0fdf4", border: "#bbf7d0", icon: "💡", label: "Tip" },
    }[type];
    const html = `<div style="background:${cfg.bg};border-left:4px solid ${cfg.border};border-radius:0 6px 6px 0;padding:10px 14px;margin:12px 0;font-size:0.875rem;"><strong>${cfg.icon} ${cfg.label}:</strong> Write your note here.</div><p><br></p>`;
    insertHTML(html);
  }, [insertHTML]);

  const insertImage = useCallback(() => {
    const url = prompt("Enter image URL:");
    if (url) insertHTML(`<img src="${url}" style="max-width:100%;border-radius:6px;margin:8px 0;" alt="Image" /><p><br></p>`);
  }, [insertHTML]);

  const toolbarSection = (children: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: "1px", flexWrap: "wrap" }}>{children}</div>
  );

  const Btn = ({ title, onClick, children, active }: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean }) => (
    <button
      title={title}
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={active ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#f3f4f6"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
      {/* Toolbar */}
      <div style={{ borderBottom: "1px solid #e5e7eb", padding: "4px 6px", background: "#fafafa", display: "flex", gap: "2px", flexWrap: "wrap", alignItems: "center" }}>
        {toolbarSection(<>
          <Btn title="Bold (Ctrl+B)" onClick={() => exec("bold")}><b>B</b></Btn>
          <Btn title="Italic (Ctrl+I)" onClick={() => exec("italic")}><i>I</i></Btn>
          <Btn title="Underline (Ctrl+U)" onClick={() => exec("underline")}><u>U</u></Btn>
        </>)}
        <div style={SEP} />
        {toolbarSection(<>
          <Btn title="Heading 1" onClick={() => insertBlock("h1")} ><span style={{ fontWeight: 700, fontSize: "0.72rem" }}>H1</span></Btn>
          <Btn title="Heading 2" onClick={() => insertBlock("h2")}><span style={{ fontWeight: 700, fontSize: "0.72rem" }}>H2</span></Btn>
          <Btn title="Heading 3" onClick={() => insertBlock("h3")}><span style={{ fontWeight: 700, fontSize: "0.72rem" }}>H3</span></Btn>
          <Btn title="Paragraph" onClick={() => insertBlock("p")}><span style={{ fontSize: "0.72rem" }}>P</span></Btn>
        </>)}
        <div style={SEP} />
        {toolbarSection(<>
          <Btn title="Bullet List" onClick={() => exec("insertUnorderedList")}>&#8226;&#8211;</Btn>
          <Btn title="Numbered List" onClick={() => exec("insertOrderedList")}>1&#8211;</Btn>
          <Btn title="Blockquote" onClick={() => insertBlock("blockquote")}><span style={{ fontSize: "0.9rem" }}>&ldquo;</span></Btn>
        </>)}
        <div style={SEP} />
        {/* Text Color */}
        <div style={{ position: "relative", display: "inline-block" }}>
          <Btn title="Text Color" onClick={() => { setShowColorPicker(p => !p); setShowHighlightPicker(false); }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>A</span>
            <span style={{ display: "block", width: 12, height: 3, background: "#ef4444", marginTop: 1, borderRadius: 1 }} />
          </Btn>
          {showColorPicker && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 6, display: "flex", gap: 4, boxShadow: "0 4px 12px rgba(0,0,0,.12)" }}>
              {COLORS.map(c => (
                <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c); setShowColorPicker(false); }}
                  style={{ width: 18, height: 18, background: c, border: c === "#111827" ? "1px solid #d1d5db" : "none", borderRadius: 3, cursor: "pointer" }} />
              ))}
            </div>
          )}
        </div>
        {/* Highlight */}
        <div style={{ position: "relative", display: "inline-block" }}>
          <Btn title="Highlight" onClick={() => { setShowHighlightPicker(p => !p); setShowColorPicker(false); }}>
            <span style={{ fontSize: "0.72rem", background: "#fef9c3", padding: "0 2px" }}>HL</span>
          </Btn>
          {showHighlightPicker && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, padding: 6, display: "flex", gap: 4, boxShadow: "0 4px 12px rgba(0,0,0,.12)" }}>
              {HIGHLIGHTS.map(c => (
                <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); exec("backColor", c === "transparent" ? "inherit" : c); setShowHighlightPicker(false); }}
                  style={{ width: 18, height: 18, background: c === "transparent" ? "#fff" : c, border: "1px solid #d1d5db", borderRadius: 3, cursor: "pointer", fontSize: c === "transparent" ? "0.6rem" : undefined }} >
                  {c === "transparent" ? "✕" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={SEP} />
        {/* Note boxes */}
        {toolbarSection(<>
          <Btn title="Info Note Box" onClick={() => insertNoteBox("info")}><span style={{ fontSize: "0.68rem" }}>ℹ Note</span></Btn>
          <Btn title="Warning Box" onClick={() => insertNoteBox("warning")}><span style={{ fontSize: "0.68rem" }}>⚠ Warn</span></Btn>
          <Btn title="Tip Box" onClick={() => insertNoteBox("tip")}><span style={{ fontSize: "0.68rem" }}>💡 Tip</span></Btn>
        </>)}
        <div style={SEP} />
        {/* Table */}
        <div style={{ position: "relative", display: "inline-block" }}>
          <Btn title="Insert Table" onClick={() => setShowTableModal(p => !p)}><span style={{ fontSize: "0.68rem" }}>⊞ Table</span></Btn>
          {showTableModal && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, boxShadow: "0 4px 12px rgba(0,0,0,.12)", minWidth: 170 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, marginBottom: 8 }}>Insert Table</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: "0.72rem", color: "#6b7280", width: 40 }}>Rows</label>
                <input type="number" min="1" max="20" value={tableRows} onChange={e => setTableRows(e.target.value)}
                  style={{ width: 50, border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 6px", fontSize: "0.8rem" }} />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                <label style={{ fontSize: "0.72rem", color: "#6b7280", width: 40 }}>Cols</label>
                <input type="number" min="1" max="10" value={tableCols} onChange={e => setTableCols(e.target.value)}
                  style={{ width: 50, border: "1px solid #d1d5db", borderRadius: 4, padding: "2px 6px", fontSize: "0.8rem" }} />
              </div>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTable(); }}
                style={{ background: "#7c3aed", color: "#fff", border: "none", borderRadius: 5, padding: "4px 12px", fontSize: "0.75rem", cursor: "pointer", width: "100%" }}>
                Insert
              </button>
            </div>
          )}
        </div>
        {/* Image */}
        <Btn title="Insert Image" onClick={insertImage}><span style={{ fontSize: "0.68rem" }}>🖼 Img</span></Btn>
        {/* Divider */}
        <Btn title="Insert Divider" onClick={() => insertHTML("<hr style='border:none;border-top:2px solid #e5e7eb;margin:16px 0;'/><p><br></p>")}><span style={{ fontSize: "0.68rem" }}>— Div</span></Btn>
        <div style={{ flex: 1 }} />
        {/* Preview toggle */}
        <Btn title="Toggle Preview" onClick={() => { emit(); setPreview(p => !p); }} active={preview}>
          <span style={{ fontSize: "0.68rem", fontWeight: 600 }}>{preview ? "✏ Edit" : "👁 Preview"}</span>
        </Btn>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          style={{ minHeight, padding: "14px 16px", fontSize: "0.9rem", lineHeight: 1.7, color: "#1f2937", overflowY: "auto" }}
          dangerouslySetInnerHTML={{ __html: editorRef.current?.innerHTML || value || "" }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          data-placeholder={placeholder}
          style={{
            minHeight,
            padding: "14px 16px",
            outline: "none",
            fontSize: "0.9rem",
            lineHeight: 1.7,
            color: "#1f2937",
            overflowY: "auto",
          }}
          onClick={() => { setShowColorPicker(false); setShowHighlightPicker(false); setShowTableModal(false); }}
        />
      )}

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 1.5rem; font-weight: 700; margin: 12px 0 8px; }
        [contenteditable] h2 { font-size: 1.25rem; font-weight: 600; margin: 10px 0 6px; }
        [contenteditable] h3 { font-size: 1.05rem; font-weight: 600; margin: 8px 0 4px; }
        [contenteditable] blockquote { border-left: 4px solid #d1d5db; margin: 10px 0; padding: 6px 14px; color: #6b7280; font-style: italic; }
        [contenteditable] ul { padding-left: 24px; }
        [contenteditable] ol { padding-left: 24px; }
        [contenteditable] table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        [contenteditable] th, [contenteditable] td { border: 1.5px solid #d1d5db; padding: 6px 10px; }
        [contenteditable] th { background: #f3f4f6; font-weight: 600; }
        [contenteditable] hr { border: none; border-top: 2px solid #e5e7eb; margin: 16px 0; }
        [contenteditable] img { max-width: 100%; border-radius: 6px; }
      `}</style>
    </div>
  );
}
