"use client";

/**
 * BlockRenderer — renders a BlockDoc to clean JSX.
 *
 * Used by:
 *   - BlockEditor (live preview)
 *   - EBookViewer (student-facing content)
 *   - Flashcard student player (card content)
 *
 * Inline text in paragraph/heading blocks is rendered via dangerouslySetInnerHTML
 * (the text is already sanitised HTML produced by the editor). All structural
 * elements (tables, lists, boxes, images, dividers) are pure JSX.
 */

import React from "react";
import { Block, BlockDoc, BOX_PRESETS, isBlockDoc } from "@/lib/blocks/schema";

// ─── Props ────────────────────────────────────────────────────────────────────

interface BlockRendererProps {
  doc: BlockDoc | null | undefined;
  /** Compact mode for flashcard cards (tighter spacing) */
  compact?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// ─── Width map ────────────────────────────────────────────────────────────────

const WIDTH_MAP: Record<string, string> = {
  "25%": "25%",
  "50%": "50%",
  "75%": "75%",
  "100%": "100%",
};

const TABLE_WIDTH_MAP: Record<string, string> = {
  full: "100%",
  wide: "90%",
  medium: "70%",
  compact: "auto",
};

// ─── Align map ────────────────────────────────────────────────────────────────

const ALIGN_MAP: Record<string, React.CSSProperties> = {
  left: { textAlign: "left" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
};

// ─── Single block ─────────────────────────────────────────────────────────────

function RenderBlock({ block, compact }: { block: Block; compact?: boolean }) {
  const sp = compact ? "0.4rem" : "0.75rem";

  switch (block.type) {
    case "paragraph": {
      const { html, align = "left", textColor } = block.props;
      return (
        <p
          style={{
            margin: `0 0 ${sp}`,
            lineHeight: 1.7,
            fontSize: compact ? "0.875rem" : "0.9375rem",
            color: textColor ?? "#1f2937",
            ...ALIGN_MAP[align],
          }}
          dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
        />
      );
    }

    case "heading": {
      const { html, level, align = "left" } = block.props;
      const sizes: Record<number, string> = { 1: "1.5rem", 2: "1.2rem", 3: "1rem" };
      const weights: Record<number, number> = { 1: 800, 2: 700, 3: 700 };
      const margins: Record<number, string> = {
        1: `1.25rem 0 0.5rem`,
        2: `1rem 0 0.4rem`,
        3: `0.75rem 0 0.35rem`,
      };
      const Tag = (`h${level}`) as "h1" | "h2" | "h3";
      return (
        <Tag
          style={{
            margin: compact ? `0.5rem 0 0.25rem` : margins[level],
            fontSize: compact ? "1rem" : sizes[level],
            fontWeight: weights[level],
            color: "#111827",
            lineHeight: 1.3,
            ...ALIGN_MAP[align],
          }}
          dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
        />
      );
    }

    case "image": {
      const { src, alt = "", caption, width = "100%", align = "center" } = block.props;
      if (!src) return null;
      const widthVal = WIDTH_MAP[width] ?? "100%";
      const outerAlign: React.CSSProperties =
        align === "center"
          ? { display: "flex", justifyContent: "center" }
          : align === "right"
          ? { display: "flex", justifyContent: "flex-end" }
          : {};
      return (
        <figure
          style={{
            margin: `0 0 ${sp}`,
            padding: 0,
            ...outerAlign,
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: widthVal,
              width: "100%",
              height: "auto",
              borderRadius: 6,
              display: "block",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {caption && (
            <figcaption
              style={{
                marginTop: "0.25rem",
                fontSize: "0.78rem",
                color: "#6b7280",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case "box": {
      const { preset, title, headerBg, headerTextColor, bodyBg, bodyTextColor, borderColor, accent, customIcon, children } = block.props;
      const meta = BOX_PRESETS.find((p) => p.key === preset);
      const hBg = headerBg ?? meta?.headerBg ?? "#475569";
      const hText = headerTextColor ?? "#fff";
      const bBg = bodyBg ?? meta?.bodyBg ?? "#f8fafc";
      const bText = bodyTextColor ?? undefined;
      const border = borderColor ?? accent ?? meta?.accent ?? "#cbd5e1";
      const icon = customIcon ?? meta?.icon ?? "📌";
      const displayTitle = title ?? meta?.label ?? "NOTE";
      return (
        <div
          style={{
            margin: `0 0 ${sp}`,
            borderRadius: 8,
            overflow: "hidden",
            border: `1.5px solid ${border}`,
          }}
        >
          <div
            style={{
              background: hBg,
              padding: "7px 13px",
              fontWeight: 700,
              fontSize: "0.72rem",
              color: hText,
              letterSpacing: "0.07em",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {icon} {displayTitle}
          </div>
          <div style={{ background: bBg, padding: compact ? "8px 12px" : "11px 14px", color: bText }}>
            {children && children.length > 0 ? (
              <BlockList blocks={children} compact={compact} />
            ) : (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280", fontStyle: "italic" }}>
                (empty box)
              </p>
            )}
          </div>
        </div>
      );
    }

    case "table": {
      const { headers, rows, caption, width = "full", headerBg, headerTextColor } = block.props;
      const tableWidth = TABLE_WIDTH_MAP[width] ?? "100%";
      const thBg   = headerBg        ?? "#f3f4f6";
      const thText = headerTextColor ?? "#374151";
      return (
        <div style={{ margin: `0 0 ${sp}`, overflowX: "auto" }}>
          {caption && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "#6b7280",
                marginBottom: "0.25rem",
                fontStyle: "italic",
              }}
            >
              {caption}
            </p>
          )}
          <table
            style={{
              width: tableWidth,
              borderCollapse: "collapse",
              fontSize: compact ? "0.8rem" : "0.875rem",
            }}
          >
            {headers && headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        border: "1px solid #d1d5db",
                        padding: compact ? "4px 8px" : "7px 12px",
                        background: thBg,
                        fontWeight: 700,
                        textAlign: "left",
                        color: thText,
                      }}
                      dangerouslySetInnerHTML={{ __html: h || "" }}
                    />
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        border: "1px solid #d1d5db",
                        padding: compact ? "4px 8px" : "7px 12px",
                        color: "#1f2937",
                        background: ri % 2 === 0 ? "#fff" : "#f9fafb",
                        verticalAlign: "top",
                      }}
                      dangerouslySetInnerHTML={{ __html: cell || "" }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "list": {
      const { items, ordered } = block.props;
      const Tag = ordered ? "ol" : "ul";
      return (
        <Tag
          style={{
            margin: `0 0 ${sp}`,
            paddingLeft: "1.5rem",
            fontSize: compact ? "0.875rem" : "0.9375rem",
            color: "#1f2937",
            lineHeight: 1.65,
          }}
        >
          {items.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: item || "" }} />
          ))}
        </Tag>
      );
    }

    case "divider": {
      const borderStyle = block.props.style ?? "solid";
      return (
        <hr
          style={{
            margin: `${sp} 0`,
            border: "none",
            borderTop: `2px ${borderStyle} #e5e7eb`,
          }}
        />
      );
    }

    default:
      return null;
  }
}

// ─── Block list (recursive for nested box children) ──────────────────────────

function BlockList({ blocks, compact }: { blocks: Block[]; compact?: boolean }) {
  return (
    <>
      {blocks.map((b) => (
        <RenderBlock key={b.id} block={b} compact={compact} />
      ))}
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function BlockRenderer({ doc, compact = false, style, className }: BlockRendererProps) {
  if (!doc || !isBlockDoc(doc) || doc.blocks.length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        lineHeight: 1.7,
        wordBreak: "break-word",
        ...style,
      }}
    >
      <BlockList blocks={doc.blocks} compact={compact} />
    </div>
  );
}
