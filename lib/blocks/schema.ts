/**
 * Shared block schema for the Saphala structured block editor.
 * Version 1 — all content documents carry `{ v: 1, blocks: Block[] }`.
 *
 * This schema is the single source of truth for:
 *   - EBook pages  (stored in EBookPage.contentBlocks)
 *   - Flashcard INFO card body  (stored in FlashcardCard.content.bodyBlocks)
 *   - Any future structured content field
 */

// ─── Block types ─────────────────────────────────────────────────────────────

export type BlockType =
  | "paragraph"
  | "heading"
  | "image"
  | "box"
  | "table"
  | "list"
  | "divider";

// ─── Per-type props ───────────────────────────────────────────────────────────

export type TextAlign = "left" | "center" | "right";
export type WidthPreset = "25%" | "50%" | "75%" | "100%";
export type BoxPreset =
  | "tip" | "important" | "remember" | "example"
  | "concept" | "definition" | "warning" | "examfocus"
  | "formula" | "casestudy" | "note" | "custom";

export interface ParagraphProps {
  html: string;
  align?: TextAlign;
  textColor?: string;
}

export interface HeadingProps {
  html: string;
  level: 1 | 2 | 3;
  align?: TextAlign;
}

export interface ImageProps {
  src: string;
  alt?: string;
  caption?: string;
  width?: WidthPreset;
  align?: TextAlign;
}

export interface BoxProps {
  preset: BoxPreset;
  title?: string;
  /** Only used when preset === "custom" — full visual control */
  headerBg?: string;
  headerTextColor?: string;
  bodyBg?: string;
  bodyTextColor?: string;
  borderColor?: string;
  customIcon?: string;
  /** Legacy accent used for border fallback in preset boxes */
  accent?: string;
  children: Block[];
}

export interface TableProps {
  headers: string[];
  rows: string[][];
  caption?: string;
  width?: "full" | "wide" | "medium" | "compact";
}

export interface ListProps {
  items: string[];
  ordered: boolean;
}

export interface DividerProps {
  style?: "solid" | "dashed" | "dotted";
}

// ─── Discriminated union ──────────────────────────────────────────────────────

export type Block =
  | { id: string; type: "paragraph"; props: ParagraphProps }
  | { id: string; type: "heading";   props: HeadingProps }
  | { id: string; type: "image";     props: ImageProps }
  | { id: string; type: "box";       props: BoxProps }
  | { id: string; type: "table";     props: TableProps }
  | { id: string; type: "list";      props: ListProps }
  | { id: string; type: "divider";   props: DividerProps };

// ─── Versioned document ───────────────────────────────────────────────────────

export interface BlockDoc {
  v: 1;
  blocks: Block[];
}

// ─── Box preset catalogue ─────────────────────────────────────────────────────

export interface BoxPresetMeta {
  key: BoxPreset;
  icon: string;
  label: string;
  headerBg: string;
  bodyBg: string;
  accent: string;
}

export const BOX_PRESETS: BoxPresetMeta[] = [
  { key: "tip",        icon: "💡", label: "TIP",         headerBg: "#16a34a", bodyBg: "#f0fdf4", accent: "#86efac" },
  { key: "important",  icon: "❗", label: "IMPORTANT",   headerBg: "#dc2626", bodyBg: "#fff1f2", accent: "#fca5a5" },
  { key: "remember",   icon: "🔖", label: "REMEMBER",    headerBg: "#d97706", bodyBg: "#fffbeb", accent: "#fde68a" },
  { key: "example",    icon: "📝", label: "EXAMPLE",     headerBg: "#0284c7", bodyBg: "#f0f9ff", accent: "#bae6fd" },
  { key: "concept",    icon: "💎", label: "CONCEPT",     headerBg: "#7c3aed", bodyBg: "#faf5ff", accent: "#ddd6fe" },
  { key: "definition", icon: "📖", label: "DEFINITION",  headerBg: "#ea580c", bodyBg: "#fff7ed", accent: "#fed7aa" },
  { key: "warning",    icon: "⚠️", label: "WARNING",     headerBg: "#ca8a04", bodyBg: "#fefce8", accent: "#fef08a" },
  { key: "examfocus",  icon: "🎯", label: "EXAM FOCUS",  headerBg: "#b45309", bodyBg: "#fffbeb", accent: "#fde68a" },
  { key: "formula",    icon: "🔢", label: "FORMULA",     headerBg: "#6d28d9", bodyBg: "#f5f3ff", accent: "#c4b5fd" },
  { key: "casestudy",  icon: "🔍", label: "CASE STUDY",  headerBg: "#0f766e", bodyBg: "#f0fdfa", accent: "#99f6e4" },
  { key: "note",       icon: "ℹ️",  label: "NOTE",        headerBg: "#2563eb", bodyBg: "#eff6ff", accent: "#bfdbfe" },
  { key: "custom",     icon: "📌", label: "CUSTOM",      headerBg: "#475569", bodyBg: "#f8fafc", accent: "#cbd5e1" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isBlockDoc(val: unknown): val is BlockDoc {
  return (
    typeof val === "object" &&
    val !== null &&
    (val as any).v === 1 &&
    Array.isArray((val as any).blocks)
  );
}

export function emptyDoc(): BlockDoc {
  return { v: 1, blocks: [] };
}
