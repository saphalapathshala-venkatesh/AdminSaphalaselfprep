"use client";

/**
 * BlockEditor — shared structured block editor.
 *
 * Props
 * ─────
 *   doc         BlockDoc value (controlled)
 *   onChange    called with updated BlockDoc on every change
 *   config      "ebook" | "flashcard"  (controls which block types are shown)
 *   disabled    disables all editing (e.g. while saving)
 *   label       optional section label
 *
 * Used by:
 *   - admin/content-library  (ebook pages, config="ebook")
 *   - admin/flashcards       (INFO card body, config="flashcard")
 */

import React, { useRef, useCallback, useState } from "react";
import { Block, BlockDoc, BlockType, BOX_PRESETS, emptyDoc } from "@/lib/blocks/schema";
import { createBlock, createTableBlock, moveBlock, removeBlock } from "@/lib/blocks/defaults";
import AdminImageUploader from "@/components/admin/AdminImageUploader";

// ─── Inline text editor (contentEditable with minimal toolbar) ───────────────

interface InlineEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  singleLine?: boolean;
}

function InlineEditor({ value, onChange, placeholder = "Type here…", style, disabled, singleLine }: InlineEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef(value);

  const handleInput = useCallback(() => {
    const html = ref.current?.innerHTML ?? "";
    if (html !== lastHtml.current) {
      lastHtml.current = html;
      onChange(html);
    }
  }, [onChange]);

  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
      lastHtml.current = value;
    }
  }, [value]);

  const execCmd = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  return (
    <div>
      {!singleLine && (
        <div style={{ display: "flex", gap: 2, marginBottom: 4, flexWrap: "wrap" }}>
          {[
            { cmd: "bold", label: <strong>B</strong> },
            { cmd: "italic", label: <em>I</em> },
            { cmd: "underline", label: <u>U</u> },
            { cmd: "strikeThrough", label: <s>S</s> },
          ].map(({ cmd, label }) => (
            <button
              key={cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execCmd(cmd); }}
              disabled={disabled}
              style={{
                padding: "2px 7px", fontSize: "0.78rem", border: "1px solid #e2e8f0",
                borderRadius: 4, background: "#f8fafc", cursor: disabled ? "not-allowed" : "pointer",
                fontFamily: "inherit", color: "#374151",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
        style={{
          minHeight: singleLine ? "2rem" : "3.5rem",
          padding: "0.4rem 0.6rem",
          border: "1px solid #e2e8f0",
          borderRadius: 6,
          fontSize: "0.875rem",
          outline: "none",
          background: disabled ? "#f8fafc" : "#fff",
          lineHeight: 1.6,
          color: "#1f2937",
          wordBreak: "break-word",
          ...style,
        }}
      />
      <style>{`[data-placeholder]:empty::before{content:attr(data-placeholder);color:#9ca3af;pointer-events:none}`}</style>
    </div>
  );
}

// ─── Config ───────────────────────────────────────────────────────────────────

type EditorConfig = "ebook" | "flashcard";

const EBOOK_BLOCK_TYPES: BlockType[] = ["paragraph", "heading", "image", "box", "table", "list", "divider"];
const FLASH_BLOCK_TYPES: BlockType[] = ["paragraph", "heading", "image", "box", "table", "list", "divider"];

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "¶ Paragraph",
  heading:   "H Heading",
  image:     "🖼 Image",
  box:       "📦 Box",
  table:     "⊞ Table",
  list:      "• List",
  divider:   "─ Divider",
};

// ─── Text colour palette (fixed list — no free-form RGB picker) ──────────────

const TEXT_PALETTE: { name: string; hex: string }[] = [
  { name: "Red",       hex: "#dc2626" },
  { name: "Crimson",   hex: "#991b1b" },
  { name: "Orange",    hex: "#ea580c" },
  { name: "Amber",     hex: "#b45309" },
  { name: "Green",     hex: "#16a34a" },
  { name: "Deep Teal", hex: "#0f766e" },
  { name: "Deep Blue", hex: "#1d4ed8" },
  { name: "Navy",      hex: "#1e3a5f" },
  { name: "Purple",    hex: "#7c3aed" },
  { name: "Pink",      hex: "#db2777" },
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const PURPLE = "#7c3aed";
const inp: React.CSSProperties = {
  width: "100%", padding: "0.4rem 0.6rem", border: "1px solid #e2e8f0",
  borderRadius: 6, fontSize: "0.8125rem", outline: "none",
  background: "#fff", boxSizing: "border-box", fontFamily: "inherit",
};
const labelSt: React.CSSProperties = {
  fontSize: "0.75rem", fontWeight: 600, color: "#6b7280",
  display: "block", marginBottom: "0.25rem",
};
const rowSt: React.CSSProperties = {
  display: "flex", gap: 6, alignItems: "center", marginBottom: 4,
};
const iconBtn = (color = "#6b7280"): React.CSSProperties => ({
  padding: "2px 6px", fontSize: "0.75rem", border: "1px solid #e2e8f0",
  borderRadius: 4, background: "#f8fafc", cursor: "pointer",
  color, fontFamily: "inherit", flexShrink: 0,
});

// ─── Block editing panels ─────────────────────────────────────────────────────

interface BlockPanelProps {
  block: Block;
  onChange: (updated: Block) => void;
  disabled?: boolean;
  config: EditorConfig;
}

/**
 * Compact palette swatch row.
 * Uses onMouseDown + preventDefault so the contentEditable selection stays
 * active when the button is clicked — then execCommand applies the colour
 * only to the selected text, exactly like the bold/italic toolbar buttons.
 */
function TextColorPalette({ disabled }: { disabled?: boolean }) {
  function applyColor(hex: string | null) {
    if (disabled) return;
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    if (hex) {
      document.execCommand("foreColor", false, hex);
    } else {
      document.execCommand("removeFormat");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>
        Text colour:
      </span>
      {/* ✕ = remove colour from selection */}
      <button
        type="button"
        title="Remove colour"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyColor(null)}
        disabled={disabled}
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "1.5px solid #d1d5db",
          background: "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "#9ca3af",
          padding: 0,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
      {TEXT_PALETTE.map(({ name, hex }) => (
        <button
          key={hex}
          type="button"
          title={name}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyColor(hex)}
          disabled={disabled}
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: hex,
            border: "2px solid transparent",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 0,
            flexShrink: 0,
            opacity: disabled ? 0.5 : 1,
          }}
        />
      ))}
    </div>
  );
}

function ParagraphPanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "paragraph") return null;
  const p = block.props;
  return (
    <div>
      <InlineEditor
        value={p.html}
        onChange={(html) => onChange({ ...block, props: { ...p, html } })}
        placeholder="Paragraph text…"
        disabled={disabled}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange({ ...block, props: { ...p, align: a } })}
            style={{
              ...iconBtn(p.align === a ? PURPLE : "#6b7280"),
              background: p.align === a ? "#ede9fe" : "#f8fafc",
              borderColor: p.align === a ? PURPLE : "#e2e8f0",
            }}
          >
            {a === "left" ? "⇐" : a === "center" ? "⇔" : "⇒"}
          </button>
        ))}
      </div>
      <TextColorPalette disabled={disabled} />
    </div>
  );
}

function HeadingPanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "heading") return null;
  const p = block.props;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        {([1, 2, 3] as const).map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => onChange({ ...block, props: { ...p, level: lv } })}
            style={{
              ...iconBtn(p.level === lv ? PURPLE : "#6b7280"),
              background: p.level === lv ? "#ede9fe" : "#f8fafc",
              borderColor: p.level === lv ? PURPLE : "#e2e8f0",
              fontWeight: 700,
            }}
          >
            H{lv}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange({ ...block, props: { ...p, align: a } })}
            style={{
              ...iconBtn(p.align === a ? PURPLE : "#6b7280"),
              background: p.align === a ? "#ede9fe" : "#f8fafc",
              borderColor: p.align === a ? PURPLE : "#e2e8f0",
            }}
          >
            {a === "left" ? "⇐" : a === "center" ? "⇔" : "⇒"}
          </button>
        ))}
      </div>
      <InlineEditor
        value={p.html}
        onChange={(html) => onChange({ ...block, props: { ...p, html } })}
        placeholder="Heading text…"
        disabled={disabled}
        singleLine
        style={{ fontWeight: 700, fontSize: p.level === 1 ? "1.2rem" : p.level === 2 ? "1rem" : "0.9rem" }}
      />
    </div>
  );
}

function ImagePanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "image") return null;
  const p = block.props;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <AdminImageUploader
        label="Image"
        value={p.src || null}
        onChange={(url) => onChange({ ...block, props: { ...p, src: url || "" } })}
        disabled={disabled}
        previewHeight={100}
        base64
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={labelSt}>Width</label>
          <select
            value={p.width ?? "100%"}
            onChange={(e) => onChange({ ...block, props: { ...p, width: e.target.value as any } })}
            style={inp}
            disabled={disabled}
          >
            <option value="25%">25%</option>
            <option value="50%">50%</option>
            <option value="75%">75%</option>
            <option value="100%">Full</option>
          </select>
        </div>
        <div>
          <label style={labelSt}>Align</label>
          <select
            value={p.align ?? "center"}
            onChange={(e) => onChange({ ...block, props: { ...p, align: e.target.value as any } })}
            style={inp}
            disabled={disabled}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
      <div>
        <label style={labelSt}>Alt text</label>
        <input
          value={p.alt ?? ""}
          onChange={(e) => onChange({ ...block, props: { ...p, alt: e.target.value } })}
          style={inp}
          placeholder="Image description for accessibility"
          disabled={disabled}
        />
      </div>
      <div>
        <label style={labelSt}>Caption (optional)</label>
        <input
          value={p.caption ?? ""}
          onChange={(e) => onChange({ ...block, props: { ...p, caption: e.target.value } })}
          style={inp}
          placeholder="Caption shown below image"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/** Returns a contrasting text colour (#fff or #111) for a given hex background. */
function contrastColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 0.55 ? "#111111" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

/** Compact color picker row: native color swatch + hex text input side by side. */
function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 130 }}>
      <label style={{ ...labelSt, marginBottom: 2 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: 28,
            height: 28,
            border: "1px solid #d1d5db",
            borderRadius: 5,
            padding: 1,
            cursor: disabled ? "not-allowed" : "pointer",
            background: "none",
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          disabled={disabled}
          maxLength={7}
          style={{ ...inp, width: 76, fontFamily: "monospace", fontSize: "0.78rem" }}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function BoxPanel({ block, onChange, disabled, config }: BlockPanelProps) {
  if (block.type !== "box") return null;
  const p = block.props;
  const meta = BOX_PRESETS.find((m) => m.key === p.preset) ?? BOX_PRESETS[0];
  const isCustom = p.preset === "custom";

  const setChildren = (children: Block[]) =>
    onChange({ ...block, props: { ...p, children } });

  const setProp = (patch: Partial<typeof p>) =>
    onChange({ ...block, props: { ...p, ...patch } });

  const resolvedHeaderBg   = p.headerBg       ?? meta.headerBg;
  const resolvedHeaderText = p.headerTextColor ?? "#fff";
  const resolvedBodyBg     = p.bodyBg          ?? meta.bodyBg;
  const resolvedBorder     = p.borderColor     ?? p.accent ?? meta.accent;
  const resolvedIcon       = p.customIcon      ?? meta.icon;

  return (
    <div>
      {/* ── Type + Header text row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={labelSt}>Box type</label>
          <select
            value={p.preset}
            onChange={(e) => {
              const nm = BOX_PRESETS.find((m) => m.key === e.target.value) ?? BOX_PRESETS[0];
              const isNewCustom = nm.key === "custom";
              onChange({
                ...block,
                props: {
                  ...p,
                  preset: nm.key,
                  title: isNewCustom ? (p.title ?? "CUSTOM") : nm.label,
                  headerBg:       isNewCustom ? (p.headerBg       ?? nm.headerBg)    : nm.headerBg,
                  headerTextColor: isNewCustom ? (p.headerTextColor ?? "#ffffff")     : undefined,
                  bodyBg:         isNewCustom ? (p.bodyBg          ?? nm.bodyBg)     : nm.bodyBg,
                  borderColor:    isNewCustom ? (p.borderColor     ?? nm.accent)     : undefined,
                  customIcon:     isNewCustom ? (p.customIcon      ?? nm.icon)       : undefined,
                  accent: nm.accent,
                },
              });
            }}
            style={inp}
            disabled={disabled}
          >
            {BOX_PRESETS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelSt}>Header text</label>
          <input
            value={p.title ?? meta.label}
            onChange={(e) => setProp({ title: e.target.value })}
            style={inp}
            disabled={disabled}
          />
        </div>
      </div>

      {/* ── CUSTOM-only colour controls ── */}
      {isCustom && (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: PURPLE,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Custom Style
          </div>

          {/* Icon + auto-contrast hint */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ ...labelSt, marginBottom: 2 }}>Icon / emoji</label>
              <input
                value={p.customIcon ?? meta.icon}
                onChange={(e) => setProp({ customIcon: e.target.value })}
                style={{ ...inp, width: "100%" }}
                disabled={disabled}
                placeholder="📌"
                maxLength={10}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setProp({
                  headerTextColor: contrastColor(resolvedHeaderBg),
                });
              }}
              style={{
                padding: "5px 10px",
                fontSize: "0.72rem",
                background: "#ede9fe",
                color: PURPLE,
                border: `1px solid ${PURPLE}`,
                borderRadius: 6,
                cursor: disabled ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                fontFamily: "inherit",
                fontWeight: 600,
                marginBottom: 1,
              }}
              title="Auto-pick a contrasting text colour for the header"
            >
              Auto contrast
            </button>
          </div>

          {/* Colour pickers — two per row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <ColorField
              label="Header background"
              value={resolvedHeaderBg}
              onChange={(v) => setProp({ headerBg: v, headerTextColor: p.headerTextColor ?? contrastColor(v) })}
              disabled={disabled}
            />
            <ColorField
              label="Header text colour"
              value={resolvedHeaderText}
              onChange={(v) => setProp({ headerTextColor: v })}
              disabled={disabled}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <ColorField
              label="Body background"
              value={resolvedBodyBg}
              onChange={(v) => setProp({ bodyBg: v })}
              disabled={disabled}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ColorField
              label="Border colour"
              value={resolvedBorder}
              onChange={(v) => setProp({ borderColor: v })}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* ── Live preview ── */}
      <div
        style={{
          borderRadius: 8,
          overflow: "hidden",
          border: `1.5px solid ${resolvedBorder}`,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            background: resolvedHeaderBg,
            padding: "5px 12px",
            color: resolvedHeaderText,
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.07em",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {resolvedIcon} {p.title ?? meta.label}
        </div>
        <div style={{ padding: 10, background: resolvedBodyBg }}>
          <NestedBlockEditor
            blocks={p.children ?? []}
            onChange={setChildren}
            disabled={disabled}
            config={config}
            depth={1}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Compact format bar for table cells.
 * Uses onMouseDown + preventDefault so the contentEditable selection in the
 * focused cell stays alive, then execCommand applies the format/alignment.
 */
function TableFormatBar({ disabled }: { disabled?: boolean }) {
  const exec = (cmd: string) => {
    if (disabled) return;
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand(cmd, false, undefined);
  };

  const fmtBtns = [
    { cmd: "bold",      label: <strong>B</strong>, title: "Bold" },
    { cmd: "italic",    label: <em>I</em>,           title: "Italic" },
    { cmd: "underline", label: <u>U</u>,             title: "Underline" },
  ];

  const alignBtns = [
    { cmd: "justifyLeft",   label: "⇐", title: "Align left" },
    { cmd: "justifyCenter", label: "⇔", title: "Align center" },
    { cmd: "justifyRight",  label: "⇒", title: "Align right" },
  ];

  const btnSt: React.CSSProperties = {
    padding: "2px 7px", fontSize: "0.78rem", border: "1px solid #e2e8f0",
    borderRadius: 4, background: "#f8fafc", cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit", color: "#374151", flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 2 }}>
        Format:
      </span>
      {fmtBtns.map(({ cmd, label, title }) => (
        <button
          key={cmd}
          type="button"
          title={title}
          onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
          disabled={disabled}
          style={btnSt}
        >
          {label}
        </button>
      ))}
      <span style={{ width: 1, height: 16, background: "#e2e8f0", margin: "0 3px" }} />
      {alignBtns.map(({ cmd, label, title }) => (
        <button
          key={cmd}
          type="button"
          title={title}
          onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
          disabled={disabled}
          style={btnSt}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TablePanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "table") return null;
  const p = block.props;

  const setProp = (patch: Partial<typeof p>) => onChange({ ...block, props: { ...p, ...patch } });
  const setHeaders = (headers: string[]) => setProp({ headers });
  const setRows = (rows: string[][]) => setProp({ rows });

  const addRow = () => setRows([...p.rows, Array(p.headers.length).fill("")]);
  const addCol = () => {
    setHeaders([...p.headers, `Col ${p.headers.length + 1}`]);
    setRows(p.rows.map((r) => [...r, ""]));
  };
  const removeRow = (ri: number) => setRows(p.rows.filter((_, i) => i !== ri));
  const removeCol = (ci: number) => {
    setHeaders(p.headers.filter((_, i) => i !== ci));
    setRows(p.rows.map((r) => r.filter((_, i) => i !== ci)));
  };

  const hBg   = p.headerBg        ?? "#f3f4f6";
  const hText = p.headerTextColor  ?? "#374151";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={addRow} style={iconBtn()} disabled={disabled}>+ Row</button>
        <button type="button" onClick={addCol} style={iconBtn()} disabled={disabled}>+ Column</button>
        <div style={{ flex: 1 }} />
        <label style={{ ...labelSt, marginBottom: 0, display: "flex", alignItems: "center", gap: 6 }}>
          Width:
          <select
            value={p.width ?? "full"}
            onChange={(e) => onChange({ ...block, props: { ...p, width: e.target.value as any } })}
            style={{ ...inp, width: 100 }}
            disabled={disabled}
          >
            <option value="full">Full</option>
            <option value="wide">Wide</option>
            <option value="medium">Medium</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>

      {/* ── Header row colour + inline text-colour palette ──────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
        <ColorField
          label="Header background"
          value={hBg}
          onChange={(v) => setProp({ headerBg: v, headerTextColor: p.headerTextColor ?? contrastColor(v) })}
          disabled={disabled}
        />
        <ColorField
          label="Header text colour"
          value={hText}
          onChange={(v) => setProp({ headerTextColor: v })}
          disabled={disabled}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 2 }}>
          <button
            type="button"
            title="Reset header colours to default"
            onClick={() => setProp({ headerBg: undefined, headerTextColor: undefined })}
            style={{ ...iconBtn(), fontSize: "0.72rem", whiteSpace: "nowrap" }}
            disabled={disabled}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* ── Format bar + text-colour palette (work on selected text in any cell) ── */}
      <TableFormatBar disabled={disabled} />
      <TextColorPalette disabled={disabled} />

      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
          <thead>
            <tr>
              {p.headers.map((h, ci) => (
                <th
                  key={ci}
                  style={{ border: "1px solid #d1d5db", padding: 2, background: hBg, minWidth: 100, verticalAlign: "top" }}
                >
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <InlineEditor
                        value={h}
                        onChange={(html) => {
                          const nh = [...p.headers];
                          nh[ci] = html;
                          setHeaders(nh);
                        }}
                        singleLine
                        placeholder={`Col ${ci + 1}`}
                        style={{
                          minHeight: "1.6rem",
                          padding: "2px 5px",
                          borderRadius: 3,
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: hText,
                          background: "transparent",
                          border: "1px solid rgba(0,0,0,0.12)",
                        }}
                        disabled={disabled}
                      />
                    </div>
                    {p.headers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCol(ci)}
                        style={{ ...iconBtn("#dc2626"), padding: "1px 4px", fontSize: "0.7rem", marginTop: 1 }}
                        disabled={disabled}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{ border: "1px solid #d1d5db", padding: 2, background: ri % 2 === 0 ? "#fff" : "#f9fafb", verticalAlign: "top" }}
                  >
                    <InlineEditor
                      value={cell}
                      onChange={(html) => {
                        const nr = p.rows.map((r, r2) =>
                          r2 === ri ? r.map((c, c2) => (c2 === ci ? html : c)) : r
                        );
                        setRows(nr);
                      }}
                      singleLine
                      placeholder=""
                      style={{
                        minHeight: "1.6rem",
                        padding: "2px 5px",
                        borderRadius: 3,
                        fontSize: "0.8rem",
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "transparent",
                      }}
                      disabled={disabled}
                    />
                  </td>
                ))}
                {p.rows.length > 1 && (
                  <td style={{ border: "none", padding: 2, verticalAlign: "top" }}>
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      style={{ ...iconBtn("#dc2626"), padding: "1px 4px", fontSize: "0.7rem" }}
                      disabled={disabled}
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8 }}>
        <label style={labelSt}>Caption (optional)</label>
        <input
          value={p.caption ?? ""}
          onChange={(e) => onChange({ ...block, props: { ...p, caption: e.target.value } })}
          style={inp}
          placeholder="Table caption"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function ListPanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "list") return null;
  const p = block.props;

  const setItems = (items: string[]) => onChange({ ...block, props: { ...p, items } });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {([false, true] as const).map((ord) => (
          <button
            key={String(ord)}
            type="button"
            onClick={() => onChange({ ...block, props: { ...p, ordered: ord } })}
            style={{
              ...iconBtn(p.ordered === ord ? PURPLE : "#6b7280"),
              background: p.ordered === ord ? "#ede9fe" : "#f8fafc",
              borderColor: p.ordered === ord ? PURPLE : "#e2e8f0",
            }}
            disabled={disabled}
          >
            {ord ? "1. Numbered" : "• Bullets"}
          </button>
        ))}
      </div>
      {p.items.map((item, i) => (
        <div key={i} style={rowSt}>
          <span style={{ fontSize: "0.8rem", color: "#9ca3af", flexShrink: 0, width: 18 }}>
            {p.ordered ? `${i + 1}.` : "•"}
          </span>
          <InlineEditor
            value={item}
            onChange={(html) => {
              const ni = [...p.items];
              ni[i] = html;
              setItems(ni);
            }}
            placeholder={`Item ${i + 1}`}
            disabled={disabled}
            singleLine
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => setItems(p.items.filter((_, j) => j !== i))}
            style={{ ...iconBtn("#dc2626"), visibility: p.items.length > 1 ? "visible" : "hidden" }}
            disabled={disabled}
          >
            ✕
          </button>
          <button
            type="button"
            onClick={() => { const ni = [...p.items]; ni.splice(i, 0, ni[i]); setItems(ni); }}
            style={iconBtn()}
            title="Duplicate item"
            disabled={disabled}
          >
            ⧉
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems([...p.items, ""])}
        style={{ ...iconBtn(PURPLE), marginTop: 4, padding: "4px 10px" }}
        disabled={disabled}
      >
        + Add item
      </button>
    </div>
  );
}

function DividerPanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "divider") return null;
  const p = block.props;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <label style={{ ...labelSt, marginBottom: 0 }}>Style:</label>
      {(["solid", "dashed", "dotted"] as const).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange({ ...block, props: { style: s } })}
          style={{
            ...iconBtn(p.style === s ? PURPLE : "#6b7280"),
            background: p.style === s ? "#ede9fe" : "#f8fafc",
            borderColor: p.style === s ? PURPLE : "#e2e8f0",
          }}
          disabled={disabled}
        >
          {s}
        </button>
      ))}
      <hr style={{ flex: 1, borderTop: `2px ${p.style ?? "solid"} #e5e7eb`, border: "none", borderTopStyle: p.style ?? "solid", borderTopWidth: 2, borderTopColor: "#e5e7eb" }} />
    </div>
  );
}

