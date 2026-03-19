/**
 * Block factory helpers and HTML-to-blocks migration utility.
 */

import { Block, BlockDoc, BlockType, BOX_PRESETS, isBlockDoc } from "./schema";

// ─── ID generator ─────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ─── createBlock ──────────────────────────────────────────────────────────────

export function createBlock(type: BlockType): Block {
  const id = uid();
  switch (type) {
    case "paragraph":
      return { id, type, props: { html: "", align: "left" } };
    case "heading":
      return { id, type, props: { html: "", level: 2, align: "left" } };
    case "image":
      return { id, type, props: { src: "", alt: "", caption: "", width: "100%", align: "center" } };
    case "box": {
      const preset = BOX_PRESETS[0]; // "tip"
      return {
        id, type,
        props: {
          preset: preset.key,
          title: preset.label,
          headerBg: preset.headerBg,
          bodyBg: preset.bodyBg,
          accent: preset.accent,
          children: [createBlock("paragraph")],
        },
      };
    }
    case "table":
      return {
        id, type,
        props: {
          headers: ["Column 1", "Column 2"],
          rows: [["", ""], ["", ""]],
          caption: "",
          width: "full",
        },
      };
    case "list":
      return { id, type, props: { items: [""], ordered: false } };
    case "divider":
      return { id, type, props: { style: "solid" } };
  }
}

// ─── createTableBlock ─────────────────────────────────────────────────────────
/**
 * Creates a table block with a specific number of rows and columns.
 * Headers are pre-populated as "Column 1", "Column 2", etc.
 * All cells start empty.
 */
export function createTableBlock(rows: number, cols: number): Block {
  const id = uid();
  const headers = Array.from({ length: cols }, (_, i) => `Column ${i + 1}`);
  const rowsData: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => "")
  );
  return {
    id,
    type: "table",
    props: { headers, rows: rowsData, caption: "", width: "full" },
  };
}

// ─── emptyDocWithParagraph ────────────────────────────────────────────────────

export function emptyDocWithParagraph(): BlockDoc {
  return { v: 1, blocks: [createBlock("paragraph")] };
}

// ─── htmlToBlocks ─────────────────────────────────────────────────────────────
/**
 * Minimal migration: wraps existing HTML in a single paragraph block.
 * The HTML is preserved verbatim as the inline content of the paragraph.
 * This ensures zero content loss when migrating legacy ebook pages.
 *
 * Future enhancement: parse HTML into multiple typed blocks.
 */
export function htmlToBlocks(html: string): BlockDoc {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return emptyDocWithParagraph();
  return {
    v: 1,
    blocks: [
      { id: uid(), type: "paragraph", props: { html: trimmed, align: "left" } },
    ],
  };
}

// ─── ensureBlockDoc ───────────────────────────────────────────────────────────
/**
 * Coerces an unknown value to a valid BlockDoc.
 * - If it is already a valid BlockDoc → return as-is.
 * - If it is a non-empty string → treat as HTML and migrate.
 * - Otherwise → return an empty doc with one paragraph.
 */
export function ensureBlockDoc(val: unknown): BlockDoc {
  if (isBlockDoc(val)) return val;
  if (typeof val === "string" && val.trim()) return htmlToBlocks(val);
  return emptyDocWithParagraph();
}

// ─── moveBlock ────────────────────────────────────────────────────────────────

