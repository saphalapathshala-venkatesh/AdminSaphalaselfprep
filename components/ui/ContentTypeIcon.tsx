"use client";

import React from "react";

type ItemType = "VIDEO" | "LIVE_CLASS" | "PDF" | "FLASHCARD_DECK" | "HTML_PAGE" | "TEST" | "EXTERNAL_LINK";

interface ContentTypeIconProps {
  type: ItemType;
  size?: number;
  color?: string;
}

export function ContentTypeIcon({ type, size = 36, color }: ContentTypeIconProps) {
  const s = size;

  switch (type) {
    case "VIDEO":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#7c3aed"} fillOpacity="0.12" />
          <circle cx="18" cy="18" r="10" fill={color || "#7c3aed"} fillOpacity="0.18" />
          <polygon points="15,13 15,23 25,18" fill={color || "#7c3aed"} />
        </svg>
      );

    case "LIVE_CLASS":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#ef4444"} fillOpacity="0.12" />
          <circle cx="18" cy="18" r="10" stroke={color || "#ef4444"} strokeWidth="1.5" fill="none" />
          <circle cx="18" cy="18" r="4" fill={color || "#ef4444"} />
          <circle cx="26" cy="10" r="3" fill={color || "#ef4444"} />
          <text x="24" y="12" fontSize="4" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">LIVE</text>
        </svg>
      );

    case "PDF":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#dc2626"} fillOpacity="0.12" />
          <rect x="8" y="7" width="20" height="22" rx="3" fill={color || "#dc2626"} fillOpacity="0.15" stroke={color || "#dc2626"} strokeWidth="1.2" />
          <text
            x="18"
            y="20"
            fontSize="7"
            fontFamily="'Arial', sans-serif"
            fontWeight="900"
            fill={color || "#dc2626"}
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="0.5"
          >
            PDF
          </text>
        </svg>
      );

    case "HTML_PAGE":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#0891b2"} fillOpacity="0.12" />
          <rect x="8" y="5" width="15" height="20" rx="2.5" fill={color || "#0891b2"} fillOpacity="0.15" stroke={color || "#0891b2"} strokeWidth="1.2" />
          <rect x="13" y="7" width="15" height="20" rx="2.5" fill={color || "#0891b2"} fillOpacity="0.25" stroke={color || "#0891b2"} strokeWidth="1.2" />
          <text
            x="20"
            y="18.5"
            fontSize="5"
            fontFamily="'Arial', sans-serif"
            fontWeight="900"
            fill={color || "#0891b2"}
            textAnchor="middle"
            dominantBaseline="middle"
            letterSpacing="0.2"
          >
            E-Bk
          </text>
        </svg>
      );

    case "FLASHCARD_DECK":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#059669"} fillOpacity="0.12" />
          <rect x="4"  y="14" width="17" height="13" rx="2.5" fill={color || "#059669"} fillOpacity="0.25" stroke={color || "#059669"} strokeWidth="1" />
          <rect x="7"  y="11" width="17" height="13" rx="2.5" fill={color || "#059669"} fillOpacity="0.35" stroke={color || "#059669"} strokeWidth="1" />
          <rect x="10" y="8"  width="17" height="13" rx="2.5" fill={color || "#059669"} fillOpacity="0.45" stroke={color || "#059669"} strokeWidth="1" />
          <rect x="13" y="5"  width="17" height="13" rx="2.5" fill={color || "#059669"} fillOpacity="0.6" stroke={color || "#059669"} strokeWidth="1.2" />
          <rect x="16" y="2"  width="17" height="13" rx="2.5" fill={color || "#059669"} stroke={color || "#059669"} strokeWidth="1.2" />
        </svg>
      );

    case "TEST":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#d97706"} fillOpacity="0.12" />
          <rect x="8" y="7" width="20" height="22" rx="3" fill={color || "#d97706"} fillOpacity="0.15" stroke={color || "#d97706"} strokeWidth="1.2" />
          <line x1="12" y1="13" x2="24" y2="13" stroke={color || "#d97706"} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="17" x2="24" y2="17" stroke={color || "#d97706"} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="21" x2="20" y2="21" stroke={color || "#d97706"} strokeWidth="1.5" strokeLinecap="round" />
          <polyline points="20,24 22,26 26,20" stroke={color || "#d97706"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      );

    case "EXTERNAL_LINK":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="8" fill={color || "#0369a1"} fillOpacity="0.12" />
          <circle cx="18" cy="18" r="9" stroke={color || "#0369a1"} strokeWidth="1.4" fill="none" />
          <ellipse cx="18" cy="18" rx="4.5" ry="9" stroke={color || "#0369a1"} strokeWidth="1.2" fill="none" />
          <line x1="9" y1="18" x2="27" y2="18" stroke={color || "#0369a1"} strokeWidth="1.2" />
          <line x1="10" y1="14" x2="26" y2="14" stroke={color || "#0369a1"} strokeWidth="1" />
          <line x1="10" y1="22" x2="26" y2="22" stroke={color || "#0369a1"} strokeWidth="1" />
          <polyline points="22,11 26,11 26,15" stroke={color || "#0369a1"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <line x1="22" y1="15" x2="26" y2="11" stroke={color || "#0369a1"} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    default:
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" fill="none">
          <rect width="36" height="36" rx="8" fill="#6b7280" fillOpacity="0.12" />
          <rect x="10" y="10" width="16" height="16" rx="3" fill="#6b7280" fillOpacity="0.4" />
        </svg>
      );
  }
}

export function contentTypeLabel(type: ItemType): string {
  switch (type) {
    case "VIDEO": return "Video";
    case "LIVE_CLASS": return "Live Class";
    case "PDF": return "PDF";
    case "HTML_PAGE": return "E-Book";
    case "FLASHCARD_DECK": return "Flashcard Deck";
    case "TEST": return "Test";
    case "EXTERNAL_LINK": return "External Link";
    default: return type;
  }
}