// ─── Panel dispatcher ─────────────────────────────────────────────────────────

function BlockPanel(props: BlockPanelProps) {
  switch (props.block.type) {
    case "paragraph": return <ParagraphPanel {...props} />;
    case "heading":   return <HeadingPanel {...props} />;
    case "image":     return <ImagePanel {...props} />;
    case "box":       return <BoxPanel {...props} />;
    case "table":     return <TablePanel {...props} />;
    case "list":      return <ListPanel {...props} />;
    case "divider":   return <DividerPanel {...props} />;
    default: return null;
  }
}

// ─── Single block row ─────────────────────────────────────────────────────────

interface BlockRowProps {
  block: Block;
  idx: number;
  total: number;
  onChange: (updated: Block) => void;
  onMove: (idx: number, dir: "up" | "down") => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
  config: EditorConfig;
  depth: number;
}

function BlockRow({ block, idx, total, onChange, onMove, onDelete, disabled, config, depth }: BlockRowProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        marginBottom: 8,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 10px",
          background: "#f8fafc",
          borderBottom: collapsed ? "none" : "1px solid #f1f5f9",
          borderRadius: collapsed ? 8 : "8px 8px 0 0",
        }}
      >
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: PURPLE,
            background: "#ede9fe",
            borderRadius: 4,
            padding: "1px 7px",
            flexShrink: 0,
          }}
        >
          {BLOCK_LABELS[block.type]}
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={iconBtn()}
          title={collapsed ? "Expand" : "Collapse"}
          disabled={disabled}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <button
          type="button"
          onClick={() => onMove(idx, "up")}
          disabled={disabled || idx === 0}
          style={iconBtn(idx === 0 ? "#d1d5db" : "#6b7280")}
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(idx, "down")}
          disabled={disabled || idx === total - 1}
          style={iconBtn(idx === total - 1 ? "#d1d5db" : "#6b7280")}
          title="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onDelete(block.id)}
          style={iconBtn("#dc2626")}
          title="Delete block"
          disabled={disabled}
        >
          🗑
        </button>
      </div>
      {/* Content */}
      {!collapsed && (
        <div style={{ padding: "10px 12px" }}>
          <BlockPanel block={block} onChange={onChange} disabled={disabled} config={config} />
        </div>
      )}
    </div>
  );
}

