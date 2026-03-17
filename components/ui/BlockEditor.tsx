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
import { createBlock, moveBlock, removeBlock } from "@/lib/blocks/defaults";
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

function BoxPanel({ block, onChange, disabled, config }: BlockPanelProps) {
  if (block.type !== "box") return null;
  const p = block.props;
  const meta = BOX_PRESETS.find((m) => m.key === p.preset) ?? BOX_PRESETS[0];

  const setChildren = (children: Block[]) =>
    onChange({ ...block, props: { ...p, children } });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <div>
          <label style={labelSt}>Box type</label>
          <select
            value={p.preset}
            onChange={(e) => {
              const nm = BOX_PRESETS.find((m) => m.key === e.target.value) ?? BOX_PRESETS[0];
              onChange({
                ...block,
                props: {
                  ...p,
                  preset: nm.key,
                  title: nm.label,
                  headerBg: nm.headerBg,
                  bodyBg: nm.bodyBg,
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
            onChange={(e) => onChange({ ...block, props: { ...p, title: e.target.value } })}
            style={inp}
            disabled={disabled}
          />
        </div>
      </div>
      <div
        style={{
          borderRadius: 8,
          overflow: "hidden",
          border: `1.5px solid ${p.accent ?? meta.accent}`,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            background: p.headerBg ?? meta.headerBg,
            padding: "5px 12px",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.07em",
          }}
        >
          {meta.icon} {p.title ?? meta.label}
        </div>
        <div style={{ padding: 10, background: p.bodyBg ?? meta.bodyBg }}>
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

function TablePanel({ block, onChange, disabled }: BlockPanelProps) {
  if (block.type !== "table") return null;
  const p = block.props;

  const setHeaders = (headers: string[]) => onChange({ ...block, props: { ...p, headers } });
  const setRows = (rows: string[][]) => onChange({ ...block, props: { ...p, rows } });

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
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {p.headers.map((h, ci) => (
                <th
                  key={ci}
                  style={{ border: "1px solid #d1d5db", padding: 2, background: "#f3f4f6", minWidth: 80 }}
                >
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <input
                      value={h}
                      onChange={(e) => {
                        const nh = [...p.headers];
                        nh[ci] = e.target.value;
                        setHeaders(nh);
                      }}
                      style={{ ...inp, fontWeight: 700, fontSize: "0.8rem", padding: "3px 6px" }}
                      disabled={disabled}
                    />
                    {p.headers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCol(ci)}
                        style={{ ...iconBtn("#dc2626"), padding: "1px 4px", fontSize: "0.7rem" }}
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
                    style={{ border: "1px solid #d1d5db", padding: 2, background: ri % 2 === 0 ? "#fff" : "#f9fafb" }}
                  >
                    <input
                      value={cell}
                      onChange={(e) => {
                        const nr = p.rows.map((r, r2) =>
                          r2 === ri ? r.map((c, c2) => (c2 === ci ? e.target.value : c)) : r
                        );
                        setRows(nr);
                      }}
                      style={{ ...inp, padding: "3px 6px", fontSize: "0.8rem" }}
                      disabled={disabled}
                    />
                  </td>
                ))}
                {p.rows.length > 1 && (
                  <td style={{ border: "none", padding: 2 }}>
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

// ─── Add block menu ───────────────────────────────────────────────────────────

interface AddBlockMenuProps {
  types: BlockType[];
  onAdd: (type: BlockType) => void;
  disabled?: boolean;
}

function AddBlockMenu({ types, onAdd, disabled }: AddBlockMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        style={{
          padding: "5px 14px",
          background: PURPLE,
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: "0.8rem",
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        + Add Block
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 100,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 6,
            marginTop: 4,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            minWidth: 220,
          }}
        >
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onAdd(t); setOpen(false); }}
              style={{
                padding: "6px 10px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "#374151",
                textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#ede9fe"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
            >
              {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
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
      <AddBlockMenu types={nested} onAdd={addBlock} disabled={disabled} />
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

      {blocks.length === 0 && (
        <div
          style={{
            padding: "1.5rem",
            textAlign: "center",
            color: "#9ca3af",
            fontSize: "0.875rem",
            background: "#f9fafb",
            border: "2px dashed #e2e8f0",
            borderRadius: 8,
            marginBottom: 8,
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

      <div style={{ marginTop: 6 }}>
        <AddBlockMenu types={allowedTypes} onAdd={addBlock} disabled={disabled} />
      </div>
    </div>
  );
}