export function moveBlock(blocks: Block[], fromIdx: number, direction: "up" | "down"): Block[] {
  const arr = [...blocks];
  const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
  if (toIdx < 0 || toIdx >= arr.length) return arr;
  [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
  return arr;
}

// ─── removeBlock ─────────────────────────────────────────────────────────────

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

// ─── updateBlock ─────────────────────────────────────────────────────────────

export function updateBlock(blocks: Block[], id: string, patch: Partial<Block["props"]>): Block[] {
  return blocks.map((b) =>
    b.id === id ? { ...b, props: { ...b.props, ...patch } as any } : b
  );
}

// ─── blocksToHtmlString ───────────────────────────────────────────────────────
/**
 * Converts a BlockDoc to an HTML string for use in contexts that require raw HTML
 * (e.g. EBookViewer's annotation system which uses innerHTML).
 *
 * Produces clean, readable HTML that matches what BlockRenderer renders visually.
 */

function esc(text: string): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function blocksToHtmlString(doc: BlockDoc): string {
  function blockToHtml(b: Block): string {
    switch (b.type) {
      case "paragraph": {
        const align = b.props.align ?? "left";
        const colorStyle = b.props.textColor ? `color:${esc(b.props.textColor)};` : "";
        return `<p style="margin:0 0 0.75rem;line-height:1.7;text-align:${align};${colorStyle}">${b.props.html || ""}</p>`;
      }
      case "heading": {
        const lv = b.props.level;
        const align = b.props.align ?? "left";
        const sizes: Record<number, string> = { 1: "1.5rem", 2: "1.2rem", 3: "1rem" };
        const weights: Record<number, number> = { 1: 800, 2: 700, 3: 700 };
        return `<h${lv} style="margin:1rem 0 0.4rem;font-size:${sizes[lv]};font-weight:${weights[lv]};text-align:${align};">${b.props.html || ""}</h${lv}>`;
      }
      case "image": {
        const { src, alt = "", caption, width = "100%", align = "center" } = b.props;
        if (!src) return "";
        const justif = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
        const cap = caption ? `<figcaption style="margin-top:0.25rem;font-size:0.78rem;color:#6b7280;text-align:center;font-style:italic;">${esc(caption)}</figcaption>` : "";
        return `<figure style="margin:0 0 0.75rem;display:flex;justify-content:${justif};flex-direction:column;"><img src="${esc(src)}" alt="${esc(alt)}" style="max-width:${width};border-radius:6px;" />${cap}</figure>`;
      }
      case "box": {
        const { preset, title, headerBg, headerTextColor, bodyBg, bodyTextColor, borderColor, accent, customIcon, children } = b.props;
        const meta = BOX_PRESETS.find((m) => m.key === preset) ?? BOX_PRESETS[0];
        const hBg = esc(headerBg ?? meta.headerBg);
        const hText = esc(headerTextColor ?? "#fff");
        const bBg = esc(bodyBg ?? meta.bodyBg);
        const bTextStyle = bodyTextColor ? `color:${esc(bodyTextColor)};` : "";
        const border = esc(borderColor ?? accent ?? meta.accent);
        const icon = customIcon ?? meta.icon;
        const displayTitle = esc(title ?? meta.label);
        const inner = (children ?? []).map(blockToHtml).join("");
        return `<div style="margin:0 0 0.75rem;border-radius:8px;overflow:hidden;border:1.5px solid ${border};"><div style="background:${hBg};padding:7px 13px;font-weight:700;font-size:0.72rem;color:${hText};letter-spacing:0.07em;">${icon} ${displayTitle}</div><div style="background:${bBg};padding:11px 14px;${bTextStyle}">${inner}</div></div>`;
      }
      case "table": {
        const { headers, rows, caption, width = "full" } = b.props;
        const widthMap: Record<string, string> = { full: "100%", wide: "90%", medium: "70%", compact: "auto" };
        const w = widthMap[width] ?? "100%";
        const cap = caption ? `<p style="font-size:0.78rem;color:#6b7280;margin-bottom:0.25rem;font-style:italic;">${esc(caption)}</p>` : "";
        const thead = `<thead><tr>${(headers ?? []).map((h) => `<th style="border:1px solid #d1d5db;padding:7px 12px;background:#f3f4f6;font-weight:700;text-align:left;">${esc(h)}</th>`).join("")}</tr></thead>`;
        const tbody = `<tbody>${(rows ?? []).map((row, ri) => `<tr>${row.map((cell) => `<td style="border:1px solid #d1d5db;padding:7px 12px;background:${ri % 2 === 0 ? "#fff" : "#f9fafb"};">${cell}</td>`).join("")}</tr>`).join("")}</tbody>`;
        return `<div style="margin:0 0 0.75rem;overflow-x:auto;">${cap}<table style="width:${w};border-collapse:collapse;font-size:0.875rem;">${thead}${tbody}</table></div>`;
      }
      case "list": {
        const { items, ordered } = b.props;
        const tag = ordered ? "ol" : "ul";
        const lis = items.map((item) => `<li>${item}</li>`).join("");
        return `<${tag} style="margin:0 0 0.75rem;padding-left:1.5rem;line-height:1.65;">${lis}</${tag}>`;
      }
      case "divider": {
        const borderStyle = b.props.style ?? "solid";
        return `<hr style="margin:0.75rem 0;border:none;border-top:2px ${borderStyle} #e5e7eb;" />`;
      }
      default:
        return "";
    }
  }

  if (!isBlockDoc(doc)) return "";
  return doc.blocks.map(blockToHtml).join("\n");
}