// ─── Inline block type strip (replaces floating dropdown — avoids overflow clipping) ──

interface AddBlockMenuProps {
  types: BlockType[];
  onAdd: (type: BlockType) => void;
  onAddTable?: (rows: number, cols: number) => void;
  disabled?: boolean;
}

function AddBlockMenu({ types, onAdd, onAddTable, disabled }: AddBlockMenuProps) {
  const [tablePick, setTablePick] = useState<{ rows: number; cols: number } | null>(null);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: "6px 8px",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: "0.68rem",
          fontWeight: 700,
          color: "#9ca3af",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginRight: 2,
          whiteSpace: "nowrap",
        }}
      >
        + Add:
      </span>
      {types.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => {
            if (t === "table" && onAddTable) {
              setTablePick(tablePick ? null : { rows: 3, cols: 2 });
            } else {
              onAdd(t);
            }
          }}
          disabled={disabled}
          style={{
            padding: "3px 9px",
            background: t === "table" && tablePick ? "#ede9fe" : "#fff",
            border: `1px solid ${t === "table" && tablePick ? PURPLE : "#e2e8f0"}`,
            borderRadius: 5,
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "0.75rem",
            color: t === "table" && tablePick ? PURPLE : "#374151",
            fontFamily: "inherit",
            opacity: disabled ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (!disabled && !(t === "table" && tablePick)) {
              (e.currentTarget as HTMLButtonElement).style.background = "#ede9fe";
              (e.currentTarget as HTMLButtonElement).style.borderColor = PURPLE;
              (e.currentTarget as HTMLButtonElement).style.color = PURPLE;
            }
          }}
          onMouseLeave={(e) => {
            if (!(t === "table" && tablePick)) {
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLButtonElement).style.color = "#374151";
            }
          }}
        >
          {BLOCK_LABELS[t]}
        </button>
      ))}

      {/* ── Table size picker — shown when ⊞ Table is clicked ── */}
      {tablePick && (
        <div
          style={{
            width: "100%",
            marginTop: 4,
            padding: "10px 12px",
            background: "#fff",
            border: `1px solid ${PURPLE}`,
            borderRadius: 8,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: PURPLE, whiteSpace: "nowrap" }}>
            Table size:
          </span>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "#374151" }}>
            Rows
            <input
              type="number"
              min={1}
              max={20}
              value={tablePick.rows}
              onChange={(e) =>
                setTablePick((p) =>
                  p ? { ...p, rows: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) } : p
                )
              }
              style={{
                width: 54,
                padding: "3px 6px",
                border: "1px solid #d1d5db",
                borderRadius: 5,
                fontSize: "0.82rem",
                textAlign: "center",
                fontFamily: "inherit",
              }}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.78rem", color: "#374151" }}>
            Columns
            <input
              type="number"
              min={1}
              max={10}
              value={tablePick.cols}
              onChange={(e) =>
                setTablePick((p) =>
                  p ? { ...p, cols: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) } : p
                )
              }
              style={{
                width: 54,
                padding: "3px 6px",
                border: "1px solid #d1d5db",
                borderRadius: 5,
                fontSize: "0.82rem",
                textAlign: "center",
                fontFamily: "inherit",
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onAddTable!(tablePick.rows, tablePick.cols);
              setTablePick(null);
            }}
            style={{
              padding: "4px 14px",
              fontSize: "0.78rem",
              background: PURPLE,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
            }}
          >
            Insert Table
          </button>
          <button
            type="button"
            onClick={() => setTablePick(null)}
            style={{
              padding: "4px 10px",
              fontSize: "0.78rem",
              background: "#f1f5f9",
              color: "#6b7280",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Nested block editor (for box children) ───────────────────────────────────

interface NestedBlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  disabled?: boolean;
  config: EditorConfig;
  depth: number;
}

function NestedBlockEditor({ blocks, onChange, disabled, config, depth }: NestedBlockEditorProps) {
  const allowedTypes = config === "flashcard" ? FLASH_BLOCK_TYPES : EBOOK_BLOCK_TYPES;
  const nested = depth >= 2 ? allowedTypes.filter((t) => t !== "box") : allowedTypes;

  const addBlock = (type: BlockType) => onChange([...blocks, createBlock(type)]);
  const addTableBlock = (rows: number, cols: number) => onChange([...blocks, createTableBlock(rows, cols)]);
  const updateAt = (idx: number, updated: Block) =>
    onChange(blocks.map((b, i) => (i === idx ? updated : b)));
  const moveAt = (idx: number, dir: "up" | "down") => onChange(moveBlock(blocks, idx, dir));
  const deleteById = (id: string) => onChange(removeBlock(blocks, id));

  return (
    <div>
      {blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          block={b}
          idx={i}
          total={blocks.length}
          onChange={(upd) => updateAt(i, upd)}
          onMove={moveAt}
          onDelete={deleteById}
          disabled={disabled}
          config={config}
          depth={depth}
        />
      ))}
      <AddBlockMenu types={nested} onAdd={addBlock} onAddTable={addTableBlock} disabled={disabled} />
    </div>
  );
}

