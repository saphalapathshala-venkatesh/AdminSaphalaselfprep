import type { CSSProperties } from "react";

export const BRAND = {
  purple:       "#7c3aed",
  purpleDark:   "#6d28d9",
  purpleDeep:   "#4c1d95",
  purpleLight:  "#ede9fe",
  purpleText:   "#5b21b6",
  blue:         "#2563eb",
  green:        "#16a34a",
  red:          "#ef4444",
  cyan:         "#0891b2",
  gray:         "#6b7280",
  grayLight:    "#f3f4f6",
  grayBorder:   "#e5e7eb",
  white:        "#ffffff",
  text:         "#111827",
  textMuted:    "#6b7280",
} as const;

export const adminBtn = {
  primary: {
    padding: "0.5rem 1rem",
    background: BRAND.purple,
    color: BRAND.white,
    border: "none",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontWeight: 500,
  } as CSSProperties,

  secondary: {
    padding: "0.25rem 0.75rem",
    background: BRAND.grayLight,
    color: "#374151",
    border: `1px solid ${BRAND.grayBorder}`,
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontSize: "0.75rem",
  } as CSSProperties,

  danger: {
    padding: "0.25rem 0.75rem",
    background: BRAND.red,
    color: BRAND.white,
    border: "none",
    borderRadius: "0.375rem",
    cursor: "pointer",
    fontSize: "0.75rem",
  } as CSSProperties,

  small: {
    padding: "0.1875rem 0.5rem",
    backgroundColor: BRAND.purple,
    color: BRAND.white,
    border: "none",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 500,
    cursor: "pointer",
  } as CSSProperties,
} as const;

export const adminCard: CSSProperties = {
  background: BRAND.white,
  borderRadius: "0.5rem",
  padding: "1rem",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
};

export const adminTable = {
  th: {
    padding: "0.75rem",
    textAlign: "left" as const,
    borderBottom: `2px solid ${BRAND.grayBorder}`,
    fontSize: "0.75rem",
    fontWeight: 600,
    color: BRAND.textMuted,
    textTransform: "uppercase" as const,
  } as CSSProperties,
  td: {
    padding: "0.75rem",
    borderBottom: `1px solid ${BRAND.grayLight}`,
    fontSize: "0.875rem",
  } as CSSProperties,
} as const;