// ─── Main BlockEditor ─────────────────────────────────────────────────────────

interface BlockEditorProps {
  doc: BlockDoc | null | undefined;
  onChange: (doc: BlockDoc) => void;
  config?: EditorConfig;
  disabled?: boolean;
  label?: string;
  minBlocks?: number;
}

export default function BlockEditor({
  doc,
  onChange,
  config = "ebook",
  disabled = false,
  label,
  minBlocks = 0,
}: BlockEditorProps) {
  const currentDoc: BlockDoc = doc && doc.v === 1 ? doc : emptyDoc();
  const { blocks } = currentDoc;

  const emit = useCallback(
    (newBlocks: Block[]) => onChange({ v: 1, blocks: newBlocks }),
    [onChange]
  );

  const addBlock = (type: BlockType) => emit([...blocks, createBlock(type)]);
  const addTableBlock = useCallback((rows: number, cols: number) => {
    emit([...blocks, createTableBlock(rows, cols)]);
  }, [blocks, emit]);
  const updateAt = (idx: number, updated: Block) =>
    emit(blocks.map((b, i) => (i === idx ? updated : b)));
  const moveAt = (idx: number, dir: "up" | "down") => emit(moveBlock(blocks, idx, dir));
  const deleteById = (id: string) => {
    if (minBlocks > 0 && blocks.length <= minBlocks) return;
    emit(removeBlock(blocks, id));
  };

  const allowedTypes = config === "flashcard" ? FLASH_BLOCK_TYPES : EBOOK_BLOCK_TYPES;

  return (
    <div>
      {label && (
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 700,
            color: "#374151",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {label}
          <span
            style={{
              fontSize: "0.7rem",
              color: "#9ca3af",
              fontWeight: 400,
              background: "#f3f4f6",
              borderRadius: 4,
              padding: "1px 6px",
            }}
          >
            {blocks.length} block{blocks.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div
        style={{
          maxHeight: config === "flashcard" ? 340 : 480,
          overflowY: "auto",
          overflowX: "hidden",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: blocks.length === 0 ? 0 : "8px 8px 2px",
          background: "#fafafa",
          marginBottom: 6,
        }}
      >
        {blocks.length === 0 && (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: "0.875rem",
              background: "#f9fafb",
              borderRadius: 8,
            }}
          >
            No blocks yet — click <strong>+ Add Block</strong> to start.
          </div>
        )}

        {blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            idx={i}
            total={blocks.length}
            onChange={(upd) => updateAt(i, upd)}
            onMove={moveAt}
            onDelete={deleteById}
            disabled={disabled}
            config={config}
            depth={0}
          />
        ))}
      </div>

      <AddBlockMenu types={allowedTypes} onAdd={addBlock} onAddTable={addTableBlock} disabled={disabled} />
    </div>
  );
}
